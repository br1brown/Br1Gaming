using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Radice astratta di tutti i controller: centralizza API key, Authorize e logger condiviso.
/// Il routing resta responsabilità del controller concreto.
/// </summary>
[ApiController]
[Authorize]
public abstract class EngineApiController : ControllerBase
{
    /// <summary>Logger condiviso con tutti i controller derivati.</summary>
    protected readonly ILogger Logger;

    /// <inheritdoc cref="EngineApiController"/>
    protected EngineApiController(ILogger logger)
    {
        Logger = logger;
    }
}
