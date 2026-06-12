namespace Backend.Models.Configuration;

/// <summary>
/// Modalità di cifratura del canale SMTP. Astrae i valori di MailKit
/// (<c>SecureSocketOptions</c>) così che la scelta provider/porta viva nel JSON,
/// non nel codice: cambiando infrastruttura non si tocca nulla qui.
/// </summary>
public enum MailSecurity
{
    /// <summary>
    /// Sceglie la modalità SICURA in base alla porta: 465 → <see cref="SslOnConnect"/>,
    /// ogni altra porta → <see cref="StartTls"/> (TLS obbligatorio). A differenza del
    /// <c>SecureSocketOptions.Auto</c> di MailKit, NON usa mai la variante opportunistica
    /// "StartTlsWhenAvailable", quindi non ricade mai su connessione in chiaro / downgrade.
    /// </summary>
    Auto,

    /// <summary>Nessuna cifratura (solo per relay locali fidati / sviluppo).</summary>
    None,

    /// <summary>STARTTLS: connessione in chiaro poi upgrade a TLS. Tipico su porta 587.</summary>
    StartTls,

    /// <summary>TLS implicito dalla connessione (SMTPS). Tipico su porta 465.</summary>
    SslOnConnect
}

/// <summary>
/// Configurazione SMTP del template, letta da <c>global-settings.local.json</c> sezione
/// <c>Mail</c> (contiene segreti → file gitignored). Registrata come <c>IOptions&lt;MailOptions&gt;</c>
/// accanto a <see cref="SecurityOptions"/> e <see cref="LocalizationOptions"/>.
/// </summary>
/// <remarks>
/// Volutamente neutra rispetto al provider: sono i parametri SMTP standard, quindi lo stesso
/// mailer (<see cref="Backend.Mail.IEngineMailer"/>) spedisce via OVH, Brevo, Mailgun, Amazon SES,
/// Gmail o un relay locale cambiando solo questi valori — nessuna modifica al codice.
///
/// Il mailer si attiva da configurazione, come il login: se <see cref="IsConfigured"/> è
/// <see langword="false"/> (sezione assente o incompleta) l'invio è spento e ogni tentativo
/// risponde 503 in modo pulito.
/// </remarks>
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

    /// <summary>
    /// Mittente di default, usato quando il chiamante non passa un <c>from</c> esplicito.
    /// DEVE essere sul TUO dominio (es. <c>noreply@miodominio.it</c>): è ciò che fa quadrare
    /// SPF/DKIM. Mai l'indirizzo di un visitatore (finirebbe in spam).
    /// </summary>
    public string FromAddress { get; set; } = "";

    /// <summary>Nome visualizzato di default del mittente (opzionale, es. "Sito MioDominio").</summary>
    public string FromName { get; set; } = "";

    /// <summary>Timeout di connessione/invio in secondi. Default 30.</summary>
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Se <see langword="true"/>, prima di inviare il mailer verifica via DNS che il DOMINIO dei
    /// destinatari possa ricevere posta (record MX, fallback A/AAAA): i typo di dominio
    /// (<c>gmail.con</c>) e i domini inesistenti vengono scartati con 400 senza aprire l'SMTP.
    /// NON verifica l'esistenza della casella (impossibile in modo affidabile). Default
    /// <see langword="false"/>: nessuna query DNS se non lo accendi.
    /// </summary>
    public bool VerifyRecipientDomain { get; set; } = false;

    /// <summary>
    /// Dimensione massima totale degli allegati per messaggio, in byte. Default 10 MB.
    /// Superata, l'invio viene rifiutato (413) invece di tentare un messaggio che il relay
    /// scarterebbe. 0 = nessun limite (sconsigliato su endpoint pubblici).
    /// </summary>
    public long MaxAttachmentBytes { get; set; } = 10 * 1024 * 1024;

    /// <summary>
    /// <see langword="true"/> solo se l'invio è realmente utilizzabile: host e mittente di
    /// default valorizzati. Le credenziali sono opzionali (relay aperti/locali). Stessa logica
    /// "attivo se configurato" del login (che si accende quando <c>Token.SecretKey</c> è presente).
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host)
        && !string.IsNullOrWhiteSpace(FromAddress);
}
