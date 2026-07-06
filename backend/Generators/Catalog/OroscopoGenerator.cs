
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
    // Iniziale MINUSCOLA: apre sempre una frase, la maiuscola la rimette l'armonizzatore dopo ". "
    // e a inizio testo; dopo "; " resta minuscola (corretto in italiano).
    internal static readonly Tag Ambito = new("ambito")
    {
        "in amore", "sul lavoro", "con i soldi", "in famiglia", "con gli amici",
        "in salute", "a letto", "con la dieta", "sui social", "con il capo",
        "con il partner", "in palestra", "con i parenti", "nel traffico",
        "con l'ex", "in vacanza", "con il vicino di casa", "alla riunione di condominio",
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
        ("andrà così così, ma con un certo stile", 2),
        ("poco da segnalare, e per una volta ci sta", 2),
        ("meglio soprassedere", 2),
        ("tutto tace, sospettosamente", 2),
        ("nulla di irreparabile, per ora", 2),
        ("le stelle consigliano di restare a letto e fingersi irreperibile", 2),
        ("arriva una svolta che, come da tradizione, ignorerai", 2),
        ("qualcuno ti deluderà con la puntualità di un orologio svizzero", 2),
        ("una spesa imprevista si farà viva col suo solito tempismo impeccabile", 2),
        ("riceverai un messaggio che leggerai senza mai rispondere", 2),
        ("il tuo capo fingerà di apprezzarti fino alle 18:00", 3),
        ("meglio non prendere decisioni, e nemmeno alzarsi", 2),
        ("l'universo cospira, ma con scarsa organizzazione", 3),
        ("qualcosa andrà un filo storto, ma nessuno se ne accorgerà", 2),
        ("troverai la forza di rimandare tutto a domani", 2),
        ("il destino bussa, ma tu sei sotto la doccia", 3),
        ("giornata ideale per litigare su un gruppo WhatsApp", 2),
        ("un vecchio amico ti scriverà solo per venderti qualcosa", 4),
        ("scoprirai di aver ragione, ma con giorni di ritardo", 3),
        ("un imprevisto ti salverà da un impegno che detestavi", 3),
        ("la pazienza verrà messa alla prova da una fila alle poste", 2),
        ("ti verrà voglia di cambiare vita, poi passerà entro pranzo", 3),
        new($"un impegno ti aspetta al {Giorni.Any} della {Ordinale} settimana e fingerai di averlo già in agenda", 3),
        new($"al {Giorni.Any} della {Ordinale} settimana dovrai dare una risposta che continuerai a rimandare", 3),
        ("un concatenarsi di piccoli imprevisti, all'apparenza slegati, cospirerà per farti arrivare tardi proprio dove non volevi andare", 5),
        ("qualcuno di solito affidabile oggi si prende, senza preavviso, un giorno di ferie dall'esserlo", 4),
        ("qualcuno userà la tua password del Wi-Fi senza nemmeno ringraziare", 6),
        ("rimpiangerai un carrello abbandonato tre mesi fa, con rimorso", 6),
        new($"una notifica ti rovinerà l'unica giornata perfetta del mese, guarda caso al {Giorni.Any} della {Ordinale} settimana", 7),
        ("accadrà un non-evento di cui, giustamente, non ti accorgerai", 3),
        ("succederà qualcosa, oppure no", 3),
        ("qualcosa andrà inaspettatamente bene: approfittane prima che se ne accorgano", 3),
        ("una piccola vittoria è in arrivo, festeggiala prima che arrivi la fattura", 3),
        ("il buonumore ti coglie di sorpresa a metà giornata: non fartelo scappare", 3),
        ("oggi hai un certo magnetismo, sprecalo in cose meravigliosamente inutili", 3),
        ("ti capiterà una coincidenza fortunata: fai finta di essertela meritata", 3),
    };

    // Consigli delle stelle: imperativi che vanno a chiudere la frase; iniziale minuscola e niente
    // punto finale (li mette il motore). Punteggio = rarità: i più scontati pesano 1, i più arguti/
    // meta pesano di più (compaiono meno e alzano il ★).
    internal static readonly Tag Consiglio = new("consiglio")
    {
        "evita le decisioni importanti, e pure quelle stupide",
        "non fidarti di chi ti offre da bere",
        "rimanda tutto a lunedì, tanto peggiora comunque",
        ("metti giù il telefono e affronta la vita. O almeno il telefono", 3),
        "sorridi: confonde i nemici e i creditori",
        ("respira. Poi respira ancora. Poi torna a letto", 3),
        "fidati dell'istinto, tanto sbaglia con eleganza",
        "investi in pazienza: rende poco ma è gratis",
        ("occhio a chi ti dà ragione troppo in fretta", 2),
        ("bevi acqua: le stelle non sanno cos'altro dirti", 5),
        "se ti chiedono un favore, ricordati di essere impegnatissimo",
        ("non rispondere a freddo: rispondi proprio male", 3),
        ("fai finta di niente, funziona nel sessanta per cento dei casi", 4),
        "rimanda la palestra: c'è tempo fino al prossimo lunedì",
        ("non prendere impegni che superino le ventiquattro ore", 2),
        ("conta fino a dieci, poi manda comunque quel messaggio", 3),
        ("diffida degli entusiasmi, soprattutto i tuoi", 4),
        ("spegni le notifiche e accendi il cervello. O viceversa", 3),
        // Accattivanti: complici e affettuosi, con un filo d'ironia.
        ("concediti qualcosa di buono: in fondo te lo sei quasi meritato", 3),
        ("fatti un complimento da solo, tanto oggi non lo farà nessun altro", 3),
        ("fidati di te, una volta ogni tanto: che male vuoi che faccia", 3),
        // Corte, secche.
        "lascia stare",
        "rimanda",
        ("fidati poco", 2),
        // Lunga.
        ("prima di rispondere rileggi, rifletti, rimanda di un'ora e poi sbaglia comunque: almeno sarà una tua scelta consapevole", 4),
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

    internal static readonly Tag TipoMolesto = new("tipo-molesto")
    {
        new($"un {Professioni.M} che ti spiega cose che sai già", 2),
        new($"un certo {Nome.M} che risponde ‘a tutti’ alle mail aziendali", 3),
        new($"una {Parente.F} che ti chiede di nuovo quando ti sposi", 2),
        new($"un certo {Nome.M} che ti parla di criptovalute a cena", 2),
        new($"il collega {Nome.M} che dice ‘buttiamo giù due righe’", 3),
        new($"la {Parente.Anziano.F} {Nome.F} che ti manda un vocale di {3..8} minuti per dire ‘ok’", 3),
        new($"{Nome.Any} che ti aggiunge a un gruppo senza chiedere", 2),
        new($"una {Professioni.F} che spiega il tuo lavoro a te", 3),
        new($"un certo {Nome.M} che mette le quattro frecce e parcheggia dove gli pare", 3),
        new($"il vicino {Nome.M} che trapana la domenica alle otto di mattina", 2),
        new($"un tale conosciuto su {Social.Any} che scrive ‘ciao come va?’ e poi sparisce", 4),
        new($"{Nome.Any} che ti dice ‘te l'avevo detto’ senza avertelo mai detto", 3),
        new($"un {Professioni.M} che risponde alla domanda che non hai fatto", 2),
    };

    // La fuffa astrologica, ma sgonfiata: frasi quasi complete, con iniziale minuscola (tranne i nomi
    // propri dei pianeti) e senza punto finale — apertura e chiusura le sistema il motore.
    internal static readonly Tag PseudoMistico = new("pseudo-mistico")
    {
        ("Mercurio retrogrado ti darà l'alibi perfetto per non combinare niente", 3),
        ("l'allineamento dei pianeti coincide, guarda caso, con la tua pigrizia", 3),
        ("Venere in dissonanza ti autorizza ufficialmente a ignorare i messaggi", 3),
        ("Saturno ti impartisce una lezione che ignorerai come le precedenti", 3),
        ("l'energia cosmica di oggi è quella di un martedì qualunque", 2),
        ("le stelle sono allineate; tu un po' meno", 3),
        ("Giove ti sorride, ma con l'aria di chi ha fretta", 2),
        ("la Luna è nel tuo segno: non significa niente, ma suona bene", 3),
        ("il tuo ascendente oggi rema contro, come del resto tutto il resto", 3),
        // Surreali: fuffa cosmica portata all'assurdo, col nesso volutamente assente. Niente gergo da iniziati.
        ("oggi entri in una dimensione parallela quasi identica a questa, ma con più code alle casse", 3),
        ("gli astri hanno allineato tutto tranne te, come un'equazione a cui manca il risultato", 3),
        ("Plutone ti manda un messaggio, ma nella lingua sbagliata: illeggibile, eppure profondamente sentito", 4),
        ("la Luna oggi è storta: suggestiva, ma non farci troppo affidamento", 3),
    };

    internal static readonly Tag Surreale = new("surreale")
    {
        ("le stelle oggi non parlano: fissano il muro", 4),
        ("Mercurio non è retrogrado, è solo uscito a comprare le sigarette e non è più tornato", 4),
        ("il tuo ascendente odierno è una sedia di plastica dimenticata sotto la pioggia", 4),
        ("oggi raggiungi l'apice del successo, ma soltanto agli occhi di un piccione", 5),
        ("l'universo ha rifatto i conti sul tuo futuro e il risultato non è un numero, è un rumore", 5),
        ("qualcosa di rotondo e cosmico rotola verso di te da tre giorni; oggi, guarda caso, ti raggiunge", 5),
        ("il frigorifero ti osserva e, come sempre, non approva", 4),
        ("le tue finanze oggi scendono, ma con grande eleganza", 4),
        ("qualcosa che vive nel tuo armadio ha espresso un parere; ignoralo con affetto", 4),
        ("oggi annuisci a tutto senza capire niente, e va benissimo così", 3),
        ("gli astri hanno scritto un'equazione sul tuo mese; purtroppo mancano metà dei simboli", 4),
        ("qualcosa di gassato ti solleverà il morale, ma solo per dieci minuti", 4),
        ("qualcuno, in una vecchia fotografia, veglia su di te; qualunque cosa accada, non chiedergli aiuto", 5),
        ("il destino ti aveva preparato una sorpresa, poi se ne è dimenticato", 4),
    };

    // Entità assurde ma QUOTIDIANE, usate come SOGGETTO (o dopo i due punti): niente articoli da
    // articolare a runtime, così la concordanza non si rompe mai. Riconoscibili da chiunque (oggetti e
    // animali di tutti i giorni portati nell'assurdo), non riferimenti di nicchia. Iniziale MINUSCOLA:
    // a metà frase ("c'è {Entita}", "è {Entita}") resta minuscola; a inizio frase la maiuscola la mette
    // l'armonizzatore — così non escono più "C'è La bolletta…" a metà periodo.
    internal static readonly Tag Entita = new("entita")
    {
        "un piccione che conosce il tuo PIN", "una sedia da giardino sotto la pioggia",
        "il tuo io delle tre di notte", "una zanzara con un piano preciso", "il tostapane di casa tua",
        "un lampione che ti segue con lo sguardo", "la bolletta del gas ormai senziente",
        "un gatto che non è il tuo", "il calzino che ti manca da marzo",
        "una pianta che sa più cose di te", "il vicino che non hai mai visto in faccia",
        "un carrello della spesa con la ruota impazzita", "la spia della benzina accesa da tre giorni",
        "la tua sveglia con intenzioni proprie", "un ascensore che si ferma sempre al piano sbagliato",
        "il pensiero che avevi dieci minuti fa", "una raccomandata che non ritirerai mai",
    };

    internal static readonly Tag Fenomeno = new("fenomeno")
    {
        "sparisce un calzino in lavatrice", "hai un déjà-vu", "il pane cade dal lato imburrato",
        "i semafori diventano rossi appena hai fretta", "la fila che lasci diventa la più veloce",
        "ti svegli un minuto prima della sveglia", "le chiavi non sono dove le avevi lasciate",
        "una parola ti resta sulla punta della lingua", "il Wi-Fi cade sul più bello",
        "il telecomando sparisce tra i cuscini del divano", "entri in una stanza e dimentichi perché",
        "gli auricolari si annodano da soli in tasca", "guardi l'orologio esattamente alle 11:11",
        "pensi a qualcuno e ti arriva un suo messaggio", "il carrello va per conto suo",
        "perdi il segnale proprio in ascensore",
    };

    // Meccanismo = sintagma nominale che regge dopo "è …" (mai dopo preposizione, così non si articola a
    // runtime). Un concetto per voce. Tono "generalista": cause assurde ma capibili da chiunque, niente
    // gergo tecnico da iniziati — solo un pizzico di sapore cosmico pop.
    internal static readonly Tag Meccanismo = new("meccanismo")
    {
        "un piccolo scherzo dell'universo", "una giornata storta delle stelle",
        "colpa di Mercurio, come al solito", "l'universo che fa un po' di manutenzione",
        "un aggiornamento scaricato di notte", "il solito dispetto del destino",
        "un errore di battitura del cosmo", "la fisica che oggi ha chiuso prima",
        "il karma che si riorganizza", "un déjà-vu dell'universo",
        "il caso che si diverte alle tue spalle", "una svista degli astri",
        "la solita legge di Murphy in azione", "il cosmo che sta ancora caricando",
        "Saturno in modalità risparmio energetico", "il pilota automatico che si è disinserito",
        "la realtà che si è distratta un attimo", "un reset della matrice quantica",
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
    // 3-5 previsioni cucite in un unico paragrafo con ". " / "; " (come gli altri due generatori
    // "grandi": niente più una-frase-per-riga). La punteggiatura tra le frasi la mette il motore, per
    // questo le frasi NON portano il punto finale e hanno l'iniziale minuscola (tranne i nomi propri):
    // l'armonizzatore rimette la maiuscola dopo ". " e a inizio testo, ma NON dopo "; ".
    // MinScore = pavimento di rarità: se una composizione pesa meno, il motore la ri-rolla (tenendo
    // la migliore, fino a un tetto di tentativi) — così un oroscopo non esce mai "piatto". Il tetto
    // resta libero: le previsioni "gemma" fanno comunque schizzare in alto il ★.
    public override GenerationSettings? PhraseSettings { get; } = new()
    {
        MinPhrases = 3,
        MaxPhrases = 5,
        Separators = [". ", "; "],
        MinScore = 14,
    };

    /// <inheritdoc />
    // Intestazione con la data di oggi (seed dinamico condiviso) e la cornice solare AUTENTICA del segno
    // (fissata dai Seeds). Non concorre al punteggio (è apertura).
    public override Frase? Apertura { get; } =
        new($"**Oroscopo del {DataOggi.Any.Fissato} per il segno {Segno.Fissato}**\n\n_{Elemento.Fissato}, con {Pianeta.Fissato} a fare il bello e il cattivo tempo. Allora, vediamo un po'…_\n\n");

    /// <inheritdoc />
    public override Frase? Chiusura { get; } =
        new($".\n\n_**Qualità:** {Qualita.Fissato}_");

    /// <inheritdoc />
    // Frase "di carattere" del segno GARANTITA: una per oroscopo (Min=Max=1), iniettata prima del
    // riempimento generico, così ogni oroscopo aggancia sempre pregio/ombra/tema/qualità del segno e
    // "sa di oroscopo" invece di ridursi a previsioni assurde buone per qualunque segno. Vivono QUI e
    // non nel Core apposta: nel Core (scelta uniforme) potrebbero non uscire mai, o uscirne due insieme.
    public override RequiredInjectData? CoreRequired { get; } = new(1, 1,
    [
        new($"diciamocelo, da {Segno.Fissato} sei {Pregio.Fissato} — su questo non si discute — solo che oggi ti scappa fuori il lato {Ombra.Fissato}", 4),
        new($"roba da {Elemento.Fissato}, la tua: il lato {Pregio.Fissato} oggi esce facile, ma quello {Ombra.Fissato} è sempre lì dietro l'angolo", 4),
        new($"{Pianeta.Fissato} oggi ti rema un po' contro — e sai com'è quando si mette di traverso — così salta su il lato {Ombra.Fissato}", 4),
        new($"{Pianeta.Fissato}, per una volta, gioca dalla tua parte: quel lato {Pregio.Fissato} oggi lavora per te", 3),
        new($"il nodo della giornata, per te {Segno.Fissato}, è tutto lì: {Tema.Fissato}", 3),
        new($"in fondo sei un {Qualita.Fissato}, e certe cose un {Qualita.Fissato} le sente arrivare: oggi ti tira dritto verso {Tema.Fissato}", 3),
        new($"da bravo {Segno.Fissato}, oggi sei {Pregio.Fissato} e {Ombra.Fissato} nel giro di mezz'ora — e va bene così", 4),
        new($"sotto sotto sei di {Elemento.Fissato}, e si vede: oggi un po' {Pregio.Fissato}, un po' {Ombra.Fissato}, come al solito", 3),
    ]);

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        new($"{Ambito}, {Previsione}", 2),
        new($"{Ambito}, {Previsione}; {Consiglio}", 3),
        new($"{Ambito}, {Previsione}", 2),
        new($"{Previsione}. Nient'altro", 2),                                      // corta, secca
        new($"{Ambito}, {Previsione}, e come se non bastasse {Previsione}", 3),    // lunga, doppia previsione
        new($"{Ambito}, una collega di nome {Nome.F} ti metterà in difficoltà senza accorgersene", 3),
        new($"occhio a un {Professioni.M} conosciuto su {Social.Any}: {Previsione}", 3),
        new($"occhio a una {Professioni.F} conosciuta su {Social.Any}: {Previsione}", 3),
        new($"ti verrà voglia di una gita a {City.Any}, e poi niente, la rimanderai come tutto il resto", 3),
        new($"{Giorni.Any} è il giorno giusto per NON rispondere a {Nome.M}", 3),
        new($"le stelle vedono un piatto di {Piatti.Any} e un rimorso lungo la strada per {City.Any}", 3),
        new($"una {Parente.F} ti chiederà notizie che non hai voglia di dare", 2),
        new($"un {Parente.M} ti darà una lezione di vita che non avevi chiesto", 2),
        new($"un {Professioni.M} di {Eta.Cresciuto} anni ti darà un consiglio pessimo: seguilo pure", 4),
        new($"una {Professioni.F} di {Eta.Cresciuto} anni ti darà un consiglio pessimo: seguilo pure", 4),
        new($"numeri fortunati: {1..90} e {1..90}. Non ci prenderai comunque", 2),
        new($"attenzione agli acquisti d'impulso su {Marketplace.Any}: {Nome.M} lo scoprirà", 3),
        new($"le stelle prevedono una sfiga precisa: oggi {Sventura}", 4),
        new($"{Ambito}, oggi {Sventura}", 3),
        new($"e occhio, perché {Sventura} — e gli astri, in tutto questo, ti fanno pata pat", 4),
        new($"oggi incrocerai {TipoMolesto}: sorridi e sopravvivi", 4),
        new($"attenzione a {TipoMolesto}; gli astri, per la cronaca, tifano per te ma un po' distrattamente", 4),
        new($"{PseudoMistico}", 3),
        new($"{PseudoMistico}. {Consiglio}", 4),
        new($"{Surreale}", 3),
        new($"{Surreale}. {Consiglio}", 4),
        new($"da {Segno.Fissato} oggi la giornata prende una piega strana: {Surreale}", 4),
        new($"presenza astrale del giorno: {Entita}. Trattala con il dovuto sospetto", 3),
        new($"{Entita} veglia su di te e, come da tradizione, non muoverà un dito", 3),
        new($"oggi il tuo spirito guida è {Entita}: buona fortuna con questo", 3),
        new($"attenzione: {Entita} ha lasciato una recensione a una stella sul tuo mese", 3),
        new($"{Entita} ti ha inserito nei suoi piani, ed è questa la parte preoccupante", 3),
        new($"oggi un ruolo chiave nella tua giornata lo gioca {Entita}. Non chiedere come", 3),
        new($"le stelle oggi ti affidano a una guida speciale: {Entita}", 3),
        new($"{Entita} compare due volte nel tuo tema astrale, e nessuno sa spiegare perché", 3),
        new($"c'è {Entita} tra te e una giornata tranquilla", 3),
        new($"se oggi {Fenomeno}, non è colpa tua: è {Meccanismo}", 3),
        new($"non allarmarti se {Fenomeno}: è soltanto {Meccanismo}", 3),
        new($"{Fenomeno}? Nessun mistero: è {Meccanismo}", 3),

        // ── Chiusure-consiglio ──
        new($"il consiglio degli astri: {Consiglio}", 2),
        new($"{Previsione}. {Consiglio}", 2),
    ];

    /// <inheritdoc />
    // La scelta offerta prima di generare: i 12 segni. Ognuno = una COMBINAZIONE di due liste che si
    // sovrappongono tra segni: i tratti dell'ELEMENTO (Fuoco/Terra/Aria/Acqua) + quelli della QUALITÀ
    // (cardinale/fisso/mobile). Così due segni di Fuoco condividono i pregi "di fuoco", due cardinali i
    // temi "cardinali": niente 12 etichette rigide, ma pool che si intrecciano (come la tradizione per
    // triplicità/quadruplicità), con una punta di satira nelle ombre. La cornice solare (elemento/
    // pianeta/qualità) resta comunque REALE e coerente col segno.
    public override GeneratorVariant? Variant { get; } = new("segno", "Segno zodiacale",
    [
        Opt("ariete", "Ariete", "Fuoco", "Marte", "cardinale"),
        Opt("toro", "Toro", "Terra", "Venere", "fisso"),
        Opt("gemelli", "Gemelli", "Aria", "Mercurio", "mobile"),
        Opt("cancro", "Cancro", "Acqua", "Luna", "cardinale"),
        Opt("leone", "Leone", "Fuoco", "Sole", "fisso"),
        Opt("vergine", "Vergine", "Terra", "Mercurio", "mobile"),
        Opt("bilancia", "Bilancia", "Aria", "Venere", "cardinale"),
        Opt("scorpione", "Scorpione", "Acqua", "Plutone", "fisso"),
        Opt("sagittario", "Sagittario", "Fuoco", "Giove", "mobile"),
        Opt("capricorno", "Capricorno", "Terra", "Saturno", "cardinale"),
        Opt("acquario", "Acquario", "Aria", "Urano", "fisso"),
        Opt("pesci", "Pesci", "Acqua", "Nettuno", "mobile"),
    ]);

    // ── Vocabolari CONDIVISI dei tratti: ogni segno pesca dalla COMBINAZIONE elemento + qualità, così i
    // pool si sovrappongono tra segni invece di essere 12 insiemi separati. Nessuna parola compare sia
    // nella lista-elemento sia nella lista-qualità che si accoppiano in uno stesso segno (niente doppioni
    // interni). Pregi/ombre = aggettivi maschili (resa da oroscopo); temi = sintagmi nominali.
    private static readonly Dictionary<string, string[]> PregiElemento = new()
    {
        ["Fuoco"] = ["coraggioso", "passionale", "energico", "intraprendente", "generoso", "magnetico"],
        ["Terra"] = ["concreto", "affidabile", "paziente", "pratico", "leale", "sensato"],
        ["Aria"] = ["brillante", "socievole", "curioso", "arguto", "versatile", "comunicativo"],
        ["Acqua"] = ["empatico", "sensibile", "intuitivo", "profondo", "premuroso", "creativo"],
    };
    private static readonly Dictionary<string, string[]> PregiQualita = new()
    {
        ["cardinale"] = ["deciso", "trascinante", "ambizioso", "pieno di iniziativa"],
        ["fisso"] = ["costante", "fedele", "tenace", "incrollabile"],
        ["mobile"] = ["adattabile", "flessibile", "poliedrico", "elastico"],
    };
    private static readonly Dictionary<string, string[]> OmbreElemento = new()
    {
        ["Fuoco"] = ["impulsivo", "egocentrico", "permaloso", "irascibile", "esagerato", "prepotente"],
        ["Terra"] = ["testardo", "abitudinario", "pigro", "materialista", "diffidente", "tirchio"],
        ["Aria"] = ["distratto", "incostante", "chiacchierone", "indeciso", "sbadato", "polemico"],
        ["Acqua"] = ["lunatico", "permaloso", "vittimista", "apprensivo", "ombroso", "malinconico"],
    };
    private static readonly Dictionary<string, string[]> OmbreQualita = new()
    {
        ["cardinale"] = ["impaziente", "autoritario", "invadente", "dominante"],
        ["fisso"] = ["cocciuto", "possessivo", "inflessibile", "ostinato"],
        ["mobile"] = ["volubile", "dispersivo", "imprevedibile", "sfuggente"],
    };
    private static readonly Dictionary<string, string[]> TemiElemento = new()
    {
        ["Fuoco"] = ["una sfida da vincere a tutti i costi", "la voglia di primeggiare", "un entusiasmo da tenere a bada", "un applauso che aspetti da giorni"],
        ["Terra"] = ["la ricerca di un po' di sicurezza", "il piacere delle cose concrete", "un conto da far quadrare", "la comoda abitudine di sempre"],
        ["Aria"] = ["mille idee lasciate a metà", "una conversazione da chiudere", "la curiosità che ti distrae", "un contatto da riallacciare"],
        ["Acqua"] = ["un'emozione che ti travolge", "un affetto da coltivare", "un ricordo che riaffiora", "il bisogno di sentirti al sicuro"],
    };
    private static readonly Dictionary<string, string[]> TemiQualita = new()
    {
        ["cardinale"] = ["qualcosa da iniziare proprio oggi", "una decisione da prendere per primo", "un progetto da lanciare"],
        ["fisso"] = ["qualcosa a cui non vuoi rinunciare", "una posizione da difendere", "un'abitudine da proteggere"],
        ["mobile"] = ["un piano che cambia all'ultimo", "una via di fuga da tenere pronta", "un doppio impegno da incastrare"],
    };

    /// <summary>Costruisce l'opzione di un segno COMBINANDO le liste condivise di elemento e qualità: il
    /// pregio/ombra/tema del segno è l'unione dei due pool, così i tratti si sovrappongono tra segni (due
    /// segni di Fuoco condividono i pregi "di fuoco", due cardinali i temi "cardinali", …). Il nome porta
    /// già il simbolo zodiacale ("♈ Ariete") e, essendo il valore del seed <c>segno</c>, compare
    /// direttamente nel testo finale ovunque c'è il segno.</summary>
    private static GeneratorVariantOption Opt(string key, string nome, string elemento, string pianeta, string qualita)
        => new(key, nome, new Dictionary<string, IReadOnlyList<string>>
        {
            ["segno"] = [nome],
            ["elemento"] = [elemento],
            ["pianeta"] = [pianeta],
            ["qualita"] = [qualita],
            ["pregio"] = [.. PregiElemento[elemento], .. PregiQualita[qualita]],
            ["ombra"] = [.. OmbreElemento[elemento], .. OmbreQualita[qualita]],
            ["tema"] = [.. TemiElemento[elemento], .. TemiQualita[qualita]],
        });
}
