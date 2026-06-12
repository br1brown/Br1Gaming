namespace Backend.Mail;

/// <summary>
/// Messaggio email completo, neutro rispetto al dominio. È sia l'unità che
/// <see cref="IEngineMailer.SendAsync(EmailMessage, System.Threading.CancellationToken)"/>
/// spedisce, sia l'elemento accodato da <see cref="IEmailQueue"/> per l'invio in background.
/// </summary>
/// <remarks>
/// Quando inoltri un messaggio scritto da un utente: <see cref="From"/> sul proprio dominio
/// (default da config) e l'indirizzo dell'utente in <see cref="ReplyTo"/> — mai come From
/// (anti-spam/anti-spoofing). Se <see cref="IsHtml"/> è true, il chiamante è responsabile
/// dell'encoding dell'input non fidato nel corpo (XSS lato client di posta); con input non
/// fidato si preferisce testo semplice.
/// </remarks>
public sealed record EmailMessage
{
    /// <summary>Destinatari (almeno uno).</summary>
    public required IReadOnlyCollection<string> To { get; init; }

    /// <summary>Oggetto. Eventuali CR/LF vengono neutralizzati in fase di invio (anti header injection).</summary>
    public required string Subject { get; init; }

    /// <summary>Corpo del messaggio (testo o HTML secondo <see cref="IsHtml"/>).</summary>
    public required string Body { get; init; }

    /// <summary><see langword="true"/> per corpo HTML, <see langword="false"/> per testo semplice.</summary>
    public bool IsHtml { get; init; }

    /// <summary>Mittente. <see langword="null"/>/vuoto ⇒ <c>Mail.FromAddress</c> dal JSON.</summary>
    public string? From { get; init; }

    /// <summary>Copia conoscenza (nullable).</summary>
    public IReadOnlyCollection<string>? Cc { get; init; }

    /// <summary>Copia conoscenza nascosta (nullable).</summary>
    public IReadOnlyCollection<string>? Bcc { get; init; }

    /// <summary>Allegati (nullable). La dimensione totale è limitata da <c>Mail.MaxAttachmentBytes</c>.</summary>
    public IReadOnlyCollection<MailAttachment>? Attachments { get; init; }

    /// <summary>Indirizzo per le risposte (nullable). Utile nei form: ci metti chi scrive.</summary>
    public string? ReplyTo { get; init; }
}
