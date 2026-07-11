using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Backend.Delivery;
using Backend.Notifications;
using Backend.Services;

namespace Backend.Controllers;

/// <summary>
/// Controller del progetto per gli endpoint pubblici (sola API key), eredita sicurezza e logger da
/// <see cref="EngineApiController"/>. Aggiungi qui gli endpoint senza auth utente; <see cref="GetSocial"/> è demo.
/// </summary>
[Route("")]
public class BaseController : EngineApiController
{
    private readonly SiteService _service;

    /// <summary>Inizializza col servizio di dominio e il logger. Notifiche/coda/delivery sono ambient da <see cref="EngineApiController"/>, non si iniettano.</summary>
    public BaseController(SiteService service, ILogger<BaseController> logger)
        : base(logger)
    {
        _service = service;
    }

    /// <summary>
    /// Restituisce i social network configurati, con filtro opzionale per nome. Endpoint dimostrativo:
    /// mostra come aggiungere funzionalità al controller ereditato dall'Engine (con notifica realtime
    /// d'esempio, vedi corpo).
    /// </summary>
    [HttpGet("social")]
    public async Task<IActionResult> GetSocial([FromQuery] string[]? nomi, CancellationToken cancellationToken)
    {
        var data = await _service.GetSocialAsync(nomi, cancellationToken);

        // Demo: se il chiamante ha lo stream aperto (X-Connection-Id), gli consegniamo un esito via
        // IDeliveryService col canale DI DEFAULT (Realtime) — pattern "azione di dominio → notifica
        // realtime". Col default l'email NON parte se il client è offline (opt-in con Auto/Email).
        var cid = ConnectionId;
        if (!string.IsNullOrEmpty(cid))
            await Delivery.DeliverAsync(new DeliveryMessage
            {
                Target = NotificationTarget.Connection(cid),
                Body = "Elenco social aggiornato.",
                Icon = "info"
            }, cancellationToken: cancellationToken);

        return Ok(data);
    }

    /// <summary>
    /// Endpoint dimostrativo: pubblica una notifica realtime sui client in ascolto via SSE.
    /// Se il chiamante ha lo stream aperto (header <c>X-Connection-Id</c>, aggiunto in automatico dal
    /// frontend) la invia solo a quel client; altrimenti fa broadcast a tutti. Serve a provare il meccanismo.
    /// </summary>
    [HttpPost("notifications/demo/ping")]
    public IActionResult PingNotification([FromQuery] string? message)
    {
        var cid = ConnectionId;
        var target = string.IsNullOrEmpty(cid)
            ? NotificationTarget.All
            : NotificationTarget.Connection(cid);

        // Contratto i18n: di default mandiamo una CHIAVE di traduzione (il client traduce nella
        // lingua corrente). Con ?message= si manda comunque un testo letterale (contenuto dinamico).
        object payload = string.IsNullOrEmpty(message)
            ? new { messageKey = "notificaDemoPing", icon = "info" }
            : (object)new { message, icon = "info" };

        Notifications.Publish(target, new NotificationMessage { Type = "toast", Payload = payload });

        return Ok(new { delivered = true, recipients = Notifications.ConnectionCount });
    }

    /// <summary>
    /// Demo del pattern "task lungo": accoda un import simulato e risponde subito <c>202 Accepted</c>;
    /// a fine task notifica l'esito via <see cref="IDeliveryService"/> (toast realtime, o email di
    /// fallback — vedi corpo).
    /// </summary>
    [HttpPost("tasks/demo/import")]
    public IActionResult StartDemoImport([FromQuery] string? email)
    {
        var cid = ConnectionId;
        var target = string.IsNullOrEmpty(cid)
            ? NotificationTarget.All
            : NotificationTarget.Connection(cid);

        var enqueued = BackgroundQueue.TryEnqueue(async (services, ct) =>
        {
            // Qui useresti uno store risolto da `services` (scoped) per l'import vero dei record.
            await Task.Delay(TimeSpan.FromSeconds(3), ct); // simula l'elaborazione di 12.000 record

            var delivery = services.GetRequiredService<IDeliveryService>();
            await delivery.DeliverAsync(new DeliveryMessage
            {
                Target = target,
                Email = email,
                Title = "Import completato",
                Body = "Import di 12.000 record completato.",
                Icon = "success"
            }, DeliveryChannel.Auto, ct);
        });

        // 202: accettato ed in elaborazione. 503 se la coda è satura (backpressure).
        return enqueued ? Accepted() : StatusCode(StatusCodes.Status503ServiceUnavailable);
    }
}
