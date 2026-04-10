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
