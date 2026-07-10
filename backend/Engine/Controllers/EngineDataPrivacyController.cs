using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Backend.Engine;
using Backend.Privacy;

namespace Backend.Controllers;

/// <summary>
/// Endpoint dell'engine per l'export e la cancellazione dei dati personali dell'utente
/// autenticato: <c>GET</c>/<c>DELETE /me/data</c>.
/// </summary>
/// <remarks>
/// Eredita da <see cref="EngineProtectedController"/>: richiede login, e viene quindi escluso
/// automaticamente dalla discovery quando il login e' disabilitato (stesso meccanismo di
/// <c>AuthController</c>/<c>ProtectedController</c> — vedi <see cref="TemplateControllerFeatureProvider"/>),
/// senza bisogno di un flag dedicato. Come <see cref="EngineIdentityController"/>, e' un endpoint
/// dell'engine offerto ai figli: un progetto non scrive ne' controller ne' rotta per questo,
/// implementa <see cref="IPersonalDataStore"/> via DI (o la lascia com'e', vuota di default).
/// Un solo endpoint per l'intero sito, non uno per ogni controller di dominio: l'aggregazione
/// fra profilo/acquisti/altro sta nell'unica implementazione di <see cref="IPersonalDataStore"/>.
/// </remarks>
[Route("me/data")]
public sealed class EngineDataPrivacyController : EngineProtectedController
{
    private readonly IPersonalDataStore _store;

    /// <inheritdoc cref="EngineDataPrivacyController"/>
    public EngineDataPrivacyController(IPersonalDataStore store, ILogger<EngineDataPrivacyController> logger)
        : base(logger)
    {
        _store = store;
    }

    /// <summary>
    /// Esporta tutti i dati personali dell'utente autenticato: JSON cifrato (AES-GCM) e
    /// codificato base64. Nessun dato configurato (store di default) ⇒ <c>{ "data": null }</c>,
    /// senza nemmeno toccare <c>Crypto</c> (<c>Security.CryptoSecret</c> può restare vuota finché
    /// un progetto non implementa davvero <see cref="IPersonalDataStore"/>).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Export(CancellationToken cancellationToken)
    {
        var data = await _store.ExportAsync(User, cancellationToken);
        if (data is null)
            return Ok(new { data = (string?)null });

        var json = JsonSerializer.SerializeToUtf8Bytes(data, EngineJson.Web);
        var encrypted = Crypto.Encrypt(json);
        return Ok(new { data = Convert.ToBase64String(encrypted) });
    }

    /// <summary>
    /// Cancella (o anonimizza) tutti i dati personali dell'utente autenticato.
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> Erase(CancellationToken cancellationToken)
    {
        await _store.EraseAsync(User, cancellationToken);
        return NoContent();
    }
}
