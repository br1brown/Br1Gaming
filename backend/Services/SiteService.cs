using Backend.Store;

namespace Backend.Services;

/// <summary>
/// Raccoglie i casi d'uso applicativi del sito esposti dalle API pubbliche.
/// </summary>
/// <remarks>
/// Il servizio orchestra logica di dominio leggera sopra <see cref="IContentStore"/>: per ora il
/// filtro della galleria social demo. Non conosce il dettaglio dello storage.
/// L'identità del sito (dati legali, social del brand, tipo entità) è invece servita dall'Engine
/// (<c>GET /identity</c>): non passa da qui.
/// </remarks>
public class SiteService
{
    private readonly IContentStore _store;

    /// <summary>
    /// Inizializza il servizio con lo store da usare per leggere i contenuti del sito.
    /// </summary>
    /// <param name="store">Astrazione di persistenza da cui recuperare contenuti e metadati.</param>
    public SiteService(IContentStore store)
    {
        _store = store;
    }

    /// <summary>
    /// Recupera i social configurati e li filtra opzionalmente per nome.
    /// </summary>
    /// <param name="nomi">
    /// Elenco opzionale dei nomi logici da mantenere.
    /// Se nullo o vuoto, il metodo restituisce tutti i social disponibili.
    /// </param>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    /// <returns>Una mappa nome-URL contenente tutti i social o solo quelli richiesti.</returns>
    /// <remarks>
    /// Il filtro e' case-insensitive, quindi richieste come <c>Facebook</c> e <c>facebook</c>
    /// vengono trattate come equivalenti.
    /// </remarks>
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
