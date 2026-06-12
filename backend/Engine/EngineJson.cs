using System.Text.Json;
using System.Text.Json.Serialization;

namespace Backend.Engine;

/// <summary>
/// Opzioni <see cref="JsonSerializerOptions"/> condivise per i JSON di contenuto (cartella <c>data/</c>).
/// </summary>
/// <remarks>
/// Un'unica istanza per tutto il backend: System.Text.Json memorizza i metadata dei tipi
/// per istanza di opzioni, quindi condividerla evita di ricostruirli a ogni consumatore.
/// Convenzioni web (camelCase, case-insensitive) più enum letti/scritti come stringhe.
/// </remarks>
public static class EngineJson
{
    /// <summary>
    /// Opzioni con convenzioni web e <see cref="JsonStringEnumConverter"/>.
    /// </summary>
    public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };
}
