using System.Security.Cryptography;
using System.Text.Json;

namespace Backend.Engine;

/// <summary>Crea <c>global-settings.local.json</c> quando manca nella copia di sviluppo del repository: la stessa forma
/// che scrive <c>setup.mjs</c>, con API key e <c>SecretKey</c> del login generate, così <c>dotnet run</c> parte anche col
/// login demo acceso senza un passo a mano. Solo in Development e solo accanto a un <c>global-settings.json</c> nella root
/// del repository: in Docker il <c>.local</c> non esiste per scelta e non va creato. Lo stesso automatismo lo ha il
/// frontend (<c>generate:statics</c>): chi parte per primo lo crea, l'altro lo trova. Il file non entra mai in git.</summary>
public static class LocalSettingsFile
{
    /// <summary>Scrive il file se manca e restituisce il percorso creato, altrimenti <c>null</c>.</summary>
    public static string? EnsureForDevelopment(IWebHostEnvironment env)
    {
        if (!env.IsDevelopment()) return null;
        var root = Path.GetFullPath(Path.Combine(env.ContentRootPath, ".."));
        if (!File.Exists(Path.Combine(root, "global-settings.json"))) return null;
        var path = Path.Combine(root, "global-settings.local.json");
        if (File.Exists(path)) return null;

        var content = new
        {
            schema = "./global-settings.schema.json",
            frontend = new { hostname = "", port = 3000 },
            backend = new { @public = false, publicPort = (int?)null },
            Security = new
            {
                ApiConfig = new { Keys = new[] { Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)) } },
                CorsOrigins = Array.Empty<string>(),
                BehindProxy = false,
                Token = new { SecretKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)) },
            },
        };
        var json = JsonSerializer.Serialize(content, new JsonSerializerOptions { WriteIndented = true })
            .Replace("\"schema\":", "\"$schema\":", StringComparison.Ordinal);
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        using var writer = new StreamWriter(stream);
        writer.Write(json + Environment.NewLine);
        return path;
    }
}
