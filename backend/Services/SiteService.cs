using System.Globalization;
using Backend.Models.Legal;
using Backend.Store;

namespace Backend.Services;

/// <summary>
/// Raccoglie i casi d'uso applicativi del sito esposti dalle API pubbliche.
/// </summary>
/// <remarks>
/// Il servizio orchestra logica di dominio leggera sopra <see cref="IContentStore"/>:
/// filtri, scelta della lingua corrente e arricchimento dei modelli restituiti.
/// Non conosce il dettaglio dello storage e per questo non dipende da file, database o provider esterni.
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
    /// Recupera il profilo del sito nella lingua corrente dell'applicazione.
    /// </summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    /// <returns>Un <see cref="UniversalLegalModel"/> localizzato.</returns>
    /// <remarks>
    /// La lingua effettiva viene presa da <see cref="CultureInfo.CurrentCulture"/>.
    /// Br1Gaming non espone social via profilo: il campo <c>Social</c> del modello
    /// (contratto engine) resta volutamente non valorizzato — il footer nasconde da solo
    /// la sezione vuota, e il link GitHub vive nella footerNav di <c>site.ts</c>.
    /// </remarks>
    public async Task<UniversalLegalModel> GetProfileAsync(CancellationToken cancellationToken = default)
    {
        var language = CultureInfo.CurrentCulture.TwoLetterISOLanguageName;
        return await _store.GetProfileAsync(language, cancellationToken);
    }
}
