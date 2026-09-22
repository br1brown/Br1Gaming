namespace Backend.Models.Configuration;

/// <summary>Modalità di cifratura del canale SMTP: astrae <c>SecureSocketOptions</c> di MailKit così che provider/porta vivano nel JSON, non nel codice.</summary>
public enum MailSecurity
{
    /// <summary>Sceglie la modalità SICURA in base alla porta (465 → <see cref="SslOnConnect"/>, altrimenti <see cref="StartTls"/>); mai la variante opportunistica di MailKit che potrebbe ricadere in chiaro.</summary>
    Auto,

    /// <summary>Nessuna cifratura (solo per relay locali fidati / sviluppo).</summary>
    None,

    /// <summary>STARTTLS: connessione in chiaro poi upgrade a TLS. Tipico su porta 587.</summary>
    StartTls,

    /// <summary>TLS implicito dalla connessione (SMTPS). Tipico su porta 465.</summary>
    SslOnConnect
}

/// <summary>Configurazione SMTP letta da <c>global-settings.local.json</c> § <c>Mail</c> (gitignored, contiene segreti). Provider-neutra: parametri SMTP standard, stesso mailer per OVH/Brevo/Mailgun/SES/Gmail cambiando solo questi valori.</summary>
public class MailOptions
{
    /// <summary>Host del server SMTP (es. <c>ssl0.ovh.net</c>, <c>smtp-relay.brevo.com</c>).</summary>
    public string Host { get; set; } = "";

    /// <summary>Porta SMTP. 587 (STARTTLS) o 465 (SSL/TLS) nella stragrande maggioranza dei casi.</summary>
    public int Port { get; set; } = 587;

    /// <summary>Modalità di cifratura del canale. Default <see cref="MailSecurity.Auto"/>.</summary>
    public MailSecurity Security { get; set; } = MailSecurity.Auto;

    /// <summary>Utente SMTP (di solito l'indirizzo completo della casella). Vuoto = invio senza autenticazione.</summary>
    public string Username { get; set; } = "";

    /// <summary>Password SMTP della casella. SEGRETO: vive solo in global-settings.local.json.</summary>
    public string Password { get; set; } = "";

    /// <summary>Mittente di default; DEVE essere sul tuo dominio (SPF/DKIM), mai l'indirizzo di un visitatore.</summary>
    public string FromAddress { get; set; } = "";

    /// <summary>Nome visualizzato di default del mittente (opzionale, es. "Sito MioDominio").</summary>
    public string FromName { get; set; } = "";

    /// <summary>Timeout di connessione/invio in secondi. Default 30.</summary>
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>Se true, verifica via DNS (MX/A/AAAA) che il dominio dei destinatari possa ricevere posta prima di aprire l'SMTP; non verifica la casella. Default false.</summary>
    public bool VerifyRecipientDomain { get; set; } = false;

    /// <summary>Dimensione massima totale allegati per messaggio, in byte (413 se superata). Default 10 MB, 0 = nessun limite.</summary>
    public long MaxAttachmentBytes { get; set; } = 10 * 1024 * 1024;

    /// <summary>True solo se host e mittente di default sono valorizzati (le credenziali sono opzionali, relay aperti/locali).</summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host)
        && !string.IsNullOrWhiteSpace(FromAddress);
}
