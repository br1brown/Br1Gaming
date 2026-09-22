using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Store;

/// <summary>DbContext EF Core del progetto (SQLite). Un progetto con bisogno di un vero database per le proprie entità aggiunge qui altri <see cref="DbSet{TEntity}"/> invece di un secondo ORM.</summary>
public class AppDbContext : DbContext
{
    /// <summary>Inietta le opzioni EF Core (connection string, provider).</summary>
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    /// <summary>Chi ha caricato/cancellato ogni blob — vedi <see cref="BlobOwnership"/>.</summary>
    public DbSet<BlobOwnership> BlobOwnerships => Set<BlobOwnership>();

    /// <inheritdoc/>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BlobOwnership>().HasKey(o => o.Slug);
    }
}
