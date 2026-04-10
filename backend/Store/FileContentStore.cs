using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Models;

namespace Backend.Infrastructure;

public class FileContentStore : IContentStore
{
    private readonly string _generatorsPath;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public FileContentStore(IWebHostEnvironment env)
    {
        var dataPath = Path.Combine(env.ContentRootPath, "data");
        _generatorsPath = Path.Combine(dataPath, "generators");
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

    public async Task<Dictionary<string, List<string>>> GetPolicyGroupsAsync()
    {
        var file = Path.Combine(_generatorsPath, "shared.json");
        if (!File.Exists(file)) return [];
        var generator = await LoadGeneratorAsync("shared", file);
        return generator?.PolicyGroups ?? [];
    }

    public async Task<Dictionary<string, List<string>>> GetComposedListsAsync()
    {
        var file = Path.Combine(_generatorsPath, "shared.json");
        if (!File.Exists(file)) return [];
        var generator = await LoadGeneratorAsync("shared", file);
        return generator?.ComposedLists ?? [];
    }

    public async Task<Dictionary<string, string>> GetRangeAliasesAsync()
    {
        var file = Path.Combine(_generatorsPath, "shared.json");
        if (!File.Exists(file)) return [];
        var generator = await LoadGeneratorAsync("shared", file);
        return generator?.RangeAliases ?? [];
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
