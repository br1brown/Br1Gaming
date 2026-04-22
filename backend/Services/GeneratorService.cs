using Backend.Infrastructure;
using Backend.Models;
using System.Text.RegularExpressions;

namespace Backend.Services;

/// <summary>
/// Servizio principale per la generazione dinamica di testo. 
/// Orchesta l'aggregazione di uno o più generatori (JSON), fonde i loro dizionari e regole, 
/// e compone testi rispettando vincoli strutturali e policy di unicità.
/// </summary>
public class GeneratorService(IContentStore store)
{
    private readonly IContentStore _store = store;

    // ── Cache dei Generatori ─────────────────────────────────────────
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, RuntimeGenerator> _generatorCache = new();

    /// <summary>
    /// Svuota forzatamente la cache dei generatori (da richiamare quando si ricompilano i file).
    /// </summary>
    public static void ClearCache() => _generatorCache.Clear();

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

        //genero e pulisco
        var raw_text = ComposeText(generator);
        string textMD = ArmonizzaTesto(raw_text);

        // Trasforma MD in HTML base (molto leggero)
        string ToHtml(string md)
        {
            var res = md;
            res = Regex.Replace(res, @"^#\s+(.*)$", "<h1>$1</h1>", RegexOptions.Multiline);
            res = Regex.Replace(res, @"\*\*(.*)\*\*", "<strong>$1</strong>");
            res = Regex.Replace(res, @"\[([^\]]+)\]\(([^\)]+)\)", "<a href='$2'>$1</a>");
            return res.Replace("\n", "<br />");
        }

        // Pulisce il MD per avere solo testo normale
        string ToPlain(string md)
        {
            var res = md;
            res = Regex.Replace(res, @"\[([^\]]+)\]\([^\)]+\)", "$1"); // Rimuove link tenendo il testo
            res = Regex.Replace(res, @"#+\s+", "");                    // Rimuove i cancelletti dei titoli
            res = Regex.Replace(res, @"(\*\*|__|\*|_|`)", "");         // Rimuove formattazione e backtick
            return res.Trim();
        }

        return new GenerationResult(ToPlain(textMD), textMD, ToHtml(textMD));
    }
    /// <summary>
    /// Struttura transiente (in-memory) che agisce da Super-Generatore dopo il merging di tutti gli slug.
    /// </summary>
    private record RuntimeGenerator(
        GeneratorData.GenerationSettings Settings,
        string? Apertura,
        string? Chiusura,
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

        var cacheKey = string.Join("|", slugs);
        if (_generatorCache.TryGetValue(cacheKey, out var cachedGenerator))
            return cachedGenerator;

        var instances = new List<GeneratorData>();
        foreach (var slugName in slugs)
        {
            var generatorData = await _store.GetGeneratorAsync(slugName);
            if (generatorData != null) instances.Add(generatorData);
        }

        if (instances.Count == 0)
            throw new NotFoundException($"Generatori non trovati: {string.Join(", ", slugs)}");

        var master = instances[0];


        // Determina il numero minimo e massimo di frasi confrontando tutti i generatori richiesti.
        // Viene selezionato il valore massimo tra i generatori per garantire spazio sufficiente a tutti i contenuti.
        var globalMin = instances.Max(instance => instance.PhraseSettings?.MinPhrases ?? 1);
        var globalMax = instances.Max(instance => instance.PhraseSettings?.MaxPhrases ?? globalMin);
        var masterSettings = master.PhraseSettings ?? new GeneratorData.GenerationSettings { MinPhrases = globalMin, MaxPhrases = globalMax, Separators = [". "] };
        var settings = masterSettings with { MinPhrases = globalMin, MaxPhrases = globalMax };


        var shared = await _store.GetSharedDataAsync();

        // Estrae tutte le frasi (Core) dai vari generatori rimuovendo i duplicati
        var frasiGlobali = instances.SelectMany(instance => instance.Core).Distinct().ToList();

        // Compila una lista di regole di immissione obbligatoria per garantire la presenza dei generatori secondari
        var requisitiObbligatori = new List<GeneratorData.RequiredInjectData>();
        for (int i = 0; i < instances.Count; i++)
        {
            if (i == 0 && instances[i].CoreRequired is { Phrases.Count: > 0 } masterReq)
            {
                // Mantiene i requisiti del master se esplicitamente definiti nel file JSON
                requisitiObbligatori.Add(masterReq);
            }
            else if (i > 0 && instances[i].Core.Count > 0)
            {
                if (instances[i].CoreRequired is { Phrases.Count: > 0 } injectReq)
                {
                    // Aggiunge i requisiti specifici di un generatore iniettato
                    requisitiObbligatori.Add(injectReq);
                }
                else
                {
                    // Se non ci sono regole esplicite, assegna una quota proporzionale del testo generato al generatore ospite
                    requisitiObbligatori.Add(new GeneratorData.RequiredInjectData(Math.Max(1, (globalMin + 1) / 2), globalMax / 2, instances[i].Core));
                }
            }
        }

        // Unisce tutte le flatLists (condivise e delle singole istanze)
        var dizionariParole = new Dictionary<string, List<string>>(shared.FlatLists);
        foreach (var (key, sources) in shared.ComposedLists)
        {
            var combined = sources.Where(dizionariParole.ContainsKey).SelectMany(src => dizionariParole[src]).ToList();
            if (combined.Count > 0) dizionariParole[key] = combined;
        }

        foreach (var instance in instances)
        {
            foreach (var (key, list) in instance.FlatLists)
            {
                if (dizionariParole.TryGetValue(key, out var existing))
                    dizionariParole[key] = existing.Concat(list).Distinct().ToList();
                else
                    dizionariParole[key] = list;
            }
        }

        // Policy & Labels & Template string resolving
        var apertura = instances.Select(instance => instance.Apertura).FirstOrDefault(pfx => !string.IsNullOrEmpty(pfx));
        var chiusura = instances.Select(instance => instance.Chiusura).FirstOrDefault(sfx => !string.IsNullOrEmpty(sfx));

        var nomiGruppiEsclusivi = instances
            .Where(instance => instance.ExclusiveGroups != null)
            .SelectMany(instance => instance.ExclusiveGroups!)
            .Distinct()
            .ToList();

        List<List<string>>? gruppiEsclusivi = null;
        if (nomiGruppiEsclusivi.Count > 0)
        {
            gruppiEsclusivi = nomiGruppiEsclusivi
                .Select(name => shared.PolicyGroups.TryGetValue(name, out var tags) ? tags : [name])
                .ToList();
        }

        var etichetteUniche = instances
            .Where(instance => instance.UniqueLabels != null)
            .SelectMany(instance => instance.UniqueLabels!)
            .Distinct()
            .ToList();

        var separatoriCombinati = instances
            .Where(instance => instance.PhraseSettings?.Separators != null)
            .SelectMany(instance => instance.PhraseSettings!.Separators!)
            .Distinct()
            .ToList();

        if (separatoriCombinati.Count > 0)
            settings = settings with { Separators = separatoriCombinati };
        else if (settings.Separators == null || settings.Separators.Count == 0)
            settings = settings with { Separators = [". "] };

        var mappaFasceEta = shared.AgeAliases != null
            ? new Dictionary<string, string>(shared.AgeAliases, StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var finalGenerator = new RuntimeGenerator(
            Settings: settings,
            Apertura: apertura,
            Chiusura: chiusura,
            GlobalCore: frasiGlobali,
            Requirements: requisitiObbligatori,
            FlatLists: dizionariParole,
            ExclusiveGroups: gruppiEsclusivi,
            UniqueLabels: etichetteUniche,
            AgeAliases: mappaFasceEta
        );

        _generatorCache[cacheKey] = finalGenerator;
        return finalGenerator;
    }

    /// <summary>
    /// Funzione guscio per comporre Prefix, Suffix e Body partendo unicamente dal RuntimeGenerator.
    /// </summary>
    /// <param name="gen">L'astrazione di contesto unificato precedentemente generata.</param>
    /// <returns>Il testo testuale flat generato e concatenato.</returns>
    private static string ComposeText(RuntimeGenerator gen)
    {
        var etichetteUsate = new Dictionary<string, HashSet<string>>();
        var testoApertura = ResolveIfPresent(gen.Apertura, gen.FlatLists, gen.AgeAliases, etichetteUsate);
        var testoChiusura = ResolveIfPresent(gen.Chiusura, gen.FlatLists, gen.AgeAliases, etichetteUsate);

        var body = ComposeBody(gen, etichetteUsate);

        if (testoApertura != null && body.Length > 0)
            body = testoApertura + body;

        if (testoChiusura != null)
            body += testoChiusura;

        return body;
    }

    /// <summary>
    /// Nucleo di selezione frasi. Bilancia le iniezioni di required testuali coi fillup generici,
    /// tenendo conto ed evitando stringhe incompatibili o label già presentate.
    /// </summary>
    /// <param name="gen">Il contesto generatore contenente settings globali, Required e Core unificato.</param>
    /// <param name="used">Riferimento al tracciamento in-memory dei campi scartati/utilizzati.</param>
    /// <returns>Lo spezzone di blocchi centrali risolti unito dai separatori.</returns>
    private static string ComposeBody(RuntimeGenerator gen, Dictionary<string, HashSet<string>> etichetteUsate)
    {
        // 1. Pesca della Lunghezza del Testo (Sulla base della griglia globale generata prima)
        var min = gen.Settings.MinPhrases ?? 1;
        var max = gen.Settings.MaxPhrases ?? min;
        var conteggioTotale = min >= max ? min : Random.Shared.Next(min, max + 1);

        // 2. Protezione Anti-Strozzamento
        // Se la somma dei requisiti minimi di tutti i guest (minimoRichiestoTotale) supera sfortunatamente 
        // il numero scelto dal Random, forziamo il conteggioTotale ad ingrandirsi quanto le esigenze.
        var minimoRichiestoTotale = gen.Requirements.Sum(req => req.Min);
        if (conteggioTotale < minimoRichiestoTotale)
        {
            conteggioTotale = minimoRichiestoTotale;
        }

        var frasiSelezionate = new List<string>();
        var etichetteUnicheUsate = new HashSet<string>();
        var gruppiEsclusiviChiusi = new HashSet<int>();

        // Risolve prima le frasi obbligatorie ("Required") provenienti dai generatori iniettati
        foreach (var requisito in gen.Requirements)
        {
            // Calcola quante frasi prelevare per questo requisito senza superare il limite totale
            var limiteMassimo = Math.Max(requisito.Min, Math.Min(requisito.Max, conteggioTotale));
            var obiettivoRequisito = Random.Shared.Next(requisito.Min, limiteMassimo + 1);

            // Mescola le frasi di origine per un'estrazione randomica e non ripetitiva
            var cestoFrasiObbligatorie = ShuffledCopy(requisito.Phrases);

            var aggiuntePerRequisito = 0;
            foreach (var frase in cestoFrasiObbligatorie)
            {
                // Interrompe il ciclo se è stato raggiunto il numero target di frasi per questo requisito
                if (aggiuntePerRequisito >= obiettivoRequisito)
                    break;

                if (frasiSelezionate.Contains(frase) || HasLabelConflict(frase, gen.UniqueLabels, etichetteUnicheUsate) || HasGroupConflict(frase, gen.ExclusiveGroups, gruppiEsclusiviChiusi))
                    continue;

                frasiSelezionate.Add(frase);
                aggiuntePerRequisito++;
                TrackUsedLabels(frase, gen.UniqueLabels, etichetteUnicheUsate);
                TrackUsedGroups(frase, gen.ExclusiveGroups, gruppiEsclusiviChiusi);
            }
        }

        // Riempie il resto del testo pescando casualmente dall'unione di tutte le frasi disponibili (GlobalCore)
        var cestoFrasiRiempimento = ShuffledCopy(gen.GlobalCore);
        foreach (var frase in cestoFrasiRiempimento)
        {
            // Interrompe quando il numero totale desiderato di frasi è stato raggiunto
            if (frasiSelezionate.Count >= conteggioTotale)
                break;

            // Valida la frase ignorandola se è già stata selezionata o se viola policy di unicità e mutua esclusione
            if (frasiSelezionate.Contains(frase) || HasLabelConflict(frase, gen.UniqueLabels, etichetteUnicheUsate) || HasGroupConflict(frase, gen.ExclusiveGroups, gruppiEsclusiviChiusi))
                continue;

            frasiSelezionate.Add(frase);
            TrackUsedLabels(frase, gen.UniqueLabels, etichetteUnicheUsate);
            TrackUsedGroups(frase, gen.ExclusiveGroups, gruppiEsclusiviChiusi);
        }

        // Risolve i placeholder (es. [professioni]) in base ai dizionari finali
        var separatori = gen.Settings.Separators ?? [". "];
        var frasiFinite = frasiSelezionate.Select(spezzoneTesto => ExpandAllPlaceholders(spezzoneTesto, gen.FlatLists, gen.AgeAliases, etichetteUsate)).ToList();

        if (frasiFinite.Count == 0) throw new InvalidOperationException("Impossibile generare il corpo: nessuna frase compatibile trovata (possibile database vuoto o conflitti estremi).");
        if (frasiFinite.Count == 1) return frasiFinite[0];

        // Costruisce il testo estraendo casualmente un separatore diverso per l'intervallo tra ogni frase
        var costruttoreTesto = new System.Text.StringBuilder(frasiFinite[0]);
        for (int indice = 1; indice < frasiFinite.Count; indice++)
        {
            var separatoreCasuale = separatori[Random.Shared.Next(separatori.Count)];
            costruttoreTesto.Append(separatoreCasuale).Append(frasiFinite[indice]);
        }
        return costruttoreTesto.ToString();
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
        labels?.Any(label => phrase.Contains(label) && used.Contains(label)) ?? false;

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
        foreach (var label in labels.Where(phrase.Contains)) used.Add(label);
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
    private static string ExpandPlaceholder(string segnaposto, Dictionary<string, List<string>> dizionariParole, Dictionary<string, string> mappaFasceEta, Dictionary<string, HashSet<string>> etichetteUsate)
    {
        var contenutoSegnaposto = segnaposto[1..^1];
        if (mappaFasceEta.TryGetValue(segnaposto, out var limitiEta))
            return TryPickFromRange(limitiEta[1..^1]) ?? limitiEta;
        if (TryPickFromRange(contenutoSegnaposto) is { } numeroRandom) return numeroRandom;
        if (dizionariParole.TryGetValue(segnaposto, out var paroleDisponibili) && paroleDisponibili.Count > 0)
            return PickUniqueFromList(segnaposto, paroleDisponibili, etichetteUsate);
        return segnaposto;
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
    private static string PickUniqueFromList(string chiave, List<string> parole, Dictionary<string, HashSet<string>> etichetteUsate)
    {
        if (!etichetteUsate.TryGetValue(chiave, out var paroleGiaViste)) etichetteUsate[chiave] = paroleGiaViste = [];
        var paroleDisponibili = parole.Where(v => !paroleGiaViste.Contains(v)).ToList();
        if (paroleDisponibili.Count == 0) { paroleGiaViste.Clear(); paroleDisponibili = parole; }
        var parolaScelta = paroleDisponibili[Random.Shared.Next(paroleDisponibili.Count)];
        paroleGiaViste.Add(parolaScelta);
        return parolaScelta;
    }

    private static string ArmonizzaTesto(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;

        // Prima lettera assoluta in maiuscolo
        text = Regex.Replace(text, @"^([^\p{L}]*)(\p{Ll})",
            m => m.Groups[1].Value + m.Groups[2].Value.ToUpper());

        // Riduce spazi multipli (ma non i newline)
        text = Regex.Replace(text, @"[ \t]+", " ");

        // Rimuove spazi all'inizio e alla fine di ogni riga
        text = Regex.Replace(text, @"^[ \t]+|[ \t]+$", string.Empty, RegexOptions.Multiline);

        // Collassa 3 o più newline in massimo due (mantiene il concetto di paragrafo)
        text = Regex.Replace(text, @"(\r?\n){3,}", "\n\n");

        // Maiuscola dopo la punteggiatura (. ! ? ;) e a inizio riga
        // La regex ora cattura:
        // - Inizio stringa (^)
        // - Dopo i segni . ! ? ; seguiti da spazi o newline
        // - Inizio di una nuova riga dopo un newline
        text = Regex.Replace(text, @"(^|[.!?;]\s+|^[ \t]*)(\p{Ll})",
            m => m.Groups[1].Value + m.Groups[2].Value.ToUpper(),
            RegexOptions.Multiline);

        return text.Trim();
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
