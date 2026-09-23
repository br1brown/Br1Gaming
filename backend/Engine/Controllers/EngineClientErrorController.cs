using Microsoft.AspNetCore.Mvc;
using Backend.Diagnostics;

namespace Backend.Controllers;

/// <summary>Riceve le eccezioni JS non gestite dal browser e le inoltra allo stesso <see cref="IErrorReportingService"/> degli errori server (<see cref="ErrorReport.Source"/> distingue le due fonti). Solo API key, non login: un errore JS può capitare a un visitatore anonimo.</summary>
[Route("diagnostics/ui-fault")]
public sealed class EngineClientErrorController : EngineApiController
{
    private readonly IErrorReportingService _errorReporting;
    private readonly ErrorReportQueue _reports;

    /// <inheritdoc cref="EngineClientErrorController"/>
    public EngineClientErrorController(IErrorReportingService errorReporting, ErrorReportQueue reports, ILogger<EngineClientErrorController> logger)
        : base(logger)
    {
        _errorReporting = errorReporting;
        _reports = reports;
    }

    /// <summary>Tronca un campo del browser: il payload è di chiunque abbia la API key, e il webhook lo rende nel canale degli alert.</summary>
    private static string? Clip(string? value, int max) =>
        value is { Length: > 0 } && value.Length > max ? value[..max] + "… (troncato)" : value;

    /// <summary>Solo un pathname relativo (<c>/pagina</c>): un URL assoluto o con schema diventerebbe un link cliccabile nel canale degli alert.</summary>
    private static string? SafePath(string? path) =>
        path is not null && path.StartsWith('/') && !path.StartsWith("//", StringComparison.Ordinal) && !path.Contains("://", StringComparison.Ordinal)
            ? Clip(path, 500) : null;

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
                Message = string.IsNullOrWhiteSpace(report.Message) ? "(nessun messaggio)" : Clip(report.Message, 1000)!,
                ExceptionType = string.IsNullOrWhiteSpace(report.ExceptionType) ? "ClientError" : Clip(report.ExceptionType, 200)!,
                Path = SafePath(report.Path),
                StackTrace = stackTrace,
                Source = "client",
            };
            _reports.Enqueue(errorReport);
        }

        return Accepted();
    }
}
