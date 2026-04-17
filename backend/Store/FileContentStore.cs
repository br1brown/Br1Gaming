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
        return generators.OrderBy(g => g.Info?.Order ?? 999).ToList();
    }

    public async Task<GeneratorData?> GetGeneratorAsync(string slug)
    {
        var file = Path.Combine(_generatorsPath, $"{slug}.json");
        if (!File.Exists(file)) return null;
        return await LoadGeneratorAsync(slug, file);
    }

    public async Task<SharedData> GetSharedDataAsync()
    {
        var file = Path.Combine(_generatorsPath, "shared.json");
        if (!File.Exists(file))
            return new SharedData([], [], [], []);

        var shared = await LoadGeneratorAsync("shared", file);
        if (shared is null)
            return new SharedData([], [], [], []);

        return new SharedData(
            shared.FlatLists,
            shared.PolicyGroups ?? [],
            shared.ComposedLists ?? [],
            shared.AgeAliases ?? []);
    }

    private static async Task<GeneratorData?> LoadGeneratorAsync(string slug, string filePath)
    {
        var json = await File.ReadAllTextAsync(filePath);
        var generator = JsonSerializer.Deserialize<GeneratorData>(json, JsonOptions);
        if (generator is null) return null;
        generator.Slug = slug;
        return generator;
    }
}
