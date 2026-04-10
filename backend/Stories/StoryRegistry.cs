namespace Backend.Stories;

/// <summary>
/// Registro di tutte le storie disponibili.
/// Risolve slug → IStory. Registrato come Singleton in DI.
/// Per aggiungere una storia: implementa IStory e registrala in Program.cs.
/// </summary>
public class StoryRegistry
{
    private readonly Dictionary<string, IStory> _map;

    public StoryRegistry(IEnumerable<IStory> stories)
    {
        _map = stories.ToDictionary(s => s.Slug);
    }

    public IStory? Get(string slug) => _map.GetValueOrDefault(slug);
    public IEnumerable<IStory> GetAll() => _map.Values;
}
