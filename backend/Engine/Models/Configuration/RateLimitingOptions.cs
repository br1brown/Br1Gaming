namespace Backend.Models.Configuration;

/// <summary>
/// Configurazione del rate limiting delle API: soglia globale (partizionata per IP) e soglia
/// dedicata al login. Letta da <c>Security.ApiConfig.RateLimiting</c> in <c>global-settings.json</c>.
/// </summary>
public class RateLimitingOptions
{
    /// <summary>
    /// Attiva/disattiva l'enforcement dei limiti. Se <c>false</c>, ogni richiesta passa senza
    /// essere conteggiata (utile dietro un WAF/reverse proxy che applica già le proprie soglie).
    /// Le policy restano registrate (<c>[EnableRateLimiting("login")]</c> continua a risolvere),
    /// solo senza alcun effetto pratico.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Limite globale, partizionato per IP client.</summary>
    public FixedWindowLimitOptions Global { get; set; } = new() { PermitLimit = 100, WindowSeconds = 60 };

    /// <summary>Limite su <c>POST /auth/login</c>, partizionato per IP client.</summary>
    public FixedWindowLimitOptions Login { get; set; } = new() { PermitLimit = 5, WindowSeconds = 60 };
}

/// <summary>Un limite a finestra fissa: al più <see cref="PermitLimit"/> richieste ogni <see cref="WindowSeconds"/> secondi.</summary>
public class FixedWindowLimitOptions
{
    /// <summary>Richieste ammesse per finestra.</summary>
    public int PermitLimit { get; set; }

    /// <summary>Durata della finestra, in secondi.</summary>
    public int WindowSeconds { get; set; }
}
