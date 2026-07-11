using System.Text.Json;
using Backend.Models;
using Microsoft.Extensions.Caching.Memory;
using Backend.Engine;

namespace Backend.Store;

/// <summary>
/// Implementa <see cref="IContentStore"/> leggendo i contenuti da file JSON in <c>data/</c>, con
/// cache: centralizza la lettura fisica, i servizi restano indipendenti dal formato di persistenza.
/// </summary>
public class FileContentStore : IContentStore
{
    private readonly string _dataPath;
    private readonly IMemoryCache _cache;

    /// <summary>Inizializza lo store file-based sulla cartella <c>data/</c> della content root (con cache condivisa).</summary>
    public FileContentStore(IWebHostEnvironment env, IMemoryCache cache)
    {
        _cache = cache;
        _dataPath = Path.Combine(env.ContentRootPath, "data");
    }

    /// <summary>Recupera i social da <c>social.json</c>: mappa nome→URL, pronta per filtro/esposizione.</summary>
    public async Task<Dictionary<string, string>> GetSocialAsync(CancellationToken cancellationToken = default)
    {
        var json = await FileUtils.ReadStaticFileAsync("social", _dataPath, _cache, cancellationToken: cancellationToken);
        return JsonSerializer.Deserialize<Dictionary<string, string>>(json, EngineJson.Web)
            ?? throw new DecodingException();
    }

}
