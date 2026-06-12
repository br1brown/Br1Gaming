using Backend.Models;
using Backend.Models.Legal;

namespace Backend.Store;

/// <summary>
/// Definisce il contratto di accesso ai contenuti persistenti del sito.
/// </summary>
/// <remarks>
/// L'obiettivo dell'interfaccia e' isolare il resto del backend dal tipo di storage usato:
/// i servizi dipendono soltanto da questo contratto. La traduzione da file a contenuto
/// tipizzato avviene interamente dentro l'implementazione — chi consuma riceve modelli pronti.
/// </remarks>
public interface IContentStore
{
    /// <summary>
    /// Recupera il profilo legale dell'organizzazione nella lingua richiesta.
    /// </summary>
    /// <param name="language">
    /// Codice lingua da usare per la risoluzione dei campi localizzati, ad esempio <c>it</c> o <c>en</c>.
    /// </param>
    /// <param name="cancellationToken">
    /// Token legato alla richiesta HTTP: interrompe la lettura se il client abbandona la chiamata.
    /// </param>
    /// <returns>
    /// Un modello legale completo, gia' risolto nella lingua richiesta e pronto per essere esposto dall'API.
    /// </returns>
    Task<UniversalLegalModel> GetProfileAsync(string language, CancellationToken cancellationToken = default);

    /// <summary>
    /// Recupera il catalogo completo dei generatori, ordinato per <c>Info.Order</c>.
    /// </summary>
    /// <param name="cancellationToken">
    /// Token legato alla richiesta HTTP: interrompe la lettura se il client abbandona la chiamata.
    /// </param>
    /// <returns>I generatori disponibili (esclusi i dati condivisi), eventualmente vuoto.</returns>
    Task<List<GeneratorData>> GetGeneratorsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Recupera un singolo generatore per slug.
    /// </summary>
    /// <param name="slug">Slug del generatore richiesto, ad esempio <c>incel</c> o <c>mbeb</c>.</param>
    /// <param name="cancellationToken">
    /// Token legato alla richiesta HTTP: interrompe la lettura se il client abbandona la chiamata.
    /// </param>
    /// <returns>Il generatore tipizzato, o <c>null</c> se lo slug non esiste.</returns>
    Task<GeneratorData?> GetGeneratorAsync(string slug, CancellationToken cancellationToken = default);

    /// <summary>
    /// Recupera i dati condivisi tra tutti i generatori.
    /// </summary>
    /// <param name="cancellationToken">
    /// Token legato alla richiesta HTTP: interrompe la lettura se il client abbandona la chiamata.
    /// </param>
    /// <returns>I dati condivisi; collezioni vuote se la sorgente non esiste.</returns>
    Task<SharedData> GetSharedDataAsync(CancellationToken cancellationToken = default);
}
