namespace Backend.Models;

// ── Snapshot (stateless — nessuna sessione lato server) ──────────────

public record ChoiceSnapshot(string Id, string Text);

public record StorySnapshot(
    string StorySlug,
    string StoryTitle,
    string SceneId,
    string SceneText,
    string? EndingTitle,
    List<ChoiceSnapshot> Choices,
    bool IsEnding,
    string? Consequences,
    string? ChosenChoiceText,
    Dictionary<string, object> Stats);

// ── Modello dati del generatore ───────────────────────────────────────

public class GeneratorData
{
    public string Slug { get; set; } = "";
    public int? Order { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Prefix { get; set; }
    public string? Suffix { get; set; }
    public List<string> Core { get; set; } = [];
    public Dictionary<string, List<string>> FlatLists { get; set; } = [];
    public int? MinPhrases { get; set; }
    public int? MaxPhrases { get; set; }
    public List<string>? Separators { get; set; }
    public Dictionary<string, List<string>>? PolicyGroups { get; set; }
    public Dictionary<string, List<string>>? ComposedLists { get; set; }
    public Dictionary<string, string>? RangeAliases { get; set; }
    public List<string>? UniqueLabels { get; set; }
    public List<string>? ExclusiveGroups { get; set; }
}
