namespace Backend.Models.Configuration;

/// <summary>
/// Configurazione per-progetto del ridimensionamento immagini. Letta da <c>Media</c> in
/// <c>global-settings.json</c>. Le dimensioni richiedibili non sono qui: whitelist fissa
/// dell'Engine, vedi <see cref="Controllers.EngineBlobController.AllowedWebOptSizes"/>.
/// </summary>
public class MediaOptions
{
    /// <summary>Qualità WebP (1-100) della variante web-ottimizzata, per ogni dimensione.</summary>
    public int WebOptQuality { get; set; } = 85;
}
