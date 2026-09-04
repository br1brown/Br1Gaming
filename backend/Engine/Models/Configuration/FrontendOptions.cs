namespace Backend.Models.Configuration;

/// <summary>
/// Indirizzo INTERNO del frontend Node SSR (es. <c>http://frontend:3000</c> nella rete Docker
/// Compose), letto da <c>global-settings.json</c> sezione <c>Frontend</c>. Da non confondere con
/// <c>frontend.hostname</c> (dominio pubblico per CORS/allowedHosts). Vuoto = funzionalità che ne
/// dipendono (<see cref="Backend.Sitemap.SitemapNotifier"/>) restano spente.
/// </summary>
public class FrontendOptions
{
    /// <summary>URL base del frontend, raggiungibile dal backend. Vuoto = spento. Un eventuale slash
    /// finale è tollerato (normalizzato da <see cref="Backend.Sitemap.SitemapNotifier"/> all'uso).</summary>
    public string Origin { get; set; } = "";

    /// <summary><see langword="true"/> solo se <see cref="Origin"/> è valorizzato.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(Origin);
}
