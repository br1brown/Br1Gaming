using Backend.Models;
using System.Text;
using System.Text.RegularExpressions;

namespace Backend.Generators.Grammar;

// ════════════════════════════════════════════════════════════════════════════
// Grammatica AST dei generatori. Le frasi-template (es. "ha [eta-giovane] anni")
// vengono COMPILATE UNA VOLTA al boot in un AST tipato (Lit/Slot); la generazione
// valuta l'AST con un contesto (unicità, punteggio), senza più regex a runtime.
//
// Garanzie rispetto al vecchio modello a stringhe:
//   • risoluzione DETERMINISTICA — il grafo dei riferimenti tra flatlist è
//     verificato aciclico al boot ⇒ terminazione garantita, NIENTE "max N passate";
//   • fail-fast — un tag sconosciuto o un ciclo fanno fallire la COSTRUZIONE
//     (boot), non scivolano silenziosamente nell'output;
//   • i vincoli inter-frase (gruppi esclusivi, label uniche) sono metadata
//     calcolata al parse, letta come set — non più scan di sottostringa.
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
}

/// <summary>
/// Un segnaposto risolto al parse: ne è già noto il tipo, l'eventuale range numerico e
/// i gruppi esclusivi a cui appartiene (per i vincoli, derivati una volta sola).
/// </summary>
public sealed record Slot(string Key, SlotKind Kind, int Lo, int Hi, IReadOnlySet<string> Groups) : Part;

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
    IReadOnlyDictionary<string, MarkovChain> Markov, double MarkovChaos);
