using Microsoft.Extensions.DependencyInjection;

namespace Backend.Shares;

/// <summary>
/// Factory di registrazione dei condivisi in DI, nello stile delle altre <c>Add*()</c> del progetto:
/// firmatario HMAC + store file-based. Da chiamare nel blocco <c>── SERVIZI APPLICATIVI ──</c>.
/// </summary>
public static class ShareRegistration
{
    /// <summary>Registra <see cref="ShareSigner"/> e <see cref="IShareStore"/> (file-based).</summary>
    /// <param name="services">La collection dei servizi su cui registrare.</param>
    /// <returns>La stessa <paramref name="services"/>, per il chaining.</returns>
    public static IServiceCollection AddShares(this IServiceCollection services)
    {
        services.AddSingleton<ShareSigner>();
        services.AddSingleton<IShareStore, FileShareStore>();
        return services;
    }
}
