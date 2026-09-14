using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Backend.Models;

namespace Backend.Blob;

/// <summary>
/// Metadati di un blob persistito, sufficienti a servirlo e a gestirne la cache HTTP
/// (ETag/Last-Modified) senza riaprire il file.
/// </summary>
/// <param name="Slug">Identificativo opaco del blob (include l'estensione originale).</param>
/// <param name="ContentType">MIME type dedotto dall'estensione, o <c>application/octet-stream</c>.</param>
/// <param name="Length">Dimensione in byte.</param>
/// <param name="LastModified">Ultima modifica (UTC): alimenta ETag/Last-Modified e l'invalidazione cache.</param>
public readonly record struct BlobInfo(
    string Slug,
    string ContentType,
    long Length,
    DateTimeOffset LastModified);

/// <summary>
/// Storage dei file caricati (upload utente): salvataggio, lettura, cancellazione. Filesystem
/// locale, cartella <c>uploads/</c>.
/// </summary>
/// <remarks>
/// Classe concreta, non interfaccia: a differenza di <c>IContentStore</c> (traiettoria reale verso
/// un DB, forma specifica di progetto), lo storage dei file è I/O generico con un'unica
/// implementazione plausibile — un'interfaccia sarebbe cerimonia senza un secondo backend reale
/// all'orizzonte (YAGNI). I metodi sono <see langword="virtual"/> e la classe non è
/// <see langword="sealed"/>: <c>Store/AppBlobStore.cs</c> (di progetto) fa già override mirati
/// (validazioni, quote, antivirus) senza bisogno di un'interfaccia — che resta comunque un
/// extract interface di due minuti il giorno in cui servisse davvero uno storage del tutto
/// diverso (S3, Azure Blob). Il come si SERVE un blob via HTTP (verbo, query string
/// <c>webopt</c>, ETag, resize, difesa XSS) resta invece dell'Engine
/// (<see cref="Backend.Controllers.EngineBlobController"/>, `sealed`): questa classe è solo
/// storage, nessuna nozione HTTP.
/// </remarks>
public class FileBlobStore
{
    private static readonly FileExtensionContentTypeProvider _contentTypeProvider = CreateContentTypeProvider();

    /// <summary>
    /// <see cref="FileExtensionContentTypeProvider"/> non conosce ".avif" di default: senza questa
    /// mappatura il file finirebbe classificato "application/octet-stream".
    /// </summary>
    private static FileExtensionContentTypeProvider CreateContentTypeProvider()
    {
        var provider = new FileExtensionContentTypeProvider();
        provider.Mappings[".avif"] = "image/avif";
        return provider;
    }

    /// <summary>Cartella <c>uploads/</c> assoluta, con separatore finale (senza, "/app/uploads-public/x"
    /// supererebbe il check <c>StartsWith("/app/uploads")</c> di <c>TryResolve</c>). Protetta per lo
    /// sweep dei file orfani di <c>AppBlobStore</c>, che deve enumerare la stessa cartella.</summary>
    protected readonly string UploadsPath;

    /// <summary>Inizializza lo store ricavando <c>uploads/</c> dalla content root dell'host.</summary>
    public FileBlobStore(IWebHostEnvironment env)
    {
        UploadsPath = Path.Combine(env.ContentRootPath, "uploads") + Path.DirectorySeparatorChar;
    }

    /// <summary>
    /// Dimensione massima di un singolo upload, in byte. Non è config: è codice, apposta — un
    /// progetto può cambiare solo il numero, o l'intera logica con cui lo calcola (per ruolo
    /// utente, spazio disco residuo, piano dell'account...), qualcosa che un valore statico in
    /// <c>global-settings.json</c> non potrebbe esprimere. Default 10 MB.
    /// </summary>
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

        // Stessa guardia anti path-traversal di TryResolve: il prefisso GUID rende slug univoco, ma
        // un'estensione con segmenti "../" farebbe comunque risolvere filePath fuori da UploadsPath
        // prima ancora di toccare il filesystem.
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

    /// <summary>
    /// "Modifica" di un blob esistente: lo slug resta immutabile (invariato il presupposto dietro
    /// <c>Cache-Control: immutable</c> in <see cref="Backend.Controllers.EngineBlobController"/>),
    /// quindi non sovrascrive — salva il nuovo contenuto come blob a sé (nuovo slug) e cancella
    /// <paramref name="oldSlug"/> DOPO, mai prima: se <see cref="SaveAsync"/> fallisce, il vecchio
    /// blob resta intatto invece di sparire senza un rimpiazzo. Se la cancellazione del vecchio
    /// fallisce (già assente, IO) la sostituzione è comunque riuscita dal punto di vista del
    /// chiamante — resta solo un file orfano su disco, non un dato perso — quindi non lancia.
    /// </summary>
    /// <returns>Il nuovo slug.</returns>
    public virtual async Task<string> ReplaceAsync(string oldSlug, Stream content, string extension, CancellationToken cancellationToken = default)
    {
        var newSlug = await SaveAsync(content, extension, cancellationToken);
        await DeleteAsync(oldSlug, cancellationToken);
        return newSlug;
    }

    /// <summary>
    /// Risolve lo slug nel percorso assoluto, applicando la guardia anti path-traversal.
    /// <c>false</c> se lo slug è vuoto o tenta di uscire dalla cartella degli upload. Protetto (non
    /// privato) perché <c>AppBlobStore.CleanupOrphanedFilesAsync</c> deve applicare la stessa
    /// guardia a <c>Location</c>, che pur coincidendo oggi sempre con lo slug generato da questa
    /// classe resta un valore letto dal database.
    /// </summary>
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

/// <summary>
/// Alza il tetto di dimensione della request PRIMA del model binding, allineandolo a
/// <see cref="FileBlobStore.MaxUploadSizeBytes"/>. Senza questo filtro il tetto di default del
/// server (Kestrel/IIS, ~28-30 MB) rifiuterebbe la request prima ancora che il controllo manuale
/// in <see cref="Backend.Controllers.EngineBlobController.Upload"/> venga eseguito, rendendo
/// inefficace qualunque override di <c>MaxUploadSizeBytes</c> oltre quella soglia. Un
/// <c>[RequestSizeLimit]</c> non basterebbe: è fisso a compile-time, mentre il limite qui è
/// <see langword="virtual"/> (dipende dallo store risolto da DI, che <c>AppBlobStore</c> può
/// calcolare anche a runtime). Controlla anche <c>Content-Length</c> in anticipo (se il client lo
/// dichiara) per restituire subito un 413 nostro invece dell'errore generico del server su un
/// upload chiaramente troppo grande.
/// </summary>
public sealed class DynamicUploadSizeLimitFilter : IResourceFilter
{
    /// <summary>
    /// Margine oltre <see cref="FileBlobStore.MaxUploadSizeBytes"/> per il tetto del server: il
    /// body multipart porta anche boundary/header/altri campi form, quindi è sempre un po' più
    /// grande del solo file. Senza margine, un file esattamente al limite verrebbe rifiutato da
    /// Kestrel/IIS (errore generico) invece di arrivare al controllo puntuale in
    /// <see cref="Backend.Controllers.EngineBlobController.Upload"/>, che è quello che deve
    /// davvero decidere ed eventualmente restituire un 413 strutturato/localizzato.
    /// </summary>
    private const long MultipartOverheadMargin = 64 * 1024;

    private readonly FileBlobStore _blobs;

    /// <summary>Inizializza il filtro con lo store da cui leggere il limite corrente.</summary>
    public DynamicUploadSizeLimitFilter(FileBlobStore blobs) => _blobs = blobs;

    /// <summary>Applicato prima del model binding: qui il body non è ancora stato letto/bufferizzato.</summary>
    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        var limit = _blobs.MaxUploadSizeBytes;

        // Il client dichiara quasi sempre Content-Length su un upload multipart "normale" (non
        // chunked): se supera già abbondantemente il limite, meglio il nostro 413 strutturato/
        // localizzato SUBITO — senza nemmeno iniziare a leggere il body — che aspettare che Kestrel
        // lo tagli a metà con un errore generico dopo aver comunque trasferito parte dei byte.
        if (context.HttpContext.Request.ContentLength is { } declaredLength && declaredLength > limit + MultipartOverheadMargin)
            throw new PayloadTooLargeException();

        var feature = context.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (feature is not null && !feature.IsReadOnly)
            feature.MaxRequestBodySize = limit + MultipartOverheadMargin;
    }

    /// <inheritdoc />
    public void OnResourceExecuted(ResourceExecutedContext context) { }
}

/// <summary>
/// Registrazione DI del sottosistema blob del template.
/// </summary>
public static class BlobExtensions
{
    /// <summary>
    /// Registra lo storage di default (file-based).
    /// </summary>
    /// <remarks>
    /// Usa <c>TryAddSingleton</c>: via di fuga, non obbligo — se un progetto rimuove
    /// <c>Store/AppBlobStore.cs</c> e la sua registrazione, l'app non si rompe per una DI mancante.
    /// Il caso comune resta <c>AppBlobStore</c> (Dominio), registrato esplicitamente subito dopo in
    /// <c>Program.cs</c> e quindi vincente.
    /// </remarks>
    public static IServiceCollection AddTemplateBlob(this IServiceCollection services)
    {
        services.TryAddSingleton<FileBlobStore, FileBlobStore>();
        services.AddScoped<DynamicUploadSizeLimitFilter>();
        return services;
    }
}
