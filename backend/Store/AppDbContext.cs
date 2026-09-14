using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Store;

/// <summary>
/// Il DbContext EF Core del progetto — SQLite, file <c>uploads/app.db</c>. Oggi ha una sola
/// entità (<see cref="BlobOwnership"/>, per <see cref="AppBlobStore"/>); un progetto che ha
/// bisogno di un vero database per le proprie entità aggiunge qui altri <see cref="DbSet{TEntity}"/>
/// invece di introdurre un secondo ORM/connessione — stessa migrazione, stesso file.
/// </summary>
public class AppDbContext : DbContext
{
    /// <inheritdoc cref="AppDbContext"/>
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    /// <summary>Chi ha caricato/cancellato ogni blob — vedi <see cref="BlobOwnership"/>.</summary>
    public DbSet<BlobOwnership> BlobOwnerships => Set<BlobOwnership>();

    /// <inheritdoc/>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BlobOwnership>().HasKey(o => o.Slug);
    }
}
