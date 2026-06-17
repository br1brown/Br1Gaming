using System.Globalization;
using Backend.Delivery;
using Backend.Notifications;
using Backend.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Controllers;

/// <summary>
/// Radice astratta di tutti i controller: centralizza API key, Authorize e logger condiviso.
/// Il routing resta responsabilità del controller concreto.
/// </summary>
[ApiController]
[Authorize]
public abstract class EngineApiController : ControllerBase
{
    /// <summary>Logger condiviso con tutti i controller derivati.</summary>
    protected readonly ILogger Logger;

    /// <inheritdoc cref="EngineApiController"/>
    protected EngineApiController(ILogger logger)
    {
        Logger = logger;
    }

    // Infrastruttura "ambient" condivisa da TUTTI i controller: risolta pigramente dal service
    // provider della richiesta, così nessun controller deve iniettarla nel costruttore. Sono
    // singleton (risoluzione a costo nullo) e chi non le usa non paga nulla — il getter scatta solo
    // se invocato dentro un'azione (HttpContext valorizzato).

    /// <summary>Notifiche realtime (SSE): <c>Notifications.Publish(target, message)</c>.</summary>
    protected INotificationStream Notifications => HttpContext.RequestServices.GetRequiredService<INotificationStream>();

    /// <summary>Coda di task in background (POST risponde subito → lavoro lungo): <c>BackgroundQueue.TryEnqueue(...)</c>.</summary>
    protected IBackgroundTaskQueue BackgroundQueue => HttpContext.RequestServices.GetRequiredService<IBackgroundTaskQueue>();

    /// <summary>Consegna esiti con switch realtime/email: <c>Delivery.DeliverAsync(message)</c>.</summary>
    protected IDeliveryService Delivery => HttpContext.RequestServices.GetRequiredService<IDeliveryService>();

    /// <summary>
    /// connectionId della SSE del chiamante (header <c>X-Connection-Id</c>, aggiunto in automatico dal
    /// frontend quando lo stream è attivo), oppure <c>null</c>. Permette di notificare "questa scheda"
    /// senza un parametro nelle firme degli endpoint; <c>null</c> ⇒ nessuna connessione da targettare.
    /// </summary>
    protected string? ConnectionId
    {
        get
        {
            var value = Request.Headers["X-Connection-Id"].ToString();
            return string.IsNullOrEmpty(value) ? null : value;
        }
    }

    /// <summary>
    /// Cultura della richiesta, risolta da <c>Accept-Language</c> da <c>UseRequestLocalization</c>
    /// (es. <c>it-IT</c>/<c>it</c>). Comodità per non ricordarne la fonte: legge
    /// <see cref="CultureInfo.CurrentCulture"/>, NON l'header — nei service (che non ereditano dal
    /// base) si usa direttamente <see cref="CultureInfo.CurrentCulture"/>.
    /// </summary>
    protected CultureInfo CurrentCulture => CultureInfo.CurrentCulture;

    /// <summary>Codice lingua a due lettere della richiesta (es. <c>"it"</c>), la forma usata dal <c>FileContentStore</c>.</summary>
    protected string CurrentLanguage => CultureInfo.CurrentCulture.TwoLetterISOLanguageName;
}
