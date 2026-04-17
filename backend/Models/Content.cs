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
    // Informazioni di catalogo e identità
    public record GeneratorInfo(string? Name, string? Description, int? Order);

    // Regole di composizione del testo
    public record GenerationSettings(int? MinPhrases, int? MaxPhrases, List<string>? Separators);

    // Quota di frasi "identitarie" (da usare se il Manager decide di mixare)
    public record RequiredInjectData(int Min, int Max, List<string> Phrases);

    public string Slug { get; set; } = "";

    public GeneratorInfo? Info { get; set; }
    public GenerationSettings? PhraseSettings { get; set; }
    public RequiredInjectData? CoreRequired { get; set; }

    // Componenti testuali
    public string? Prefix { get; set; }
    public string? Suffix { get; set; }
    public List<string> Core { get; set; } = [];

    // Vocabolario locale e logiche di filtro
    public Dictionary<string, List<string>> FlatLists { get; set; } = [];
    public Dictionary<string, List<string>>? PolicyGroups { get; set; }
    public Dictionary<string, List<string>>? ComposedLists { get; set; }
    public Dictionary<string, string>? AgeAliases { get; set; }
    public List<string>? UniqueLabels { get; set; }
    public List<string>? ExclusiveGroups { get; set; }
}

