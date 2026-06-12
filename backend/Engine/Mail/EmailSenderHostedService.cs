using Microsoft.Extensions.Hosting;
using Backend.Models;

namespace Backend.Mail;

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
