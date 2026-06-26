using Backend.Generators;
using Backend.Generators.Grammar;
using Backend.Models;
using System.Text.RegularExpressions;

namespace Backend.Services;

/// <summary>
/// Servizio principale per la generazione dinamica di testo: catalogo, info e generazione.
/// </summary>
/// <remarks>
/// I generatori sono istanze di classi (<see cref="IGenerator"/> in <c>Backend.Generators.Catalog</c>),
/// iniettate dal container DI. Al boot ognuno viene <b>compilato</b> in un <see cref="Runtime"/>
/// (<see cref="RuntimeBuilder"/>): le frasi-template diventano un AST tipato e i riferimenti tra liste
/// sono validati come grafo aciclico — quindi un tag sconosciuto o un ciclo fanno fallire l'avvio,
/// non l'output. La generazione (<see cref="Composer"/>) valuta l'AST: niente più regex a runtime.
/// Le composizioni (es. l'Incel che estende il Maschio Basico) sono dato esplicito via
/// <see cref="IGenerator.ComposeWith"/>. La superficie pubblica resta indicizzata per slug
/// (<see cref="Get"/>, <see cref="Generate(string)"/>) e l'armonizzazione del testo resta qui.
/// </remarks>
public class GeneratorService
{
    private readonly IReadOnlyList<IGenerator> _catalog;
    private readonly Dictionary<string, IGenerator> _bySlug;
    private readonly Dictionary<string, Runtime> _runtimes;

    /// <summary>
    /// Riceve i generatori dal container DI (auto-registrati dall'assembly in <c>Program.cs</c>) e ne
    /// costruisce gli indici (catalogo ordinato, lookup per slug). Inoltre <b>compila e valida</b> ogni
    /// generatore in un <see cref="Runtime"/>: un tag sconosciuto o un ciclo tra liste sollevano
    /// <see cref="GeneratorConfigException"/> qui, al boot — fail-fast invece che testo rotto a runtime.
    /// </summary>
    /// <param name="generators">Tutte le istanze di <see cref="IGenerator"/> registrate in DI.</param>
    public GeneratorService(IEnumerable<IGenerator> generators)
    {
        var all = generators.ToList();
        _bySlug = all.ToDictionary(generator => generator.Slug, StringComparer.OrdinalIgnoreCase);
        _catalog = all.OrderBy(generator => generator.Info?.Order ?? 999).ToList();
        _runtimes = all.ToDictionary(generator => generator.Slug,
                                     generator => RuntimeBuilder.Build(generator, Get),
                                     StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Ottiene il catalogo di tutti i generatori disponibili, già ordinato per <c>Info.Order</c>.
    /// </summary>
    /// <returns>Lista dei generatori configurati.</returns>
    public IReadOnlyList<IGenerator> GetCatalog() => _catalog;

    /// <summary>Recupera un generatore per slug.</summary>
    /// <param name="slug">Slug del generatore richiesto (es. <c>incel</c>, <c>mbeb</c>).</param>
    /// <returns>Il generatore corrispondente.</returns>
    /// <exception cref="NotFoundException">Se nessun generatore ha quello slug.</exception>
    public IGenerator Get(string slug) =>
        _bySlug.TryGetValue(slug, out var generator) ? generator : throw new NotFoundException(slug);

    /// <summary>
    /// Genera un nuovo testo per il generatore con lo slug indicato, valutando il suo
    /// <see cref="Runtime"/> compilato e applicando l'armonizzazione finale del testo.
    /// </summary>
    /// <param name="slug">Slug del generatore richiesto.</param>
    /// <returns>Il risultato della generazione in triplice formato (Text, Markdown, Score).</returns>
    /// <exception cref="NotFoundException">Se nessun generatore ha quello slug.</exception>
    public GenerationResult Generate(string slug)
    {
        var runtime = _runtimes[Get(slug).Slug];
        var (rawText, score) = Composer.Generate(runtime, Random.Shared);
        var markdown = ArmonizzaTesto(rawText);
        return new GenerationResult(MarkdownToPlain(markdown), markdown, score);
    }

    /// <summary>
    /// Pulisce il Markdown per ricavarne testo normale (per speech e condivisione immagine).
    /// La resa HTML non si fa qui: il frontend renderizza il Markdown col pipe <c>markdown</c>
    /// dell'engine, che sanifica l'output. È pubblico perché i condivisi, che persistono solo il
    /// Markdown firmato, ricostruiscono server-side il testo plain alla condivisione (senza fidarsi del client).
    /// </summary>
    /// <param name="md">Testo in Markdown.</param>
    /// <returns>Il testo senza formattazione, già rifilato.</returns>
    public static string MarkdownToPlain(string md)
    {
        var res = md;
        res = Regex.Replace(res, @"\[([^\]]+)\]\([^\)]+\)", "$1"); // Rimuove link tenendo il testo
        res = Regex.Replace(res, @"#+\s+", "");                    // Rimuove i cancelletti dei titoli
        res = Regex.Replace(res, @"(\*\*|__|\*|_|`)", "");         // Rimuove formattazione e backtick
        return res.Trim();
    }

    // ══════════════════════════════════════════════════════════════════
    // ARMONIZZAZIONE DEL TESTO (passata finale, indipendente dalla grammatica)
    // ══════════════════════════════════════════════════════════════════

    private static string ArmonizzaTesto(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;

        // Prima lettera assoluta in maiuscolo
        text = Regex.Replace(text, @"^([^\p{L}]*)(\p{Ll})",
            m => m.Groups[1].Value + m.Groups[2].Value.ToUpper());

        // Armonizza la punteggiatura multipla tenendo i segni semanticamente più forti
        text = Regex.Replace(text, @"([.,:;!?](?:\s*[.,:;!?])+)", m =>
        {
            var cluster = new string(m.Value.Where(c => !char.IsWhiteSpace(c)).ToArray());
            if (cluster.Contains('!') || cluster.Contains('?'))
                return new string(cluster.Where(c => c == '!' || c == '?').ToArray());
            if (cluster.Contains('.'))
            {
                var dotsCount = cluster.Count(c => c == '.');
                return dotsCount > 1 ? "..." : ".";
            }
            if (cluster.Contains(';')) return ";";
            if (cluster.Contains(':')) return ":";
            return ",";
        });

        // Riduce spazi multipli (ma non i newline)
        text = Regex.Replace(text, @"[ \t]+", " ");

        // Rimuove spazi all'inizio e alla fine di ogni riga
        text = Regex.Replace(text, @"^[ \t]+|[ \t]+$", string.Empty, RegexOptions.Multiline);

        // Collassa 3 o più newline in massimo due (mantiene il concetto di paragrafo)
        text = Regex.Replace(text, @"(\r?\n){3,}", "\n\n");

        // Maiuscola dopo la punteggiatura (. ! ? ;) e a inizio riga
        text = Regex.Replace(text, @"(^|[.!?;]\s+|^[ \t]*)(\p{Ll})",
            m => m.Groups[1].Value + m.Groups[2].Value.ToUpper(),
            RegexOptions.Multiline);

        // Contrazioni/elisioni articolo-preposizione (vedi ContraiPreposizioni): ultimo passo,
        // dopo le maiuscole, così intercetta anche la preposizione a inizio frase.
        text = ContraiPreposizioni(text);

        return text.Trim();
    }

    // ── Normalizzazione articoli/preposizioni ─────────────────────────────
    // I segnaposto possono espandersi in elementi che iniziano con un articolo
    // (es. [hating] = "le auto elettriche") finendo subito dopo una preposizione nel template
    // ("ridire su [hating]" → "su le auto"). Qui si sistemano le contrazioni/elisioni mancanti
    // ("su le" → "sulle", "di i" → "dei", "il"+vocale → "l'", "i"+vocale → "gli"). L'articolo è
    // confrontato SOLO in minuscolo: i nomi propri che hanno l'articolo nel nome (L'Aquila, La
    // Spezia) sono maiuscoli e restano intatti. L'elisione "lo/la"+vocale → "l'" è sempre corretta
    // in italiano (vale sia per l'articolo sia per il pronome), quindi viene applicata.
    private static readonly Dictionary<string, string> PrepArtMap = new(StringComparer.Ordinal)
    {
        ["di il"] = "del", ["di lo"] = "dello", ["di la"] = "della", ["di i"] = "dei", ["di gli"] = "degli", ["di le"] = "delle",
        ["a il"] = "al", ["a lo"] = "allo", ["a la"] = "alla", ["a i"] = "ai", ["a gli"] = "agli", ["a le"] = "alle",
        ["da il"] = "dal", ["da lo"] = "dallo", ["da la"] = "dalla", ["da i"] = "dai", ["da gli"] = "dagli", ["da le"] = "dalle",
        ["in il"] = "nel", ["in lo"] = "nello", ["in la"] = "nella", ["in i"] = "nei", ["in gli"] = "negli", ["in le"] = "nelle",
        ["su il"] = "sul", ["su lo"] = "sullo", ["su la"] = "sulla", ["su i"] = "sui", ["su gli"] = "sugli", ["su le"] = "sulle",
    };
    private static readonly Dictionary<string, string> PrepLMap = new(StringComparer.Ordinal)
    {
        ["di"] = "dell'", ["a"] = "all'", ["da"] = "dall'", ["in"] = "nell'", ["su"] = "sull'",
    };
    // Innesco dell'elisione: vocali + "h" muta (così "lo hanno" → "l'hanno", "i hotel" → "gli hotel").
    private const string Vocali = "aeiouàèéìòùAEIOUÀÈÉÌÒÙhH";
    private static readonly Regex RxIlVocale = new(@"(?<![\p{L}'’])(Il|il)[ \t]+(?=[" + Vocali + "])", RegexOptions.Compiled);
    // "lo"/"la" + vocale → "l'": in italiano si elide sempre, sia come articolo ("la ex-moglie" →
    // "l'ex-moglie") sia come pronome ("non lo invitano" → "non l'invitano"), quindi è sempre corretto.
    private static readonly Regex RxLoLaVocale = new(@"(?<![\p{L}'’])(Lo|lo|La|la)[ \t]+(?=[" + Vocali + "])", RegexOptions.Compiled);
    private static readonly Regex RxIVocale = new(@"(?<![\p{L}'’])(I|i)[ \t]+(?=[" + Vocali + "])", RegexOptions.Compiled);
    private static readonly Regex RxPrepL = new(@"(?<![\p{L}'’])(Di|di|A|a|Da|da|In|in|Su|su)[ \t]+l['’](?=\p{L})", RegexOptions.Compiled);
    private static readonly Regex RxPrepArt = new(@"(?<![\p{L}'’])(Di|di|A|a|Da|da|In|in|Su|su)[ \t]+(il|lo|la|gli|le|i)(?![\p{L}'’])", RegexOptions.Compiled);
    // Articolo davanti a z, x, y, gn, pn, ps e s+consonante: "un" → "uno", "il" → "lo", "i" → "gli"
    // (es. "un scemo" → "uno scemo", "il stronzo" → "lo stronzo", "i psicologi" → "gli psicologi").
    private const string ClusterCons = "z|x|y|gn|pn|ps|s[bcdfglmnpqrtv]";
    private static readonly Regex RxUnUno = new(@"(?<![\p{L}'’])(Un|un)([ \t]+)(?=(?i:" + ClusterCons + "))", RegexOptions.Compiled);
    private static readonly Regex RxIlLo = new(@"(?<![\p{L}'’])(Il|il)([ \t]+)(?=(?i:" + ClusterCons + "))", RegexOptions.Compiled);
    private static readonly Regex RxIGli = new(@"(?<![\p{L}'’])(I|i)([ \t]+)(?=(?i:" + ClusterCons + "))", RegexOptions.Compiled);
    // Preposizione articolata GIÀ contratta nei testi (es. "al [parolaccia]") seguita da parola che
    // inizia per vocale (o h muta): va elisa. "al/allo/alla incapace" → "all'incapace",
    // "della anima" → "dell'anima". Le forme plurali (ai/dei/...) restano invariate.
    private static readonly Dictionary<string, string> ContractedElideMap = new(StringComparer.Ordinal)
    {
        ["al"] = "all'", ["allo"] = "all'", ["alla"] = "all'",
        ["del"] = "dell'", ["dello"] = "dell'", ["della"] = "dell'",
        ["nel"] = "nell'", ["nello"] = "nell'", ["nella"] = "nell'",
        ["sul"] = "sull'", ["sullo"] = "sull'", ["sulla"] = "sull'",
        ["dal"] = "dall'", ["dallo"] = "dall'", ["dalla"] = "dall'",
    };
    private static readonly Regex RxContractedElide = new(@"(?<![\p{L}'’])(al|allo|alla|del|dello|della|nel|nello|nella|sul|sullo|sulla|dal|dallo|dalla)[ \t]+(?=[aeiouàèéìòùhAEIOUÀÈÉÌÒÙH])", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    // Articolo indeterminativo femminile "una" + vocale → "un'" (elisione obbligatoria: "una incapace" → "un'incapace").
    // Il maschile "un" davanti a vocale NON si elide ("un amico"), quindi non è toccato.
    private static readonly Regex RxUnaElide = new(@"(?<![\p{L}'’])(Una|una)[ \t]+(?=[aeiouàèéìòùhAEIOUÀÈÉÌÒÙH])", RegexOptions.Compiled);

    private static string Cap(string s, bool upper) => upper ? char.ToUpperInvariant(s[0]) + s[1..] : s;

    private static string ContraiPreposizioni(string text)
    {
        // Articolo davanti ai gruppi consonantici che lo richiedono: un→uno, il→lo, i→gli.
        text = RxUnUno.Replace(text, m => m.Groups[1].Value + "o" + m.Groups[2].Value);
        text = RxIlLo.Replace(text, m => Cap("lo", char.IsUpper(m.Groups[1].Value[0])) + m.Groups[2].Value);
        text = RxIGli.Replace(text, m => Cap("gli", char.IsUpper(m.Groups[1].Value[0])) + m.Groups[2].Value);
        // Prima le elisioni davanti a vocale (così "di i uomini" → "di gli uomini" → "degli uomini").
        text = RxIlVocale.Replace(text, m => Cap("l'", char.IsUpper(m.Groups[1].Value[0])));
        text = RxLoLaVocale.Replace(text, m => Cap("l'", char.IsUpper(m.Groups[1].Value[0])));
        text = RxIVocale.Replace(text, m => Cap("gli ", char.IsUpper(m.Groups[1].Value[0])));
        text = RxPrepL.Replace(text, m => Cap(PrepLMap[m.Groups[1].Value.ToLowerInvariant()], char.IsUpper(m.Groups[1].Value[0])));
        text = RxPrepArt.Replace(text, m => Cap(PrepArtMap[m.Groups[1].Value.ToLowerInvariant() + " " + m.Groups[2].Value], char.IsUpper(m.Groups[1].Value[0])));
        // Preposizioni articolate già contratte + vocale → elisione (es. "al incapace" → "all'incapace").
        text = RxContractedElide.Replace(text, m => Cap(ContractedElideMap[m.Groups[1].Value.ToLowerInvariant()], char.IsUpper(m.Groups[1].Value[0])));
        // Articolo femminile "una" + vocale → "un'".
        text = RxUnaElide.Replace(text, m => Cap("un'", char.IsUpper(m.Groups[1].Value[0])));
        return text;
    }
}
