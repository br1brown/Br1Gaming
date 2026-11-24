using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Backend.Models.Configuration;
using Backend.Security;

namespace Backend.Services;

/// <summary>Infrastruttura JWT del template: genera i token di login. Non verifica credenziali (resta al chiamante); la validazione in ingresso è del middleware JWT Bearer (<c>SecurityExtensions.AddTemplateSecurity</c>).</summary>
public class AuthService
{
    private readonly SymmetricSecurityKey _signingKey;
    private readonly int _expirationSeconds;
    private readonly int _maxSessionSeconds;
    private readonly TimeProvider _clock;

    /// <summary>Legge signing key e durata token dalla configurazione; <paramref name="clock"/> è l'orologio di emissione (di serie quello di sistema).</summary>
    public AuthService(IOptions<SecurityOptions> options, TimeProvider? clock = null)
    {
        var tokenOpts = options.Value.Token;
        _signingKey = tokenOpts.GetSigningKey();
        _expirationSeconds = tokenOpts.ExpirationSeconds;
        _maxSessionSeconds = tokenOpts.MaxSessionSeconds;
        _clock = clock ?? TimeProvider.System;
    }

    /// <summary>Claim con l'istante del login originale (secondi Unix): resta uguale a ogni rinnovo e fissa il tetto di <c>ExpirationSeconds × 9,5</c>.</summary>
    public const string SessionStartClaimType = "sessionStart";

    /// <summary>Token nuovo con gli stessi claim di dominio (sessione e ruoli) e una nuova scadenza, mai oltre <c>ExpirationSeconds × 9,5</c> dal login
    /// originale (<c>sessionStart</c>, o <c>loginTime</c> per i token che non lo hanno). <c>null</c> a tetto raggiunto: serve un nuovo login.</summary>
    public string? Refresh(ClaimsPrincipal user)
    {
        var now = _clock.GetUtcNow();
        var start = ReadUnix(user, SessionStartClaimType) ?? ReadUnix(user, SessionRevocation.LoginTimeClaimType) ?? now;
        // Un inizio sessione nel futuro (anche vicino all'anno 9999) vale adesso.
        if (start > now) start = now;
        var cap = start.AddSeconds(_maxSessionSeconds);
        // Tetto raggiunto, o la scadenza attuale è già al tetto: null, serve un nuovo login.
        if (now >= cap || (ReadUnix(user, JwtRegisteredClaimNames.Exp) is { } currentExpiry && cap <= currentExpiry)) return null;

        // Solo i claim di dominio: ruolo "Authenticated", loginTime(Ms) e sessionStart li riscrive GenerateToken.
        var claims = user.Claims
            .Where(c => c.Type == SecurityDefaults.SessionClaimType
                || (c.Type == ClaimTypes.Role && c.Value != SecurityDefaults.AuthenticatedRole))
            .Select(c => new Claim(c.Type, c.Value));
        return GenerateToken(claims, start);
    }

    private static DateTimeOffset? ReadUnix(ClaimsPrincipal user, string type) =>
        long.TryParse(user.FindFirst(type)?.Value, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var seconds)
            && seconds is > 0 and < 253402300799
            ? DateTimeOffset.FromUnixTimeSeconds(seconds)
            : null;

    /// <summary>Genera un token JWT firmato col ruolo "Authenticated" (richiesto dalla policy RequireLogin) più claim opzionali, non validati qui: il chiamante ne è responsabile.
    /// <paramref name="sessionStart"/> è l'istante del login originale (di serie: adesso); la scadenza non va oltre <c>MaxSessionSeconds</c> da lì.</summary>
    public string GenerateToken(IEnumerable<Claim>? additionalClaims = null, DateTimeOffset? sessionStart = null)
    {
        var now = _clock.GetUtcNow();
        var start = sessionStart is { } given && given <= now ? given : now;
        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, SecurityDefaults.AuthenticatedRole),
            // Istante di emissione: SessionRevocation respinge i token emessi prima di una revoca.
            new(SessionRevocation.LoginTimeClaimType, now.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new(SessionRevocation.LoginTimeMsClaimType, now.ToUnixTimeMilliseconds().ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new(SessionStartClaimType, start.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture))
        };

        if (additionalClaims != null)
            claims.AddRange(additionalClaims);

        var tokenHandler = new JwtSecurityTokenHandler();
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            // `nbf` e `iat` dall'orologio registrato: altrimenti il gestore JWT userebbe quello di sistema.
            NotBefore = now.UtcDateTime,
            IssuedAt = now.UtcDateTime,
            Expires = new[] { now.AddSeconds(_expirationSeconds), start.AddSeconds(_maxSessionSeconds) }.Min().UtcDateTime,
            SigningCredentials = new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(descriptor);
        return tokenHandler.WriteToken(token);
    }
}
