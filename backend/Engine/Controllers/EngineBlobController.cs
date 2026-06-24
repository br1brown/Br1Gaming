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

    /// <summary>
    /// Dato uno stream immagine, restituisce un <see cref="FileContentResult"/> con il lato più lungo
    /// ridimensionato a <paramref name="maxSide"/> pixel mantenendo le proporzioni originali e
    /// convertito in WebP. Se l'immagine è già entro i limiti non viene riscalata.
    /// </summary>
    /// <param name="imageStream">Stream del file immagine da elaborare.</param>
    /// <param name="maxSide">Dimensione massima in pixel del lato più lungo (default 1920).</param>
    protected static FileContentResult ResizeImageForWeb(Stream imageStream, int maxSide = 1920)
    {
        using var original = SKBitmap.Decode(imageStream);
        // Decode restituisce null se i byte non sono un'immagine decodificabile (estensione
        // valida ma contenuto corrotto/falso): senza questo check si avrebbe una NRE → 500
        // generico invece di un 400 strutturato.
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
        using var skImage = SKImage.FromBitmap(resized);
        using var data = skImage.Encode(SKEncodedImageFormat.Webp, quality: 85);
        return new FileContentResult(data.ToArray(), "image/webp");
    }
}
