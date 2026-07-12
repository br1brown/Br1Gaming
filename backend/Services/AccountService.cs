using System.Security.Cryptography;
using System.Text;
using Backend.Models;
using Microsoft.Extensions.Hosting;

namespace Backend.Services;

/// <summary>
/// Unico posto del progetto che conosce gli account utenti: verifica credenziali (per AuthController)
/// e cancella l'account (per AppPersonalDataStore, diritto all'oblio). Da non confondere con
/// <c>IIdentityStore</c> (identità del brand) né <c>AuthService</c> (JWT Engine). Reali → riscrivi solo qui.
/// </summary>
public class AccountService
{
    private readonly IHostEnvironment _env;
    private readonly ILogger<AccountService> _logger;

    /// <summary>Inizializza con l'ambiente host (fail-closed sulle credenziali demo in Production) e il logger.</summary>
    public AccountService(IHostEnvironment env, ILogger<AccountService> logger)
    {
        _env = env;
        _logger = logger;
    }

    /// <summary>
    /// Verifica le credenziali e, se valide, restituisce il payload di sessione da serializzare
    /// nel JWT; <c>null</c> se le credenziali non corrispondono.
    /// </summary>
    public Task<SessionInfo?> ValidateCredentialsAsync(string? username, string? pwd, CancellationToken cancellationToken = default)
    {
        // Credenziali demo del template, volutamente hardcoded: il login è opzionale e ogni
        // progetto ha la propria sorgente di identità (IdP, DB...) con cui sostituire questa verifica.
        const string validUsername = "admin";
        const string validPassword = "Password1!";

        // Username case-insensitive, password esatta: entrambi confrontati in tempo costante,
        // come le API key (un confronto ordinario uscirebbe al primo carattere divergente).
        // Il validator ha già escluso i campi vuoti: il coalesce copre il nullable del record.
        var usernameOk = FixedTimeEquals((username ?? "").ToLowerInvariant(), validUsername);
        var passwordOk = FixedTimeEquals(pwd ?? "", validPassword);

        if (!usernameOk || !passwordOk)
            return Task.FromResult<SessionInfo?>(null);

        // Payload di sessione del progetto: serializzato nel claim "session" del token,
        // poi rileggibile via User.GetSession<SessionInfo>() e lato frontend.
        // Sostituire i valori demo con quelli reali (id utente, ruoli, ecc.).
        return Task.FromResult<SessionInfo?>(new SessionInfo
        {
            UserId = validUsername,
            DisplayName = "Amministratore",
            Roles = ["admin"]
        });
    }

    /// <summary>
    /// Cancella l'account (credenziali e identificativi), la parte "account" dell'oblio; i dati di
    /// dominio restano ad <c>AppPersonalDataStore</c>, che chiama questo per ultimo. Demo: no-op
    /// (account = costanti compile-time). Reali → rimuovi record/file; IdP esterno → scollega copia locale.
    /// </summary>
    public Task DeleteAccountAsync(SessionInfo session, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Cancellazione account richiesta per '{UserId}': demo, nessuno storage account da cui rimuovere.", session.UserId);
        return Task.CompletedTask;
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
