namespace Backend.Stories;

/// <summary>
/// Contratto che ogni storia implementa.
/// GetScene riceve lo stato corrente e restituisce la scena costruita per quello stato.
/// </summary>
public interface IStory
{
    /// <summary>Slug univoco della storia (usato nell'URL e nel registro).</summary>
    string Slug { get; }

    /// <summary>Titolo della storia.</summary>
    string Title { get; }

    /// <summary>Descrizione breve per catalogo e SEO, o null.</summary>
    string? Description { get; }

    /// <summary>ID della scena di partenza.</summary>
    string StartSceneId { get; }

    /// <summary>Stato di gioco iniziale (copiato a ogni nuova partita).</summary>
    Dictionary<string, object> InitialState { get; }

    /// <summary>Verifica se la scena esiste nella storia.</summary>
    bool HasScene(string id);

    /// <summary>
    /// Costruisce la scena per l'ID dato, usando lo stato corrente per
    /// calcolare testo, visibilità delle scelte e routing.
    /// </summary>
    SceneDef GetScene(string id, GameState state);
}
