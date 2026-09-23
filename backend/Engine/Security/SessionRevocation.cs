using System.Globalization;
using System.Security.Claims;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Backend.Models.Configuration;

namespace Backend.Security;

/// <summary>Revoca dei JWT per sessione: un token non si può ritirare, ma si può rifiutare al prossimo uso. La cancellazione
/// dell'account (<c>DELETE /me/data</c>) chiama <see cref="Revoke"/>; il middleware JWT chiede <see cref="IsRevoked"/> a ogni
/// token firmato e non scaduto. Il default dell'Engine è <see cref="MemorySessionRevocation"/> (per istanza); un progetto con più
/// istanze del backend registra la propria implementazione (es. su Redis) nel blocco "SERVIZI APPLICATIVI" di <c>Program.cs</c>,
/// e vince sul default (<c>TryAddSingleton</c>).</summary>
public interface ISessionRevocation
{
    /// <summary>Respinge da ora ogni token della sessione di <paramref name="user"/> emesso fino a questo istante.</summary>
    void Revoke(ClaimsPrincipal user);

    /// <summary>True se la sessione di <paramref name="user"/> è stata revocata dopo l'emissione del suo token.</summary>
    bool IsRevoked(ClaimsPrincipal user);
}

/// <summary>Chiavi e claim condivisi da ogni implementazione di <see cref="ISessionRevocation"/>.</summary>
public static class SessionRevocation
{
    /// <summary>Claim con l'istante di emissione del token (secondi Unix), scritto da <c>AuthService.GenerateToken</c>.</summary>
    public const string LoginTimeClaimType = "loginTime";

    /// <summary>Chiave della sessione di <paramref name="user"/>: il payload di sessione (claim <see cref="SecurityDefaults.SessionClaimType"/>),
    /// per contratto deterministico per utente (solo dati identificativi), quindi uguale per due login dello stesso utente.
    /// <c>null</c> senza payload: nulla da revocare.</summary>
    public static string? SessionKey(ClaimsPrincipal user)
    {
        var session = user.FindFirst(SecurityDefaults.SessionClaimType)?.Value;
        return string.IsNullOrEmpty(session) ? null : $"session-revoked:{session}";
    }

    /// <summary>Istante di emissione del token di <paramref name="user"/> (secondi Unix), o <c>null</c> se il claim manca o non è
    /// un numero: un token che non dice quando è nato non può dimostrare di essere successivo a una revoca.</summary>
    public static long? LoginTime(ClaimsPrincipal user)
    {
        var raw = user.FindFirst(LoginTimeClaimType)?.Value;
        return long.TryParse(raw, NumberStyles.None, CultureInfo.InvariantCulture, out var t) ? t : null;
    }
}

/// <summary>Default dell'Engine: registro in memoria (<see cref="IMemoryCache"/>), per istanza. Una voce vive quanto un token
/// (<see cref="TokenOptions.ExpirationSeconds"/>), dopo non serve più perché il token è scaduto da sé. Un riavvio la perde, e i
/// token emessi prima del riavvio tornano validi fino a scadenza; due istanze del backend non si vedono: lì serve un'altra
/// <see cref="ISessionRevocation"/>. Basta per un'istanza sola, anche dietro reverse proxy, e con frontend su un altro server:
/// la revoca vive dove si validano i token, nel backend.</summary>
public sealed class MemorySessionRevocation : ISessionRevocation
{
    private readonly IMemoryCache _cache;
    private readonly TimeSpan _lifetime;

    /// <inheritdoc cref="MemorySessionRevocation"/>
    public MemorySessionRevocation(IMemoryCache cache, IOptions<SecurityOptions> security)
    {
        _cache = cache;
        // Un secondo di margine: loginTime è in secondi interi, la scadenza del token no.
        _lifetime = TimeSpan.FromSeconds(security.Value.Token.ExpirationSeconds + 1);
    }

    /// <inheritdoc />
    public void Revoke(ClaimsPrincipal user)
    {
        var key = SessionRevocation.SessionKey(user);
        if (key is null) return;
        _cache.Set(key, DateTimeOffset.UtcNow.ToUnixTimeSeconds(), _lifetime);
    }

    /// <inheritdoc />
    public bool IsRevoked(ClaimsPrincipal user)
    {
        var key = SessionRevocation.SessionKey(user);
        if (key is null || !_cache.TryGetValue(key, out long revokedAt)) return false;
        var loginTime = SessionRevocation.LoginTime(user);
        return loginTime is null || loginTime <= revokedAt;
    }
}
