namespace Backend.Models.Configuration;

/// <summary>Configurazione di <see cref="Backend.Diagnostics.IErrorReportingService"/> (§ <c>ErrorReporting</c> di global-settings.local.json): un webhook HTTP generico, volutamente senza SDK di vendor (Sentry, Bugsnag...).</summary>
public class ErrorReportingOptions
{
    /// <summary>URL del webhook a cui inviare la segnalazione (POST JSON): requisito di <c>Features.ErrorReporting</c>.</summary>
    public string WebhookUrl { get; set; } = "";

    /// <summary><see langword="true"/> solo se <see cref="WebhookUrl"/> è valorizzato.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(WebhookUrl);
}
