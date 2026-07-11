using Backend.Store;

namespace Backend.Services;

/// <summary>
/// Casi d'uso applicativi del sito esposti dalle API pubbliche: orchestra logica di dominio leggera
/// sopra <see cref="IContentStore"/> (per ora il filtro della galleria social demo), senza toccare lo storage.
/// </summary>
public class SiteService
{
    private readonly IContentStore _store;

    /// <summary>Inizializza col content store da cui leggere i contenuti del sito.</summary>
    public SiteService(IContentStore store)
    {
        _store = store;
    }

    /// <summary>
    /// Recupera i social configurati, filtrandoli opzionalmente per <c>nomi</c> (case-insensitive;
    /// nullo/vuoto = tutti). Restituisce una mappa nome→URL.
    /// </summary>
    public async Task<Dictionary<string, string>> GetSocialAsync(string[]? nomi = null, CancellationToken cancellationToken = default)
    {
        var data = await _store.GetSocialAsync(cancellationToken);

        if (nomi == null || nomi.Length == 0)
            return data;

        var filtro = nomi
            .Select(n => n.ToLowerInvariant())
            .ToHashSet();

        return data
            .Where(kv => filtro.Contains(kv.Key.ToLowerInvariant()))
            .ToDictionary(kv => kv.Key, kv => kv.Value);
    }
}
