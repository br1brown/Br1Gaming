using Microsoft.AspNetCore.Mvc;
using Backend.Engine;
using Backend.Privacy;
using Backend.Security;

namespace Backend.Controllers;

/// <summary>Endpoint dell'engine per export/cancellazione dei dati personali: <c>GET</c>/<c>DELETE /me/data</c>. Un progetto implementa <see cref="IPersonalDataStore"/>, non scrive controller.</summary>
[Route("me/data")]
public sealed class EngineDataPrivacyController : EngineProtectedController
{
    private readonly IPersonalDataStore _store;
    private readonly ISessionRevocation _revocation;

    /// <inheritdoc cref="EngineDataPrivacyController"/>
    public EngineDataPrivacyController(IPersonalDataStore store, ISessionRevocation revocation, ILogger<EngineDataPrivacyController> logger)
        : base(logger)
    {
        _store = store;
        _revocation = revocation;
    }

    /// <summary>Esporta i dati personali come JSON in chiaro (artt. 15.3 e 20 GDPR: formato leggibile dall'interessato); la riservatezza la danno HTTPS e l'autenticazione. Risposta: <c>{ "data": … }</c> col valore di <see cref="IPersonalDataStore.ExportAsync"/> (nel template: upload ancora presenti e storico del registro, <c>{ "data": { "upload": ["slug", …], "storico": [{ "slug", "caricato", "caricatoIl", "cancellatoIl", "cancellato" }, …] } }</c>), <c>{ "data": null }</c> se non c'è nulla.</summary>
    [HttpGet]
    public async Task<IActionResult> Export(CancellationToken cancellationToken)
    {
        var data = await _store.ExportAsync(User, cancellationToken);
        return new JsonResult(new { data }, EngineJson.Web);
    }

    /// <summary>Cancella/anonimizza i dati, account incluso (vedi <see cref="IPersonalDataStore.EraseAsync"/>), poi revoca la sessione:
    /// ogni token emesso fino a questo istante per questa sessione è respinto con 401 al prossimo uso (<see cref="ISessionRevocation"/>),
    /// così nessuna scrittura successiva può registrare di nuovo l'id dell'utente. Il frontend scarta comunque il token alla risposta 204.</summary>
    [HttpDelete]
    public async Task<IActionResult> Erase(CancellationToken cancellationToken)
    {
        await _store.EraseAsync(User, cancellationToken);
        _revocation.Revoke(User);
        return NoContent();
    }
}
