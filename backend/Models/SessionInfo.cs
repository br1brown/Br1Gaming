namespace Backend.Models;

/// <summary>
/// Payload di sessione nel claim "session" del JWT (leggibile via <c>User.GetSession&lt;SessionInfo&gt;()</c>).
/// Deve rispecchiare a mano <c>frontend/src/app/core/dto/session.dto.ts</c> (niente codegen). Solo dati
/// NON sensibili (il JWT è leggibile dal client). Esempio del template — adatta i campi al progetto.
/// </summary>
public record SessionInfo
{
    /// <summary>Identificativo del principale autenticato.</summary>
    public string UserId { get; init; } = "";

    /// <summary>Nome visualizzato dell'utente.</summary>
    public string DisplayName { get; init; } = "";

    /// <summary>Ruoli applicativi (di dominio, distinti dal ruolo JWT "Authenticated").</summary>
    public string[] Roles { get; init; } = [];
}
