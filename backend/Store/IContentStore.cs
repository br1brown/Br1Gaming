using Backend.Models;

namespace Backend.Infrastructure;

/// <summary>Dati condivisi tra tutti i generatori (caricati da shared.json).</summary>
public record SharedData(
    Dictionary<string, List<string>> FlatLists,
    Dictionary<string, List<string>> PolicyGroups,
    Dictionary<string, List<string>> ComposedLists,
    Dictionary<string, string> RangeAliases);

public interface IContentStore
{
    Task<List<GeneratorData>> GetGeneratorsAsync();
    Task<GeneratorData?> GetGeneratorAsync(string slug);
    Task<SharedData> GetSharedDataAsync();
}
