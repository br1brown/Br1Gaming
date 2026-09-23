namespace Backend.Models;

/// <summary>503: invio richiesto ma il mailer è spento (flag <c>Features.Mail</c> spento, o sezione Mail assente/incompleta).</summary>
public sealed class MailNotConfiguredException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_mail_disabled</c> e status 503.</summary>
    public MailNotConfiguredException()
        : base("error_mail_disabled", 503)
    {
    }
}

/// <summary>502: il server SMTP a monte ha rifiutato o non ha potuto consegnare il messaggio (dettaglio tecnico solo nei log).</summary>
public sealed class MailSendException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_mail_send_failed</c> e status 502.</summary>
    public MailSendException()
        : base("error_mail_send_failed", 502)
    {
    }
}

/// <summary>400: un indirizzo (from/to/cc/bcc/reply-to) non è parsabile; sostituisce la ParseException grezza di MailKit (sarebbe un 500).</summary>
public sealed class MailInvalidAddressException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_mail_invalid_address</c> e status 400.</summary>
    public MailInvalidAddressException()
        : base("error_mail_invalid_address", 400)
    {
    }
}

/// <summary>413: allegati oltre <see cref="Backend.Models.Configuration.MailOptions.MaxAttachmentBytes"/>.</summary>
public sealed class MailAttachmentTooLargeException : ApiException
{
    /// <summary>Crea l'eccezione con chiave <c>error_mail_attachment_too_large</c> e status 413.</summary>
    public MailAttachmentTooLargeException()
        : base("error_mail_attachment_too_large", 413)
    {
    }
}
