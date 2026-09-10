using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace Backend.Engine;

/// <summary>
/// Cache in-memory a dimensione limitata per payload binari derivati (es. immagini ridimensionate/riconvertite al volo).
/// </summary>
public sealed class BoundedByteCache : IDisposable
{
    private readonly MemoryCache _cache;
    private readonly ConcurrentDictionary<string, Lazy<Task<byte[]>>> _inProgress = new();

    /// <param name="maxMbEnvVar">Nome della variabile d'ambiente che imposta il tetto in MB.</param>
    /// <param name="defaultMb">Tetto di default se la variabile non è impostata o non è un numero valido.</param>
    public BoundedByteCache(string maxMbEnvVar, int defaultMb = 500)
    {
        var raw = Environment.GetEnvironmentVariable(maxMbEnvVar);
        var maxMb = int.TryParse(raw, out var parsed) && parsed > 0 ? parsed : defaultMb;
        _cache = new MemoryCache(new MemoryCacheOptions { SizeLimit = (long)maxMb * 1024 * 1024 });
    }

    /// <summary>Recupera un payload dalla cache, se presente.</summary>
    public bool TryGet(string key, out byte[] value)
    {
        if (_cache.TryGetValue(key, out byte[]? cached) && cached is not null)
        {
            value = cached;
            return true;
        }
        value = [];
        return false;
    }

    /// <summary>Inserisce un payload in cache, dichiarandone la dimensione in byte.</summary>
    public void Set(string key, byte[] value)
    {
        using var entry = _cache.CreateEntry(key);
        entry.Size = value.LongLength;
        entry.Value = value;
    }

    /// <summary>
    /// Recupera dalla cache se presente; altrimenti esegue <paramref name="factory"/> una sola
    /// volta per chiave anche con richieste concorrenti (coalescing): chi arriva mentre la prima
    /// è ancora in corso attende lo stesso <see cref="Task"/> invece di rifare da capo il lavoro
    /// (es. decode/resize di un'immagine appena finita nella cache).
    /// </summary>
    public async Task<byte[]> GetOrCreateAsync(string key, Func<Task<byte[]>> factory)
    {
        if (TryGet(key, out var cached))
            return cached;

        // Lazy<> come valore della dictionary, non il Task nudo: GetOrAdd non garantisce da solo
        // che il SUO valueFactory esegua una sola volta sotto contesa (documentato in .NET), quindi
        // con un Task nudo due richieste concorrenti sullo stesso slug potrebbero avviare due resize
        // in parallelo. Costruire il wrapper Lazy è innocuo (non esegue nulla): quale delle
        // costruzioni in corsa "vince" ed entra nella dictionary è invece garantito univoco da
        // GetOrAdd, e tutti i chiamanti che leggono .Value sullo stesso Lazy — anche in parallelo —
        // ne eseguono il factory (il resize vero) una sola volta.
        var lazy = _inProgress.GetOrAdd(key, _ => new Lazy<Task<byte[]>>(() => RunAndCacheAsync(key, factory)));
        try
        {
            return await lazy.Value;
        }
        finally
        {
            _inProgress.TryRemove(key, out _);
        }
    }

    private async Task<byte[]> RunAndCacheAsync(string key, Func<Task<byte[]>> factory)
    {
        var value = await factory();
        Set(key, value);
        return value;
    }

    /// <inheritdoc />
    public void Dispose() => _cache.Dispose();
}
