using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SkiaSharp;
using Backend.Blob;
using Backend.Engine;
using Backend.Models;
using Backend.Security;

namespace Backend.Controllers;

/// <summary>
/// Espone i file caricati (<see cref="FileBlobStore"/>): <c>GET/POST up/PUT/DELETE blob/{slug}</c>.
/// Qui vive tutto ciò che è HTTP/generico (verbo, ETag, resize on-demand, difesa XSS, limite di
/// dimensione) — nessun controller di dominio, nessuna sottoclasse: l'unico punto di contatto
/// col dominio è <see cref="FileBlobStore"/>, sostituibile senza toccare questa classe.
/// </summary>
[Route("blob")]
public sealed class EngineBlobController : EngineApiController
{
    // image/gif escluso: SkiaSharp decodifica solo il primo frame e produrrebbe un WebP statico,
    // perdendo l'animazione senza errore. image/svg+xml escluso: vettoriale, va servito com'è e
    // tenuto fuori dal serve-inline per la difesa XSS. Le immagini fuori da questo set sono
    // servite/forzate a download invariate.
    private static readonly HashSet<string> _imageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/bmp", "image/avif"
    };

    /// <summary>Tetto sui megapixel totali dell'immagine da decodificare (~40 MP: copre 8K e oltre).</summary>
    private const long MaxDecodePixels = 40_000_000;

    private readonly FileBlobStore _blobs;
    private readonly BoundedByteCache _weboptCache;

    /// <summary>Inizializza una nuova istanza di <see cref="EngineBlobController"/>.</summary>
    public EngineBlobController(FileBlobStore blobs, BoundedByteCache weboptCache, ILogger<EngineBlobController> logger)
        : base(logger)
    {
        _blobs = blobs;
        _weboptCache = weboptCache;
    }

    /// <summary>
    /// Restituisce il file dello <c>slug</c> (con estensione). <c>webopt</c>: chiede la versione
    /// web-ottimizzata (resize immagini max 1920px→WebP; altri tipi invariati).
    /// </summary>
    [HttpGet("{slug}")]
    public async Task<IActionResult> Get(string slug, [FromQuery] bool webopt, CancellationToken ct)
    {
        var info = await _blobs.GetInfoAsync(slug, ct) ?? throw new NotFoundException("blob");
        var isImage = _imageContentTypes.Contains(info.ContentType);

        Logger.LogInformation("Blob richiesto: {Slug}", slug);

        // Cache HTTP: lo slug è immutabile (ogni upload conia un GUID nuovo), la risposta è cacheabile
        // a lungo. L'ETag (mtime+size+variante) copre le cache condivise; la variante r/w distingue
        // l'originale dalla versione ottimizzata (corpo diverso).
        var variant = webopt ? "w" : "r";
        var etag = $"\"{info.LastModified.ToUnixTimeSeconds():x}-{info.Length:x}-{variant}\"";
        Response.Headers.ETag = etag;
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        // If-None-Match → 304 senza riaprire né ridecodificare nulla: evita il resize SkiaSharp
        // su ogni re-hit.
        if (RequestMatchesETag(etag))
            return StatusCode(StatusCodes.Status304NotModified);

        // webopt + immagine raster gestita: resize al volo (lato lungo max 1920 px → WebP), con cache
        // in-memory sullo slug univoco. GetOrCreateAsync fa anche da coalescing: richieste concorrenti
        // sullo stesso slug non ancora in cache condividono un solo resize invece di rifarlo ciascuna.
        if (webopt && isImage)
        {
            // CancellationToken.None apposta, non ct: il lavoro è condiviso (coalescing) fra richieste
            // concorrenti sullo stesso slug, quindi non deve essere annullabile dalla disconnessione di
            // UNA sola di esse — altrimenti chi si disconnette per primo annullerebbe il resize anche
            // per gli altri richiedenti ancora connessi in attesa dello stesso Task.
            var content = await _weboptCache.GetOrCreateAsync(slug, async () =>
            {
                using var imageStream = await _blobs.OpenReadAsync(slug, CancellationToken.None) ?? throw new NotFoundException("blob");
                return ResizeImageForWeb(imageStream).FileContents;
            });
            return File(content, "image/webp");
        }

        var stream = await _blobs.OpenReadAsync(slug, ct) ?? throw new NotFoundException("blob");

        // Difesa XSS stored: solo le immagini raster note vanno servite inline col loro content-type.
        // Il resto — inclusi .html/.svg/.xml che un utente autenticato può caricare (l'upload non
        // filtra l'estensione) — è forzato a download (attachment, octet-stream), mai interpretato
        // sull'origin.
        if (isImage)
            return File(stream, info.ContentType, enableRangeProcessing: true);

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
    /// content-type). Richiede API key + JWT.
    /// </summary>
    [HttpPost("up")]
    [Authorize(Policy = SecurityDefaults.RequireLoginPolicy)]
    [ServiceFilter(typeof(DynamicUploadSizeLimitFilter))]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new InvalidParametersException();
        // Il tetto del server (Kestrel/IIS) è già stato alzato a MaxUploadSizeBytes da
        // DynamicUploadSizeLimitFilter (gira prima del model binding, quindi prima che questo IFormFile
        // esista); qui la ricontrolliamo comunque per restituire un errore strutturato (413 con chiave
        // localizzata) invece del reset di connessione generico del server sul superamento del tetto.
        if (file.Length > _blobs.MaxUploadSizeBytes)
            throw new PayloadTooLargeException();

        var extension = Path.GetExtension(file.FileName);
        await using var source = file.OpenReadStream();
        var slug = await _blobs.SaveAsync(source, extension, ct);

        Logger.LogInformation("Blob caricato: {Slug}", slug);
        return Ok(new { slug });
    }

    /// <summary>
    /// Sostituisce il contenuto dello <c>slug</c> e restituisce il NUOVO slug univoco. Lo slug
    /// originale resta immutabile (invariato il presupposto dietro <c>Cache-Control: immutable</c>
    /// sulla <c>GET</c>): questo non sovrascrive il file, salva il rimpiazzo come blob a sé e
    /// cancella il vecchio — <see cref="FileBlobStore.ReplaceAsync"/>. Richiede API key + JWT.
    /// </summary>
    [HttpPut("{slug}")]
    [Authorize(Policy = SecurityDefaults.RequireLoginPolicy)]
    [ServiceFilter(typeof(DynamicUploadSizeLimitFilter))]
    public async Task<IActionResult> Replace(string slug, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new InvalidParametersException();
        if (file.Length > _blobs.MaxUploadSizeBytes)
            throw new PayloadTooLargeException();

        var extension = Path.GetExtension(file.FileName);
        await using var source = file.OpenReadStream();
        var newSlug = await _blobs.ReplaceAsync(slug, source, extension, ct);

        Logger.LogInformation("Blob sostituito: {OldSlug} → {NewSlug}", slug, newSlug);
        return Ok(new { slug = newSlug });
    }

    /// <summary>Cancella il blob dello <c>slug</c>. Richiede API key + JWT.</summary>
    [HttpDelete("{slug}")]
    [Authorize(Policy = SecurityDefaults.RequireLoginPolicy)]
    public async Task<IActionResult> Delete(string slug, CancellationToken ct)
    {
        if (!await _blobs.DeleteAsync(slug, ct))
            throw new NotFoundException("blob");

        Logger.LogInformation("Blob cancellato: {Slug}", slug);
        return NoContent();
    }

    /// <summary>
    /// Dato uno stream immagine, restituisce un <see cref="FileContentResult"/> con il lato più lungo
    /// ridimensionato a <paramref name="maxSide"/> pixel mantenendo le proporzioni originali e
    /// convertito in WebP. Se l'immagine è già entro i limiti non viene riscalata.
    /// </summary>
    /// <param name="imageStream">Stream del file immagine da elaborare.</param>
    /// <param name="maxSide">Dimensione massima in pixel del lato più lungo (default 1920).</param>
    private static FileContentResult ResizeImageForWeb(Stream imageStream, int maxSide = 1920)
    {
        // Guardia "decompression bomb": leggiamo le dimensioni dall'HEADER (SKCodec, senza decodificare
        // il raster) e rifiutiamo PRIMA di allocare. `SKBitmap.Decode` allocherebbe width*height*4 byte
        // in RAM prima di qualsiasi controllo: un file di pochi KB che dichiara dimensioni enormi (es.
        // 30000×30000) forzerebbe ~GB per richiesta → OOM. Il limite sui byte in upload non protegge il
        // decodificato, solo l'header lo fa.
        using var codec = SKCodec.Create(imageStream);
        // Codec null = byte non decodificabili come immagine (estensione valida ma contenuto corrotto/falso).
        if (codec is null)
            throw new DecodingException();
        if ((long)codec.Info.Width * codec.Info.Height > MaxDecodePixels)
            throw new UnprocessableEntityException();

        using var original = SKBitmap.Decode(codec);
        if (original is null)
            throw new DecodingException();

        int newWidth, newHeight;
        if (original.Width <= maxSide && original.Height <= maxSide)
        {
            newWidth = original.Width;
            newHeight = original.Height;
        }
        else
        {
            var ratio = Math.Min((double)maxSide / original.Width, (double)maxSide / original.Height);
            newWidth = (int)(original.Width * ratio);
            newHeight = (int)(original.Height * ratio);
        }

        using var resized = original.Resize(new SKImageInfo(newWidth, newHeight), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
        // Resize/Encode possono restituire null (memoria insufficiente, formato non codificabile):
        // senza guardia sarebbe una NRE → 500 generico invece di un errore strutturato.
        if (resized is null)
            throw new UnprocessableEntityException();
        using var skImage = SKImage.FromBitmap(resized);
        using var data = skImage.Encode(SKEncodedImageFormat.Webp, quality: 85);
        if (data is null)
            throw new UnprocessableEntityException();
        return new FileContentResult(data.ToArray(), "image/webp");
    }
}
