using Microsoft.AspNetCore.Http;
using Backend.Blob;
using Backend.Models;
using Backend.Security;

namespace Backend.Store;

/// <summary>
/// Storage dei file caricati, di proprietà del progetto: estende il default Engine
/// (<see cref="FileBlobStore"/>, filesystem locale in <c>uploads/</c>). Punto dove aggiungere
/// validazioni/quote/antivirus prima del salvataggio; qui in più il controllo di proprietà sulla
/// DELETE, via <see cref="BlobOwnershipRegistry"/>.
/// </summary>
public class AppBlobStore : FileBlobStore
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly BlobOwnershipRegistry _ownership;

    /// <inheritdoc cref="FileBlobStore"/>
    public AppBlobStore(IWebHostEnvironment env, IHttpContextAccessor httpContextAccessor, BlobOwnershipRegistry ownership)
        : base(env)
    {
        _httpContextAccessor = httpContextAccessor;
        _ownership = ownership;
    }

    /// <summary>
    /// Dimensione massima di un singolo upload, in byte — di base invariata (10 MB, il default
    /// Engine). Cambia qui il numero, o l'intera logica con cui lo calcoli (per ruolo utente,
    /// piano dell'account...): non è config, è codice apposta.
    /// </summary>
    public override long MaxUploadSizeBytes => base.MaxUploadSizeBytes;

    /// <summary>
    /// Salva il blob (validazioni/quote/antivirus prima della base, se servono) e ne registra il
    /// proprietario — l'utente della sessione corrente — su <see cref="BlobOwnershipRegistry"/>.
    /// </summary>
    public override async Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken = default)
    {
        var slug = await base.SaveAsync(content, extension, cancellationToken);

        var ownerId = CurrentUserId();
        if (ownerId is not null)
            await _ownership.RecordUploadAsync(slug, location: slug, ownerId, cancellationToken);

        return slug;
    }

    /// <summary>
    /// Cancella il blob dato lo slug, ma solo se chi chiama è il proprietario registrato o un
    /// admin — uno slug senza proprietario noto (caricato prima che il registro esistesse) non
    /// blocca nessuno, per non orfanizzare i file già presenti.
    /// </summary>
    public override async Task<bool> DeleteAsync(string slug, CancellationToken cancellationToken = default)
    {
        await EnsureAuthorizedAsync(slug, cancellationToken);
        return await MarkDeletedAndDeleteAsync(slug, cancellationToken);
    }

    /// <summary>
    /// Sostituisce un blob esistente (salva il nuovo, poi cancella il vecchio). A differenza degli
    /// altri override, NON delega a <see cref="FileBlobStore.ReplaceAsync"/>: quella salva il nuovo
    /// blob PRIMA di cancellare il vecchio, quindi se il controllo di proprietà vivesse solo dentro
    /// <see cref="DeleteAsync"/> un tentativo non autorizzato lascerebbe comunque un nuovo blob
    /// salvato e censito sul disco prima del 403 — mai ripulito, perché nessuno ne conosce lo slug.
    /// Il controllo va anticipato qui, sul vecchio slug, prima di salvare alcunché; la sequenza
    /// save-poi-cancella va quindi scritta esplicitamente invece di riusare la base.
    /// </summary>
    public override async Task<string> ReplaceAsync(string oldSlug, Stream content, string extension, CancellationToken cancellationToken = default)
    {
        await EnsureAuthorizedAsync(oldSlug, cancellationToken);
        var newSlug = await SaveAsync(content, extension, cancellationToken);
        await MarkDeletedAndDeleteAsync(oldSlug, cancellationToken);
        return newSlug;
    }

    /// <summary>
    /// Verifica che chi chiama possa cancellare/sostituire <paramref name="slug"/> (proprietario o
    /// admin) — nessun effetto collaterale, solo il 403. Condiviso da <see cref="DeleteAsync"/> e
    /// <see cref="ReplaceAsync"/>, che lo eseguono una sola volta ciascuno prima di toccare
    /// qualunque file o riga di database.
    /// </summary>
    private async Task EnsureAuthorizedAsync(string slug, CancellationToken cancellationToken)
    {
        var session = CurrentSession();
        var ownerId = await _ownership.GetOwnerAsync(slug, cancellationToken);
        var isOwner = ownerId is null || ownerId == session?.UserId;
        var isAdmin = session?.Roles.Contains("admin") ?? false;
        if (!isOwner && !isAdmin)
            throw new ForbiddenException();
    }

    /// <summary>
    /// Marca la cancellazione sul database e cancella il file fisico — assume che l'autorizzazione
    /// sia già stata verificata dal chiamante (<see cref="EnsureAuthorizedAsync"/>), così non deve
    /// distinguere "non autorizzato" da "slug inesistente" per chi la chiama.
    /// </summary>
    /// <remarks>
    /// Controlla prima che il file esista davvero: uno slug già cancellato (o mai esistito) non
    /// deve produrre una nuova riga "cancellato da X alle ore Y" nel registro — sarebbe un'entrata
    /// di audit fuorviante per un'operazione che di fatto non ha fatto nulla. Poi, solo se c'è
    /// davvero qualcosa da cancellare: prima il commit nel database
    /// (<see cref="BlobOwnershipRegistry.MarkDeletedAsync"/> — il vero punto di non ritorno,
    /// l'unico dei due passi che può essere una transazione), POI la cancellazione fisica del file,
    /// che non può esserlo. Se il processo muore fra i due passi, resta al più un file orfano (che
    /// <see cref="CleanupOrphanedFilesAsync"/> ripulisce), mai un database che dice "presente" per
    /// un file già sparito.
    /// </remarks>
    private async Task<bool> MarkDeletedAndDeleteAsync(string slug, CancellationToken cancellationToken)
    {
        if (!TryResolve(slug, out var path) || !File.Exists(path))
            return false;

        var session = CurrentSession();
        if (session is not null)
            await _ownership.MarkDeletedAsync(slug, session.UserId, cancellationToken);

        return await base.DeleteAsync(slug, cancellationToken);
    }

    /// <summary>
    /// Ripulisce i file su disco che il database ha già segnato cancellati (perché il passo di
    /// cancellazione fisica in <see cref="DeleteAsync"/> non è mai garantito — crash, IO — a
    /// differenza del commit del database che lo precede sempre). NON tocca file senza una riga in
    /// <see cref="BlobOwnershipRegistry"/>: quelli sono blob mai tracciati (caricati prima che il
    /// registro esistesse), non orfani da questa classe.
    /// </summary>
    /// <returns>Quanti file sono stati effettivamente rimossi.</returns>
    public async Task<int> CleanupOrphanedFilesAsync(CancellationToken cancellationToken = default)
    {
        var pending = await _ownership.GetPendingCleanupLocationsAsync(cancellationToken);
        var removed = 0;
        foreach (var location in pending)
        {
            if (!TryResolve(location, out var path) || !File.Exists(path))
                continue;
            try
            {
                File.Delete(path);
                removed++;
            }
            catch
            {
                // Si ritenta al prossimo sweep — il database dice già "cancellato", nessun danno a
                // lasciare il file orfano un altro giro.
            }
        }
        return removed;
    }

    private SessionInfo? CurrentSession() => _httpContextAccessor.HttpContext?.User.GetSession<SessionInfo>();
    private string? CurrentUserId() => CurrentSession()?.UserId;
}
