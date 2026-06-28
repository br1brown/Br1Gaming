using Microsoft.AspNetCore.Mvc;
using Backend.Identity;

namespace Backend.Controllers;

/// <summary>
/// Endpoint dell'Engine che espone l'identità del sito localizzata: <c>GET /identity</c>.
/// </summary>
/// <remarks>
/// Eredita da <see cref="EngineApiController"/>: richiede la sola API key (iniettata dal proxy),
/// non il login. È un endpoint dell'Engine offerto ai figli — un progetto non scrive né controller
/// né service per l'identità, riempie soltanto <c>data/identity.json</c> (o sostituisce
/// <see cref="IIdentityStore"/> via DI). Identità non configurata ⇒ risposta <c>null</c>.
/// </remarks>
[Route("identity")]
public sealed class EngineIdentityController : EngineApiController
{
    private readonly IIdentityStore _store;

    /// <inheritdoc cref="EngineIdentityController"/>
    public EngineIdentityController(IIdentityStore store, ILogger<EngineIdentityController> logger)
        : base(logger)
    {
        _store = store;
    }

    /// <summary>
    /// Restituisce l'identità del sito nella lingua della richiesta, o <c>null</c> se assente.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var identity = await _store.GetIdentityAsync(CurrentLanguage, cancellationToken);
        // null se non configurata → JSON `null`: il frontend (risorsa condivisa) la legge come
        // assente e nasconde da sé footer, social e dati strutturati relativi.
        return Ok(identity);
    }
}
