
// Alias tipizzati per i contenuti condivisi: niente stringhe magiche nei segnaposto.
using City = Backend.Generators.SharedContent.City;
using Cognome = Backend.Generators.SharedContent.Cognome;
using Eta = Backend.Generators.SharedContent.Eta;
using Gruppi = Backend.Generators.SharedContent.Gruppi;
using Nome = Backend.Generators.SharedContent.Nome;
using Parente = Backend.Generators.SharedContent.Parente;
using Piatti = Backend.Generators.SharedContent.Piatti;
using Professioni = Backend.Generators.SharedContent.Professioni;
using Social = Backend.Generators.SharedContent.Social;
using TimeSlot = Backend.Generators.SharedContent.TimeSlot;
using DateRangeSlot = Backend.Generators.SharedContent.DateRangeSlot;

namespace Backend.Generators.Catalog;

/// <summary>Maschio Bianco Etero Basico (MBEB). Fa da base per l'Incel, che lo dichiara in <c>ComposeWith</c>.</summary>
public sealed class MbebGenerator : GeneratorBase
{
    // Segnaposto del generatore, tipizzati. INTERNAL (non private) quelli che l'Incel — che compone
    // con questo master via ComposeWith — riusa per estendere le liste e citarle nelle sue frasi.
    internal static readonly Tag Donne = new("donne")
    {
        ("mogl... la sua ex moglie", 4),
        ("sua ex moglie", 3),
        ("madre", 2),
        new($"{Parente.Anziano.F} {Nome.F}", 3),
        new($"{Parente.Anziano.F}", 2),
        new($"{Parente.Pari.F}", 2),
        ("sua ragazza", 2),
        ("_‘sua donna’_", 2),
        ("sua ex-collega idealizzata", 3),
        new($"sua amica {Nome.F}", 3),
        ("sua prima compagna", 3),
        ("sua ultima fidanzata", 3),
        new($"sua vicina di casa {Nome.F}", 3),
        ("sua insegnante delle medie", 3),
        ("sua ex-fidanzata", 2),
        new($"ex-moglie del suo miglior amico", 4),
        new($"{Parente.Pari.F} del suo miglior amico, {Nome.F}", 4),
        // Mestieri al femminile (Professioni.F): la donna-oggetto ha anche un lavoro, usata come i mestieri
        // maschili del soggetto. Forme profession-neutre (nessun "del bar…") così concordano con qualunque
        // mestiere pescato; l'articolo lo mette il template ("la/dalla {Donne}", elisione dall'armonizzatore).
        new($"{Professioni.F} che lo ha ignorato", 3),
        new($"{Professioni.F} conosciuta su {Social.Any}", 3),
        new($"{Professioni.F} che non lo ha mai calcolato", 3),
        new($"{Professioni.F} che gli ha dato buca", 3),
    };

    internal static readonly Tag Idoli = new("idoli")
    {
        ("Elon Musk", 2),
        ("Sgarbi", 2),
        ("big Luca", 2),
        ("Marco Travaglio", 2),
        ("Povia", 2),
        ("Mario Giordano", 2),
        ("Diego Fusaro", 2),
        ("Gianluigi Paragone", 2),
        ("Bruno Vespa", 2),
        ("Vittorio Feltri", 2),
        ("Rita De Crescenzo", 2),
        ("Gerry Scotti", 2),
        ("il generale Vannacci", 3),
        ("quel tizio che fa i video sulle monete d'argento", 4),
        ("il suo commercialista", 2),
    };

    internal static readonly Tag Ossessioni = new("ossessioni")
    {
        ("Padel", 2),
        ("Fantacalcio", 2),
        ("grigliata della domenica", 3),
        ("automobili fighissime", 2),
        ("bei vecchi tempi", 3),
        ("calcetto con i colleghi", 3),
        ("birra artigianale", 2),
        new($"video di motori su {Social.Any}", 3),
        ("fai-da-te", 2),
        ("discorsi motivazionali", 2),
        ("il barbecue a gas da 400 euro usato tre volte l'anno", 4),
        ("le monete d'argento come bene rifugio", 3),
        ("il trapano avvitatore comprato al Brico", 3),
        ("il navigatore satellitare montato di traverso", 3),
        ("le previsioni del meteo dell'aeronautica", 3),
    };

    // Il "hating" è diviso per NATURA del bersaglio, così ogni frase pesca il tipo giusto e non crea
    // cortocircuiti: ‘A Morte [concetto]’ non deve mai uscire su una persona reale (diffamazione), e
    // "non è mica come [persona]" vuole un individuo, non una ZTL. {Hating} resta l'unione (l'"Any")
    // per le frasi generiche di sempre.
    // Persone REALI nominate: usare solo in contesti miti, MAI su liste nere / "a morte".
    internal static readonly Tag HatingPersone = new("hating-persone")
    {
        ("Fedez", 2),
        ("Chiara Ferragni", 2),
        ("Selvaggia Lucarelli", 2),
        ("Saviano", 2),
        ("Luciana Littizzetto", 2),
        ("Achille Lauro", 2),
        ("Alessandro Zan", 2),
        ("Elly Schlein", 2),
        ("Roberto Saviano", 2),
        ("Michela Murgia", 2),
        ("quello dei Måneskin con lo smalto", 3),
        ("Damiano dei Måneskin", 2),
        ("Greta Thunberg", 2),
        ("Chef Rubio", 2),
        ("il sindaco che ha messo la ZTL", 3),
    };

    // Categorie di persone (plurali): bersaglio collettivo, non un individuo.
    internal static readonly Tag HatingGruppi = new("hating-gruppi")
    {
        ("i ciclisti in mezzo alla strada", 3),
        ("i vegani", 2),
        ("chi paga il caffè col POS", 3),
        ("i giovani che non hanno voglia di lavorare", 3),
        ("quelli del reddito di cittadinanza", 3),
        ("i runner che corrono sul marciapiede", 3),
        ("i turisti che si fermano in cima alle scale mobili", 4),
        ("quelli che parcheggiano il SUV sulle strisce pedonali", 4),
        ("i camerieri che ti portano il conto col QR code", 4),
        ("quelli della raccolta differenziata coi sette bidoni", 4),
        ("i condòmini che si lamentano del barbecue sul balcone", 4),
        ("gli automobilisti della corsia di sinistra che vanno piano", 4),
        ("chi mette le stories con la musica in inglese", 4),
        ("quelli che ordinano la pizza con l'ananas", 3),
        ("i vigili che multano solo lui", 3),
    };

    // Concetti / cose / fenomeni: il bersaglio "sicuro" per i contesti aggressivi.
    internal static readonly Tag HatingConcetti = new("hating-concetti")
    {
        ("i monopattini elettrici", 3),
        ("il politicamente corretto", 3),
        ("la farina di insetti", 3),
        ("le auto elettriche", 3),
        ("la musica trap", 3),
        ("le ZTL", 2),
        ("le manifestazioni per il clima", 3),
        ("gli autovelox nascosti dietro i cespugli", 4),
        ("il bollo auto", 2),
        ("le rotonde messe a caso", 3),
        ("i pagamenti col POS sotto i cinque euro", 4),
        ("le piste ciclabili disegnate sui parcheggi", 4),
        ("la carne sintetica coltivata in laboratorio", 4),
        ("le etichette col semaforo sui cibi", 4),
        ("i corsi di formazione obbligatori sul lavoro", 4),
    };

    // Unione ("Any"): {Hating} = persone ∪ gruppi ∪ concetti. Il RuntimeBuilder la compone DOPO il merge
    // della catena, così le estensioni ai sottogruppi (anche dell'incel) rifluiscono qui automaticamente.
    internal static readonly Tag Hating = Tag.Unione("hating", HatingPersone, HatingGruppi, HatingConcetti);

    internal static readonly Tag DifettiSociali = new("difetti_sociali")
    {
        ("anti vegano", 2),
        ("omofobo", 2),
        ("transfobico", 2),
        ("complottista", 2),
        ("retrogrado", 2),
        ("sessista", 2),
        ("razzista", 2),
        ("bigotto", 2),
        ("indelicato", 2),
        ("senza cuore", 2),
        ("intollerante", 2),
        ("egoista", 2),
        ("aggressivo", 2),
        ("prepotente", 2),
        ("autoritario", 2),
        ("possessivo", 2),
    };

    internal static readonly Tag Vibes = new("vibes")
    {
        ("stronzo", 2),
        ("pessimista rabbioso", 2),
        ("insicuro cronico", 2),
        ("frustrato", 2),
        ("antipatico", 2),
        ("geloso", 2),
        ("permaloso", 2),
        ("rosicone", 2),
        ("saccente", 2),
        ("musone rancoroso", 3),
        ("boomer nell'anima", 3),
        ("borioso", 2),
        ("lamentoso", 2),
        ("perennemente incazzato", 3),
        ("permaloso col clacson facile", 3),
    };

    internal static readonly Tag Percezione = new("percezione")
    {
        ("divorziato attempato", 2),
        ("spaccafighe", 2),
        ("VIRILE (così dice lui... vabbé)", 4),
        ("navigatore in acque turbolente", 3),
        ("guerriero silenzioso", 2),
        ("gentile con tutti (ci tiene a rimarcarlo ogni volta quindi lo dico: sì gentile anche con i neri)", 4),
        ("eremita moderno", 2),
        ("ombra errante", 2),
        ("fortezza inespugnabile", 2),
        ("viandante solitario", 2),
        ("cavaliere senza armatura", 3),
        ("fenice taciturna", 2),
        ("mistero insondabile", 2),
        ("astro nascente celato", 3),
        ("solitarrio come isola deserta", 3),
        ("lupo solitario", 2),
    };

    internal static readonly Tag FrasiTipiche = new("frasi_tipiche")
    {
        ("le femministe esagerano, ci vuole il compromesso!", 3),
        ("vuoi la parità? allora paga anche tu al ristorante", 3),
        ("una volta le donne erano più femminili", 3),
        new($"non si può più dire niente senza offendere {HatingGruppi}", 4),
        ("stavo scherzando! non hai senso dell'umorismo", 3),
        ("la famiglia tradizionale funzionava meglio", 3),
        new($"se è ancora single a {34..45} anni, qualcosa non va", 4),
        ("uomo vero non piange", 3),
        ("io non ho nulla contro i gay, ma certe cose non le voglio vedere in giro", 3),
        ("io sono così, prendere o lasciare", 3),
        new($"la {Donne} era una vera donna, non come quelle di adesso", 4),
        new($"la {Donne} è come tutte le femmine: vogliono tutto ma poi non sanno cosa vogliono", 4),
        ("non è razzismo, è statistiche", 3),
        ("il problema è che oggi tutti si sentono vittime", 3),
        ("una volta si scherzava senza che nessuno si offendesse", 3),
    };

    // Solo commenti DAVVERO generici: appendibili a qualsiasi frase. I parentetici legati a un
    // contesto preciso (cucina/viaggi/palestra/frequenza post) vivono inline nella loro frase d'origine.
    internal static readonly Tag CommentiSprezzantiGenerici = new("commenti_sprezzanti_generici")
    {
        ("e lo hanno capito tutti", 3),
        ("pace all'anima sua", 3),
        new($"non è mica come {HatingPersone}", 3),
        ("ed è palesemente per compensare qualcosa", 3),
        ("come volevasi dimostrare", 3),
        ("e ci crede pure", 3),
        ("roba da chiamare un esorcista", 3),
        new($"e intanto dà la colpa a {Hating}", 3),
        ("e lo scrive pure nel gruppo di famiglia su WhatsApp", 3),
        new($"e ancora si chiede perché la {Donne} lo abbia lasciato", 3),
        ("cosa che ripete a chiunque abbia la sfortuna di sedersi accanto a lui", 3),
        ("e nemmeno il suo commercialista lo prende più sul serio", 3),
        ("e pretende pure gli si dia ragione", 3),
    };

    // Il grosso arriva dai piatti CONDIVISI (concordanza per genere garantita dalle liste);
    // i letterali coprono i casi che il template non può fare (elisioni, nomi fuori lista).
    internal static readonly Tag PiattiPerfetti = new("piatti_perfetti")
    {
        new($"il {Piatti.M} perfetto", 3),
        new($"la {Piatti.F} perfetta", 3),
        ("l'amatriciana perfetta", 3),
        ("la cacio e pepe perfetta", 3),
        ("il risotto perfetto", 3),
        ("il tiramisù perfetto", 3),
        ("la carbonara con la panna (che secondo lui è più cremosa)", 4),
        ("la grigliata cotta rigorosamente al sangue", 3),
        ("il ragù che deve sobbollire otto ore", 3),
        ("la pizza fatta in casa col forno di casa a 250 gradi", 4),
        ("la parmigiana come la faceva sua nonna", 3),
        ("il caffè con la moka stretta stretta", 3),
        ("la bistecca fiorentina da tre dita", 3),
        ("le lasagne con la besciamella comprata al supermercato", 4),
        new($"gli spaghetti aglio olio e peperoncino delle {TimeSlot.Notte}", 4),
    };

    // Cose banalissime del vivere quotidiano che lo mandano nel panico: lo stereotipo del basico
    // incapace di gestire da solo le interazioni più ordinarie. Voci in infinito così entrano in
    // qualsiasi template ("terrorizzato all'idea di...", "la sua più grande paura è...").
    internal static readonly Tag TerroriQuotidiani = new("terrori_quotidiani")
    {
        ("rispondere al cameriere che gli chiede se l'acqua la vuole liscia o gassata", 3),
        new($"interagire con la cassiera del supermercato di {City.Any}", 3),
        ("andare a fare la spesa senza le cuffie", 3),
        new($"rispondere a una telefonata da un numero sconosciuto (e se poi è la {Donne}?)", 3),
        new($"ordinare al _‘{Genera("locali").Fissato}’_ dopo aver ripetuto la frase {2..5} volte nella sua testa", 3),
        new($"chiedere lo scontrino al _‘{Genera("locali").Fissato}’_ di {City.Any}", 3),
        new($"prenotare una visita dalla dottoressa {Nome.F} {Cognome.Any} al telefono", 3),
        new($"restituire un capo in negozio senza la {Donne} che parla per lui", 3),
        new($"salutare il vicino {Nome.M} {Cognome.Any} in ascensore", 3),
        ("dire al barbiere come vuole i capelli (finisce sempre con _‘faccia lei’_)", 3),
        new($"attraversare il _‘{Genera("locali").Fissato}’_ pieno di gente per andare in bagno", 3),
        ("parlare con il commesso che gli chiede _‘ha bisogno di aiuto?’_", 3),
        ("farsi servire al banco della gastronomia e dover dire i grammi", 3),
        new($"dire _‘no, grazie’_ a chi gli porge un volantino in centro a {City.Any}", 3),
        new($"avviare la lavatrice senza chiedere alla {Donne}", 3),
        new($"fare la fila alle poste di {City.Any} e arrivare davvero allo sportello", 3),
        new($"mandare indietro un piatto al _‘{Genera("locali").Fissato}’_ perché non è come {PiattiPerfetti}", 3),
    };

    internal static readonly Tag MarcheOrologi = new("marche_orologi")
    {
        ("un Rolex", 3),
        ("un Patek Philippe", 3),
        ("un Audemars Piguet", 3),
        ("un Omega", 3),
        ("un Cartier", 3),
        ("un Hublot", 3),
        ("un Breitling", 3),
        ("un Tag Heuer", 3),
        ("un Panerai", 3),
        ("un Richard Mille", 3),
        ("un Daytona con la lista d'attesa di sei anni", 4),
        ("un Casio d'oro (come Fantozzi)", 3),
        ("uno Swatch che spaccia per svizzero di lusso", 4),
        ("un Festina preso all'autogrill", 3),
        ("un Rolex comprato dal marocchino in spiaggia", 4),
    };

    /// <summary>Scarpe di marca riconoscibili: concordano tutte con "una … usata".</summary>
    internal static readonly Tag Scarpe = new("scarpe")
    {
        "DrMartin", "Nike", "Converse", "Vans", "Superga", "Timberland", "New Balance", "Adidas",
        "Hogan", "Puma", "Reebok", "Geox che respira", "Lotto degli anni Novanta", "Diadora",
        "Nike taroccata comprata al mercato",
    };


    // Etichette uniche, stessa regola dei Tag: INTERNAL quelle che l'Incel dichiara a sua volta.
    // ("fetic" stava qui per errore: il contenuto feticista è dell'incel — l'ha scovato il boot-linter.)
    internal static readonly Etichetta Vanta = new("vanta");
    internal static readonly Etichetta Definisce = new("definisce");
    private static readonly Etichetta Dice = new("dice");

    /// <inheritdoc />
    public override string Slug => "mbeb";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 3, Name = "Generatore MBEB", Description = "Genera il tuo Maschio Bianco Etero Basico, ce n'è sempre uno in ogni gruppo Whatsapp" };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 2, MaxPhrases = 4, MinScore = 24, Separators = [". ", "; "] };

    /// <inheritdoc />
    public override Frase? Apertura => new($"## {Nome.M},\n");

    /// <inheritdoc />
    public override List<Etichetta>? UniqueLabels { get; } = [Vanta, Definisce, Dice];

    /// <inheritdoc />
    public override List<string>? ExclusiveGroups { get; } = [Gruppi.Identita, FrasiTipiche.Key, Donne.Key];

    // Piccole liste per dare una variante anche a due frasi altrimenti fisse (senza cambiarne il senso).
    internal static readonly Tag Sitcom = new("sitcom")
    {
        "Camera Café", "Zelig", "Colorado", "Boris", "Fantozzi",
        "Un Medico in Famiglia", "il Bagaglino", "Mai dire Gol", "Paperissima", "Striscia la Notizia",
        "il cinepanettone di Natale", "Vieni Avanti Cretino", "il TG satirico", "Don Matteo", "i Cesaroni",
    };
    internal static readonly Tag Sport = new("sport")
    {
        "le partite di calcio", "il fantacalcio", "la Serie A", "il calciomercato", "il derby",
        "il Fantacalcio dell'ufficio", "la moviola", "il VAR", "le partite di Champions", "la Nazionale",
        "il Motomondiale", "la Formula 1", "il ciclismo su pista", "la Serie B", "il calcetto del giovedì",
    };

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        new($"{Vibes} di {Eta.Cresciuto} anni", 2),
        new($"il perfetto ritratto di un hater di {Hating}, {Eta.Cresciuto}enne", 4),
        new($"si sveglia la mattina e manco se ne accorge di essere {DifettiSociali}, nemmeno sotto il {Social.Any} di {Idoli}", 6),
        new($"l'hanno bannato da {Social.Any} per hate speech, e lui, poverino, voleva solo dire _‘{FrasiTipiche}!’_", 6),
        new($"cresciuto a pane e padre {DifettiSociali}", 3),
        new($"si fa sottomettere da un'estetista di {16..25} anni di nome {Nome.F} {Cognome.Any}, o Miss {Nome.F}, con la promessa di fargli leccare una {Scarpe} usata", 7),
        new($"{Eta.Anziano} anni e, diciamo, una certa tendenza a essere {DifettiSociali}", 4),
        new($"e si vanta pure, su {Social.Any}, di essere {Vibes}", 4),
        new($"in cima alla lista nera, primo tra tutti, c'è: {HatingConcetti}", 4),
        new($"si vanta di essere alto ben 1.{65..84} cm — misurati con la postura tattica, eh, mica dritti", 7),
        new($"qualche amico l'ha perso per strada, e sai perché? perché è {DifettiSociali}", 4),
        new($"su {Social.Any} si è messo da solo l'etichetta _‘{Percezione}’_", 4),
        new($"cresciuto con un padre {DifettiSociali}", 3),
        new($"{Eta.Anziano}enne che, va beh, un pochino {DifettiSociali} lo è", 3),
        new($"a {City.Any} lo conoscono tutti, ma proprio tutti, per quant'è {DifettiSociali}", 5),
        new($"a {City.Any} non c'è uno che non sappia quant'è {DifettiSociali}", 5),
        new($"il suo buonumore? tutto lì: essere {DifettiSociali}", 4),
        new($"si dimostra sempre {DifettiSociali} su {Social.Any} (sì, quindi non solo con gli amici)", 7),
        new($"è il padre {DifettiSociali} che tutti temono", 3),
        new($"{Professioni.M.Fissato} di {Eta.Cresciuto} anni, decisamente {DifettiSociali}", 3),
        new($"{Professioni.M.Fissato} di mezza età (mezza età tipo {Eta.Anziano} anni), sempre e comunque {DifettiSociali} e {Vibes}", 7),
        new($"di {Eta.Anziano} anni, {Parente.Anziano.M} incredibilmente {DifettiSociali} e {Vibes}", 3),
        new($"il classico {Professioni.M.Fissato} {DifettiSociali}", 2),
        new($"ragazzino di {Eta.Minorenne} anni, già {DifettiSociali} nei commenti di {Hating}", 4),
        new($"_‘imprenditore’_ (è un {Professioni.M.Fissato} ma ci sta credendo anche lui... quindi...), già con il mindset da {DifettiSociali}", 8),
        new($"è un {Professioni.M.Fissato} {DifettiSociali} che nessuno sopporta", 3),
        new($"{Professioni.M.Fissato} che passa le giornate in piazza, {DifettiSociali} come non mai", 4),
        new($"{Professioni.M.Fissato} di {Eta.Anziano} anni, {DifettiSociali} all'estremo", 3),
        new($"il vicino di casa, un domani, agli inquirenti lo descriverà così: uno {Vibes}, ecco", 5),
        new($"{Vibes} che frequenta le superiori (poco importa abbia {Eta.Giovane} anni), già {DifettiSociali}, e non cerca nemmeno di migliorare il suo lato {DifettiSociali}", 7),
        new($"{Professioni.M.Fissato}, {DifettiSociali} fino al midollo", 3),
        new($"{Vibes} che frequenta le superiori (poco importa abbia {Eta.Giovane} anni)", 6),
        new($"{DifettiSociali} e {Vibes}", 2),
        new($"{Professioni.M.Fissato} di {Eta.Giovane} anni", 2),
        new($"e no, non ci prova neanche a limarlo un po', quel lato {DifettiSociali}", 3),
        new($"{Professioni.M.Fissato}, {DifettiSociali}, che guida tutto il giorno con il Reggaeton in auto (con il braccio fuori dal finestrino anche a dicembre per far vedere il tatuaggio a tema {Ossessioni} sbiadito sull'avambraccio)", 9),
        new($"{Professioni.M.Fissato} di {Eta.Anziano} anni", 2),
        new($"{Professioni.M.Fissato}, hater di {Hating} oltre ogni limite", 3),
        new($"{Professioni.M.Fissato}, {DifettiSociali} e cleptomane", 2),
        new($"{Vibes} di mezza età ({Eta.Adulto} anni), {DifettiSociali} senza vergogna", 3),
        new($"{Professioni.M.Fissato} che manco se lo ammette, di essere {DifettiSociali}", 3),
        new($"{Vibes}, fastidiosamente {DifettiSociali}", 2),
        new($"{Professioni.M.Fissato} di {Eta.Anziano} anni, {DifettiSociali}", 3),
        new($"{Professioni.M.Fissato} davvero {DifettiSociali}, ma almeno fa quadrare i conti dai", 4),
        new($"giovane {Professioni.M.Fissato} di {Eta.Giovane} anni, {DifettiSociali} senza precedenti", 3),
        new($"{Professioni.M.Fissato}, {DifettiSociali} al punto giusto", 3),
        new($"{Vibes} con un'attitudine da {DifettiSociali}", 3),
        new($"{DifettiSociali}, e con quel fare da {Vibes}", 3),
        new($"dà la colpa al mondo, ma il problema, guarda un po', è lui: {Vibes}", 4),
        new($"appena sente parlare di {Hating} comincia a sghignazzare per motivi che solo un {Vibes} trova divertenti (condividendo meme sgranatissimi nel gruppo WhatsApp _‘{FrasiTipiche} - {City.Any}’_ seguiti da troppe emoji che ridono)", 10),
        new($"apre {Social.Any} alle {TimeSlot.Notte} e si ritrova a discutere sulla _‘meravigliosa figura di {Idoli}’_ con tono da {DifettiSociali} (scrivendo rigorosamente con l'indice, tenendo il telefono a {4..12} centimetri dal naso)", 10),
        new($"i figli si sono trasferiti a {City.Any} pur di stargli lontano", 5),
        new($"costringe chiunque a guardare video a tema {Ossessioni} sul suo telefono col vetro perennemente crepato", 6),
        new($"è sempre d'accordo con {Idoli}", 4),
        new($"per lui {Sitcom} è la vera ironia", 20),
        new($"ha deciso di essere {DifettiSociali} perché, dice lui, gli dà carisma", 4),
        new($"sputa sul politicamente corretto, salvo poi essere {DifettiSociali} nei commenti di {Hating}", 5),
        new($"ha una collezione di riviste Playboy nel seminterrato perché quelle cose lì lui non le fa mica ({CommentiSprezzantiGenerici})", 7),
        new($"è convinto che la sua opinione da {DifettiSociali} sia l'unica valida (l'ha maturata dopo aver sentito parlare {Idoli}, che però stava parlando di tutt'altro)", 9),
        new($"suo figlio ha osato chiamarlo _‘{Vibes}’_ di fronte a tutta la famiglia a Natale ({CommentiSprezzantiGenerici})", 8),
        new($"è in fissa con una cosa: {Ossessioni}", 4),
        new($"mentre parla di {Ossessioni} tutto preso bene ci deve cacciare qualche frase da {DifettiSociali}", 5),
        new($"le sue battute dal sottotesto {DifettiSociali} fanno sempre imbarazzare tutti", 4),
        new($"l'hanno sbattuto fuori dal _‘{Genera("locali").Fissato}’_, il suo locale preferito eh, perché è {DifettiSociali}", 4),
        new($"la {Donne} dice che è il più {DifettiSociali} che abbia mai conosciuto", 5),
        new($"il suo profilo {Social.Any} è pieno di roba da {DifettiSociali} contro {Hating}, in stile {Vibes}", 6),
        new($"è stato definito {Vibes} dal suo migliore amico", 3),
        new($"è stato definito {Vibes} dalla {Donne}", 4),
        new($"il lavoro da {Professioni.M.Fissato} l'ha perso, e indovina un po', perché è {DifettiSociali}", 4),
        new($"i suoi vecchi amici non lo invitano perché è troppo {DifettiSociali}, ma lo compatiscono leggendo i suoi interventi su {Social.Any}", 6),
        new($"la {Donne} dice che è {Vibes}, ma lui la ama lo stesso", 5),
        new($"giovane {Eta.Giovane}enne {Professioni.M.Fissato}", 2),
        new($"il vicino s'è messo su una recinzione, giuro, solo per non aver a che fare con uno {DifettiSociali} così", 5),
        new($"al _‘{Genera("locali").Fissato}’_ l'hanno rimbalzato tutte, ma proprio tutte, perché è {DifettiSociali}", 5),
        new($"ragazzino di {Eta.Minorenne} anni", 2),
        new($"è l'uomo più {DifettiSociali} che tu possa incontrare", 3),
        new($"l'ho conosciuto al _‘{Genera("locali").Fissato}’_ mentre inveiva contro {Hating} in TV, non so come siamo arrivati a parlare di {Idoli}", 6),
        new($"e si vanta pure di essere {DifettiSociali}, come se fosse un pregio", 4),
        new($"pensa che la {Donne} lo adori, ma in realtà lei ha capito che è solo {Vibes}", 6),
        new($"il suo barbiere dice che è il cliente più {DifettiSociali} che abbia mai avuto", 4),
        new($"il suo personal trainer lo considera {Vibes}, per questo lo fa pagare il doppio (e lui è convinto che sia perché fanno l'allenamento _‘da {Percezione}’_)", 10),
        new($"il suo ultimo appuntamento su Tinder lo ha definito _‘{Vibes}, {DifettiSociali}’_ e quindi diverso dalla bio: _‘{City.Any} - {Professioni.M.Fissato} :-) {Percezione}’_", 7),
        new($"a nessuno piace che faccia il {Professioni.M.Fissato}, e lui, ovvio, se ne vanta", 4),
        new($"nonostante sia {Vibes}, pensa ancora di essere un Don Giovanni e si definisce su {Social.Any}: _‘{Percezione} - {City.Any} - {Percezione}’_", 7),
        new($"e non ti stupirà mica sapere che è {DifettiSociali}", 3),
        new($"risponde sempre con GIF inappropriate su {Social.Any}", 4),
        new($"i colleghi lo scansano, sempre per quella storia lì, che è {DifettiSociali}", 4),
        new($"che sia {DifettiSociali} si vede lontano un miglio", 4),
        new($"anche il suo psicologo dice che è {Vibes}", 3),
        new($"se si parla di {Hating} diventa improvvisamente {DifettiSociali} e borbotta cosa da {Vibes}", 4),
        new($"è l'unico nella sua famiglia a essere {DifettiSociali}", 3),
        new($"pensa che sia divertente essere {DifettiSociali}", 3),
        new($"al _‘{Genera("locali").Fissato}’_, il suo bar preferito, non lo servono più — e come dargli torto, è {DifettiSociali}", 4),
        // Il bar è GENERATO dal generatore dei bar: innesto di una generazione nell'altra.
        new($"tiene banco ogni sera al _‘{Genera("locali").Fissato}’_, il bar sotto casa, spiegando come andrebbe governato il paese", 8),
        new($"ogni giorno alle {TimeSlot.Serata} in punto è già al bancone del _‘{Genera("locali").Fissato}’_ per l'aperitivo, e guai a chi glielo sposta", 8),
        new($"ha rotto con la {Donne} perché lei lo ha definito {Vibes}", 5),
        new($"quel fare da {Vibes} gli è costato un sacco di amici, ma ormai chi se ne importa, è diventato {DifettiSociali}", 5),
        new($"nonostante la sua età, è ancora {DifettiSociali}", 3),
        new($"vive idolatrando su {Social.Any} {Idoli}, convinto di essere suo pari nonostante le evidenti differenze", 5),
        new($"dal vivo gli daresti un'età matura, cosa che ha ({Eta.Anziano} anni eh!), ma su {Social.Any} ha un'immaturità che sorprende tutti", 8),
        new($"passa le giornate a sparlare di {Hating} su {Social.Any}, e intanto che è {DifettiSociali} manco se lo ricorda", 6),
        new($"si autodefinisce _‘esperto di {Ossessioni}’_", 5),
        new($"si vanta di non seguire le mode, in realtà è solo un {Professioni.M.Fissato}", 4),
        new($"insegue sempre le ultime tendenze su {Social.Any}, cercando disperatamente di rimanere giovane", 5),
        new($"{Professioni.M.Fissato} di {Eta.Anziano} anni che crede di sapere tutto: (altro che {Hating}!)", 6),
        new($"si vanta di essere un grande fan di {Idoli}", 5),
        new($"di {Eta.Giovane} anni, ma con un'arroganza che ne dimostra il doppio", 4),
        new($"ha sempre da ridire su {Hating}, lo fa in dei commenti tipici da {Vibes}", 4),
        new($"cerca sempre di impressionare con storie di viaggi esotici, ma non ha mai lasciato {City.Any} (se escludiamo quella volta a {City.Any} nel {2019..2025} dove gli hanno pure rubato il portafoglio)", 10),
        new($"si considera un modello per i giovani (oltre che un {Percezione}), ma i suoi comportamenti dicono il contrario", 8),
        new($"si vanta delle sue _‘conquiste’_, ma in realtà se le inventa ({CommentiSprezzantiGenerici})", 10),
        new($"a {Eta.Anziano} anni, passa più tempo a denigrare su {Social.Any} {Hating} che a vivere la vita che gli resta", 6),
        new($"si autodefinisce _‘{Percezione}: il guru di {Ossessioni}’_", 5),
        new($"dice di amare {Hating}, ovviamente non è vero ({CommentiSprezzantiGenerici})", 6),
        new($"si definisce un _‘{Percezione}’_, ma in realtà ha solo paura di affrontare il mondo (gli basta {TerroriQuotidiani} per andare nel pallone)", 8),
        new($"è terrorizzato all'idea di dover fare lui la telefonata per prenotare al _‘{Genera("locali").Fissato}’_, il locale più in voga di {City.Any}", 6),
        new($"fa il duro contro {Hating}, ma la sua più grande paura è {TerroriQuotidiani}", 10),
        new($"predica _‘{FrasiTipiche}’_, poi però va nel panico al solo pensiero di {TerroriQuotidiani}", 9),
        new($"si professa _‘{Percezione}’_ ma non sa nemmeno {TerroriQuotidiani} da solo", 8),
        new($"il suo profilo {Social.Any} è pieno di citazioni di {Idoli} (ma poi è stra attivo, tipo {5..8} post al giorno)", 9),
        new($"non si fida di nessuno e su {Social.Any} ripete a pappagallo _‘{FrasiTipiche}’_", 6),
        new($"ha sempre una risposta pronta per tutto: _‘{FrasiTipiche}’_", 5),
        new($"si presenta agli sconosciuti con frasi tipo _‘{FrasiTipiche}’_", 5),
        new($"è andato in un negozio per farsi una maglia con scritto _‘{FrasiTipiche}’_", 6),
        new($"dice che non è {DifettiSociali}, poi apre bocca: _‘{FrasiTipiche}’_", 6),
        new($"sostiene di saper cucinare {PiattiPerfetti} e si incazza se qualcuno usa gli ingredienti sbagliati (anche se lui brucia tutto ogni volta in una padella mezza scrostata)", 20),
        new($"si vanta di avere {MarcheOrologi} (palesemente finto comprato a {City.Any} in vacanza) e lo tiene sempre in vista mentre guida la sua utilitaria a rate", 22),
        new($"parla di investimenti in criptovalute come se fosse il lupo di Wall Street, ma il suo portafoglio su {Social.Any} è in rosso del 90%", 20),
        new($"misura il suo successo in base al numero di bottiglie che ha ordinato in discoteca {2..5} anni fa", 18),
        new($"morbosamente geloso della {Donne}", 4),
        new($"tirannico con la {Donne}, altro che uomo di casa", 4),
        new($"ossessionato da {Sport}, non che sia nulla di male, ma non quando diventa superstizione", 5),
        new($"tifoso sfegatato di {Idoli}", 4),
        // Frasi a tema DATE (preset condivise): le feste e l'estate del maschio basico.
        new($"{DateRangeSlot.Feste} monopolizza ogni pranzo di famiglia spiegando come si aggiusterebbe il paese, tra un rutto e una battuta su {Hating}", 10),
        new($"{DateRangeSlot.Estate} non stacca mai il condizionatore e poi litiga con mezzo condominio per la bolletta", 8),
        new($"è convinto che l'autovelox sulla strada per {City.Any} ce l'abbia con lui personalmente", 6),
        new($"ogni tanto discute col navigatore satellitare, che secondo lui gli tiene il muso", 7),
        new($"tiene in garage un barattolo di _‘aria buona del 1998’_ e guai a chi prova ad aprirlo", 8),
        new($"giura di aver visto il futuro in una pozzanghera: era pieno di {HatingConcetti}", 7),
        new($"è sicuro che i piccioni della piazza di {City.Any} facciano rapporto su di lui", 7),
        new($"sostiene che il meteo sbagli apposta, e solo con lui", 5),
        new($"parla al barbecue come a un vecchio commilitone, e giura che gli risponde", 8),
    ];
}
