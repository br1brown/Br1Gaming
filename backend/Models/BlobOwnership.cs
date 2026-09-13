namespace Backend.Models;

/// <summary>
/// Riga di <see cref="Backend.Store.AppDbContext"/>: chi ha caricato (e, se successo, cancellato)
/// un blob. Usata da <c>AppBlobStore</c> per il controllo di proprietà sulla DELETE; le righe non
/// vengono rimosse alla cancellazione (<see cref="DeletedBy"/>/<see cref="DeletedAt"/> valorizzati
/// invece), quindi la tabella è anche lo storico di chi ha fatto cosa.
/// </summary>
public class BlobOwnership
{
    /// <summary>Slug del blob (chiave primaria — identificativo univoco, uno per blob, mai
    /// riassegnato: se un domani il contenuto cambia, cambia lo slug, mai questa riga).</summary>
    public string Slug { get; set; } = "";

    /// <summary>
    /// Dove vive il contenuto, relativo alla cartella <c>uploads/</c> — oggi coincide sempre col
    /// nome file (<c>FileBlobStore</c> non ha altra convenzione), ma è un campo a sé
    /// apposta: un domani con una struttura a cartelle o uno storage diverso, questo valore lo
    /// esprime senza dover derivarlo dallo slug per convenzione fissa.
    /// </summary>
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
