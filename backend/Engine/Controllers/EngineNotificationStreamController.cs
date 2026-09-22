using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Backend.Models.Configuration;
using Backend.Notifications;

namespace Backend.Controllers;

/// <summary>Endpoint SSE del template: tiene aperta una connessione e inoltra i messaggi pubblicati su <see cref="INotificationStream"/>. Solo API key, non login (funziona anche per anonimi); il targeting di gruppo è delegato a <see cref="INotificationGroupResolver"/>.</summary>
[Route("notifications")]
public sealed class EngineNotificationStreamController : EngineApiController
{
    // Opzioni "web" (camelCase): i nomi dei campi combaciano con le interfacce TypeScript lato client.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Heartbeat e delay di riconnessione: da NotificationsOptions, default 25s/5s se assente.
    private readonly TimeSpan _heartbeat;
    private readonly TimeSpan _reconnectDelay;

    private readonly INotificationStream _stream;
    private readonly INotificationGroupResolver _groupResolver;

    /// <summary>Inietta lo stream, il resolver di gruppo, le opzioni di timing e il logger.</summary>
    public EngineNotificationStreamController(
        INotificationStream stream,
        INotificationGroupResolver groupResolver,
        IOptions<NotificationsOptions> options,
        ILogger<EngineNotificationStreamController> logger)
        : base(logger)
    {
        _stream = stream;
        _groupResolver = groupResolver;
        _heartbeat = TimeSpan.FromSeconds(options.Value.HeartbeatSeconds);
        _reconnectDelay = TimeSpan.FromSeconds(options.Value.ReconnectDelaySeconds);
    }

    /// <summary>Apre lo stream SSE. Il primo frame comunica al client il suo connectionId, così può allegarlo alle richieste che avviano un job e ricevere la notifica mirata a fine elaborazione.</summary>
    [HttpGet("stream")]
    public async Task Stream(CancellationToken cancellationToken)
    {
        var groupKey = _groupResolver.Resolve(HttpContext);
        var subscriber = _stream.Subscribe(groupKey);

        Response.Headers.ContentType = "text/event-stream";
        // no-transform: gzip bufferizzerebbe i frame SSE, il browser non li riceverebbe in tempo reale.
        Response.Headers.CacheControl = "no-cache, no-transform";
        // Disabilita il buffering di reverse proxy come nginx, altrimenti i frame restano in coda.
        Response.Headers["X-Accel-Buffering"] = "no";
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        try
        {
            // Suggerisce al browser il delay di riconnessione (campo SSE standard).
            await Response.WriteAsync($"retry: {(int)_reconnectDelay.TotalMilliseconds}\n\n", cancellationToken);

            await WriteFrameAsync("connection",
                JsonSerializer.Serialize(new { connectionId = subscriber.ConnectionId }, Json),
                cancellationToken);

            // Il browser rimanda l'ultimo id ricevuto in Last-Event-ID (SSE nativo): rispediamo i
            // messaggi successivi. Il primo collegamento non ha Last-Event-ID: lì il client usa GET /history.
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
                // Attesa con timeout = heartbeat: scaduto, mandiamo un keep-alive. Token linkati per
                // non lasciare task pendenti alla disconnessione del client.
                using var beat = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                beat.CancelAfter(_heartbeat);

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

    /// <summary>Storico recente (broadcast + eventuale gruppo, mai le notifiche per-connessione) per popolare il campanellino al primo caricamento.</summary>
    [HttpGet("history")]
    public IActionResult History()
    {
        var groupKey = _groupResolver.Resolve(HttpContext);
        return Ok(_stream.GetHistory(groupKey));
    }

    /// <summary>Scrive un frame SSE; con <paramref name="id"/> aggiunge il campo id: che il browser rimanda come Last-Event-ID alla riconnessione.</summary>
    private Task WriteFrameAsync(string eventName, string data, CancellationToken ct, string? id = null)
    {
        var frame = id is null
            ? $"event: {eventName}\ndata: {data}\n\n"
            : $"id: {id}\nevent: {eventName}\ndata: {data}\n\n";
        return Response.WriteAsync(frame, ct);
    }
}
