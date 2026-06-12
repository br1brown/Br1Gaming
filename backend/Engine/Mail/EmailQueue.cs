using System.Threading.Channels;

namespace Backend.Mail;

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
