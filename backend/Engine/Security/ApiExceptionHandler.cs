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

/// <summary>Traduce le <see cref="ApiException"/> applicative in ProblemDetails localizzati; le eccezioni non applicative (bug veri) restano ad ASP.NET, che risponde con un 500 opaco. Inoltra anche la segnalazione a <see cref="IErrorReportingService"/> se configurato.</summary>
public class ApiExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails;
    private readonly IStringLocalizer<SharedResource> _localizer;
    private readonly ILogger<ApiExceptionHandler> _logger;
    private readonly IErrorReportingService _errorReporting;
    private readonly IBackgroundTaskQueue _backgroundQueue;

    /// <summary>Inietta i servizi Problem Details, localizzazione, logging, error reporting e coda background.</summary>
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

    /// <summary>Merita una segnalazione: un bug vero, o un'<see cref="ApiException"/> con status ≥500. Un 4xx applicativo è traffico normale (altrimenti ogni 404 di un bot manderebbe un alert).</summary>
    private static bool ShouldReport(Exception exception) =>
        exception is not ApiException apiEx || apiEx.StatusCode >= 500;

    /// <summary>True se l'eccezione è stata convertita in risposta HTTP; false se va lasciata ad altri handler (eccezioni non applicative).</summary>
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var _ = cancellationToken;

        // PRIMA del filtro "solo ApiException" sotto, perché deve vedere anche i bug veri. Lo
        // snapshot si costruisce QUI, sincrono: la HttpContext live non è sicura da leggere in background.
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

        if (exception is not ApiException apiEx)
            return false;

        httpContext.Response.StatusCode = apiEx.StatusCode;

        // La cultura richiesta è async-local (impostata da UseRequestLocalization), fuori scope qui
        // perché l'eccezione è risalita oltre quel middleware: la rileggiamo da IRequestCultureFeature.
        var requestCulture = httpContext.Features.Get<IRequestCultureFeature>()?.RequestCulture;
        if (requestCulture is not null)
            CultureInfo.CurrentUICulture = requestCulture.UICulture;

        // Chiave mancante nei .resx: LocalizedString.Value ritorna la chiave grezza, logghiamo per
        // renderlo visibile senza esporre dettagli al client.
        var detail = _localizer[apiEx.MessageKey, apiEx.MessageArgs];
        if (detail.ResourceNotFound)
            _logger.LogWarning("Chiave resx '{Key}' non trovata: il client ricevera' la chiave grezza nel campo detail.", apiEx.MessageKey);

        if (apiEx.RetryAfterSeconds.HasValue)
            httpContext.Response.Headers.RetryAfter = apiEx.RetryAfterSeconds.Value.ToString();

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
