using Backend.Stories.Catalog;

namespace Backend.Stories;

/// <summary>
/// Registro di tutte le storie disponibili.
/// Risolve slug → IStory. Per aggiungere una storia: implementa IStory e aggiungila qui.
/// </summary>
public class StoryRegistry
{
    private static readonly IStory[] All =
    [
        new PoveriMaschiStory(),
        new Magrogamer09Story(),
    ];

    private readonly Dictionary<string, IStory> _map =
        All.ToDictionary(s => s.Slug);

    public IStory? Get(string slug) => _map.GetValueOrDefault(slug);
    public IEnumerable<IStory> GetAll() => _map.Values;
}
