using Microsoft.AspNetCore.Http;
using Backend.Blob;
using Backend.Models;
using Backend.Security;

namespace Backend.Store;

/// <summary>Storage dei file caricati, di proprietà del progetto: estende <see cref="FileBlobStore"/>, aggiunge il controllo di proprietà sulla DELETE via <see cref="BlobOwnershipRegistry"/>.</summary>
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

    /// <summary>Invariata (10 MB, default Engine): sovrascrivi qui il numero o l'intera logica di calcolo (ruolo, piano...).</summary>
    public override long MaxUploadSizeBytes => base.MaxUploadSizeBytes;

    /// <summary>Salva il blob (punto dove aggiungere validazioni/quote/antivirus) e ne registra il proprietario — l'utente della sessione corrente.</summary>
    public override async Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken = default)
    {
        var slug = await base.SaveAsync(content, extension, cancellationToken);

        var ownerId = CurrentUserId();
        if (ownerId is not null)
            await _ownership.RecordUploadAsync(slug, location: slug, ownerId, cancellationToken);

        return slug;
    }

    /// <summary>Cancella il blob solo se chi chiama è il proprietario registrato o un admin; uno slug senza proprietario noto non blocca nessuno (non orfanizza i file pre-esistenti).</summary>
    public override async Task<bool> DeleteAsync(string slug, CancellationToken cancellationToken = default)
    {
        await EnsureAuthorizedAsync(slug, cancellationToken);
        return await MarkDeletedAndDeleteAsync(slug, cancellationToken);
    }

    /// <summary>Non delega a <see cref="FileBlobStore.ReplaceAsync"/>: quella salva PRIMA di cancellare, quindi il controllo di proprietà va anticipato qui sul vecchio slug — altrimenti un tentativo non autorizzato lascerebbe comunque un nuovo blob orfano salvato prima del 403.</summary>
    public override async Task<string> ReplaceAsync(string oldSlug, Stream content, string extension, CancellationToken cancellationToken = default)
    {
        await EnsureAuthorizedAsync(oldSlug, cancellationToken);
        var newSlug = await SaveAsync(content, extension, cancellationToken);
        await MarkDeletedAndDeleteAsync(oldSlug, cancellationToken);
        return newSlug;
    }

    /// <summary>Verifica che chi chiama possa cancellare/sostituire lo slug (proprietario o admin); nessun effetto collaterale, solo il 403.</summary>
    private async Task EnsureAuthorizedAsync(string slug, CancellationToken cancellationToken)
    {
        var session = CurrentSession();
        var ownerId = await _ownership.GetOwnerAsync(slug, cancellationToken);
        var isOwner = ownerId is null || ownerId == session?.UserId;
        var isAdmin = session?.Roles.Contains("admin") ?? false;
        if (!isOwner && !isAdmin)
            throw new ForbiddenException();
    }

    /// <summary>Assume l'autorizzazione già verificata dal chiamante. Se il file esiste: prima il commit nel database (il vero punto di non ritorno), POI la cancellazione fisica — se il processo muore fra i due resta un file orfano (mai un DB che dice "presente" per un file sparito).</summary>
    private async Task<bool> MarkDeletedAndDeleteAsync(string slug, CancellationToken cancellationToken)
    {
        if (!TryResolve(slug, out var path) || !File.Exists(path))
            return false;

        var session = CurrentSession();
        if (session is not null)
            await _ownership.MarkDeletedAsync(slug, session.UserId, cancellationToken);

        return await base.DeleteAsync(slug, cancellationToken);
    }

    /// <summary>Ripulisce i file già segnati cancellati sul database ma ancora su disco (crash/IO fra i due passi di <see cref="MarkDeletedAndDeleteAsync"/>). Non tocca blob senza riga in <see cref="BlobOwnershipRegistry"/> (mai tracciati). Ritorna quanti file sono stati rimossi.</summary>
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
