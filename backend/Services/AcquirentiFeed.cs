using Backend.Generators;
using Backend.Generators.Catalog;
using Backend.Generators.Grammar;

namespace Backend.Services;

/// <summary>
/// Frasi sugli acquirenti «in questo momento» per la landing, dal generatore nascosto
/// <see cref="AcquirentiGenerator"/>. Stesso schema di <see cref="LombrosoScanner"/>: il generatore si compila
/// una volta sola, poi ogni richiesta pesca frasi nuove dal motore.
/// </summary>
public sealed class AcquirentiFeed
{
    private readonly Runtime _runtime;

    /// <summary>Compila la grammatica del generatore nascosto.</summary>
    public AcquirentiFeed()
    {
        // resolve/risolviInnesto: mai invocati — AcquirentiGenerator non usa ComposeWith né Genera(...).
        _runtime = RuntimeBuilder.Build(
            new AcquirentiGenerator(),
            slug => throw new InvalidOperationException($"AcquirentiGenerator non usa ComposeWith (slug richiesto: {slug})"),
            slug => throw new InvalidOperationException($"AcquirentiGenerator non usa Genera(...) (slug richiesto: {slug})"));
    }

    /// <summary>
    /// Fino a <paramref name="count"/> frasi diverse fra loro (con un tetto di tentativi: il motore può ripetersi).
    /// <paramref name="piani"/> sono i nomi dei piani di cui parlare: a ogni frase se ne passa uno al generatore come seed.
    /// </summary>
    public IReadOnlyList<string> Generate(int count, IReadOnlyList<string> piani)
    {
        if (piani.Count == 0) throw new ArgumentException("Serve almeno un piano.", nameof(piani));
        var seed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, produttore) in SharedContent.Dinamici.Seed)
            seed[key] = produttore();

        var frasi = new List<string>(count);
        for (var tentativo = 0; tentativo < count * 8 && frasi.Count < count; tentativo++)
        {
            seed[AcquirentiGenerator.Piano.Key] = piani[Random.Shared.Next(piani.Count)];
            var (text, _) = Composer.Generate(_runtime, Random.Shared, seed);
            var frase = GeneratorService.ArmonizzaTesto(text).Trim().TrimEnd('.');
            if (frase.Length > 0 && !frasi.Contains(frase)) frasi.Add(frase);
        }
        return frasi;
    }
}
