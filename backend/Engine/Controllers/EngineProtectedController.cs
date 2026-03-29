using Backend.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Base astratta dell'engine per gli endpoint protetti da login JWT.
/// </summary>
/// <remarks>
/// Fornisce il logger condiviso e gli attributi di sicurezza
/// (<c>[ApiController]</c>, <c>[Authorize(Policy = RequireLoginPolicy)]</c>)
/// ereditati dai controller concreti.
/// Il routing (<c>[Route]</c>) resta responsabilita' del controller concreto.
/// </remarks>
[ApiController]
[Authorize(Policy = SecurityDefaults.RequireLoginPolicy)]
public abstract class EngineProtectedController : ControllerBase
{
    /// <summary>Logger condiviso con i controller derivati.</summary>
    protected readonly ILogger Logger;

    /// <inheritdoc cref="EngineProtectedController"/>
    protected EngineProtectedController(ILogger logger)
    {
        Logger = logger;
    }
}
