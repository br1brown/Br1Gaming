
// Alias tipizzati sui contenuti CONDIVISI: la stessa scorciatoia usata dagli altri generatori
// (es. Locali). Servono a "inquinare" le previsioni coi contenuti condivisi, come gli altri.
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
using TimeSlot = Backend.Generators.SharedContent.TimeSlot;

namespace Backend.Generators.Catalog;

/// <summary>
/// L'oroscopo demenziale: a differenza degli altri generatori, prima di generare si sceglie il
/// <b>segno</b> (la <see cref="Variant"/>). La scelta fissa la "cornice solare" con dati astrologici
/// VERI — segno, elemento, pianeta dominante, qualità (cardinale/fisso/mobile) — e pesca da POOL
/// caratteriali <b>del segno</b> (pregio/ombra/tema): tratti semanticamente in linea con la tradizione
/// (impianto alla Lisa Morpurgo), con qualche "ombra" volutamente discutibile. Il resto delle
/// previsioni è generico, pescato a caso e "inquinato" coi tag condivisi come gli altri generatori,
/// così due oroscopi non sono mai uguali. Il bersaglio satirico vero (<see cref="PrecisioneAssurda"/>)
/// è la pretesa dell'oroscopo stesso di sapere il futuro: l'astrologia finge vaghezza mistica, qui la
/// spingiamo all'estremo opposto — dettagli assurdamente esatti (un messaggio di 6 parole non 7, un
/// ritardo di 13 minuti non 14) detti con lo stesso tono dichiarativo e sicuro di sé di un vero
/// oroscopo (vena da "scienza esatta" alla Lisa Morpurgo, portata all'assurdo, non caricaturata). NIENTE
/// commento sulla propria precisione ("sospetta", "che nemmeno gli astri si aspettavano" ecc.): il
/// narratore non deve MAI strizzare l'occhio, altrimenti la battuta la fa lui al posto del lettore. Solo
/// su eventi VEROSIMILI — un incontro, un messaggio, una fila, un ritardo — mai su cifre disconnesse da
/// un evento reale (niente resto in contanti eccetera). Il contrasto tra verve realistica e contenuto
/// iper-specifico è tutta la battuta, e va lasciato muto.
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
    // "del mese" si dicono come "{giorno} della {ordinale} settimana" — es. "giovedì della terza
    // settimana". Il giorno è nudo (mai "al"/"il"): il genere di "domenica" non crea attriti.
    internal static readonly Tag Ordinale = new("ordinale") { "prima", "seconda", "terza", "quarta" };

    // Previsioni: predicati (minuscoli) che seguono un'apertura d'ambito. La LUNGHEZZA è mista di
    // proposito (corte secche, medie, lunghe): così i paragrafi dell'oroscopo non hanno tutti lo
    // stesso ritmo. I riferimenti temporali usano "{giorno} della {ordinale} settimana" (mai "al {giorno}").
    internal static readonly Tag Previsione = new("previsione")
    {
        ("andrà così così, ma con un certo stile", 2),
        ("poco da segnalare, e per una volta ci sta", 2),
        ("meglio soprassedere", 2),
        ("tutto tace, sospettosamente", 2),
        ("nulla di irreparabile, per ora", 2),
        ("le stelle consigliano di restare a letto e fingersi irreperibile", 2),
        ("arriva una svolta, o forse una conferma: dipende da come la leggi", 2),
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
        new($"un impegno ti aspetta {Giorni.Any} della {Ordinale} settimana: previsione sicura, ogni settimana ne ha uno", 3),
        new($"dovrai dare una risposta entro {Giorni.Any} della {Ordinale} settimana, ma continuerai a rimandare", 3),
        ("una serie di piccoli imprevisti cospirerà per farti arrivare tardi dove non volevi andare", 5),
        ("qualcuno di solito affidabile oggi si prende un giorno di ferie dall'esserlo", 4),
        ("qualcuno userà la tua password del Wi-Fi senza nemmeno ringraziare", 6),
        ("rimpiangerai un carrello abbandonato tre mesi fa", 6),
        new($"una notifica ti rovinerà l'unica giornata perfetta del mese: {Giorni.Any} della {Ordinale} settimana", 7),
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
        "fidati dell'istinto, ma anche del suo contrario: le stelle coprono entrambi i casi",
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
        ("fatti un complimento: gli oroscopi ne prevedono uno a fine giornata, per tutti i segni", 3),
        ("fidati di te, una volta ogni tanto: che male vuoi che faccia", 3),
        // Corte, secche.
        "lascia stare",
        "rimanda",
        ("fidati poco", 2),
        // Lunga.
        ("prima di rispondere rileggi e rimanda di un'ora, poi sbaglia comunque: sarà almeno una scelta tua", 4),
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
        new($"il barista {Nome.M} ti darà tutto il resto in monetine", 2),
        new($"un {Professioni.M} ti rifilerà l'ennesimo ‘ci pensiamo e ti facciamo sapere’", 3),
        new($"il collega {Nome.M} rimetterà in discussione una cosa decisa da settimane", 2),
        new($"a {City.Any} ti toccherà il carrello con la ruota impazzita", 2),
        new($"il gruppo WhatsApp del condominio si accenderà proprio di {Giorni.Any}", 3),
        new($"scoprirai una spesa ricorrente su {Marketplace.Any} che giuravi di aver disdetto", 3),
        new($"prenderai tutti i semafori rossi verso {City.Any}, ma solo quando hai fretta", 2),
        new($"l'ombrello si romperà al primo colpo di vento, puntuale come ogni {Giorni.Any}", 2),
    };

    internal static readonly Tag TipoMolesto = new("tipo-molesto")
    {
        new($"un {Professioni.M} che ti spiega cose che sai già", 2),
        new($"{Nome.M}, quello che risponde ‘a tutti’ alle mail aziendali", 3),
        new($"una {Parente.F} che ti chiede di nuovo quando ti sposi", 2),
        new($"{Nome.M}, che non perde occasione per parlarti di criptovalute a cena", 2),
        new($"il collega {Nome.M} che dice ‘buttiamo giù due righe’", 3),
        new($"la {Parente.Anziano.F} {Nome.F} che ti manda un vocale di {3..8} minuti per dire ‘ok’", 3),
        new($"{Nome.Any} che ti aggiunge a un gruppo senza chiedere", 2),
        new($"una {Professioni.F} che spiega il tuo lavoro a te", 3),
        new($"{Nome.M}, che mette le quattro frecce e parcheggia dove gli pare", 3),
        new($"il vicino {Nome.M} che trapana la domenica alle otto di mattina", 2),
        new($"un tale conosciuto su {Social.Any} che scrive ‘ciao come va?’ e poi sparisce", 4),
        new($"{Nome.Any} che ti dice ‘te l'avevo detto’ senza avertelo mai detto", 3),
        new($"un {Professioni.M} che risponde alla domanda che non hai fatto", 2),
    };

    // NB: qui viveva "PseudoMistico" — la fuffa astrologica ammessa come tale ("guarda caso", "non
    // significa niente, ma suona bene"): un narratore che sgonfia l'astrologia ammiccando al lettore.
    // Rimosso perché in contrasto diretto con {PrecisioneAssurda}, che funziona SOLO se il narratore
    // non ammette mai che sta esagerando. {Surreale} sotto resta: è assurdo ma mai auto-ironico — non
    // smaschera l'astrologia, la prende sul serio anche quando descrive un piccione o un frigorifero.
    internal static readonly Tag Surreale = new("surreale")
    {
        ("le stelle oggi non parlano: fissano il muro", 4),
        ("Mercurio non è retrogrado, è solo uscito a comprare le sigarette e non è più tornato", 4),
        ("il tuo ascendente odierno è una sedia di plastica dimenticata sotto la pioggia", 4),
        ("oggi raggiungi l'apice del successo, ma soltanto agli occhi di un piccione", 5),
        ("l'universo ha rifatto i conti sul tuo futuro e il risultato non è un numero, è un rumore", 5),
        ("qualcosa di rotondo e cosmico rotola verso di te da tre giorni, e oggi ti raggiunge", 5),
        ("il frigorifero ti osserva e, come sempre, non approva", 4),
        ("le tue finanze oggi scendono, ma con grande eleganza", 4),
        ("qualcosa che vive nel tuo armadio ha espresso un parere: ignoralo con affetto", 4),
        ("oggi annuisci a tutto senza capire niente, e va benissimo così", 3),
        ("gli astri hanno scritto un'equazione sul tuo mese, ma mancano metà dei simboli", 4),
        ("qualcosa di gassato ti solleverà il morale, ma solo per dieci minuti", 4),
        ("qualcuno in una vecchia fotografia veglia su di te: non chiedergli aiuto", 5),
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

    // ── La finta precisione: il bersaglio VERO dell'oroscopo. L'astrologia finge vaghezza mistica
    // ("le stelle ti guidano"); qui la spingiamo all'estremo opposto — dettagli assurdamente esatti
    // su cose del tutto irrilevanti (il resto al centesimo, il messaggio contato parola per parola,
    // l'incontro calcolato al minuto). La battuta è tutta nella specificità, mai dichiarata: nessuna
    // riga dice "è ridicolo essere così precisi" — lo sente da solo chi legge. ──
    internal static readonly Tag PrecisioneAssurda = new("precisione-assurda")
    {
        new($"{Giorni.Any} {Nome.M} ti scriverà esattamente {3..9} parole, non una di più", 5),
        new($"{Nome.F}, {Eta.Cresciuto} anni, {Professioni.F}, ti dirà una frase di esattamente {4..11} parole che ricorderai per vent'anni", 6),
        new($"alle {TimeSlot.Notte} il telefono vibrerà per esattamente {2..5} notifiche, tutte inutili", 5),
        new($"tra esattamente {3..21} giorni un {Professioni.M} di {Eta.Giovane} anni dirà una parola che ti farà pensare per {2..4} ore", 6),
        new($"a {City.Any} farai la fila per esattamente {2..12} minuti", 5),
        new($"a {City.Any} incrocerai {Nome.M} in una finestra di {5..15} minuti", 6),
        new($"il tuo umore seguirà una curva esatta: alto alle {TimeSlot.Mattina}, basso alle {TimeSlot.Pomeriggio}, piatto per il resto della giornata", 5),
        new($"un {Parente.M} arriverà con esattamente {5..20} minuti di ritardo", 5),
        new($"oggi risparmierai esattamente {2..40} minuti evitando una conversazione che non sapevi di dover fare", 5),
        new($"su {Marketplace.Any} troverai un'offerta scontata del {5..40}%, valida ancora per {2..6} minuti esatti", 5),
        new($"un {Parente.M} ti chiamerà per una cosa che durerà esattamente {2..7} minuti", 5),
    };

    // Il meccanismo Barnum: affermazioni che chiunque riconosce come proprie, al presente o al futuro,
    // sempre in seconda persona e con iniziale minuscola (reggono dopo ", " e dopo "con X in questa
    // posizione, "). La comicità sta nel fatto che vanno bene per ogni segno, non in chi le legge.
    internal static readonly Tag Barnum = new("barnum")
    {
        "a volte hai bisogno che gli altri ti apprezzino, e a volte preferisci non ammetterlo",
        "hai un grande potenziale che non hai ancora usato del tutto",
        "tendi a essere più severo con te stesso di quanto meriti",
        "c'è qualcosa che vorresti cambiare, ma non oggi",
        "sei socievole e riservato in proporzioni che variano a seconda dell'ora",
        "una decisione ti aspetta, e sarà giusta o sbagliata a seconda di come andrà",
        "un cambiamento è in arrivo, oppure si conferma che non arriva",
        "hai idee chiare su quasi tutto, tranne su quello che conta",
    };

    // La stessa cosa detta in più modi: chiusure che ribadiscono la frase precedente senza aggiungere nulla.
    internal static readonly Tag Riformulazione = new("riformulazione")
    {
        "detto in altre parole, dipende",
        "in sostanza: un po' sì e un po' no, come per tutti i segni",
        "ripeto, con parole diverse, così qualcuno ci si riconosce",
        "insomma, quello che avevi già capito da solo",
    };

    /// <inheritdoc />
    public override string Slug => "oroscopo";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new()
    {
        Order = 6,
        Name = "Oroscopo del Giorno",
        Description = "Scopri che giornata meravigliosa sarà oggi!",
    };

    /// <inheritdoc />
    // 3-5 previsioni cucite in un unico paragrafo con ". " / "; " (come gli altri due generatori
    // "grandi", non una frase per riga). La punteggiatura tra le frasi la mette il motore, per
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

    // La cornice solare (elemento + pianeta, sempre gli stessi per lo stesso segno) era incollata a una
    // SOLA frase fissa in apertura: generando lo stesso segno più volte usciva la riga identica ogni
    // volta. Un pool di formulazioni la rende "generata" anche se i due fatti astrologici restano fissi.
    internal static readonly Tag ColoreSegno = new("colore-segno")
    {
        new($"{Elemento.Fissato}, con {Pianeta.Fissato} a fare il bello e il cattivo tempo"),
        new($"Nel segno di {Elemento.Fissato}, oggi comanda {Pianeta.Fissato}"),
        new($"{Elemento.Fissato}, con {Pianeta.Fissato} che tira le fila"),
        new($"{Pianeta.Fissato} governa la giornata, in perfetto stile {Elemento.Fissato}"),
        new($"Oggi si respira {Elemento.Fissato}, e a comandare è {Pianeta.Fissato}"),
    };

    /// <inheritdoc />
    // Intestazione con la data di oggi (seed dinamico condiviso) e la cornice solare AUTENTICA del segno
    // (fissata dai Seeds). Non concorre al punteggio (è apertura).
    public override Frase? Apertura { get; } =
        new($"**Oroscopo del {DataOggi.Any.Fissato} per il segno {Segno.Fissato}**\n\n_{ColoreSegno}. Allora, vediamo un po'…_\n\n");

    /// <inheritdoc />
    // Niente più "Qualità: cardinale/fisso/mobile" in chiusura: è un'etichetta tecnica (la modalità
    // astrologica) che fuori dal giro non dice niente a nessuno, ed essendo fissa per segno non era
    // nemmeno "generata" — si ripeteva identica ogni volta. La qualità resta viva dentro CoreRequired
    // ("in fondo sei un {Qualita.Fissato}…"), dove almeno è incorniciata in una frase leggibile.
    public override Frase? Chiusura { get; } = ".";

    /// <inheritdoc />
    // Frase "di carattere" del segno GARANTITA: una per oroscopo (Min=Max=1), iniettata prima del
    // riempimento generico, così ogni oroscopo aggancia sempre pregio/ombra/tema/qualità del segno e
    // "sa di oroscopo" invece di ridursi a previsioni assurde buone per qualunque segno. Vivono QUI e
    // non nel Core apposta: nel Core (scelta uniforme) potrebbero non uscire mai, o uscirne due insieme.
    public override RequiredInjectData? CoreRequired { get; } = new(1, 1,
    [
        new($"da {Segno.Fissato} sei {Pregio.Fissato}, su questo non si discute; il problema è quel lato {Ombra.Fissato} che oggi salta fuori", 4),
        new($"roba da {Elemento.Fissato}, la tua: il tratto {Pregio.Fissato} oggi viene naturale, ma quello {Ombra.Fissato} resta lì, in agguato", 4),
        new($"{Pianeta.Fissato} oggi ti rema contro, punto; e quando succede, si vede subito quanto sei {Ombra.Fissato}", 4),
        new($"{Pianeta.Fissato}, per una volta, gioca dalla tua parte: il tuo lato {Pregio.Fissato} oggi lavora per te", 3),
        new($"il nodo della giornata, per te {Segno.Fissato}, è tutto lì: {Tema.Fissato}", 3),
        new($"in fondo sei un {Qualita.Fissato}, e certe cose un {Qualita.Fissato} le sente arrivare: oggi ti tira dritto verso {Tema.Fissato}", 3),
        new($"da bravo {Segno.Fissato}, oggi sei {Pregio.Fissato} e {Ombra.Fissato} nel giro di mezz'ora — e va bene così", 4),
        new($"sotto sotto sei di {Elemento.Fissato}, e si vede: oggi un po' {Pregio.Fissato}, un po' {Ombra.Fissato}, come al solito", 3),
    ]);

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        new($"{Ambito}, {Previsione}", 2),
        new($"{Ambito}, {Previsione}. Le stelle aggiungono un consiglio — {Consiglio}", 3),
        new($"{Ambito}, {Previsione}", 2),
        new($"{Previsione}. Nient'altro", 2),                                      // corta, secca
        new($"{Ambito}, {Previsione}", 3),                                          // ex "doppia previsione", spezzata:
        new($"{Previsione}", 3),                                                     // ogni Core ha un solo tag Previsione
        new($"{Ambito}, una collega di nome {Nome.F} ti metterà in difficoltà, senza accorgersene", 3),
        new($"occhio a un {Professioni.M} conosciuto su {Social.Any}. {Previsione}", 3),
        new($"occhio a una {Professioni.F} conosciuta su {Social.Any}. {Previsione}", 3),
        new($"ti verrà voglia di una gita verso {City.Any}, ma la rimanderai come tutto il resto", 3),
        new($"{Giorni.Any} è il giorno giusto per lasciare {Nome.M} senza risposta", 3),
        new($"le stelle vedono un {Piatti.M} e un rimorso lungo la strada per {City.Any}", 3),
        new($"lungo la strada per {City.Any} ti aspettano una {Piatti.F} e un rimorso, come da previsione", 3),
        new($"una {Parente.F} ti chiederà notizie che non hai voglia di dare", 2),
        new($"un {Parente.M} ti darà una lezione di vita che non avevi chiesto", 2),
        new($"un {Professioni.M} di {Eta.Cresciuto} anni ti darà un consiglio valido per chiunque: seguilo pure, vale anche per te", 4),
        new($"l'unico consiglio utile di oggi lo darà una {Professioni.F} di {Eta.Cresciuto} anni: vale per chiunque, quindi anche per te", 4),

        // ── Barnum: frasi buone per tutti i segni, dette con la stessa sicurezza di quelle su misura ──
        new($"{Ambito}, {Barnum}", 3),
        new($"{Barnum}. {Riformulazione}", 3),
        new($"{Barnum}. Vale per oggi, per domani e per {Giorni.Any} della {Ordinale} settimana", 3),
        new($"con {Pianeta.Fissato} in questa posizione, {Barnum}", 3),
        new($"{Barnum}: {Pianeta.Fissato} lo ripete a tutti i segni, ma a te con particolare convinzione", 4),
        new($"numeri fortunati: {1..90} e {1..90}. Non ci prenderai comunque", 2),
        new($"attenzione agli acquisti d'impulso su {Marketplace.Any}: {Nome.M} lo scoprirà", 3),
        new($"le stelle prevedono una sfiga precisa: oggi {Sventura}", 4),
        new($"{Ambito}, sarà una giornata storta: {Sventura}", 3),
        new($"occhio, perché {Sventura}", 4),
        new($"oggi incrocerai {TipoMolesto}: sorridi e sopravvivi", 4),
        new($"attenzione: oggi c'è {TipoMolesto}. Gli astri tifano per te, ma distrattamente", 4),
        new($"{Surreale}", 3),
        new($"{Surreale}. Il consiglio, a questo punto — {Consiglio}", 4),
        new($"da {Segno.Fissato} oggi la giornata prende una piega strana. {Surreale}", 4),
        new($"presenza astrale del giorno: {Entita}. Diffida a prescindere", 3),
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

        // ── La finta precisione: {PrecisioneAssurda} è già una frase completa e autosufficiente ──
        new($"{PrecisioneAssurda}", 5),
        new($"questo è certo: {PrecisioneAssurda}", 4),

        // ── Chiusure-consiglio ──
        new($"il consiglio degli astri — {Consiglio}", 2),
        new($"{Previsione}. Come rimedio, le stelle suggeriscono — {Consiglio}", 2),
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
