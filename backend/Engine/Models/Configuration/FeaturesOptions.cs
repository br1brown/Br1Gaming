namespace Backend.Models.Configuration;

/// <summary>Funzioni opzionali accese dal progetto (§ <c>Features</c> di global-settings.json, voce assente =
/// spenta). Il flag è l'interruttore, la configurazione in global-settings.local.json il requisito: acceso
/// senza configurazione, il server non parte. Il frontend legge gli stessi flag a compilazione.</summary>
public class FeaturesOptions
{
    /// <summary>Login riservato (amministratori): nessun link in navbar, nessuna sezione nella Privacy Policy.</summary>
    public bool Login { get; set; }

    /// <summary>Login pubblico: link in navbar e sezione nella Privacy Policy. Vince su <see cref="Login"/>, che non serve accendere.</summary>
    public bool PublicLogin { get; set; }

    /// <summary>Invio email: richiede <c>Mail.Host</c> e <c>Mail.FromAddress</c>.</summary>
    public bool Mail { get; set; }

    /// <summary>Segnalazione errori via webhook: richiede <c>ErrorReporting.WebhookUrl</c>.</summary>
    public bool ErrorReporting { get; set; }

    /// <summary>Il sito raccoglie dati personali tramite form: accende la sezione dedicata della Privacy Policy.</summary>
    public bool Forms { get; set; }

    /// <summary>Login attivo, riservato o pubblico: richiede <c>Security.Token.SecretKey</c>.</summary>
    public bool LoginActive => Login || PublicLogin;

    /// <summary>Segnaposto di <c>global-settings.local.example.json</c>: lungo abbastanza da passare il minimo di
    /// 32 byte, ma pubblico nel repo.</summary>
    private const string ExampleSecretKey = "INCOLLA-QUI-openssl-rand-base64-48";

    /// <summary>Lancia se una funzione accesa non ha la configurazione che le serve. <c>SecretKey</c>: senza spazi
    /// iniziali/finali, diversa dal segnaposto dell'esempio, almeno 32 byte UTF-8.</summary>
    public void EnsureRequirements(SecurityOptions security, MailOptions mail, ErrorReportingOptions errorReporting)
    {
        var errors = new List<string>();
        if (LoginActive && !security.HasSecretKey)
            errors.Add("Features.Login/PublicLogin è acceso ma manca Security.Token.SecretKey in global-settings.local.json: generane una con openssl rand -base64 48, oppure spegni il flag in global-settings.json.");
        else if (LoginActive && security.Token.SecretKey != security.Token.SecretKey.Trim())
            errors.Add("Security.Token.SecretKey inizia o finisce con spazi o a capo: vanno tolti, la chiave firma i JWT byte per byte.");
        else if (LoginActive && security.Token.SecretKey == ExampleSecretKey)
            errors.Add("Security.Token.SecretKey è ancora il segnaposto dell'esempio, pubblico nel repo: generane una con openssl rand -base64 48.");
        else if (LoginActive && System.Text.Encoding.UTF8.GetByteCount(security.Token.SecretKey) < 32)
            errors.Add("Security.Token.SecretKey è più corta di 32 byte (HMAC-SHA256): generane una con openssl rand -base64 48.");
        if (Mail && !mail.IsConfigured)
            errors.Add("Features.Mail è acceso ma mancano Mail.Host e Mail.FromAddress (global-settings.local.json).");
        if (ErrorReporting && !errorReporting.IsConfigured)
            errors.Add("Features.ErrorReporting è acceso ma manca ErrorReporting.WebhookUrl (global-settings.local.json).");
        if (errors.Count > 0)
            throw new InvalidOperationException(string.Join(Environment.NewLine, errors));
    }
}
