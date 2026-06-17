namespace Backend.Models;

/// <summary>
/// 503 — invio email richiesto ma il mailer non è configurato (sezione <c>Mail</c> assente
/// o incompleta). Vedi <see cref="Backend.Models.Configuration.MailOptions.IsConfigured"/>.
/// </summary>
/// <remarks>
/// Sottoclasse di <see cref="ApiException"/>: l'<see cref="Backend.Security.ApiExceptionHandler"/>
/// la traduce in ProblemDetails localizzato. Chiave <c>error_mail_disabled</c> nei file SharedResource*.resx.
/// </remarks>
public sealed class MailNotConfiguredException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_mail_disabled</c> e status 503.</summary>
    public MailNotConfiguredException()
        : base("error_mail_disabled", 503)
    {
    }
}

/// <summary>
/// 502 — il server SMTP a monte ha rifiutato o non ha potuto consegnare il messaggio.
/// </summary>
/// <remarks>
/// L'errore tecnico viene loggato lato server; al client si restituisce un messaggio generico
/// (chiave <c>error_mail_send_failed</c>) per non esporre dettagli dell'infrastruttura.
/// </remarks>
public sealed class MailSendException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_mail_send_failed</c> e status 502.</summary>
    public MailSendException()
        : base("error_mail_send_failed", 502)
    {
    }
}

/// <summary>
/// 400 — uno o più indirizzi (from/to/cc/bcc/reply-to) non sono parsabili. Difesa contro
/// input malformato/header injection: gli indirizzi passano per <c>MailboxAddress.TryParse</c>
/// e questa eccezione sostituisce la <c>ParseException</c> grezza (che sarebbe un 500).
/// </summary>
public sealed class MailInvalidAddressException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_mail_invalid_address</c> e status 400.</summary>
    public MailInvalidAddressException()
        : base("error_mail_invalid_address", 400)
    {
    }
}

/// <summary>
/// 413 — la dimensione totale degli allegati supera
/// <see cref="Backend.Models.Configuration.MailOptions.MaxAttachmentBytes"/>.
/// </summary>
public sealed class MailAttachmentTooLargeException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_mail_attachment_too_large</c> e status 413.</summary>
    public MailAttachmentTooLargeException()
        : base("error_mail_attachment_too_large", 413)
    {
    }
}
