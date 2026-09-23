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

    /// <summary>Legge signing key e durata token dalla configurazione tipizzata.</summary>
    public AuthService(IOptions<SecurityOptions> options)
    {
        var tokenOpts = options.Value.Token;
        _signingKey = tokenOpts.GetSigningKey();
        _expirationSeconds = tokenOpts.ExpirationSeconds;
    }

    /// <summary>Genera un token JWT firmato col ruolo "Authenticated" (richiesto dalla policy RequireLogin) più claim opzionali, non validati qui: il chiamante ne è responsabile.</summary>
    public string GenerateToken(IEnumerable<Claim>? additionalClaims = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, SecurityDefaults.AuthenticatedRole),
            // Istante di emissione: SessionRevocation respinge i token emessi prima di una revoca.
            new(SessionRevocation.LoginTimeClaimType, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture))
        };

        if (additionalClaims != null)
            claims.AddRange(additionalClaims);

        var tokenHandler = new JwtSecurityTokenHandler();
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddSeconds(_expirationSeconds),
            SigningCredentials = new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(descriptor);
        return tokenHandler.WriteToken(token);
    }
}
