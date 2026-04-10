using Backend.Models;

namespace Backend.Stories;

/// <summary>
/// Motore narrativo stateless. Esegue la logica generica su qualsiasi IStory.
/// Il client mantiene sceneId e stato (localStorage) — il server non ha sessioni.
/// </summary>
public class StoryEngine
{
    public StorySnapshot Start(IStory story)
    {
        var state = new GameState(story.InitialState);
        return BuildSnapshot(story, story.StartSceneId, null, null, state);
    }

    public StorySnapshot? Resume(IStory story, string sceneId, GameState state)
    {
        if (!story.HasScene(sceneId)) return null;
        return BuildSnapshot(story, sceneId, null, null, state);
    }

    public StorySnapshot Choose(IStory story, string sceneId, string choiceId, GameState state)
    {
        var scene = story.GetScene(sceneId, state);
        var choice = scene.Choices.FirstOrDefault(c => c.Id == choiceId && c.IsVisible)
            ?? throw new InvalidParametersException();

        // Effect muta lo stato e restituisce la conseguenza
        var consequence = choice.Effect?.Invoke(state);

        return BuildSnapshot(story, choice.NextSceneId, consequence, choice.Text, state);
    }

    private static StorySnapshot BuildSnapshot(
        IStory story, string sceneId,
        string? consequence, string? chosenChoiceText,
        GameState state)
    {
        var scene = story.GetScene(sceneId, state);

        // Smistamento automatico (già calcolato nell'outer lambda della scena)
        if (scene.RouteToScene is not null)
            return BuildSnapshot(story, scene.RouteToScene, consequence, chosenChoiceText, state);

        var visibleChoices = scene.Choices
            .Where(c => c.IsVisible)
            .Select(c => new ChoiceSnapshot(c.Id, c.Text))
            .ToList();

        return new StorySnapshot(
            StorySlug: story.Slug,
            SceneId: sceneId,
            SceneText: scene.Text,
            EndingTitle: scene.EndingTitle,
            Choices: visibleChoices,
            IsEnding: scene.IsEnding,
            Consequences: consequence,
            ChosenChoiceText: chosenChoiceText,
            State: state.ToDictionary());
    }
}
