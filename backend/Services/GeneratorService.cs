using System.Text.RegularExpressions;
using Backend.Infrastructure;
using Backend.Models;

namespace Backend.Services;

/// <summary>
/// Servizio principale per la generazione dinamica di testo. 
/// Orchesta l'aggregazione di uno o più generatori (JSON), fonde i loro dizionari e regole, 
/// e compone testi rispettando vincoli strutturali e policy di unicità.
/// </summary>
public class GeneratorService(IContentStore store)
{
    private readonly IContentStore _store = store;

    // ── Cache shared data ────────────────────────────────────────────
    private static SharedData? _sharedCache;
    private static readonly Lock _sharedLock = new();

    /// <summary>
    /// Carica o restituisce dalla memoria cache il file Shared.json contenente le policy globali.
    /// </summary>
    /// <returns>Il modello deserializzato di SharedData.</returns>
    private async Task<SharedData> LoadSharedDataAsync()
    {
        if (_sharedCache is not null) return _sharedCache;
        lock (_sharedLock)
        {
            if (_sharedCache is not null) return _sharedCache;
        }
        var data = await _store.GetSharedDataAsync();
        lock (_sharedLock) { _sharedCache = data; }
        return data;
    }

    /// <summary>
    /// Svuota forzatamente la cache dei file condivisi.
    /// </summary>
    public static void ClearCache() { lock (_sharedLock) { _sharedCache = null; } }

    // ── Slug ──────────────────────────────────────────────────────────
    private const string SlugIncel = "incel";
    private const string SlugMbeb = "mbeb";
    private const string SlugAuto = "auto";
    private const string SlugAntiveg = "antiveg";
    private const string SlugLocali = "locali";

    private static readonly string[] AllSlugs = [SlugIncel, SlugAuto, SlugAntiveg, SlugLocali, SlugMbeb];

    /// <summary>
    /// Ottiene il catalogo di tutti i generatori disponibili ordinati secondo le regole Info.
    /// </summary>
    /// <returns>Lista di GeneratorData configurati.</returns>
    public async Task<List<GeneratorData>> GetCatalogAsync()
    {
        var all = await _store.GetGeneratorsAsync();
        // Ordina per l'ordine definito nel record Info
        return all.Where(i => AllSlugs.Contains(i.Slug))
                  .OrderBy(i => i.Info?.Order ?? 999)
                  .ToList();
    }

    // ── Metodi Pubblici (Il Controller decide la composizione) ───────

    /// <summary>
    /// Genera un testo configurato esclusivamente per il Maschio Bianco Etero Basico (MBEB).
    /// </summary>
    public Task<GenerationResult> GenerateMbebAsync() => GenerateAsync(SlugMbeb);

    /// <summary>
    /// Mbeb "ospita" Incel: Incel viene iniettato obbligatoriamente sfruttando il proprio MinPhrases.
    /// Il testo è primariamente Maschio Basico ma subirà le interiezioni tipiche Incel.
    /// </summary>
    public Task<GenerationResult> GenerateIncelAsync() => GenerateAsync(SlugMbeb, SlugIncel);

    /// <summary>
    /// Genera frasi tematizzate per "Automobilista".
    /// </summary>
    public Task<GenerationResult> GenerateAutoAsync() => GenerateAsync(SlugAuto);

    /// <summary>
    /// Genera frasi tematizzate per "Anti-Vegano".
    /// </summary>
    public Task<GenerationResult> GenerateAntivegAsync() => GenerateAsync(SlugAntiveg);

    /// <summary>
    /// Genera frasi tematizzate per le "Politiche Locali".
    /// </summary>
    public Task<GenerationResult> GenerateLocaliAsync() => GenerateAsync(SlugLocali);

    // ══════════════════════════════════════════════════════════════════
    // MOTORE DI GENERAZIONE DINAMICO
    // ══════════════════════════════════════════════════════════════════

    /// <summary>
    /// Unifica uno o più slugs generazionali e formula un testo dinamico aggregato.
    /// </summary>
    /// <param name="slugs">Elenco degli slug da aggregare (il primo è il Master).</param>
    /// <returns>Il risultato della generazione in triplice formato (Text, Markdown, Html).</returns>
    private async Task<GenerationResult> GenerateAsync(params string[] slugs)
    {
        // Dati Iniziali (Caricamento e Merging Architetturale)
        var generator = await CreateGenerator(slugs);

        // Generazione del testo dal runtime generato (Text Composition Engine)
        var text = ComposeText(generator);

        text = CapitalizeSentences(text);
        return new GenerationResult(text, text, $"<p>{System.Net.WebUtility.HtmlEncode(text)}</p>");
    }

    /// <summary>
    /// Struttura transiente (in-memory) che agisce da Super-Generatore dopo il merging di tutti gli slug.
    /// </summary>
    private record RuntimeGenerator(
        GeneratorData.GenerationSettings Settings,
        string? Prefix,
        string? Suffix,
        List<string> GlobalCore,
        List<GeneratorData.RequiredInjectData> Requirements,
        Dictionary<string, List<string>> FlatLists,
        List<List<string>>? ExclusiveGroups,
        List<string> UniqueLabels,
        Dictionary<string, string> AgeAliases
    );

    /// <summary>
    /// Fonde assieme le logiche di n generatori distinti in un unico RuntimeGenerator globale.
    /// </summary>
    /// <param name="slugs">Identifier dei vari generatori JSON da analizzare e unire.</param>
    /// <returns>L'istanza astratta di RuntimeGenerator pronta a fornire gli asset al composer.</returns>
    private async Task<RuntimeGenerator> CreateGenerator(params string[] slugs)
    {
        if (slugs == null || slugs.Length == 0)
            throw new ArgumentException("Almeno uno slug è richiesto.");

        var instances = new List<GeneratorData>();
        foreach (var s in slugs)
        {
            var g = await _store.GetGeneratorAsync(s);
            if (g != null) instances.Add(g);
        }

        if (instances.Count == 0)
            throw new NotFoundException($"Generatori non trovati: {string.Join(", ", slugs)}");

        var master = instances[0];


        // ══════════════════════════════════════════════════════════════════
        // CONFIGURAZIONE DEL BERSAGLIO GLOBALE (Limiti Min e Max testuali)
        // ══════════════════════════════════════════════════════════════════
        // Mettiamo a confronto il "MinPhrases" e "MaxPhrases" di TUTTI i generatori fusi.
        // ESTRAIAMO IL PIÙ ALTO TRA TUTTI. Questo fa sì che la frase non venga "strozzata" 
        // dal Master se un ospite iniettato richiede uno spazio maggiore per esprimersi.
        var globalMin = instances.Max(i => i.PhraseSettings?.MinPhrases ?? 1);
        var globalMax = instances.Max(i => i.PhraseSettings?.MaxPhrases ?? globalMin);
        var masterSettings = master.PhraseSettings ?? new GeneratorData.GenerationSettings(globalMin, globalMax, [". "]);
        var settings = masterSettings with { MinPhrases = globalMin, MaxPhrases = globalMax };


        var shared = await LoadSharedDataAsync();

        // Combina core generale
        var globalCore = instances.SelectMany(i => i.Core).Distinct().ToList();

        // ══════════════════════════════════════════════════════════════════
        // DEFINIZIONE OBBLIGATORIETA' (Regole Strict per gli ospiti iniettati)
        // ══════════════════════════════════════════════════════════════════
        // Compiliamo un registro ("requirements") contenente tutte le regole non derogabili.
        var requirements = new List<GeneratorData.RequiredInjectData>();
        for (int i = 0; i < instances.Count; i++)
        {
            if (i == 0 && instances[i].CoreRequired is { Phrases.Count: > 0 } masterReq)
            {
                // Se il Master aveva una regola formale ("Required" dal JSON), la si protegge
                requirements.Add(masterReq);
            }
            else if (i > 0 && instances[i].Core.Count > 0)
            {
                // Per GUEST INIETTATI (i > 0) si crea il vincolo logico:
                if (instances[i].CoreRequired is { Phrases.Count: > 0 } injectReq)
                {
                    requirements.Add(injectReq);
                }
                else
                {
                    // L'obbligatorietà "aperta" per fargli spazio. 
                    // Minimo: esattamente la metà del conteggio minimo globale +1 per assicurargli posto.
                    // Massimo: scalato a metà del globale per non fagocitare interamente il testo a scapito del Master.
                    requirements.Add(new GeneratorData.RequiredInjectData(Math.Max(1, (globalMin +1 )/ 2), globalMax / 2, instances[i].Core));
                }
            }
        }

        // Unisce tutte le flatLists (condivise e delle singole istanze)
        var lists = new Dictionary<string, List<string>>(shared.FlatLists);
        foreach (var (key, sources) in shared.ComposedLists)
        {
            var combined = sources.Where(lists.ContainsKey).SelectMany(src => lists[src]).ToList();
            if (combined.Count > 0) lists[key] = combined;
        }

        foreach (var instance in instances)
        {
            foreach (var (key, list) in instance.FlatLists)
            {
                if (lists.TryGetValue(key, out var existing))
                    lists[key] = existing.Concat(list).Distinct().ToList();
                else
                    lists[key] = list;
            }
        }

        // Policy & Labels & Template string resolving
        var prefix = instances.Select(i => i.Prefix).FirstOrDefault(p => !string.IsNullOrEmpty(p));
        var suffix = instances.Select(i => i.Suffix).FirstOrDefault(s => !string.IsNullOrEmpty(s));

        var combinedExclusiveGroupNames = instances
            .Where(i => i.ExclusiveGroups != null)
            .SelectMany(i => i.ExclusiveGroups!)
            .Distinct()
            .ToList();

        List<List<string>>? exclusiveGroups = null;
        if (combinedExclusiveGroupNames.Count > 0)
        {
            exclusiveGroups = combinedExclusiveGroupNames
                .Select(name => shared.PolicyGroups.TryGetValue(name, out var tags) ? tags : [name])
                .ToList();
        }

        var uniqueLabels = instances
            .Where(i => i.UniqueLabels != null)
            .SelectMany(i => i.UniqueLabels!)
            .Distinct()
            .ToList();

        var combinedSeparators = instances
            .Where(i => i.PhraseSettings?.Separators != null)
            .SelectMany(i => i.PhraseSettings!.Separators!)
            .Distinct()
            .ToList();

        if (combinedSeparators.Count > 0)
            settings = settings with { Separators = combinedSeparators };
        else if (settings.Separators == null || settings.Separators.Count == 0)
            settings = settings with { Separators = [". "] };

        return new RuntimeGenerator(
            Settings: settings,
            Prefix: prefix,
            Suffix: suffix,
            GlobalCore: globalCore,
            Requirements: requirements,
            FlatLists: lists,
            ExclusiveGroups: exclusiveGroups,
            UniqueLabels: uniqueLabels,
            AgeAliases: shared.AgeAliases ?? []
        );
    }

    /// <summary>
    /// Funzione guscio per comporre Prefix, Suffix e Body partendo unicamente dal RuntimeGenerator.
    /// </summary>
    /// <param name="gen">L'astrazione di contesto unificato precedentemente generata.</param>
    /// <returns>Il testo testuale flat generato e concatenato.</returns>
    private static string ComposeText(RuntimeGenerator gen)
    {
        var used = new Dictionary<string, HashSet<string>>();
        var prefix = ResolveIfPresent(gen.Prefix, gen.FlatLists, gen.AgeAliases, used);
        var suffix = ResolveIfPresent(gen.Suffix, gen.FlatLists, gen.AgeAliases, used);

        var body = ComposeBody(gen, used);

        if (prefix != null && body.Length > 0)
            body = prefix + ", " + char.ToLower(body[0]) + body[1..];

        if (suffix != null)
            body += suffix;

        return body;
    }

    /// <summary>
    /// Nucleo di selezione frasi. Bilancia le iniezioni di required testuali coi fillup generici,
    /// tenendo conto ed evitando stringhe incompatibili o label già presentate.
    /// </summary>
    /// <param name="gen">Il contesto generatore contenente settings globali, Required e Core unificato.</param>
    /// <param name="used">Riferimento al tracciamento in-memory dei campi scartati/utilizzati.</param>
    /// <returns>Lo spezzone di blocchi centrali risolti unito dai separatori.</returns>
    private static string ComposeBody(RuntimeGenerator gen, Dictionary<string, HashSet<string>> used)
    {
        // 1. Pesca della Lunghezza del Testo (Sulla base della griglia globale generata prima)
        var min = gen.Settings.MinPhrases ?? 1;
        var max = gen.Settings.MaxPhrases ?? min;
        var totalCount = min >= max ? min : Random.Shared.Next(min, max + 1);

        // 2. Protezione Anti-Strozzamento
        // Se la somma dei requisiti minimi di tutti i guest (totalRequiredMin) supera sfortunatamente 
        // il numero scelto dal Random, forziamo il totalCount ad ingrandirsi quanto le esigenze.
        var totalRequiredMin = gen.Requirements.Sum(req => req.Min);
        if (totalCount < totalRequiredMin)
        {
            totalCount = totalRequiredMin;
        }

        var selected = new List<string>();
        var usedLabels = new HashSet<string>();
        var closedGroups = new HashSet<int>();

        // ══════════════════════════════════════════════════════════════════
        // FASE 1: INGRESSO DALLA PORTA VIP (Il Required Ospite)
        // ══════════════════════════════════════════════════════════════════
        // Prima ancora di mischiare i calderoni, leggiamo le esigenze d'obbligo (di norma gli ospiti iniettati).
        foreach (var req in gen.Requirements)
        {
            // Troviamo il numero esatto da estrarre (rispettando il tetto del totalCount)
            var maxLimit = Math.Max(req.Min, Math.Min(req.Max, totalCount));
            var targetReq = Random.Shared.Next(req.Min, maxLimit + 1);
            
            // Pesca SOLO DALLA "SCATOLA" ORIGINARIA (Il Core puro del guest iniettato, non il mischiotto)
            var reqPool = ShuffledCopy(req.Phrases);

            var addedForReq = 0;
            foreach (var p in reqPool)
            {
                // Appena abbiamo rubato le frasi minime/massime previste, blocchiamo l'estrazione.
                if (addedForReq >= targetReq)
                    break;

                if (selected.Contains(p) || HasLabelConflict(p, gen.UniqueLabels, usedLabels) || HasGroupConflict(p, gen.ExclusiveGroups, closedGroups))
                    continue;

                selected.Add(p);
                addedForReq++;
                TrackUsedLabels(p, gen.UniqueLabels, usedLabels);
                TrackUsedGroups(p, gen.ExclusiveGroups, closedGroups);
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // FASE 2: I TAPPABUCHI (Riempimento dal grande Calderone)
        // ══════════════════════════════════════════════════════════════════
        // Adesso che i VIP della FASE 1 si sono seduti ai loro posti di diritto,
        // mischiamo TUTTE le frasi (GlobalCore = Master + Injected) e peschiamo
        // casualmente per arrivare al "totalCount" prestabilito in cima alla funzione.
        var fillPool = ShuffledCopy(gen.GlobalCore);
        foreach (var p in fillPool)
        {
            // Appena arriviamo a riempire lo slot prefissato, l'organico è al completo e ci fermiamo.
            if (selected.Count >= totalCount)
                break;

            // L'integrità è assicurata: se la casualità rincappa in una frase del VIP (ospite) che
            // avevamo GIÀ posizionato nella Fase 1, non verrà sdoppiata (selected.Contains la scavalca).
            if (selected.Contains(p) || HasLabelConflict(p, gen.UniqueLabels, usedLabels) || HasGroupConflict(p, gen.ExclusiveGroups, closedGroups))
                continue;

            selected.Add(p);
            TrackUsedLabels(p, gen.UniqueLabels, usedLabels);
            TrackUsedGroups(p, gen.ExclusiveGroups, closedGroups);
        }

        var separators = gen.Settings.Separators ?? [". "];
        var sep = separators[Random.Shared.Next(separators.Count)];

        return string.Join(sep, selected.Select(t => ExpandAllPlaceholders(t, gen.FlatLists, gen.AgeAliases, used)));
    }

    // ── Logica di Supporto (Policy e Espansione) ─────────────────────

    /// <summary>
    /// Verifica se una frase candidata vìola la policy di unicità menzionando una label già usata in precedenza.
    /// </summary>
    /// <param name="phrase">La frase da validare.</param>
    /// <param name="labels">La collezione di Unique Labels ammesse/tracciate.</param>
    /// <param name="used">Il set che mantiene memoria di tutti i tag UniqueLabel già impiegati.</param>
    /// <returns>True se c'è confitto, false se è ammessa.</returns>
    private static bool HasLabelConflict(string phrase, List<string>? labels, HashSet<string> used) =>
        labels?.Any(l => phrase.Contains(l) && used.Contains(l)) ?? false;

    /// <summary>
    /// Verifica se una frase candidata richiama un tag appartenente a un gruppo logico d'esclusione già bloccato.
    /// </summary>
    /// <param name="phrase">La frase da validare.</param>
    /// <param name="groups">Elenco di Policy Groups mutuamente esclusivi.</param>
    /// <param name="closed">Indici dei gruppi matematicamente già chiusi/vietati per questa route.</param>
    /// <returns>True se provoca reazioni di esclusione incrociata, false se pulito.</returns>
    private static bool HasGroupConflict(string phrase, List<List<string>>? groups, HashSet<int> closed)
    {
        if (groups is null) return false;
        for (var i = 0; i < groups.Count; i++)
            if (closed.Contains(i) && groups[i].Any(tag => phrase.Contains(tag))) return true;
        return false;
    }

    /// <summary>
    /// Registra l'uso effettivo di Label esclusive per bloccare future iniezioni rindondanti.
    /// </summary>
    /// <param name="phrase">La frase appena confermata in output.</param>
    /// <param name="labels">Lista potenziale di limitazioni.</param>
    /// <param name="used">Modifica per Ref i flag tracciati.</param>
    private static void TrackUsedLabels(string phrase, List<string>? labels, HashSet<string> used)
    {
        if (labels is null) return;
        foreach (var l in labels.Where(phrase.Contains)) used.Add(l);
    }

    /// <summary>
    /// Registra l'uso effettivo di tag afferenti a determinati Exclusive Groups, sigillandoli.
    /// </summary>
    private static void TrackUsedGroups(string phrase, List<List<string>>? groups, HashSet<int> closed)
    {
        if (groups is null) return;
        for (var i = 0; i < groups.Count; i++)
            if (groups[i].Any(tag => phrase.Contains(tag))) closed.Add(i);
    }

    /// <summary>
    /// Prova a risolvere subito segnaposti nei blocchi come Prefix/Suffix. Restituisce Null in caso di template vuoto.
    /// </summary>
    private static string? ResolveIfPresent(string? template, Dictionary<string, List<string>> lists, Dictionary<string, string> ageAliases, Dictionary<string, HashSet<string>> used)
    {
        if (string.IsNullOrEmpty(template)) return null;
        return ExpandAllPlaceholders(template, lists, ageAliases, used);
    }

    private static readonly Regex PlaceholderRx = new(@"\[[^\]]+\]", RegexOptions.Compiled);
    private static readonly Regex RangeRx = new(@"^\d+-\d+$", RegexOptions.Compiled);

    /// <summary>
    /// Motore di iterazione di sostituzione: cicla sul testo finché non ci sono più tag flat da sostituire.
    /// Esegue massimo 5 passate per supportare stringhe parzialmente annidate/annesse proteggendosi dai loop infini.
    /// </summary>
    /// <param name="template">La frase originale con i tag.</param>
    /// <param name="lists">Il dizionario delle parole supportate dal runtime.</param>
    /// <param name="ageAliases">La mappa di corrispondenza delle fasce d'età (es. [bambino]: [5-12]).</param>
    /// <param name="used">Lo scope che memorizza cosa è già stato sorteggiato univocamente.</param>
    /// <returns>La catena testuale rimpiazzata puramente umana.</returns>
    private static string ExpandAllPlaceholders(string template, Dictionary<string, List<string>> lists, Dictionary<string, string> ageAliases, Dictionary<string, HashSet<string>> used)
    {
        var text = template;
        for (var pass = 0; pass < 5; pass++)
        {
            var expanded = PlaceholderRx.Replace(text, m => ExpandPlaceholder(m.Value, lists, ageAliases, used));
            if (expanded == text) break;
            text = expanded;
        }
        return text;
    }

    /// <summary>
    /// Smista la risoluzione reale del singolo placeholder individuato dalle Regex testuali in ExpandAllPlaceholders.
    /// Converte range logici o attinge ai flat dictionary unici.
    /// </summary>
    /// <param name="placeholder">Il nome del tag esatto inclusi brackets.</param>
    /// <param name="lists">L'elenco in cui ricercare.</param>
    /// <param name="ageAliases">La mappa di corrispondenza delle fasce d'età.</param>
    /// <param name="used">Collezione di riferimento delle estrazioni precedenti per l'unicità.</param>
    /// <returns>La stringa pescata randomicamente.</returns>
    private static string ExpandPlaceholder(string placeholder, Dictionary<string, List<string>> lists, Dictionary<string, string> ageAliases, Dictionary<string, HashSet<string>> used)
    {
        var inner = placeholder[1..^1];
        if (ageAliases.TryGetValue(placeholder, out var rangeTarget))
            return TryPickFromRange(rangeTarget[1..^1]) ?? rangeTarget;
        if (TryPickFromRange(inner) is { } number) return number;
        if (lists.TryGetValue(placeholder, out var list) && list.Count > 0)
            return PickUniqueFromList(placeholder, list, used);
        return placeholder;
    }

    /// <summary>
    /// Parsing dei limiti temporali/numerici all'interno di un tag (es. 15-26).
    /// </summary>
    private static string? TryPickFromRange(string inner)
    {
        if (!RangeRx.IsMatch(inner)) return null;
        var dash = inner.IndexOf('-');
        var min = int.Parse(inner[..dash]);
        var max = int.Parse(inner[(dash + 1)..]);
        return Random.Shared.Next(min, max + 1).ToString();
    }

    /// <summary>
    /// Garantisce l'estrazione non-ripetuta e univoca tramite l'impostazione e ricalcolo dei Set "used".
    /// Se tutto l'array della flatList viene esplorato integralmente, fa il flush e resetta la randomizzazione.
    /// </summary>
    private static string PickUniqueFromList(string key, List<string> list, Dictionary<string, HashSet<string>> used)
    {
        if (!used.TryGetValue(key, out var seen)) used[key] = seen = [];
        var available = list.Where(v => !seen.Contains(v)).ToList();
        if (available.Count == 0) { seen.Clear(); available = list; }
        var chosen = available[Random.Shared.Next(available.Count)];
        seen.Add(chosen);
        return chosen;
    }

    /// <summary>
    /// Normalizza i caratteri finali e fissa automaticamente le maiuscole ad inizio paragrafo o pre-punteggiatura.
    /// </summary>
    private static string CapitalizeSentences(string text)
    {
        if (text.Length == 0) return text;
        text = char.ToUpper(text[0]) + text[1..];
        return Regex.Replace(text, @"(?<=[.!?;]\s)([a-z])", m => m.Value.ToUpper());
    }

    /// <summary>
    /// Implementa in-place l'algoritmo standard Fisher-Yates per randomizzare robustamente l'ordinamento in una lista in clonata.
    /// </summary>
    private static List<string> ShuffledCopy(List<string> source)
    {
        var list = source.ToList();
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
        return list;
    }
}

/// <summary>
/// Prodotto finale di un ciclo di generazione. Invia tre varianti del risultato richiesto all'entrypoint.
/// </summary>
public record GenerationResult(string Text, string Markdown, string Html);