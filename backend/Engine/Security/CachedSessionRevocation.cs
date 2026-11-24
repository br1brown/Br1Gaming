using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.Extensions.Caching.Memory;

namespace Backend.Security;

/// <summary>Lo stato di un account che conta per le sue sessioni, come lo legge <see cref="CachedSessionRevocation"/> dallo store del progetto.</summary>
/// <param name="Enabled">Falso = account disabilitato: ogni suo token è respinto, qualunque sia la data.</param>
/// <param name="ValidFrom">I token emessi fino a questo istante (compreso) non valgono più; <c>null</c> = nessuna revoca.</param>
public sealed record AccountSessionState(bool Enabled, DateTimeOffset? ValidFrom);

/// <summary>Revoca su database del progetto: chi la estende dice dove sta lo stato (tre metodi), qui ci sono cache, confronto con l'emissione e
/// rifiuto dei token senza account. Lo stato di un account resta in cache per <see cref="CacheDuration"/>; <see cref="Forget"/> lo rilegge subito.
/// Si registra in <c>Program.cs</c> ("SERVIZI APPLICATIVI") e vince sul default; lo store si legge con una <c>IDbContextFactory</c>.</summary>
public abstract class CachedSessionRevocation : ISessionRevocation
{
    private sealed record Cached(AccountSessionState? State);

    private readonly IMemoryCache _cache;
    private readonly TimeProvider _clock;
    // Un numero per account, incrementato da Forget: una lettura iniziata prima di una revoca e finita dopo non rimette in cache
    // lo stato vecchio (altrimenti la revoca resterebbe invisibile fino a CacheDuration).
    private readonly ConcurrentDictionary<string, int> _epoch = new();

    /// <summary>Quanto resta in cache lo stato di un account.</summary>
    public virtual TimeSpan CacheDuration => TimeSpan.FromSeconds(30);

    /// <inheritdoc cref="CachedSessionRevocation"/>
    protected CachedSessionRevocation(IMemoryCache cache, TimeProvider? clock = null)
    {
        _cache = cache;
        _clock = clock ?? TimeProvider.System;
    }

    /// <summary>L'identificativo dell'account del token (di solito <c>SessionInfo.UserId</c>), o <c>null</c> se dal payload di sessione
    /// non si risale a un account: il token è allora respinto (porta una sessione, ma non è di un account noto).</summary>
    protected abstract string? AccountKey(ClaimsPrincipal user);

    /// <summary>Legge dallo store lo stato dell'account; <c>null</c> se non esiste più (i suoi token sono respinti). Sincrono: vedi le note
    /// della classe; il risultato è in cache.</summary>
    protected abstract AccountSessionState? LoadState(string accountKey);

    /// <summary>Scrive nello store che i token di <paramref name="accountKey"/> emessi fino a <paramref name="validFrom"/> non valgono più.
    /// Un account inesistente non è un errore: nulla da scrivere.</summary>
    protected abstract void SaveValidFrom(string accountKey, DateTimeOffset validFrom);

    /// <summary>"Esci da tutti i dispositivi" per l'account di <paramref name="user"/>.</summary>
    public void Revoke(ClaimsPrincipal user)
    {
        if (AccountKey(user) is { } key)
            RevokeAccount(key);
    }

    /// <summary>Fa cadere ogni sessione di <paramref name="accountKey"/> emessa fino ad adesso (cambio password, account disabilitato da un amministratore).</summary>
    public void RevokeAccount(string accountKey)
    {
        SaveValidFrom(accountKey, _clock.GetUtcNow());
        Forget(accountKey);
    }

    /// <summary>Toglie dalla cache lo stato dell'account: da chiamare dopo ogni modifica che lo riguarda (abilitato, ValidFrom).</summary>
    public void Forget(string accountKey)
    {
        _epoch.AddOrUpdate(accountKey, 1, (_, n) => n + 1);
        _cache.Remove(CacheKey(accountKey));
    }

    /// <inheritdoc />
    public bool IsRevoked(ClaimsPrincipal user)
    {
        // Nessun payload di sessione: non è un login del progetto, niente da revocare (come il default dell'Engine).
        if (SessionRevocation.SessionKey(user) is null) return false;
        if (AccountKey(user) is not { } key) return true;

        AccountSessionState? state;
        if (_cache.TryGetValue(CacheKey(key), out Cached? hit) && hit is not null)
        {
            state = hit.State;
        }
        else
        {
            var epoch = _epoch.GetValueOrDefault(key);
            state = LoadState(key);
            // Se nel frattempo l'account è stato toccato (Forget), questo stato può essere vecchio: si usa ma non si conserva.
            if (_epoch.GetValueOrDefault(key) == epoch)
                _cache.Set(CacheKey(key), new Cached(state), CacheDuration);
        }
        if (state is null || !state.Enabled) return true;
        if (state.ValidFrom is not { } validFrom) return false;

        // Un token che non dice quando è nato non può dimostrare di essere successivo alla revoca.
        var loginTime = SessionRevocation.LoginTimeMs(user);
        return loginTime is null || loginTime <= validFrom.ToUnixTimeMilliseconds();
    }

    private static string CacheKey(string accountKey) => $"session-account:{accountKey}";
}
