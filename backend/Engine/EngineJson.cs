using System.Text.Json;
using System.Text.Json.Serialization;

namespace Backend.Engine;

/// <summary>Opzioni <see cref="JsonSerializerOptions"/> condivise per i JSON di <c>data/</c>: un'unica istanza per tutto il backend evita di ricostruire i metadata dei tipi a ogni consumatore.</summary>
public static class EngineJson
{
    /// <summary>Convenzioni web (camelCase, case-insensitive) più enum come stringhe.</summary>
    public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };
}
