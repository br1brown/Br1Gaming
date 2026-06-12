using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Backend.Engine;
using Backend.Models;
using Backend.Models.Configuration;
using Backend.Models.Legal;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Backend.Store;

/// <summary>
/// Implementa <see cref="IContentStore"/> leggendo i contenuti da file JSON nella cartella <c>data/</c>.
/// </summary>
/// <remarks>
/// Questa implementazione centralizza due responsabilita': la lettura fisica dei file
/// (con cache in memoria via <see cref="FileUtils.ReadStaticFileAsync"/>) e la
/// deserializzazione nei modelli tipizzati. In questo modo controller e servizi
/// restano indipendenti dal formato di persistenza.
/// </remarks>
public class FileContentStore : IContentStore
{
    // Nome riservato dentro data/generators/: dati condivisi, non è un generatore.
    private const string SharedSlug = "shared";

    // Stessa difesa path-traversal del BlobController: lo slug arriva dall'URL e finisce
    // in un percorso file, quindi accettiamo solo slug "da nome file" (niente '.', '/', '\').
    private static readonly Regex SlugRx = new("^[a-z0-9-]+$", RegexOptions.Compiled);

    private readonly string _dataPath;
    private readonly string _generatorsPath;
    private readonly IMemoryCache _cache;
    private readonly HashSet<string> _supportedLanguages;
    private readonly string _defaultLanguage;

    /// <summary>
    /// Inizializza lo store file-based partendo dalla root dell'applicazione ASP.NET.
    /// </summary>
    /// <param name="env">Ambiente host usato per ricavare il percorso assoluto della cartella <c>data</c>.</param>
    /// <param name="localizationOptions">Opzioni di localizzazione tipizzate (lingue supportate e lingua predefinita).</param>
    /// <param name="cache">Cache in memoria condivisa usata da <see cref="FileUtils.ReadStaticFileAsync"/> per i file JSON.</param>
    public FileContentStore(IWebHostEnvironment env, IOptions<LocalizationOptions> localizationOptions, IMemoryCache cache)
    {
        _cache = cache;
        _dataPath = Path.Combine(env.ContentRootPath, "data");
        _generatorsPath = Path.Combine(_dataPath, "generators");

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
    /// Recupera il profilo legale localizzato dal file <c>irl.json</c>.
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
    /// <remarks>
    /// Il file <c>irl.json</c> puo' contenere oggetti localizzati del tipo <c>{ "it": ..., "en": ... }</c>.
    /// La risoluzione effettiva e' delegata a <see cref="FileUtils.LocalizedJsonDeserializer"/>.
    /// </remarks>
    public async Task<UniversalLegalModel> GetProfileAsync(string language, CancellationToken cancellationToken = default)
    {
        return new UniversalLegalModel();
    }

    /// <inheritdoc />
    public async Task<List<GeneratorData>> GetGeneratorsAsync(CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(_generatorsPath))
            return [];

        var generators = new List<GeneratorData>();
        foreach (var file in Directory.GetFiles(_generatorsPath, "*.json"))
        {
            var slug = Path.GetFileNameWithoutExtension(file);
            if (slug == SharedSlug) continue;

            var generator = await GetGeneratorAsync(slug, cancellationToken);
            if (generator is not null)
                generators.Add(generator);
        }
        return generators.OrderBy(g => g.Info?.Order ?? 999).ToList();
    }

    /// <inheritdoc />
    public Task<GeneratorData?> GetGeneratorAsync(string slug, CancellationToken cancellationToken = default)
    {
        // "shared" è raggiungibile solo via GetSharedDataAsync: non deve apparire come generatore.
        if (slug == SharedSlug)
            return Task.FromResult<GeneratorData?>(null);
        return LoadGeneratorAsync(slug, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<SharedData> GetSharedDataAsync(CancellationToken cancellationToken = default)
    {
        var shared = await LoadGeneratorAsync(SharedSlug, cancellationToken);
        if (shared is null)
            return new SharedData([], [], [], []);

        return new SharedData(
            shared.FlatLists,
            shared.PolicyGroups ?? [],
            shared.ComposedLists ?? [],
            shared.AgeAliases ?? []);
    }

    // Lettura cacheata + deserializzazione di un file di data/generators/.
    // Slug inesistente (o non valido) → null: è il contratto dell'interfaccia,
    // la NotFoundException di FileUtils resta un dettaglio interno.
    private async Task<GeneratorData?> LoadGeneratorAsync(string slug, CancellationToken cancellationToken)
    {
        if (!SlugRx.IsMatch(slug))
            return null;

        string json;
        try
        {
            json = await FileUtils.ReadStaticFileAsync($"generators/{slug}", _dataPath, _cache, cancellationToken: cancellationToken);
        }
        catch (NotFoundException)
        {
            return null;
        }
        catch (DirectoryNotFoundException)
        {
            // FileUtils traduce solo il file mancante; la cartella mancante arriva grezza.
            return null;
        }

        var generator = JsonSerializer.Deserialize<GeneratorData>(json, EngineJson.Web);
        if (generator is null) return null;
        generator.Slug = slug;
        return generator;
    }
}
