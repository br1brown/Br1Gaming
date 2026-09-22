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

/// <summary>Unico punto d'invio email dell'Engine, iniettato in DI come singleton.</summary>
public interface IEngineMailer
{
    /// <summary>Se l'invio è configurato e utilizzabile.</summary>
    bool IsEnabled { get; }

    /// <summary>Se l'indirizzo è parsabile e ha un dominio.</summary>
    bool IsValidAddress(string? address);

    /// <summary>Overload comodo che delega a <see cref="SendAsync(EmailMessage, CancellationToken)"/>.</summary>
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

/// <summary>Meccanica SMTP di <see cref="IEngineMailer"/> via MailKit. Hardening e opzioni <c>Mail.*</c>.</summary>
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

    /// <summary>Check MX/A/AAAA best-effort per <see cref="MailOptions.VerifyRecipientDomain"/>; non verifica la casella.</summary>
    /// <returns>Fail-open: <see langword="false"/> solo se il DNS esclude esplicitamente il dominio, <see langword="true"/> anche se inconcludente.</returns>
    private async Task<bool> IsDomainDeliverableAsync(string? address, CancellationToken cancellationToken)
    {
        if (!TryParseStrict(address, out var parsed))
            return false;

        var domain = parsed.Domain;
        try
        {
            var mx = await _dns.QueryAsync(domain, QueryType.MX, cancellationToken: cancellationToken);
            if (mx.Answers.MxRecords().Any())
                return true;

            // RFC 5321 ammette l'MX implicito sull'A/AAAA del dominio quando manca un MX esplicito.
            var a = await _dns.QueryAsync(domain, QueryType.A, cancellationToken: cancellationToken);
            if (a.Answers.ARecords().Any())
                return true;

            var aaaa = await _dns.QueryAsync(domain, QueryType.AAAA, cancellationToken: cancellationToken);
            if (aaaa.Answers.AaaaRecords().Any())
                return true;

            // NXDOMAIN è una risposta DEFINITIVA (non spedibile); un errore server reale è solo inconcludente (fail-open).
            static bool Inconclusive(IDnsQueryResponse r)
                => r.HasError && r.Header.ResponseCode != DnsHeaderResponseCode.NotExistentDomain;

            return Inconclusive(mx) || Inconclusive(a) || Inconclusive(aaaa);
        }
        catch (Exception ex)
        {
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

    /// <summary>Parsa un indirizzo; input non valido o senza dominio → <see cref="MailInvalidAddressException"/> (400) invece di <c>ParseException</c>.</summary>
    private static MailboxAddress ParseAddress(string address)
    {
        if (!TryParseStrict(address, out var parsed))
            throw new MailInvalidAddressException();
        return parsed;
    }

    /// <summary>Vero se parsabile e con dominio: MimeKit di default accetterebbe anche un local-part nudo come "nope".</summary>
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

    /// <summary>Apre una connessione SMTP, autentica se servono credenziali, invia e chiude: <c>SmtpClient</c> di MailKit non è riusabile tra thread.</summary>
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

    /// <summary>Impone SEMPRE TLS (465 → implicito, altrimenti STARTTLS): mai le varianti opportunistiche di MailKit.</summary>
    private static SecureSocketOptions ResolveSocketOptions(MailOptions options) => options.Security switch
    {
        MailSecurity.None => SecureSocketOptions.None,
        MailSecurity.StartTls => SecureSocketOptions.StartTls,
        MailSecurity.SslOnConnect => SecureSocketOptions.SslOnConnect,
        _ => options.Port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls
    };
}
