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

}
