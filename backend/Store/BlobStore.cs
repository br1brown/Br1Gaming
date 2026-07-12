using Microsoft.AspNetCore.StaticFiles;
using Backend.Models;

namespace Backend.Store;

/// <summary>
/// Metadati di un blob persistito, sufficienti a servirlo e a gestirne la cache HTTP
/// (ETag/Last-Modified) senza riaprire il file.
/// </summary>
/// <param name="Slug">Identificativo opaco del blob (include l'estensione originale).</param>
/// <param name="AbsolutePath">Percorso assoluto sul filesystem, gia' validato (no path traversal).</param>
/// <param name="ContentType">MIME type dedotto dall'estensione, o <c>application/octet-stream</c>.</param>
/// <param name="Length">Dimensione in byte.</param>
/// <param name="LastModified">Ultima modifica (UTC): alimenta ETag/Last-Modified e l'invalidazione cache.</param>
/// <param name="IsImage"><c>true</c> se immagine raster gestita (no SVG/GIF): guida resize web e difesa XSS (inline solo le immagini note).</param>
public readonly record struct BlobInfo(
    string Slug,
    string AbsolutePath,
    string ContentType,
    long Length,
    DateTimeOffset LastModified,
    bool IsImage);

/// <summary>
/// Utility di storage per i file caricati (<c>uploads/</c>): slug immutabile, guardia path-traversal,
/// content-type già cablati. Di proprietà del progetto — la apri per validazioni/quote/antivirus.
/// Separata da <see cref="FileContentStore"/> (binari vs read-only): backend/README.md §"BlobStore".
/// </summary>
public class BlobStore
{
    // image/gif escluso: SkiaSharp decodifica solo il primo frame e produrrebbe un WebP statico,
    // perdendo l'animazione senza errore. image/svg+xml escluso: vettoriale, va servito com'e' e
    // tenuto fuori dal serve-inline per la difesa XSS. Le immagini fuori da questo set sono
    // servite/forzate a download invariate.
    private static readonly HashSet<string> _imageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/bmp", "image/avif"
    };

    private static readonly FileExtensionContentTypeProvider _contentTypeProvider = new();

    // Trailing separator: senza, "/app/uploads-public/x" supererebbe il check StartsWith("/app/uploads").
    private readonly string _uploadsPath;

    /// <summary>Inizializza lo store ricavando <c>uploads/</c> dalla content root dell'host.</summary>
    public BlobStore(IWebHostEnvironment env)
    {
        _uploadsPath = Path.Combine(env.ContentRootPath, "uploads") + Path.DirectorySeparatorChar;
    }

    /// <summary>Salva un <see cref="IFormFile"/> ricevuto da un form, derivandone l'estensione, e ne restituisce lo slug.</summary>
    public virtual async Task<string> SaveAsync(IFormFile file, CancellationToken ct = default)
    {
        if (file is null || file.Length == 0)
            throw new InvalidParametersException();

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(extension))
            throw new InvalidParametersException();

        await using var source = file.OpenReadStream();
        return await SaveAsync(source, extension, ct);
    }

    /// <summary>Salva un nuovo blob dallo stream e restituisce lo slug con cui recuperarlo.</summary>
    /// <param name="content">Contenuto del file.</param>
    /// <param name="extension">Estensione originale (con o senza punto): serve a dedurre il content-type alla lettura.</param>
    /// <param name="ct">Token di annullamento.</param>
    public virtual async Task<string> SaveAsync(Stream content, string extension, CancellationToken ct = default)
    {
        if (content is null || string.IsNullOrEmpty(extension))
            throw new InvalidParametersException();

        Directory.CreateDirectory(_uploadsPath);

        // Slug = GUID + estensione originale: univoco e immutabile (mai sovrascritto), cosi' un
        // dato slug identifica per sempre lo stesso contenuto -> cache HTTP a lunga scadenza sicura.
        var dot = extension.StartsWith('.') ? string.Empty : ".";
        var slug = $"{Guid.NewGuid():N}{dot}{extension}";
        var filePath = Path.Combine(_uploadsPath, slug);

        await using var destination = File.Create(filePath);
        await content.CopyToAsync(destination, ct);

        return slug;
    }

    /// <summary>
    /// Risolve lo slug nel percorso assoluto, applicando la guardia anti path-traversal.
    /// <c>false</c> se lo slug e' vuoto o tenta di uscire dalla cartella degli upload.
    /// </summary>
    public virtual bool TryResolve(string slug, out string absolutePath)
    {
        absolutePath = string.Empty;
        if (string.IsNullOrEmpty(slug))
            return false;

        // GetFullPath normalizza eventuali "../": se il risultato esce da _uploadsPath e' un
        // tentativo di path traversal e viene rifiutato.
        var full = Path.GetFullPath(Path.Combine(_uploadsPath, slug));
        if (!full.StartsWith(_uploadsPath, StringComparison.Ordinal))
            return false;

        absolutePath = full;
        return true;
    }

    /// <summary>Indica se lo slug e' valido ed esiste sul disco.</summary>
    public virtual bool Exists(string slug) => TryResolve(slug, out var path) && File.Exists(path);

    /// <summary>Apre il blob in lettura, o <c>null</c> se lo slug non e' valido/assente. Il chiamante dispone lo stream.</summary>
    public virtual Stream? OpenRead(string slug)
        => TryResolve(slug, out var path) && File.Exists(path) ? File.OpenRead(path) : null;

    /// <summary>Metadati del blob (per servirlo / costruire l'ETag), o <c>null</c> se non valido/assente.</summary>
    public virtual BlobInfo? GetInfo(string slug)
    {
        if (!TryResolve(slug, out var path) || !File.Exists(path))
            return null;

        var fileInfo = new FileInfo(path);
        if (!_contentTypeProvider.TryGetContentType(path, out var contentType))
            contentType = "application/octet-stream";

        return new BlobInfo(
            slug,
            path,
            contentType,
            fileInfo.Length,
            fileInfo.LastWriteTimeUtc,
            _imageContentTypes.Contains(contentType));
    }

    /// <summary>Cancella il blob. <c>true</c> se esisteva ed e' stato rimosso.</summary>
    public virtual bool Delete(string slug)
    {
        if (!TryResolve(slug, out var path) || !File.Exists(path))
            return false;

        File.Delete(path);
        return true;
    }
}
