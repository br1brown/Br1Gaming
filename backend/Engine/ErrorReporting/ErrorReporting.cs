namespace Backend.Diagnostics;

// Periferia del sottosistema ErrorReporting in un solo file: lo snapshot immutabile e il
// contratto del servizio. La chiamata HTTP verso il webhook resta in EngineErrorReporting.cs.
// Stesso schema di Mail/Notifications/Delivery/Tasks.

/// <summary>Istantanea immutabile di un errore, costruita SINCRONAMENTE prima di accodare la segnalazione: mai la <c>HttpContext</c> live, che Kestrel ricicla e non è sicura da leggere in background.</summary>
public sealed record ErrorReport
{
    /// <summary><c>Exception.Message</c> dell'errore originale.</summary>
    public required string Message { get; init; }

    /// <summary>Nome completo del tipo dell'eccezione (es. <c>System.NullReferenceException</c>).</summary>
    public required string ExceptionType { get; init; }

    /// <summary>Status HTTP associato (500 per un'eccezione non applicativa, altrimenti quello dell'<c>ApiException</c>).</summary>
    public int StatusCode { get; init; }

    /// <summary>Path della richiesta che ha generato l'errore (es. <c>/api/v1/orders</c>).</summary>
    public string? Path { get; init; }

    /// <summary>Metodo HTTP della richiesta (es. <c>POST</c>).</summary>
    public string? Method { get; init; }

    /// <summary>Stack trace, se disponibile. Nessun troncamento qui: lo decide l'implementazione in base al trasporto.</summary>
    public string? StackTrace { get; init; }

    /// <summary><c>"server"</c> (default, bug lato API) o <c>"client"</c> (eccezione JS non gestita
    /// nel browser di un visitatore, vedi <see cref="Backend.Controllers.EngineClientErrorController"/>)
    /// — distingue le due fonti nello stesso canale di allerta, senza due sistemi separati.</summary>
    public string Source { get; init; } = "server";
}

/// <summary>Payload inviato dal browser per un'eccezione JS non gestita. Tutti i campi opzionali: un <c>Error</c> del browser non garantisce sempre stack o nome tipizzato.</summary>
public sealed record ClientErrorReport
{
    /// <summary><c>Error.message</c> dell'eccezione originale.</summary>
    public string? Message { get; init; }

    /// <summary><c>Error.name</c> (es. <c>TypeError</c>).</summary>
    public string? ExceptionType { get; init; }

    /// <summary>Percorso della pagina (<c>location.pathname</c>) in cui l'errore si è verificato.</summary>
    public string? Path { get; init; }

    /// <summary><c>Error.stack</c>, se disponibile.</summary>
    public string? StackTrace { get; init; }
}

/// <summary>Segnalazione errori dell'Engine (singleton): webhook HTTP generico, non un sostituto di un vero APM. Chiamato solo per bug veri o status ≥500, mai per un 4xx applicativo; accodato su <c>IBackgroundTaskQueue</c>, mai atteso nella risposta HTTP.</summary>
public interface IErrorReportingService
{
    /// <summary>Se un webhook è configurato.</summary>
    bool IsEnabled { get; }

    /// <summary>Invia la segnalazione al webhook; non lancia mai (un fallimento viene solo loggato).</summary>
    Task ReportAsync(ErrorReport report, CancellationToken cancellationToken = default);
}
