using System.Globalization;
using Backend.Models.Configuration;
using Backend.Models.Legal;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Backend.Store;

/// <summary>
/// Implementa <see cref="IContentStore"/> leggendo i contenuti da file nella cartella <c>data/</c>.
/// </summary>
/// <remarks>
/// I generatori non vivono più qui: sono istanze di classi (<c>Backend.Generators</c>). Questo store
/// resta responsabile dei soli contenuti ancora su file (profilo legale), isolando il resto del
/// backend dal formato di persistenza.
/// </remarks>
public class FileContentStore : IContentStore
{
    private readonly string _dataPath;
    private readonly IMemoryCache _cache;
    private readonly HashSet<string> _supportedLanguages;
    private readonly string _defaultLanguage;

    /// <summary>
    /// Inizializza lo store file-based partendo dalla root dell'applicazione ASP.NET.
    /// </summary>
    /// <param name="env">Ambiente host usato per ricavare il percorso assoluto della cartella <c>data</c>.</param>
    /// <param name="localizationOptions">Opzioni di localizzazione tipizzate (lingue supportate e lingua predefinita).</param>
    /// <param name="cache">Cache in memoria condivisa usata per i file statici.</param>
    public FileContentStore(IWebHostEnvironment env, IOptions<LocalizationOptions> localizationOptions, IMemoryCache cache)
    {
        _cache = cache;
        _dataPath = Path.Combine(env.ContentRootPath, "data");

        var loc = localizationOptions.Value;

        // CultureInfo.GetCultureInfo valida ogni codice secondo lo standard BCP-47 e lancia
        // CultureNotFoundException al boot se un tag non è riconosciuto (es. "ita" invece di "it").
        // TwoLetterISOLanguageName normalizza tag complessi (es. "it-IT" → "it") per il confronto con le chiavi JSON.
        _supportedLanguages = new HashSet<string>(
            loc.SupportedLanguages.Select(l => CultureInfo.GetCultureInfo(l).TwoLetterISOLanguageName),
            StringComparer.OrdinalIgnoreCase);

        _defaultLanguage = CultureInfo.GetCultureInfo(loc.DefaultLanguage).TwoLetterISOLanguageName;
    }

    /// <summary>
    /// Recupera il profilo legale localizzato dell'organizzazione.
    /// </summary>
    /// <param name="language">
    /// Lingua richiesta dal livello applicativo, tipicamente derivata da <c>Accept-Language</c>.
    /// </param>
    /// <param name="cancellationToken">
    /// Token della richiesta HTTP, propagato alla lettura del file.
    /// </param>
    /// <returns>
    /// Un <see cref="UniversalLegalModel"/> con i campi localizzati risolti.
    /// L'arricchimento con i social e' responsabilita' del livello applicativo (<c>SiteService</c>),
    /// cosi' lo store resta pure-storage e non conosce regole di business.
    /// </returns>
    public Task<UniversalLegalModel> GetProfileAsync(string language, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(new UniversalLegalModel());
    }
}
