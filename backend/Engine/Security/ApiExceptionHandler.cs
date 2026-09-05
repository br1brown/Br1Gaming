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
/// Intercetta le eccezioni di dominio (<see cref="ApiException"/>) prima del middleware di default,
/// restituendo al client un JSON strutturato con lo status HTTP appropriato e il messaggio
/// localizzato tramite <c>.resx</c>.
/// Le eccezioni non applicative (veri e propri bug del codice) vengono ignorate
/// per permettere al gestore ASP.NET di restituire un 500 opaco di sicurezza.
/// Inoltra inoltre la segnalazione di errore a <see cref="IErrorReportingService"/> se configurato.
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
