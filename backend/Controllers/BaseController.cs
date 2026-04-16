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
    private readonly StoryService _stories;
    private readonly GeneratorService _generators;

    public BaseController(
        StoryService stories,
        GeneratorService generators,
        IContentStore store,
        ILogger<BaseController> logger)
        : base(store, logger)
    {
        _stories = stories;
        _generators = generators;
    }

    // ── Storie: catalogo ─────────────────────────────────────────────

    [HttpGet("stories")]
    public IActionResult GetCatalog()
    {
        var dtos = _stories.GetCatalog()
            .Select(s => new StorySummaryDto(s.Slug, s.Title, s.Description))
            .ToList();
        return Ok(dtos);
    }

    // ── Storie: Poveri Maschi ─────────────────────────────────────────

    [HttpPost("stories/poveri-maschi/play")]
    public IActionResult PlayPoveriMaschi([FromBody] StoryPlayRequestDto body)
    {
        var snapshot = _stories.PlayPoveriMaschi(body.SceneId, body.ChoiceId, ToGameState(body.Stats));
        if (snapshot is null) return NotFound();
        return Ok(snapshot);
    }

    // ── Storie: Magrogamer09 ──────────────────────────────────────────

    [HttpPost("stories/magrogamer09/play")]
    public IActionResult PlayMagrogamer09([FromBody] StoryPlayRequestDto body)
    {
        var snapshot = _stories.PlayMagrogamer09(body.SceneId, body.ChoiceId, ToGameState(body.Stats));
        if (snapshot is null) return NotFound();
        return Ok(snapshot);
    }

    // ── Generatori: catalogo ─────────────────────────────────────────

    [HttpGet("generators")]
    public async Task<IActionResult> GetAllGenerators()
    {
        var items = await _generators.GetCatalogAsync();
        return Ok(items.Select(i => new GeneratorInfoDto(i.Slug, i.Name ?? i.Slug, i.Description)));
    }

    // ── Generatori: Incel ─────────────────────────────────────────────

    [HttpGet("generators/incel")]
    public async Task<IActionResult> GetIncel()
    {
        var item = await _generators.GetIncelAsync();
        if (item is null) return NotFound();
        return Ok(new GeneratorInfoDto(item.Slug, item.Name ?? item.Slug, item.Description));
    }

    [HttpPost("generators/incel/generate")]
    public async Task<IActionResult> GenerateIncel([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateIncelAsync(body?.IncludeHtml ?? false);
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // ── Generatori: Auto ──────────────────────────────────────────────

    [HttpGet("generators/auto")]
    public async Task<IActionResult> GetAuto()
    {
        var item = await _generators.GetAutoAsync();
        if (item is null) return NotFound();
        return Ok(new GeneratorInfoDto(item.Slug, item.Name ?? item.Slug, item.Description));
    }

    [HttpPost("generators/auto/generate")]
    public async Task<IActionResult> GenerateAuto([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateAutoAsync(body?.IncludeHtml ?? false);
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // ── Generatori: Antiveg ───────────────────────────────────────────

    [HttpGet("generators/antiveg")]
    public async Task<IActionResult> GetAntiveg()
    {
        var item = await _generators.GetAntivegAsync();
        if (item is null) return NotFound();
        return Ok(new GeneratorInfoDto(item.Slug, item.Name ?? item.Slug, item.Description));
    }

    [HttpPost("generators/antiveg/generate")]
    public async Task<IActionResult> GenerateAntiveg([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateAntivegAsync(body?.IncludeHtml ?? false);
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // ── Generatori: Locali ────────────────────────────────────────────

    [HttpGet("generators/locali")]
    public async Task<IActionResult> GetLocali()
    {
        var item = await _generators.GetLocaliAsync();
        if (item is null) return NotFound();
        return Ok(new GeneratorInfoDto(item.Slug, item.Name ?? item.Slug, item.Description));
    }

    [HttpPost("generators/locali/generate")]
    public async Task<IActionResult> GenerateLocali([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateLocaliAsync(body?.IncludeHtml ?? false);
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // ── Generatori: Mbeb ──────────────────────────────────────────────

    [HttpGet("generators/mbeb")]
    public async Task<IActionResult> GetMbeb()
    {
        var item = await _generators.GetMbebAsync();
        if (item is null) return NotFound();
        return Ok(new GeneratorInfoDto(item.Slug, item.Name ?? item.Slug, item.Description));
    }

    [HttpPost("generators/mbeb/generate")]
    public async Task<IActionResult> GenerateMbeb([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateMbebAsync(body?.IncludeHtml ?? false);
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // ── Utility ──────────────────────────────────────────────────────

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

    // ── DTO ──────────────────────────────────────────────────────────

    public sealed record StorySummaryDto(string Slug, string Title, string? Description);
    public sealed record StoryPlayRequestDto(string? SceneId, string? ChoiceId, Dictionary<string, object>? Stats);
    public sealed record GeneratorInfoDto(string Slug, string Name, string? Description);
    public sealed record GenerateRequestDto(bool IncludeHtml = false);
    public sealed record GenerateResponseDto(string Text, string Markdown, string? Html);
}
