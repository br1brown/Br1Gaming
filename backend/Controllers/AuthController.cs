using Backend.Models;
using Backend.Security;
using Backend.Services;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Backend.Controllers;

/// <summary>
/// Controller concreto del progetto per l'autenticazione.
/// </summary>
[Route("auth")]
public class AuthController : EngineAuthController
{
    private readonly IValidator<LoginRequest> _validator;
    private readonly AccountService _accounts;

    /// <summary>
    /// Inizializza il controller con il servizio JWT, il logger, il validator FluentValidation e
    /// il servizio account del progetto, che custodisce la verifica delle credenziali.
    /// </summary>
    public AuthController(AuthService auth, ILogger<AuthController> logger, IValidator<LoginRequest> validator, AccountService accounts)
        : base(auth, logger)
    {
        _validator = validator;
        _accounts = accounts;
    }

    /// <summary>
    /// Endpoint di login. Valida l'input, delega la verifica delle credenziali ad
    /// <see cref="AccountService"/> e restituisce un token JWT.
    /// </summary>
    [HttpPost("login")]
    [EnableRateLimiting(SecurityDefaults.LoginRateLimitPolicy)]
    public async Task<ActionResult<LoginResult>> Login([FromBody] LoginRequest request)
    {
        var validation = await _validator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors)
                ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem();
        }

        // La verifica vive in AccountService (Dominio), non qui: il controller resta il punto
        // HTTP — input, esito, emissione del token — e non sa da dove vengono gli account.
        var session = await _accounts.ValidateCredentialsAsync(request.Username, request.Pwd, HttpContext.RequestAborted);

        if (session is null)
        {
            Logger.LogWarning("Tentativo di login fallito per username '{Username}'.", request.Username);
            // Chiave generica: non riveliamo se a sbagliare e' username o password. L'handler la localizza.
            throw new UnauthorizedException("error_invalid_credentials");
        }

        Logger.LogInformation("Login riuscito per username '{Username}'.", request.Username);

        return Ok(new LoginResult(true, Token: Auth.GenerateToken(new[] { SessionPayload.Claim(session) })));
    }
}
