using System.Text.RegularExpressions;
using Backend.Infrastructure;
using Backend.Models;

namespace Backend.Services;

public class SiteService(IContentStore store)
{
    private readonly IContentStore _store = store;

    // ── Catalogo storie ──────────────────────────────────────────────

    public Task<List<StoryData>> GetCatalogAsync() => _store.GetStoriesAsync();

    // ── Motore narrativo (stateless) ─────────────────────────────────

    public async Task<StorySnapshot> StartAsync(string slug)
    {
        var story = await _store.GetStoryAsync(slug)
            ?? throw new KeyNotFoundException($"Story '{slug}' not found");

        var stats = story.InitialStats != null
            ? new Dictionary<string, int>(story.InitialStats)
            : new Dictionary<string, int>();

        return BuildSnapshot(story, story.StartSceneId, consequences: null, chosenChoiceText: null, stats);
    }

    public async Task<StorySnapshot?> GetSceneAsync(string slug, string sceneId, Dictionary<string, int>? stats = null)
    {
        var story = await _store.GetStoryAsync(slug);
        if (story is null || !story.Scenes.ContainsKey(sceneId)) return null;

        stats ??= new Dictionary<string, int>();
        return BuildSnapshot(story, sceneId, consequences: null, chosenChoiceText: null, stats);
    }

    public async Task<StorySnapshot> ChooseAsync(
        string slug, string currentSceneId, string choiceId, Dictionary<string, int> stats)
    {
        var story = await _store.GetStoryAsync(slug)
            ?? throw new KeyNotFoundException($"Story '{slug}' not found");

        var scene = story.Scenes.GetValueOrDefault(currentSceneId)
            ?? throw new KeyNotFoundException("Scene not found");

        var choice = scene.Choices.FirstOrDefault(c => c.Id == choiceId)
            ?? throw new KeyNotFoundException($"Choice '{choiceId}' not found");

        // Applica i cambiamenti primari delle stat
        var newStats = new Dictionary<string, int>(stats);
        if (choice.Args.StatChanges != null)
            foreach (var (k, v) in choice.Args.StatChanges)
                newStats[k] = newStats.TryGetValue(k, out var cur) ? cur + v : v;

        // Risolve le conseguenze: quelle condizionali hanno la precedenza su quelle fisse
        string? consequences = choice.Args.Consequences;
        if (choice.Args.ConditionalConsequences?.Count > 0)
        {
            var match = choice.Args.ConditionalConsequences
                .FirstOrDefault(e => e.When == null || e.When.Evaluate(newStats));
            if (match != null)
            {
                consequences = match.Text;
                // L'entry condizionale può portare ulteriori cambiamenti di stat
                if (match.StatChanges != null)
                    foreach (var (k, v) in match.StatChanges)
                        newStats[k] = newStats.TryGetValue(k, out var cur) ? cur + v : v;
            }
        }

        return BuildSnapshot(story, choice.Args.NextSceneId, consequences, choice.Text, newStats);
    }

    private static StorySnapshot BuildSnapshot(
        StoryData story, string sceneId,
        string? consequences, string? chosenChoiceText,
        Dictionary<string, int> stats)
    {
        var scene = story.Scenes.GetValueOrDefault(sceneId)
            ?? throw new KeyNotFoundException($"Scene '{sceneId}' not found");

        // Smistamento automatico al finale basato sulle stat (trasparente per il chiamante)
        if (scene.StatEnding?.Count > 0)
        {
            var entry = scene.StatEnding.FirstOrDefault(e => e.When == null || e.When.Evaluate(stats));
            if (entry != null)
                return BuildSnapshot(story, entry.SceneId, consequences, chosenChoiceText, stats);
        }

        // Valuta il testo introduttivo condizionale (viene preposto al testo della scena)
        var sceneText = scene.Text;
        if (scene.ConditionalIntro?.Count > 0)
        {
            var intro = scene.ConditionalIntro.FirstOrDefault(e => e.When == null || e.When.Evaluate(stats));
            if (intro != null && !string.IsNullOrEmpty(intro.Text))
                sceneText = intro.Text + "\n\n" + sceneText;
        }

        // Filtra le scelte in base alla condizione
        var visibleChoices = scene.Choices
            .Where(c => c.Condition == null || c.Condition.Evaluate(stats))
            .ToList();

        var resolvedScene = scene with { Text = sceneText };

        return new StorySnapshot(
            StorySlug: story.Slug,
            SceneId: sceneId,
            Scene: resolvedScene,
            Choices: visibleChoices,
            IsEnding: scene.IsEnding,
            Consequences: consequences,
            ChosenChoiceText: chosenChoiceText,
            Stats: stats);
    }

    // ── Generatori ───────────────────────────────────────────────────

    public Task<List<GeneratorData>> GetGeneratorCatalogAsync() => _store.GetGeneratorsAsync();

    public Task<GeneratorData?> GetGeneratorBySlugAsync(string slug) => _store.GetGeneratorAsync(slug);

    public async Task<GenerationResult> GenerateAsync(string slug, GenerationRequest request)
    {
        var generator = await _store.GetGeneratorAsync(slug)
            ?? throw new KeyNotFoundException($"Generator '{slug}' not found");

        if (generator.Core.Count == 0)
            return new GenerationResult("", null, null);

        var sharedLists = await _store.GetSharedListsAsync();
        var allLists = new Dictionary<string, List<string>>(sharedLists);
        foreach (var (k, v) in generator.FlatLists)
            allLists[k] = v;

        var min = generator.MinPhrases ?? 1;
        var max = generator.MaxPhrases ?? min;
        var count = min >= max ? min : Random.Shared.Next(min, max + 1);

        string text;
        if (count <= 1)
        {
            var template = generator.Core[Random.Shared.Next(generator.Core.Count)];
            text = ResolvePlaceholders(template, allLists);
        }
        else
        {
            var separators = generator.Separators is { Count: > 0 } ? generator.Separators : [". "];
            var sep = separators[Random.Shared.Next(separators.Count)];
            var phrases = Enumerable.Range(0, count)
                .Select(_ => ResolvePlaceholders(generator.Core[Random.Shared.Next(generator.Core.Count)], allLists))
                .ToList();
            text = CapitalizeAfterPunctuation(string.Join(sep, phrases));
        }

        if (!string.IsNullOrEmpty(generator.Prefix))
        {
            var resolvedPrefix = ResolvePlaceholders(generator.Prefix, allLists);
            var lowered = text.Length > 0 ? char.ToLower(text[0]) + text[1..] : text;
            text = resolvedPrefix + ", " + lowered;
        }

        if (text.Length > 0)
            text = char.ToUpper(text[0]) + text[1..];

        var markdown = text;
        var html = request.IncludeHtml ? $"<p>{text}</p>" : null;

        return new GenerationResult(text, markdown, html);
    }

    private static string CapitalizeAfterPunctuation(string text) =>
        Regex.Replace(text, @"(?<=[.!?;]\s)([a-z])", m => m.Value.ToUpper());

    private static readonly Regex PlaceholderRegex = new(@"\[[^\]]+\]", RegexOptions.Compiled);
    private static readonly Regex RangeRegex = new(@"^\d+-\d+$", RegexOptions.Compiled);

    private static string ResolvePlaceholders(string template, Dictionary<string, List<string>> flatLists)
    {
        const int maxIterations = 5;
        var text = template;

        for (var i = 0; i < maxIterations; i++)
        {
            var resolved = PlaceholderRegex.Replace(text, match =>
            {
                var key = match.Value;
                var inner = key[1..^1];

                if (RangeRegex.IsMatch(inner))
                {
                    var dash = inner.IndexOf('-');
                    var min = int.Parse(inner[..dash]);
                    var max = int.Parse(inner[(dash + 1)..]);
                    return Random.Shared.Next(min, max + 1).ToString();
                }

                if (flatLists.TryGetValue(key, out var list) && list.Count > 0)
                    return list[Random.Shared.Next(list.Count)];

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
