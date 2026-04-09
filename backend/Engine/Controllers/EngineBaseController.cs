using Microsoft.AspNetCore.Mvc;
using Backend.Infrastructure;
using Microsoft.AspNetCore.Authorization;

namespace Backend.Controllers;

/// <summary>
/// Base astratta dell'engine per gli endpoint pubblici del template.
/// </summary>
/// <remarks>
/// Fornisce logica riusabile tramite metodi <c>virtual</c>.
/// Attributi di sicurezza (<c>[ApiController]</c>, <c>[Authorize]</c>) sono definiti qui
/// e vengono ereditati dai controller concreti del progetto.
/// Il routing (<c>[Route]</c>) resta responsabilita' del controller concreto.
/// </remarks>
[ApiController]
[Authorize]
public abstract class EngineBaseController : ControllerBase
{
    /// <summary>Accesso ai contenuti persistenti del sito.</summary>
    protected readonly IContentStore Store;
    /// <summary>Logger condiviso con i controller derivati.</summary>
    protected readonly ILogger Logger;

    /// <inheritdoc cref="EngineBaseController"/>
    protected EngineBaseController(IContentStore store, ILogger logger)
    {
        Store = store;
        Logger = logger;
    }

}
