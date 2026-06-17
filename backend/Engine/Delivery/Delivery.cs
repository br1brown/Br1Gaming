using Backend.Mail;
using Backend.Notifications;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Backend.Delivery;

// Sottosistema Delivery (un solo file): canale, messaggio, servizio con switch realtime/email e
// registrazione DI. È l'unico concetto "consegna l'esito" del template — tenerlo insieme lo rende
// leggibile a colpo d'occhio (codice Engine, raramente toccato e aggiornato dal merge col template).

/// <summary>Canale con cui consegnare l'esito di un'operazione all'utente.</summary>
public enum DeliveryChannel
{
    /// <summary>Fallback durevole (opt-in): notifica realtime se il destinatario è connesso, altrimenti email.</summary>
    Auto,

    /// <summary>Notifica realtime (SSE) verso i client connessi. È il default di <see cref="IDeliveryService.DeliverAsync"/>.</summary>
    Realtime,

    /// <summary>Email (accodata, invio in background).</summary>
    Email
}

/// <summary>
/// Esito da consegnare, neutro rispetto al canale: il dispatcher lo adatta a notifica o email.
/// </summary>
public sealed record DeliveryMessage
{
    /// <summary>Destinatario realtime (SSE). Default: broadcast.</summary>
    public NotificationTarget Target { get; init; } = NotificationTarget.All;

    /// <summary>Indirizzo email (canale Email, o fallback del canale Auto). Senza, l'email è no-op.</summary>
    public string? Email { get; init; }

    /// <summary>Titolo logico: oggetto dell'email.</summary>
    public string Title { get; init; } = "";

    /// <summary>Corpo testuale: corpo dell'email e testo del toast realtime.</summary>
    public string Body { get; init; } = "";

    /// <summary>Icona del toast realtime (<c>success</c> | <c>error</c> | <c>info</c> | <c>warning</c>).</summary>
    public string Icon { get; init; } = "info";
}

/// <summary>
/// Consegna l'esito di un'operazione via notifica realtime o email, con switch interno.
/// </summary>
/// <remarks>
/// Registrato con <c>TryAddSingleton</c>: un progetto figlio può sostituirlo per governare lo
/// switch da fuori (forzare l'email, regole per tipo/utente…). Per ora i canali sono due, gestiti
/// con uno <c>switch</c>: se diventassero molti, è il punto in cui tornerebbe utile una factory.
/// </remarks>
public interface IDeliveryService
{
    /// <summary>
    /// Consegna il messaggio. Default <see cref="DeliveryChannel.Realtime"/>: solo notifica realtime
    /// ai client connessi, senza email a sorpresa se l'utente è offline. Passa
    /// <see cref="DeliveryChannel.Auto"/> per il fallback durevole (realtime se raggiungibile,
    /// altrimenti email) o <see cref="DeliveryChannel.Email"/> per forzare l'email.
    /// </summary>
    Task DeliverAsync(DeliveryMessage message, DeliveryChannel channel = DeliveryChannel.Realtime, CancellationToken cancellationToken = default);
}

/// <inheritdoc cref="IDeliveryService" />
internal sealed class DeliveryService : IDeliveryService
{
    private readonly INotificationStream _stream;
    private readonly IEmailQueue _email;
    private readonly ILogger<DeliveryService> _logger;

    /// <summary>Inietta lo stream notifiche, la coda email e il logger.</summary>
    public DeliveryService(INotificationStream stream, IEmailQueue email, ILogger<DeliveryService> logger)
    {
        _stream = stream;
        _email = email;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task DeliverAsync(DeliveryMessage message, DeliveryChannel channel = DeliveryChannel.Realtime, CancellationToken cancellationToken = default)
    {
        // Switch per canale: un canale nuovo = un nuovo case, niente if intrecciati. Realtime/Email
        // delegano agli helper; Auto compone i due (prova realtime, ripiega su email).
        switch (channel)
        {
            case DeliveryChannel.Realtime:
                // Solo push: nessun fallback, è una scelta esplicita del chiamante.
                _logger.LogDebug("Delivery realtime (consegnato {Delivered}).", PublishRealtime(message));
                break;

            case DeliveryChannel.Email:
                SendEmail(message);
                break;

            case DeliveryChannel.Auto:
            default:
                // Prova realtime e lascia decidere all'esito: Publish ritorna `true` se almeno una
                // connessione viva l'ha ricevuto — provare-e-verificare in un colpo solo evita la
                // finestra TOCTOU di un IsReachable seguito da un Publish separato. Se non l'ha
                // ricevuto nessuno, ripiega su email durevole.
                if (!PublishRealtime(message))
                    SendEmail(message);
                break;
        }

        return Task.CompletedTask;
    }

    /// <summary>Pubblica il toast realtime; ritorna <c>true</c> se almeno una connessione viva l'ha ricevuto.</summary>
    private bool PublishRealtime(DeliveryMessage message) =>
        _stream.Publish(message.Target, new NotificationMessage
        {
            Type = "toast",
            Payload = new { message = message.Body, icon = message.Icon }
        });

    /// <summary>Accoda l'email; senza indirizzo l'esito andrebbe perso in silenzio, quindi lo si registra.</summary>
    private void SendEmail(DeliveryMessage message)
    {
        if (!string.IsNullOrWhiteSpace(message.Email))
            _email.TryEnqueue(new EmailMessage
            {
                To = new[] { message.Email },
                Subject = string.IsNullOrWhiteSpace(message.Title) ? message.Body : message.Title,
                Body = message.Body
            });
        else
            _logger.LogWarning("Esito non consegnato: nessuna connessione realtime e nessun indirizzo email (target {Target}).", message.Target);
    }
}

/// <summary>Registrazione DI del servizio di delivery (notifica/email) del template.</summary>
public static class DeliveryExtensions
{
    /// <summary>
    /// Registra <see cref="IDeliveryService"/>. Dipende da <c>INotificationStream</c> e <c>IEmailQueue</c>.
    /// </summary>
    /// <remarks>
    /// <c>TryAddSingleton</c>: un progetto figlio può sostituire il servizio per governare lo switch
    /// dall'esterno senza toccare l'Engine.
    /// </remarks>
    public static IServiceCollection AddTemplateDelivery(this IServiceCollection services)
    {
        services.TryAddSingleton<IDeliveryService, DeliveryService>();
        return services;
    }
}
