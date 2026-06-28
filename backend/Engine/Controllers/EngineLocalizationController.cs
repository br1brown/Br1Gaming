using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Backend.Engine.Localization;
using Backend.Models.Configuration;
using Backend.Models.Localization;

namespace Backend.Controllers;

/// <summary>
/// Endpoint dell'Engine che espone i primitivi di localizzazione del sito: <c>GET /localization</c>.
/// </summary>
/// <remarks>
/// Gemello di <see cref="EngineIdentityController"/>: richiede la sola API key (proxy), non il login.
/// Prende i codici lingua dichiarati (<see cref="LocalizationOptions"/> ← <c>global-settings.json</c>),
/// li arricchisce nelle <see cref="CultureInfo"/> tipizzate (<see cref="EngineCultures"/>) e ne deriva
/// lingue (coi nomi nativi e i codici a 2/3 lettere), default, tag BCP-47 e nomi giorno per la cultura
/// della richiesta. Il frontend consuma questi dati invece di mappare lingue/giorni a mano.
/// </remarks>
[Route("localization")]
public sealed class EngineLocalizationController : EngineApiController
{
    private readonly LocalizationOptions _localization;

    /// <inheritdoc cref="EngineLocalizationController"/>
    public EngineLocalizationController(IOptions<LocalizationOptions> localization, ILogger<EngineLocalizationController> logger)
        : base(logger)
    {
        _localization = localization.Value;
    }

    /// <summary>Primitivi di localizzazione per la cultura della richiesta (risolta da Accept-Language).</summary>
    [HttpGet]
    public IActionResult Get()
        => Ok(SiteLocalization.Build(
            CultureInfo.CurrentCulture,
            EngineCultures.Supported(_localization),
            EngineCultures.Default(_localization)));
}
