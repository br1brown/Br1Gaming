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
    private readonly BlobOwnershipRegistry _blobOwnership;

    /// <inheritdoc cref="AppPersonalDataStore"/>
    public AppPersonalDataStore(AccountService accounts, BlobOwnershipRegistry blobOwnership)
    {
        _accounts = accounts;
        _blobOwnership = blobOwnership;
    }

    /// <inheritdoc />
    public async Task<object?> ExportAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
    {
        var session = user.GetSession<SessionInfo>();
        if (session is null)
            return null;
        // L'account della demo è una coppia di costanti: i dati personali sono gli upload ancora presenti e lo
        // storico del registro (cosa ha caricato o cancellato, e quando), cioè le stesse righe che EraseAsync
        // anonimizza. Con store di dominio reali si aggregano qui (profilo, ordini...).
        var uploads = await _blobOwnership.GetOwnedSlugsAsync(session.UserId, cancellationToken);
        var storico = await _blobOwnership.GetHistoryAsync(session.UserId, cancellationToken);
        return uploads.Count == 0 && storico.Count == 0 ? null : new { upload = uploads, storico };
    }

    /// <inheritdoc />
    public async Task EraseAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
    {
        var session = user.GetSession<SessionInfo>();
        if (session is null)
            return; // token senza payload di sessione: nessun dato a cui risalire

        // Prima i dati di dominio (profilo, ordini, ... — di default nessuno), l'account per ultimo:
        // se una cancellazione a monte fallisce, l'utente esiste ancora e può riprovare.
        // Gli upload restano, anonimizzati nel registro. La sessione la revoca EngineDataPrivacyController
        // dopo questo metodo: un token emesso prima della cancellazione non può più registrare l'UserId reale.
        await _blobOwnership.AnonymizeUserAsync(session.UserId, cancellationToken);
        await _accounts.DeleteAccountAsync(session, cancellationToken);
    }
}
