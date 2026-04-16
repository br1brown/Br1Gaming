using System.Text.RegularExpressions;
using Backend.Infrastructure;
using Backend.Models;

namespace Backend.Services;

/// <summary>
/// Tutto ciò che riguarda i generatori: catalogo, info per nome, generazione testo.
/// Per aggiungere un generatore: creare il JSON in data/generators/,
/// aggiungere qui i due metodi (GetXxxAsync + GenerateXxxAsync)
/// e aggiungere lo slug a KnownSlugs qui sotto.
/// </summary>
public class GeneratorService(IContentStore store)
{
    private readonly IContentStore _store = store;

    // ── Cache shared data ────────────────────────────────────────────

    private static SharedData? _sharedCache;
    private static readonly Lock _sharedLock = new();

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

    /// <summary>Forza la rilettura di shared.json al prossimo accesso.</summary>
    public static void ClearCache() { lock (_sharedLock) { _sharedCache = null; } }

    // ── Slug — unica dichiarazione per generatore ─────────────────────
    // Aggiungere qui lo slug e i due metodi pubblici (Get + Generate).

    private const string SlugIncel = "incel";
    private const string SlugAuto = "auto";
    private const string SlugAntiveg = "antiveg";
    private const string SlugLocali = "locali";
    private const string SlugMbeb = "mbeb";

    // ── Catalogo ─────────────────────────────────────────────────────

    private static readonly string[] AllSlugs = [SlugIncel, SlugAuto, SlugAntiveg, SlugLocali, SlugMbeb];

    public async Task<List<GeneratorData>> GetCatalogAsync()
    {
        var all = await _store.GetGeneratorsAsync();
        return all.Where(i => AllSlugs.Contains(i.Slug)).ToList();
    }

    // ── Incel ─────────────────────────────────────────────────────────

    public Task<GeneratorData?> GetIncelAsync() => _store.GetGeneratorAsync(SlugIncel);
    public Task<GenerationResult> GenerateIncelAsync(bool html) => GenerateAsync(SlugIncel, html);

    // ── Auto ──────────────────────────────────────────────────────────

    public Task<GeneratorData?> GetAutoAsync() => _store.GetGeneratorAsync(SlugAuto);
    public Task<GenerationResult> GenerateAutoAsync(bool html) => GenerateAsync(SlugAuto, html);

    // ── Antiveg ───────────────────────────────────────────────────────

    public Task<GeneratorData?> GetAntivegAsync() => _store.GetGeneratorAsync(SlugAntiveg);
    public Task<GenerationResult> GenerateAntivegAsync(bool html) => GenerateAsync(SlugAntiveg, html);

    // ── Locali ────────────────────────────────────────────────────────

    public Task<GeneratorData?> GetLocaliAsync() => _store.GetGeneratorAsync(SlugLocali);
    public Task<GenerationResult> GenerateLocaliAsync(bool html) => GenerateAsync(SlugLocali, html);

    // ── Mbeb ──────────────────────────────────────────────────────────

    public Task<GeneratorData?> GetMbebAsync() => _store.GetGeneratorAsync(SlugMbeb);
    public Task<GenerationResult> GenerateMbebAsync(bool html) => GenerateAsync(SlugMbeb, html);

    // ══════════════════════════════════════════════════════════════════
    // MOTORE DI GENERAZIONE (privato — lo slug arriva solo dai metodi named)
    // ══════════════════════════════════════════════════════════════════

    private async Task<GenerationResult> GenerateAsync(string slug, bool includeHtml)
    {
        var generator = await _store.GetGeneratorAsync(slug)
            ?? throw new NotFoundException($"generatore '{slug}'");

        if (generator.Core.Count == 0)
            return new GenerationResult("", "", null);

        var shared = await LoadSharedDataAsync();
        var lists = AggregateAllLists(generator, shared);
        var exclusiveGroups = ExpandGroupNamesToTags(generator, shared);
        var used = new Dictionary<string, HashSet<string>>();

        var text = ComposeText(generator, lists, shared.RangeAliases, exclusiveGroups, used);
        text = CapitalizeSentences(text);

        var html = includeHtml
            ? $"<p>{System.Net.WebUtility.HtmlEncode(text)}</p>"
            : null;

        return new GenerationResult(text, text, html);
    }

    // ── Aggregazione liste ───────────────────────────────────────────

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

    private static List<List<string>>? ExpandGroupNamesToTags(GeneratorData generator, SharedData shared)
    {
        if (generator.ExclusiveGroups is not { Count: > 0 })
            return null;

        return generator.ExclusiveGroups
            .Select(name => shared.PolicyGroups.TryGetValue(name, out var tags) ? tags : [name])
            .ToList();
    }

    // ── Composizione testo ───────────────────────────────────────────

    private static string ComposeText(
        GeneratorData generator,
        Dictionary<string, List<string>> lists,
        Dictionary<string, string> rangeAliases,
        List<List<string>>? exclusiveGroups,
        Dictionary<string, HashSet<string>> used)
    {
        var prefix = ResolveIfPresent(generator.Prefix, lists, rangeAliases, used);
        var suffix = ResolveIfPresent(generator.Suffix, lists, rangeAliases, used);

        var body = ComposeBody(generator, lists, rangeAliases, exclusiveGroups, used);

        if (prefix != null && body.Length > 0)
            body = prefix + ", " + char.ToLower(body[0]) + body[1..];

        if (suffix != null)
            body += suffix;

        return body;
    }

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

        if (rangeAliases.TryGetValue(placeholder, out var rangeTarget))
            return TryPickFromRange(rangeTarget[1..^1]) ?? rangeTarget;

        if (TryPickFromRange(inner) is { } number)
            return number;

        if (lists.TryGetValue(placeholder, out var list) && list.Count > 0)
            return PickUniqueFromList(placeholder, list, used);

        return placeholder;
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

public record GenerationResult(string Text, string Markdown, string? Html);
