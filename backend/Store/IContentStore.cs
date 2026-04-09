using Backend.Models;

namespace Backend.Infrastructure;

public interface IContentStore
{
    Task<List<StoryData>> GetStoriesAsync();
    Task<StoryData?> GetStoryAsync(string slug);
    Task<List<GeneratorData>> GetGeneratorsAsync();
    Task<GeneratorData?> GetGeneratorAsync(string slug);
    Task<Dictionary<string, List<string>>> GetSharedListsAsync();
}
