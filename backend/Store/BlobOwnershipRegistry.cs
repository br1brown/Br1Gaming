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

    /// <summary>Proprietario registrato di <paramref name="slug"/>, o <c>null</c>: uno slug senza proprietario
    /// registrato non ha nessun proprietario noto, quindi nessun blocco.</summary>
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
        if (row is null) return; // niente da segnare: slug senza proprietario registrato

        row.DeletedBy = deletedBy;
        row.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Diritto all'oblio (art. 17 GDPR): sostituisce <paramref name="userId"/> con un id casuale in ogni riga
    /// (proprietario e autore della cancellazione), in un'unica transazione. I file restano.</summary>
    public async Task AnonymizeUserAsync(string userId, CancellationToken cancellationToken = default)
    {
        // Un solo id per cancellazione, casuale così nessun account futuro può coincidere: le righe dell'utente
        // restano collegabili fra loro (stesso autore), ma a nessuna persona.
        var anonymous = $"anonimo-{Guid.NewGuid():N}";
        await using var db = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.BlobOwnerships
            .Where(o => o.OwnerId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.OwnerId, anonymous), cancellationToken);
        await db.BlobOwnerships
            .Where(o => o.DeletedBy == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.DeletedBy, anonymous), cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    /// <summary>Slug dei blob ancora presenti caricati da <paramref name="userId"/> (export dei dati personali).</summary>
    public async Task<List<string>> GetOwnedSlugsAsync(string userId, CancellationToken cancellationToken = default)
    {
        await using var db = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        return await db.BlobOwnerships
            .Where(o => o.OwnerId == userId && o.DeletedAt == null)
            .Select(o => o.Slug)
            .ToListAsync(cancellationToken);
    }

    /// <summary>Storico completo dell'utente (export dei dati personali, art. 15 GDPR): ogni riga in cui compare come proprietario
    /// o come autore della cancellazione, con le date. Sono gli stessi campi che <see cref="AnonymizeUserAsync"/> anonimizza:
    /// ciò che si considera dato personale da cancellare si deve anche poter esportare.</summary>
    public async Task<List<BlobHistoryEntry>> GetHistoryAsync(string userId, CancellationToken cancellationToken = default)
    {
        await using var db = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        var rows = await db.BlobOwnerships
            .Where(o => o.OwnerId == userId || o.DeletedBy == userId)
            .Select(o => new BlobHistoryEntry(o.Slug, o.OwnerId == userId, o.UploadedAt, o.DeletedAt, o.DeletedBy == userId))
            .ToListAsync(cancellationToken);
        // Ordinamento lato client: SQLite non ordina per DateTimeOffset.
        return rows.OrderBy(r => r.CaricatoIl).ToList();
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

/// <summary>Una riga dello storico di un utente (<see cref="BlobOwnershipRegistry.GetHistoryAsync"/>): serializzata in camelCase nell'export.</summary>
/// <param name="Slug">Slug del blob.</param>
/// <param name="Caricato">L'utente lo ha caricato.</param>
/// <param name="CaricatoIl">Quando è stato caricato.</param>
/// <param name="CancellatoIl">Quando è stato cancellato, o <c>null</c> se ancora presente.</param>
/// <param name="Cancellato">L'utente lo ha cancellato.</param>
public sealed record BlobHistoryEntry(string Slug, bool Caricato, DateTimeOffset CaricatoIl, DateTimeOffset? CancellatoIl, bool Cancellato);
