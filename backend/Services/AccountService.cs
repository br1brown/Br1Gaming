using System.Security.Cryptography;
using System.Text;
using Backend.Models;
using Microsoft.Extensions.Hosting;

namespace Backend.Services;

/// <summary>
/// L'unico posto del progetto che conosce gli account degli utenti: verifica delle credenziali
/// (chiamata da <c>AuthController</c>) e cancellazione dell'account (chiamata da
/// <c>AppPersonalDataStore</c> per il diritto all'oblio).
/// </summary>
/// <remarks>
/// Account degli <b>utenti</b>: da non confondere con l'identità del sito (<c>IIdentityStore</c>,
/// i dati legali del brand) né con <c>AuthService</c> (l'infrastruttura JWT dell'Engine).
/// Classe concreta di Dominio, senza contratto engine-side, di proposito: le firme parlano
/// <see cref="SessionInfo"/>, che l'Engine non conosce — i confini contrattuali restano
/// <c>EngineAuthController</c> (login) e <c>IPersonalDataStore</c> (dati personali), e questo
/// servizio vive dietro entrambi. Quando gli account diventano reali (DB, file utenti, IdP
/// esterno come Google) si riscrive l'interno di questa classe e nient'altro: controller e
/// store privacy non cambiano.
/// </remarks>
public class AccountService
{
    private readonly IHostEnvironment _env;
    private readonly ILogger<AccountService> _logger;

    /// <summary>
    /// Inizializza il servizio con l'ambiente di hosting (per il fail-closed sulle credenziali
    /// demo in Production) e il logger.
    /// </summary>
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

        // Fail-closed: in Production le credenziali demo del template non devono MAI autenticare.
        // Se un progetto accende il login (valorizzando SecretKey) ma dimentica di sostituire questa
        // verifica, la porta resta chiusa invece di aprirsi con una password pubblica nel repo. Quando
        // il figlio cambia le costanti qui sopra, la condizione si spegne da sé (sono compile-time).
        if (_env.IsProduction() && validUsername == "admin" && validPassword == "Password1!")
        {
            _logger.LogError("Login demo del template ancora attivo in Production: credenziali non sostituite in AccountService. Login rifiutato (fail-closed).");
            throw new UnauthorizedException();
        }

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
    /// Cancella l'account dell'utente — credenziali e identificativi, cioè la parte "account"
    /// del diritto all'oblio; la cancellazione dei dati di dominio resta in
    /// <c>AppPersonalDataStore</c>, che chiama questo metodo per ultima cosa.
    /// </summary>
    /// <remarks>
    /// Demo: no-op — l'account demo è una coppia di costanti compile-time, non c'è nulla da
    /// cancellare. Con account reali qui si rimuove il record/riga/file dell'utente; con un IdP
    /// esterno si cancella il collegamento e la copia locale dei dati, non l'account presso l'IdP.
    /// </remarks>
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
