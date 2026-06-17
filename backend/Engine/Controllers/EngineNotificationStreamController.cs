using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Backend.Notifications;

namespace Backend.Controllers;

/// <summary>
/// Endpoint SSE (Server-Sent Events) del template: tiene aperta una connessione e inoltra al client
/// i messaggi pubblicati su <see cref="INotificationStream"/>.
/// </summary>
/// <remarks>
/// Eredita da <see cref="EngineApiController"/>: richiede la sola API key (sempre iniettata dal proxy),
/// quindi NON richiede il login — il canale funziona anche per utenti anonimi. L'eventuale identità
/// per il targeting di gruppo è delegata a <see cref="INotificationGroupResolver"/>, che un figlio
/// aggancia alla propria auth.
/// </remarks>
[Route("notifications")]
public sealed class EngineNotificationStreamController : EngineApiController
{
    // Opzioni "web" (camelCase): i nomi dei campi combaciano con le interfacce TypeScript lato client.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Intervallo del commento di keep-alive: tiene viva la connessione attraverso proxy/idle-timeout.
    private static readonly TimeSpan Heartbeat = TimeSpan.FromSeconds(25);

    // Delay di riconnessione suggerito al browser (campo SSE `retry:`).
    private static readonly TimeSpan ReconnectDelay = TimeSpan.FromSeconds(5);

    private readonly INotificationStream _stream;
    private readonly INotificationGroupResolver _groupResolver;

    /// <inheritdoc cref="EngineNotificationStreamController"/>
    public EngineNotificationStreamController(
        INotificationStream stream,
        INotificationGroupResolver groupResolver,
        ILogger<EngineNotificationStreamController> logger)
        : base(logger)
    {
        _stream = stream;
        _groupResolver = groupResolver;
    }

    /// <summary>
    /// Apre lo stream SSE. Il primo frame comunica al client il suo <c>connectionId</c>, così può
    /// allegarlo alle richieste che avviano un job e ricevere la notifica mirata a fine elaborazione.
    /// </summary>
    /// <param name="cancellationToken">Annullato da ASP.NET quando il client si disconnette.</param>
    [HttpGet("stream")]
    public async Task Stream(CancellationToken cancellationToken)
    {
        var groupKey = _groupResolver.Resolve(HttpContext);
        var subscriber = _stream.Subscribe(groupKey);

        Response.Headers.ContentType = "text/event-stream";
        // no-transform: nessun intermediario deve comprimere/trasformare lo stream. gzip
        // bufferizzerebbe i frame SSE e il browser non li riceverebbe in tempo reale; il
        // middleware `compression` (e i reverse proxy conformi) rispettano questo direttivo.
        Response.Headers.CacheControl = "no-cache, no-transform";
        // Disabilita il buffering di reverse proxy come nginx (e del response body di Kestrel),
        // altrimenti i frame SSE resterebbero in coda invece di arrivare subito.
        Response.Headers["X-Accel-Buffering"] = "no";
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        try
        {
            // Suggerisce al browser il delay di riconnessione (campo SSE standard).
            await Response.WriteAsync($"retry: {(int)ReconnectDelay.TotalMilliseconds}\n\n", cancellationToken);

            await WriteFrameAsync("connection",
                JsonSerializer.Serialize(new { connectionId = subscriber.ConnectionId }, Json),
                cancellationToken);

            // Recupero dei messaggi persi durante una disconnessione: il browser rimanda l'ultimo
            // id ricevuto nell'header Last-Event-ID (meccanismo SSE nativo). Rispediamo i broadcast/
            // gruppo successivi a quell'id, ciascuno col proprio id così la catena resta consistente.
            // (Il primo collegamento di una scheda non ha Last-Event-ID: lì il client usa GET /history.)
            var lastEventId = Request.Headers["Last-Event-ID"].FirstOrDefault();
            if (!string.IsNullOrEmpty(lastEventId))
            {
                foreach (var missed in _stream.GetHistory(groupKey, lastEventId))
                    await WriteFrameAsync("notification", JsonSerializer.Serialize(missed, Json), cancellationToken, missed.Id);
            }

            await Response.Body.FlushAsync(cancellationToken);

            var reader = subscriber.Reader;
            while (!cancellationToken.IsCancellationRequested)
            {
                // Attesa di un messaggio con timeout = heartbeat: se nel frattempo non arriva nulla,
                // il timeout scatta e inviamo un commento di keep-alive. Linkando i token evitiamo
                // task pendenti: alla disconnessione del client il token reale annulla tutto.
                using var beat = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                beat.CancelAfter(Heartbeat);

                try
                {
                    if (!await reader.WaitToReadAsync(beat.Token))
                        break; // canale completato (unsubscribe)

                    while (reader.TryRead(out var message))
                        await WriteFrameAsync("notification", JsonSerializer.Serialize(message, Json), cancellationToken, message.Id);
                }
                catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    // Timeout del solo heartbeat (non il client): manda un commento keep-alive.
                    await Response.WriteAsync(": keep-alive\n\n", cancellationToken);
                }

                await Response.Body.FlushAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            // Client disconnesso: uscita pulita, nessun errore da loggare.
        }
        finally
        {
            _stream.Unsubscribe(subscriber.ConnectionId);
        }
    }

    /// <summary>
    /// Storico recente delle notifiche recuperabili dal chiamante (broadcast + eventuale gruppo),
    /// per popolare il campanellino al primo caricamento o su una nuova scheda. Le notifiche mirate
    /// a una connessione non sono incluse (effimere). Predisposto per lo storico per-utente post-login:
    /// basta registrare un INotificationGroupResolver che mappi l'utente.
    /// </summary>
    [HttpGet("history")]
    public IActionResult History()
    {
        var groupKey = _groupResolver.Resolve(HttpContext);
        return Ok(_stream.GetHistory(groupKey));
    }

    /// <summary>
    /// Scrive un frame SSE. Con <paramref name="id"/> valorizzato aggiunge il campo <c>id:</c>,
    /// che il browser memorizza e rimanda come <c>Last-Event-ID</c> alla riconnessione (recupero
    /// dei messaggi persi). Formato: <c>[id: &lt;id&gt;\n]event: &lt;name&gt;\ndata: &lt;json&gt;\n\n</c>.
    /// </summary>
    private Task WriteFrameAsync(string eventName, string data, CancellationToken ct, string? id = null)
    {
        var frame = id is null
            ? $"event: {eventName}\ndata: {data}\n\n"
            : $"id: {id}\nevent: {eventName}\ndata: {data}\n\n";
        return Response.WriteAsync(frame, ct);
    }
}
