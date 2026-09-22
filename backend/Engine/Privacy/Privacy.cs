using System.Security.Claims;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Backend.Privacy;

/// <summary>Contratto per export/cancellazione dei dati personali (GDPR artt. 15/17), dietro l'unico endpoint <c>EngineDataPrivacyController</c>. Riceve il <see cref="ClaimsPrincipal"/> grezzo (non un subjectId): l'engine non conosce la forma di <c>SessionInfo</c>, solo l'implementazione la rilegge.</summary>
public interface IPersonalDataStore
{
    /// <summary>Tutti i dati personali dell'utente, serializzabili a JSON; nessuna sorgente ⇒ null.</summary>
    Task<object?> ExportAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default);

    /// <summary>Cancella/anonimizza tutti i dati personali, account incluso (eccetto dati con obbligo legale di conservazione); nessuna sorgente ⇒ no-op.</summary>
    Task EraseAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default);
}

/// <summary>Implementazione di default: nessun dato personale da esportare o cancellare (endpoint attivo ma inerte finché un progetto non registra la propria <see cref="IPersonalDataStore"/>).</summary>
public sealed class NullPersonalDataStore : IPersonalDataStore
{
    /// <inheritdoc />
    public Task<object?> ExportAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
        => Task.FromResult<object?>(null);

    /// <inheritdoc />
    public Task EraseAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}

/// <summary>Registrazione DI del sottosistema privacy del template.</summary>
public static class PrivacyExtensions
{
    /// <summary>Registra la sorgente dati personali di default (vuota) con <c>TryAddSingleton</c>: un progetto la sostituisce nel blocco SERVIZI APPLICATIVI di Program.cs.</summary>
    public static IServiceCollection AddTemplatePrivacy(this IServiceCollection services)
    {
        services.TryAddSingleton<IPersonalDataStore, NullPersonalDataStore>();
        return services;
    }
}
