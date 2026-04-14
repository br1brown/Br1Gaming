using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Backend.Infrastructure;
using Backend.Models;
using Backend.Services;
using Backend.Stories;

namespace Backend.Controllers;

[Route("api")]
public class BaseController : EngineBaseController
{
    private readonly StoryRegistry _registry;
    private readonly StoryEngine _engine;
    private readonly SiteService _service;

    public BaseController(
        StoryRegistry registry,
        StoryEngine engine,
        SiteService service,
        IContentStore store,
        ILogger<BaseController> logger)
        : base(store, logger)
    {
        _registry = registry;
        _engine = engine;
        _service = service;
    }

    // ── Storie ───────────────────────────────────────────────────────

    [HttpGet("stories")]
    public IActionResult GetCatalog()
    {
        var dtos = _registry.GetAll()
            .Select(s => new StorySummaryDto(s.Slug, s.Title, s.Description))
            .ToList();
        return Ok(dtos);
    }

    [HttpPost("stories/{slug}/start")]
    public IActionResult Start(string slug)
    {
        var story = _registry.Get(slug) ?? throw new NotFoundException($"storia '{slug}'");
        return Ok(MapSnapshot(_engine.Start(story), story));
    }

    [HttpPost("stories/{slug}/resume")]
    public IActionResult Resume(string slug, [FromBody] StoryResumeRequestDto body)
    {
        var story = _registry.Get(slug) ?? throw new NotFoundException($"storia '{slug}'");
        var state = ToGameState(body.Stats);
        var snapshot = _engine.Resume(story, body.SceneId, state);
        if (snapshot is null) return NotFound();
        return Ok(MapSnapshot(snapshot, story));
    }

    [HttpPost("stories/{slug}/choose")]
    public IActionResult Choose(string slug, [FromBody] StoryChoiceRequestDto body)
    {
        var story = _registry.Get(slug) ?? throw new NotFoundException($"storia '{slug}'");
        var state = ToGameState(body.Stats);
        var snapshot = _engine.Choose(story, body.CurrentSceneId, body.ChoiceId, state);
        return Ok(MapSnapshot(snapshot, story));
    }

    // Converte il dizionario che arriva dal client (valori come JsonElement) in GameState
    private static GameState ToGameState(Dictionary<string, object>? dict)
    {
        if (dict is null) return new GameState();
        var unwrapped = dict.ToDictionary(
            kvp => kvp.Key,
            kvp => kvp.Value is JsonElement je ? UnwrapElement(je) : kvp.Value);
        return new GameState(unwrapped);
    }

    private static object UnwrapElement(JsonElement je) => je.ValueKind switch
    {
        JsonValueKind.Number when je.TryGetInt32(out var i) => i,
        JsonValueKind.Number when je.TryGetInt64(out var l) => l,
        JsonValueKind.Number => je.GetDouble(),
        JsonValueKind.String => je.GetString()!,
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        _ => je.GetRawText()
    };

    private static StorySnapshotDto MapSnapshot(StorySnapshot s, IStory story) => new()
    {
        StorySlug = s.StorySlug,
        StoryTitle = story.Title,
        SceneId = s.SceneId,
        SceneText = s.SceneText,
        Choices = s.Choices.Select(c => new ChoiceDto(c.Id, c.Text)).ToList(),
        IsEnding = s.IsEnding,
        Consequences = s.Consequences,
        ChosenChoiceText = s.ChosenChoiceText,
        EndingTitle = s.EndingTitle,
        Stats = s.State   // "stats" per compatibilità col frontend esistente
    };

    // ── Generatori ───────────────────────────────────────────────────

    [HttpGet("generators")]
    public async Task<IActionResult> GetAllGenerators()
    {
        var items = await _service.GetGeneratorCatalogAsync();
        return Ok(items
            .Where(i => GeneratorRegistry.IsValid(i.Slug))
            .Select(i => new GeneratorInfoDto(i.Slug, i.Name ?? i.Slug, i.Description)));
    }

    [HttpGet("generators/incel")]
    public Task<IActionResult> GetIncel() => GetGenerator(GeneratorRegistry.Incel);

    [HttpGet("generators/auto")]
    public Task<IActionResult> GetAuto() => GetGenerator(GeneratorRegistry.Auto);

    [HttpGet("generators/antiveg")]
    public Task<IActionResult> GetAntiveg() => GetGenerator(GeneratorRegistry.Antiveg);

    [HttpGet("generators/locali")]
    public Task<IActionResult> GetLocali() => GetGenerator(GeneratorRegistry.Locali);

    [HttpGet("generators/mbeb")]
    public Task<IActionResult> GetMbeb() => GetGenerator(GeneratorRegistry.Mbeb);

    [HttpPost("generators/incel/generate")]
    public Task<IActionResult> GenerateIncel([FromBody] GenerateRequestDto? body) => GenerateWith(GeneratorRegistry.Incel, body);

    [HttpPost("generators/auto/generate")]
    public Task<IActionResult> GenerateAuto([FromBody] GenerateRequestDto? body) => GenerateWith(GeneratorRegistry.Auto, body);

    [HttpPost("generators/antiveg/generate")]
    public Task<IActionResult> GenerateAntiveg([FromBody] GenerateRequestDto? body) => GenerateWith(GeneratorRegistry.Antiveg, body);

    [HttpPost("generators/locali/generate")]
    public Task<IActionResult> GenerateLocali([FromBody] GenerateRequestDto? body) => GenerateWith(GeneratorRegistry.Locali, body);

    [HttpPost("generators/mbeb/generate")]
    public Task<IActionResult> GenerateMbeb([FromBody] GenerateRequestDto? body) => GenerateWith(GeneratorRegistry.Mbeb, body);

    private async Task<IActionResult> GetGenerator(GeneratorEntry entry)
    {
        var item = await _service.GetGeneratorBySlugAsync(entry.Slug);
        if (item is null) return NotFound();
        return Ok(new GeneratorInfoDto(item.Slug, item.Name ?? entry.DisplayName, item.Description));
    }

    private async Task<IActionResult> GenerateWith(GeneratorEntry entry, GenerateRequestDto? body)
    {
        var result = await _service.GenerateAsync(entry.Slug, new GenerationRequest(body?.IncludeHtml ?? false));
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // ── DTO ──────────────────────────────────────────────────────────

    public sealed record StorySummaryDto(string Slug, string Title, string? Description);
    public sealed record StoryResumeRequestDto(string SceneId, Dictionary<string, object>? Stats);
    public sealed record StoryChoiceRequestDto(string CurrentSceneId, string ChoiceId, Dictionary<string, object>? Stats);
    public sealed record ChoiceDto(string Id, string Text);
    public sealed record GeneratorInfoDto(string Slug, string Name, string? Description);
    public sealed record GenerateRequestDto(bool IncludeHtml = false);
    public sealed record GenerateResponseDto(string Text, string Markdown, string? Html);

    public sealed class StorySnapshotDto
    {
        public string StorySlug { get; set; } = "";
        public string StoryTitle { get; set; } = "";
        public string SceneId { get; set; } = "";
        public string SceneText { get; set; } = "";
        public List<ChoiceDto> Choices { get; set; } = [];
        public bool IsEnding { get; set; }
        public string? Consequences { get; set; }
        public string? ChosenChoiceText { get; set; }
        public string? EndingTitle { get; set; }
        public Dictionary<string, object> Stats { get; set; } = [];   // "stats" per il frontend
    }
}
