using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>Risposta di <c>POST /session/refresh</c>: il token rinnovato.</summary>
public sealed record SessionRefreshResult(string Token);

/// <summary><c>POST /session/refresh</c> (dietro login, solo col login acceso): token nuovo con gli stessi claim e una nuova scadenza.
/// Passati <c>ExpirationSeconds × 9,5</c> dal login risponde 403, non 401, così il client tiene la sessione ancora valida.</summary>
[Route("session")]
public sealed class EngineSessionController : EngineProtectedController
{
    private readonly AuthService _auth;

    /// <summary>Inietta il servizio JWT e il logger.</summary>
    public EngineSessionController(AuthService auth, ILogger<EngineSessionController> logger)
        : base(logger)
    {
        _auth = auth;
    }

    /// <summary>Token nuovo per la sessione corrente, o 403 se il tetto di durata è raggiunto.</summary>
    [HttpPost("refresh")]
    public ActionResult<SessionRefreshResult> Refresh()
    {
        var token = _auth.Refresh(User) ?? throw new ForbiddenException();
        return Ok(new SessionRefreshResult(token));
    }
}
