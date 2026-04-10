using Backend.Models;

namespace Backend.Infrastructure;

public interface IContentStore
{
    Task<List<GeneratorData>> GetGeneratorsAsync();
    Task<GeneratorData?> GetGeneratorAsync(string slug);
    Task<Dictionary<string, List<string>>> GetSharedListsAsync();
    Task<Dictionary<string, List<string>>> GetPolicyGroupsAsync();
    Task<Dictionary<string, List<string>>> GetComposedListsAsync();
    Task<Dictionary<string, string>> GetRangeAliasesAsync();
}
