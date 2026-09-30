using Nome = Backend.Generators.SharedContent.Nome;
using City = Backend.Generators.SharedContent.City;
using Social = Backend.Generators.SharedContent.Social;
using TimeSlot = Backend.Generators.SharedContent.TimeSlot;
using Giorni = Backend.Generators.SharedContent.Giorni;
using Parente = Backend.Generators.SharedContent.Parente;
using Professioni = Backend.Generators.SharedContent.Professioni;

namespace Backend.Generators.Catalog;

public sealed class ExGenerator : GeneratorBase
{
    // Posti "appartati": ogni voce porta già la preposizione (come i Luoghi di ComplottoGenerator),
    // così {Luoghi} si usa nudo in posizione di complemento mai come soggetto di una frase.
    internal static readonly Tag Luoghi = new("luoghi_ex")
    {
        new($"in un bar chiamato «{Genera("locali")}» a {City.Any} dove non prende il telefono, così ci concentriamo su di noi", 4),
        new($"nel parco giochi dove andavi da bambina, «ci sono i bambini, cosa vuoi che succeda»", 4),
        ("a casa mia, «tanto i vicini a quest'ora dormono, e c'è il divano nuovo»", 4),
        ("sotto casa tua, in macchina con le luci spente «così risparmio la batteria»", 5),
        new($"in un locale di {City.Any} trovato su Google Maps cercando \"posti isolati\", odio il rumore", 5),
        new($"nel parcheggio del centro commerciale di {City.Any} dove ci siamo lasciati, ma stavolta alle {TimeSlot.Notte}", 4),
        new($"in un bar chiamato «{Genera("locali")}» a {City.Any} dove lavora {Nome.M}, un mio amico, così ho già un testimone", 4),
        ("sotto casa tua, con la scusa di restituirti una felpa", 5),
        ("in un posto \"neutro\" che ti dirò solo all'ultimo, per email di sicurezza", 3),
        ("nel retro del locale dove ci siamo conosciuti, chiuso apposta per noi", 4),
        new($"su un sentiero del parco di {City.Any}, senza telecamere, a me le telecamere mettono ansia", 5),
    };

    // Le formule di invito che incorporano il luogo problematico per variare la chiusura.
    internal static readonly Tag Inviti = new("inviti_ex")
    {
        new($"Ti prego, vediamoci {Luoghi}", 5),
        new($"Dai, vieni {Luoghi}", 5),
        new($"Ho bisogno di guardarti negli occhi, ti aspetto {Luoghi}", 5),
        new($"Non ce la faccio più a stare così, raggiungimi {Luoghi}", 5),
        new($"Ti scongiuro, ci vediamo {Luoghi}", 5),
        new($"Sto malissimo, ti prego vieni {Luoghi}", 5),
        new($"Solo {10..20} minuti, non ti chiedo altro. Vediamoci {Luoghi}", 5),
        new($"Dimostrami che un po' ci tieni ancora, fatti trovare {Luoghi}", 5),
        new($"Ho un nodo allo stomaco, ti prego raggiungimi {Luoghi}", 5),
        new($"Se mi vuoi ancora un minimo di bene, ci vediamo {Luoghi}", 5),
        new($"L'unico modo per farmi stare meglio è vederti {Luoghi}", 5),
        new($"Chiudiamo questa storia di persona, ti aspetto {Luoghi}", 5),
    };

    // I "torti" e le loro "scusanti": due tag che si combinano in {Scuse} ("torto, ma scusante"), il cuore
    // del messaggio. Un torto è quello che ho fatto, senza giustificazione e senza punto finale: tossico e
    // verosimile ma mai violento, mai una voce alzata o un gesto fisico (il detto non deve poter triggerare
    // chi ci è passato: qui si ridicolizza il PATTERN, non la situazione; il non detto fa il resto). La
    // scusante è il motivo egoista, sempre al passato in prima persona e senza "quel giorno" (i torti
    // durano anche più giorni), così regge dopo un connettivo, dopo "solo perché" e dopo i due punti.
    // I tradimenti restano voci intere in {Scuse}, dove la parte stupida è già dentro.
    // Vanno dichiarati PRIMA di {Scuse}: gli inizializzatori statici girano nell'ordine del file.
    internal static readonly Tag Torti = new("torti_ex")
    {
        new($"Ti ho bloccata ovunque per {3..9} mesi"),
        "Ti ho lasciata fuori di casa",
        new($"Ti ho tolto la parola per {3..9} giorni"),
        "Ho controllato i tuoi messaggi mentre dormivi",
        "Mi sono arrabbiato con te davanti ai tuoi amici",
        new($"Ti ho svegliata alle {TimeSlot.Notte} per litigare"),
        "Ho detto ai tuoi amici che eri instabile",
        "Ho buttato via le tue piante",
        "Ti ho fatto la cacca sul letto",
        "Ho cambiato la password del Wi-Fi mentre eri fuori",
        "Ti ho fatto sentire in colpa per aver visto la tua amica",
        "Non ti ho parlato per tutto il viaggio in macchina",
        new($"Ho dimenticato il tuo compleanno {2..4} anni di fila"),
        "Ti ho ghostata il giorno dopo averti chiesto di trasferirti per me",
        "Mi sono tenuto il tuo gatto dopo la rottura",
        "Ti ho chiamata con il nome della mia ex",
        "Ti ho lasciata sola alla cena dei tuoi",
        new($"Ho rimandato la nostra vacanza {2..4} volte"),
    };

    internal static readonly Tag Scusanti = new("scusanti_ex")
    {
        "ero stanco morto",
        "stavo giocando ai videogiochi e non potevo mettere in pausa",
        "avevo una scadenza al lavoro",
        "avevo dormito poco",
        "c'era la partita e lo sai come sono fatto",
        "mi avevi messo ansia con quel tono",
        "pensavo avessi capito da sola",
        "stavo finendo un livello, mancava pochissimo",
        "non pensavo ci tenessi così tanto",
        "ero nel mezzo di una cosa importante",
        "ero arrabbiato",
        "mi avevi provocato",
        "lo facevo per il tuo bene",
        "mi sembrava la cosa giusta in quel momento",
        "nessuno mi ascolta mai come vorrei",
        "mi hai fatto perdere la pazienza",
        "ci tenevo troppo a te",
    };

    // Il connettivo avversativo: solo quelli che reggono qualunque scusante (niente "anche se", "tuttavia").
    internal static readonly Tag Ma = new("ma_ex") { "ma", "però", "solo che", "ma la verità è che" };

    // Le "scuse": sproporzionate per costruzione, mai un motivo plausibile e basta. Due registri: l'assurdo
    // che un manipolatore potrebbe comunque giustificare (il gatto, il compleanno) e i meccanismi
    // riconoscibili (minimizzare, rovesciare la colpa, sorvegliare "per preoccupazione", isolare). Frasi complete in
    // prima persona: si usano SOLE, mai spezzate a metà da un predicato che segue.
    internal static readonly Tag Scuse = new("scuse_ex")
    {
        ("Ti ho tradita mentre eri in ospedale, ma ero stressato: la palestra aveva cambiato gli orari", 6),
        ("Ho detto a tutti gli amici comuni che la pazza eri tu, solo perché avevi messo il latte prima dei cereali", 5),
        new($"Ho messo like alla proposta di matrimonio di {Nome.F}, la mia nuova storia, mentre ti scrivevo di notte", 5),
        new($"Ho venduto il nostro gatto senza dirtelo e per {2..4} anni ho detto che era scappato", 5),
        new($"Ho dimenticato il tuo compleanno {2..4} anni di fila e ora me ne pento su {Social.Any.Fissato}, con {5..9} slide", 4),
        new($"Ho raccontato agli amici comuni che la vittima sono io, per {6..14} mesi", 5),
        new($"Ho controllato i tuoi movimenti su {Social.Any.Fissato} da un profilo falso, dicendoti di essermi \"fatto una vita\"", 6),
        ("Ho chiesto scusa alla ex prima di te, e a quella prima ancora, con lo stesso messaggio", 6),
        ("Sì, ti ho urlato contro, ma solo perché sei entrata in un negozio senza di me", 6),
        new($"Se ti sei sentita soffocata è come l'hai vissuta tu: ti chiamavo solo {4..9} volte al giorno, per amore", 6),
        ("Ho controllato il tuo telefono solo perché temevo che ti si scaricasse la batteria", 6),
        ("Quelle amiche non ti vogliono bene come me, e una di loro non si toglie la giacca a tavola", 5),
        // Torto + scusante: le forme si alternano, i due tag danno le combinazioni.
        new($"{Torti}, {Ma} {Scusanti}", 6),
        new($"{Torti} solo perché {Scusanti}", 6),
        new($"{Torti}, ma non è colpa mia: {Scusanti}", 6),
        new($"{Torti}, ma {Scusanti}, quindi tecnicamente siamo pari", 6),
        new($"{Torti}: {Scusanti}, e non mi sembra una cosa così grave", 6),
        new($"{Torti}. Sì, lo so, {Ma} {Scusanti}", 6),
        new($"{Torti}, {Ma} {Scusanti}, e comunque ne abbiamo già parlato", 6),
        new($"{Torti}, {Ma} {Scusanti}, e mi hai pure fatto sentire in colpa", 6),
        new($"{Torti}. Lo so, {Ma} {Scusanti}", 6),
    };

    // Escalation da disperato: la preghiera, l'esclusività ("nessuno ti capirà come me") e il ricatto emotivo. Frasi complete in prima persona.
    internal static readonly Tag Preghiera = new("preghiera_ex")
    {
        ("Ti prego in ginocchio, non ti chiedo altro", 5),
        ("Ti prego in ginocchio, ho pure acceso una candela in chiesa stamattina", 5),
        new($"Ho chiesto la benedizione di don {Nome.M} apposta per questo messaggio", 5),
        new($"Ti scongiuro sulla tomba di mio {Parente.Anziano.M} (che sta benissimo, l'ho sentito ieri)", 5),
        ("Ho fatto una novena di nove giorni solo per trovare il coraggio di scriverti", 4),
        ("Ho acceso un cero per ogni mese di silenzio, ormai in chiesa mi conoscono di vista", 4),
        ("Ho giurato a Dio che se rispondi cambio vita da domani", 4),
        new($"Giuro sulla Madonna che stavolta è diverso, come le altre {3..6} volte", 5),
        new($"Ho giurato al prete di smettere di controllarti su {Social.Any.Fissato}, appena mi rispondi", 5),
        ("Nessuno ti capirà mai come ti capisco io, nemmeno il tuo dentista", 6),
        ("Da quando te ne sei andata non riesco più a lavorare, ho dimenticato come si usa la stampante", 5),
        ("Non so cosa faccio se anche tu mi lasci, l'ultima volta ho comprato un canotto", 5),
        ("Non ti chiedo di rispondere subito, ti chiedo solo di guardare i tre puntini che scrivo da un'ora", 5),
        ("Se non vuoi parlarmi metti almeno un cuore, così stanotte dormo", 5),
        ("Mi basta un tuo vocale, anche di dieci secondi, anche per insultarmi", 5),
        ("Ho già scritto la risposta che vorrei da te: devi solo copiarla e mandarla", 5),
        ("Senza di te il mio oroscopo non ha più senso, e io all'oroscopo credo", 4),
        new($"Ho riascoltato la nostra canzone {5..20} volte di fila, i vicini hanno protestato", 5),
    };

    // Buoni propositi che durano il tempo di scriverli: il "sono cambiato" smontato dal dettaglio.
    // Frasi complete in prima persona.
    internal static readonly Tag Promesse = new("promesse_ex")
    {
        ("Giuro che mi sono iscritto in terapia (una seduta finora, ma conta)", 5),
        new($"Mi sono iscritto in palestra per diventare l'uomo che meriti: ci sono andato {2..3} volte, l'abbonamento dura {6..12} mesi", 4),
        ("Ho cancellato il numero di tutte le altre (tranne quelle nel cloud, quelle non contano)", 6),
        new($"Prometto che stavolta ti ascolto davvero, come le altre {2..5} volte", 5),
        ("Ho buttato la felpa \"non sono tossico\" per dimostrarti che sono cambiato", 5),
        new($"Ho iniziato un libro sull'amore consapevole: sono a pagina {3..12}", 4),
        new($"Ho smesso di controllarti su {Social.Any.Fissato}, te lo scrivo tre minuti dopo aver guardato il tuo ultimo post", 6),
        ("Ho fatto una lista dei miei difetti e l'ho postata con #crescitapersonale", 5),
        ("Ho disinstallato l'app di incontri (l'ho reinstallata dopo un'ora, per vedere se funzionava ancora)", 5),
        ("Ho iniziato a meditare: dieci secondi, poi ho riguardato i tuoi post", 5),
        ("Ho smesso di bere, tranne nei weekend, alle feste e quando penso a te", 5),
        ("Ho scritto sul frigo \"sii una persona migliore\" e mi sono ricordato di leggerlo una volta", 5),
        new($"Ho preso una pianta per imparare a prendermi cura di qualcuno: dopo {2..6} giorni era già secca", 5),
        ("Ho tolto il tuo nome dal mio nickname, ora c'è solo la tua iniziale", 4),
    };

    // Chi gli fa da megafono: la manipolazione funziona meglio con un pubblico che la convalida.
    // Descrizioni della persona (soggetto), non frasi complete: usate come soggetto di un piccolo
    // complemento ("parlane con {Testimoni}"): mai con "a", le preposizioni articolate non si compongono.
    internal static readonly Tag Testimoni = new("testimoni_ex")
    {
        ("mia madre, già pronta a sostenere che sei stata tu a rovinare tutto", 5),
        ("il mio migliore amico, pronto a confermare qualunque cosa io dica", 5),
        ("mia sorella, che nel gruppo di famiglia ti ha già definita \"quella difficile\"", 5),
        new($"un {Professioni.M} conosciuto da {2..4} settimane, ma già aggiornato su tutta la nostra storia", 4),
        ("il barista del bar sotto casa mia, che mi consola ogni sera con la stessa identica versione", 4),
        new($"mio {Parente.Anziano.M}, che va in terapia da anni e mi ha dato un \"parere spassionato\"", 5),
        ("il gruppo di chat dei miei amici, che vota se devo scriverti o no", 5),
        new($"il terapeuta di mio {Parente.Pari.M}, sentito una volta per un \"parere spassionato\"", 4),
    };

    // Le ammissioni di controllo: mai un metodo vero, solo il dettaglio patetico che si autodenuncia.
    // Frasi complete in prima persona.
    internal static readonly Tag SegnaliControllo = new("segnali_controllo_ex")
    {
        ("Ho chiesto a tua madre il tuo nuovo indirizzo, solo per mandarti un fiore", 6),
        new($"So che {Giorni.Any.Fissato} esci: ho visto il commento dell'amica di un'amica", 5),
        ("Ho salvato le tue foto in una cartella \"ricordi\", ordinata per data", 5),
        new($"Ho controllato il tuo ultimo accesso {4..14} volte al giorno, è solo curiosità", 5),
        new($"Ho visto la tua nuova foto profilo su {Social.Any.Fissato} e ci ho scritto una poesia", 5),
        new($"So a che ora esci dal lavoro: me l'hai detto tu, {2..3} anni fa", 5),
        ("Ho un promemoria per ogni nostro anniversario, anche quelli festeggiati da solo", 4),
    };

    // Concetti che ricorrono in liste diverse (Scuse, Preghiera, Promesse, SegnaliControllo, Testimoni):
    // se due pezzi del messaggio dicono la stessa cosa con parole appena diverse, il testo suona come un
    // elenco generato e non come uno sfogo vero. Ognuno può comparire una volta sola nel testo finale.
    // Le voci dello stesso concetto condividono apposta la radice, così l'etichetta le prende tutte:
    // "controll" (sorvegliare: controllarti / ho controllato), "terapia", "iur" (giuro / giurato),
    // "amic". Scrivendo una voce nuova su uno di questi temi, riusa la stessa parola.
    // I social: {Social.Any.Fissato} tiene la stessa piattaforma in tutto il testo, e i nomi dei brand come
    // etichette fanno sì che venga citata una volta sola (l'etichetta sul solo tag non regge dentro un Tag annidato).
    public override List<Etichetta>? UniqueLabels { get; } =
        ["Instagram", "TikTok", "Facebook", "Twitter", "LinkedIn", "YouTube", "WhatsApp", "Telegram", "Snapchat",
         "Reddit", "Twitch", "Pinterest", "controll", "storia", "amic", "madre", "profilo", "foto",
         "terapia", "iur", "ma conta", "chiesto", "in colpa"];

    // APERTURE DELLE FRASI CORE: prima erano frasi fisse dentro il template, quindi ogni volta che il template
    // usciva (1 testo su 7) usciva identica anche lei (fino a 140 volte su 800). Ora sono tag con più
    // formulazioni dello stesso gesto: cambia la riga, non l'intenzione. Frasi complete in prima persona,
    // senza punto finale (lo mette il template). Niente radici delle UniqueLabels (controll, amic, iur…).
    internal static readonly Tag Rassicurazione = new("rassicurazione_ex")
    {
        ("Tranquilla, non ti preoccupare", 5),
        ("Non devi avere paura, sono calmissimo", 5),
        ("Sono tranquillo, non è una scenata", 5),
        ("Respira, non è niente di grave", 5),
    };

    internal static readonly Tag Rilettura = new("rilettura_ex")
    {
        ("Ho riletto tutte le nostre chat, dalla prima", 5),
        new($"Alle {TimeSlot.Notte} mi sono riletto le nostre chat, una per una", 5),
        ("Mi sono riletto tutto quello che ci siamo scritti, senza saltare niente", 5),
        ("Ho scorso le nostre chat fino al primo messaggio, quello col \"ciao\"", 5),
    };

    internal static readonly Tag Merito = new("merito_ex")
    {
        ("Per questo credo di meritare una seconda possibilità", 5),
        ("Per questo penso di meritare un'altra occasione", 5),
        ("Dopo tutto questo direi che una seconda possibilità me la sono guadagnata", 5),
    };

    internal static readonly Tag NonChiedo = new("non_chiedo_ex")
    {
        ("Non ti chiedo di tornare insieme", 5),
        ("Non pretendo che torniamo insieme", 5),
        ("Non è per rimetterci insieme, è solo per parlare", 5),
        ("Non voglio tornare con te, sia chiaro: voglio solo vederti", 5),
    };

    internal static readonly Tag Eccezione = new("eccezione_ex")
    {
        ("Non è da me chiedere scusa, ma per te faccio un'eccezione", 5),
        ("Io non chiedo mai scusa, ma con te faccio uno strappo", 5),
        ("Di solito non mi scuso, ma tu sei un caso a parte", 5),
        ("Scusarmi non è nel mio stile, però stavolta lo faccio", 5),
    };

    internal static readonly Tag Riparare = new("riparare_ex")
    {
        ("Voglio solo riparare", 5),
        ("Voglio solo sistemare le cose", 5),
        ("Voglio solo rimettere a posto quello che ho rotto", 5),
        ("Voglio solo rimediare", 5),
    };

    internal static readonly Tag Colpa = new("colpa_ex")
    {
        ("È colpa tua se sono uscito con la tua migliore amica: mi hai abbandonato tu, sparendo senza avvisarmi", 5),
        ("Se ho scritto a quella collega è perché tu non mi hai risposto per un'ora intera", 5),
        ("Non è colpa mia se mi sono presentato al tuo corso di yoga: mi hai bloccato ovunque, cos'altro potevo fare", 5),
        ("Se ho pianto in pubblico è perché mi hai lasciato senza un vero motivo, cioè il mio", 5),
    };

    internal static readonly Tag Conoscenza = new("conoscenza_ex")
    {
        ("Tu mi conosci meglio di chiunque altro", 5),
        ("Nessuno mi capisce come mi capisci tu", 5),
        ("Con te non ho mai dovuto fingere, lo sai", 5),
        ("Tu sai chi sono davvero, meglio di tutti", 5),
    };

    /// <inheritdoc />
    public override string Slug => "ex";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new()
    {
        Name = "Il ritorno dell'ex",
        Description = "Messaggi di ex tossici che sono romantici. circa.",
    };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new()
    {
        // Impostiamo il minimo (e massimo) a 2 frasi: il motore pescherà due comportamenti tossici distinti dal Core.
        MinPhrases = 2,
        MaxPhrases = 2,
        Separators = [". ", ".\n", ".\n\n"],
        MinScore = 10,
    };

    /// <inheritdoc />
    public override Frase? Apertura => new($"Scusa se ti scrivo, {Nome.F}\n");

    /// <inheritdoc />
    public override Frase? Chiusura =>
        // Spostiamo la richiesta di incontro qui, rendendola strutturalmente OBBLIGATORIA e variabile.
        new($"\n\n{Inviti}.\n\n*(scritto alle {TimeSlot.Notte}, salvato nelle bozze {3..7} volte prima di premere invio)*");

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        // Il Core ora si concentra solo su giustificazioni e manipolazioni. 
        // Con MinPhrases=2, verranno combinate due di queste frasi, creando il classico "muro di testo" delirante,
        // per poi chiudersi sempre con l'invito obbligatorio della Chiusura.
        new($"{Scuse}. {Promesse}", 6),
        new($"{Rassicurazione}. {Scuse}. Se non mi credi parlane con {Testimoni}", 6),
        new($"{SegnaliControllo}. {Riparare}. {Scuse}", 6),
        new($"{Promesse}. {Scuse}. {Preghiera}", 6),
        new($"{Rilettura}. {Scuse}. {Promesse}. {Merito}", 5),
        new($"{Scuse}. {NonChiedo}. {Testimoni} sa che sarà l'ultima volta", 6),
        new($"{SegnaliControllo}. {Scuse}. Se non mi credi, parlane con {Testimoni}", 6),
        new($"{Scuse}. {Preghiera}. Ho tempo {Giorni.Any.Fissato}", 5),
        new($"{Eccezione}. {Scuse}. {Promesse}", 6),
        new($"Su {Social.Any.Fissato} ho visto che {Giorni.Any.Fissato} sei uscita con delle amiche. {Scuse}. Ti ho scritto una lettera di {2..4} pagine che voglio leggerti di persona", 6),
        new($"{Conoscenza}. {Scuse}, lo ammetto. {Promesse}", 5),
        new($"Non dormo da {3..10} giorni pensando a noi. {SegnaliControllo}. {Scuse}", 5),
        new($"Se non rispondi capirò che {2..7} anni insieme non ti importano più. {Scuse}. {Preghiera}", 5),
        new($"Se non rispondi capirò che non ti importa più niente di quello che abbiamo passato insieme per {2..7} anni (l'ho scritto anche sotto al tuo ultimo post su {Social.Any.Fissato}, tanto per sicurezza, e {Testimoni} ha messo like)", 5),
        new($"Ho parlato con uno psicologo (una volta, ma conta): dice che soffrire così tanto è normale. {Scuse}. {Promesse}, e {Testimoni} era in sala d'attesa e conferma", 6),
        new($"Ho già prenotato {Luoghi} per dopodomani e ho pure avvisato {Testimoni}, nel caso ti serva un secondo parere. {Promesse}", 6),
        new($"A {City.Any} c'è un posticino che mi hai detto ti piaceva: {Testimoni} dice che dovrei portarti lì. {Preghiera}", 5),
        new($"{Colpa}. {Scuse}. {Promesse}", 5),
        new($"{Promesse}. Se non mi credi chiedi pure a {Testimoni}", 6),
        new($"{Preghiera}. {Promesse}. {Testimoni} può confermartelo", 5),
        new($"{Rassicurazione}. {SegnaliControllo}. {Preghiera}", 5),
    ];
}
