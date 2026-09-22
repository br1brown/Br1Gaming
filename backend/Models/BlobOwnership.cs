namespace Backend.Models;

/// <summary>Riga di <see cref="Backend.Store.AppDbContext"/>: chi ha caricato/cancellato un blob. Le righe non vengono rimosse alla cancellazione (<see cref="DeletedBy"/>/<see cref="DeletedAt"/> valorizzati), quindi la tabella è anche storico.</summary>
public class BlobOwnership
{
    /// <summary>Slug del blob (chiave primaria, mai riassegnato).</summary>
    public string Slug { get; set; } = "";

    /// <summary>Dove vive il contenuto, relativo a uploads/. Campo a sé (oggi coincide con lo slug) per non legarsi alla convenzione attuale se domani cambia lo storage.</summary>
    public string Location { get; set; } = "";

    /// <summary>Chi ha caricato il blob (<c>SessionInfo.UserId</c>).</summary>
    public string OwnerId { get; set; } = "";

    /// <summary>Quando è stato caricato.</summary>
    public DateTimeOffset UploadedAt { get; set; }

    /// <summary>Chi lo ha cancellato, o <c>null</c> se ancora presente.</summary>
    public string? DeletedBy { get; set; }

    /// <summary>Quando è stato cancellato, o <c>null</c> se ancora presente.</summary>
    public DateTimeOffset? DeletedAt { get; set; }
}
