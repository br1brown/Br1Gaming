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

/// <summary>
/// Destinatario di un push: scelto in modo programmatico dal codice di dominio.
/// </summary>
/// <remarks>
/// <list type="bullet">
/// <item><see cref="All"/>: broadcast a chiunque sia connesso.</item>
/// <item><see cref="Connection"/>: solo il client che ha avviato il job (gli passa il proprio
///   <c>connectionId</c> alla richiesta). Funziona anche per utenti anonimi.</item>
/// <item><see cref="Group"/>: tutte le connessioni di una chiave di gruppo — il significato lo
///   decide il progetto (es. l'id utente, un tenant, una "stanza"). La chiave viene assegnata a
///   ogni connessione da <c>INotificationGroupResolver</c>, che è il punto in cui un progetto
///   figlio aggancia la propria identità/auth.</item>
/// </list>
/// </remarks>
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

/// <summary>
/// Messaggio realtime spinto dal server verso i client connessi.
/// </summary>
/// <remarks>
/// L'engine fornisce solo il "contenitore": <see cref="Type"/> guida il dispatch lato client
/// (il <c>NotificationStreamService</c> Angular decide come reagire per tipo — toast di default
/// o handler custom), mentre <see cref="Payload"/> è un oggetto libero serializzato come JSON.
/// La FORMA del payload la decide il chiamante (codice di dominio), non l'engine.
/// </remarks>
public sealed record NotificationMessage
{
    /// <summary>
    /// Tipo logico della notifica. Il client lo usa per scegliere la reazione
    /// (es. <c>"toast"</c> di default, oppure un tipo custom con handler registrato).
    /// </summary>
    public string Type { get; init; } = "toast";

    /// <summary>
    /// Dati applicativi della notifica, serializzati come JSON. Per il toast di default
    /// il client si aspetta <c>{ message, icon? }</c>; per i tipi custom è ciò che serve all'handler.
    /// </summary>
    public object? Payload { get; init; }

    /// <summary>Identificativo univoco del messaggio (utile per dedup/lista lato client).</summary>
    public string Id { get; init; } = Guid.NewGuid().ToString("N");

    /// <summary>Istante di emissione (UTC).</summary>
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Rappresenta una singola connessione SSE in ascolto: il suo <see cref="ConnectionId"/>,
/// l'eventuale <see cref="GroupKey"/> e il canale da cui l'endpoint legge i messaggi da inviare.
/// </summary>
/// <remarks>
/// Il canale fa da buffer per-connessione: il publisher scrive (da qualunque thread), l'endpoint
/// SSE legge e inoltra. È volutamente opaco verso l'esterno (solo <see cref="Reader"/> è pubblico).
/// </remarks>
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

/// <summary>
/// Canale di notifiche realtime server → client (SSE). Registro delle connessioni + pubblicazione mirata.
/// </summary>
/// <remarks>
/// Singleton. Il codice di dominio inietta questa interfaccia e chiama <see cref="Publish"/> con il
/// <see cref="NotificationTarget"/> scelto; l'endpoint SSE dell'engine usa <see cref="Subscribe"/>/
/// <see cref="Unsubscribe"/> per gestire il ciclo di vita di ogni connessione.
/// </remarks>
public interface INotificationStream
{
    /// <summary>Registra una nuova connessione e restituisce il relativo <see cref="NotificationSubscriber"/>.</summary>
    /// <param name="groupKey">Chiave di gruppo (dal resolver) o <c>null</c> se la connessione non è raggruppata.</param>
    NotificationSubscriber Subscribe(string? groupKey);

    /// <summary>Rimuove una connessione e ne chiude il canale.</summary>
    void Unsubscribe(string connectionId);

    /// <summary>Pubblica un messaggio verso i destinatari indicati dal <paramref name="target"/>.</summary>
    /// <returns><c>true</c> se almeno una connessione viva l'ha ricevuto: lo usa il fallback Auto della
    /// delivery per ripiegare su email senza una finestra TOCTOU tra "verifica" e "pubblica".</returns>
    bool Publish(NotificationTarget target, NotificationMessage message);

    /// <summary>
    /// Storico recente delle notifiche recuperabili da un client (per popolare il campanellino
    /// anche dopo un reload o su una nuova scheda). Include i broadcast e — se <paramref name="groupKey"/>
    /// è valorizzato — le notifiche di quel gruppo. Le notifiche mirate a una singola connessione
    /// sono effimere e NON entrano nello storico (legate a una connessione viva, non recuperabili).
    /// </summary>
    /// <param name="groupKey">Chiave di gruppo del chiamante, o <c>null</c> per i soli broadcast.</param>
    /// <param name="afterId">
    /// Se valorizzato, restituisce solo i messaggi <b>successivi</b> a quell'id (replay dopo una
    /// riconnessione, da <c>Last-Event-ID</c>). Se l'id non è più in storico, restituisce tutto il
    /// rilevante (il client deduplica per id). <c>null</c> = storico completo rilevante.
    /// </param>
    IReadOnlyList<NotificationMessage> GetHistory(string? groupKey, string? afterId = null);

    /// <summary>
    /// Indica se esiste almeno una connessione viva che <paramref name="target"/> raggiungerebbe.
    /// Usato dalla consegna in modalità Auto: se nessuno è raggiungibile via realtime, si ripiega
    /// su un canale durevole (email).
    /// </summary>
    bool IsReachable(NotificationTarget target);

    /// <summary>Numero di connessioni attualmente attive.</summary>
    int ConnectionCount { get; }
}

/// <summary>
/// Implementazione in memoria di <see cref="INotificationStream"/>: un registro thread-safe di
/// connessioni, ciascuna con il proprio canale bufferizzato.
/// </summary>
/// <remarks>
/// In memoria = adatto a una singola istanza di backend (il default del template). Con più istanze
/// servirebbe un backplane (es. Redis) per instradare un push all'istanza che possiede la connessione:
/// è il punto in cui questa classe verrebbe sostituita, senza toccare publisher né endpoint.
/// </remarks>
public sealed class NotificationStream : INotificationStream
{
    // Buffer per-connessione: se un client è lento, scartiamo i messaggi più vecchi invece di
    // accumulare memoria all'infinito. Una notifica persa è preferibile a un leak.
    private const int PerConnectionBuffer = 100;

    // Storico recuperabile via API: anch'esso bounded. In memoria → per una singola istanza.
    // È il punto in cui, "domani", lo storico per-utente persistente (post-login) sostituirebbe
    // questa struttura con uno store (DB) interrogato per id utente.
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

/// <summary>
/// Decide a quale "gruppo" appartiene una connessione SSE in arrivo, a partire dall'<see cref="HttpContext"/>.
/// </summary>
/// <remarks>
/// È il punto di estensione con cui un progetto figlio abilita il targeting per utente/tenant senza
/// che l'engine conosca la forma della sua sessione. L'engine registra un default che ritorna
/// <c>null</c> (nessun gruppo → il targeting <see cref="NotificationTargetKind.Group"/> non raggiunge
/// nessuno, comportamento anonimo-safe). Un figlio sostituisce la registrazione con la propria
/// implementazione, ad esempio leggendo l'id utente dal claim di sessione del JWT.
/// </remarks>
public interface INotificationGroupResolver
{
    /// <summary>Chiave di gruppo per la connessione, o <c>null</c> se non raggruppata.</summary>
    string? Resolve(HttpContext context);
}

/// <summary>
/// Default dell'engine: nessun raggruppamento. Mantiene il meccanismo utilizzabile senza login;
/// il targeting per gruppo diventa attivo solo quando un figlio registra il proprio resolver.
/// </summary>
public sealed class NullNotificationGroupResolver : INotificationGroupResolver
{
    /// <inheritdoc />
    public string? Resolve(HttpContext context) => null;
}

/// <summary>
/// Registrazione DI del meccanismo di notifiche realtime del template.
/// </summary>
public static class NotificationExtensions
{
    /// <summary>
    /// Registra lo stream di notifiche (singleton) e il resolver di gruppo di default.
    /// </summary>
    /// <remarks>
    /// Il resolver è registrato con <c>TryAddSingleton</c>: un progetto figlio può sostituirlo
    /// con la propria implementazione (<c>services.AddSingleton&lt;INotificationGroupResolver, ...&gt;()</c>)
    /// per abilitare il targeting per utente/tenant, senza che l'engine conosca la sua sessione.
    /// </remarks>
    public static IServiceCollection AddTemplateNotifications(this IServiceCollection services)
    {
        services.AddSingleton<INotificationStream, NotificationStream>();
        services.TryAddSingleton<INotificationGroupResolver, NullNotificationGroupResolver>();
        return services;
    }
}
