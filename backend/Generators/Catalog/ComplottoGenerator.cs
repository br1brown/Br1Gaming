using static Backend.Generators.SharedContent;
using City = Backend.Generators.SharedContent.City;
using Social = Backend.Generators.SharedContent.Social;
using TimeSlot = Backend.Generators.SharedContent.TimeSlot;

namespace Backend.Generators.Catalog;

/// <summary>
/// Generatore di complotti e cospirazioni su scala globale.
/// Integra le assurdità giganti direttamente nel core e massimizza l'uso
/// di Range numerici, TimeSlot e DateRangeSlot per una generazione fluida e iper-dettagliata.
/// </summary>
public sealed class ComplottoGenerator : GeneratorBase
{
    // ── 1. I MANDANTI (CATTIVI) ──────────────────────────────────────────────────────
    internal static readonly Tag Aziende = new("aziende")
    {
        "BlackRock", "Vanguard", "Pfizer", "Moderna", "Monsanto", "Bayer",
        "Google", "Meta", "Amazon", "Nestlé", "Apple", "Microsoft", "Palantir",
        "Lockheed Martin", "OpenAI", "Neuralink", "Darpa", "Tencent", "Tinder"
    };

    internal static readonly Tag Personalita = new("personalita")
    {
        "Bill Gates", "Mark Zuckerberg", "Elon Musk", "Jeff Bezos", "Sam Altman",
        "George Soros", "Jacob Rothschild", "David Rockefeller", "Warren Buffett",
        "Christine Lagarde", "Anthony Fauci", "Mario Draghi", "Hillary Clinton",
        "il presidente francese", "Re Carlo", "il Papa", "Henry Kissinger",
        "J. K. Rowling", "Licio Gelli", "il Papa nero", "l’eminenza grigia",
        "il Gabibbo", "Wanna Marchi", "Mago Otelma", "Roberto da Crema",
        "il clone di Elvis", "JFK Jr. (ancora vivo)", "Yuval Noah Harari",
        "Peter Thiel", "Marina Abramović"
    };

    internal static readonly Tag Istituzioni = new("istituzioni")
    {
        "l'OMS", "la NATO", "il WEF", "l'ONU", "la Banca Centrale Europea",
        "il Fondo Monetario Internazionale", "la NASA", "il CERN di Ginevra",
        "il Pentagono", "la CIA", "il KGB", "il Mossad", "l'Agenzia Spaziale Europea",
        "il Club Bilderberg", "il Deep State", "la Federal Reserve", "l'Area 51",
        "la Commissione Europea"
    };

    internal static readonly Tag Entita = new("entita")
    {
        "i Watchers", "i Nephilim", "gli Elohim", "gli Atlantidei", "i Lemuriani",
        "gli Antichi dell'Abisso", "i Primigeni", "i Naga", "gli Illuminati", "i Massoni",
        new($"i seguaci della Loggia P{1..4}"), "i Templari", "i Rosacroce",
        "i Cavalieri di Malta", "i Bavaresi", "la Mano Nera", "i Savi di Sion",
        "il Priorato di Sion", "i satanisti", "i Gesuiti", "i Rettiliani",
        new($"gli alieni Grigi alti {2..4} metri"), "le entità gnostiche", "i parassiti astrali",
        new($"i demoni di {3..6}ª densità"), "i vampiri psichici", "gli gnomi di Zurigo",
        "gli Uomini in Nero", "i transumanisti", "i cloni senza anima"
    };

    internal static readonly Tag Cattivi = Tag.Unione("cattivi",
        Aziende, Personalita, Istituzioni, Entita);

    // ── 2. IL MEZZO (VETTORI) ────────────────────────────────────────────────────────
    internal static readonly Tag Vettori = new("vettori")
    {
        "Starlink", new($"il {5..6}G"), new($"il Wi-Fi {6..7}E"), "PRISM",
        "i cavi sottomarini transatlantici", "i router domestici", "la blockchain",
        "i tralicci dell'alta tensione", "le telecamere ZTL", "i bancomat contactless",
        "i termostati intelligenti", "HAARP", "la geoingegneria",
        new($"le scie chimiche rilasciate a bassa quota verso le {TimeSlot.Mattina}"),
        "i satelliti meteo militari", "i radar Doppler modificati", "i trasmettitori a onde scalari",
        "le armi a impulsi elettromagnetici", "i ripetitori a bassa frequenza ELF",
        "i droni da dispersione nanometrica", "le nubi artificiali conduttive",
        new($"un network di {50..500} satelliti a specchi termici"), "i laser orbitali",
        "le piattaforme sottomarine di risonanza acustica", "microfoni ambientali",
        "sensori biometrici", "gli scanner a raggi X portatili", "i lettori di onde cerebrali",
        "le antenne emettitrici di virus", "i tracciatori GPS microscopici",
        new($"i microfoni subdermici inalabili di {2..3} nanometri"), "i proiettori di false realtà olografiche",
        "l'acqua potabile", "la carne sintetica", "i farmaci da banco",
        "l'aria condizionata dei centri commerciali", "il dentifricio al fluoro",
        "i tessuti sintetici del fast fashion", "le lampadine a LED",
        new($"il cloud seeding segreto sopra {City.Any}"),
        new($"le sementi OGM brevettate da {Aziende}"),
        new($"i contatori smart sintonizzati sulle frequenze di {Aziende}"),
        new($"i vaccini antinfluenzali finanziati da {Aziende}")
    };

    // ── 3. L'AGENTE (SOSTANZE) ───────────────────────────────────────────────────────
    internal static readonly Tag Sostanze = new("sostanze")
    {
        "grafene", "ossido di etilene", "fluoro", "adrenocromo", "cellule fetali aliene",
        "spike protein persistente", "thimerosal", "squalene", "nanorobot magnetici",
        new($"DNA ricombinante a {3..4} eliche"), new($"polimeri a memoria di forma attivati a {35..40} gradi"),
        "mRNA auto-replicante", "polimero chimico", "cellulosa sintetica", "neve chimica brevettata",
        "cristalli di bario", "ioduro d'argento", "lattice sbriciolato",
        "estrogeni sintetici", "metalli pesanti", "microplastici",
        "residui di psicofarmaci", "inibitori del pensiero", "agenti sterilizzanti",
        "proteine prioniche", "terapie geniche sperimentali", "idrogel",
        "microchip liquidi", "cristalli di luciferasi", "enzimi modificati",
        "farina di insetti", "sangue sintetico", "polimeri militari"
    };


    internal static readonly Tag Luoghi = new("luoghi")
    {
        new ($"sotto {City.Any}"), "sotto il Vaticano", "sotto l’Antartide", "sotto Ground Zero",
        "nella base sotterranea di Dulce", "sotto i ghiacci della Groenlandia",
        "sotto la piramide del Louvre", "sull'isola di Epstein", "dentro il Monte Kailash",
        "nelle catacombe di Parigi", "nella fossa delle Marianne",
        "sotto il castello di Wewelsburg", "sotto Denver Airport",
        new ($"in un bunker segreto a {City.Any}"), "in un caveau climatizzato sulle Alpi svizzere",
        "sotto il Cheyenne Mountain", "nella base navale in Antartide",
        "in una stazione orbitante invisibile", "sotto l'isola di Pasqua",
        "nel Triangolo delle Bermuda", "in una città sottomarina",
        "nel deserto del Gobi", "sotto il Cremlino", new($"nella vera Area {51..54}"),
        "sulla faccia nascosta della Luna", "nei server off-shore",
        "in un cloud non tracciabile", "nel deserto del Nevada",
        new($"in un bunker profondo {10..50} km, con {Cattivi} di guardia"),
        new($"sotto la sede centrale di {Aziende}"),
        new($"in un archivio crittografato, con {Istituzioni} a fare la guardia")
    };

    // ── 5. I DANNI E GLI EVENTI ──────────────────────────────────────────────────────
    internal static readonly Tag Effetti = new("effetti")
    {
        new($"il fischio magnetico alle orecchie calibrato a {15..25} Hz"), "la nevralgia cronica",
        "la spossatezza improvvisa", "la nebbia cerebrale cronica",
        "la perdita di memoria a breve termine", "la percezione di presenze non-umane",
        "sterilità di massa programmata", "mutazioni genetiche indotte",
        "magnetismo cutaneo misurabile", "sindrome da morte improvvisa",
        "miocardite su scala globale", "immunodeficienza acquisita artificialmente",
        new($"l'invecchiamento accelerato dei tessuti del {30..50}%"),
        "calcificazione della ghiandola pineale",
        "l'inversione sessuale di anfibi e fauna acquatica",
        new($"la riduzione del {20..60}% della fertilità maschile"),
        "la riscrittura del codice genetico", "la castrazione chimica selettiva",
        "la soppressione dei centri spirituali cerebrali", "lo stato di sottomissione biochimica"
    };

    internal static readonly Tag Eventi = new("eventi")
    {
        "incendi boschivi a combustione chimica", new($"uragani di categoria {4..5} pilotati"),
        new($"terremoti di magnitudo {6..9} a ipocentro superficiale"), "tornado multi-vortice direzionati",
        "tsunami anomali innescati da piattaforme sottomarine",
        new($"blackout climatici pianificati in segreto {DateRangeSlot.Feste}"),
        "sciami sismici ad attivazione artificiale", "inondazioni lampo a nucleo sintetico",
        new($"siccità prolungate {DateRangeSlot.Estate} per assetare le colture"),
        "eruzioni vulcaniche indotte", "bombe d'acqua a precipitazione istantanea",
        "episodi di déjà-vu su scala di massa", "discrepanze documentate nei ricordi storici comuni",
        "anomalie temporali nei supporti analogici d'archivio",
        "soppressioni retroattive di testate giornalistiche",
        "modifiche sincronizzate di citazioni letterarie storiche",
        "loop temporali registrati su scala regionale",
        "variazioni cartografiche retroattive dei confini terrestri"
    };

    // ── 6. LE PROVE E I PRECEDENTI STORICI ───────────────────────────────────────────
    internal static readonly Tag Precedente = new("precedente")
    {
        "l’esperimento Tuskegee", "l’operazione COINTELPRO", "l’Operation Mockingbird",
        "il Project Paperclip", "la rete Stay-Behind", "la rete Gladio",
        "l’incidente del Golfo del Tonchino", "l’operazione Northwoods",
        "lo scandalo Iran-Contra", "il programma PRISM", "il protocollo Blue Beam",
        "l’esperimento Montauk", "il piano Paperclip II", "il progetto MKUltra",
        "il Phoenix Program", "il progetto HAARP", "il progetto Mockingbird 2.0",
        "la rete Stay-Behind europea", "l’operazione LAMPEDUSA","il programma XKeyscore",
        "il progetto Looking Glass", "l’esperimento di Philadelphia"
    };

    internal static readonly Tag Prove = new("prove")
    {
        new($"un thread archiviato su {Social.Any}"),
        new($"un documento declassificato che chiama in causa {Cattivi}"),
        new($"un PDF trapelato da chi lavorava per {Istituzioni}"),
        new($"un filmato ad alta risoluzione sfuggito alla censura, con {Istituzioni} alle calcagna"),
        new($"un dataset riservato rubato a {Aziende}"),
        new($"un video documentale di {2..10} ore"),
        new($"una testimonianza registrata di un ex insider che lavorava per {Cattivi}"),
        new($"un archivio dei log di sistema degli ultimi {5..15} anni, trapelato"),
        "un bollettino desecretato", "un dossier cifrato",
        new($"un funzionario pentito che lavorava per {Istituzioni}"),
        new($"un rapporto degli analisti informatici che seguivano {Personalita}"),
        "una deposizione dei piloti civili e militari coinvolti",
        new($"una fonte interna {Luoghi}"),
        new($"un dossier interno che nomina {Cattivi}"),
        new($"un nastro registrato recuperato {Luoghi}"),
        new($"un fascicolo di brevetti originali di {Aziende} mai resi pubblici"),
        new($"un archivio crittografato da {12..250} terabyte occultato {Luoghi}")
    };

    // ── 7. GLI SCOPI (PERCHÉ LO FANNO) ───────────────────────────────────────────────
    internal static readonly Tag Scopi = new("scopi")
    {
        "manipolare i consensi di massa", "controllare le opinioni pubbliche",
        "orientare il voto elettorale", "plasmare i modelli di consumo",
        "abbassare le barriere immunitarie della popolazione",
        "imporre l'accettazione del microchip", "cancellare l'identità biologica e culturale",
        "mantenere la popolazione in stato di acquiescenza",
        "neutralizzare il dissenso civile", "smantellare la struttura familiare tradizionale",
        "imporre il pensiero unico globalista",
        new($"creare dipendenza cronica dai farmaci proprietari di {Aziende}"),
        "isolare l'individuo dal campo vitale naturale",
        "inibire la percezione della ghiandola pineale",
        "la distruzione programmata della classe media",
        "la schedatura biometrica della popolazione civile",
        "il controllo mentale universale",
        "la depopolazione selettiva", "la sterilità indotta",
        "l’abolizione del contante",
        new($"la fusione forzata tra uomo e intelligenza artificiale sviluppata da {Aziende}"),
        "l’introduzione della moneta digitale CBDC",
        "la creazione dell’Anticristo digitale",
        "l’apertura dei portali dimensionali",
        "la Grande Sostituzione", "il rincoglionimento totale globale",
        "l'indottrinamento sistematico nelle scuole",
        new($"l'aggiunta di {Sostanze} nelle mense scolastiche"),
        "la riscrittura selettiva dei manuali di storia contemporanea",
        new($"diffondere ultrasuoni nascosti nei jingle pubblicitari di {Aziende}"),
        "l'abolizione forzata dei concetti di famiglia nei test d'ingresso",
        "imporre psicodrammi obbligatori mascherati da assemblee d'istituto",
        new($"sincronizzare i telegiornali su un'unica scaletta, con {Cattivi} a dettarla"),
        "usare gli scambi culturali per il ricondizionamento ideologico",
        new($"completare il piano entro il {2027..2042}"),
        new($"imporre un nuovo lockdown {DateRangeSlot.Feste}"),
        new($"il Grande Reset, con {Cattivi} alla regia"),
        "imporre pass digitali permanenti",
        new($"l'infrastruttura di credito sociale fornita da {Aziende}"),
        "l’introduzione del digital ID",
        "preparare l'avvicinamento di Nibiru all'orbita visibile",
        "sfruttare il prossimo allineamento planetario",
        new($"l’attivazione del sistema di riconoscimento facciale globale a partire dalle {TimeSlot.Mattina}"),
        "chiudere i giochi prima dell'inversione programmata dei poli magnetici",
        new($"l'inaugurazione della prima città a cupola dei {9..15} minuti"),
        new($"la sostituzione totale del contante tramite {Vettori}"),
        new($"preparare il rilascio di una nuova variante sintetica nei condotti di ventilazione {Luoghi}"),
        new($"sfruttare il blackout elettrico coordinato di {5..13} giorni"),
        new($"attendere che {Precedente} proietti il falso Messia nei cieli"),
        new($"la transizione alimentare obbligatoria a {Sostanze}"),
        "l'abbattimento programmato dell'ultimo satellite civile",
        "anticipare l'entrata in vigore del Trattato Pandemico Vincolante"
    };

    // ── CONFIGURAZIONE GENERATORE ───────────────────────────────────────────────────
    /// <inheritdoc />
    public override string Slug => "complotto";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new()
    {
        Order = 3,
        Name = "Le verità che non ti dicono",
        Description = "Le cose vere che nessuno ti dice che però trovi qui"
    };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new()
    {
        MinPhrases = 3,
        MaxPhrases = 4,
        Separators = ["! ", "... ", ". ", ". Oltretutto ", "; ", ".\n"],
        MinScore = 10,
        MarkovChaos = 0
    };

    /// <inheritdoc />
    public override List<Etichetta>? UniqueLabels { get; } =
    [Personalita, Istituzioni, Sostanze, Vettori, Aziende, Precedente];

    /// <inheritdoc />
    public override List<string>? ExclusiveGroups { get; } =
        [Social.Any.Key, Scopi.Key, Effetti.Key, Sostanze.Key, Vettori.Key];

    /// <inheritdoc />
    public override Frase? Chiusura => ".";

    // ── CORE (FRASI DI PARTENZA) ─────────────────────────────────────────────────────
    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        new($"il continente australiano non esiste: è una messa in scena di {100..500} mila attori pagati da {Aziende}", 5),
        new($"l’Impero Romano non è mai esistito, è un'invenzione inserita nei testi {3..5} secoli fa, con {Istituzioni} dietro le quinte", 5),
        new($"{Luoghi} è conservato un piano di spartizione del mondo, redatto in segreto fin dal {1910..1945} con {Cattivi} al tavolo", 5),
        new($"{Personalita} ha un sosia che ne fa le veci dal {1965..1999}", 5),
        new($"la Terra è una struttura di detenzione interdimensionale, sotto la sorveglianza di {Cattivi}", 5),
        new($"attraverso {Entita} si aprono ogni giorno varchi stabili, verso le {TimeSlot.Notte}, per far entrare entità esterne", 5),
        new($"gli abitanti di {City.Any} sono vittime di {Eventi} almeno dal {18..19}° secolo", 5),
        new($"il caso di {City.Any.Fissato} è gestito da chi sta {Luoghi}", 5),
        new($"il settore polare antartico custodisce da {70..80} anni il corridoio d'accesso alla Terra Cava, con {Cattivi} di guardia", 5),
        new($"la fauna urbana consiste per il {60..79}% in unità robotiche brevettate da {Aziende} e collegate con {Vettori}", 5),
        new($"il satellite lunare è una proiezione olografica a {8..16}K, gestita da {Cattivi}", 5),
        new($"la Dead Internet Theory è un dato operativo: il {90..99}% del traffico di rete è generato per {Scopi}", 5),
        new($"i reperti fossili attribuiti ai dinosauri sono calchi in resina collocati negli anni '{2..8}0 per coprire {Precedente}, su ordine di {Cattivi}", 5),
        new($"{Luoghi} opera un laboratorio di livello {4..6} per ibridare DNA umano con {Sostanze}", 5),
        new($"una struttura con affreschi profetici, grande {2..5} volte il Pentagono, si trova {Luoghi}", 5),
        new($"il codice sorgente della simulazione percettiva da {10..50} petabyte è archiviato in segreto {Luoghi}", 5),
        new($"secondo {Prove}, {Eventi} sono una facciata", 5),
        new($"{Precedente} è la punta dell'iceberg: la verità resta nascosta usando di continuo {Vettori}, con {Cattivi} dietro le quinte", 5),
        new($"secondo {Prove}, il vero fine è {Scopi}, e si passa attraverso {Vettori}", 5),
        new($"{Eventi} non sono naturali, con {Cattivi} a muovere i fili", 5),
        new($"nei cieli di {City.Any.Fissato} è in corso, fin dalle {TimeSlot.Mattina}, l'erogazione di {Sostanze}", 5),
        new($"sopra {City.Any.Fissato} l'erogazione passa attraverso {Vettori}", 5),
        new($"verso le {TimeSlot.Notte} aumenta il rilascio di {Sostanze} tramite {Vettori}", 5),
        new($"usare {Vettori} per oltre {10..24} ore consecutive causa {Effetti}", 5),
        new($"la saturazione biologica di {Sostanze} nel corpo umano induce direttamente {Effetti}", 5),
        new($"l'operazione ha il supporto logistico di {Aziende}, con {Cattivi} alla regia", 5),
        new($"le direttive arrivano dall'alto, con {Cattivi} in cabina di regia", 4),
        new($"il coordinamento unisce {Personalita} e {Personalita} in un solo interesse occulto", 4),
        new($"{Aziende} si occupa della logistica globale dell'operazione", 4),
        new($"i capitali operativi sono garantiti da fondazioni anonime, con {Personalita} tra i finanziatori", 4),
        new($"la finalità primaria dell'infrastruttura è {Scopi}, e passa tutta per {Vettori}", 6),
        new($"il complesso network è programmato per {Scopi}, con {Cattivi} ai comandi", 5),
        new($"la dispersione di {Sostanze} ha un unico scopo: {Scopi}", 5),
        new($"i protocolli di censura su {Social.Any.Fissato} occultano ogni anomalia che riguarda {Vettori}", 4),
        new($"le anomalie rilevate nei dintorni di {City.Any.Fissato} sono coordinate in segreto da {Cattivi}", 5),
        new($"la rete che sfrutta {Vettori} resta attiva per {Scopi} all'insaputa di tutti", 5)
    ];
}
