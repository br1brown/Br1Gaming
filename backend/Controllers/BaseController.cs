using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers;

/// <summary>
/// Controller concreto del progetto per gli endpoint pubblici (API key).
/// </summary>
/// <remarks>
/// Eredita sicurezza e logger da <see cref="EngineApiController"/>. Resta "magro": lo slug
/// arriva dall'URL e l'unico lavoro è lo switch verso il wrapper tipizzato del servizio
/// (slug sconosciuto → 404). Come i generatori si compongano è affare di GeneratorService.
/// </remarks>
[Route("")]
public class BaseController : EngineApiController
{
    private readonly SiteService _site;
    private readonly StoryService _stories;
    private readonly GeneratorService _generators;
    private readonly IValidator<StoryPlayRequestDto> _playValidator;

    /// <summary>Inizializza il controller con i servizi di dominio, il validator del play e il logger.</summary>
    public BaseController(
        SiteService site,
        StoryService stories,
        GeneratorService generators,
        IValidator<StoryPlayRequestDto> playValidator,
        ILogger<BaseController> logger)
        : base(logger)
    {
        _site = site;
        _stories = stories;
        _generators = generators;
        _playValidator = playValidator;
    }

    // ── Sito: profilo ────────────────────────────────────────────────

    /// <summary>
    /// Restituisce il profilo del sito localizzato (dati legali e contatti).
    /// </summary>
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken)
    {
        Logger.LogInformation(
            "Richiesta profilo - lingua: {Lang}",
            System.Globalization.CultureInfo.CurrentCulture);

        var data = await _site.GetProfileAsync(cancellationToken);
        return Ok(data);
    }

    // ── Storie ───────────────────────────────────────────────────────

    /// <summary>Catalogo delle storie disponibili.</summary>
    [HttpGet("stories")]
    public IActionResult GetStoriesCatalog()
    {
        var dtos = _stories.GetCatalog()
            .Select(s => new StorySummaryDto(s.Slug, s.Title, s.Description))
            .ToList();
        return Ok(dtos);
    }

    /// <summary>Info di una singola storia per slug.</summary>
    [HttpGet("stories/{slug}")]
    public IActionResult GetStory(string slug)
    {
        var story = slug switch
        {
            "poveri-maschi" => _stories.GetPoveriMaschi(),
            "magrogamer09" => _stories.GetMagrogamer09(),
            "sopravvivi-agli-usa" => _stories.GetSurviveUsa(),
            _ => throw new NotFoundException(slug),
        };
        return Ok(new StorySummaryDto(story.Slug, story.Title, story.Description));
    }

    /// <summary>Passo di gioco: start, resume o scelta a seconda dei campi del body.</summary>
    [HttpPost("stories/{slug}/play")]
    public async Task<IActionResult> PlayStory(string slug, [FromBody] StoryPlayRequestDto body)
    {
        var validation = await _playValidator.ValidateAsync(body);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors)
                ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem();
        }

        var snapshot = slug switch
        {
            "poveri-maschi" => _stories.PlayPoveriMaschi(body.SceneId, body.ChoiceId, body.Stats),
            "magrogamer09" => _stories.PlayMagrogamer09(body.SceneId, body.ChoiceId, body.Stats),
            "sopravvivi-agli-usa" => _stories.PlaySurviveUsa(body.SceneId, body.ChoiceId, body.Stats),
            _ => throw new NotFoundException(slug),
        };
        return Ok(snapshot);
    }

    // ── Generatori ───────────────────────────────────────────────────

    /// <summary>Catalogo dei generatori disponibili.</summary>
    [HttpGet("generators")]
    public async Task<IActionResult> GetGeneratorsCatalog(CancellationToken cancellationToken)
    {
        var items = await _generators.GetCatalogAsync(cancellationToken);
        return Ok(items.Select(ToInfoDto));
    }

    /// <summary>Info di un singolo generatore per slug.</summary>
    [HttpGet("generators/{slug}")]
    public async Task<IActionResult> GetGenerator(string slug, CancellationToken cancellationToken)
    {
        var task = slug switch
        {
            "incel" => _generators.GetIncelInfoAsync(cancellationToken),
            "mbeb" => _generators.GetMbebInfoAsync(cancellationToken),
            "auto" => _generators.GetAutoInfoAsync(cancellationToken),
            "antiveg" => _generators.GetAntivegInfoAsync(cancellationToken),
            "locali" => _generators.GetLocaliInfoAsync(cancellationToken),
            _ => throw new NotFoundException(slug),
        };
        var item = await task ?? throw new NotFoundException(slug);
        return Ok(ToInfoDto(item));
    }

    /// <summary>Genera un nuovo testo per il generatore richiesto.</summary>
    [HttpPost("generators/{slug}/generate")]
    public async Task<IActionResult> Generate(string slug, CancellationToken cancellationToken)
    {
        var task = slug switch
        {
            "incel" => _generators.GenerateIncelAsync(cancellationToken),
            "mbeb" => _generators.GenerateMbebAsync(cancellationToken),
            "auto" => _generators.GenerateAutoAsync(cancellationToken),
            "antiveg" => _generators.GenerateAntivegAsync(cancellationToken),
            "locali" => _generators.GenerateLocaliAsync(cancellationToken),
            _ => throw new NotFoundException(slug),
        };
        return Ok(await task);
    }

    private static GeneratorInfoDto ToInfoDto(GeneratorData item)
        => new(item.Slug, item.Info?.Name ?? item.Slug, item.Info?.Description);
}
