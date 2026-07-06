using System.Security.Cryptography;
using System.Text;
using Backend.Models;
using Backend.Security;
using Backend.Services;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Hosting;

namespace Backend.Controllers;

/// <summary>
/// Controller concreto del progetto per l'autenticazione.
/// </summary>
[Route("auth")]
public class AuthController : EngineAuthController
{
    private readonly IValidator<LoginRequest> _validator;
    private readonly IHostEnvironment _env;

    /// <summary>
    /// Inizializza il controller con il servizio JWT, il logger, il validator FluentValidation e
    /// l'ambiente di hosting (per il fail-closed sulle credenziali demo in Production).
    /// </summary>
    public AuthController(AuthService auth, ILogger<AuthController> logger, IValidator<LoginRequest> validator, IHostEnvironment env)
        : base(auth, logger)
    {
        _validator = validator;
        _env = env;
    }

    /// <summary>
    /// Endpoint di login. Valida le credenziali e restituisce un token JWT.
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

        // Credenziali demo del template, volutamente hardcoded: il login è opzionale e ogni
        // progetto ha la propria sorgente di identità (IdP, DB...) con cui sostituire questa verifica.
        const string validUsername = "admin";
        const string validPassword = "Password1!";

        // Fail-closed: in Production le credenziali demo del template non devono MAI autenticare.
        // Se un progetto accende il login (valorizzando SecretKey) ma dimentica di sostituire questa
        // verifica, la porta resta chiusa invece di aprirsi con una password pubblica nel repo. Quando
        // il figlio cambia le costanti qui sopra, la condizione si spegne da sé (sono compile-time).
        if (_env.IsProduction() && validUsername == "admin" && validPassword == "Password1!")
        {
            Logger.LogError("Login demo del template ancora attivo in Production: credenziali non sostituite in AuthController. Login rifiutato (fail-closed).");
            throw new UnauthorizedException();
        }

        // Username case-insensitive, password esatta: entrambi confrontati in tempo costante,
        // come le API key (un confronto ordinario uscirebbe al primo carattere divergente).
        // Il validator ha già escluso i campi vuoti: il coalesce copre il nullable del record.
        var usernameOk = FixedTimeEquals((request.Username ?? "").ToLowerInvariant(), validUsername);
        var passwordOk = FixedTimeEquals(request.Pwd ?? "", validPassword);

        if (!usernameOk || !passwordOk)
        {
            Logger.LogWarning("Tentativo di login fallito per username '{Username}'.", request.Username);
            // Chiave generica: non riveliamo se a sbagliare e' username o password. L'handler la localizza.
            throw new UnauthorizedException("error_invalid_credentials");
        }

        Logger.LogInformation("Login riuscito per username '{Username}'.", request.Username);

        // Payload di sessione del progetto: serializzato nel claim "session" del token,
        // poi rileggibile via User.GetSession<SessionInfo>() e lato frontend.
        // Sostituire i valori demo con quelli reali (id utente, ruoli, ecc.).
        var session = new SessionInfo
        {
            UserId = validUsername,
            DisplayName = "Amministratore",
            Roles = new[] { "admin" }
        };

        return Ok(new LoginResult(true, Token: Auth.GenerateToken(new[] { SessionPayload.Claim(session) })));
    }

    /// <summary>
    /// Confronto di stringhe in tempo costante (UTF-8, byte per byte).
    /// </summary>
    private static bool FixedTimeEquals(string presented, string expected)
    {
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(presented),
            Encoding.UTF8.GetBytes(expected));
    }
}
