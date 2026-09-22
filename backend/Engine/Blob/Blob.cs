using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Backend.Models;

namespace Backend.Blob;

/// <summary>Metadati di un blob persistito: bastano a servirlo e gestirne la cache HTTP (ETag/Last-Modified) senza riaprire il file.</summary>
public readonly record struct BlobInfo(
    string Slug,
    string ContentType,
    long Length,
    DateTimeOffset LastModified);

/// <summary>Storage dei file caricati su filesystem locale (<c>uploads/</c>): classe concreta, non interfaccia (YAGNI). Solo storage, nessuna nozione HTTP (quella è di <see cref="Backend.Controllers.EngineBlobController"/>).</summary>
public class FileBlobStore
{
    private static readonly FileExtensionContentTypeProvider _contentTypeProvider = CreateContentTypeProvider();

    /// <summary><see cref="FileExtensionContentTypeProvider"/> non conosce ".avif" di default.</summary>
    private static FileExtensionContentTypeProvider CreateContentTypeProvider()
    {
        var provider = new FileExtensionContentTypeProvider();
        provider.Mappings[".avif"] = "image/avif";
        return provider;
    }

    /// <summary>Cartella uploads/ assoluta con separatore finale, richiesto dal check <c>StartsWith</c> di <see cref="TryResolve"/>.</summary>
    protected readonly string UploadsPath;

    /// <summary>Inizializza lo store ricavando <c>uploads/</c> dalla content root dell'host.</summary>
    public FileBlobStore(IWebHostEnvironment env)
    {
        UploadsPath = Path.Combine(env.ContentRootPath, "uploads") + Path.DirectorySeparatorChar;
    }

    /// <summary>Dimensione massima di un upload in byte. Non è config: è codice apposta, così un progetto può sovrascrivere anche la logica di calcolo (per ruolo, spazio residuo…), non solo il numero. Default 10 MB.</summary>
    public virtual long MaxUploadSizeBytes => 10 * 1024 * 1024;

    /// <summary>Salva un nuovo blob dallo stream (<paramref name="extension"/> con o senza punto,
    /// guida il content-type alla lettura) e restituisce lo slug con cui recuperarlo.</summary>
    public virtual async Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken = default)
    {
        if (content is null || string.IsNullOrEmpty(extension))
            throw new InvalidParametersException();

        Directory.CreateDirectory(UploadsPath);

        var dot = extension.StartsWith('.') ? string.Empty : ".";
        var slug = $"{Guid.NewGuid():N}{dot}{extension}";

        // Stessa guardia anti path-traversal di TryResolve: un'estensione con "../" farebbe comunque
        // risolvere filePath fuori da UploadsPath, nonostante il prefisso GUID.
        var filePath = Path.GetFullPath(Path.Combine(UploadsPath, slug));
        if (!filePath.StartsWith(UploadsPath, StringComparison.Ordinal))
            throw new InvalidParametersException();

        await using var destination = File.Create(filePath);
        await content.CopyToAsync(destination, cancellationToken);

        return slug;
    }

    /// <summary>Metadati del blob (per servirlo / costruire l'ETag), o <c>null</c> se non valido/assente.</summary>
    public virtual Task<BlobInfo?> GetInfoAsync(string slug, CancellationToken cancellationToken = default)
    {
        if (!TryResolve(slug, out var path) || !File.Exists(path))
            return Task.FromResult<BlobInfo?>(null);

        var fileInfo = new FileInfo(path);
        if (!_contentTypeProvider.TryGetContentType(path, out var contentType))
            contentType = "application/octet-stream";

        return Task.FromResult<BlobInfo?>(new BlobInfo(slug, contentType, fileInfo.Length, fileInfo.LastWriteTimeUtc));
    }

    /// <summary>Apre il blob in lettura, o <c>null</c> se lo slug non è valido/assente. Il chiamante dispone lo stream.</summary>
    public virtual Task<Stream?> OpenReadAsync(string slug, CancellationToken cancellationToken = default)
        => Task.FromResult(TryResolve(slug, out var path) && File.Exists(path) ? (Stream)File.OpenRead(path) : null);

    /// <summary>Cancella il blob. <c>true</c> se esisteva ed è stato rimosso.</summary>
    public virtual Task<bool> DeleteAsync(string slug, CancellationToken cancellationToken = default)
    {
        if (!TryResolve(slug, out var path) || !File.Exists(path))
            return Task.FromResult(false);

        File.Delete(path);
        return Task.FromResult(true);
    }

    /// <summary>"Modifica" di un blob: lo slug resta immutabile, quindi salva il contenuto come nuovo blob e cancella <paramref name="oldSlug"/> DOPO — se <see cref="SaveAsync"/> fallisce il vecchio resta intatto. Ritorna il nuovo slug.</summary>
    public virtual async Task<string> ReplaceAsync(string oldSlug, Stream content, string extension, CancellationToken cancellationToken = default)
    {
        var newSlug = await SaveAsync(content, extension, cancellationToken);
        await DeleteAsync(oldSlug, cancellationToken);
        return newSlug;
    }

    /// <summary>Risolve lo slug nel percorso assoluto con la guardia anti path-traversal; false se vuoto o fuori da uploads/. Protected: <c>AppBlobStore.CleanupOrphanedFilesAsync</c> riusa la stessa guardia su un valore letto dal database.</summary>
    protected bool TryResolve(string slug, out string absolutePath)
    {
        absolutePath = string.Empty;
        if (string.IsNullOrEmpty(slug))
            return false;

        var full = Path.GetFullPath(Path.Combine(UploadsPath, slug));
        if (!full.StartsWith(UploadsPath, StringComparison.Ordinal))
            return false;

        absolutePath = full;
        return true;
    }
}

/// <summary>Alza il tetto di dimensione della request PRIMA del model binding, allineandolo a <see cref="FileBlobStore.MaxUploadSizeBytes"/> (virtual, non esprimibile da un <c>[RequestSizeLimit]</c> fisso a compile-time) — senza, il default Kestrel/IIS (~28-30 MB) rifiuterebbe prima ancora del controllo applicativo.</summary>
public sealed class DynamicUploadSizeLimitFilter : IResourceFilter
{
    /// <summary>Margine oltre il limite per boundary/header multipart: senza, un file esattamente al limite verrebbe rifiutato dal server invece che dal controllo applicativo.</summary>
    private const long MultipartOverheadMargin = 64 * 1024;

    private readonly FileBlobStore _blobs;

    /// <summary>Inizializza il filtro con lo store da cui leggere il limite corrente.</summary>
    public DynamicUploadSizeLimitFilter(FileBlobStore blobs) => _blobs = blobs;

    /// <summary>Applicato prima del model binding: qui il body non è ancora stato letto/bufferizzato.</summary>
    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        var limit = _blobs.MaxUploadSizeBytes;

        // Se il Content-Length dichiarato supera già il limite, 413 nostro subito invece di aspettare
        // che Kestrel tagli la request a metà con un errore generico dopo aver trasferito dei byte.
        if (context.HttpContext.Request.ContentLength is { } declaredLength && declaredLength > limit + MultipartOverheadMargin)
            throw new PayloadTooLargeException();

        var feature = context.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (feature is not null && !feature.IsReadOnly)
            feature.MaxRequestBodySize = limit + MultipartOverheadMargin;
    }

    /// <inheritdoc />
    public void OnResourceExecuted(ResourceExecutedContext context) { }
}

/// <summary>Registrazione DI del sottosistema blob del template.</summary>
public static class BlobExtensions
{
    /// <summary>Registra lo storage file-based con <c>TryAddSingleton</c>: via di fuga, non obbligo — il caso comune resta <c>AppBlobStore</c>, registrato dopo in Program.cs e quindi vincente.</summary>
    public static IServiceCollection AddTemplateBlob(this IServiceCollection services)
    {
        services.TryAddSingleton<FileBlobStore, FileBlobStore>();
        services.AddScoped<DynamicUploadSizeLimitFilter>();
        return services;
    }
}
