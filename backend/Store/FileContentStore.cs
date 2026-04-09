using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Models;

namespace Backend.Infrastructure;

public class FileContentStore : IContentStore
{
    private readonly string _storiesPath;
    private readonly string _generatorsPath;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public FileContentStore(IWebHostEnvironment env)
    {
        var dataPath = Path.Combine(env.ContentRootPath, "data");
        _storiesPath = Path.Combine(dataPath, "stories");
        _generatorsPath = Path.Combine(dataPath, "generators");
    }

    public async Task<List<StoryData>> GetStoriesAsync()
    {
        if (!Directory.Exists(_storiesPath))
            return [];

        var stories = new List<StoryData>();
        foreach (var file in Directory.GetFiles(_storiesPath, "*.json"))
        {
            var slug = Path.GetFileNameWithoutExtension(file);
            var story = await LoadStoryAsync(slug, file);
            if (story is not null)
                stories.Add(story);
        }
        return stories;
    }

    public async Task<StoryData?> GetStoryAsync(string slug)
    {
        var file = Path.Combine(_storiesPath, $"{slug}.json");
        if (!File.Exists(file)) return null;
        return await LoadStoryAsync(slug, file);
    }

    private static async Task<StoryData?> LoadStoryAsync(string slug, string filePath)
    {
        var json = await File.ReadAllTextAsync(filePath);
        var story = JsonSerializer.Deserialize<StoryData>(json, JsonOptions);
        // Lo slug viene derivato dal nome del file — non serve nel JSON
        return story is not null ? story with { Slug = slug } : null;
    }

    public async Task<List<GeneratorData>> GetGeneratorsAsync()
    {
        if (!Directory.Exists(_generatorsPath))
            return [];

        var generators = new List<GeneratorData>();
        foreach (var file in Directory.GetFiles(_generatorsPath, "*.json"))
        {
            var slug = Path.GetFileNameWithoutExtension(file);
            if (slug == "shared") continue;

            var generator = await LoadGeneratorAsync(slug, file);
            if (generator is not null)
                generators.Add(generator);
        }
        return generators;
    }

    public async Task<GeneratorData?> GetGeneratorAsync(string slug)
    {
        var file = Path.Combine(_generatorsPath, $"{slug}.json");
        if (!File.Exists(file)) return null;
        return await LoadGeneratorAsync(slug, file);
    }

    public async Task<Dictionary<string, List<string>>> GetSharedListsAsync()
    {
        var file = Path.Combine(_generatorsPath, "shared.json");
        if (!File.Exists(file)) return [];
        var generator = await LoadGeneratorAsync("shared", file);
        return generator?.FlatLists ?? [];
    }

    private static async Task<GeneratorData?> LoadGeneratorAsync(string slug, string filePath)
    {
        var json = await File.ReadAllTextAsync(filePath);
        var generator = JsonSerializer.Deserialize<GeneratorData>(json, JsonOptions);
        if (generator is null) return null;
        // Lo slug viene derivato dal nome del file — non serve nel JSON
        generator.Slug = slug;
        return generator;
    }
}
