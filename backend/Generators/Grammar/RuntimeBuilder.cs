using Backend.Models;
using System.Text.RegularExpressions;

namespace Backend.Generators.Grammar;

/// <summary>
/// Compila un <see cref="IGenerator"/> (con la sua catena di master da <see cref="IGenerator.ComposeWith"/>)
/// in un <see cref="Runtime"/>: fonde i contenuti, li parsa in AST e VALIDA al boot (tag ignoti e cicli
/// → <see cref="GeneratorConfigException"/>). Tutto il lavoro a stringhe avviene qui, una volta sola.
/// </summary>
public static class RuntimeBuilder
{
    private static readonly Regex Tok = new(@"\[[^\]]+\]", RegexOptions.Compiled);

    /// <summary>
    /// Costruisce il runtime di <paramref name="target"/>. <paramref name="resolve"/> mappa uno slug al
    /// suo generatore (per i master dichiarati in <see cref="IGenerator.ComposeWith"/>).
    /// </summary>
    public static Runtime Build(IGenerator target, Func<string, IGenerator> resolve)
    {
        // Catena master-first: i master (da ComposeWith) prima, poi il generatore stesso.
        var chain = new List<IGenerator>();
        foreach (var masterSlug in target.ComposeWith) chain.Add(resolve(masterSlug));
        chain.Add(target);

        // ── Settings: max sulla catena per min/max frasi e soglia; separatori = unione ──
        int min = chain.Max(g => g.PhraseSettings?.MinPhrases ?? 1);
        int max = chain.Max(g => g.PhraseSettings?.MaxPhrases ?? min);
        var definedScores = chain.Where(g => g.PhraseSettings?.MinScore is > 0)
                                 .Select(g => g.PhraseSettings!.MinScore!.Value).ToList();
        double minScore = definedScores.Count > 0 ? definedScores.Max() : 0;
        var separators = chain.Where(g => g.PhraseSettings?.Separators is { Count: > 0 })
                              .SelectMany(g => g.PhraseSettings!.Separators!).Distinct().ToList();
        if (separators.Count == 0) separators.Add(". ");

        // ── FlatLists: shared ∪ liste composte ∪ catena (concat + dedup per testo) ──
        var flat = new Dictionary<string, List<ScoredItem>>();
        foreach (var (key, list) in SharedContent.FlatLists) flat[key] = [.. list];
        foreach (var (key, sources) in SharedContent.ComposedLists)
        {
            var combined = sources.Where(flat.ContainsKey).SelectMany(s => flat[s]).ToList();
            if (combined.Count > 0) flat[key] = combined;
        }
        foreach (var g in chain)
            foreach (var (key, list) in g.FlatLists)
                flat[key] = flat.TryGetValue(key, out var existing)
                    ? existing.Concat(list).DistinctBy(item => item.Text).ToList()
                    : [.. list];

        // ── Validazione DETERMINISTICA: il grafo dei riferimenti tra flatlist è aciclico ──
        if (FindCycle(BuildRefGraph(flat)) is { } cycle)
            throw new GeneratorConfigException(
                $"Generatore '{target.Slug}': ciclo di riferimenti tra flatlist: {string.Join(" → ", cycle)}");

        // ── Gruppi esclusivi attivi (nome → tag): da PolicyGroups, o singoletto se nome sconosciuto ──
        var exclusiveNames = chain.Where(g => g.ExclusiveGroups != null)
                                  .SelectMany(g => g.ExclusiveGroups!).Distinct();
        var activeGroups = exclusiveNames.ToDictionary(
            name => name,
            name => SharedContent.PolicyGroups.TryGetValue(name, out var tags) ? tags.ToArray() : [name]);

        var uniqueLabels = chain.Where(g => g.UniqueLabels != null)
                                .SelectMany(g => g.UniqueLabels!).Distinct().ToList();

        var parser = new PhraseParser(flat.Keys.ToHashSet(), activeGroups, uniqueLabels);

        // ── Parse (qui un tag ignoto fa fallire il boot) ──
        var resolvedFlat = flat.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyList<FlatEntry>)kv.Value
                .Select(item => new FlatEntry(parser.Parse(item.Text, 0, "flat"), item.Score, item.Text))
                .ToList());

        var globalCore = chain.SelectMany(g => g.Core.Select(c => parser.Parse(c.Text, c.Score, g.Slug)))
                              .DistinctBy(p => p.Raw).ToList();

        // ── Required: master se esplicito; altrimenti quota proporzionale per gli ospiti ──
        var requirements = new List<Requirement>();
        for (int i = 0; i < chain.Count; i++)
        {
            var instance = chain[i];
            if (i == 0)
            {
                if (instance.CoreRequired is { Phrases.Count: > 0 } masterReq)
                    requirements.Add(ParseRequirement(masterReq, instance.Slug, parser));
            }
            else if (instance.Core.Count > 0)
            {
                if (instance.CoreRequired is { Phrases.Count: > 0 } guestReq)
                    requirements.Add(ParseRequirement(guestReq, instance.Slug, parser));
                else
                {
                    var phrases = instance.Core.Select(c => parser.Parse(c.Text, c.Score, instance.Slug)).ToList();
                    requirements.Add(new Requirement(Math.Max(1, (min + 1) / 2), max / 2, phrases));
                }
            }
        }

        var aperturaTpl = chain.Select(g => g.Apertura).FirstOrDefault(a => !string.IsNullOrEmpty(a));
        var chiusuraTpl = chain.Select(g => g.Chiusura).FirstOrDefault(c => !string.IsNullOrEmpty(c));

        // ── Markov ("conio" di varianti): SOLO sulle liste CONDIVISE dei nomi propri (nome-m/-f, cognome,
        // nome), curate apposta — meno quelle in NonCoinableKeys (città, social) che devono restare reali.
        // Le liste dei singoli generatori (aggettivi, vibes, professioni…) non si coniano mai: lì un termine
        // inventato è un refuso, non una variante. Il tasso è il default condiviso, salvo override esplicito
        // di un generatore della catena (max tra quelli impostati; 0 disattiva). Ordine = primo esplicito, o default.
        var chaosOverrides = chain.Select(g => g.PhraseSettings?.MarkovChaos)
                                  .Where(v => v.HasValue).Select(v => v!.Value).ToList();
        double markovChaos = chaosOverrides.Count > 0 ? chaosOverrides.Max() : MarkovChain.DefaultChaos;
        int markovOrder = chain.Select(g => g.PhraseSettings?.MarkovOrder).FirstOrDefault(o => o is > 0)
                          ?? MarkovChain.DefaultOrder;
        var coinableKeys = SharedContent.FlatLists.Keys
            .Concat(SharedContent.ComposedLists.Keys)
            .Where(k => !MarkovChain.NonCoinableKeys.Contains(k))
            .ToHashSet();
        var markov = new Dictionary<string, MarkovChain>();
        if (markovChaos > 0)
            foreach (var (key, list) in flat)
                if (coinableKeys.Contains(key)
                    && MarkovChain.Train(list.Select(i => i.Text).ToList(), markovOrder) is { } ch)
                    markov[key] = ch;

        return new Runtime(
            FlatLists: resolvedFlat,
            GlobalCore: globalCore,
            Requirements: requirements,
            MinPhrases: min, MaxPhrases: max, MinScore: minScore,
            Separators: separators,
            Apertura: aperturaTpl is null ? null : parser.Parse(aperturaTpl, 0, "frame"),
            Chiusura: chiusuraTpl is null ? null : parser.Parse(chiusuraTpl, 0, "frame"),
            Markov: markov, MarkovChaos: markovChaos);
    }

    private static Requirement ParseRequirement(RequiredInjectData data, string origin, PhraseParser parser) =>
        new(data.Min, data.Max, data.Phrases.Select(p => parser.Parse(p.Text, p.Score, origin)).ToList());

    // ── Grafo dei riferimenti tra flatlist (solo le flatlist possono ciclare; range/età sono foglie) ──
    private static Dictionary<string, List<string>> BuildRefGraph(Dictionary<string, List<ScoredItem>> flat)
    {
        var graph = new Dictionary<string, List<string>>();
        foreach (var (key, entries) in flat)
        {
            var outs = new List<string>();
            foreach (var entry in entries)
                foreach (Match m in Tok.Matches(entry.Text))
                {
                    var dep = m.Value[1..^1];
                    if (flat.ContainsKey(dep)) outs.Add(dep);
                }
            graph[key] = outs;
        }
        return graph;
    }

    /// <summary>DFS con colorazione: ritorna il primo ciclo trovato (per il messaggio d'errore), o null.</summary>
    private static List<string>? FindCycle(Dictionary<string, List<string>> graph)
    {
        var color = new Dictionary<string, int>(); // 0 mai visto, 1 in pila, 2 chiuso
        var stack = new List<string>();
        List<string>? found = null;

        bool Dfs(string node)
        {
            color[node] = 1; stack.Add(node);
            foreach (var dep in graph.GetValueOrDefault(node) ?? [])
            {
                if (color.GetValueOrDefault(dep) == 1) { found = [.. stack.SkipWhile(x => x != dep), dep]; return true; }
                if (color.GetValueOrDefault(dep) == 0 && Dfs(dep)) return true;
            }
            stack.RemoveAt(stack.Count - 1); color[node] = 2; return false;
        }

        foreach (var key in graph.Keys) if (color.GetValueOrDefault(key) == 0 && Dfs(key)) break;
        return found;
    }
}

/// <summary>Trasforma una stringa-template in un <see cref="Phrase"/> AST, risolvendo tipo e gruppi di ogni Slot.</summary>
internal sealed class PhraseParser(
    IReadOnlySet<string> flatKeys,
    IReadOnlyDictionary<string, string[]> activeGroups,
    IReadOnlyList<string> uniqueLabels)
{
    private static readonly Regex Tok = new(@"\[[^\]]+\]", RegexOptions.Compiled);
    private static readonly Regex RangeRx = new(@"^\d+-\d+$", RegexOptions.Compiled);

    public Phrase Parse(string template, double score, string origin)
    {
        var parts = new List<Part>();
        int idx = 0;
        foreach (Match m in Tok.Matches(template))
        {
            if (m.Index > idx) parts.Add(new Lit(template[idx..m.Index]));
            parts.Add(ResolveSlot(m.Value[1..^1], template, origin));
            idx = m.Index + m.Length;
        }
        if (idx < template.Length) parts.Add(new Lit(template[idx..]));

        // SHALLOW (come il vecchio HasGroupConflict): solo i tag DIRETTI del template.
        var groups = parts.OfType<Slot>().SelectMany(s => s.Groups).ToHashSet();
        var labels = uniqueLabels.Where(template.Contains).ToHashSet();
        return new Phrase(score, parts, groups, labels, origin, template);
    }

    private Slot ResolveSlot(string key, string template, string origin)
    {
        var groups = GroupsFor(key);
        if (SharedContent.AgeAliases.TryGetValue(key, out var alias) && TryRange(StripBrackets(alias), out int alo, out int ahi))
            return new Slot(key, SlotKind.Age, alo, ahi, groups);
        if (TryRange(key, out int lo, out int hi))
            return new Slot(key, SlotKind.Range, lo, hi, groups);
        if (flatKeys.Contains(key))
            return new Slot(key, SlotKind.FlatList, 0, 0, groups);
        throw new GeneratorConfigException(
            $"Generatore '{origin}': tag sconosciuto [{key}] nella frase \"{template}\"");
    }

    private HashSet<string> GroupsFor(string key)
    {
        var set = new HashSet<string>();
        foreach (var (name, tags) in activeGroups)
            if (tags.Contains(key)) set.Add(name);
        return set;
    }

    private static string StripBrackets(string s) => s.Length >= 2 && s[0] == '[' && s[^1] == ']' ? s[1..^1] : s;

    private static bool TryRange(string s, out int lo, out int hi)
    {
        lo = hi = 0;
        if (!RangeRx.IsMatch(s)) return false;
        int dash = s.IndexOf('-');
        return int.TryParse(s[..dash], out lo) && int.TryParse(s[(dash + 1)..], out hi);
    }
}
