
// Alias tipizzati sui contenuti CONDIVISI: la stessa scorciatoia usata dagli altri generatori
// (es. Kebab). Servono a "inquinare" le previsioni coi contenuti condivisi, come gli altri.
using Nome = Backend.Generators.SharedContent.Nome;
using City = Backend.Generators.SharedContent.City;
using Professioni = Backend.Generators.SharedContent.Professioni;
using Piatti = Backend.Generators.SharedContent.Piatti;
using Social = Backend.Generators.SharedContent.Social;
using Giorni = Backend.Generators.SharedContent.Giorni;
using DataOggi = Backend.Generators.SharedContent.Dinamici.DataOggi;
using Parente = Backend.Generators.SharedContent.Parente;
using Eta = Backend.Generators.SharedContent.Eta;
using Marketplace = Backend.Generators.SharedContent.Marketplace;

namespace Backend.Generators.Catalog;

/// <summary>
/// L'oroscopo demenziale: a differenza degli altri generatori, prima di generare si sceglie il
/// <b>segno</b> (la <see cref="Variant"/>). La scelta fissa la "cornice solare" con dati astrologici
/// VERI — segno, elemento, pianeta dominante, qualità (cardinale/fisso/mobile) — e pesca da POOL
/// caratteriali <b>del segno</b> (pregio/ombra/tema): tratti semanticamente in linea con la tradizione
/// (impianto alla Lisa Morpurgo), con qualche "ombra" volutamente discutibile. Il resto delle
/// previsioni è generico, pescato a caso e "inquinato" coi tag condivisi come gli altri generatori,
/// così due oroscopi non sono mai uguali.
/// <para>
/// Meccanismo: le opzioni della variante portano dei <c>Seeds</c> (segnaposto → pool). Il motore ne
/// pesca uno per chiave e lo pre-appunta come variabile condivisa; così i <c>{X.Fissato}</c> (→
/// <c>[$x]</c>) restano coerenti col segno per tutto il testo. Pool di un elemento = valore fisso
/// (elemento/pianeta/qualità); pool ampio = varietà "del segno" (i tratti). Le liste locali sotto
/// servono da fallback e da validazione al boot (ogni segnaposto dichiarato dev'essere citato).
/// </para>
/// </summary>
public sealed class OroscopoGenerator : GeneratorBase
{
    // ── Cornice SOLARE, fissata dal segno scelto (i Seeds la sovrascrivono a runtime) ─────────────
    // Devono esistere ed essere citate: il boot valida che ogni lista sia usata e ogni segnaposto noto.
    internal static readonly Tag Segno = new("segno")
    {
        "Ariete", "Toro", "Gemelli", "Cancro", "Leone", "Vergine",
        "Bilancia", "Scorpione", "Sagittario", "Capricorno", "Acquario", "Pesci",
    };
    internal static readonly Tag Elemento = new("elemento") { "Fuoco", "Terra", "Aria", "Acqua" };
    internal static readonly Tag Pianeta = new("pianeta")
    {
        "Marte", "Venere", "Mercurio", "Luna", "Sole",
        "Plutone", "Giove", "Saturno", "Urano", "Nettuno",
    };
    internal static readonly Tag Qualita = new("qualita") { "cardinale", "fisso", "mobile" };

    // ── Tratti "del segno" (fallback generico; a runtime li rimpiazza il pool del segno scelto) ────
    // pregio/ombra = aggettivi (maschile, come vuole la resa da oroscopo); tema = sintagma nominale.
    internal static readonly Tag Pregio = new("pregio") { "determinato", "sensibile", "brillante", "generoso" };
    internal static readonly Tag Ombra = new("ombra") { "permaloso", "testardo", "lunatico", "esagerato" };
    internal static readonly Tag Tema = new("tema") { "una scelta rimandata", "un vecchio rancore", "la voglia di cambiare aria" };

    // ── Contenuto GENERICO (pescato a caso, uguale per tutti): il lato demenziale + i tag condivisi ─
    internal static readonly Tag Ambito = new("ambito")
    {
        "In amore", "Sul lavoro", "Con i soldi", "In famiglia", "Con gli amici",
        "In salute", "A letto", "Con la dieta", "Sui social", "Con il capo",
        "Con il partner", "In palestra", "Con i parenti", "Nel traffico",
        "Con l'ex", "In vacanza", "Con il vicino di casa", "Alla riunione di condominio",
    };

    // Ordinale FEMMINILE per "settimana" (sempre femminile → nessun problema di concordanza): i tempi
    // "del mese" si dicono come "al {giorno} della {ordinale} settimana" — es. "al giovedì della terza
    // settimana". Il giorno resta il tag condiviso (domenica inclusa).
    internal static readonly Tag Ordinale = new("ordinale") { "prima", "seconda", "terza", "quarta" };

    // Previsioni: predicati (minuscoli) che seguono un'apertura d'ambito. La LUNGHEZZA è mista di
    // proposito (corte secche, medie, lunghe): così i paragrafi dell'oroscopo non hanno tutti lo
    // stesso ritmo. I riferimenti temporali usano "al {giorno} della {ordinale} settimana".
    internal static readonly Tag Previsione = new("previsione")
    {
        // Corte, secche.
        ("sarà un disastro", 2),
        ("niente di buono", 2),
        ("meglio soprassedere", 2),
        ("tutto tace, sospettosamente", 2),
        ("nulla di irreparabile, per ora", 2),
        // Medie.
        ("le stelle consigliano di restare a letto e fingersi irreperibile", 2),
        ("arriva una svolta che, come da tradizione, ignorerai", 2),
        ("qualcuno ti deluderà con la puntualità di un orologio svizzero", 2),
        ("una spesa imprevista prosciugherà il conto già in sofferenza", 2),
        ("riceverai un messaggio che leggerai senza mai rispondere", 2),
        ("il tuo capo fingerà di apprezzarti fino alle 18:00", 3),
        ("meglio non prendere decisioni, e nemmeno alzarsi", 2),
        ("l'universo cospira, ma con scarsa organizzazione", 3),
        ("qualcosa andrà storto, probabilmente per colpa tua", 2),
        ("troverai la forza di rimandare tutto a domani", 2),
        ("il destino bussa, ma tu sei sotto la doccia", 3),
        ("giornata ideale per litigare su un gruppo WhatsApp", 2),
        ("un vecchio amico ti scriverà solo per venderti qualcosa", 4),
        ("scoprirai di aver ragione, ma con giorni di ritardo", 3),
        ("un imprevisto ti salverà da un impegno che detestavi", 3),
        ("la pazienza verrà messa alla prova da una fila alle poste", 2),
        ("ti verrà voglia di cambiare vita, poi passerà entro pranzo", 3),
        // Riferite al giorno di una settimana del mese ("al giovedì della terza settimana").
        new($"un impegno ti aspetta al {Giorni.Any} della {Ordinale} settimana e fingerai di averlo già in agenda", 3),
        new($"al {Giorni.Any} della {Ordinale} settimana dovrai dare una risposta che continuerai a rimandare", 3),
        // Lunghe.
        ("un concatenarsi di piccoli imprevisti, all'apparenza slegati, cospirerà per farti arrivare tardi proprio dove non volevi andare", 5),
        ("qualcuno che credevi affidabile dimostrerà, con calma e metodo quasi chirurgico, di non esserlo affatto", 4),
        // "Gemme" rare (punteggio alto): capitano di rado e fanno schizzare il ★.
        ("qualcuno userà la tua password del Wi-Fi senza nemmeno ringraziare", 6),
        ("rimpiangerai un carrello abbandonato tre mesi fa, con rimorso", 6),
        new($"una notifica ti rovinerà l'unica giornata perfetta del mese, guarda caso al {Giorni.Any} della {Ordinale} settimana", 7),
    };

    // Consigli delle stelle: imperativi (maiuscoli), chiudono la frase. Punteggio = rarità: i più
    // scontati pesano 1, i più arguti/meta pesano di più (compaiono meno e alzano il ★).
    internal static readonly Tag Consiglio = new("consiglio")
    {
        "Evita le decisioni importanti, e pure quelle stupide.",
        "Non fidarti di chi ti offre da bere.",
        "Rimanda tutto a lunedì, tanto peggiora comunque.",
        ("Metti giù il telefono e affronta la vita. O almeno il telefono.", 3),
        "Sorridi: confonde i nemici e i creditori.",
        ("Respira. Poi respira ancora. Poi torna a letto.", 3),
        "Fidati dell'istinto, tanto sbaglia con eleganza.",
        "Investi in pazienza: rende poco ma è gratis.",
        ("Occhio a chi ti dà ragione troppo in fretta.", 2),
        ("Bevi acqua: le stelle non sanno cos'altro dirti.", 5),
        "Se ti chiedono un favore, ricordati di essere impegnatissimo.",
        ("Non rispondere a freddo: rispondi proprio male.", 3),
        ("Fai finta di niente, funziona nel sessanta per cento dei casi.", 4),
        "Rimanda la palestra: c'è tempo fino al prossimo lunedì.",
        ("Non prendere impegni che superino le ventiquattro ore.", 2),
        ("Conta fino a dieci, poi manda comunque quel messaggio.", 3),
        ("Diffida degli entusiasmi, soprattutto i tuoi.", 4),
        ("Spegni le notifiche e accendi il cervello. O viceversa.", 3),
        // Corte, secche.
        "Lascia stare.",
        "Rimanda.",
        ("Fidati poco.", 2),
        // Lunga.
        ("Prima di rispondere rileggi, rifletti, rimanda di un'ora e poi sbaglia comunque: almeno sarà una tua scelta consapevole.", 4),
    };

    // ── Vena "MBEB/incel" dell'oroscopo: più mordente e specifica del generico, MA senza nomi reali
    // (resta oroscopo) e senza volgarità. Tre registri: la sfiga precisa, lo scocciatore-archetipo,
    // la fuffa astrologica sgonfiata dall'ironia. ──

    // Sfighe puntuali e moderne del giorno: predicati che seguono "oggi …". Ognuna porta un tag condiviso
    // (nome/città/marketplace/giorno/range): dove c'è un riferimento per cui abbiamo un tag, lo usiamo.
    internal static readonly Tag Sventura = new("sventura")
    {
        new($"il POS non funzionerà proprio quando tocca a te, e dietro in fila {Nome.M} sbuffa", 2),
        new($"a {City.Any} troverai parcheggio solo cinque minuti prima di ripartire", 2),
        new($"ti si spegnerà il telefono all'1% proprio mentre stai chiamando {Nome.F}", 2),
        new($"la fila che lascerai diventerà la più veloce, e ci sfilerà davanti {Nome.M}", 3),
        new($"a {City.Any} un monopattino ti taglierà la strada sulle strisce", 2),
        new($"il pacco da {Marketplace.Any} arriverà proprio mentre sei sotto la doccia", 3),
        new($"l'autovelox sulla strada per {City.Any} ti beccherà per {2..6} chilometri orari di troppo", 3),
        new($"il barista — un certo {Nome.M} — ti darà tutto il resto in monetine", 2),
        new($"un {Professioni.M} ti rifilerà l'ennesimo ‘ci pensiamo e ti facciamo sapere’", 3),
        new($"il collega {Nome.M} rimetterà in discussione una cosa decisa da settimane", 2),
        new($"a {City.Any} ti toccherà il carrello con la ruota impazzita", 2),
        new($"il gruppo WhatsApp del condominio si accenderà proprio di {Giorni.Any}", 3),
        new($"scoprirai una spesa ricorrente su {Marketplace.Any} che giuravi di aver disdetto", 3),
        new($"prenderai tutti i semafori rossi verso {City.Any}, ma solo quando hai fretta", 2),
        new($"l'ombrello si romperà al primo colpo di vento, puntuale come un {Giorni.Any}", 2),
    };

    // Lo scocciatore-archetipo che incroci: sintagmi nominali (seguono "incrocerai …" / "attenzione a …").
    // Nome, professione, parente, social, range: pescati dai tag, non scritti a mano.
    internal static readonly Tag TipoMolesto = new("tipo-molesto")
    {
        new($"un {Professioni.M} che ti spiega la tua stessa battuta", 2),
        new($"un certo {Nome.M} che risponde ‘a tutti’ alle mail aziendali", 3),
        new($"una {Parente.F} che ti chiede di nuovo quando ti sposi", 2),
        new($"un certo {Nome.M} che ti parla di criptovalute a cena", 2),
        new($"il collega {Nome.M} che dice ‘buttiamo giù due righe’", 3),
        new($"una {Parente.Anziano.F} che ti manda un vocale di {3..8} minuti per dire ‘ok’", 3),
        new($"{Nome.F} che ti aggiunge a un gruppo senza chiedere", 2),
        new($"una {Professioni.F} che spiega il tuo lavoro a te", 3),
        new($"un certo {Nome.M} che mette le quattro frecce e parcheggia dove gli pare", 3),
        new($"il vicino {Nome.M} che trapana la domenica alle otto di mattina", 2),
        new($"un tale conosciuto su {Social.Any} che scrive ‘ciao come va?’ e poi sparisce", 4),
        new($"{Nome.F} che ti dice ‘te l'avevo detto’ senza avertelo mai detto", 3),
        new($"un {Professioni.M} che risponde alla domanda che non hai fatto", 2),
    };

    // La fuffa astrologica, ma sgonfiata: frasi complete (chiudono da sole).
    internal static readonly Tag PseudoMistico = new("pseudo-mistico")
    {
        ("Mercurio retrogrado ti darà l'alibi perfetto per non combinare niente.", 3),
        ("L'allineamento dei pianeti coincide, guarda caso, con la tua pigrizia.", 3),
        ("Venere in dissonanza ti autorizza ufficialmente a ignorare i messaggi.", 3),
        ("Saturno ti impartisce una lezione che ignorerai come le precedenti.", 3),
        ("L'energia cosmica di oggi è quella di un martedì qualunque.", 2),
        ("Le stelle sono allineate; tu un po' meno.", 3),
        ("Giove ti sorride, ma con l'aria di chi ha fretta.", 2),
        ("La Luna è nel tuo segno: non significa niente, ma suona bene.", 3),
        ("Il tuo ascendente oggi rema contro, come del resto tutto il resto.", 3),
    };

    /// <inheritdoc />
    public override string Slug => "oroscopo";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new()
    {
        Order = 4,
        Name = "Oroscopo del Giorno",
        Description = "Scegli il segno e ricevi previsioni totalmente giusate e vere altro che",
    };

    /// <inheritdoc />
    // 3-5 previsioni, una per riga (paragrafi separati): resa da oroscopo.
    // MinScore = pavimento di rarità: se una composizione pesa meno, il motore la ri-rolla (tenendo
    // la migliore, fino a un tetto di tentativi) — così un oroscopo non esce mai "piatto". Il tetto
    // resta libero: le previsioni "gemma" fanno comunque schizzare in alto il ★.
    public override GenerationSettings? PhraseSettings { get; } = new()
    {
        MinPhrases = 3,
        MaxPhrases = 5,
        Separators = ["\n\n"],
        MinScore = 14,
    };

    /// <inheritdoc />
    // Intestazione con la data di oggi (seed dinamico condiviso) e la cornice solare AUTENTICA del segno
    // (fissata dai Seeds). Non concorre al punteggio (è apertura) e cita tutti e cinque i segnaposto
    // fissati (data + segno/elemento/qualità/pianeta), così risultano sempre usati.
    public override Frase? Apertura { get; } =
        new($"**Oroscopo del giorno {DataOggi.Any.Fissato} per il segno {Segno.Fissato}** — {Elemento.Fissato}, segno {Qualita.Fissato} governato da {Pianeta.Fissato}.\n\n");

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        // ── Cornice "solare" del segno: pregio/ombra/tema pescati dal pool DEL SEGNO scelto ──
        new($"Da {Segno.Fissato} sei {Pregio.Fissato}, ma la tua ombra oggi è essere {Ombra.Fissato}.", 4),
        new($"Da buon segno di {Elemento.Fissato}, il tuo lato {Pregio.Fissato} verrà fuori; peccato per quello {Ombra.Fissato}.", 4),
        new($"Con {Pianeta.Fissato} in aspetto storto, il tuo lato {Ombra.Fissato} prende il sopravvento.", 4),
        new($"Il tema del giorno per il segno {Segno.Fissato}: {Tema.Fissato}.", 3),
        new($"La tua natura da segno {Qualita.Fissato} ti spinge dritto verso {Tema.Fissato}.", 3),

        // ── Previsioni generiche d'ambito (lunghezza mista, per variare il ritmo dei paragrafi) ──
        new($"{Ambito}, {Previsione}.", 2),
        new($"{Ambito}, {Previsione}; {Consiglio}", 3),
        new($"{Ambito}, {Previsione}.", 2),
        new($"{Previsione}. Nient'altro.", 2),                                     // corta, secca
        new($"{Ambito}, {Previsione}, e come se non bastasse {Previsione}.", 3),   // lunga, doppia previsione

        // ── Previsioni "inquinate" coi tag condivisi, come gli altri generatori ──
        new($"{Ambito}, una collega di nome {Nome.F} ti metterà in difficoltà senza accorgersene.", 3),
        new($"Occhio a un {Professioni.M} conosciuto su {Social.Any}: {Previsione}.", 3),
        new($"Occhio a una {Professioni.F} conosciuta su {Social.Any}: {Previsione}.", 3),
        new($"Una gita a {City.Any} ti tenterà, ma la rimanderai come tutto il resto.", 3),
        new($"{Giorni.Any} è il giorno giusto per NON rispondere a {Nome.M}.", 3),
        new($"Le stelle vedono un piatto di {Piatti.Any} e un rimorso lungo la strada per {City.Any}.", 3),
        new($"Una {Parente.F} ti chiederà notizie che non hai voglia di dare.", 2),
        new($"Un {Parente.M} ti darà una lezione di vita che non avevi chiesto.", 2),
        new($"Un {Professioni.M} di {Eta.Cresciuto} anni ti darà un consiglio pessimo: seguilo pure.", 4),
        new($"Una {Professioni.F} di {Eta.Cresciuto} anni ti darà un consiglio pessimo: seguilo pure.", 4),
        new($"Numeri fortunati: {1..90} e {1..90}. Non ci prenderai comunque.", 2),
        new($"Attenzione agli acquisti d'impulso su {Marketplace.Any}: {Nome.M} lo scoprirà.", 3),

        // ── Vena "MBEB/incel": la sfiga precisa, lo scocciatore, la fuffa astrologica ironica ──
        new($"Le stelle prevedono una sfiga precisa: oggi {Sventura}.", 4),
        new($"{Ambito}, oggi {Sventura}.", 3),
        new($"E occhio, perché {Sventura} — e gli astri, in tutto questo, se la ridono.", 4),
        new($"Oggi incrocerai {TipoMolesto}: sorridi e sopravvivi.", 4),
        new($"Attenzione a {TipoMolesto}; gli astri, per la cronaca, non muoveranno un dito per te.", 4),
        new($"{PseudoMistico}", 3),
        new($"{PseudoMistico} {Consiglio}", 4),

        // ── Chiusure-consiglio ──
        new($"Il consiglio degli astri: {Consiglio}", 2),
        new($"{Previsione}. {Consiglio}", 2),
    ];

    /// <inheritdoc />
    // La scelta offerta prima di generare: i 12 segni. Ognuno porta la cornice solare REALE
    // (elemento/pianeta/qualità) e i pool caratteriali "del segno" (pregi autentici, ombre discutibili,
    // temi) — semanticamente in linea con la tradizione morpurghiana, con una punta di satira.
    public override GeneratorVariant? Variant { get; } = new("segno", "Segno zodiacale",
    [
        Opt("ariete", "♈ Ariete", "Fuoco", "Marte", "cardinale",
            pregi: ["coraggioso", "energico", "diretto", "intraprendente", "sfrontato", "competitivo"],
            ombre: ["impulsivo", "prepotente", "egocentrico", "permaloso", "irascibile", "precipitoso"],
            temi: ["la voglia di primeggiare", "l'impazienza cronica", "una sfida da vincere a tutti i costi", "una discussione da non iniziare", "la fretta di arrivare primo"]),
        Opt("toro", "♉ Toro", "Terra", "Venere", "fisso",
            pregi: ["concreto", "affidabile", "paziente", "sensuale", "goloso", "leale"],
            ombre: ["testardo", "pigro", "materialista", "possessivo", "ingordo", "abitudinario"],
            temi: ["il piacere della buona tavola", "l'attaccamento alle cose", "la ricerca di sicurezza", "una tentazione golosa", "il conto in banca da difendere"]),
        Opt("gemelli", "♊ Gemelli", "Aria", "Mercurio", "mobile",
            pregi: ["brillante", "curioso", "adattabile", "comunicativo", "versatile", "spiritoso"],
            ombre: ["superficiale", "incostante", "chiacchierone", "doppiogiochista", "distratto", "volubile"],
            temi: ["mille conversazioni in sospeso", "la noia da combattere", "un'idea nuova ogni ora", "un doppio impegno da incastrare", "la curiosità che ti distrae"]),
        Opt("cancro", "♋ Cancro", "Acqua", "Luna", "cardinale",
            pregi: ["empatico", "protettivo", "intuitivo", "tenero", "premuroso", "affettuoso"],
            ombre: ["permaloso", "lunatico", "vittimista", "appiccicoso", "ombroso", "apprensivo"],
            temi: ["la nostalgia di casa", "gli affetti da coltivare", "gli sbalzi d'umore", "un ricordo che riaffiora", "il bisogno di coccole"]),
        Opt("leone", "♌ Leone", "Fuoco", "Sole", "fisso",
            pregi: ["generoso", "carismatico", "leale", "solare", "magnanimo", "fiero"],
            ombre: ["egocentrico", "vanitoso", "arrogante", "teatrale", "prepotente", "permaloso"],
            temi: ["il bisogno di applausi", "l'orgoglio ferito", "il palcoscenico della vita", "i riflettori da conquistare", "una lode che aspetti da giorni"]),
        Opt("vergine", "♍ Vergine", "Terra", "Mercurio", "mobile",
            pregi: ["preciso", "analitico", "servizievole", "ordinato", "metodico", "affidabile"],
            ombre: ["pignolo", "ipercritico", "ipocondriaco", "ansioso", "fissato", "brontolone"],
            temi: ["la lista delle cose da fare", "il dettaglio che non torna", "la perfezione irraggiungibile", "un errore altrui da correggere", "l'ordine da rimettere a posto"]),
        Opt("bilancia", "♎ Bilancia", "Aria", "Venere", "cardinale",
            pregi: ["diplomatico", "elegante", "socievole", "equilibrato", "cortese", "raffinato"],
            ombre: ["indeciso", "opportunista", "superficiale", "vanesio", "ambiguo", "pigro"],
            temi: ["una decisione rimandata all'infinito", "la ricerca dell'armonia", "il bisogno di piacere a tutti", "un compromesso da trovare", "l'eleganza anche nel disastro"]),
        Opt("scorpione", "♏ Scorpione", "Acqua", "Plutone", "fisso",
            pregi: ["intenso", "magnetico", "determinato", "profondo", "strategico", "leale"],
            ombre: ["vendicativo", "geloso", "manipolatore", "ossessivo", "diffidente", "rancoroso"],
            temi: ["una passione bruciante", "i conti in sospeso", "il bisogno di controllo", "un segreto da custodire", "una gelosia da gestire"]),
        Opt("sagittario", "♐ Sagittario", "Fuoco", "Giove", "mobile",
            pregi: ["ottimista", "avventuroso", "sincero", "generoso", "entusiasta", "libero"],
            ombre: ["esagerato", "incoerente", "invadente", "imprudente", "sbadato", "dispersivo"],
            temi: ["la voglia di partire", "una promessa esagerata", "l'orizzonte da conquistare", "un biglietto da prenotare", "una scommessa avventata"]),
        Opt("capricorno", "♑ Capricorno", "Terra", "Saturno", "cardinale",
            pregi: ["ambizioso", "rigoroso", "tenace", "responsabile", "concreto", "disciplinato"],
            ombre: ["freddo", "cinico", "rigido", "opportunista", "arido", "tirchio"],
            temi: ["la scalata al successo", "il dovere prima di tutto", "un obiettivo a lungo termine", "una responsabilità in più", "la reputazione da difendere"]),
        Opt("acquario", "♒ Acquario", "Aria", "Urano", "fisso",
            pregi: ["originale", "altruista", "indipendente", "geniale", "visionario", "tollerante"],
            ombre: ["distaccato", "ribelle", "imprevedibile", "snob", "freddo", "polemico"],
            temi: ["un'idea rivoluzionaria", "la libertà a ogni costo", "il gruppo di amici", "una causa da abbracciare", "una stranezza da rivendicare"]),
        Opt("pesci", "♓ Pesci", "Acqua", "Nettuno", "mobile",
            pregi: ["sensibile", "empatico", "creativo", "sognatore", "gentile", "fantasioso"],
            ombre: ["confuso", "vittimista", "sfuggente", "pasticcione", "indolente", "lagnoso"],
            temi: ["un sogno da inseguire", "la fuga dalla realtà", "l'empatia che travolge", "un'emozione che ti travolge", "una scusa poetica da inventare"]),
    ]);

    /// <summary>Costruisce l'opzione di un segno: cornice solare fissa + pool caratteriali del segno.
    /// Il nome porta già il simbolo zodiacale ("♈ Ariete"): fa da etichetta della dropdown e, essendo
    /// il valore del seed <c>segno</c>, compare direttamente nel testo finale ovunque c'è il segno.</summary>
    private static GeneratorVariantOption Opt(
        string key, string nome, string elemento, string pianeta, string qualita,
        IReadOnlyList<string> pregi, IReadOnlyList<string> ombre, IReadOnlyList<string> temi)
        => new(key, nome, new Dictionary<string, IReadOnlyList<string>>
        {
            ["segno"] = [nome],
            ["elemento"] = [elemento],
            ["pianeta"] = [pianeta],
            ["qualita"] = [qualita],
            ["pregio"] = pregi,
            ["ombra"] = ombre,
            ["tema"] = temi,
        });
}
