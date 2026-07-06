using Microsoft.AspNetCore.Mvc;
using SkiaSharp;
using Backend.Models;

namespace Backend.Controllers;

/// <summary>
/// Base astratta per i controller che servono file binari.
/// Aggiunge a <see cref="EngineApiController"/> la sola capacita' di ottimizzare immagini per il web:
/// lo storage (salvataggio, risoluzione, metadati, cancellazione) vive in <see cref="Backend.Store.BlobStore"/>.
/// </summary>
public abstract class EngineBlobController : EngineApiController
{
    /// <inheritdoc cref="EngineBlobController"/>
    protected EngineBlobController(ILogger logger) : base(logger) { }

    /// <summary>Tetto sui megapixel totali dell'immagine da decodificare (~40 MP: copre 8K e oltre).</summary>
    private const long MaxDecodePixels = 40_000_000;

    /// <summary>
    /// Dato uno stream immagine, restituisce un <see cref="FileContentResult"/> con il lato più lungo
    /// ridimensionato a <paramref name="maxSide"/> pixel mantenendo le proporzioni originali e
    /// convertito in WebP. Se l'immagine è già entro i limiti non viene riscalata.
    /// </summary>
    /// <param name="imageStream">Stream del file immagine da elaborare.</param>
    /// <param name="maxSide">Dimensione massima in pixel del lato più lungo (default 1920).</param>
    protected static FileContentResult ResizeImageForWeb(Stream imageStream, int maxSide = 1920)
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
