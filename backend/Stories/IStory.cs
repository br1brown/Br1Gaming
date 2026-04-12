namespace Backend.Stories;

/// <summary>
/// Contratto che ogni storia implementa.
/// GetScene riceve lo stato corrente e restituisce la scena costruita per quello stato.
/// </summary>
public interface IStory
{
    string Slug { get; }
    string Title { get; }
    string? Description { get; }
    string StartSceneId { get; }
    Dictionary<string, object> InitialState { get; }

    bool HasScene(string id);

    /// <summary>
    /// Costruisce la scena per l'ID dato, usando lo stato corrente per
    /// calcolare testo, visibilità delle scelte e routing.
    /// </summary>
    SceneDef GetScene(string id, GameState state);
}
