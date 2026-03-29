using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Base astratta dell'engine per l'autenticazione.
/// </summary>
/// <remarks>
/// Fornisce l'accesso al servizio JWT e gli attributi di sicurezza
/// (<c>[ApiController]</c>, <c>[Authorize]</c>) ereditati dai controller concreti.
/// Il routing (<c>[Route]</c>), la logica di login e gli eventuali attributi specifici
/// dell'endpoint restano nel controller concreto.
/// </remarks>
[Authorize]
[ApiController]
public abstract class EngineAuthController : ControllerBase
{
    /// <summary>Servizio JWT dell'engine per generazione e validazione token.</summary>
    protected readonly AuthService Auth;

    /// <inheritdoc cref="EngineAuthController"/>
    protected EngineAuthController(AuthService auth)
    {
        Auth = auth;
    }

}
