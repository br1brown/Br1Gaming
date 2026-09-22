using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Backend.Engine;
using Backend.Privacy;

namespace Backend.Controllers;

/// <summary>Endpoint dell'engine per export/cancellazione dei dati personali: <c>GET</c>/<c>DELETE /me/data</c>. Un progetto implementa <see cref="IPersonalDataStore"/>, non scrive controller.</summary>
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

    /// <summary>Esporta i dati personali: JSON cifrato (AES-GCM) e base64. Nessun dato ⇒ <c>data: null</c>, senza toccare <c>Crypto</c>.</summary>
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

    /// <summary>Cancella/anonimizza i dati, account incluso (vedi <see cref="IPersonalDataStore.EraseAsync"/>). Il 204 non revoca il JWT (resta valido fino a scadenza): il frontend deve scartarlo subito.</summary>
    [HttpDelete]
    public async Task<IActionResult> Erase(CancellationToken cancellationToken)
    {
        await _store.EraseAsync(User, cancellationToken);
        return NoContent();
    }
}
