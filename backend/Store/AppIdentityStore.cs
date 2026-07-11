using Backend.Identity;
using Backend.Models.Configuration;
using Backend.Models.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Backend.Store;

/// <summary>
/// Sorgente identità del sito, di proprietà del progetto: estende il default Engine
/// (<see cref="FileIdentityStore"/>, legge <c>data/identity.json</c>). Punto dove comporre
/// l'identità da più fonti; oggi passthrough. Estensione a due livelli: backend/README.md.
/// </summary>
public class AppIdentityStore : FileIdentityStore
{
    /// <inheritdoc cref="FileIdentityStore"/>
    public AppIdentityStore(IWebHostEnvironment env, IOptions<LocalizationOptions> localizationOptions, IMemoryCache cache)
        : base(env, localizationOptions, cache) { }

    /// <summary>
    /// Compone l'identità: riceve il modello da <c>data/identity.json</c> (o <c>null</c>) e lo
    /// restituisce — oggi invariato. Fondi qui pezzi presi altrove (DB/API) prima di restituirlo.
    /// </summary>
    /// <example><code>
    /// identity ??= new SiteIdentity();
    /// identity.OpeningHours = [ new() { Day = DayOfWeek.Tuesday, Opens = new(9,0), Closes = new(18,0) } ];
    /// return identity;
    /// </code></example>
    protected override Task<SiteIdentity?> ComposeIdentityAsync(SiteIdentity? identity, string language, CancellationToken cancellationToken)
        => base.ComposeIdentityAsync(identity, language, cancellationToken);
}
