namespace Backend.Models;

// ── Condizione sulle stat ─────────────────────────────────────────────
// Tutti i vincoli specificati devono essere soddisfatti. I campi omessi vengono ignorati.
// Esempio: { stat: "percezionePublica", gte: 5 } → PP >= 5

public record StatCondition(string Stat, int? Gte, int? Lte, int? Gt, int? Lt)
{
    public bool Evaluate(Dictionary<string, int> stats)
    {
        var val = stats.TryGetValue(Stat, out var v) ? v : 0;
        if (Gte.HasValue && val < Gte.Value) return false;
        if (Lte.HasValue && val > Lte.Value) return false;
        if (Gt.HasValue  && val <= Gt.Value)  return false;
        if (Lt.HasValue  && val >= Lt.Value)  return false;
        return true;
    }
}

// ── Testo condizionale (usato per conditionalIntro e conditionalConsequences) ────────
// When == null → entry di default / fallback

public record ConditionalEntry(
    StatCondition? When,
    string Text,
    Dictionary<string, int>? StatChanges);

// ── Smistamento al finale basato sulle stat ───────────────────────────
// When == null → entry di default / fallback

public record StatEndingEntry(StatCondition? When, string SceneId);

// ── Modelli dati della storia ─────────────────────────────────────────

public record StoryChoiceArgs(
    string NextSceneId,
    string? Consequences,
    Dictionary<string, int>? StatChanges,
    List<ConditionalEntry>? ConditionalConsequences);

public record StoryChoiceData(
    string Id,
    string Text,
    StoryChoiceArgs Args,
    StatCondition? Condition);

public record StoryScene(
    string Text,
    bool IsEnding,
    string? EndingTitle,
    List<StoryChoiceData> Choices,
    List<ConditionalEntry>? ConditionalIntro,
    List<StatEndingEntry>? StatEnding);

public record StoryData(
    string Slug,
    string Title,
    string? Description,
    string? CoverImage,
    string StartSceneId,
    string? Visibility,
    List<string>? Tags,
    Dictionary<string, int>? InitialStats,
    Dictionary<string, StoryScene> Scenes);

// ── Snapshot (stateless — nessuna sessione lato server) ──────────────

public record StorySnapshot(
    string StorySlug,
    string SceneId,
    StoryScene Scene,
    List<StoryChoiceData> Choices,
    bool IsEnding,
    string? Consequences,
    string? ChosenChoiceText,
    Dictionary<string, int> Stats);

// ── Modello dati del generatore ───────────────────────────────────────

public class GeneratorData
{
    public string Slug { get; set; } = "";
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Prefix { get; set; }
    public List<string> Core { get; set; } = [];
    public Dictionary<string, List<string>> FlatLists { get; set; } = [];
    public int? MinPhrases { get; set; }
    public int? MaxPhrases { get; set; }
    public List<string>? Separators { get; set; }
}
