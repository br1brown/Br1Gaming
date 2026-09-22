using Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>Base astratta per l'autenticazione: espone il servizio JWT via <see cref="Auth"/>. Routing e logica di login restano nel controller concreto.</summary>
public abstract class EngineAuthController : EngineApiController
{
    /// <summary>Servizio JWT dell'engine per la generazione del token; la validazione è delegata al middleware JWT Bearer.</summary>
    protected readonly AuthService Auth;

    /// <summary>Inietta il servizio JWT e il logger, passandolo alla base.</summary>
    protected EngineAuthController(AuthService auth, ILogger logger)
        : base(logger)
    {
        Auth = auth;
    }
}
