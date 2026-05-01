using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Backend.Infrastructure;
using Backend.Models;
using Backend.Services;
using Backend.Stories;

namespace Backend.Controllers;

/// <summary>
/// Controller concreto del progetto per gli endpoint pubblici (API key).
/// </summary>
/// <remarks>
/// Eredita sicurezza e logger da <see cref="EngineApiController"/>.
/// Aggiungere qui gli endpoint del progetto che non richiedono autenticazione utente.
/// </remarks>
[Route("")]
public class BaseController : EngineApiController
{
    private readonly StoryService _stories;
    private readonly GeneratorService _generators;

    public BaseController(
        StoryService stories,
        GeneratorService generators,
        ILogger<BaseController> logger)
        : base(logger)
    {
        _stories = stories;
        _generators = generators;
    }

    // ── Storie: catalogo e play ───────────────────────────────────────

    [HttpGet("stories")]
    public IActionResult GetCatalog()
    {
        var dtos = _stories.GetCatalog()
            .Select(s => new StorySummaryDto(s.Slug, s.Title, s.Description))
            .ToList();
        return Ok(dtos);
    }

    [HttpGet("stories/poveri-maschi")]
    public IActionResult GetPoveriMaschi()
    {
        var s = _stories.GetPoveriMaschi();
        return Ok(new StorySummaryDto(s.Slug, s.Title, s.Description));
    }

    [HttpGet("stories/magrogamer09")]
    public IActionResult GetMagrogamer09()
    {
        var s = _stories.GetMagrogamer09();
        return Ok(new StorySummaryDto(s.Slug, s.Title, s.Description));
    }

    [HttpPost("stories/poveri-maschi/play")]
    public IActionResult PlayPoveriMaschi([FromBody] StoryPlayRequestDto body)
    {
        var snapshot = _stories.PlayPoveriMaschi(body.SceneId, body.ChoiceId, ToGameState(body.Stats));
        if (snapshot is null) return NotFound();
        return Ok(snapshot);
    }

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
        return Ok(items.Select(i => new GeneratorInfoDto(
            i.Slug,
            i.Info?.Name ?? i.Slug,
            i.Info?.Description)));
    }

    // ── Generatori: Logica di Composizione ──────────────────────────

    // INCEL (Mix: Incel + Mbeb)
    [HttpGet("generators/incel")]
    public async Task<IActionResult> GetIncel() => await GetGeneratorInfo("incel");

    [HttpPost("generators/incel/generate")]
    public async Task<IActionResult> GenerateIncel([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateIncelAsync();
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // MBEB (Solo Mbeb)
    [HttpGet("generators/mbeb")]
    public async Task<IActionResult> GetMbeb() => await GetGeneratorInfo("mbeb");

    [HttpPost("generators/mbeb/generate")]
    public async Task<IActionResult> GenerateMbeb([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateMbebAsync();
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // AUTO
    [HttpGet("generators/auto")]
    public async Task<IActionResult> GetAuto() => await GetGeneratorInfo("auto");

    [HttpPost("generators/auto/generate")]
    public async Task<IActionResult> GenerateAuto([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateAutoAsync();
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // ANTIVEG
    [HttpGet("generators/antiveg")]
    public async Task<IActionResult> GetAntiveg() => await GetGeneratorInfo("antiveg");

    [HttpPost("generators/antiveg/generate")]
    public async Task<IActionResult> GenerateAntiveg([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateAntivegAsync();
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // LOCALI
    [HttpGet("generators/locali")]
    public async Task<IActionResult> GetLocali() => await GetGeneratorInfo("locali");

    [HttpPost("generators/locali/generate")]
    public async Task<IActionResult> GenerateLocali([FromBody] GenerateRequestDto? body)
    {
        var result = await _generators.GenerateLocaliAsync();
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // ── Helper Privati ───────────────────────────────────────────────

    private async Task<IActionResult> GetGeneratorInfo(string slug)
    {
        var items = await _generators.GetCatalogAsync();
        var item = items.FirstOrDefault(i => i.Slug == slug);
        if (item is null) return NotFound();
        return Ok(new GeneratorInfoDto(
            item.Slug,
            item.Info?.Name ?? item.Slug,
            item.Info?.Description));
    }

    private static GameState ToGameState(Dictionary<string, object>? dict)
    {
        Func<JsonElement, object> UnwrapElement = (JsonElement je) => je.ValueKind switch
        {
            JsonValueKind.Number when je.TryGetInt32(out var i) => i,
            JsonValueKind.Number when je.TryGetInt64(out long l) => l,
            JsonValueKind.Number => je.GetDouble(),
            JsonValueKind.String => je.GetString()!,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => je.GetRawText()
        };
        if (dict is null) return new GameState();
        var unwrapped = dict.ToDictionary(
            kvp => kvp.Key,
            kvp => kvp.Value is JsonElement je ? UnwrapElement(je) : kvp.Value);
        return new GameState(unwrapped);
    }

    // ── DTO ──────────────────────────────────────────────────────────

    public sealed record StorySummaryDto(string Slug, string Title, string? Description);
    public sealed record StoryPlayRequestDto(string? SceneId, string? ChoiceId, Dictionary<string, object>? Stats);
    public sealed record GeneratorInfoDto(string Slug, string Name, string? Description);
    public sealed record GenerateRequestDto(bool IncludeHtml = false);
    public sealed record CustomGenerateRequestDto(string[] Slugs, bool IncludeHtml = false);
    public sealed record GenerateResponseDto(string Text, string Markdown, string? Html);
}
