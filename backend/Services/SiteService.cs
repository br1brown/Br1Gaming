using System.Text.RegularExpressions;
using Backend.Infrastructure;
using Backend.Models;

namespace Backend.Services;

public class SiteService(IContentStore store)
{
    private readonly IContentStore _store = store;

    // ── Cache shared data ────────────────────────────────────────────

    private static SharedData? _sharedCache;
    private static readonly Lock _sharedLock = new();

    private async Task<SharedData> LoadSharedDataFromCacheAsync()
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

    /// <summary>Forza la rilettura di shared.json al prossimo accesso.</summary>
    public static void ClearCache() { lock (_sharedLock) { _sharedCache = null; } }

    // ── Catalogo generatori ──────────────────────────────────────────

    public Task<List<GeneratorData>> GetGeneratorCatalogAsync() => _store.GetGeneratorsAsync();

    public Task<GeneratorData?> GetGeneratorBySlugAsync(string slug) => _store.GetGeneratorAsync(slug);

    // ── Generazione testo ────────────────────────────────────────────

    public async Task<GenerationResult> GenerateAsync(string slug, GenerationRequest request)
    {
        var generator = await _store.GetGeneratorAsync(slug)
            ?? throw new NotFoundException($"generatore '{slug}'");

        if (generator.Core.Count == 0)
            return new GenerationResult("", "", null);

        var shared = await LoadSharedDataFromCacheAsync();
        var lists = AggregateAllLists(generator, shared);
        var exclusiveGroups = ExpandGroupNamesToTags(generator, shared);

        // Tiene traccia dei valori già estratti per evitare ripetizioni
        var used = new Dictionary<string, HashSet<string>>();

        var text = ComposeText(generator, lists, shared.RangeAliases, exclusiveGroups, used);
        text = CapitalizeSentences(text);

        var html = request.IncludeHtml
            ? $"<p>{System.Net.WebUtility.HtmlEncode(text)}</p>"
            : null;

        return new GenerationResult(text, text, html);
    }

    // ── Aggregazione liste ───────────────────────────────────────────

    /// <summary>
    /// Costruisce il dizionario completo di liste per questo generatore:
    /// prima le condivise, poi le composte ([nome] = [nome-m] + [nome-f]),
    /// infine quelle locali del generatore che sovrascrivono le precedenti.
    /// </summary>
    private static Dictionary<string, List<string>> AggregateAllLists(GeneratorData generator, SharedData shared)
    {
        var all = new Dictionary<string, List<string>>(shared.FlatLists);

        foreach (var (key, sources) in shared.ComposedLists)
        {
            var combined = sources
                .Where(src => all.ContainsKey(src))
                .SelectMany(src => all[src])
                .ToList();
            if (combined.Count > 0)
                all[key] = combined;
        }

        foreach (var (key, list) in generator.FlatLists)
            all[key] = list;

        return all;
    }

    // ── Risoluzione gruppi esclusivi ─────────────────────────────────

    /// <summary>
    /// Traduce i nomi dei gruppi (es. "età", "professione") nelle liste
    /// di tag corrispondenti definiti in shared.json.
    /// </summary>
    private static List<List<string>>? ExpandGroupNamesToTags(GeneratorData generator, SharedData shared)
    {
        if (generator.ExclusiveGroups is not { Count: > 0 })
            return null;

        return generator.ExclusiveGroups
            .Select(name => shared.PolicyGroups.TryGetValue(name, out var tags) ? tags : [name])
            .ToList();
    }

    // ── Composizione testo ───────────────────────────────────────────

    /// <summary>Assembla prefix, corpo centrale e suffix nel testo finale.</summary>
    private static string ComposeText(
        GeneratorData generator,
        Dictionary<string, List<string>> lists,
        Dictionary<string, string> rangeAliases,
        List<List<string>>? exclusiveGroups,
        Dictionary<string, HashSet<string>> used)
    {
        // Il prefix va risolto prima: il suo [nome] non si ripeterà nelle frasi
        var prefix = ResolveIfPresent(generator.Prefix, lists, rangeAliases, used);
        var suffix = ResolveIfPresent(generator.Suffix, lists, rangeAliases, used);

        var body = ComposeBody(generator, lists, rangeAliases, exclusiveGroups, used);

        if (prefix != null && body.Length > 0)
            body = prefix + ", " + char.ToLower(body[0]) + body[1..];

        if (suffix != null)
            body += suffix;

        return body;
    }

    /// <summary>Seleziona i template e li espande nei placeholder per formare le frasi.</summary>
    private static string ComposeBody(
        GeneratorData generator,
        Dictionary<string, List<string>> lists,
        Dictionary<string, string> rangeAliases,
        List<List<string>>? exclusiveGroups,
        Dictionary<string, HashSet<string>> used)
    {
        var min = generator.MinPhrases ?? 1;
        var max = generator.MaxPhrases ?? min;
        var count = min >= max ? min : Random.Shared.Next(min, max + 1);

        if (count <= 1)
        {
            var template = generator.Core[Random.Shared.Next(generator.Core.Count)];
            return ExpandAllPlaceholders(template, lists, rangeAliases, used);
        }

        var separators = generator.Separators is { Count: > 0 } ? generator.Separators : [". "];
        var sep = separators[Random.Shared.Next(separators.Count)];

        var templates = PickTemplatesRespectingPolicies(
            generator.Core, count, generator.UniqueLabels, exclusiveGroups);

        return string.Join(sep,
            templates.Select(t => ExpandAllPlaceholders(t, lists, rangeAliases, used)));
    }

    private static string? ResolveIfPresent(
        string? template,
        Dictionary<string, List<string>> lists,
        Dictionary<string, string> rangeAliases,
        Dictionary<string, HashSet<string>> used)
    {
        if (string.IsNullOrEmpty(template)) return null;
        return ExpandAllPlaceholders(template, lists, rangeAliases, used);
    }

    // ── Selezione template con policy ────────────────────────────────

    /// <summary>
    /// Pesca <paramref name="count"/> template dal pool mescolato,
    /// rispettando le policy di unicità:
    /// <list type="bullet">
    ///   <item>UniqueLabels — ogni etichetta può comparire al massimo una volta.</item>
    ///   <item>ExclusiveGroups — quando un tag del gruppo viene usato, il gruppo è chiuso.</item>
    /// </list>
    /// </summary>
    private static List<string> PickTemplatesRespectingPolicies(
        List<string> core, int count,
        List<string>? uniqueLabels,
        List<List<string>>? exclusiveGroups)
    {
        var pool = ShuffledCopy(core);
        var selected = new List<string>();
        var usedLabels = new HashSet<string>();
        var closedGroups = new HashSet<int>();

        foreach (var phrase in pool)
        {
            if (selected.Count >= count) break;
            if (HasLabelConflict(phrase, uniqueLabels, usedLabels)) continue;
            if (HasGroupConflict(phrase, exclusiveGroups, closedGroups)) continue;

            selected.Add(phrase);
            TrackUsedLabels(phrase, uniqueLabels, usedLabels);
            TrackUsedGroups(phrase, exclusiveGroups, closedGroups);
        }

        return selected;
    }

    private static bool HasLabelConflict(string phrase, List<string>? labels, HashSet<string> used) =>
        labels?.Any(l => phrase.Contains(l) && used.Contains(l)) ?? false;

    private static bool HasGroupConflict(string phrase, List<List<string>>? groups, HashSet<int> closed)
    {
        if (groups is null) return false;
        for (var i = 0; i < groups.Count; i++)
            if (closed.Contains(i) && groups[i].Any(tag => phrase.Contains(tag)))
                return true;
        return false;
    }

    private static void TrackUsedLabels(string phrase, List<string>? labels, HashSet<string> used)
    {
        if (labels is null) return;
        foreach (var l in labels.Where(phrase.Contains))
            used.Add(l);
    }

    private static void TrackUsedGroups(string phrase, List<List<string>>? groups, HashSet<int> closed)
    {
        if (groups is null) return;
        for (var i = 0; i < groups.Count; i++)
            if (groups[i].Any(tag => phrase.Contains(tag)))
                closed.Add(i);
    }

    // ── Espansione placeholder ───────────────────────────────────────

    private static readonly Regex PlaceholderRx = new(@"\[[^\]]+\]", RegexOptions.Compiled);
    private static readonly Regex RangeRx = new(@"^\d+-\d+$", RegexOptions.Compiled);

    /// <summary>
    /// Espande iterativamente tutti i placeholder nel template (max 5 passaggi,
    /// per gestire placeholder annidati come [età-giovane] → [15-26] → 21).
    /// </summary>
    private static string ExpandAllPlaceholders(
        string template,
        Dictionary<string, List<string>> lists,
        Dictionary<string, string> rangeAliases,
        Dictionary<string, HashSet<string>> used)
    {
        var text = template;

        for (var pass = 0; pass < 5; pass++)
        {
            var expanded = PlaceholderRx.Replace(text, m => ExpandPlaceholder(m.Value, lists, rangeAliases, used));
            if (expanded == text) break;
            text = expanded;
        }

        return text;
    }

    private static string ExpandPlaceholder(
        string placeholder,
        Dictionary<string, List<string>> lists,
        Dictionary<string, string> rangeAliases,
        Dictionary<string, HashSet<string>> used)
    {
        var inner = placeholder[1..^1];

        // 1) Alias di range: [età-giovane] → [15-26] → numero
        if (rangeAliases.TryGetValue(placeholder, out var rangeTarget))
            return TryPickFromRange(rangeTarget[1..^1]) ?? rangeTarget;

        // 2) Range numerico diretto: [15-25] → numero casuale
        if (TryPickFromRange(inner) is { } number)
            return number;

        // 3) Lista con anti-ripetizione
        if (lists.TryGetValue(placeholder, out var list) && list.Count > 0)
            return PickUniqueFromList(placeholder, list, used);

        return placeholder; // non riconosciuto: lascia invariato
    }

    private static string? TryPickFromRange(string inner)
    {
        if (!RangeRx.IsMatch(inner)) return null;
        var dash = inner.IndexOf('-');
        var min = int.Parse(inner[..dash]);
        var max = int.Parse(inner[(dash + 1)..]);
        return Random.Shared.Next(min, max + 1).ToString();
    }

    private static string PickUniqueFromList(
        string key, List<string> list, Dictionary<string, HashSet<string>> used)
    {
        if (!used.TryGetValue(key, out var seen))
            used[key] = seen = [];

        var available = list.Where(v => !seen.Contains(v)).ToList();
        if (available.Count == 0)
        {
            seen.Clear();
            available = list;
        }

        var chosen = available[Random.Shared.Next(available.Count)];
        seen.Add(chosen);
        return chosen;
    }

    // ── Utilità ──────────────────────────────────────────────────────

    private static string CapitalizeSentences(string text)
    {
        if (text.Length == 0) return text;
        text = char.ToUpper(text[0]) + text[1..];
        return Regex.Replace(text, @"(?<=[.!?;]\s)([a-z])", m => m.Value.ToUpper());
    }

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

public record GenerationRequest(bool IncludeHtml);
public record GenerationResult(string Text, string Markdown, string? Html);
