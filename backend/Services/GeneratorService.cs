using Backend.Models;
using Backend.Store;
using System.Text.RegularExpressions;

namespace Backend.Services;

/// <summary>
/// Servizio principale per la generazione dinamica di testo: catalogo, info e generazione.
/// </summary>
/// <remarks>
/// La superficie pubblica è fatta di wrapper tipizzati per generatore (un metodo ciascuno):
/// i consumer non scrivono mai slug a mano, quindi non possono sbagliarli. Le composizioni
/// tra generatori (es. mbeb che "ospita" incel) restano un dettaglio interno dei wrapper:
/// da fuori si sa solo che Incel funziona in un modo e il Maschio Basico in un altro.
/// La cache dei file JSON vive nello store; qui non c'è stato da invalidare.
/// </remarks>
public class GeneratorService(IContentStore store)
{
    private readonly IContentStore _store = store;

    // ── Slug ── (solo qui: i consumer passano dai wrapper, mai stringhe)
    private const string SlugIncel = "incel";
    private const string SlugMbeb = "mbeb";
    private const string SlugAuto = "auto";
    private const string SlugAntiveg = "antiveg";
    private const string SlugLocali = "locali";

    /// <summary>
    /// Ottiene il catalogo di tutti i generatori disponibili, già ordinato per <c>Info.Order</c>.
    /// </summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    /// <returns>Lista dei generatori configurati su disco.</returns>
    public Task<List<GeneratorData>> GetCatalogAsync(CancellationToken cancellationToken = default)
        => _store.GetGeneratorsAsync(cancellationToken);

    // ── Info (wrapper per generatore, senza caricare l'intero catalogo) ──

    /// <summary>Info del generatore Incel, o <c>null</c> se il file manca.</summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GeneratorData?> GetIncelInfoAsync(CancellationToken cancellationToken = default) => _store.GetGeneratorAsync(SlugIncel, cancellationToken);

    /// <summary>Info del generatore MBEB, o <c>null</c> se il file manca.</summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GeneratorData?> GetMbebInfoAsync(CancellationToken cancellationToken = default) => _store.GetGeneratorAsync(SlugMbeb, cancellationToken);

    /// <summary>Info del generatore Automobilista, o <c>null</c> se il file manca.</summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GeneratorData?> GetAutoInfoAsync(CancellationToken cancellationToken = default) => _store.GetGeneratorAsync(SlugAuto, cancellationToken);

    /// <summary>Info del generatore Anti-Vegano, o <c>null</c> se il file manca.</summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GeneratorData?> GetAntivegInfoAsync(CancellationToken cancellationToken = default) => _store.GetGeneratorAsync(SlugAntiveg, cancellationToken);

    /// <summary>Info del generatore Politiche Locali, o <c>null</c> se il file manca.</summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GeneratorData?> GetLocaliInfoAsync(CancellationToken cancellationToken = default) => _store.GetGeneratorAsync(SlugLocali, cancellationToken);

    // ── Generazione (wrapper per generatore; la composizione è decisa QUI dentro) ──

    /// <summary>
    /// Genera un testo configurato esclusivamente per il Maschio Bianco Etero Basico (MBEB).
    /// </summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GenerationResult> GenerateMbebAsync(CancellationToken cancellationToken = default)
        => GenerateAsync([SlugMbeb], cancellationToken);

    /// <summary>
    /// Genera un testo Incel. Internamente Mbeb "ospita" Incel: Incel viene iniettato
    /// obbligatoriamente sfruttando il proprio MinPhrases — il testo è primariamente
    /// Maschio Basico ma subisce le interiezioni tipiche Incel.
    /// </summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GenerationResult> GenerateIncelAsync(CancellationToken cancellationToken = default)
        => GenerateAsync([SlugMbeb, SlugIncel], cancellationToken);

    /// <summary>Genera frasi tematizzate per "Automobilista".</summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GenerationResult> GenerateAutoAsync(CancellationToken cancellationToken = default)
        => GenerateAsync([SlugAuto], cancellationToken);

    /// <summary>Genera frasi tematizzate per "Anti-Vegano".</summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GenerationResult> GenerateAntivegAsync(CancellationToken cancellationToken = default)
        => GenerateAsync([SlugAntiveg], cancellationToken);

    /// <summary>Genera frasi tematizzate per le "Politiche Locali".</summary>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    public Task<GenerationResult> GenerateLocaliAsync(CancellationToken cancellationToken = default)
        => GenerateAsync([SlugLocali], cancellationToken);

    // ══════════════════════════════════════════════════════════════════
    // MOTORE DI GENERAZIONE DINAMICO
    // ══════════════════════════════════════════════════════════════════

    /// <summary>
    /// Unifica uno o più slug e formula un testo dinamico aggregato (il primo è il Master).
    /// </summary>
    /// <param name="slugs">Elenco degli slug da aggregare (il primo è il Master).</param>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    /// <returns>Il risultato della generazione in triplice formato (Text, Markdown, Html).</returns>
    private async Task<GenerationResult> GenerateAsync(string[] slugs, CancellationToken cancellationToken)
    {
        // Dati Iniziali (Caricamento e Merging Architetturale)
        var generator = await CreateGeneratorAsync(slugs, cancellationToken);

        //genero e pulisco (rigenerando finché non si supera la soglia di peso/rarità, o si esauriscono i tentativi)
        var (raw_text, score) = ComposeBest(generator);
        string textMD = ArmonizzaTesto(raw_text);

        // Pulisce il MD per avere solo testo normale (per speech e condivisione).
        // La resa HTML non si fa qui: il frontend renderizza il Markdown col pipe
        // `markdown` dell'engine, che sanifica l'output.
        string ToPlain(string md)
        {
            var res = md;
            res = Regex.Replace(res, @"\[([^\]]+)\]\([^\)]+\)", "$1"); // Rimuove link tenendo il testo
            res = Regex.Replace(res, @"#+\s+", "");                    // Rimuove i cancelletti dei titoli
            res = Regex.Replace(res, @"(\*\*|__|\*|_|`)", "");         // Rimuove formattazione e backtick
            return res.Trim();
        }

        return new GenerationResult(ToPlain(textMD), textMD, score);
    }
    /// <summary>
    /// Struttura transiente (in-memory) che agisce da Super-Generatore dopo il merging di tutti gli slug.
    /// </summary>
    private record RuntimeGenerator(
        GeneratorData.GenerationSettings Settings,
        string? Apertura,
        string? Chiusura,
        List<ScoredItem> GlobalCore,
        List<GeneratorData.RequiredInjectData> Requirements,
        Dictionary<string, List<ScoredItem>> FlatLists,
        List<List<string>>? ExclusiveGroups,
        List<string> UniqueLabels,
        Dictionary<string, string> AgeAliases
    );

    /// <summary>
    /// Accumulatore del prodotto dei valori degli elementi sostituiti in una singola frase.
    /// <see cref="Product"/> parte da 1 (identità); <see cref="Count"/> conta gli elementi pescati
    /// così da distinguere "nessun elemento" (contributo 0) da "elementi con valore 1".
    /// </summary>
    private sealed class ScoreAccumulator
    {
        public double Product = 1;
        public int Count;
    }

    /// <summary>
    /// Fonde assieme le logiche di n generatori distinti in un unico RuntimeGenerator globale.
    /// </summary>
    /// <param name="slugs">Identifier dei vari generatori JSON da analizzare e unire (il primo è il Master).</param>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato allo store.</param>
    /// <returns>L'istanza astratta di RuntimeGenerator pronta a fornire gli asset al composer.</returns>
    private async Task<RuntimeGenerator> CreateGeneratorAsync(string[] slugs, CancellationToken cancellationToken)
    {
        var instances = new List<GeneratorData>();
        foreach (var slugName in slugs)
        {
            var generatorData = await _store.GetGeneratorAsync(slugName, cancellationToken);
            if (generatorData != null) instances.Add(generatorData);
        }

        // Lo slug Master è il NOME della risorsa: finisce in {0} del messaggio localizzato.
        if (instances.Count == 0)
            throw new NotFoundException(slugs[0]);

        var master = instances[0];


        // Determina il numero minimo e massimo di frasi confrontando tutti i generatori richiesti.
        // Viene selezionato il valore massimo tra i generatori per garantire spazio sufficiente a tutti i contenuti.
        var globalMin = instances.Max(instance => instance.PhraseSettings?.MinPhrases ?? 1);
        var globalMax = instances.Max(instance => instance.PhraseSettings?.MaxPhrases ?? globalMin);
        // Soglia di peso/rarità: opzionale e annullabile. Se nessun generatore la definisce resta null
        // (nessuna soglia); in una composizione vince la più alta tra quelle definite (es. incel ospite
        // alza l'asticella del Maschio Basico).
        var soglieDefinite = instances.Where(instance => instance.PhraseSettings?.MinScore is not null)
                                      .Select(instance => instance.PhraseSettings!.MinScore!.Value)
                                      .ToList();
        double? globalMinScore = soglieDefinite.Count > 0 ? soglieDefinite.Max() : null;
        var masterSettings = master.PhraseSettings ?? new GeneratorData.GenerationSettings { MinPhrases = globalMin, MaxPhrases = globalMax, Separators = [". "] };
        var settings = masterSettings with { MinPhrases = globalMin, MaxPhrases = globalMax, MinScore = globalMinScore };


        var shared = await _store.GetSharedDataAsync(cancellationToken);

        // Estrae tutte le frasi (Core) dai vari generatori rimuovendo i duplicati (per testo, ignorando il punteggio)
        var frasiGlobali = instances.SelectMany(instance => instance.Core).DistinctBy(frase => frase.Text).ToList();

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
        var dizionariParole = new Dictionary<string, List<ScoredItem>>(shared.FlatLists);
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
                    dizionariParole[key] = existing.Concat(list).DistinctBy(parola => parola.Text).ToList();
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

        return new RuntimeGenerator(
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
    }

    /// <summary>
    /// Funzione guscio per comporre Prefix, Suffix e Body partendo unicamente dal RuntimeGenerator.
    /// </summary>
    /// <summary>Tetto di tentativi di rigenerazione quando il testo non raggiunge la soglia di peso/rarità.</summary>
    /// <remarks>Anti-loop: superati i tentativi si restituisce comunque il risultato col punteggio più alto trovato.</remarks>
    private const int MaxComposeAttempts = 30;

    /// <summary>
    /// Compone il testo rispettando la soglia <see cref="GeneratorData.GenerationSettings.MinScore"/>:
    /// rigenera finché il punteggio non la raggiunge, fino a <see cref="MaxComposeAttempts"/> tentativi,
    /// poi tiene il migliore. Senza soglia (0) basta un'unica composizione.
    /// </summary>
    /// <param name="gen">L'astrazione di contesto unificato precedentemente generata.</param>
    /// <returns>Il testo e il punteggio della migliore composizione ottenuta.</returns>
    private static (string Text, double Score) ComposeBest(RuntimeGenerator gen)
    {
        var minScore = gen.Settings.MinScore ?? 0;
        var best = ComposeText(gen);
        for (var attempt = 1; best.Score < minScore && attempt < MaxComposeAttempts; attempt++)
        {
            var candidate = ComposeText(gen);
            if (candidate.Score > best.Score) best = candidate;
        }
        return best;
    }

    /// <param name="gen">L'astrazione di contesto unificato precedentemente generata.</param>
    /// <returns>Il testo flat generato e concatenato, con il relativo peso (rarità/notabilità).</returns>
    private static (string Text, double Score) ComposeText(RuntimeGenerator gen)
    {
        var etichetteUsate = new Dictionary<string, HashSet<string>>();
        // Apertura/chiusura sono cornice: vengono risolte ma NON contribuiscono al punteggio (che resta "core").
        var testoApertura = ResolveIfPresent(gen.Apertura, gen.FlatLists, gen.AgeAliases, etichetteUsate);
        var testoChiusura = ResolveIfPresent(gen.Chiusura, gen.FlatLists, gen.AgeAliases, etichetteUsate);

        var (body, score) = ComposeBody(gen, etichetteUsate);

        if (testoApertura != null && body.Length > 0)
            body = testoApertura + body;

        if (testoChiusura != null)
            body += testoChiusura;

        return (body, score);
    }

    /// <summary>
    /// Nucleo di selezione frasi. Bilancia le iniezioni di required testuali coi fillup generici,
    /// tenendo conto ed evitando stringhe incompatibili o label già presentate.
    /// </summary>
    /// <param name="gen">Il contesto generatore contenente settings globali, Required e Core unificato.</param>
    /// <param name="etichetteUsate">Riferimento al tracciamento in-memory dei campi scartati/utilizzati.</param>
    /// <returns>Lo spezzone di blocchi centrali risolti unito dai separatori, col relativo peso (rarità/notabilità).</returns>
    private static (string Text, double Score) ComposeBody(RuntimeGenerator gen, Dictionary<string, HashSet<string>> etichetteUsate)
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

        var frasiSelezionate = new List<ScoredItem>();
        var testiSelezionati = new HashSet<string>();   // dedup per testo (il punteggio non entra nell'uguaglianza)
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

                if (testiSelezionati.Contains(frase.Text) || HasLabelConflict(frase.Text, gen.UniqueLabels, etichetteUnicheUsate) || HasGroupConflict(frase.Text, gen.ExclusiveGroups, gruppiEsclusiviChiusi))
                    continue;

                frasiSelezionate.Add(frase);
                testiSelezionati.Add(frase.Text);
                aggiuntePerRequisito++;
                TrackUsedLabels(frase.Text, gen.UniqueLabels, etichetteUnicheUsate);
                TrackUsedGroups(frase.Text, gen.ExclusiveGroups, gruppiEsclusiviChiusi);
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
            if (testiSelezionati.Contains(frase.Text) || HasLabelConflict(frase.Text, gen.UniqueLabels, etichetteUnicheUsate) || HasGroupConflict(frase.Text, gen.ExclusiveGroups, gruppiEsclusiviChiusi))
                continue;

            frasiSelezionate.Add(frase);
            testiSelezionati.Add(frase.Text);
            TrackUsedLabels(frase.Text, gen.UniqueLabels, etichetteUnicheUsate);
            TrackUsedGroups(frase.Text, gen.ExclusiveGroups, gruppiEsclusiviChiusi);
        }

        // Risolve i placeholder (es. [professioni]) e accumula il peso (rarità/notabilità) del testo.
        // Per ogni frase: peso = punteggio base della frase + prodotto dei valori degli
        // elementi che ne hanno riempito i segnaposto (0 se la frase non ne ha sostituito nessuno).
        var separatori = gen.Settings.Separators ?? [". "];
        double punteggioTotale = 0;
        var frasiFinite = new List<string>(frasiSelezionate.Count);
        foreach (var frase in frasiSelezionate)
        {
            var acc = new ScoreAccumulator();
            frasiFinite.Add(ExpandAllPlaceholders(frase.Text, gen.FlatLists, gen.AgeAliases, etichetteUsate, acc));
            punteggioTotale += frase.PhraseScore + (acc.Count > 0 ? acc.Product : 0);
        }

        if (frasiFinite.Count == 0) throw new InvalidOperationException("Impossibile generare il corpo: nessuna frase compatibile trovata (possibile database vuoto o conflitti estremi).");
        if (frasiFinite.Count == 1) return (frasiFinite[0], punteggioTotale);

        // Costruisce il testo estraendo casualmente un separatore diverso per l'intervallo tra ogni frase
        var costruttoreTesto = new System.Text.StringBuilder(frasiFinite[0]);
        for (int indice = 1; indice < frasiFinite.Count; indice++)
        {
            var separatoreCasuale = separatori[Random.Shared.Next(separatori.Count)];
            costruttoreTesto.Append(separatoreCasuale).Append(frasiFinite[indice]);
        }
        return (costruttoreTesto.ToString(), punteggioTotale);
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
            if (closed.Contains(i) && groups[i].Any(tag => phrase.Contains("[" + tag + "]"))) return true;
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
            if (groups[i].Any(tag => phrase.Contains("[" + tag + "]"))) closed.Add(i);
    }

    /// <summary>
    /// Prova a risolvere subito segnaposti nei blocchi come Prefix/Suffix. Restituisce Null in caso di template vuoto.
    /// </summary>
    private static string? ResolveIfPresent(string? template, Dictionary<string, List<ScoredItem>> lists, Dictionary<string, string> ageAliases, Dictionary<string, HashSet<string>> used)
    {
        if (string.IsNullOrEmpty(template)) return null;
        // Accumulatore usa-e-getta: apertura/chiusura non concorrono al punteggio.
        return ExpandAllPlaceholders(template, lists, ageAliases, used, new ScoreAccumulator());
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
    /// <param name="acc">Accumulatore del prodotto dei valori degli elementi sostituiti.</param>
    /// <returns>La catena testuale rimpiazzata puramente umana.</returns>
    private static string ExpandAllPlaceholders(string template, Dictionary<string, List<ScoredItem>> lists, Dictionary<string, string> ageAliases, Dictionary<string, HashSet<string>> used, ScoreAccumulator acc)
    {
        var text = template;
        for (var pass = 0; pass < 5; pass++)
        {
            var expanded = PlaceholderRx.Replace(text, m => ExpandPlaceholder(m.Value, lists, ageAliases, used, acc));
            if (expanded == text) break;
            text = expanded;
        }
        return text;
    }

    /// <summary>
    /// Smista la risoluzione reale del singolo placeholder individuato dalle Regex testuali in ExpandAllPlaceholders.
    /// Converte range logici o attinge ai flat dictionary unici.
    /// </summary>
    /// <param name="segnaposto">Il nome del tag esatto inclusi brackets.</param>
    /// <param name="dizionariParole">L'elenco in cui ricercare.</param>
    /// <param name="mappaFasceEta">La mappa di corrispondenza delle fasce d'età.</param>
    /// <param name="etichetteUsate">Collezione di riferimento delle estrazioni precedenti per l'unicità.</param>
    /// <param name="acc">Accumulatore del prodotto dei valori degli elementi sostituiti.</param>
    /// <returns>La stringa pescata randomicamente.</returns>
    private static string ExpandPlaceholder(string segnaposto, Dictionary<string, List<ScoredItem>> dizionariParole, Dictionary<string, string> mappaFasceEta, Dictionary<string, HashSet<string>> etichetteUsate, ScoreAccumulator acc)
    {
        var contenutoSegnaposto = segnaposto[1..^1];
        // Range ed età producono numeri, non elementi con punteggio: non concorrono al prodotto.
        if (mappaFasceEta.TryGetValue(contenutoSegnaposto, out var limitiEta))
            return TryPickFromRange(limitiEta[1..^1]) ?? limitiEta;
        if (TryPickFromRange(contenutoSegnaposto) is { } numeroRandom) return numeroRandom;
        if (dizionariParole.TryGetValue(contenutoSegnaposto, out var paroleDisponibili) && paroleDisponibili.Count > 0)
            return PickUniqueFromList(contenutoSegnaposto, paroleDisponibili, etichetteUsate, acc);
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
    private static string PickUniqueFromList(string chiave, List<ScoredItem> parole, Dictionary<string, HashSet<string>> etichetteUsate, ScoreAccumulator acc)
    {
        if (!etichetteUsate.TryGetValue(chiave, out var paroleGiaViste)) etichetteUsate[chiave] = paroleGiaViste = [];
        var paroleDisponibili = parole.Where(v => !paroleGiaViste.Contains(v.Text)).ToList();
        if (paroleDisponibili.Count == 0) { paroleGiaViste.Clear(); paroleDisponibili = parole; }
        var parolaScelta = paroleDisponibili[Random.Shared.Next(paroleDisponibili.Count)];
        paroleGiaViste.Add(parolaScelta.Text);
        // L'elemento scelto contribuisce al punteggio: prodotto dei valori (default 1 se senza punteggio).
        acc.Product *= parolaScelta.ElementValue;
        acc.Count++;
        return parolaScelta.Text;
    }

    private static string ArmonizzaTesto(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;

        // Prima lettera assoluta in maiuscolo
        text = Regex.Replace(text, @"^([^\p{L}]*)(\p{Ll})",
            m => m.Groups[1].Value + m.Groups[2].Value.ToUpper());

        // Armonizza la punteggiatura multipla tenendo i segni semanticamente più forti
        text = Regex.Replace(text, @"([.,:;!?](?:\s*[.,:;!?])+)", m =>
        {
            var cluster = new string(m.Value.Where(c => !char.IsWhiteSpace(c)).ToArray());
            if (cluster.Contains('!') || cluster.Contains('?'))
                return new string(cluster.Where(c => c == '!' || c == '?').ToArray());
            if (cluster.Contains('.'))
            {
                var dotsCount = cluster.Count(c => c == '.');
                return dotsCount > 1 ? "..." : ".";
            }
            if (cluster.Contains(';')) return ";";
            if (cluster.Contains(':')) return ":";
            return ",";
        });

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

        // Contrazioni/elisioni articolo-preposizione (vedi ContraiPreposizioni): ultimo passo,
        // dopo le maiuscole, così intercetta anche la preposizione a inizio frase.
        text = ContraiPreposizioni(text);

        return text.Trim();
    }

    // ── Normalizzazione articoli/preposizioni ─────────────────────────────
    // I segnaposto possono espandersi in elementi che iniziano con un articolo
    // (es. [hating] = "le auto elettriche") finendo subito dopo una preposizione nel template
    // ("ridire su [hating]" → "su le auto"). Qui si sistemano le contrazioni/elisioni mancanti
    // ("su le" → "sulle", "di i" → "dei", "il"+vocale → "l'", "i"+vocale → "gli"). L'articolo è
    // confrontato SOLO in minuscolo: i nomi propri che hanno l'articolo nel nome (L'Aquila, La
    // Spezia) sono maiuscoli e restano intatti. L'elisione "lo/la"+vocale → "l'" è sempre corretta
    // in italiano (vale sia per l'articolo sia per il pronome), quindi viene applicata.
    private static readonly Dictionary<string, string> PrepArtMap = new(StringComparer.Ordinal)
    {
        ["di il"] = "del", ["di lo"] = "dello", ["di la"] = "della", ["di i"] = "dei", ["di gli"] = "degli", ["di le"] = "delle",
        ["a il"] = "al", ["a lo"] = "allo", ["a la"] = "alla", ["a i"] = "ai", ["a gli"] = "agli", ["a le"] = "alle",
        ["da il"] = "dal", ["da lo"] = "dallo", ["da la"] = "dalla", ["da i"] = "dai", ["da gli"] = "dagli", ["da le"] = "dalle",
        ["in il"] = "nel", ["in lo"] = "nello", ["in la"] = "nella", ["in i"] = "nei", ["in gli"] = "negli", ["in le"] = "nelle",
        ["su il"] = "sul", ["su lo"] = "sullo", ["su la"] = "sulla", ["su i"] = "sui", ["su gli"] = "sugli", ["su le"] = "sulle",
    };
    private static readonly Dictionary<string, string> PrepLMap = new(StringComparer.Ordinal)
    {
        ["di"] = "dell'", ["a"] = "all'", ["da"] = "dall'", ["in"] = "nell'", ["su"] = "sull'",
    };
    // Innesco dell'elisione: vocali + "h" muta (così "lo hanno" → "l'hanno", "i hotel" → "gli hotel").
    private const string Vocali = "aeiouàèéìòùAEIOUÀÈÉÌÒÙhH";
    private static readonly Regex RxIlVocale = new(@"(?<![\p{L}'’])(Il|il)[ \t]+(?=[" + Vocali + "])", RegexOptions.Compiled);
    // "lo"/"la" + vocale → "l'": in italiano si elide sempre, sia come articolo ("la ex-moglie" →
    // "l'ex-moglie") sia come pronome ("non lo invitano" → "non l'invitano"), quindi è sempre corretto.
    private static readonly Regex RxLoLaVocale = new(@"(?<![\p{L}'’])(Lo|lo|La|la)[ \t]+(?=[" + Vocali + "])", RegexOptions.Compiled);
    private static readonly Regex RxIVocale = new(@"(?<![\p{L}'’])(I|i)[ \t]+(?=[" + Vocali + "])", RegexOptions.Compiled);
    private static readonly Regex RxPrepL = new(@"(?<![\p{L}'’])(Di|di|A|a|Da|da|In|in|Su|su)[ \t]+l['’](?=\p{L})", RegexOptions.Compiled);
    private static readonly Regex RxPrepArt = new(@"(?<![\p{L}'’])(Di|di|A|a|Da|da|In|in|Su|su)[ \t]+(il|lo|la|gli|le|i)(?![\p{L}'’])", RegexOptions.Compiled);

    private static string Cap(string s, bool upper) => upper ? char.ToUpperInvariant(s[0]) + s[1..] : s;

    private static string ContraiPreposizioni(string text)
    {
        // Prima le elisioni davanti a vocale (così "di i uomini" → "di gli uomini" → "degli uomini").
        text = RxIlVocale.Replace(text, m => Cap("l'", char.IsUpper(m.Groups[1].Value[0])));
        text = RxLoLaVocale.Replace(text, m => Cap("l'", char.IsUpper(m.Groups[1].Value[0])));
        text = RxIVocale.Replace(text, m => Cap("gli ", char.IsUpper(m.Groups[1].Value[0])));
        text = RxPrepL.Replace(text, m => Cap(PrepLMap[m.Groups[1].Value.ToLowerInvariant()], char.IsUpper(m.Groups[1].Value[0])));
        text = RxPrepArt.Replace(text, m => Cap(PrepArtMap[m.Groups[1].Value.ToLowerInvariant() + " " + m.Groups[2].Value], char.IsUpper(m.Groups[1].Value[0])));
        return text;
    }

    /// <summary>
    /// Implementa in-place l'algoritmo standard Fisher-Yates per randomizzare robustamente l'ordinamento in una lista in clonata.
    /// </summary>
    private static List<T> ShuffledCopy<T>(List<T> source)
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
