using Microsoft.AspNetCore.Mvc;
using Backend.Identity;

namespace Backend.Controllers;

/// <summary>Endpoint dell'Engine che espone l'identità del sito localizzata: <c>GET /identity</c>. Solo API key, non login. Identità non configurata ⇒ risposta null.</summary>
[Route("identity")]
public sealed class EngineIdentityController : EngineApiController
{
    private readonly IIdentityStore _store;

    /// <summary>Inietta lo store identità e il logger.</summary>
    public EngineIdentityController(IIdentityStore store, ILogger<EngineIdentityController> logger)
        : base(logger)
    {
        _store = store;
    }

    /// <summary>Identità del sito nella lingua della richiesta, o null se assente (il frontend nasconde da sé footer/social/JSON-LD relativi).</summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var identity = await _store.GetIdentityAsync(CurrentLanguage, cancellationToken);
        return Ok(identity);
    }
}
