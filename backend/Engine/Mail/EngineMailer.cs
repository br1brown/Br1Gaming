using DnsClient;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Options;
using Backend.Models;
using Backend.Models.Configuration;

namespace Backend.Mail;

/// <summary>
/// Allegato di un'email: nome file, contenuto e (opzionale) content-type.
/// Se il content-type è omesso MailKit lo deduce dall'estensione del nome.
/// </summary>
/// <param name="FileName">Nome del file mostrato al destinatario (es. "fattura.pdf").</param>
/// <param name="Content">Byte del file.</param>
/// <param name="ContentType">MIME esplicito (es. "application/pdf"); <see langword="null"/> = dedotto.</param>
public sealed record MailAttachment(string FileName, byte[] Content, string? ContentType = null);

/// <summary>
/// Contratto del mailer del template: unico punto d'invio email dell'Engine, iniettato in DI
/// (singleton) e condiviso da ogni progetto. Superficie volutamente minima — <see cref="IsEnabled"/>,
/// <see cref="IsValidAddress"/> e gli overload di <c>SendAsync</c> — così un consumer inietta solo
/// questo e non tocca mai la meccanica SMTP.
/// </summary>
public interface IEngineMailer
{
    /// <summary>
    /// <see langword="true"/> se l'invio è configurato e utilizzabile. I chiamanti lo controllano
    /// per evitare di offrire la funzione quando il mailer è spento.
    /// </summary>
    bool IsEnabled { get; }

    /// <summary>
    /// <see langword="true"/> se l'indirizzo è parsabile e ha un dominio. Utile ai chiamanti per
    /// validare un destinatario letto da configurazione e fallire subito invece di scoprire
    /// l'errore nel worker, quando il messaggio verrebbe scartato senza rimedio.
    /// </summary>
    bool IsValidAddress(string? address);

    /// <summary>
    /// Invia un'email descritta come parametri espliciti. Comodo overload del primitivo;
    /// delega a <see cref="SendAsync(EmailMessage, CancellationToken)"/>.
    /// </summary>
    Task SendAsync(
        IReadOnlyCollection<string> to,
        string subject,
        string body,
        bool isHtml = false,
        string? from = null,
        IReadOnlyCollection<string>? cc = null,
        IReadOnlyCollection<string>? bcc = null,
        IReadOnlyCollection<MailAttachment>? attachments = null,
        string? replyTo = null,
        CancellationToken cancellationToken = default);

    /// <summary>Invia un <see cref="EmailMessage"/>. Metodo d'invio centrale del template.</summary>
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementazione di <see cref="IEngineMailer"/>. Tutta la meccanica SMTP (connessione, TLS,
/// autenticazione, costruzione MIME) è privata e basata su <b>MailKit</b>. Il trasporto e il
/// mittente di default vengono da <see cref="MailOptions"/> (sezione <c>Mail</c> di
/// global-settings.local.json), iniettata via <see cref="IOptions{TOptions}"/>.
/// </summary>
/// <remarks>
/// <para>
/// Hardening di sicurezza (verificato su best practice 2026):
/// <list type="bullet">
/// <item>TLS sempre obbligatorio: 465 → SslOnConnect, altrimenti StartTls. Mai la variante
/// opportunistica di MailKit, che potrebbe ricadere in chiaro (STARTTLS stripping).</item>
/// <item>Indirizzi parsati con <c>MailboxAddress.TryParse</c> e dominio obbligatorio: input
/// malformato o senza dominio → <see cref="MailInvalidAddressException"/> (400), non una
/// <c>ParseException</c> non gestita.</item>
/// <item>Subject sanitizzato dai CR/LF (difesa in profondità contro l'header injection).</item>
/// <item>Allegati limitati da <see cref="MailOptions.MaxAttachmentBytes"/> (413 se superati).</item>
/// </list>
/// Richiede <b>MailKit/MimeKit ≥ 4.17.0</b> (fix CVE-2026-30227 e CVE-2026-41319).
/// </para>
/// <para>
/// Si attiva da configurazione come il login: senza una sezione <c>Mail</c> valida
/// <see cref="IsEnabled"/> è <see langword="false"/> e <see cref="SendAsync(EmailMessage, CancellationToken)"/>
/// lancia <see cref="MailNotConfiguredException"/> (503). Per non bloccare la richiesta HTTP,
/// preferisci accodare via <see cref="IEmailQueue"/> (invio in background con retry).
/// </para>
/// </remarks>
internal sealed class EngineMailer : IEngineMailer
{
    private readonly MailOptions _options;
    private readonly ILookupClient _dns;
    private readonly ILogger<EngineMailer> _logger;

    /// <summary>Inietta le opzioni Mail (sezione <c>Mail</c>), il resolver DNS e il logger.</summary>
    public EngineMailer(IOptions<MailOptions> options, ILookupClient dns, ILogger<EngineMailer> logger)
    {
        _options = options.Value;
        _dns = dns;
        _logger = logger;
    }

    /// <inheritdoc />
    public bool IsEnabled => _options.IsConfigured;

    /// <inheritdoc />
    public bool IsValidAddress(string? address) => TryParseStrict(address, out _);

    /// <summary>
    /// Controllo <b>best-effort</b> di deliverabilità del DOMINIO via DNS (record MX, con fallback
    /// A/AAAA per l'MX implicito di RFC 5321). Attivato dal flag <see cref="MailOptions.VerifyRecipientDomain"/>:
    /// scarta i typo di dominio (<c>gmail.con</c>) e i domini inesistenti senza inviare nulla.
    /// NON verifica l'esistenza della casella (impossibile in modo affidabile): quella la sai solo
    /// col bounce o con un doppio opt-in.
    /// </summary>
    /// <returns>
    /// <see langword="false"/> solo se l'indirizzo non ha un dominio valido oppure il dominio non
    /// ha né MX né A/AAAA (typo / dominio inesistente). <see langword="true"/> se il dominio può
    /// ricevere posta <b>o</b> se il DNS è inconcludente (fail-open: non blocca un indirizzo
    /// legittimo per un disguido di rete; un errore reale emergerà come bounce dopo l'invio).
    /// </returns>
    private async Task<bool> IsDomainDeliverableAsync(string? address, CancellationToken cancellationToken)
    {
        // Senza un dominio valido non c'è niente da risolvere.
        if (!TryParseStrict(address, out var parsed))
            return false;

        var domain = parsed.Domain;
        try
        {
            // MX: il dominio dichiara dei server di posta? È il caso normale dei domini reali.
            var mx = await _dns.QueryAsync(domain, QueryType.MX, cancellationToken: cancellationToken);
            if (mx.Answers.MxRecords().Any())
                return true;

            // Nessun MX esplicito: RFC 5321 ammette l'MX implicito sull'A/AAAA del dominio.
            var a = await _dns.QueryAsync(domain, QueryType.A, cancellationToken: cancellationToken);
            if (a.Answers.ARecords().Any())
                return true;

            var aaaa = await _dns.QueryAsync(domain, QueryType.AAAA, cancellationToken: cancellationToken);
            if (aaaa.Answers.AaaaRecords().Any())
                return true;

            // Né MX né A/AAAA trovati. Distinguo "definitivamente non spedibile" da "inconcludente":
            //  - NXDOMAIN o risposta valida senza record → il dominio non riceve posta → false.
            //  - errore di server reale (SERVFAIL, timeout…) → DNS inconcludente → fail-open (true).
            // NXDOMAIN setta HasError ma è una risposta DEFINITIVA, non un disservizio: va esclusa.
            static bool Inconclusive(IDnsQueryResponse r)
                => r.HasError && r.Header.ResponseCode != DnsHeaderResponseCode.NotExistentDomain;

            return Inconclusive(mx) || Inconclusive(a) || Inconclusive(aaaa);
        }
        catch (Exception ex)
        {
            // DNS irraggiungibile/timeout: non blocchiamo un indirizzo potenzialmente valido.
            _logger.LogWarning(ex, "Check MX non riuscito per il dominio '{Domain}': lo tratto come spedibile (fail-open).", domain);
            return true;
        }
    }

    /// <inheritdoc />
    /// <param name="to">Destinatari (almeno uno).</param>
    /// <param name="subject">Oggetto.</param>
    /// <param name="body">Corpo (testo o HTML secondo <paramref name="isHtml"/>).</param>
    /// <param name="isHtml"><see langword="true"/> per corpo HTML, <see langword="false"/> per testo.</param>
    /// <param name="from">Mittente; <see langword="null"/> ⇒ default da config (tienilo sul tuo dominio).</param>
    /// <param name="cc">Copia conoscenza (nullable).</param>
    /// <param name="bcc">Copia conoscenza nascosta (nullable).</param>
    /// <param name="attachments">Allegati (nullable).</param>
    /// <param name="replyTo">Indirizzo per le risposte (nullable).</param>
    /// <param name="cancellationToken">Token di annullamento.</param>
    public Task SendAsync(
        IReadOnlyCollection<string> to,
        string subject,
        string body,
        bool isHtml = false,
        string? from = null,
        IReadOnlyCollection<string>? cc = null,
        IReadOnlyCollection<string>? bcc = null,
        IReadOnlyCollection<MailAttachment>? attachments = null,
        string? replyTo = null,
        CancellationToken cancellationToken = default)
        => SendAsync(new EmailMessage
        {
            To = to,
            Subject = subject,
            Body = body,
            IsHtml = isHtml,
            From = from,
            Cc = cc,
            Bcc = bcc,
            Attachments = attachments,
            ReplyTo = replyTo
        }, cancellationToken);

    /// <inheritdoc />
    /// <exception cref="MailNotConfiguredException">Mailer non configurato (503).</exception>
    /// <exception cref="MailInvalidAddressException">Un indirizzo non è valido (400).</exception>
    /// <exception cref="MailAttachmentTooLargeException">Allegati oltre il limite (413).</exception>
    /// <exception cref="MailSendException">Il server SMTP ha rifiutato o non ha consegnato (502).</exception>
    /// <exception cref="ArgumentException">Nessun destinatario indicato.</exception>
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var options = _options;
        if (!options.IsConfigured)
            throw new MailNotConfiguredException();

        if (message.To is null || message.To.Count == 0)
            throw new ArgumentException("Almeno un destinatario è obbligatorio.", nameof(message));

        // Check MX opzionale (Mail.VerifyRecipientDomain): scarta i destinatari con dominio non
        // spedibile PRIMA di aprire la connessione SMTP. Dominio inesistente/typo → MailInvalidAddressException.
        if (options.VerifyRecipientDomain)
            foreach (var recipient in message.To)
                if (!await IsDomainDeliverableAsync(recipient, cancellationToken))
                    throw new MailInvalidAddressException();

        var mime = new MimeMessage();

        // Mittente: from esplicito oppure il default di config (con eventuale display name).
        if (string.IsNullOrWhiteSpace(message.From))
        {
            var defaultFrom = ParseAddress(options.FromAddress);
            mime.From.Add(string.IsNullOrWhiteSpace(options.FromName)
                ? defaultFrom
                : new MailboxAddress(options.FromName, defaultFrom.Address));
        }
        else
        {
            mime.From.Add(ParseAddress(message.From));
        }

        AddAll(mime.To, message.To);
        AddAll(mime.Cc, message.Cc);
        AddAll(mime.Bcc, message.Bcc);

        if (!string.IsNullOrWhiteSpace(message.ReplyTo))
            mime.ReplyTo.Add(ParseAddress(message.ReplyTo));

        // Subject è un header a riga singola: i CR/LF vanno neutralizzati (difesa in profondità).
        mime.Subject = SanitizeSingleLine(message.Subject);

        var bodyBuilder = new BodyBuilder();
        if (message.IsHtml) bodyBuilder.HtmlBody = message.Body;
        else bodyBuilder.TextBody = message.Body;

        AddAttachments(bodyBuilder, message.Attachments, options);

        mime.Body = bodyBuilder.ToMessageBody();

        await SendCoreAsync(mime, options, cancellationToken);
    }

    /// <summary>
    /// Parsa un indirizzo richiedendo un dominio: input non valido o senza dominio →
    /// <see cref="MailInvalidAddressException"/> (400) invece di una <c>ParseException</c> non
    /// gestita. Rifiuta anche i CR/LF degli indirizzi malformati (MimeKit ≥ 4.15.1, fix CVE-2026-30227).
    /// </summary>
    private static MailboxAddress ParseAddress(string address)
    {
        if (!TryParseStrict(address, out var parsed))
            throw new MailInvalidAddressException();
        return parsed;
    }

    /// <summary>
    /// <see langword="true"/> se l'indirizzo è parsabile <b>e</b> ha un dominio. MimeKit di default
    /// (<c>AllowAddressesWithoutDomain</c>) accetterebbe un local-part nudo come "nope" o
    /// "not-an-email": imponendo il dominio rifiutiamo a monte gli indirizzi non spedibili,
    /// invece di scoprirli come errore SMTP nel worker.
    /// </summary>
    private static bool TryParseStrict(string? address, out MailboxAddress parsed)
    {
        if (!string.IsNullOrWhiteSpace(address)
            && MailboxAddress.TryParse(address, out var p)
            && p is not null
            && !string.IsNullOrEmpty(p.Domain))
        {
            parsed = p;
            return true;
        }

        parsed = null!;
        return false;
    }

    /// <summary>Aggiunge gli indirizzi (se presenti) a una lista del messaggio, validandoli.</summary>
    private static void AddAll(InternetAddressList list, IEnumerable<string>? addresses)
    {
        if (addresses is null) return;
        foreach (var address in addresses)
            if (!string.IsNullOrWhiteSpace(address))
                list.Add(ParseAddress(address));
    }

    /// <summary>Aggiunge gli allegati controllando il limite di dimensione totale.</summary>
    private static void AddAttachments(BodyBuilder bodyBuilder, IReadOnlyCollection<MailAttachment>? attachments, MailOptions options)
    {
        if (attachments is null || attachments.Count == 0) return;

        if (options.MaxAttachmentBytes > 0)
        {
            long total = 0;
            foreach (var attachment in attachments)
                total += attachment.Content?.LongLength ?? 0;
            if (total > options.MaxAttachmentBytes)
                throw new MailAttachmentTooLargeException();
        }

        foreach (var attachment in attachments)
        {
            if (!string.IsNullOrWhiteSpace(attachment.ContentType)
                && ContentType.TryParse(attachment.ContentType, out var parsed))
                bodyBuilder.Attachments.Add(attachment.FileName, attachment.Content, parsed);
            else
                bodyBuilder.Attachments.Add(attachment.FileName, attachment.Content);
        }
    }

    /// <summary>Rimuove CR/LF da un valore destinato a un header a riga singola.</summary>
    private static string SanitizeSingleLine(string value)
        => (value ?? string.Empty).Replace('\r', ' ').Replace('\n', ' ').Trim();

    /// <summary>
    /// Apre una connessione SMTP nuova, autentica se servono credenziali, invia e chiude.
    /// Lo <c>SmtpClient</c> di MailKit non è riusabile tra thread: una connessione per invio
    /// (overhead trascurabile per posta transazionale). La validazione del certificato resta
    /// quella di default: non va mai disabilitata.
    /// </summary>
    private async Task SendCoreAsync(MimeMessage message, MailOptions options, CancellationToken cancellationToken)
    {
        var socketOptions = ResolveSocketOptions(options);

        // Clamp difensivo: lo schema impone minimo 1, ma il binding IOptions non lo valida.
        // Un valore 0/negativo finirebbe nel setter di Timeout (ms) con effetti indesiderati.
        using var client = new SmtpClient { Timeout = Math.Max(1, options.TimeoutSeconds) * 1000 };
        try
        {
            await client.ConnectAsync(options.Host, options.Port, socketOptions, cancellationToken);

            if (!string.IsNullOrWhiteSpace(options.Username))
                await client.AuthenticateAsync(options.Username, options.Password, cancellationToken);

            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(quit: true, cancellationToken);
        }
        catch (Exception ex) when (ex is not ApiException and not OperationCanceledException)
        {
            // Dettaglio tecnico nei log del server; al client solo un 502 generico.
            // OperationCanceledException (shutdown/timeout) propaga: non è un errore SMTP.
            _logger.LogError(ex, "Invio email fallito tramite SMTP {Host}:{Port}.", options.Host, options.Port);
            throw new MailSendException();
        }
    }

    /// <summary>
    /// Mappa la modalità di config su MailKit imponendo SEMPRE TLS: 465 → TLS implicito,
    /// ogni altra porta → STARTTLS obbligatorio. Non usa mai <c>StartTlsWhenAvailable</c>/
    /// <c>Auto</c> di MailKit (potrebbero ricadere in chiaro). <c>None</c> solo per relay fidati.
    /// </summary>
    private static SecureSocketOptions ResolveSocketOptions(MailOptions options) => options.Security switch
    {
        MailSecurity.None => SecureSocketOptions.None,
        MailSecurity.StartTls => SecureSocketOptions.StartTls,
        MailSecurity.SslOnConnect => SecureSocketOptions.SslOnConnect,
        _ => options.Port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls
    };
}
