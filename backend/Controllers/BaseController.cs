using Microsoft.AspNetCore.Mvc;
using Backend.Infrastructure;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers;

[Route("api")]
public class BaseController : EngineBaseController
{
    private readonly SiteService _service;

    public BaseController(SiteService service, IContentStore store, ILogger<BaseController> logger)
        : base(store, logger)
    {
        _service = service;
    }

    // ── Storie ───────────────────────────────────────────────────────

    [HttpGet("stories")]
    public async Task<IActionResult> GetCatalog()
    {
        var items = await _service.GetCatalogAsync();
        var dtos = items.Select(i => new StorySummaryDto(i.Slug, i.Title, i.Description, i.CoverImage)).ToList();
        return Ok(dtos);
    }

    [HttpPost("stories/{slug}/start")]
    public async Task<IActionResult> Start(string slug)
    {
        try
        {
            var snapshot = await _service.StartAsync(slug);
            return Ok(MapSnapshot(snapshot));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("stories/{slug}/resume")]
    public async Task<IActionResult> Resume(string slug, [FromBody] StoryResumeRequestDto body)
    {
        var stats = body.Stats ?? new Dictionary<string, int>();
        var snapshot = await _service.GetSceneAsync(slug, body.SceneId, stats);
        if (snapshot is null) return NotFound();
        return Ok(MapSnapshot(snapshot));
    }

    [HttpPost("stories/{slug}/choose")]
    public async Task<IActionResult> Choose(string slug, [FromBody] StoryChoiceRequestDto body)
    {
        try
        {
            var stats = body.Stats ?? new Dictionary<string, int>();
            var snapshot = await _service.ChooseAsync(slug, body.CurrentSceneId, body.ChoiceId, stats);
            return Ok(MapSnapshot(snapshot));
        }
        catch (KeyNotFoundException ex) when (ex.Message.Contains("Story"))
        {
            return NotFound();
        }
        catch (KeyNotFoundException)
        {
            return BadRequest();
        }
    }

    private static StorySnapshotDto MapSnapshot(StorySnapshot snapshot) => new()
    {
        StorySlug = snapshot.StorySlug,
        SceneId = snapshot.SceneId,
        SceneText = snapshot.Scene.Text,
        Choices = snapshot.Choices.Select(c => new ChoiceDto(c.Id, c.Text)).ToList(),
        IsEnding = snapshot.IsEnding,
        Consequences = snapshot.Consequences,
        ChosenChoiceText = snapshot.ChosenChoiceText,
        EndingTitle = snapshot.Scene.EndingTitle,
        Stats = snapshot.Stats
    };

    // ── Generatori ───────────────────────────────────────────────────

    [HttpGet("generators")]
    public async Task<IActionResult> GetAllGenerators()
    {
        var items = await _service.GetGeneratorCatalogAsync();
        var dtos = items.Select(i => new GeneratorInfoDto(i.Slug, i.Name ?? i.Slug, i.Description)).ToList();
        return Ok(dtos);
    }

    [HttpGet("generators/{slug}")]
    public async Task<IActionResult> GetGeneratorBySlug(string slug)
    {
        var item = await _service.GetGeneratorBySlugAsync(slug);
        if (item is null) return NotFound();
        return Ok(new GeneratorInfoDto(item.Slug, item.Name ?? item.Slug, item.Description));
    }

    [HttpPost("generators/{slug}/generate")]
    public async Task<IActionResult> Generate(string slug, [FromBody] GenerateRequestDto? body)
    {
        try
        {
            var request = new GenerationRequest(body?.IncludeHtml ?? false);
            var result = await _service.GenerateAsync(slug, request);
            return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    // ── DTO ──────────────────────────────────────────────────────────

    public sealed record StorySummaryDto(string Slug, string Title, string? Description, string? CoverImage);
    public sealed record StoryResumeRequestDto(string SceneId, Dictionary<string, int>? Stats);
    public sealed record StoryChoiceRequestDto(string CurrentSceneId, string ChoiceId, Dictionary<string, int>? Stats);
    public sealed record ChoiceDto(string Id, string Text);
    public sealed record GeneratorInfoDto(string Slug, string Name, string? Description);
    public sealed record GenerateRequestDto(bool IncludeHtml = false);
    public sealed record GenerateResponseDto(string Text, string Markdown, string? Html);

    public sealed class StorySnapshotDto
    {
        public string StorySlug { get; set; } = "";
        public string SceneId { get; set; } = "";
        public string SceneText { get; set; } = "";
        public List<ChoiceDto> Choices { get; set; } = [];
        public bool IsEnding { get; set; }
        public string? Consequences { get; set; }
        public string? ChosenChoiceText { get; set; }
        public string? EndingTitle { get; set; }
        public Dictionary<string, int> Stats { get; set; } = [];
    }
}
