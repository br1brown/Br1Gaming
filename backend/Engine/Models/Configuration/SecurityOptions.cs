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

    /// <summary>Chiave per <see cref="Security.EngineCrypto"/>, volutamente separata da <see cref="TokenOptions.SecretKey"/> (mai riusare la stessa chiave per firmare JWT e cifrare dati).</summary>
    public string CryptoSecret { get; set; } = "";

    /// <summary>Se true, attiva ForwardedHeaders per ricostruire l'IP reale da X-Forwarded-For/Proto; se false il rate limiter usa RemoteIpAddress diretto.</summary>
    public bool BehindProxy { get; set; }

    /// <summary>Se il login JWT è attivo: dipende esclusivamente da <see cref="TokenOptions.SecretKey"/> non vuota.</summary>
    public bool LoginEnabled => !string.IsNullOrWhiteSpace(Token.SecretKey);
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

    /// <summary>Costruisce la chiave simmetrica per JWT. Lancia se <see cref="SecretKey"/> è vuota o più corta di 32 byte (HMAC-SHA256): non viene espansa automaticamente, per non mascherare segreti deboli con l'entropia originale.</summary>
    public SymmetricSecurityKey GetSigningKey()
    {
        if (string.IsNullOrEmpty(SecretKey))
            throw new InvalidOperationException(
                "GetSigningKey() chiamato con SecretKey vuota. " +
                "Verificare SecurityOptions.LoginEnabled prima di chiamare questo metodo.");

        var keyBytes = Encoding.UTF8.GetBytes(SecretKey);
        if (keyBytes.Length < 32)
            throw new InvalidOperationException(
                $"Security.Token.SecretKey troppo corta ({keyBytes.Length} byte). " +
                "HMAC-SHA256 richiede almeno 32 byte: configurare una chiave piu' lunga in global-settings.json.");

        return new SymmetricSecurityKey(keyBytes);
    }
}
