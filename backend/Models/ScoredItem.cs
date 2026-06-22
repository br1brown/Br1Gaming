using System.Text.Json;
using System.Text.Json.Serialization;

namespace Backend.Models;

/// <summary>
/// Voce testuale di un generatore (una frase del <c>core</c> o un elemento di una <c>flatList</c>)
/// con un punteggio opzionale che ne esprime il peso (rarità/notabilità).
/// </summary>
/// <remarks>
/// Retro-compatibile col formato storico: nel JSON una voce può essere
/// <list type="bullet">
///   <item>una stringa semplice (<c>"cazzo"</c>) → nessun punteggio esplicito (<see cref="Score"/> = null);</item>
///   <item>un oggetto (<c>{ "text": "cazzo", "score": 5 }</c>) → testo + punteggio.</item>
/// </list>
/// Il default del punteggio dipende dal contesto e NON è deciso qui: una frase senza
/// punteggio vale <see cref="PhraseScore"/> (neutro = 0), un elemento senza punteggio vale
/// <see cref="ElementValue"/> (identità moltiplicativa = 1).
/// </remarks>
/// <param name="Text">Il testo della voce (frase con segnaposto o parola che riempie un segnaposto).</param>
/// <param name="Score">Punteggio esplicito, o <c>null</c> se non specificato nel JSON.</param>
[JsonConverter(typeof(ScoredItemJsonConverter))]
public sealed record ScoredItem(string Text, double? Score = null)
{
    /// <summary>Punteggio base quando la voce è usata come frase del core (assente = 0, neutro).</summary>
    [JsonIgnore]
    public double PhraseScore => Score ?? 0;

    /// <summary>Valore quando la voce è usata come elemento di un segnaposto (assente = 1, identità del prodotto).</summary>
    [JsonIgnore]
    public double ElementValue => Score ?? 1;
}

/// <summary>
/// Converter che legge/scrive una <see cref="ScoredItem"/> come stringa semplice oppure come
/// oggetto <c>{ "text"|"value": ..., "score": ... }</c>, mantenendo la retro-compatibilità coi
/// file JSON esistenti (liste di stringhe pure).
/// </summary>
public sealed class ScoredItemJsonConverter : JsonConverter<ScoredItem>
{
    /// <inheritdoc />
    public override ScoredItem Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.String:
                return new ScoredItem(reader.GetString() ?? string.Empty, null);

            case JsonTokenType.StartObject:
                string? text = null;
                double? score = null;
                while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
                {
                    if (reader.TokenType != JsonTokenType.PropertyName) continue;
                    var name = reader.GetString();
                    reader.Read();
                    // "text" o "value" indicano la stringa; "score" il punteggio. Confronto case-insensitive.
                    if (string.Equals(name, "text", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(name, "value", StringComparison.OrdinalIgnoreCase))
                        text = reader.GetString();
                    else if (string.Equals(name, "score", StringComparison.OrdinalIgnoreCase))
                        score = reader.TokenType == JsonTokenType.Null ? (double?)null : reader.GetDouble();
                    else
                        reader.Skip();
                }
                return new ScoredItem(text ?? string.Empty, score);

            default:
                throw new JsonException($"ScoredItem: token {reader.TokenType} non supportato (attesi stringa o oggetto).");
        }
    }

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, ScoredItem value, JsonSerializerOptions options)
    {
        // Senza punteggio resta una stringa pura (round-trip identico al formato storico).
        if (value.Score is null)
        {
            writer.WriteStringValue(value.Text);
            return;
        }
        writer.WriteStartObject();
        writer.WriteString("text", value.Text);
        writer.WriteNumber("score", value.Score.Value);
        writer.WriteEndObject();
    }
}
