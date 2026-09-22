using Backend.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>Base astratta per gli endpoint protetti da login JWT: aggiunge il requisito JWT all'API key ereditata da <see cref="EngineApiController"/>.</summary>
[Authorize(Policy = SecurityDefaults.RequireLoginPolicy)]
public abstract class EngineProtectedController : EngineApiController
{
    /// <summary>Inietta il logger condiviso, passandolo alla base.</summary>
    protected EngineProtectedController(ILogger logger)
        : base(logger)
    {
    }

    /// <summary>Rilegge il payload di sessione del progetto (claim "session"), o null se assente/non deserializzabile. Generico apposta: l'engine non conosce la forma del payload (Dominio).</summary>
    protected T? CurrentSession<T>() where T : class => User.GetSession<T>();
}
