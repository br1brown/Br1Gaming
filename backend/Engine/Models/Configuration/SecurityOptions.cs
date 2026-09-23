using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Models.Configuration;

/// <summary>
/// Raccoglie tutta la configurazione di sicurezza letta da <c>global-settings.json</c>.
/// </summary>
public class SecurityOptions
{
    /// <summary>
    /// Configurazione delle API: chiavi ammesse e rate limiting.
    /// </summary>
    public ApiConfigOptions ApiConfig { get; set; } = new();

    /// <summary>
    /// Elenco degli origin consentiti per CORS.
    /// Se vuoto, la policy risultante permette qualsiasi origin.
    /// </summary>
    public string[] CorsOrigins { get; set; } = [];

    /// <summary>Header di sicurezza da security-headers.json, condivisi col frontend SSR. Il backend li applica solo se esposto pubblicamente; Content-Security-Policy ignorata (serve solo JSON).</summary>
    public Dictionary<string, string> Headers { get; set; } = new();

    /// <summary>
    /// Configurazione del token JWT usato per il login applicativo.
    /// </summary>
    public TokenOptions Token { get; set; } = new();

    /// <summary>Se true, attiva ForwardedHeaders per ricostruire l'IP reale da X-Forwarded-For/Proto; se false il rate limiter usa RemoteIpAddress diretto.</summary>
    public bool BehindProxy { get; set; }

    /// <summary><see cref="TokenOptions.SecretKey"/> valorizzata: requisito del login, non l'interruttore.</summary>
    public bool HasSecretKey => !string.IsNullOrWhiteSpace(Token.SecretKey);

    /// <summary>Se il login JWT è attivo: lo decide <c>Features.Login</c>/<c>PublicLogin</c> all'avvio
    /// (Program.cs), non la sola chiave. Setter interno: non si legge dal JSON.</summary>
    public bool LoginEnabled { get; internal set; }
}

/// <summary>
/// Configurazione del token JWT del template.
/// </summary>
public class TokenOptions
{
    /// <summary>
    /// Chiave segreta usata per firmare i token JWT.
    /// </summary>
    public string SecretKey { get; set; } = "";

    /// <summary>
    /// Durata del token espressa in secondi.
    /// </summary>
    public int ExpirationSeconds { get; set; } = 3000;

    /// <summary>Costruisce la chiave simmetrica per JWT. Lancia se <see cref="SecretKey"/> è vuota, ha spazi iniziali/finali o è più corta di 32 byte UTF-8 (HMAC-SHA256): non viene espansa automaticamente, per non mascherare segreti deboli con l'entropia originale.</summary>
    public SymmetricSecurityKey GetSigningKey()
    {
        if (string.IsNullOrEmpty(SecretKey))
            throw new InvalidOperationException(
                "GetSigningKey() chiamato con SecretKey vuota. " +
                "Verificare SecurityOptions.LoginEnabled prima di chiamare questo metodo.");

        if (SecretKey != SecretKey.Trim())
            throw new InvalidOperationException(
                "Security.Token.SecretKey inizia o finisce con spazi o a capo: toglierli in global-settings.local.json.");

        var keyBytes = Encoding.UTF8.GetBytes(SecretKey);
        if (keyBytes.Length < 32)
            throw new InvalidOperationException(
                $"Security.Token.SecretKey troppo corta ({keyBytes.Length} byte). " +
                "HMAC-SHA256 richiede almeno 32 byte: configurare una chiave piu' lunga in global-settings.local.json.");

        return new SymmetricSecurityKey(keyBytes);
    }
}
