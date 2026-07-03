using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Backend.Shares;
using Backend.Generators;
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
    private readonly StoryService _stories;
    private readonly GeneratorService _generators;
    private readonly IShareStore _shares;
    private readonly ShareSigner _signer;
    private readonly IValidator<StoryPlayRequestDto> _playValidator;

    /// <summary>Inizializza il controller con i servizi di dominio, il validator del play e il logger.</summary>
    public BaseController(
        StoryService stories,
        GeneratorService generators,
        IShareStore shares,
        ShareSigner signer,
        IValidator<StoryPlayRequestDto> playValidator,
        ILogger<BaseController> logger)
        : base(logger)
    {
        _stories = stories;
        _generators = generators;
        _shares = shares;
        _signer = signer;
        _playValidator = playValidator;
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

    /// <summary>Info di una singola storia per slug (slug sconosciuto → 404).</summary>
    [HttpGet("stories/{slug}")]
    public IActionResult GetStory(string slug)
    {
        var story = _stories.Get(slug);
        return Ok(new StorySummaryDto(story.Slug, story.Title, story.Description));
    }

    /// <summary>Passo di gioco: start, resume o scelta a seconda dei campi del body (slug sconosciuto → 404).</summary>
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

        return Ok(_stories.Play(slug, body.SceneId, body.ChoiceId, body.Stats));
    }

    // ── Generatori ───────────────────────────────────────────────────

    /// <summary>Catalogo dei generatori disponibili.</summary>
    [HttpGet("generators")]
    public IActionResult GetGeneratorsCatalog()
    {
        var items = _generators.GetCatalog();
        return Ok(items.Select(ToInfoDto));
    }

    /// <summary>Info di un singolo generatore per slug (slug sconosciuto → 404).</summary>
    [HttpGet("generators/{slug}")]
    public IActionResult GetGenerator(string slug)
        => Ok(ToInfoDto(_generators.Get(slug)));

    /// <summary>
    /// Genera un nuovo testo per il generatore richiesto (slug sconosciuto → 404).
    /// La risposta include una firma HMAC: serve a condividere la generazione.
    /// </summary>
    [HttpPost("generators/{slug}/generate")]
    public IActionResult Generate(string slug)
    {
        // Tutti i query param diventano il "dizionario d'ingresso" del generatore: oggi lo usa la
        // variante (es. ?segno=ariete), domani qualunque dato senza toccare la firma dell'endpoint.
        var inputs = Request.Query.ToDictionary(q => q.Key, q => q.Value.ToString(), StringComparer.OrdinalIgnoreCase);
        var result = _generators.Generate(slug, inputs);
        return Ok(new GenerationResultDto(result.Text, result.Markdown, result.Score, _signer.Sign(slug, result.Markdown)));
    }

    // ── Condivisi (raccolta pubblica) ──────────────────────────────────

    /// <summary>
    /// Condivide una generazione (la salva nella raccolta pubblica) e restituisce l'id con cui
    /// recuperarla. Accetta solo testi con firma HMAC valida (output genuini del generatore); l'id è
    /// content-addressed, quindi condividere due volte la stessa generazione non crea doppioni.
    /// </summary>
    [HttpPost("generators/{slug}/save")]
    public IActionResult SaveGeneration(string slug, [FromBody] ShareSaveRequest body)
    {
        _generators.Get(slug); // valida lo slug (404 se non esiste)
        if (body is null || string.IsNullOrWhiteSpace(body.Markdown) || !_signer.Verify(slug, body.Markdown, body.Sig))
            throw new InvalidParametersException();

        // Il testo plain è ricostruito server-side dal Markdown firmato (non si fida del client).
        var text = GeneratorService.MarkdownToPlain(body.Markdown);
        var entry = _shares.Save(slug, text, body.Markdown, body.Score);
        return Ok(new ShareSaveResult(entry.Id));
    }

    /// <summary>Recupera una generazione condivisa per id (id sconosciuto → 404).</summary>
    [HttpGet("g/{id}")]
    public IActionResult GetGeneration(string id)
        => Ok(_shares.Get(id) ?? throw new NotFoundException(id));

    /// <summary>
    /// Le generazioni condivise più recenti (lista pubblica), al massimo 200 per richiesta.
    /// Con <paramref name="slug"/> valorizzato restringe a un solo generatore (condivisi per generatore).
    /// </summary>
    [HttpGet("shares")]
    public IActionResult GetShares([FromQuery] int limit = 50, [FromQuery] string? slug = null)
        => Ok(_shares.GetRecent(Math.Clamp(limit, 1, 200), slug));

    /// <summary>Conteggio delle generazioni condivise per generatore (slug → totale), per la panoramica.</summary>
    [HttpGet("shares/counts")]
    public IActionResult GetSharesCounts() => Ok(_shares.Counts());

    private static GeneratorInfoDto ToInfoDto(IGenerator item)
        => new(item.Slug, item.Info?.Name ?? item.Slug, item.Info?.Description, ToVariantDto(item.Variant));

    private static GeneratorVariantDto? ToVariantDto(GeneratorVariant? variant)
        => variant is null
            ? null
            : new(variant.Key, variant.Label,
                  variant.Options.Select(o => new GeneratorVariantOptionDto(o.Key, o.Label)).ToList());
}
