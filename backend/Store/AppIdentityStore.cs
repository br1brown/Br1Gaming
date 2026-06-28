using Backend.Identity;
using Backend.Models.Configuration;
using Backend.Models.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Backend.Store;

/// <summary>
/// Sorgente dell'identità del sito **di proprietà del progetto**. Estende il default dell'Engine
/// (<see cref="FileIdentityStore"/>, che legge <c>data/identity.json</c>) e ne eredita lettura e
/// risoluzione i18n; qui resta il punto dove il figlio **compone** l'identità da più fonti.
/// </summary>
/// <remarks>
/// Registrata nel blocco SERVIZI APPLICATIVI di <c>Program.cs</c>: è il file che apri quando un dato
/// dell'identità non vive (più) in <c>data/identity.json</c> ma altrove (es. orari o capitale da un
/// DB/API). Oggi è un passthrough — la modifichi solo quando serve. Per sostituire interamente la
/// sorgente (niente file) puoi comunque registrare una tua <see cref="IIdentityStore"/> da zero.
/// </remarks>
public class AppIdentityStore : FileIdentityStore
{
    /// <inheritdoc cref="FileIdentityStore"/>
    public AppIdentityStore(IWebHostEnvironment env, IOptions<LocalizationOptions> localizationOptions, IMemoryCache cache)
        : base(env, localizationOptions, cache) { }

    /// <summary>
    /// Composizione dell'identità del progetto. Riceve il modello letto da <c>data/identity.json</c>
    /// (o <c>null</c> se assente) e lo restituisce — oggi **invariato**.
    /// </summary>
    /// <remarks>
    /// Quando un pezzo dell'identità vivrà altrove, recuperalo qui e fondilo nel modello prima di
    /// restituirlo — tutto tipizzato, senza stringhe magiche né conoscere schema.org. Esempio:
    /// <code>
    /// identity ??= new SiteIdentity();
    /// identity.OpeningHours =
    /// [
    ///     new() { Day = DayOfWeek.Tuesday, Opens = new(9, 0), Closes = new(18, 0) },
    ///     new() { Day = DayOfWeek.Wednesday, Opens = new(9, 0), Closes = new(13, 0) },   // pausa pranzo
    ///     new() { Day = DayOfWeek.Wednesday, Opens = new(15, 0), Closes = new(18, 0) },
    /// ];
    /// return identity;
    /// </code>
    /// </remarks>
    protected override Task<SiteIdentity?> ComposeIdentityAsync(SiteIdentity? identity, string language, CancellationToken cancellationToken)
        => base.ComposeIdentityAsync(identity, language, cancellationToken);
}
