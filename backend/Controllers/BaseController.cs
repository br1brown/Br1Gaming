using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
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

    // ── Storie: catalogo ─────────────────────────────────────────────

    [HttpGet("stories")]
    public IActionResult GetStoriesCatalog()
    {
        var dtos = _stories.GetCatalog()
            .Select(s => new StorySummaryDto(s.Slug, s.Title, s.Description))
            .ToList();
        return Ok(dtos);
    }

    // ── Storie: info e play per slug ─────────────────────────────────

    [HttpGet("stories/{slug}")]
    public IActionResult GetStory(string slug)
    {
        switch (slug)
        {
            case "poveri-maschi":
                var pm = _stories.GetPoveriMaschi();
                return Ok(new StorySummaryDto(pm.Slug, pm.Title, pm.Description));
            case "magrogamer09":
                var mg = _stories.GetMagrogamer09();
                return Ok(new StorySummaryDto(mg.Slug, mg.Title, mg.Description));
            case "sopravvivi-agli-usa":
                var su = _stories.GetSurviveUsa();
                return Ok(new StorySummaryDto(su.Slug, su.Title, su.Description));
            default:
                throw new NotFoundException(slug);
        }
    }

    [HttpPost("stories/{slug}/play")]
    public IActionResult PlayStory(string slug, [FromBody] StoryPlayRequestDto body)
    {
        var state = ToGameState(body.Stats);
        StorySnapshot? snapshot;
        switch (slug)
        {
            case "poveri-maschi":
                snapshot = _stories.PlayPoveriMaschi(body.SceneId, body.ChoiceId, state);
                break;
            case "magrogamer09":
                snapshot = _stories.PlayMagrogamer09(body.SceneId, body.ChoiceId, state);
                break;
            case "sopravvivi-agli-usa":
                snapshot = _stories.PlaySurviveUsa(body.SceneId, body.ChoiceId, state);
                break;
            default:
                throw new NotFoundException(slug);
        }
        if (snapshot is null) throw new NotFoundException("scena");
        return Ok(snapshot);
    }

    // ── Generatori: catalogo ─────────────────────────────────────────

    [HttpGet("generators")]
    public async Task<IActionResult> GetGeneratorsCatalog()
    {
        var items = await _generators.GetCatalogAsync();
        return Ok(items.Select(i => new GeneratorInfoDto(
            i.Slug,
            i.Info?.Name ?? i.Slug,
            i.Info?.Description)));
    }

    // ── Generatori: info e genera per slug ───────────────────────────

    [HttpGet("generators/{slug}")]
    public async Task<IActionResult> GetGenerator(string slug)
    {
        Task<GeneratorData?> task;
        switch (slug)
        {
            case "incel":   task = _generators.GetIncelInfoAsync();   break;
            case "mbeb":    task = _generators.GetMbebInfoAsync();    break;
            case "auto":    task = _generators.GetAutoInfoAsync();    break;
            case "antiveg": task = _generators.GetAntivegInfoAsync(); break;
            case "locali":  task = _generators.GetLocaliInfoAsync();  break;
            default:        throw new NotFoundException(slug);
        }
        var item = await task ?? throw new NotFoundException(slug);
        return Ok(new GeneratorInfoDto(item.Slug, item.Info?.Name ?? item.Slug, item.Info?.Description));
    }

    [HttpPost("generators/{slug}/generate")]
    public async Task<IActionResult> Generate(string slug, [FromBody] GenerateRequestDto? body)
    {
        GenerationResult result;
        switch (slug)
        {
            case "incel":   result = await _generators.GenerateIncelAsync();   break;
            case "mbeb":    result = await _generators.GenerateMbebAsync();    break;
            case "auto":    result = await _generators.GenerateAutoAsync();    break;
            case "antiveg": result = await _generators.GenerateAntivegAsync(); break;
            case "locali":  result = await _generators.GenerateLocaliAsync();  break;
            default:        throw new NotFoundException(slug);
        }
        return Ok(new GenerateResponseDto(result.Text, result.Markdown, result.Html));
    }

    // ── Helper Privati ───────────────────────────────────────────────

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
    public sealed record GenerateResponseDto(string Text, string Markdown, string? Html);
}
