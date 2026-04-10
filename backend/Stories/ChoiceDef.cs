namespace Backend.Stories;

/// <summary>
/// Definizione di una scelta all'interno di una scena.
/// IsVisible viene calcolato nell'outer lambda della scena (ha già accesso allo stato).
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
