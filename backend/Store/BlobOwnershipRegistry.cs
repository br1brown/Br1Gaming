using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Store;

/// <summary>Chi ha caricato/cancellato ogni blob e dove vive: usato per il controllo di proprietà sulla DELETE, storico, e sweep dei file orfani. EF Core/SQLite.</summary>
public class BlobOwnershipRegistry
{
    private readonly IDbContextFactory<AppDbContext> _dbContextFactory;

    /// <summary>Singleton: usa <see cref="IDbContextFactory{TContext}"/> (non un <see cref="AppDbContext"/> diretto) perché un DbContext non è condivisibile tra richieste concorrenti.</summary>
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

    /// <summary>Segna lo slug come cancellato (la riga resta, storico); questo commit, non la cancellazione fisica del file, è il punto di non ritorno — chiamato PRIMA di toccare il disco.</summary>
    public async Task MarkDeletedAsync(string slug, string deletedBy, CancellationToken cancellationToken = default)
    {
        await using var db = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        var row = await db.BlobOwnerships.FirstOrDefaultAsync(o => o.Slug == slug, cancellationToken);
        if (row is null) return; // niente da segnare — nessun proprietario era mai stato registrato

        row.DeletedBy = deletedBy;
        row.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Location segnate cancellate nel database (candidate per lo sweep). Un blob mai tracciato non ha riga, quindi non compare e il suo file non viene mai toccato.</summary>
    public async Task<List<string>> GetPendingCleanupLocationsAsync(CancellationToken cancellationToken = default)
    {
        await using var db = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        return await db.BlobOwnerships
            .Where(o => o.DeletedAt != null)
            .Select(o => o.Location)
            .ToListAsync(cancellationToken);
    }
}
