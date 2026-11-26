using Nome = Backend.Generators.SharedContent.Nome;
using City = Backend.Generators.SharedContent.City;
using Parente = Backend.Generators.SharedContent.Parente;

namespace Backend.Generators.Catalog;

/// <summary>
/// «Cosa stanno facendo gli acquirenti in questo momento»: le notifiche di acquisti recenti della landing
/// EteroInAffitto (parodia di dark pattern). Stessa grammatica e stesse liste condivise dei generatori
/// (nomi, città, parenti), ma nascosto: <see cref="IHiddenGenerator"/> lo esclude da <c>GET /generators</c>,
/// lo usa solo <see cref="Services.AcquirentiFeed"/>, che lo compila e lo fa girare per la pagina.
/// </summary>
/// <remarks>
/// Il nome del piano non è nel generatore: <see cref="Piano"/> arriva da fuori come seed a ogni frase
/// (<see cref="Services.AcquirentiFeed"/>, coi piani a pagamento letti dal JSON della landing), così il nome di un
/// piano resta scritto in un posto solo e aggiungerne uno nel JSON basta.
/// </remarks>
public sealed class AcquirentiGenerator : GeneratorBase, IHiddenGenerator
{
    /// <summary>
    /// Il piano di cui si parla: lo decide chi genera, passandolo come seed (nome di un piano a pagamento della pagina).
    /// Si usa sempre come <c>{Piano.Fissato}</c>: i seed valgono solo per gli slot fissati. La voce qui sotto è solo il
    /// ripiego per la validazione al boot, mai pescata davvero.
    /// </summary>
    internal static readonly Tag Piano = new("acquirenti-piano") { "Piano" };

    /// <summary>Cosa fa il singolo acquirente.</summary>
    internal static readonly Tag Azione = new("acquirenti-azione")
    {
        new($"ha appena abbonato il {Piano.Fissato}", 3),
        new($"ha scelto il {Piano.Fissato}", 2),
        new($"ha rinnovato il {Piano.Fissato} (di nuovo)", 2),
        new($"sta guardando il {Piano.Fissato} proprio adesso", 2),
        new($"ha prenotato il {Piano.Fissato} per il pranzo di Natale"),
        new($"ha attivato il {Piano.Fissato} per la domenica dai suoceri"),
        new($"sta confrontando il {Piano.Fissato} con quello gratuito, senza convincersi"),
        new($"ha lasciato cinque stelle al {Piano.Fissato}"),
        new($"ha chiesto il rimborso del {Piano.Fissato}, poi ci ha ripensato"),
        "ha appena smesso di rispondere alle domande dei parenti",
    };

    /// <summary>Cosa fa il parente di un acquirente (nessun piano: è l'effetto).</summary>
    internal static readonly Tag EffettoParente = new("acquirenti-effetto-parente")
    {
        "ha appena smesso di fare domande",
        "non chiede più se c'è qualcuna",
        "ha chiesto di conoscere il partner",
        "ha mandato un messaggio di approvazione",
        "ha detto «finalmente» e ha cambiato argomento",
        "ha tirato fuori il vino buono",
        "per la prima volta in vent'anni non ha commentato",
    };

    /// <summary>Cosa fa una famiglia intera.</summary>
    internal static readonly Tag EffettoFamiglia = new("acquirenti-effetto-famiglia")
    {
        "ha appena smesso di fare domande",
        "ha riaperto la discussione sui fidanzati",
        new($"ha scoperto il {Piano.Fissato} e non ne parla d'altro"),
        "ha prenotato il tavolo per sei, più uno",
    };

    public override string Slug => "acquirenti";

    // Niente Description: è per catalogo/SEO, ma il generatore è nascosto. Name identifica il generatore nei log di boot.
    public override GeneratorInfo Info { get; } = new() { Name = "Acquirenti in questo momento" };

    // Una frase sola per volta: ogni notifica è una riga breve.
    public override GenerationSettings? PhraseSettings { get; } = new()
    {
        MinPhrases = 1,
        MaxPhrases = 1,
        Separators = [". "],
    };

    public override List<Frase> Core { get; } =
    [
        new($"{Nome.Any} da {City.Any} {Azione}", 5),
        new($"{Nome.Any} da {City.Any}: suo {Parente.Anziano.M} {EffettoParente}", 3),
        new($"{Nome.Any} da {City.Any}: sua {Parente.Anziano.F} {EffettoParente}", 3),
        new($"Una famiglia di {City.Any} {EffettoFamiglia}", 2),
        new($"Oggi {3..40} persone di {City.Any} hanno scelto il {Piano.Fissato}", 2),
    ];
}
