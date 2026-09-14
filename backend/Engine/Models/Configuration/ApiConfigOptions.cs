namespace Backend.Models.Configuration;

/// <summary>
/// Configurazione delle API del backend: chiavi accettate e rate limiting. Letta da
/// <c>Security.ApiConfig</c> in <c>global-settings.json</c>.
/// </summary>
public class ApiConfigOptions
{
    /// <summary>
    /// Elenco delle API key ammesse dal backend per le chiamate interne (header <c>X-Api-Key</c>).
    /// </summary>
    public string[] Keys { get; set; } = [];

    /// <summary>
    /// Configurazione del rate limiting (soglie globale e login, on/off).
    /// </summary>
    public RateLimitingOptions RateLimiting { get; set; } = new();
}
