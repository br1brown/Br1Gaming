using System.Runtime.CompilerServices;
using System.Text;
using Backend.Generators;
using Backend.Generators.Grammar;

namespace Backend.Generators;

/// <summary>
/// Il mattone unico dei contenuti: frase del Core, apertura/chiusura E voce di flatlist. Si scrive
/// in due modi:
/// <list type="bullet">
///   <item>CON segnaposto → <c>new($"testo {MioTag}, {2..5} volte", punteggio)</c>. Il compilatore
///         spezza l'interpolazione e consegna i pezzi al <see cref="FraseBuilder"/>: la frase nasce
///         già smontata nelle sue <see cref="Parti"/>, non c'è nessun parsing.</item>
///   <item>SOLO testo → <c>"testo"</c> oppure <c>("testo", punteggio)</c>, per conversione implicita.
///         Un '[' qui è un errore voluto: se serve un segnaposto, si usa la forma interpolata.</item>
/// </list>
/// Una voce di lista con dentro un segnaposto (es. "Voglia di {Cibo}") è una mini-frase a tutti gli
/// effetti: il motore la risolve ricorsivamente con lo stesso identico meccanismo.
/// </summary>
public sealed class Frase
{
    /// <summary>Punteggio base (rarità): pesa nella soglia <c>MinScore</c> della composizione.</summary>
    public double Score { get; }

    /// <summary>
    /// L'impronta testuale della frase, coi token <c>[chiave]</c> ricostruiti dalle parti. Serve SOLO
    /// da identità: dedup in selezione e match delle etichette uniche. Non viene mai ri-parsata.
    /// </summary>
    public string Raw { get; }

    /// <summary>La frase già smontata: la sequenza ordinata di testo fisso e segnaposto.</summary>
    internal IReadOnlyList<ProtoPart> Parti { get; }

    /// <summary>
    /// Forma con segnaposto. <paramref name="testo"/> arriva già riempito: davanti a
    /// <c>new($"ha {Eta.Giovane} anni", 3)</c> il compilatore genera lui le chiamate
    /// <c>AppendLiteral("ha ")</c>, <c>AppendFormatted(Eta.Giovane)</c>, <c>AppendLiteral(" anni")</c>.
    /// </summary>
    public Frase(FraseBuilder testo, double punteggio = 1)
    {
        Raw = testo.Raw;
        Parti = testo.Parti;
        Score = punteggio;
    }

    private Frase(string testo, double punteggio)
    {
        if (testo.Contains('['))
            throw new GeneratorConfigException(
                $"Voce letterale \"{testo}\": contiene '[', ma i segnaposto si scrivono TIPIZZATI — usa una frase interpolata (new($\"...\")).");
        Raw = testo;
        Parti = [new ProtoLit(testo)];
        Score = punteggio;
    }

    /// <summary>Voce di puro testo, punteggio 1: <c>"Kebab"</c>.</summary>
    public static implicit operator Frase(string testo) => new(testo, 1);

    /// <summary>Voce di puro testo con punteggio: <c>("Kebap", 3)</c>.</summary>
    public static implicit operator Frase((string Testo, double Punteggio) voce) => new(voce.Testo, voce.Punteggio);
}

/// <summary>
/// Riceve dal compilatore i pezzi dell'interpolazione di una <see cref="Frase"/>. Ogni overload di
/// <c>AppendFormatted</c> è un tipo di segnaposto ammesso — e sono i SOLI: interpolare qualunque
/// altra cosa (una stringa, un numero) non compila. È qui che un refuso muore prima del run.
/// </summary>
[InterpolatedStringHandler]
public ref struct FraseBuilder
{
    private readonly List<ProtoPart> _parti;
    private readonly StringBuilder _raw;

    /// <summary>Chiamato dal compilatore con le dimensioni già note dell'interpolazione.</summary>
    public FraseBuilder(int literalLength, int formattedCount)
    {
        _parti = new List<ProtoPart>(formattedCount * 2 + 1);
        _raw = new StringBuilder(literalLength + formattedCount * 12);
    }

    /// <summary>Il testo fisso tra un segnaposto e l'altro: esce in output com'è.</summary>
    public void AppendLiteral(string testo)
    {
        _parti.Add(new ProtoLit(testo));
        _raw.Append(testo);
    }

    /// <summary><c>{MioTag}</c> / <c>{Social.Any}</c>: pesca una voce dalla lista con quella chiave.</summary>
    public void AppendFormatted(Tag tag)
    {
        if (tag is null) throw OrdineSbagliato();
        _parti.Add(new ProtoSlot(tag.Key, SlotKind.FlatList, 0, 0));
        _raw.Append(tag.ToString());
    }

    /// <summary><c>{Eta.Giovane}</c>: un'età pescata tra Min e Max della fascia.</summary>
    public void AppendFormatted(FasciaEta fascia)
    {
        if (fascia is null) throw OrdineSbagliato();
        _parti.Add(new ProtoSlot(fascia.Tag.Key, SlotKind.Age, fascia.Min, fascia.Max));
        _raw.Append(fascia.ToString());
    }

    // L'unico modo di arrivare qui con un null: un campo dello STESSO generatore citato prima della
    // sua dichiarazione (gli initializer statici corrono in ordine testuale; i condivisi e i tag del
    // master sono in altre classi e arrivano sempre pronti).
    private static GeneratorConfigException OrdineSbagliato() => new(
        "Segnaposto nullo in una frase: un campo Tag/FasciaEta è citato PRIMA della sua dichiarazione. " +
        "Sposta più in alto nel file la dichiarazione del campo citato (le liste atomiche prima di chi le compone).");

    /// <summary><c>{2..5}</c>: un intero pescato tra 2 e 5, estremi COMPRESI (è il range literal di C#,
    /// ma qui è un'estrazione, non uno slice: niente semantica di fine-esclusa né indici <c>^</c>).</summary>
    public void AppendFormatted(Range range)
    {
        if (range.Start.IsFromEnd || range.End.IsFromEnd)
            throw new GeneratorConfigException("Range di un segnaposto: solo numeri semplici ({2..5}), niente indici '^'.");
        int min = range.Start.Value, max = range.End.Value;
        _parti.Add(new ProtoSlot($"{min}-{max}", SlotKind.Range, min, max));
        _raw.Append($"[{min}-{max}]");
    }

    /// <summary><c>{MioTag.Fissato}</c>: come <c>{MioTag}</c>, ma la prima pescata vale per tutta la
    /// composizione — le occorrenze successive, anche in altre frasi, riusano lo stesso valore.</summary>
    public void AppendFormatted(TagFissato fisso)
    {
        _parti.Add(new ProtoSlot(fisso.Tag.Key, SlotKind.FlatList, 0, 0, Bound: true));
        _raw.Append($"[${fisso.Tag.Key}]");
    }

    /// <summary><c>{Eta.Giovane.Fissata}</c>: stessa età per tutta la composizione.</summary>
    public void AppendFormatted(FasciaFissata fissa)
    {
        _parti.Add(new ProtoSlot(fissa.Fascia.Tag.Key, SlotKind.Age, fissa.Fascia.Min, fissa.Fascia.Max, Bound: true));
        _raw.Append($"[${fissa.Fascia.Tag.Key}]");
    }

    /// <summary><c>{Genera("locali")}</c>: innesta il testo GENERATO da un altro generatore.</summary>
    public void AppendFormatted(Innesto innesto)
    {
        if (innesto is null) throw OrdineSbagliato();
        _parti.Add(new ProtoSlot(innesto.Slug, SlotKind.Innesto, 0, 0));
        _raw.Append($"[innesto:{innesto.Slug}]");
    }

    /// <summary><c>{Genera("locali").Fissato}</c>: come l'innesto, ma genera UNA volta e riusa lo
    /// stesso testo in tutta la composizione (lo stesso bar per tutto il personaggio).</summary>
    public void AppendFormatted(InnestoFissato fisso)
    {
        _parti.Add(new ProtoSlot(fisso.Innesto.Slug, SlotKind.Innesto, 0, 0, Bound: true));
        _raw.Append($"[$innesto:{fisso.Innesto.Slug}]");
    }

    /// <summary><c>{SharedContent.TimeSlot.Mattina}</c> o <c>{SharedContent.TimeSlot.Notte}</c>: genera
    /// un orario "HH:mm di &lt;fascia&gt;" in italiano. La Key porta la LOCUZIONE (Lo/Hi sono le ore):
    /// il Composer la usa per il suffisso "di notte/mattina/pomeriggio/sera".</summary>
    public void AppendFormatted(SharedContent.TimeSlot slot)
    {
        if (slot is null) throw OrdineSbagliato();
        _parti.Add(new ProtoSlot(slot.Locuzione, SlotKind.Time, slot.OraMin, slot.OraMax));
        _raw.Append(slot.ToString());
    }

    /// <summary><c>{new SharedContent.DateRangeSlot(new(2026, 6, 1), new(2026, 8, 31))}</c>: genera un intervallo di date formattato in italiano.</summary>
    public void AppendFormatted(SharedContent.DateRangeSlot range)
    {
        if (range is null) throw OrdineSbagliato();
        // Codifichiamo start/end + i tre flag nella key (formato macchina → InvariantCulture); il Composer li decodifica.
        var inv = System.Globalization.CultureInfo.InvariantCulture;
        var key = $"daterange:{range.Start.ToString("yyyyMMdd", inv)}:{range.End.ToString("yyyyMMdd", inv)}:{(range.SoloFeriali ? "1" : "0")}:{(range.SaltaFestivi ? "1" : "0")}:{(range.ConGiornoSettimana ? "1" : "0")}";
        _parti.Add(new ProtoSlot(key, SlotKind.DateRange, 0, 0));
        _raw.Append(range.ToString());
    }

    internal readonly string Raw => _raw.ToString();
    internal readonly IReadOnlyList<ProtoPart> Parti => _parti;
}

/// <summary>
/// Un pezzo di frase come esce dal builder: dati puri, nessun comportamento. Al boot il RuntimeBuilder
/// li mappa 1:1 sugli <c>Slot</c> dell'AST eseguibile, aggiungendo l'unica cosa che qui non può esserci
/// perché dipende dalla catena: i gruppi esclusivi attivi (e la verifica che la flatlist esista).
/// </summary>
internal abstract record ProtoPart;

/// <summary>Testo fisso.</summary>
internal sealed record ProtoLit(string Text) : ProtoPart;

/// <summary>Segnaposto: chiave della lista (o della fascia/range), tipo, range numerico se ce l'ha,
/// e se è una variabile "fissata". Il TIPO è certo per costruzione: l'ha deciso l'overload.</summary>
internal sealed record ProtoSlot(string Key, SlotKind Kind, int Lo, int Hi, bool Bound = false) : ProtoPart;
