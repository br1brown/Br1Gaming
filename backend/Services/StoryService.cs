using System.Text.Json;
using Backend.Models;
using Backend.Stories;

namespace Backend.Services;

/// <summary>
/// Tutto ciò che riguarda le storie: catalogo, lookup per slug e motore narrativo.
/// Le storie sono iniettate dal container DI (auto-registrate dall'assembly in <c>Program.cs</c>,
/// come i generatori). La superficie pubblica è indicizzata per slug: aggiungere una storia =
/// creare la classe <see cref="IStory"/> in <c>Stories/Catalog/</c>, nient'altro da toccare.
/// </summary>
public class StoryService
{
    private readonly IReadOnlyList<IStory> _catalog;
    private readonly Dictionary<string, IStory> _bySlug;

    /// <summary>Riceve le storie dal container DI e ne costruisce catalogo (ordinato per <c>Order</c>) e lookup per slug.</summary>
    /// <param name="stories">Tutte le istanze di <see cref="IStory"/> registrate in DI.</param>
    public StoryService(IEnumerable<IStory> stories)
    {
        var all = stories.ToList();
        _bySlug = all.ToDictionary(story => story.Slug, StringComparer.OrdinalIgnoreCase);
        _catalog = all.OrderBy(story => story.Order).ToList();
    }

    /// <summary>Catalogo delle storie disponibili, ordinato per <c>Order</c>.</summary>
    public IReadOnlyList<IStory> GetCatalog() => _catalog;

    /// <summary>Recupera una storia per slug.</summary>
    /// <param name="slug">Slug della storia (es. <c>magrogamer09</c>).</param>
    /// <exception cref="NotFoundException">Se nessuna storia ha quello slug.</exception>
    public IStory Get(string slug) =>
        _bySlug.TryGetValue(slug, out var story) ? story : throw new NotFoundException(slug);

    /// <summary>
    /// Passo di gioco sulla storia con lo slug indicato: nessun parametro = start, solo scena = resume,
    /// scena + scelta = avanzamento.
    /// </summary>
    /// <param name="slug">Slug della storia.</param>
    /// <param name="sceneId">Scena corrente del client, o <c>null</c> per iniziare da capo.</param>
    /// <param name="choiceId">Scelta fatta nella scena corrente, o <c>null</c>.</param>
    /// <param name="stats">Stato di gioco salvato dal client, così come arriva dal JSON.</param>
    /// <exception cref="NotFoundException">Se nessuna storia ha quello slug.</exception>
    public StorySnapshot Play(string slug, string? sceneId, string? choiceId, Dictionary<string, object>? stats)
        => Play(Get(slug), sceneId, choiceId, stats);

    // Passo di gioco: nessun parametro = start, solo scena = resume, scena + scelta =
    // avanzamento. Lo stato arriva dal client e torna nello snapshot (server stateless).
    // Scena inesistente → NotFoundException; scelta non valida → InvalidParametersException.
    private static StorySnapshot Play(IStory story, string? sceneId, string? choiceId, Dictionary<string, object>? stats)
    {
        var snapshot = Play(story, sceneId, choiceId, ToGameState(stats));
        return snapshot ?? throw new NotFoundException("scena");
    }

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

    // Il body JSON deserializza i valori come JsonElement: qui tornano tipi .NET
    // primitivi, così i lambda delle storie leggono int/bool/string senza sorprese.
    private static GameState ToGameState(Dictionary<string, object>? dict)
    {
        static object UnwrapElement(JsonElement je) => je.ValueKind switch
        {
            JsonValueKind.Number when je.TryGetInt32(out var i) => i,
            JsonValueKind.Number when je.TryGetInt64(out long l) => l,
            JsonValueKind.Number => je.GetDouble(),
            JsonValueKind.String => je.GetString()!,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => je.GetRawText()
        };
        if (dict is null) return new GameState();
        var unwrapped = dict.ToDictionary(
            kvp => kvp.Key,
            kvp => kvp.Value is JsonElement je ? UnwrapElement(je) : kvp.Value);
        return new GameState(unwrapped);
    }
}
