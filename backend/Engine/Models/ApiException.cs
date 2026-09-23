namespace Backend.Models;

/// <summary>Eccezione base tradotta da <see cref="Backend.Security.ApiExceptionHandler"/> in un <c>ProblemDetails</c>.</summary>
public class ApiException : Exception
{
    /// <summary>Codice HTTP da restituire al client.</summary>
    public int StatusCode { get; }

    /// <summary>Chiave di risorsa del messaggio, risolta per lingua dall'handler (file .resx).</summary>
    public string MessageKey { get; }

    /// <summary>Argomenti che riempiono i segnaposto del messaggio localizzato (es. <c>{0}</c>).</summary>
    public object[] MessageArgs { get; }

    /// <summary>Secondi di attesa suggeriti; se valorizzato l'handler aggiunge l'header <c>Retry-After</c>.</summary>
    public int? RetryAfterSeconds { get; protected init; }

    /// <summary>Chiave del messaggio, status HTTP e argomenti per i segnaposto.</summary>
    public ApiException(string messageKey, int statusCode, params object[] args)
        : base(messageKey)
    {
        StatusCode = statusCode;
        MessageKey = messageKey;
        MessageArgs = args;
    }
}

// ── 400 Bad Request ──────────────────────────────────────────────────────────

/// <summary>Errore 400: body o file di dati non nel formato atteso (JSON malformato, encoding non supportato).</summary>
public class DecodingException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_decoding</c> e status 400.</summary>
    public DecodingException()
        : base("error_decoding", 400)
    {
    }
}

/// <summary>Errore 400: file riconosciuto come JPEG, PNG o WebP la cui struttura non si legge fino in fondo; rifiutato perché i metadati di posizione non sarebbero rimovibili con certezza.</summary>
public class InvalidImageException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_invalid_image</c> e status 400.</summary>
    public InvalidImageException()
        : base("error_invalid_image", 400)
    {
    }
}

/// <summary>Errore 400: parametro obbligatorio assente o che non rispetta le regole di validazione.</summary>
public class InvalidParametersException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_invalid_parameters</c> e status 400.</summary>
    public InvalidParametersException()
        : base("error_invalid_parameters", 400)
    {
    }
}

// ── 401 Unauthorized ─────────────────────────────────────────────────────────

/// <summary>Errore 401: non autenticato (vs <see cref="ForbiddenException"/> 403, autenticato ma senza permessi).</summary>
public class UnauthorizedException : ApiException
{
    /// <summary>Chiave generica di default (non rivela il campo errato); "error_invalid_credentials" solo dove accettabile (es. login).</summary>
    public UnauthorizedException(string messageKey = "error_unauthorized")
        : base(messageKey, 401)
    {
    }
}

// ── 403 Forbidden ────────────────────────────────────────────────────────────

/// <summary>Errore 403: utente autenticato ma senza i permessi per l'operazione richiesta.</summary>
public class ForbiddenException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_forbidden</c> e status 403.</summary>
    public ForbiddenException()
        : base("error_forbidden", 403)
    {
    }
}

// ── 404 Not Found ────────────────────────────────────────────────────────────

/// <summary>Errore 404: risorsa richiesta non trovata o non leggibile.</summary>
public class NotFoundException : ApiException
{
    /// <param name="dataName">Nome della risorsa non trovata; se omesso viene usato un messaggio generico.</param>
    public NotFoundException(string? dataName = null)
        : base(
            dataName is not null ? "error_not_found_named" : "error_not_found",
            404,
            dataName is not null ? new object[] { dataName } : Array.Empty<object>())
    {
    }
}

/// <summary>Errore 404: la risorsa esiste ma il contenuto è vuoto o non disponibile per la lingua richiesta (vs <see cref="NotFoundException"/>, risorsa assente).</summary>
public class DataNotFoundException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_data_not_found</c> e status 404.</summary>
    public DataNotFoundException()
        : base("error_data_not_found", 404)
    {
    }
}

// ── 409 Conflict ─────────────────────────────────────────────────────────────

/// <summary>Errore 409: risorsa già esistente o aggiornamento su una versione obsoleta (optimistic concurrency).</summary>
public class ConflictException : ApiException
{
    /// <param name="resourceName">Nome della risorsa in conflitto; se omesso viene usato un messaggio generico.</param>
    public ConflictException(string? resourceName = null)
        : base(
            resourceName is not null ? "error_conflict_named" : "error_conflict",
            409,
            resourceName is not null ? new object[] { resourceName } : Array.Empty<object>())
    {
    }
}

// ── 410 Gone ─────────────────────────────────────────────────────────────────

/// <summary>Errore 410: risorsa rimossa definitivamente — a differenza del 404 (ambiguo), comunica a client e crawler che non tornerà.</summary>
public class GoneException : ApiException
{
    /// <param name="resourceName">Nome della risorsa rimossa; se omesso viene usato un messaggio generico.</param>
    public GoneException(string? resourceName = null)
        : base(
            resourceName is not null ? "error_gone_named" : "error_gone",
            410,
            resourceName is not null ? new object[] { resourceName } : Array.Empty<object>())
    {
    }
}

// ── 422 Unprocessable Entity ─────────────────────────────────────────────────

/// <summary>Errore 422: JSON ben formato ma valori che violano una regola di business (complementa FluentValidation).</summary>
public class UnprocessableEntityException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_unprocessable_entity</c> e status 422.</summary>
    public UnprocessableEntityException()
        : base("error_unprocessable_entity", 422)
    {
    }
}

// ── 413 Payload Too Large ─────────────────────────────────────────────────────

/// <summary>
/// Rappresenta un errore 413 per un payload che supera un limite di dimensione applicativo
/// (es. upload blob oltre <c>FileBlobStore.MaxUploadSizeBytes</c>).
/// </summary>
public class PayloadTooLargeException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_payload_too_large</c> e status 413.</summary>
    public PayloadTooLargeException()
        : base("error_payload_too_large", 413)
    {
    }
}

// ── 429 Too Many Requests ────────────────────────────────────────────────────

/// <summary>Errore 429: limite di business applicativo superato (es. tentativi OTP, export/giorno) — distinto dal rate limiter infrastrutturale.</summary>
public class TooManyRequestsException : ApiException
{
    /// <param name="retryAfterSeconds">Secondi da attendere prima di riprovare (opzionale). Se fornito, viene incluso nel messaggio e nell'header <c>Retry-After</c>.</param>
    public TooManyRequestsException(int? retryAfterSeconds = null)
        : base(
            retryAfterSeconds.HasValue ? "error_too_many_requests_timed" : "error_too_many_requests",
            429,
            retryAfterSeconds.HasValue ? new object[] { retryAfterSeconds.Value } : Array.Empty<object>())
    {
        RetryAfterSeconds = retryAfterSeconds;
    }
}

// ── 501 Not Implemented ──────────────────────────────────────────────────────

/// <summary>Errore 501: endpoint pianificato ma non ancora disponibile. Nome distinto da <c>System.NotImplementedException</c> per evitare ambiguità con i metodi astratti C#.</summary>
public class NotImplementedEndpointException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_not_implemented</c> e status 501.</summary>
    public NotImplementedEndpointException()
        : base("error_not_implemented", 501)
    {
    }
}

// ── 502 Bad Gateway ──────────────────────────────────────────────────────────

/// <summary>Errore 502: risposta corrotta/malformata da un servizio upstream (vs 503 non raggiungibile, 504 raggiungibile ma lento).</summary>
public class BadGatewayException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_bad_gateway</c> e status 502.</summary>
    public BadGatewayException()
        : base("error_bad_gateway", 502)
    {
    }
}

// ── 503 Service Unavailable ──────────────────────────────────────────────────

/// <summary>Errore 503: servizio esterno (email, pagamenti, SMS...) temporaneamente non disponibile, senza esporre dettagli infrastrutturali al client.</summary>
public class ServiceUnavailableException : ApiException
{
    /// <param name="retryAfterSeconds">Secondi da attendere prima di riprovare (opzionale). Se fornito, viene incluso nel messaggio e nell'header <c>Retry-After</c>.</param>
    public ServiceUnavailableException(int? retryAfterSeconds = null)
        : base(
            retryAfterSeconds.HasValue ? "error_service_unavailable_timed" : "error_service_unavailable",
            503,
            retryAfterSeconds.HasValue ? new object[] { retryAfterSeconds.Value } : Array.Empty<object>())
    {
        RetryAfterSeconds = retryAfterSeconds;
    }
}

// ── 504 Gateway Timeout ──────────────────────────────────────────────────────

/// <summary>Errore 504: servizio upstream raggiungibile (a differenza del 503) ma troppo lento a rispondere.</summary>
public class GatewayTimeoutException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_gateway_timeout</c> e status 504.</summary>
    public GatewayTimeoutException()
        : base("error_gateway_timeout", 504)
    {
    }
}
