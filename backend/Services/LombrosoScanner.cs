using Backend.Generators;
using Backend.Generators.Catalog;
using Backend.Generators.Grammar;

namespace Backend.Services;

/// <summary>
/// "Lombroso Scanner" — parodia della fisiognomica criminale ottocentesca (Cesare Lombroso):
/// inquadrati, scatta, finta analisi antropometrica, verdetto assurdo. È il gemello C# di
/// <c>lombroso.component.ts</c>: i contenuti vivono in <see cref="LombrosoGenerator"/> (stessa
/// grammatica combinatoria dei generatori — Tag, Frase, liste condivise), questo servizio li
/// orchestra a modo suo, fuori da <see cref="GeneratorService"/>.
/// </summary>
/// <remarks>
/// Perché un servizio a parte invece di passare da <c>GeneratorService</c>/<c>GET /generators/{slug}/generate</c>:
/// <list type="bullet">
///   <item><b>Non deve comparire nel catalogo</b> — <see cref="LombrosoGenerator"/> implementa
///         <see cref="IHiddenGenerator"/> apposta, quindi <c>GeneratorRegistration.AddGenerators()</c>
///         lo ignora: non è mai in DI come <see cref="IGenerator"/>, non è mai nei <c>_runtimes</c> di
///         <c>GeneratorService</c>. Va compilato e generato a mano, qui.</item>
///   <item><b>L'archetipo si sceglie dall'hash, non a caso</b> — <c>GeneratorService.ResolveVariantSeed</c>
///         pesca la <see cref="GeneratorVariant"/> con <c>Random.Shared</c> (o da un <c>inputs[key]</c>
///         testuale arbitrario); qui invece l'opzione è scelta a modulo dall'hash del client, così
///         "stesso frame → stesso archetipo" resta garantito (il "corredo probatorio" del Core, quello
///         sì, varia a ogni generazione col normale RNG del motore).</item>
/// </list>
/// La foto non lascia mai il browser: il client scatta su un canvas in memoria, ne calcola un hash
/// dei pixel (stesso frame → stesso hash, non è vero random) e manda SOLO quel numero — il "colore",
/// non l'immagine. Qui l'hash sceglie solo l'archetipo; il resto del testo lo compone il motore.
/// </remarks>
public sealed class LombrosoScanner
{
    /// <summary>Titolo (fisso per archetipo) e testo generato (indizio originale + corredo combinatorio).</summary>
    public readonly record struct Verdict(string Title, string Desc);

    private readonly LombrosoGenerator _generator = new();
    private readonly Runtime _runtime;

    public LombrosoScanner()
    {
        // resolve/risolviInnesto: mai invocati — LombrosoGenerator non usa ComposeWith né Genera(...).
        _runtime = RuntimeBuilder.Build(
            _generator,
            slug => throw new InvalidOperationException($"LombrosoGenerator non usa ComposeWith (slug richiesto: {slug})"),
            slug => throw new InvalidOperationException($"LombrosoGenerator non usa Genera(...) (slug richiesto: {slug})"));
    }

    /// <summary>
    /// Sceglie l'archetipo per l'hash ricevuto dal client (modulo sicuro: <paramref name="hash"/> può
    /// arrivare negativo se il client somma con overflow di un <c>number</c> JS molto grande), poi genera
    /// il corredo probatorio combinandolo con le liste condivise (stesso motore degli altri generatori,
    /// <c>Random.Shared</c>: varia a ogni scatto anche con lo stesso archetipo).
    /// </summary>
    public Verdict VerdictFor(long hash)
    {
        var options = _generator.Variant!.Options;
        var index = (int)(((hash % options.Count) + options.Count) % options.Count);
        var option = options[index];

        var seed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        // Stessi seed dinamici condivisi di ogni generatore (es. la data di oggi), + quelli
        // dell'archetipo scelto (titolo/indizio: pool di un solo elemento, sempre quello).
        foreach (var (key, produttore) in SharedContent.Dinamici.Seed)
            seed[key] = produttore();
        foreach (var (key, pool) in option.Seeds)
            if (pool.Count > 0) seed[key] = pool[0];

        var (text, _) = Composer.Generate(_runtime, Random.Shared, seed, option.Key);
        return new Verdict(option.Label, GeneratorService.ArmonizzaTesto(text));
    }
}
