using System.Globalization;
using System.Text.RegularExpressions;
using Backend.Engine;
using Backend.Models;
using Backend.Models.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Backend.Services;

/// <summary>
/// Pagina landing "EteroInAffitto": il contenuto vive in <c>data/landing-etero-in-affitto.json</c>,
/// con le stringhe che diventano <c>{ "it": "…", "en": "…" }</c> quando si aggiunge una lingua. La
/// risoluzione della lingua è quella dell'Engine (<see cref="FileUtils.LocalizedJsonDeserializer"/>, la
/// stessa di <c>identity.json</c>): qui si legge, si deserializza nelle sezioni tipizzate e si controlla
/// che il file sia coerente, così un errore di contenuto ferma subito invece di rompere la pagina.
/// </summary>
public sealed partial class LandingService
{
    private const string EteroInAffittoFile = "landing-etero-in-affitto";

    /// <summary>Una classe Font Awesome e nient'altro: <c>fa-solid fa-notes-medical</c>. Il frontend applica la stessa regola, perché l'icona finisce in un attributo <c>class</c>.</summary>
    [GeneratedRegex(@"^fa-(solid|regular|brands) fa-[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex FontAwesomeIcon();

    private readonly AcquirentiFeed _feed;
    private readonly string _dataPath;
    private readonly IMemoryCache _cache;
    private readonly HashSet<string> _supportedLanguages;
    private readonly string _defaultLanguage;

    /// <summary>Inizializza il servizio con la cartella dati, la cache e le lingue configurate.</summary>
    public LandingService(IWebHostEnvironment env, IOptions<LocalizationOptions> localizationOptions, IMemoryCache cache, AcquirentiFeed feed)
    {
        _feed = feed;
        _cache = cache;
        _dataPath = Path.Combine(env.ContentRootPath, "data");
        var loc = localizationOptions.Value;
        _supportedLanguages = new HashSet<string>(
            loc.SupportedLanguages.Select(l => CultureInfo.GetCultureInfo(l).TwoLetterISOLanguageName),
            StringComparer.OrdinalIgnoreCase);
        _defaultLanguage = CultureInfo.GetCultureInfo(loc.DefaultLanguage).TwoLetterISOLanguageName;
    }

    /// <summary>La landing di EteroInAffitto nella lingua richiesta (ripiego sul default se manca).</summary>
    public async Task<LandingPageDto> GetEteroInAffittoAsync(string language, CancellationToken ct = default)
    {
        var json = await FileUtils.ReadStaticFileAsync(EteroInAffittoFile, _dataPath, _cache, cancellationToken: ct);
        var page = new FileUtils.LocalizedJsonDeserializer(_defaultLanguage)
            .Deserialize<LandingPageDto>(json, language, _supportedLanguages);
        Validate(page);
        return Expand(page);
    }

    /// <summary>
    /// Compone le frasi degli acquisti recenti a ogni richiesta: le fisse del JSON più quelle del generatore nascosto
    /// «acquirenti» (<see cref="AcquirentiFeed"/>), a cui si passano i nomi dei piani a pagamento letti dalla pagina stessa,
    /// poi ne mescola l'ordine. La pagina ha sempre gli stessi contenuti, ma ogni visita legge acquirenti diversi.
    /// </summary>
    private LandingPageDto Expand(LandingPageDto page)
    {
        var piani = page.Sections.OfType<PricingSection>().SelectMany(p => p.Plans).Where(p => p.Checkout is not null).Select(p => p.Name).ToArray();

        var sections = page.Sections.Select(section =>
        {
            if (section is not PressureSection { Purchases: { } acquisti } pressure) return section;
            IEnumerable<string> frasi = [.. acquisti.Messages ?? [], .. acquisti.Generate > 0 ? _feed.Generate(acquisti.Generate, piani) : []];
            return pressure with { Purchases = acquisti with { Messages = [.. frasi.OrderBy(_ => Random.Shared.Next())] } };
        }).ToList();
        return page with { Sections = sections };
    }

    /// <summary>Invarianti che il tipo non può esprimere: id di sezione unici (sono ancore HTML) e, per ogni piano, esattamente uno fra dialogo e checkout.</summary>
    private static void Validate(LandingPageDto page)
    {
        var duplicate = page.Sections.GroupBy(s => s.Id).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
            throw new InvalidDataException($"{EteroInAffittoFile}.json: id di sezione duplicato '{duplicate.Key}'.");

        foreach (var plan in page.Sections.OfType<PricingSection>().SelectMany(p => p.Plans).Where(p => (p.Dialog is null) == (p.Checkout is null)))
            throw new InvalidDataException($"{EteroInAffittoFile}.json: il piano '{plan.Id}' deve avere o 'dialog' o 'checkout', non entrambi né nessuno.");

        foreach (var plan in page.Sections.OfType<PricingSection>().SelectMany(p => p.Plans).Where(p => p.Viewers is { } v && (v.Min < 0 || v.Max < v.Min || !v.Text.Contains("{0}"))))
            throw new InvalidDataException($"{EteroInAffittoFile}.json: il piano '{plan.Id}' ha 'viewers' non valido (servono 0 <= min <= max e un testo con {{0}}).");

        foreach (var pressure in page.Sections.OfType<PressureSection>())
        {
            if (pressure.Countdown is { } c && (c.Minutes < 1 || !c.Text.Contains("{0}")))
                throw new InvalidDataException($"{EteroInAffittoFile}.json: 'countdown' non valido (servono minutes >= 1 e un testo con {{0}}).");
            if (pressure.Purchases is { Generate: > 0 } && !page.Sections.OfType<PricingSection>().SelectMany(p => p.Plans).Any(p => p.Checkout is not null))
                throw new InvalidDataException($"{EteroInAffittoFile}.json: 'purchases.generate' richiede almeno un piano a pagamento (con 'checkout') nella pagina.");
            if (pressure.Purchases is { } t && ((t.Messages?.Count ?? 0) + t.Generate == 0 || t.IntervalSeconds < 5 || t.Max < 1))
                throw new InvalidDataException($"{EteroInAffittoFile}.json: 'purchases' non valido (servono messages o generate, intervalSeconds >= 5 e max >= 1).");
        }

        foreach (var item in page.Sections.OfType<PricingSection>().SelectMany(p => p.Plans).Where(p => p.Checkout is not null).SelectMany(p => p.Checkout!.Items))
            if (item.NoteIcon is { } icon && !FontAwesomeIcon().IsMatch(icon))
                throw new InvalidDataException($"{EteroInAffittoFile}.json: noteIcon '{icon}' non è una classe Font Awesome (es. \"fa-solid fa-notes-medical\").");

        foreach (var badge in page.Sections.OfType<CtaSection>().SelectMany(c => c.Badges ?? []).Where(b => !FontAwesomeIcon().IsMatch(b.Icon)))
            throw new InvalidDataException($"{EteroInAffittoFile}.json: l'icona del badge '{badge.Label}' non è una classe Font Awesome.");
    }
}
