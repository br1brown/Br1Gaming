using System.Text.Json;
using Backend.Models;
using Microsoft.Extensions.Caching.Memory;
using Backend.Engine;

namespace Backend.Store;

/// <summary>
/// Implementa <see cref="IContentStore"/> leggendo i contenuti da file JSON nella cartella <c>data/</c>.
/// </summary>
/// <remarks>
/// Centralizza la lettura fisica dei file (con cache), così i servizi restano indipendenti dal
/// formato di persistenza. L'identità del sito non passa di qui: vive nel sottosistema Engine
/// <c>IIdentityStore</c> (file <c>data/identity.json</c>).
/// </remarks>
public class FileContentStore : IContentStore
{
    private readonly string _dataPath;
    private readonly IMemoryCache _cache;

    /// <summary>
    /// Inizializza lo store file-based partendo dalla root dell'applicazione ASP.NET.
    /// </summary>
    /// <param name="env">
    /// Ambiente host usato per ricavare il percorso assoluto della cartella <c>data</c>.
    /// </param>
    /// <param name="cache">
    /// Cache in memoria condivisa usata da <see cref="FileUtils.ReadStaticFileAsync"/> per i file JSON.
    /// </param>
    public FileContentStore(IWebHostEnvironment env, IMemoryCache cache)
    {
        _cache = cache;
        _dataPath = Path.Combine(env.ContentRootPath, "data");
    }


}
