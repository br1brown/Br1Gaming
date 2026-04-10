namespace Backend.Stories;

/// <summary>
/// Definizione di una scena narrativa.
/// Viene costruita da una Func&lt;GameState, SceneDef&gt; nel dizionario della storia,
/// quindi ha già accesso allo stato corrente al momento della creazione.
/// Text e RouteToScene sono stringhe semplici: il calcolo condizionale avviene nell'outer lambda.
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
