using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Backend.Engine;
using Backend.Models;

namespace Backend.Shares;

/// <summary>
/// Implementazione file-based di <see cref="IShareStore"/>: indice in memoria
/// (<see cref="ConcurrentDictionary{TKey,TValue}"/>) con write-through su <c>db/shares.json</c>
/// nel volume persistente <c>db/</c>. Fedele all'ethos "Database Fantasma" del template (niente
/// motore SQL per un MVP). Pensato per singola istanza, come il default del template.
/// </summary>
public sealed class FileShareStore : IShareStore
{
    // Tetto morbido: oltre questa soglia si sfrattano le voci più vecchie (anti-crescita illimitata).
    private const int MaxEntries = 10000;
    // Quante volte ritentare la scrittura su disco se il file è momentaneamente lockato (lettore,
    // backup, antivirus o — se mai multi-istanza — un'altra istanza che sta scrivendo).
    private const int PersistMaxAttempts = 4;

    private readonly string _file;
    // Nome storico del file (quando la feature si chiamava "galleria"): se il nuovo file non c'è
    // ancora ma il vecchio sì, lo si legge una volta sola e il prossimo Persist scrive su shares.json.
    private readonly string _legacyFile;
    private readonly object _lock = new();
    private readonly ConcurrentDictionary<string, ShareEntry> _entries = new();
    private readonly ILogger<FileShareStore> _logger;

    /// <summary>Inizializza lo store leggendo l'eventuale <c>db/shares.json</c> esistente.</summary>
    /// <param name="env">Ambiente host, per ricavare il percorso del volume <c>db/</c>.</param>
    /// <param name="logger">Logger per segnalare i ritenti/fallimenti di scrittura.</param>
    public FileShareStore(IWebHostEnvironment env, ILogger<FileShareStore> logger)
    {
        _logger = logger;
        var dir = Path.Combine(env.ContentRootPath, "db");
        Directory.CreateDirectory(dir);
        _file = Path.Combine(dir, "shares.json");
        _legacyFile = Path.Combine(dir, "gallery.json");
        Load();
    }

    /// <inheritdoc />
    public ShareEntry Save(string slug, string text, string markdown, double score)
    {
        var id = HashId(markdown);
        if (_entries.TryGetValue(id, out var existing)) return existing; // dedup: già presente

        var entry = new ShareEntry(id, slug, text, markdown, score, DateTimeOffset.UtcNow);
        if (!_entries.TryAdd(id, entry)) return _entries[id]; // race: vince chi ha aggiunto per primo

        lock (_lock)
        {
            EvictOverflow();
            Persist();
        }
        return entry;
    }

    /// <inheritdoc />
    public ShareEntry? Get(string id) => _entries.TryGetValue(id, out var e) ? e : null;

    /// <inheritdoc />
    public IReadOnlyList<ShareEntry> GetRecent(int limit, string? slug = null) =>
        _entries.Values
            .Where(e => slug is null || string.Equals(e.Slug, slug, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(e => e.CreatedUtc)
            .Take(limit)
            .ToList();

    /// <inheritdoc />
    public IReadOnlyDictionary<string, int> Counts() =>
        _entries.Values
            .GroupBy(e => e.Slug)
            .ToDictionary(g => g.Key, g => g.Count());

    // Id content-addressed: stesso testo → stesso id → niente doppioni (è il dedup richiesto).
    private static string HashId(string markdown)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(markdown.Trim()));
        return Convert.ToHexString(hash)[..12].ToLowerInvariant();
    }

    private void EvictOverflow()
    {
        if (_entries.Count <= MaxEntries) return;
        foreach (var old in _entries.Values.OrderBy(e => e.CreatedUtc).Take(_entries.Count - MaxEntries))
            _entries.TryRemove(old.Id, out _);
    }

    private void Persist()
    {
        // Scrittura atomica: file temporaneo (nome univoco, così due scritture non si pestano il
        // tmp) + move; un crash a metà non corrompe il json. Dentro Save il lock già serializza le
        // scritture nello stesso processo: il retry copre i lock transitori del file (lettore in
        // corso, backup/antivirus o un'altra istanza che scrive sullo stesso volume).
        var json = JsonSerializer.Serialize(_entries.Values.OrderBy(e => e.CreatedUtc), EngineJson.Web);
        var tmp = $"{_file}.{Guid.NewGuid():N}.tmp";

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                File.WriteAllText(tmp, json);
                File.Move(tmp, _file, overwrite: true);
                return;
            }
            catch (IOException ex) when (attempt < PersistMaxAttempts)
            {
                // Backoff esponenziale breve (25/50/100 ms): il lock è quasi sempre transitorio.
                _logger.LogWarning(ex, "Condivisi: scrittura di {File} fallita (tentativo {Attempt}/{Max}), ritento.",
                    _file, attempt, PersistMaxAttempts);
                Thread.Sleep(25 * (1 << (attempt - 1)));
            }
            catch (Exception ex)
            {
                // Tentativi esauriti o errore non transitorio: la voce è già in memoria (quindi
                // visibile subito) e verrà ri-scritta al prossimo salvataggio riuscito, perché
                // Persist serializza l'intero indice. Non facciamo fallire la richiesta dell'utente.
                _logger.LogError(ex, "Condivisi: impossibile persistere {File}; la voce resta solo in memoria.", _file);
                TryDelete(tmp);
                return;
            }
        }
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch { /* best effort: un tmp orfano non corrompe nulla */ }
    }

    private void Load()
    {
        // Nuovo file se presente; altrimenti migrazione una-tantum dal vecchio db/gallery.json
        // (il prossimo Persist riscrive su shares.json). Così i condivisi storici non si perdono.
        var source = File.Exists(_file) ? _file : (File.Exists(_legacyFile) ? _legacyFile : null);
        if (source is null) return;
        try
        {
            var list = JsonSerializer.Deserialize<List<ShareEntry>>(File.ReadAllText(source), EngineJson.Web);
            if (list is null) return;
            foreach (var e in list) _entries.TryAdd(e.Id, e);
        }
        catch { /* file corrotto/illeggibile: si riparte dai condivisi vuoti */ }
    }
}
