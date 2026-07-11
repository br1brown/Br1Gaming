using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Models;
using Backend.Security;
using Backend.Store;

namespace Backend.Controllers;

/// <summary>
/// Espone i file caricati (<see cref="BlobStore"/>, volume <c>uploads/</c>). Lettura con sola API key,
/// nessuna auth utente. Storage e sicurezza vivono nello store; qui solo il wiring HTTP (resize
/// on-demand, difesa XSS, cache).
/// </summary>
[Route("blob")]
public class BlobController : EngineBlobController
{
    private readonly BlobStore _blobs;

    /// <summary>Inizializza una nuova istanza di <see cref="BlobController"/>.</summary>
    public BlobController(BlobStore blobs, ILogger<BlobController> logger)
        : base(logger)
    {
        _blobs = blobs;
    }

    /// <summary>
    /// Restituisce il file dello <c>slug</c> (con estensione). <c>webopt</c>: chiede la versione
    /// web-ottimizzata (oggi = resize immagini max 1920px→WebP; altri tipi invariati).
    /// </summary>
    [HttpGet("{slug}")]
    public IActionResult Get(string slug, [FromQuery] bool webopt = false)
    {
        var info = _blobs.GetInfo(slug);
        if (info is null)
            throw new NotFoundException("blob");
        var blob = info.Value;

        Logger.LogInformation("Blob richiesto: {Slug}", slug);

        // Cache HTTP: lo slug è immutabile (ogni upload conia un GUID nuovo), la risposta è cacheabile
        // a lungo. L'ETag (mtime+size+variante) copre le cache condivise; la variante r/w distingue
        // l'originale dalla versione ottimizzata (corpo diverso).
        var variant = webopt ? "w" : "r";
        var etag = $"\"{blob.LastModified.ToUnixTimeSeconds():x}-{blob.Length:x}-{variant}\"";
        Response.Headers.ETag = etag;
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        // If-None-Match → 304 senza riaprire né ridecodificare nulla: è ciò che evita il resize
        // SkiaSharp sui re-hit (prima ogni richiesta webopt ricodificava da capo).
        if (RequestMatchesETag(etag))
            return StatusCode(StatusCodes.Status304NotModified);

        // webopt + immagine raster gestita: resize al volo (lato lungo max 1920 px → WebP).
        if (webopt && blob.IsImage)
        {
            using var imageStream = _blobs.OpenRead(slug) ?? throw new NotFoundException("blob");
            return ResizeImageForWeb(imageStream);
        }

        var stream = _blobs.OpenRead(slug) ?? throw new NotFoundException("blob");

        // Difesa XSS stored: solo le immagini raster note vanno servite inline col loro content-type.
        // Il resto — inclusi .html/.svg/.xml che un utente autenticato può caricare (l'upload non filtra
        // l'estensione) — è forzato a download (attachment, octet-stream), mai interpretato sull'origin.
        if (blob.IsImage)
            return File(stream, blob.ContentType, enableRangeProcessing: true);

        return File(stream, "application/octet-stream", fileDownloadName: slug, enableRangeProcessing: true);
    }

    /// <summary>
    /// Verifica se l'header <c>If-None-Match</c> della richiesta corrisponde all'<paramref name="etag"/> corrente.
    /// </summary>
    private bool RequestMatchesETag(string etag)
    {
        var ifNoneMatch = Request.Headers.IfNoneMatch;
        if (ifNoneMatch.Count == 0)
            return false;

        foreach (var value in ifNoneMatch)
        {
            if (string.IsNullOrEmpty(value))
                continue;
            // "*" = qualunque rappresentazione; altrimenti il client rimanda l'ETag che gli abbiamo dato.
            if (value == "*" || value.Contains(etag, StringComparison.Ordinal))
                return true;
        }
        return false;
    }

    /// <summary>
    /// Carica un file e restituisce lo slug univoco (con estensione, serve alla GET per il
    /// content-type). Richiede API key + JWT. Altri form: usa direttamente <see cref="BlobStore.SaveAsync(IFormFile,System.Threading.CancellationToken)"/>.
    /// </summary>
    [HttpPost("up")]
    [Authorize(Policy = SecurityDefaults.RequireLoginPolicy)]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB — i progetti figli possono sovrascrivere con [RequestSizeLimit] sul proprio controller
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        var slug = await _blobs.SaveAsync(file, ct);
        Logger.LogInformation("Blob caricato: {Slug}", slug);
        return Ok(new { slug });
    }
}
