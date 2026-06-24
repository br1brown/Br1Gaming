namespace Backend.Models;

/// <summary>
/// Voce testuale di un generatore (una frase del <c>core</c> o un elemento di una <c>flatList</c>)
/// con un punteggio che ne esprime il peso (rarità/notabilità).
/// </summary>
/// <remarks>
/// Il punteggio è un <see cref="double"/> con default <c>1</c> (identità moltiplicativa): una voce
/// senza punteggio esplicito non sposta il prodotto dei valori degli elementi e pesa in modo neutro.
/// Per comodità una voce si scrive direttamente come stringa (<c>"testo"</c>, punteggio 1) o come
/// tupla (<c>("testo", 5)</c>) grazie alle conversioni implicite.
/// </remarks>
/// <param name="Text">Il testo della voce (frase con segnaposto o parola che riempie un segnaposto).</param>
/// <param name="Score">Punteggio della voce; default <c>1</c>.</param>
public sealed record ScoredItem(string Text, double Score = 1)
{
    /// <summary>
    /// Conversione implicita da stringa: una voce senza punteggio si scrive direttamente come
    /// <c>"testo"</c> (es. nelle liste dei generatori), senza <c>new ScoredItem(...)</c>.
    /// </summary>
    /// <param name="text">Il testo della voce.</param>
    public static implicit operator ScoredItem(string text) => new(text);

    /// <summary>
    /// Conversione implicita da tupla: una voce con punteggio si scrive come <c>("testo", 5)</c>.
    /// </summary>
    /// <param name="item">Coppia testo/punteggio.</param>
    public static implicit operator ScoredItem((string Text, double Score) item) => new(item.Text, item.Score);
}
