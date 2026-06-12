using System.Text.Json;
using Backend.Models;
using Backend.Stories;
using Backend.Stories.Catalog;

namespace Backend.Services;

/// <summary>
/// Tutto ciò che riguarda le storie: istanze, catalogo, motore narrativo.
/// La superficie pubblica è fatta di wrapper tipizzati per storia (un metodo ciascuno):
/// i consumer non scrivono mai slug a mano, quindi non possono sbagliarli.
/// Per aggiungere una storia: creare la classe IStory in Stories/Catalog/, aggiungere
/// il campo statico qui sotto, includerla in GetCatalog() e aggiungere i wrapper GetXxx/PlayXxx.
/// </summary>
public class StoryService
{
    // ── Istanze storie — una per storia, slug incapsulato nella classe ──

    private static readonly PoveriMaschiStory PoveriMaschi = new();
    private static readonly Magrogamer09Story Magrogamer09 = new();
    private static readonly SurviveUsaStory SurviveUsa = new();

    /// <summary>Catalogo delle storie disponibili.</summary>
    public IEnumerable<IStory> GetCatalog() => [PoveriMaschi, Magrogamer09, SurviveUsa];

    // ── Info (wrapper per storia) ─────────────────────────────────────

    /// <summary>La storia "Siamo Maschi".</summary>
    public IStory GetPoveriMaschi() => PoveriMaschi;

    /// <summary>La storia "Magrogamer09".</summary>
    public IStory GetMagrogamer09() => Magrogamer09;

    /// <summary>La storia "Sopravviveresti agli USA?".</summary>
    public IStory GetSurviveUsa() => SurviveUsa;

    // ── Play (wrapper per storia) ─────────────────────────────────────

    /// <summary>Passo di gioco su "Siamo Maschi". Vedi <see cref="Play(IStory, string?, string?, Dictionary{string, object}?)"/>.</summary>
    /// <param name="sceneId">Scena corrente del client, o <c>null</c> per iniziare da capo.</param>
    /// <param name="choiceId">Scelta fatta nella scena corrente, o <c>null</c>.</param>
    /// <param name="stats">Stato di gioco salvato dal client, così come arriva dal JSON.</param>
    public StorySnapshot PlayPoveriMaschi(string? sceneId, string? choiceId, Dictionary<string, object>? stats)
        => Play(PoveriMaschi, sceneId, choiceId, stats);

    /// <summary>Passo di gioco su "Magrogamer09". Vedi <see cref="Play(IStory, string?, string?, Dictionary{string, object}?)"/>.</summary>
    /// <param name="sceneId">Scena corrente del client, o <c>null</c> per iniziare da capo.</param>
    /// <param name="choiceId">Scelta fatta nella scena corrente, o <c>null</c>.</param>
    /// <param name="stats">Stato di gioco salvato dal client, così come arriva dal JSON.</param>
    public StorySnapshot PlayMagrogamer09(string? sceneId, string? choiceId, Dictionary<string, object>? stats)
        => Play(Magrogamer09, sceneId, choiceId, stats);

    /// <summary>Passo di gioco su "Sopravviveresti agli USA?". Vedi <see cref="Play(IStory, string?, string?, Dictionary{string, object}?)"/>.</summary>
    /// <param name="sceneId">Scena corrente del client, o <c>null</c> per iniziare da capo.</param>
    /// <param name="choiceId">Scelta fatta nella scena corrente, o <c>null</c>.</param>
    /// <param name="stats">Stato di gioco salvato dal client, così come arriva dal JSON.</param>
    public StorySnapshot PlaySurviveUsa(string? sceneId, string? choiceId, Dictionary<string, object>? stats)
        => Play(SurviveUsa, sceneId, choiceId, stats);

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
