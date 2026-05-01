using Backend.Models;
using Backend.Stories;
using Backend.Stories.Catalog;

namespace Backend.Services;

/// <summary>
/// Tutto ciò che riguarda le storie: istanze, catalogo, motore narrativo.
/// Per aggiungere una storia: creare la classe IStory in Stories/Catalog/,
/// aggiungere il campo statico qui sotto, includerla in GetCatalog()
/// e aggiungere il metodo PlayXxx.
/// </summary>
public class StoryService
{
    // ── Istanze storie — una per storia, slug incapsulato nella classe ──

    private static readonly PoveriMaschiStory PoveriMaschi = new();
    private static readonly Magrogamer09Story Magrogamer09 = new();

    // ── Catalogo ─────────────────────────────────────────────────────

    public IEnumerable<IStory> GetCatalog() => [PoveriMaschi, Magrogamer09];

    public IStory GetPoveriMaschi() => PoveriMaschi;
    public IStory GetMagrogamer09() => Magrogamer09;

    // ── Poveri Maschi ─────────────────────────────────────────────────

    public StorySnapshot? PlayPoveriMaschi(string? sceneId, string? choiceId, GameState state)
        => Play(PoveriMaschi, sceneId, choiceId, state);

    // ── Magrogamer09 ──────────────────────────────────────────────────

    public StorySnapshot? PlayMagrogamer09(string? sceneId, string? choiceId, GameState state)
        => Play(Magrogamer09, sceneId, choiceId, state);

    // ══════════════════════════════════════════════════════════════════
    // MOTORE NARRATIVO
    // ══════════════════════════════════════════════════════════════════

    private static StorySnapshot? Play(IStory story, string? sceneId, string? choiceId, GameState state)
    {
        if (sceneId is null)
            return Start(story);

        if (choiceId is not null)
            return Choose(story, sceneId, choiceId, state);

        return Resume(story, sceneId, state);
    }

    private static StorySnapshot Start(IStory story)
    {
        var freshState = new GameState(story.InitialState);
        return BuildSnapshot(story, story.StartSceneId, null, null, freshState);
    }

    private static StorySnapshot? Resume(IStory story, string sceneId, GameState state)
    {
        if (!story.HasScene(sceneId)) return null;
        return BuildSnapshot(story, sceneId, null, null, state);
    }

    private static StorySnapshot Choose(IStory story, string sceneId, string choiceId, GameState state)
    {
        var scene = story.GetScene(sceneId, state);
        var choice = scene.Choices.FirstOrDefault(c => c.Id == choiceId && c.IsVisible)
            ?? throw new InvalidParametersException();

        var consequence = choice.Effect?.Invoke(state);
        return BuildSnapshot(story, choice.NextSceneId, consequence, choice.Text, state);
    }

    private static StorySnapshot BuildSnapshot(
        IStory story, string sceneId,
        string? consequence, string? chosenChoiceText,
        GameState state)
    {
        var scene = story.GetScene(sceneId, state);

        if (scene.RouteToScene is not null)
            return BuildSnapshot(story, scene.RouteToScene, consequence, chosenChoiceText, state);

        return new StorySnapshot(
            StorySlug: story.Slug,
            StoryTitle: story.Title,
            SceneId: sceneId,
            SceneText: scene.Text,
            EndingTitle: scene.EndingTitle,
            Choices: scene.Choices.Where(c => c.IsVisible).Select(c => new ChoiceSnapshot(c.Id, c.Text)).ToList(),
            IsEnding: scene.IsEnding,
            Consequences: consequence,
            ChosenChoiceText: chosenChoiceText,
            Stats: state.ToDictionary());
    }
}
