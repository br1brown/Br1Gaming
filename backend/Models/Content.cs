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
    public record GeneratorInfo {
        public string? Name { get; init; }
        public string? Description { get; init; }
        public int? Order { get; init; }
    }

    // Regole di composizione del testo
    public record GenerationSettings {
        public int? MinPhrases { get; init; }
        public int? MaxPhrases { get; init; }
        public List<string>? Separators { get; init; }
    }

    // Quota di frasi "identitarie" (da usare se il Manager decide di mixare)
    public record RequiredInjectData {
        public int Min { get; init; }
        public int Max { get; init; }
        public List<string> Phrases { get; init; } = [];
        
        public RequiredInjectData() { }
        public RequiredInjectData(int min, int max, List<string> phrases) {
            Min = min;
            Max = max;
            Phrases = phrases;
        }
    }

    public string Slug { get; set; } = "";

    public GeneratorInfo? Info { get; set; }
    public GenerationSettings? PhraseSettings { get; set; }
    public RequiredInjectData? CoreRequired { get; set; }

    // Componenti testuali
    public string? Apertura { get; set; }
    public string? Chiusura { get; set; }
    public List<string> Core { get; set; } = [];

    // Vocabolario locale e logiche di filtro
    public Dictionary<string, List<string>> FlatLists { get; set; } = [];
    public Dictionary<string, List<string>>? PolicyGroups { get; set; }
    public Dictionary<string, List<string>>? ComposedLists { get; set; }
    public Dictionary<string, string>? AgeAliases { get; set; }
    public List<string>? UniqueLabels { get; set; }
    public List<string>? ExclusiveGroups { get; set; }
}

