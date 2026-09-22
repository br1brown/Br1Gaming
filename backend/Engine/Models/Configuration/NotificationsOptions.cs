namespace Backend.Models.Configuration;

/// <summary>
/// Configurazione del canale realtime SSE (<c>EngineNotificationStreamController</c>). Letta da
/// <c>Notifications</c> in <c>global-settings.json</c>.
/// </summary>
public class NotificationsOptions
{
    /// <summary>
    /// Intervallo (secondi) del commento di keep-alive che tiene viva la connessione attraverso
    /// proxy/idle-timeout. Un reverse proxy/CDN con idle-timeout più corto del default (25s) —
    /// alcuni tagliano a 15-20s — richiede un valore più basso qui.
    /// </summary>
    public int HeartbeatSeconds { get; set; } = 25;

    /// <summary>Delay di riconnessione (secondi) suggerito al browser (campo SSE <c>retry:</c>).</summary>
    public int ReconnectDelaySeconds { get; set; } = 5;
}
