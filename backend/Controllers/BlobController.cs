using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Models;
using Backend.Security;
using Backend.Store;

namespace Backend.Controllers;

/// <summary>
/// Espone i file caricati dagli utenti tramite <see cref="BlobStore"/> (volume persistente <c>uploads/</c>).
/// </summary>
/// <remarks>
/// L'accesso in lettura richiede API key (ereditata da <see cref="EngineApiController"/>), ma nessuna
/// autenticazione utente. Lo storage e la sua sicurezza vivono nello store; qui resta solo il wiring HTTP
/// (resize on-demand, difesa XSS, cache).
/// </remarks>
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
    /// Restituisce il file corrispondente allo slug fornito.
    /// </summary>
    /// <param name="slug">Identificativo univoco del file, inclusa l'estensione (es. <c>abc123.jpg</c>).</param>
    /// <param name="webopt">
    /// Se <c>true</c> richiede la versione ottimizzata per il web del file. Flag generico, non
    /// legato alle immagini: oggi l'unica ottimizzazione implementata è il resize delle immagini
    /// (lato più lungo max 1920 px, WebP), mentre i tipi non ancora gestiti vengono restituiti invariati.
    /// </param>
    [HttpGet("{slug}")]
    public IActionResult Get(string slug, [FromQuery] bool webopt = false)
    {
        var info = _blobs.GetInfo(slug);
        if (info is null)
            throw new NotFoundException("blob");
        var blob = info.Value;

        Logger.LogInformation("Blob richiesto: {Slug}", slug);

        // Cache HTTP: lo slug è immutabile (ogni upload conia un nuovo GUID), quindi la risposta è
        // cacheabile a lungo. L'ETag (mtime+size+variante) è la cintura di sicurezza per cache
        // condivise e per eventuali evoluzioni: se un domani si introducesse l'overwrite dello STESSO
        // slug, andrebbe rimosso `immutable` (il browser non rivalida durante max-age). La variante
        // r/w distingue l'originale dalla versione ottimizzata, che hanno corpo diverso.
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

        // Difesa XSS stored: solo i formati immagine raster noti vengono serviti inline col loro
        // content-type. Tutto il resto — inclusi .html/.svg/.xml che un utente autenticato potrebbe
        // caricare (l'upload non filtra l'estensione) — è forzato a download (attachment) con
        // application/octet-stream, così non viene mai interpretato/eseguito sull'origin del backend.
        // nosniff resta attivo dagli header di sicurezza.
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
    /// Carica un file nel volume persistente e restituisce lo slug univoco con cui recuperarlo.
    /// </summary>
    /// <remarks>
    /// Richiede API key valida e token JWT (utente autenticato). Lo slug include l'estensione
    /// originale del file, necessaria alla GET per determinare il content-type. Il codice di dominio
    /// che riceve file in altri form usa direttamente <see cref="BlobStore.SaveAsync(IFormFile,System.Threading.CancellationToken)"/>.
    /// </remarks>
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
