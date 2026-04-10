using System.Text.RegularExpressions;
using Backend.Infrastructure;
using Backend.Models;

namespace Backend.Services;

public class SiteService(IContentStore store)
{
    private readonly IContentStore _store = store;

    // ── Cache shared assets (immutabili a runtime, si ricaricano solo via ClearCache) ─

    private static SharedAssets? _sharedCache;
    private static readonly Lock _sharedLock = new();

    private async Task<SharedAssets> GetSharedAssetsAsync()
    {
        if (_sharedCache is not null) return _sharedCache;

        lock (_sharedLock)
        {
            if (_sharedCache is not null) return _sharedCache;
        }

        var lists     = await _store.GetSharedListsAsync();
        var groups    = await _store.GetPolicyGroupsAsync();
        var composed  = await _store.GetComposedListsAsync();
        var aliases   = await _store.GetRangeAliasesAsync();
        var assets    = new SharedAssets(lists, groups, composed, aliases);

        lock (_sharedLock) { _sharedCache = assets; }
        return assets;
    }

    /// <summary>Forza la rilettura di shared.json al prossimo accesso.</summary>
    public static void ClearCache() { lock (_sharedLock) { _sharedCache = null; } }

    // ── Generatori ───────────────────────────────────────────────────

    public Task<List<GeneratorData>> GetGeneratorCatalogAsync() => _store.GetGeneratorsAsync();

    public Task<GeneratorData?> GetGeneratorBySlugAsync(string slug) => _store.GetGeneratorAsync(slug);

    public async Task<GenerationResult> GenerateAsync(string slug, GenerationRequest request)
    {
        var generator = await _store.GetGeneratorAsync(slug)
            ?? throw new NotFoundException($"generatore '{slug}'");

        if (generator.Core.Count == 0)
            return new GenerationResult("", null, null);

        var shared = await GetSharedAssetsAsync();

        var allLists = new Dictionary<string, List<string>>(shared.FlatLists);

        // Risolve le liste composte: unisce più flatLists in una sola
        foreach (var (key, sources) in shared.ComposedLists)
        {
            var combined = new List<string>();
            foreach (var src in sources)
                if (allLists.TryGetValue(src, out var srcList))
                    combined.AddRange(srcList);
            if (combined.Count > 0)
                allLists[key] = combined;
        }

        foreach (var (k, v) in generator.FlatLists)
            allLists[k] = v;

        // Risolve i nomi dei gruppi esclusivi in liste di tag effettive
        List<List<string>>? resolvedExclusiveGroups = null;
        if (generator.ExclusiveGroups is { Count: > 0 })
        {
            resolvedExclusiveGroups = generator.ExclusiveGroups
                .Select(name => shared.PolicyGroups.TryGetValue(name, out var tags) ? tags : [name])
                .ToList();
        }

        var min = generator.MinPhrases ?? 1;
        var max = generator.MaxPhrases ?? min;
        var count = min >= max ? min : Random.Shared.Next(min, max + 1);

        // Stato condiviso di deduplication: ogni chiave tiene traccia dei valori già usati
        var usedValues = new Dictionary<string, HashSet<string>>();

        // Il prefix viene risolto per primo: il suo [nome] non verrà ripetuto nelle frasi
        string? resolvedPrefix = null;
        if (!string.IsNullOrEmpty(generator.Prefix))
            resolvedPrefix = ResolvePlaceholders(generator.Prefix, allLists, shared.RangeAliases, usedValues);

        string text;
        if (count <= 1)
        {
            var template = generator.Core[Random.Shared.Next(generator.Core.Count)];
            text = ResolvePlaceholders(template, allLists, shared.RangeAliases, usedValues);
        }
        else
        {
            var separators = generator.Separators is { Count: > 0 } ? generator.Separators : [". "];
            var sep = separators[Random.Shared.Next(separators.Count)];
            var templates = SelectCoreTemplatesWithPolicies(
                generator.Core, count, generator.UniqueLabels, resolvedExclusiveGroups);
            var phrases = templates
                .Select(t => ResolvePlaceholders(t, allLists, shared.RangeAliases, usedValues))
                .ToList();
            text = CapitalizeAfterPunctuation(string.Join(sep, phrases));
        }

        if (resolvedPrefix != null)
        {
            var lowered = text.Length > 0 ? char.ToLower(text[0]) + text[1..] : text;
            text = resolvedPrefix + ", " + lowered;
        }

        if (!string.IsNullOrEmpty(generator.Suffix))
        {
            var resolvedSuffix = ResolvePlaceholders(generator.Suffix, allLists, shared.RangeAliases, usedValues);
            text += resolvedSuffix;
        }

        if (text.Length > 0)
            text = char.ToUpper(text[0]) + text[1..];

        var markdown = text;
        var html = request.IncludeHtml
            ? $"<p>{System.Net.WebUtility.HtmlEncode(text)}</p>"
            : null;

        return new GenerationResult(text, markdown, html);
    }

    // Seleziona i template dal core applicando le policy:
    // - UniqueLabels: una frase con quel keyword/tag blocca le successive che lo contengono
    // - ExclusiveGroups: una volta usato un tag del gruppo, nessuna altra frase del gruppo entra
    private static List<string> SelectCoreTemplatesWithPolicies(
        List<string> core, int count,
        List<string>? uniqueLabels,
        List<List<string>>? exclusiveGroups)
    {
        // Permutazione casuale del pool
        var pool = core.ToList();
        for (var i = pool.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (pool[i], pool[j]) = (pool[j], pool[i]);
        }

        var selected = new List<string>();
        var usedUniqueLabels = new HashSet<string>();
        var usedGroupIndices = new HashSet<int>();

        foreach (var phrase in pool)
        {
            if (selected.Count >= count) break;

            // Policy 1: etichette uniche
            if (uniqueLabels != null)
            {
                var blocked = false;
                foreach (var label in uniqueLabels)
                {
                    if (phrase.Contains(label) && usedUniqueLabels.Contains(label))
                    {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) continue;
            }

            // Policy 2: gruppi esclusivi
            if (exclusiveGroups != null)
            {
                var blocked = false;
                for (var gi = 0; gi < exclusiveGroups.Count; gi++)
                {
                    if (usedGroupIndices.Contains(gi) &&
                        exclusiveGroups[gi].Any(tag => phrase.Contains(tag)))
                    {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) continue;
            }

            selected.Add(phrase);

            if (uniqueLabels != null)
                foreach (var label in uniqueLabels)
                    if (phrase.Contains(label))
                        usedUniqueLabels.Add(label);

            if (exclusiveGroups != null)
                for (var gi = 0; gi < exclusiveGroups.Count; gi++)
                    if (exclusiveGroups[gi].Any(tag => phrase.Contains(tag)))
                        usedGroupIndices.Add(gi);
        }

        return selected;
    }

    private static string CapitalizeAfterPunctuation(string text) =>
        Regex.Replace(text, @"(?<=[.!?;]\s)([a-z])", m => m.Value.ToUpper());

    private static readonly Regex PlaceholderRegex = new(@"\[[^\]]+\]", RegexOptions.Compiled);
    private static readonly Regex RangeRegex = new(@"^\d+-\d+$", RegexOptions.Compiled);

    private static string ResolvePlaceholders(
        string template,
        Dictionary<string, List<string>> flatLists,
        Dictionary<string, string> rangeAliases,
        Dictionary<string, HashSet<string>>? usedValues = null)
    {
        const int maxIterations = 5;
        var text = template;

        for (var i = 0; i < maxIterations; i++)
        {
            var resolved = PlaceholderRegex.Replace(text, match =>
            {
                var key = match.Value;
                var inner = key[1..^1];

                // Alias di range: [età-giovane] → [15-25] → numero casuale
                if (rangeAliases.TryGetValue(key, out var rangeTarget))
                {
                    var targetInner = rangeTarget[1..^1];
                    if (RangeRegex.IsMatch(targetInner))
                    {
                        var dash = targetInner.IndexOf('-');
                        var min = int.Parse(targetInner[..dash]);
                        var max = int.Parse(targetInner[(dash + 1)..]);
                        return Random.Shared.Next(min, max + 1).ToString();
                    }
                    return rangeTarget;
                }

                if (RangeRegex.IsMatch(inner))
                {
                    var dash = inner.IndexOf('-');
                    var min = int.Parse(inner[..dash]);
                    var max = int.Parse(inner[(dash + 1)..]);
                    return Random.Shared.Next(min, max + 1).ToString();
                }

                if (flatLists.TryGetValue(key, out var list) && list.Count > 0)
                {
                    if (usedValues != null)
                    {
                        if (!usedValues.TryGetValue(key, out var used))
                            usedValues[key] = used = [];

                        var available = list.Where(v => !used.Contains(v)).ToList();
                        if (available.Count == 0)
                        {
                            used.Clear();
                            available = list;
                        }

                        var chosen = available[Random.Shared.Next(available.Count)];
                        used.Add(chosen);
                        return chosen;
                    }
                    return list[Random.Shared.Next(list.Count)];
                }

                return key;
            });

            if (resolved == text) break;
            text = resolved;
        }

        return text;
    }
}

public record GenerationRequest(bool IncludeHtml);
public record GenerationResult(string Text, string Markdown, string? Html);

internal record SharedAssets(
    Dictionary<string, List<string>> FlatLists,
    Dictionary<string, List<string>> PolicyGroups,
    Dictionary<string, List<string>> ComposedLists,
    Dictionary<string, string> RangeAliases);
