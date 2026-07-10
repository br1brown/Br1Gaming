using System.Security.Claims;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Backend.Privacy;

/// <summary>
/// Contratto con cui un progetto figlio espone export e cancellazione dei dati personali
/// (diritto di accesso/portabilita' e diritto all'oblio, GDPR artt. 15/17).
/// </summary>
/// <remarks>
/// E' il seam gemello di <see cref="Backend.Identity.IIdentityStore"/>: un'unica implementazione,
/// registrata una volta in DI, dietro l'unico endpoint <c>EngineDataPrivacyController</c>
/// (<c>GET</c>/<c>DELETE /me/data</c>) — non un metodo da ripetere in ogni controller di dominio
/// (profilo, acquisti, ...). Riceve il <see cref="ClaimsPrincipal"/> della richiesta, non un
/// subjectId gia' estratto: l'engine non conosce la forma di <c>SessionInfo</c> (e' Dominio), quindi
/// e' l'implementazione — che invece SessionInfo lo conosce — a rileggerlo con
/// <c>user.GetSession&lt;SessionInfo&gt;()</c> e ad aggregare da li' tutti gli store che le servono.
/// </remarks>
public interface IPersonalDataStore
{
    /// <summary>
    /// Raccoglie tutti i dati personali associati all'utente autenticato, in una forma
    /// serializzabile a JSON. Nessun dato o sorgente non configurata ⇒ <c>null</c>.
    /// </summary>
    Task<object?> ExportAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancella (o anonimizza) tutti i dati personali associati all'utente autenticato.
    /// Nessuna sorgente da cancellare ⇒ no-op.
    /// </summary>
    Task EraseAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementazione di default di <see cref="IPersonalDataStore"/>: nessun dato personale
/// da esportare o cancellare.
/// </summary>
/// <remarks>
/// A differenza di <c>FileIdentityStore</c> non c'e' un file di default sensato da leggere qui:
/// i dati personali non sono config statica, vivono in qualunque storage il progetto usa per il
/// proprio dominio. Il figlio che ne ha bisogno sostituisce questa registrazione con la propria
/// <see cref="IPersonalDataStore"/> (vedi <see cref="PrivacyExtensions.AddTemplatePrivacy"/>);
/// finche' non lo fa, l'endpoint resta attivo ma inerte, mai un 404/500 a sorpresa.
/// </remarks>
public sealed class NullPersonalDataStore : IPersonalDataStore
{
    /// <inheritdoc />
    public Task<object?> ExportAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
        => Task.FromResult<object?>(null);

    /// <inheritdoc />
    public Task EraseAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}

/// <summary>
/// Registrazione DI del sottosistema privacy del template.
/// </summary>
public static class PrivacyExtensions
{
    /// <summary>
    /// Registra la sorgente dati personali di default (vuota).
    /// </summary>
    /// <remarks>
    /// Usa <c>TryAddSingleton</c>: un progetto figlio sostituisce la sorgente registrando la propria
    /// <see cref="IPersonalDataStore"/> nel blocco SERVIZI APPLICATIVI di <c>Program.cs</c>, senza
    /// toccare l'engine — stesso meccanismo di <c>AddTemplateIdentity</c>.
    /// </remarks>
    public static IServiceCollection AddTemplatePrivacy(this IServiceCollection services)
    {
        services.TryAddSingleton<IPersonalDataStore, NullPersonalDataStore>();
        return services;
    }
}
