
// Alias tipizzati per i contenuti condivisi: niente stringhe magiche nei segnaposto.
using Nome = Backend.Generators.SharedContent.Nome;
using City = Backend.Generators.SharedContent.City;

namespace Backend.Generators.Catalog;

/// <summary>
/// Nomi di locali sulle vie del centro: UN solo generatore con due "anime" — bar/trattorie
/// all'italiana e kebabbari/locali "stranieri" all'italiana — selezionabili con la <see cref="Variant"/>
/// <c>tipo</c> (italiano/straniero). Le due anime condividono pagina, slug e catalogo (prima erano due
/// generatori separati: più coerente uno solo, visto che sono la stessa cosa — "che locale potresti
/// trovare in centro" — con due stili di insegna diversi.
/// <para>
/// A differenza dell'oroscopo (dove la variante fissa solo dei segnaposto, es. il segno), qui i due
/// stili hanno pattern di frase INCOMPATIBILI tra loro (parole diverse, numero di pezzi diverso): ogni
/// frase del Core porta quindi <c>soloOpzione: "italiano"</c> o <c>"straniero"</c> (vedi
/// <see cref="Frase.SoloOpzione"/>), così il motore pesca solo tra le frasi dello stile scelto. Ogni
/// chiave porta il suffisso del suo stile (<c>-bar</c> / <c>-kebab</c>): non serve al motore (le frasi
/// referenziano il simbolo C#, non la stringa), ma è la bussola per chi rilegge il file — a colpo
/// d'occhio si vede quale lista appartiene a quale anima, senza dover risalire alla posizione nel file.
/// Le liste sono divise per ruolo:
/// <list type="bullet">
///   <item>lato ITALIANO — <c>titoli-bar</c>: il tipo di locale (Bar, Caffè, Pizzeria…);
///         <c>toponimo-bar</c>: nomi di vie/luoghi/proprietà (Mazzini, del Corso…);
///         <c>evocativo-bar</c>: nomi d'atmosfera (Carpe Diem, Sapori Antichi…);
///         <c>grigliata-bar</c>: giochi di parole da brace, usati solo con i locali da griglia;</item>
///   <item>lato STRANIERO — <c>cibo-kebab</c>: gli atomi del menù (Kebab, Doner, Pizza, Shawarma…) che
///         si impilano liberamente, così "[cibo-kebab] [cibo-kebab]" produce sia accoppiate reali
///         (Doner Kebab, Pizza Kebab) sia ibridi improbabili ma plausibili (Doner Pizza);
///         <c>suffisso-kebab</c>/<c>prefisso-kebab</c>: i contenitori d'insegna (House, Express,
///         Point…) e i qualificatori anteposti (Super, Iper, Planet…); <c>aggettivo-kebab</c>: la
///         qualità postposta (Buono, Buonissimo, d'Oro…); <c>titolare-kebab</c>/<c>evocativo-kebab</c>/
///         <c>sovrano-kebab</c>: toponimi esteri, nomi del titolare (Da Alì Baba), epiteti postposti e
///         la formula "[sovrano-kebab] di [cibo-kebab]" (Il Mago di Doner); <c>pun-kebab</c>:
///         insegne-formula (giochi di parole e modi di dire) col cibo a segnaposto (Voglia di
///         [cibo-kebab]); la concordanza con "del" è volutamente imperfetta sui femminili (Amici del
///         Pizza) — si parodia il nome italiano coniato da non italiani, la comicità è nel risultato.</item>
/// </list>
/// L'<c>evocativo-kebab</c> vive su una chiave propria (non <c>evocativo-bar</c>): sono lo STESSO nome
/// concettuale ma pool di parole incompatibili (King/Sultan contro Carpe Diem/Il Ritrovo) — se
/// condividessero la chiave, il motore le mescolerebbe in una sola flatlist e uno stile
/// "contaminerebbe" l'altro a prescindere dalla frase scelta. Nessun <c>PhraseSettings</c>: il default
/// è una frase sola, come sempre per un nome.
/// </para>
/// </summary>
public sealed class LocaliGenerator : GeneratorBase
{
    // ── Lato ITALIANO ────────────────────────────────────────────────────────────────────────────
    // Segnaposto LOCALI tipizzati: la chiave vive qui, liste e frasi la referenziano dal simbolo.
    // Tipo di locale (tutti).
    internal static readonly Tag Titoli = new("titoli-bar")
    {
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
    };

    // Solo locali "da griglia": ricevono i giochi di parole sulla brace.
    internal static readonly Tag TitoliGriglia = new("titoli-griglia-bar")
    {
        ("Pizzeria", 2),
        ("Osteria", 2),
        ("Trattoria", 2),
        ("Braceria", 2),
        ("Griglieria", 2),
        ("Steakhouse", 2),
        ("Rosticceria", 2),
        ("Taverna", 2),
        ("Locanda", 2),
        ("Hosteria", 2),
        ("Agriturismo", 2),
        ("Paninoteca", 2),
        ("Enoteca", 2),
        ("Vineria", 2),
        ("Grill", 2),
    };

    // Vie, luoghi, proprietà. Le preposizioni restano minuscole (del Corso, all'angolo).
    internal static readonly Tag Toponimo = new("toponimo-bar")
    {
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
        new($"D'Azeglio {3..180}", 3),
        new($"Civico {3..180}", 3),
        ("Roma", 2),
        ("dei Mille", 2),
        new($"Vittorio Emanuele {3..180}", 3),
    };

    // Nomi d'atmosfera italiani, già capitalizzati.
    internal static readonly Tag Evocativo = new("evocativo-bar")
    {
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
    };

    // Giochi di parole sulla brace (solo con titoli-griglia).
    internal static readonly Tag Grigliata = new("grigliata-bar")
    {
        ("Braci e Abbracci", 3),
        ("Braciami Ancora", 2),
        ("Brace Mia", 2),
        ("Punto di Brace", 2),
        ("Ai Ferri Corti", 3),
        ("Fuoco e Fiamme", 2),
        ("A Tutta Brace", 3),
        ("Il Bacio della Brace", 3),
        ("Amici come Braci", 3),
        ("Braciami Forte", 2),
        ("Che Brace!", 2),
        ("Sotto la Brace Niente", 3),
        ("Brace Contro Brace", 2),
        ("La Brace nel Cuore", 3),
        ("Non è Vero ma ci Brace", 4),
        ("Braciere che Passione", 3),
    };

    // ── Lato STRANIERO ───────────────────────────────────────────────────────────────────────────
    // Atomi del menù: si impilano fra loro ("[cibo] [cibo]") e con i contenitori d'insegna. Ogni voce
    // deve leggere bene sia da sola sia incollata a un'altra.
    internal static readonly Tag Cibo = new("cibo-kebab")
    {
        ("Kebab", 2),
        ("Doner", 2),
        ("Döner", 2),
        ("Pizza", 2),
        ("Piadina", 2),
        ("Piza", 2),
        ("Köfte", 2),
        ("Shawarma", 2),
        ("Falafel", 2),
        ("Piada", 2),
        ("Durum", 2),
        ("Hamburger", 2),
        ("Kebap", 3),
        ("Arrosticini", 2),
        ("Gyros", 2),
        ("Adana", 3),
    };

    // Contenitori d'insegna postposti: "[cibo] [suffisso]" (Kebab House, Doner Express, Pizza Point).
    internal static readonly Tag Suffisso = new("suffisso-kebab")
    {
        ("House", 2),
        ("Express", 2),
        ("Point", 2),
        ("Station", 2),
        ("Land", 2),
        ("Time", 2),
        ("World", 2),
        ("City", 2),
        ("Palace", 2),
        ("Mania", 2),
        ("Center", 2),
        ("Corner", 2),
        ("Zone", 2),
        ("Palast", 3),
        ("Sultanato", 3),
    };

    // Qualificatori anteposti: "[prefisso] [cibo]" deve sempre suonare bene (Super Kebab, Planet Doner).
    internal static readonly Tag Prefisso = new("prefisso-kebab")
    {
        ("Super", 2),
        ("Iper", 3),
        ("Mega", 2),
        ("New", 2),
        ("Best", 2),
        ("Old", 2),
        ("Royal", 2),
        ("Master", 2),
        ("Mister", 2),
        ("Planet", 2),
        ("King", 2),
        ("Number One", 3),
        ("Casa", 2),
        ("Turbo", 2),
        ("Big", 2),
        ("Antico", 3),
    };

    // Qualità postposta.
    internal static readonly Tag Aggettivo = new("aggettivo-kebab")
    {
        ("Buono", 2),
        ("Buonissimo", 2),
        ("Top", 2),
        ("2", 2),
        ("Number One", 2),
        ("Numero Uno", 2),
        ("Originale", 2),
        ("Tipico", 2),
        ("Speciale", 2),
        ("d'Oro", 2),
        ("Autentico", 2),
        ("Doc", 2),
        ("Extra", 2),
        ("Deluxe", 2),
        ("Family", 2),
    };

    internal static readonly Tag Titolare = new("titolare-kebab")
    {
        ("Hassan", 2),
        ("Alì", 2),
        ("Alì Baba", 3),
        ("Hossein", 2),
        ("Mohammed", 2),
        ("Murat", 2),
        ("Mustafa", 2),
        ("Mehmet", 2),
        ("Yusuf", 2),
        ("Khalid", 2),
        ("Demir", 2),
        ("Mido", 2),
        ("Habibi", 2),
        ("Baba", 2),
        ("Kebabci", 2),
    };

    // Nomi d'atmosfera stranieri: chiave PROPRIA (non "evocativo-bar"), volutamente diversa da quella
    // italiana — sono due pool di parole incompatibili tra loro (vedi doc di classe).
    internal static readonly Tag EvocativoKebab = new("evocativo-kebab")
    {
        ("King", 2),
        ("Sultan", 2),
        ("Express", 2),
        ("Number One", 2),
        ("Da Asporto", 2),
        ("H24", 3),
        ("Lo Sfizio", 2),
        ("Sapori d'Oriente", 3),
        ("Mille e Una Notte", 3),
        ("del Sultano", 2),
        ("dei Faraoni", 2),
        ("dello Sceicco", 3),
        ("del Bosforo", 3),
        ("delle Piramidi", 3),
        ("di Istanbul", 2),
    };

    internal static readonly Tag Sovrano = new("sovrano-kebab")
    {
        ("Re", 2),
        ("Il Re", 2),
        ("Il Sultano", 2),
        ("Il Mago", 2),
        ("Sua Maestà il Re", 3),
        ("L'Imperatore", 2),
        ("Il Califfo", 2),
        ("Lo Sceicco", 2),
        ("Il Faraone", 2),
        ("Il Gran Visir", 3),
        ("Il Boss", 2),
        ("Il Dio", 2),
        ("Sua Altezza", 3),
        ("L'Emiro", 2),
        ("Il Padrone", 2),
    };

    internal static readonly Tag Pun = new("pun-kebab")
    {
        ("Abra Kebabra", 3),
        new($"Mamma li Turchi: {Cibo} {Aggettivo}", 3),
        new($"Che {Cibo}", 2),
        new($"Voglia di {Cibo}", 2),
        new($"L'Arte del {Cibo}", 3),
        new($"Amici del {Cibo}", 2),
        new($"Il Paradiso del {Cibo}", 3),
        new($"{Cibo} Therapy {Aggettivo}", 3),
        new($"Mondo {Cibo}", 2),
        new($"Tutto {Cibo}", 2),
        ("Kebabbo Mio", 3),
        ("Obi Wan Kebabi", 4),
        new($"Non Solo {Cibo}", 2),
        new($"{Cibo} & Love", 2),
        new($"La Casa del {Cibo}", 2),
    };


    /// <inheritdoc />
    public override string Slug => "locali";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new()
    {
        Order = 8,
        Name = "Nomi Locali sulle Vie del Centro",
        Description = "Stai andando in centro? Ecco il locale che potresti trovarci",
    };

    /// <inheritdoc />
    // La scelta offerta prima di generare: italiano o straniero. Nessun Seed da fissare (non c'è un
    // segnaposto da bloccare, qui la variante sceglie DIRETTAMENTE quali frasi del Core sono in gioco
    // tramite Frase.SoloOpzione) — Options con un dizionario Seeds vuoto.
    public override GeneratorVariant? Variant { get; } = new("tipo", "Tipo di locale",
    [
        new("italiano", "Italiano", new Dictionary<string, IReadOnlyList<string>>()),
        new("straniero", "Straniero", new Dictionary<string, IReadOnlyList<string>>()),
    ]);

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        // ── Italiano ──
        new($"{Titoli} {Toponimo}", 2, "italiano"),
        new($"{Titoli} {Evocativo}", 2, "italiano"),
        new($"{Titoli} da {Nome.Any}", 3, "italiano"),
        new($"{Titoli} {Nome.Any}", 2, "italiano"),
        new($"{TitoliGriglia} {Grigliata}", 3, "italiano"),

        // ── Straniero ──
        new($"{Prefisso} {Cibo} {EvocativoKebab}", 2, "straniero"),
        new($"{Cibo} {Cibo} {Aggettivo} {Aggettivo}", 2, "straniero"),
        new($"{Cibo} {Suffisso} {Aggettivo}", 2, "straniero"),
        new($"{Cibo} {Cibo} {Suffisso}", 3, "straniero"),
        new($"{Prefisso} {Cibo} {Suffisso}", 3, "straniero"),
        new($"{Cibo} {Aggettivo}", 2, "straniero"),
        new($"{Cibo} {Cibo} {Aggettivo} {Aggettivo}", 3, "straniero"),
        new($"{Cibo} {City.Any}: {Aggettivo}", 2, "straniero"),
        new($"{Prefisso} {Cibo} in the {City.Any}", 3, "straniero"),
        new($"{Cibo} da {Titolare}: {EvocativoKebab} ", 2, "straniero"),
        new($"{Prefisso} Da {Titolare}: {Pun} ", 2, "straniero"),
        new($"{Cibo} {EvocativoKebab}", 2, "straniero"),
        new($"{Sovrano} di {Cibo}", 3, "straniero"),
        new($"{Pun}", 3, "straniero"),
    ];
}
