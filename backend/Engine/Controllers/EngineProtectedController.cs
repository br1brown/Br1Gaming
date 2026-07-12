using Backend.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Base astratta dell'engine per gli endpoint protetti da login JWT.
/// </summary>
/// <remarks>
/// Aggiunge il requisito JWT (<c>[Authorize(Policy = RequireLoginPolicy)]</c>)
/// all'autenticazione API key ereditata da <see cref="EngineApiController"/>.
/// Il routing resta responsabilità del controller concreto.
/// </remarks>
[Authorize(Policy = SecurityDefaults.RequireLoginPolicy)]
public abstract class EngineProtectedController : EngineApiController
{
    /// <inheritdoc cref="EngineProtectedController"/>
    protected EngineProtectedController(ILogger logger)
        : base(logger)
    {
    }

    /// <summary>
    /// Rilegge il payload di sessione del progetto dal token corrente, o <c>null</c> se assente
    /// o non deserializzabile in <typeparamref name="T"/>.
    /// </summary>
    /// <remarks>
    /// Comodità per non ricordare la fonte (claim <c>"session"</c>) — stesso spirito di
    /// <see cref="EngineApiController.CurrentLanguage"/> per la lingua. Resta generico apposta:
    /// l'engine non conosce (e non deve conoscere) la forma del payload di sessione, che è
    /// Dominio del progetto (tipicamente <c>SessionInfo</c>).
    /// </remarks>
    protected T? CurrentSession<T>() where T : class => User.GetSession<T>();
}
