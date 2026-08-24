namespace Backend.Models.Configuration;

/// <summary>
/// Configurazione della segnalazione errori dell'Engine (<see cref="Backend.Diagnostics.IErrorReportingService"/>),
/// letta da <c>global-settings.local.json</c> sezione <c>ErrorReporting</c>.
/// </summary>
/// <remarks>
/// Volutamente minima e senza SDK di terze parti: un solo webhook HTTP generico, non l'endpoint
/// proprietario di un vendor specifico (Sentry, Bugsnag...). Chi vuole le funzionalità avanzate di
/// un vendor (source map, release tracking, breadcrumb) ne installa l'SDK dedicato nel proprio
/// progetto; questo resta il minimo comune denominatore "avvisami quando qualcosa si rompe",
/// puntabile a qualunque endpoint sappia ricevere un JSON POST (un webhook Slack/Discord dietro un
/// piccolo proxy di formattazione, un endpoint personale, un servizio di logging).
/// Si attiva da configurazione, come il mailer: <see cref="IsConfigured"/> è <see langword="false"/>
/// finché <see cref="WebhookUrl"/> resta vuoto — nessuna chiamata HTTP uscente di default.
/// </remarks>
public class ErrorReportingOptions
{
    /// <summary>URL del webhook a cui inviare la segnalazione (POST JSON). Vuoto = spento.</summary>
    public string WebhookUrl { get; set; } = "";

    /// <summary><see langword="true"/> solo se <see cref="WebhookUrl"/> è valorizzato.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(WebhookUrl);
}
