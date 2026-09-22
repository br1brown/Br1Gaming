using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Backend.Diagnostics;

namespace Backend.Controllers;

/// <summary>Riceve le eccezioni JS non gestite dal browser e le inoltra allo stesso <see cref="IErrorReportingService"/> degli errori server (<see cref="ErrorReport.Source"/> distingue le due fonti). Solo API key, non login: un errore JS può capitare a un visitatore anonimo.</summary>
[Route("diagnostics/ui-fault")]
public sealed class EngineClientErrorController : EngineApiController
{
    private readonly IErrorReportingService _errorReporting;

    /// <inheritdoc cref="EngineClientErrorController"/>
    public EngineClientErrorController(IErrorReportingService errorReporting, ILogger<EngineClientErrorController> logger)
        : base(logger)
    {
        _errorReporting = errorReporting;
    }

    /// <summary>Accoda la segnalazione. Risponde sempre 202 (anche a payload incompleto o webhook spento): chi chiama ha già avuto un errore, non deve vederne un secondo per averlo segnalato.</summary>
    [HttpPost]
    public IActionResult Report([FromBody] ClientErrorReport report)
    {
        if (_errorReporting.IsEnabled)
        {
            var stackTrace = report.StackTrace;
            if (stackTrace is { Length: > 4000 })
                stackTrace = stackTrace[..4000] + "\n… (troncato)";

            var errorReport = new ErrorReport
            {
                Message = string.IsNullOrWhiteSpace(report.Message) ? "(nessun messaggio)" : report.Message,
                ExceptionType = string.IsNullOrWhiteSpace(report.ExceptionType) ? "ClientError" : report.ExceptionType,
                Path = report.Path,
                StackTrace = stackTrace,
                Source = "client",
            };
            BackgroundQueue.TryEnqueue((services, ct) =>
                services.GetRequiredService<IErrorReportingService>().ReportAsync(errorReport, ct));
        }

        return Accepted();
    }
}
