using System.Security.Claims;
using Backend.Models;
using Backend.Privacy;
using Backend.Security;
using Backend.Services;

namespace Backend.Store;

/// <summary>
/// Sorgente dei dati personali di proprietà del progetto, dietro <c>GET</c>/<c>DELETE /me/data</c>
/// (vince sul default vuoto <c>NullPersonalDataStore</c>). Unico punto di aggregazione: export e oblio
/// degli store di dominio passano da qui; la parte account è delegata ad <see cref="AccountService"/>.
/// </summary>
public class AppPersonalDataStore : IPersonalDataStore
{
    private readonly AccountService _accounts;

    /// <inheritdoc cref="AppPersonalDataStore"/>
    public AppPersonalDataStore(AccountService accounts)
    {
        _accounts = accounts;
    }

    /// <inheritdoc />
    public Task<object?> ExportAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
    {
        // La demo non conserva dati personali (l'account è una coppia di costanti compile-time):
        // niente da esportare. Con store di dominio reali si aggrega qui, es.:
        //   var session = user.GetSession<SessionInfo>();
        //   return new { profilo = await _profili.GetAsync(session.UserId, ct), ordini = ... };
        return Task.FromResult<object?>(null);
    }

    /// <inheritdoc />
    public async Task EraseAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
    {
        var session = user.GetSession<SessionInfo>();
        if (session is null)
            return; // token senza payload di sessione: nessun dato a cui risalire

        // Prima i dati di dominio (profilo, ordini, ... — oggi nessuno), l'account per ultimo:
        // se una cancellazione a monte fallisce, l'utente esiste ancora e può riprovare.
        await _accounts.DeleteAccountAsync(session, cancellationToken);
    }
}
