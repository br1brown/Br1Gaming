using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Backend.Models;

namespace Backend.Mail;

// Periferia del sottosistema Mail in un solo file: il messaggio, la coda di invio in background e
// l'hosted service che la consuma. La meccanica SMTP (corposa) resta in EngineMailer.cs; le
// eccezioni vivono con le altre ApiException in Backend.Models (MailExceptions.cs).

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

/// <summary>
/// Coda di invio email in background. Accodare e tornare subito evita di bloccare la richiesta
/// HTTP sull'I/O SMTP: l'invio effettivo (con retry) avviene in <see cref="EmailSenderHostedService"/>.
/// </summary>
public interface IEmailQueue
{
    /// <summary>
    /// Accoda un messaggio per l'invio asincrono. Ritorna <see langword="false"/> se la coda è
    /// piena (backpressure): il chiamante può tradurlo in 503. Non blocca.
    /// </summary>
    bool TryEnqueue(EmailMessage message);
}

/// <summary>
/// Implementazione di <see cref="IEmailQueue"/> su <see cref="Channel{T}"/> limitato.
/// Registrata come singleton; l'hosted service ne legge lo stream.
/// </summary>
internal sealed class ChannelEmailQueue : IEmailQueue
{
    private readonly Channel<EmailMessage> _channel;

    /// <summary>Crea la coda con capacità limitata (backpressure invece di crescita illimitata).</summary>
    public ChannelEmailQueue()
    {
        // Bounded: in modalità Wait, TryWrite ritorna false quando è piena (non blocca mai).
        _channel = Channel.CreateBounded<EmailMessage>(new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true
        });
    }

    /// <inheritdoc />
    public bool TryEnqueue(EmailMessage message) => _channel.Writer.TryWrite(message);

    /// <summary>Stream dei messaggi accodati, consumato dall'hosted service.</summary>
    public ChannelReader<EmailMessage> Reader => _channel.Reader;
}

/// <summary>
/// Servizio in background che consuma la <see cref="ChannelEmailQueue"/> e invia i messaggi
/// tramite <see cref="IEngineMailer"/>, con retry e backoff esponenziale sugli errori SMTP transitori.
/// </summary>
/// <remarks>
/// Disaccoppia l'invio dalla richiesta HTTP: l'endpoint accoda e risponde subito, qui avviene la
/// consegna effettiva. Rispetta il <c>CancellationToken</c> di shutdown per uno stop pulito.
/// Errori non recuperabili (mailer spento, indirizzo non valido) vengono scartati con log, senza retry.
/// </remarks>
internal sealed class EmailSenderHostedService : BackgroundService
{
    private const int MaxAttempts = 3;

    private readonly ChannelEmailQueue _queue;
    private readonly IEngineMailer _mailer;
    private readonly ILogger<EmailSenderHostedService> _logger;

    /// <summary>Inietta la coda, il mailer e il logger.</summary>
    public EmailSenderHostedService(ChannelEmailQueue queue, IEngineMailer mailer, ILogger<EmailSenderHostedService> logger)
    {
        _queue = queue;
        _mailer = mailer;
        _logger = logger;
    }

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in _queue.Reader.ReadAllAsync(stoppingToken))
            await SendWithRetryAsync(message, stoppingToken);
    }

    /// <summary>Invia con un massimo di <see cref="MaxAttempts"/> tentativi e backoff 2s, 4s.</summary>
    private async Task SendWithRetryAsync(EmailMessage message, CancellationToken stoppingToken)
    {
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                await _mailer.SendAsync(message, stoppingToken);
                return;
            }
            catch (OperationCanceledException)
            {
                // Shutdown in corso: esci senza loggare come errore.
                return;
            }
            catch (Exception ex) when (ex is MailNotConfiguredException or MailInvalidAddressException
                                          or MailAttachmentTooLargeException or ArgumentException)
            {
                // Errori non recuperabili: ritentare non cambierebbe l'esito. Scarta con log.
                _logger.LogWarning(ex, "Messaggio email scartato (errore non recuperabile).");
                return;
            }
            catch (Exception ex) when (attempt < MaxAttempts && !stoppingToken.IsCancellationRequested)
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt)); // 2s, poi 4s
                _logger.LogWarning(ex, "Invio email fallito (tentativo {Attempt}/{Max}), retry tra {Delay}s.",
                    attempt, MaxAttempts, delay.TotalSeconds);
                try { await Task.Delay(delay, stoppingToken); }
                catch (OperationCanceledException) { return; }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Invio email fallito definitivamente dopo {Max} tentativi.", MaxAttempts);
                return;
            }
        }
    }
}
