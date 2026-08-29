using System.Globalization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Localization;
using Backend;
using Backend.Diagnostics;
using Backend.Models;
using Backend.Tasks;

namespace Backend.Security;

/// <summary>
/// Traduce le <see cref="ApiException"/> applicative in risposte Problem Details coerenti.
/// </summary>
/// <remarks>
/// <para>
/// Questo handler e' il punto di raccordo tra la logica dei controller e la risposta HTTP.
/// Nel template, i controller non catturano eccezioni e non costruiscono risposte di errore:
/// lanciano un'eccezione della gerarchia <see cref="ApiException"/> e questo handler la
/// converte automaticamente in un payload JSON strutturato secondo RFC 9457 (Problem Details).
/// </para>
/// <para>
/// Il flusso completo e':
/// <list type="number">
/// <item>Un controller lancia <c>throw new NotFoundException("utente")</c></item>
/// <item>L'eccezione risale la pipeline fino al middleware <c>UseExceptionHandler()</c></item>
/// <item>ASP.NET la passa a questo handler tramite <see cref="TryHandleAsync"/></item>
/// <item>L'handler verifica che sia una nostra <see cref="ApiException"/></item>
/// <item>Se si': imposta lo status code (es. 404) e scrive il ProblemDetails</item>
/// <item>Se no': restituisce false, e ASP.NET usa il suo handler di default</item>
/// </list>
/// </para>
/// <para>
/// Il vantaggio e' duplice:
/// <list type="bullet">
/// <item>I controller restano puliti: <c>throw</c> e basta, niente try/catch, niente
///   costruzione manuale di <c>IActionResult</c> di errore.</item>
/// <item>Il frontend riceve sempre lo stesso formato JSON (status + detail), che
///   <c>NotificationService</c> sa gia' come parsare e mostrare all'utente.
///   Il <c>detail</c> arriva gia' localizzato (l'handler risolve la chiave dell'eccezione
///   nella lingua della richiesta via .resx). Se il frontend preferisce, puo' comunque
///   ignorarlo e usare una propria traduzione i18n in base allo status code.</item>
/// </list>
/// </para>
/// <para>
/// Le eccezioni NON appartenenti alla gerarchia <see cref="ApiException"/> (es.
/// <c>NullReferenceException</c>, errori di database) vengono ignorate da questo handler
/// e gestite dal comportamento di default di ASP.NET, che restituisce un 500 generico
/// senza esporre dettagli interni (sicurezza).
/// </para>
/// </remarks>
public class ApiExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails;
    private readonly IStringLocalizer<SharedResource> _localizer;
    private readonly ILogger<ApiExceptionHandler> _logger;
    private readonly IErrorReportingService _errorReporting;
    private readonly IBackgroundTaskQueue _backgroundQueue;

    /// <summary>
    /// Inizializza l'handler con il servizio ASP.NET che serializza i Problem Details,
    /// il localizzatore dei messaggi d'errore, il logger e la segnalazione errori.
    /// </summary>
    /// <param name="problemDetails">Servizio usato per scrivere la risposta di errore.</param>
    /// <param name="localizer">Risolve la chiave dell'eccezione nella lingua della richiesta.</param>
    /// <param name="logger">Logger per segnalare chiavi resx mancanti.</param>
    /// <param name="errorReporting">Segnala l'errore a un webhook esterno, se configurato (§ ErrorReporting).</param>
    /// <param name="backgroundQueue">Accoda la segnalazione fuori dalla richiesta HTTP corrente.</param>
    public ApiExceptionHandler(
        IProblemDetailsService problemDetails,
        IStringLocalizer<SharedResource> localizer,
        ILogger<ApiExceptionHandler> logger,
        IErrorReportingService errorReporting,
        IBackgroundTaskQueue backgroundQueue)
    {
        _problemDetails = problemDetails;
        _localizer = localizer;
        _logger = logger;
        _errorReporting = errorReporting;
        _backgroundQueue = backgroundQueue;
    }

    /// <summary>
    /// <see langword="true"/> se l'eccezione merita una segnalazione al webhook di error reporting:
    /// qualunque eccezione non applicativa (un bug vero, sempre un 500 di fatto) o un'<see cref="ApiException"/>
    /// con status ≥500 (upstream/infrastruttura). Un 4xx applicativo (401/404/422...) è traffico
    /// normale, non un errore da segnalare — altrimenti ogni 404 di un bot ti manderebbe un alert.
    /// </summary>
    private static bool ShouldReport(Exception exception) =>
        exception is not ApiException apiEx || apiEx.StatusCode >= 500;

    /// <summary>
    /// Gestisce l'eccezione corrente solo se appartiene alla gerarchia <see cref="ApiException"/>.
    /// </summary>
    /// <param name="httpContext">Contesto HTTP associato alla richiesta.</param>
    /// <param name="exception">Eccezione sollevata dalla pipeline.</param>
    /// <param name="cancellationToken">Token di cancellazione associato alla richiesta.</param>
    /// <returns>
    /// <see langword="true"/> quando l'eccezione e' stata convertita in risposta HTTP;
    /// <see langword="false"/> quando deve essere gestita da altri handler (eccezioni non
    /// applicative, come errori di sistema, che non devono esporre dettagli al client).
    /// </returns>
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var _ = cancellationToken;

        // Error reporting: PRIMA del filtro "solo ApiException" sotto, perché deve vedere anche i
        // bug veri (NullReference, errori DB...) che quel filtro lascia passare ad ASP.NET. Lo
        // snapshot (ErrorReport) si costruisce QUI, sincrono: la HttpContext live non è sicura da
        // leggere da un task in background (Kestrel la ricicla dopo la risposta).
        if (_errorReporting.IsEnabled && ShouldReport(exception))
        {
            var report = new ErrorReport
            {
                Message = exception.Message,
                ExceptionType = exception.GetType().FullName ?? exception.GetType().Name,
                StatusCode = exception is ApiException reportedEx ? reportedEx.StatusCode : 500,
                Path = httpContext.Request.Path.Value,
                Method = httpContext.Request.Method,
                StackTrace = exception.StackTrace,
            };
            _backgroundQueue.TryEnqueue((services, ct) =>
                services.GetRequiredService<IErrorReportingService>().ReportAsync(report, ct));
        }

        // Solo le nostre eccezioni applicative vengono gestite.
        // Tutto il resto (NullReference, errori DB, etc.) viene lasciato
        // ad ASP.NET, che restituisce un 500 generico senza esporre
        // stack trace o dettagli interni al client.
        if (exception is not ApiException apiEx)
            return false;

        // Imposta lo status code HTTP definito nell'eccezione
        // (es. NotFoundException → 404, InvalidParametersException → 400)
        httpContext.Response.StatusCode = apiEx.StatusCode;

        // La cultura della richiesta è async-local: impostata da UseRequestLocalization più in
        // basso nella pipeline, non è in scope qui (l'eccezione è risalita oltre quel middleware).
        // La leggiamo dalla IRequestCultureFeature, che resta sull'HttpContext, e la riapplichiamo
        // prima di risolvere il messaggio così IStringLocalizer usa la lingua giusta.
        var requestCulture = httpContext.Features.Get<IRequestCultureFeature>()?.RequestCulture;
        if (requestCulture is not null)
            CultureInfo.CurrentUICulture = requestCulture.UICulture;

        // Se la chiave manca nei .resx, LocalizedString.Value restituisce la chiave grezza;
        // loghiamo un warning per renderla visibile senza esporre dettagli al client.
        var detail = _localizer[apiEx.MessageKey, apiEx.MessageArgs];
        if (detail.ResourceNotFound)
            _logger.LogWarning("Chiave resx '{Key}' non trovata: il client ricevera' la chiave grezza nel campo detail.", apiEx.MessageKey);

        // Per 429 e 503, aggiunge l'header Retry-After se l'eccezione lo specifica (RFC 9110).
        if (apiEx.RetryAfterSeconds.HasValue)
            httpContext.Response.Headers.RetryAfter = apiEx.RetryAfterSeconds.Value.ToString();

        // Scrive il payload ProblemDetails JSON con lo status code e il messaggio.
        // Il frontend leggera' il campo "detail" per mostrare l'errore all'utente.
        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = apiEx.StatusCode,
                Detail = detail.Value
            },
            Exception = exception
        });
    }
}
