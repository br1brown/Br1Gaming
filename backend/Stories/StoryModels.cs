namespace Backend.Stories;

/// <summary>
/// Stato di gioco: dizionario aperto string → qualsiasi valore.
/// I lambda di SceneDef e ChoiceDef ricevono e mutano questo oggetto direttamente.
/// </summary>
public class GameState
{
    private readonly Dictionary<string, object> _data;

    public GameState() => _data = [];

    public GameState(Dictionary<string, object> initial) => _data = new(initial);

    /// <summary>Legge un valore tipizzato con fallback se assente o tipo errato.</summary>
    public T Get<T>(string key, T @default = default!)
    {
        if (!_data.TryGetValue(key, out var v)) return @default;
        if (v is T t) return t;
        try { return (T)Convert.ChangeType(v, typeof(T)); }
        catch { return @default; }
    }

    /// <summary>Scrive un valore (qualsiasi tipo).</summary>
    public void Set(string key, object value) => _data[key] = value;

    /// <summary>Verifica se la chiave esiste.</summary>
    public bool Has(string key) => _data.ContainsKey(key);

    /// <summary>Copia esportabile per la serializzazione.</summary>
    public Dictionary<string, object> ToDictionary() => new(_data);
}

/// <summary>
/// Definizione di una scelta all'interno di una scena.
/// Effect è l'unico lambda residuo: gira quando il giocatore fa la scelta,
/// muta lo stato come vuole e restituisce il testo della conseguenza (o null).
/// </summary>
public class ChoiceDef
{
    /// <summary>Identificatore univoco della scelta.</summary>
    public required string Id { get; init; }

    /// <summary>Testo mostrato al giocatore.</summary>
    public required string Text { get; init; }

    /// <summary>ID della scena di destinazione.</summary>
    public required string NextSceneId { get; init; }

    /// <summary>
    /// Visibilità della scelta. Calcolata nell'outer lambda della scena.
    /// Default true = sempre visibile.
    /// </summary>
    public bool IsVisible { get; init; } = true;

    /// <summary>
    /// Effetto della scelta: muta lo stato (qualsiasi tipo) e restituisce
    /// il testo della conseguenza, oppure null se non c'è nulla da mostrare.
    /// </summary>
    public Func<GameState, string?>? Effect { get; init; }
}

/// <summary>
/// Definizione di una scena narrativa.
/// Text e RouteToScene sono già calcolati per lo stato corrente nell'outer lambda.
/// </summary>
public class SceneDef
{
    /// <summary>Testo della scena, già calcolato per lo stato corrente.</summary>
    public required string Text { get; init; }

    /// <summary>Se true, questa è una scena di finale (nessuna scelta).</summary>
    public bool IsEnding { get; init; }

    /// <summary>Titolo del finale, visibile solo se IsEnding è true.</summary>
    public string? EndingTitle { get; init; }

    /// <summary>Lista delle scelte disponibili. IsVisible su ciascuna gestisce il filtraggio.</summary>
    public List<ChoiceDef> Choices { get; init; } = [];

    /// <summary>
    /// Se non null, reindirizza automaticamente verso un'altra scena.
    /// Calcolato nell'outer lambda, già determinato per lo stato corrente.
    /// </summary>
    public string? RouteToScene { get; init; }
}
