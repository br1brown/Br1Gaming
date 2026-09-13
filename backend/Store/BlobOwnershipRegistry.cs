using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Store;

/// <summary>
/// Chi ha caricato (e, se successo, cancellato) ogni blob, e dove vive il suo contenuto — usato da
/// <see cref="AppBlobStore"/> per il controllo di proprietà sulla DELETE, come storico, e come
/// fonte di verità per lo sweep dei file orfani. EF Core (<see cref="AppDbContext"/>, SQLite): più
/// admin possono caricare/cancellare in concorrenza senza il rischio di corruzione di un JSON
/// letto-modificato-riscritto a mano — e un progetto che aggiunge le proprie entità trova già lo
/// stesso DbContext/le stesse migration pronte, invece di un secondo ORM da introdurre.
/// </summary>
/// <remarks>
/// Registrato come singleton (deve vivere quanto <see cref="AppBlobStore"/>), quindi usa
/// <see cref="IDbContextFactory{TContext}"/> invece di iniettare <see cref="AppDbContext"/>
/// direttamente: un <c>DbContext</c> non è pensato per essere condiviso tra richieste concorrenti,
/// la factory ne crea uno nuovo, breve, per ogni operazione.
/// </remarks>
public class BlobOwnershipRegistry
{
    private readonly IDbContextFactory<AppDbContext> _dbContextFactory;

    /// <inheritdoc cref="BlobOwnershipRegistry"/>
    public BlobOwnershipRegistry(IDbContextFactory<AppDbContext> dbContextFactory)
    {
        _dbContextFactory = dbContextFactory;
    }

    /// <summary>Registra il caricamento di <paramref name="slug"/> (a <paramref name="location"/>)
    /// da parte di <paramref name="ownerId"/>.</summary>
    public async Task RecordUploadAsync(string slug, string location, string ownerId, CancellationToken cancellationToken = default)
    {
        await using var db = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        db.BlobOwnerships.Add(new BlobOwnership { Slug = slug, Location = location, OwnerId = ownerId, UploadedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Proprietario registrato di <paramref name="slug"/>, o <c>null</c> se non tracciato
    /// (es. caricato prima che questo registro esistesse) — nessun proprietario noto, nessun blocco.</summary>
    public async Task<string?> GetOwnerAsync(string slug, CancellationToken cancellationToken = default)
    {
        await using var db = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        return await db.BlobOwnerships
            .Where(o => o.Slug == slug)
            .Select(o => o.OwnerId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// Segna <paramref name="slug"/> come cancellato da <paramref name="deletedBy"/> — la riga
    /// resta (storico), non viene rimossa. Questo commit, non la cancellazione fisica del file (che
    /// non può essere transazionale), è il punto di non ritorno: <c>AppBlobStore</c> lo chiama
    /// PRIMA di toccare il file su disco, cosicché un crash a metà lascia al più un file orfano
    /// (lo sweep di <see cref="GetPendingCleanupLocationsAsync"/> lo ripulisce), mai una riga che
    /// dice "presente" per un file già sparito o viceversa.
    /// </summary>
    public async Task MarkDeletedAsync(string slug, string deletedBy, CancellationToken cancellationToken = default)
    {
        await using var db = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        var row = await db.BlobOwnerships.FirstOrDefaultAsync(o => o.Slug == slug, cancellationToken);
        if (row is null) return; // niente da segnare — nessun proprietario era mai stato registrato

        row.DeletedBy = deletedBy;
        row.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Le location segnate cancellate nel database — candidate per lo sweep dei file orfani.
    /// Deliberatamente NON tutto ciò che non è "vivo": un blob mai tracciato (caricato prima che
    /// questo registro esistesse) non ha una riga affatto, quindi non compare qui e il suo file
    /// non viene mai toccato — lo sweep ripulisce solo ciò che il sistema stesso ha già dichiarato
    /// cancellato, non fa terra bruciata di tutto ciò che non riconosce.
    /// </summary>
    public async Task<List<string>> GetPendingCleanupLocationsAsync(CancellationToken cancellationToken = default)
    {
        await using var db = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        return await db.BlobOwnerships
            .Where(o => o.DeletedAt != null)
            .Select(o => o.Location)
            .ToListAsync(cancellationToken);
    }
}
