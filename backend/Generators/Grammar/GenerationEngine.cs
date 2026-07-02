namespace Backend.Generators.Grammar;

// ════════════════════════════════════════════════════════════════════════════
// Grammatica AST dei generatori. Le frasi nascono GIÀ tipizzate alla costruzione
// (interpolazione via FraseBuilder: es. new($"ha {Eta.Giovane} anni")); al boot
// il RuntimeBuilder aggancia solo il contesto di catena (gruppi, label, esistenza
// delle liste) e la generazione valuta l'AST. Non esiste un momento in cui un
// template sia una stringa da scandire: niente regex, da nessuna parte.
//
// Garanzie rispetto al vecchio modello a stringhe:
//   • un segnaposto malformato o inesistente NON COMPILA (i segnaposto sono
//     simboli C#, il FraseBuilder accetta solo i tipi ammessi);
//   • risoluzione DETERMINISTICA — il grafo dei riferimenti tra flatlist è
//     verificato aciclico al boot ⇒ terminazione garantita, NIENTE "max N passate";
//   • fail-fast — una lista assente dalla catena fusa o un ciclo fanno fallire
//     la COSTRUZIONE (boot), non scivolano silenziosamente nell'output;
//   • i vincoli inter-frase (gruppi esclusivi, label uniche) sono metadata
//     calcolata alla compilazione, letta come set — non più scan di sottostringa.
// ════════════════════════════════════════════════════════════════════════════

/// <summary>Eccezione di configurazione: un generatore non compila (tag ignoto, ciclo). Tirata al boot.</summary>
public sealed class GeneratorConfigException(string message) : Exception(message);

/// <summary>Nodo dell'AST di una frase: testo letterale o segnaposto.</summary>
public abstract record Part;

/// <summary>Testo letterale (la parte fissa di un template).</summary>
public sealed record Lit(string Text) : Part;

/// <summary>Natura di uno <see cref="Slot"/>: lista di parole, alias d'età, o range numerico.</summary>
public enum SlotKind
{
    /// <summary>Pesca da una flatlist (con punteggio e unicità).</summary>
    FlatList,
    /// <summary>Alias di fascia d'età risolto in un numero entro il range della fascia.</summary>
    Age,
    /// <summary>Range numerico esplicito (es. <c>2-15</c>) risolto in un numero casuale.</summary>
    Range,
    /// <summary>Innesto: esegue un ALTRO generatore (la Key è il suo slug) e ne incolla il testo.</summary>
    Innesto,
}

/// <summary>
/// Un segnaposto risolto al parse: ne è già noto il tipo, l'eventuale range numerico e
/// i gruppi esclusivi a cui appartiene (per i vincoli, derivati una volta sola).
/// <para>
/// <paramref name="Bound"/> (sintassi <c>[$chiave]</c>): variabile CONDIVISA nella generazione. Alla
/// prima risoluzione pesca normalmente (punteggio + unicità) e MEMORIZZA il valore sotto <see cref="Key"/>;
/// le occorrenze successive — nella stessa frase o in frasi diverse — riusano quel valore (niente nuovo
/// punteggio, niente unicità). È l'opposto dell'unicità: "appunta" un'età/marca/persona per tutta la frase.
/// </para>
/// </summary>
public sealed record Slot(string Key, SlotKind Kind, int Lo, int Hi, IReadOnlySet<string> Groups, bool Bound = false) : Part;

/// <summary>
/// Una frase compilata: l'AST delle sue parti, il punteggio base, e i metadata per i vincoli
/// (gruppi/label toccati dai suoi Slot DIRETTI — profondità shallow, come il vecchio motore).
/// </summary>
/// <param name="Score">Punteggio base della frase.</param>
/// <param name="Parts">AST della frase.</param>
/// <param name="Groups">Gruppi esclusivi toccati (per la mutua esclusione tra frasi).</param>
/// <param name="Labels">Label uniche contenute nel template (per l'unicità).</param>
/// <param name="Origin">Slug del generatore d'origine (per verificare l'iniezione Required).</param>
/// <param name="Raw">Template originale (per la dedup in selezione).</param>
public sealed record Phrase(
    double Score, IReadOnlyList<Part> Parts,
    IReadOnlySet<string> Groups, IReadOnlySet<string> Labels, string Origin, string Raw);

/// <summary>Quota di frasi identitarie da iniettare per un generatore ospite.</summary>
public sealed record Requirement(int Min, int Max, IReadOnlyList<Phrase> Phrases);

/// <summary>Voce risolta di una flatlist: l'AST del valore (può avere tag annidati), il peso, il testo grezzo (per l'unicità).</summary>
public sealed record FlatEntry(Phrase Ast, double Score, string Raw);

/// <summary>
/// Generatore COMPILATO: la fusione della catena (master→ospite) già parsata in AST e validata.
/// Prodotto una volta al boot da <see cref="RuntimeBuilder"/>, consumato da <see cref="Composer"/>.
/// </summary>
public sealed record Runtime(
    IReadOnlyDictionary<string, IReadOnlyList<FlatEntry>> FlatLists,
    IReadOnlyList<Phrase> GlobalCore,
    IReadOnlyList<Requirement> Requirements,
    int MinPhrases, int MaxPhrases, double MinScore,
    IReadOnlyList<string> Separators,
    Phrase? Apertura, Phrase? Chiusura,
    // Catene di Markov per flatlist eleggibile (conio di varianti) e relativa probabilità.
    // Dizionario vuoto / probabilità 0 = feature disattiva (comportamento storico invariato).
    IReadOnlyDictionary<string, MarkovChain> Markov, double MarkovChaos,
    // Risolve lo slug di un innesto ({Genera("...")}) nel Runtime da eseguire. Il grafo degli
    // innesti è validato aciclico al boot: la ricorsione termina sempre.
    Func<string, Runtime> RisolviInnesto);
