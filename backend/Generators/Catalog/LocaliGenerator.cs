using Backend.Models;

namespace Backend.Generators.Catalog;

/// <summary>
/// Nomi di bar/locali tutti italiani. Le parti del nome sono divise per ruolo:
/// <list type="bullet">
///   <item><c>titoli</c>: il tipo di locale (Bar, Caffè, Pizzeria…);</item>
///   <item><c>toponimo</c>: nomi di vie/luoghi/proprietà (Mazzini, del Corso…);</item>
///   <item><c>evocativo</c>: nomi d'atmosfera (Carpe Diem, Sapori Antichi…);</item>
///   <item><c>grigliata</c>: giochi di parole da brace, usati solo con i locali da griglia.</item>
/// </list>
/// Più pattern nel core danno varietà; le preposizioni restano minuscole, il resto è già capitalizzato.
/// </summary>
public sealed class LocaliGenerator : GeneratorBase
{
    /// <inheritdoc />
    public override string Slug => "locali";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 4, Name = "Generatore Nomi Bar", Description = "Trova il nome del tuo locale tutto italiano" };

    /// <inheritdoc />
    public override Dictionary<string, List<ScoredItem>> FlatLists { get; } = new()
    {
        // Tipo di locale (tutti).
        ["titoli"] =
        [
            ("Bar", 2),
            ("Baretto", 2),
            ("Café", 2),
            ("Caffè", 2),
            ("Caffetteria", 2),
            ("Chiosco", 2),
            ("Bottega", 2),
            ("Bistrò", 2),
            ("Bookique", 2),
            ("Pizzeria", 2),
            ("Osteria", 2),
            ("Trattoria", 2),
            ("Braceria", 2),
            ("Locanda", 2),
            ("Enoteca", 2),
            ("Birreria", 2),
            ("Birrificio", 2),
            ("Paninoteca", 2),
            ("Rosticceria", 2),
            ("Gelateria", 2),
            ("Pasticceria", 2),
            ("Cremeria", 2),
            ("Yogurteria", 2),
            ("Friggitoria", 2),
            ("Spaghetteria", 2),
            ("Hamburgeria", 2),
            ("Polleria", 2),
            ("Pescheria", 2),
            ("Salumeria", 2),
            ("Norcineria", 2),
            ("Focacceria", 2),
            ("Piadineria", 2),
            ("Crêperia", 2),
            ("Cicchetteria", 2),
            ("Vineria", 2),
            ("Cantina", 2),
            ("Taverna", 2),
            ("Hosteria", 2),
            ("Pub", 2),
            ("Brasserie", 2),
            ("Steakhouse", 2),
            ("Forno", 2),
            ("Panificio", 2),
            ("Drogheria", 2),
            ("Mescita", 2),
            ("Fiaschetteria", 2),
            ("Frasca", 2),
            ("Agriturismo", 2),
            ("Pizzicheria", 2),
            ("Gastronomia", 2),
        ],
        // Solo locali "da griglia": ricevono i giochi di parole sulla brace.
        ["titoli-griglia"] =
        [
            ("Pizzeria", 2),
            ("Osteria", 2),
            ("Trattoria", 2),
            ("Braceria", 2),
        ],
        // Vie, luoghi, proprietà. Le preposizioni restano minuscole (del Corso, all'angolo).
        ["toponimo"] =
        [
            ("Mazzini", 2),
            ("Garibaldi", 2),
            ("Cavour", 2),
            ("Dolomiti", 2),
            ("Venezia", 2),
            ("Italia", 2),
            ("Tolomeo", 2),
            ("Centrale", 2),
            ("Moderno", 2),
            ("del Corso", 2),
            ("all'angolo", 2),
            ("al crocevia", 2),
            ("D'Azeglio [3-180]", 3),
            ("Civico [3-180]", 3),
        ],
        // Nomi d'atmosfera, già capitalizzati.
        ["evocativo"] =
        [
            ("Carpe Diem", 2),
            ("Mille Idee", 2),
            ("Sapori Antichi", 2),
            ("Sapori Autentici", 2),
            ("Il Ritrovo", 2),
            ("Il Bivio", 2),
            ("Il Profano", 2),
            ("Il Sultano", 2),
            ("Il Marcio", 2),
            ("Italia Mia", 2),
            ("Viva Italia", 2),
            ("Jolly", 2),
            ("Spuntino", 2),
            ("Enigmi", 2),
            ("Sport", 2),
            ("Experience Cocktail", 2),
            ("E Non Solo", 3),
            ("delle Bontà", 2),
            ("LUME", 2),
            ("Roxy", 2),
        ],
        // Giochi di parole sulla brace (solo con titoli-griglia).
        ["grigliata"] =
        [
            ("Braci e Abbracci", 3),
            ("Braciami Ancora", 2),
            ("Brace Mia", 2),
            ("Punto di Brace", 2),
        ],
    };

    /// <inheritdoc />
    public override List<ScoredItem> Core { get; } =
    [
        ("[titoli] [toponimo]", 2),
        ("[titoli] [evocativo]", 2),
        ("[titoli] da [nome]", 3),
        ("[titoli] [nome]", 2),
        ("[titoli-griglia] [grigliata]", 3),
    ];
}
