using Microsoft.Extensions.DependencyInjection;

namespace Backend.Gallery;

/// <summary>
/// Factory di registrazione della galleria in DI, nello stile delle altre <c>Add*()</c> del progetto:
/// firmatario HMAC + store file-based. Da chiamare nel blocco <c>── SERVIZI APPLICATIVI ──</c>.
/// </summary>
public static class GalleryRegistration
{
    /// <summary>Registra <see cref="GallerySigner"/> e <see cref="IGalleryStore"/> (file-based).</summary>
    /// <param name="services">La collection dei servizi su cui registrare.</param>
    /// <returns>La stessa <paramref name="services"/>, per il chaining.</returns>
    public static IServiceCollection AddGallery(this IServiceCollection services)
    {
        services.AddSingleton<GallerySigner>();
        services.AddSingleton<IGalleryStore, FileGalleryStore>();
        return services;
    }
}
