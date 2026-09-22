using System.Collections.Concurrent;
using System.Threading.Channels;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Backend.Notifications;

// Sottosistema Notifiche realtime (un solo file): target, messaggio, subscriber, lo stream SSE
// (contratto + implementazione in memoria), il seam del group resolver e la registrazione DI.
// Tutto il concetto "push server→client" in un posto solo (l'endpoint HTTP SSE vive nel controller).

/// <summary>Criterio di selezione dei destinatari di una <see cref="NotificationMessage"/>.</summary>
public enum NotificationTargetKind
{
    /// <summary>Tutti i client connessi.</summary>
    All,

    /// <summary>Una singola connessione, identificata dal suo <c>connectionId</c>.</summary>
    Connection,

    /// <summary>Tutte le connessioni che condividono una chiave di gruppo (semantica decisa dal progetto).</summary>
    Group
}

/// <summary>Destinatario di un push, scelto in modo programmatico dal codice di dominio.</summary>
public readonly record struct NotificationTarget(NotificationTargetKind Kind, string? Value)
{
    /// <summary>Broadcast a tutti i client connessi.</summary>
    public static NotificationTarget All => new(NotificationTargetKind.All, null);

    /// <summary>Solo la connessione indicata.</summary>
    public static NotificationTarget Connection(string connectionId) =>
        new(NotificationTargetKind.Connection, connectionId);

    /// <summary>Tutte le connessioni della chiave di gruppo indicata.</summary>
    public static NotificationTarget Group(string groupKey) =>
        new(NotificationTargetKind.Group, groupKey);
}

/// <summary>Messaggio realtime spinto dal server: l'engine fornisce solo il contenitore, la forma del <see cref="Payload"/> la decide il chiamante.</summary>
public sealed record NotificationMessage
{
    /// <summary>Tipo logico che guida il dispatch lato client (default "toast", o un tipo custom con handler registrato).</summary>
    public string Type { get; init; } = "toast";

    /// <summary>Dati applicativi serializzati come JSON; per il toast di default il client si aspetta <c>{ message, icon? }</c>.</summary>
    public object? Payload { get; init; }

    /// <summary>Identificativo univoco del messaggio (utile per dedup/lista lato client).</summary>
    public string Id { get; init; } = Guid.NewGuid().ToString("N");

    /// <summary>Istante di emissione (UTC).</summary>
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>Una connessione SSE in ascolto: <see cref="ConnectionId"/>, <see cref="GroupKey"/> e il canale (buffer per-connessione) da cui l'endpoint legge.</summary>
public sealed class NotificationSubscriber
{
    internal NotificationSubscriber(string connectionId, string? groupKey, Channel<NotificationMessage> channel)
    {
        ConnectionId = connectionId;
        GroupKey = groupKey;
        Channel = channel;
    }

    /// <summary>Identificativo univoco della connessione, comunicato al client al primo frame SSE.</summary>
    public string ConnectionId { get; }

    /// <summary>Chiave di gruppo (semantica del progetto) o <c>null</c> se la connessione non è raggruppata.</summary>
    public string? GroupKey { get; }

    /// <summary>Canale interno: il publisher ci scrive i messaggi destinati a questa connessione.</summary>
    internal Channel<NotificationMessage> Channel { get; }

    /// <summary>Lato lettura del canale, consumato dall'endpoint SSE.</summary>
    public ChannelReader<NotificationMessage> Reader => Channel.Reader;
}

/// <summary>Canale di notifiche realtime server → client (SSE), singleton: registro connessioni + pubblicazione mirata.</summary>
public interface INotificationStream
{
    /// <summary>Registra una nuova connessione e restituisce il relativo <see cref="NotificationSubscriber"/>.</summary>
    /// <param name="groupKey">Chiave di gruppo (dal resolver) o <c>null</c> se la connessione non è raggruppata.</param>
    NotificationSubscriber Subscribe(string? groupKey);

    /// <summary>Rimuove una connessione e ne chiude il canale.</summary>
    void Unsubscribe(string connectionId);

    /// <summary>Pubblica verso i destinatari del target. Ritorna true se almeno una connessione viva l'ha ricevuto (senza finestra TOCTOU rispetto a un IsReachable chiamato prima).</summary>
    bool Publish(NotificationTarget target, NotificationMessage message);

    /// <summary>Storico recuperabile (broadcast + eventuale gruppo, mai le notifiche per-connessione). Con <paramref name="afterId"/> restituisce solo i messaggi successivi (replay da Last-Event-ID).</summary>
    IReadOnlyList<NotificationMessage> GetHistory(string? groupKey, string? afterId = null);

    /// <summary>Se esiste almeno una connessione viva che il target raggiungerebbe (usato dal fallback Auto della delivery per ripiegare su email).</summary>
    bool IsReachable(NotificationTarget target);

    /// <summary>Numero di connessioni attualmente attive.</summary>
    int ConnectionCount { get; }
}

/// <summary>Implementazione in memoria di <see cref="INotificationStream"/>: per singola istanza backend, sostituibile con un backplane (es. Redis) per lo scale-out.</summary>
public sealed class NotificationStream : INotificationStream
{
    // Buffer per-connessione: se un client è lento, scartiamo i messaggi più vecchi invece di
    // accumulare memoria all'infinito. Una notifica persa è preferibile a un leak.
    private const int PerConnectionBuffer = 100;

    // Storico recuperabile via API, anch'esso bounded e in memoria (per singola istanza).
    private const int HistoryCapacity = 100;

    private readonly ConcurrentDictionary<string, NotificationSubscriber> _subscribers = new();

    private readonly object _historyLock = new();
    private readonly LinkedList<HistoryEntry> _history = new();

    private readonly record struct HistoryEntry(NotificationTarget Target, NotificationMessage Message);

    /// <inheritdoc />
    public int ConnectionCount => _subscribers.Count;

    /// <inheritdoc />
    public NotificationSubscriber Subscribe(string? groupKey)
    {
        var channel = Channel.CreateBounded<NotificationMessage>(new BoundedChannelOptions(PerConnectionBuffer)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        });

        var subscriber = new NotificationSubscriber(Guid.NewGuid().ToString("N"), groupKey, channel);
        _subscribers[subscriber.ConnectionId] = subscriber;
        return subscriber;
    }

    /// <inheritdoc />
    public void Unsubscribe(string connectionId)
    {
        if (_subscribers.TryRemove(connectionId, out var subscriber))
            subscriber.Channel.Writer.TryComplete();
    }

    /// <inheritdoc />
    public bool Publish(NotificationTarget target, NotificationMessage message)
    {
        var delivered = false;
        foreach (var subscriber in _subscribers.Values)
        {
            // TryWrite fallisce solo se il canale è già completato (connessione in chiusura): così
            // `delivered` riflette le connessioni davvero vive al momento del push — niente TOCTOU
            // rispetto a un IsReachable chiamato prima.
            if (Matches(target, subscriber) && subscriber.Channel.Writer.TryWrite(message))
                delivered = true;
        }

        // Le notifiche mirate a una connessione sono effimere: niente storico (non recuperabili
        // dopo un reload). Broadcast e gruppo invece restano, per il campanellino.
        if (target.Kind != NotificationTargetKind.Connection)
        {
            lock (_historyLock)
            {
                _history.AddLast(new HistoryEntry(target, message));
                while (_history.Count > HistoryCapacity)
                    _history.RemoveFirst();
            }
        }

        return delivered;
    }

    /// <inheritdoc />
    public IReadOnlyList<NotificationMessage> GetHistory(string? groupKey, string? afterId = null)
    {
        lock (_historyLock)
        {
            var relevant = _history
                .Where(entry => entry.Target.Kind == NotificationTargetKind.All
                             || (entry.Target.Kind == NotificationTargetKind.Group
                                 && groupKey != null
                                 && entry.Target.Value == groupKey))
                .Select(entry => entry.Message)
                .ToList();

            if (string.IsNullOrEmpty(afterId))
                return relevant;

            // Replay: solo i messaggi dopo l'ultimo id visto. Se non è più in storico (troncato o
            // sconosciuto), restituiamo tutto il rilevante — il client deduplica comunque per id.
            var index = relevant.FindIndex(message => message.Id == afterId);
            return index >= 0 ? relevant.GetRange(index + 1, relevant.Count - index - 1) : relevant;
        }
    }

    /// <inheritdoc />
    public bool IsReachable(NotificationTarget target) => _subscribers.Values.Any(s => Matches(target, s));

    private static bool Matches(NotificationTarget target, NotificationSubscriber subscriber) => target.Kind switch
    {
        NotificationTargetKind.All => true,
        NotificationTargetKind.Connection => subscriber.ConnectionId == target.Value,
        NotificationTargetKind.Group => subscriber.GroupKey != null && subscriber.GroupKey == target.Value,
        _ => false
    };
}

/// <summary>Punto di estensione: decide a quale gruppo appartiene una connessione SSE, senza che l'engine conosca la forma della sessione del progetto (es. legge l'id utente dal claim JWT).</summary>
public interface INotificationGroupResolver
{
    /// <summary>Chiave di gruppo per la connessione, o <c>null</c> se non raggruppata.</summary>
    string? Resolve(HttpContext context);
}

/// <summary>Default dell'engine: nessun raggruppamento (anonimo-safe), finché un progetto non registra il proprio resolver.</summary>
public sealed class NullNotificationGroupResolver : INotificationGroupResolver
{
    /// <inheritdoc />
    public string? Resolve(HttpContext context) => null;
}

/// <summary>Registrazione DI del meccanismo di notifiche realtime del template.</summary>
public static class NotificationExtensions
{
    /// <summary>Registra stream e resolver di gruppo (entrambi <c>TryAddSingleton</c>): un progetto può sostituire l'uno o l'altro.</summary>
    public static IServiceCollection AddTemplateNotifications(this IServiceCollection services)
    {
        services.TryAddSingleton<INotificationStream, NotificationStream>();
        services.TryAddSingleton<INotificationGroupResolver, NullNotificationGroupResolver>();
        return services;
    }
}
