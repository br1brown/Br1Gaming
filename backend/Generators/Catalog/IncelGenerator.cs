
// Alias tipizzati per i contenuti condivisi: niente stringhe magiche nei segnaposto.
using City = Backend.Generators.SharedContent.City;
using Eta = Backend.Generators.SharedContent.Eta;
using Gruppi = Backend.Generators.SharedContent.Gruppi;
using Marketplace = Backend.Generators.SharedContent.Marketplace;
using Nome = Backend.Generators.SharedContent.Nome;
using Parente = Backend.Generators.SharedContent.Parente;
using Professioni = Backend.Generators.SharedContent.Professioni;
using Social = Backend.Generators.SharedContent.Social;
using TimeSlot = Backend.Generators.SharedContent.TimeSlot;
using DateRangeSlot = Backend.Generators.SharedContent.DateRangeSlot;

namespace Backend.Generators.Catalog;

/// <summary>Incel: estende il Maschio Basico, che fa da base (merge dichiarato in <see cref="ComposeWith"/>).</summary>
public sealed class IncelGenerator : GeneratorBase
{
    // Tag del MASTER (mbeb): stessi simboli, riferimenti compile-checked. La fusione dei contenuti
    // resta dichiarata in ComposeWith; qui si riusa solo l'identità dei segnaposto.
    internal static readonly Tag Donne = MbebGenerator.Donne;
    internal static readonly Tag Idoli = MbebGenerator.Idoli;
    internal static readonly Tag Ossessioni = MbebGenerator.Ossessioni;
    internal static readonly Tag Hating = MbebGenerator.Hating;
    internal static readonly Tag HatingConcetti = MbebGenerator.HatingConcetti;
    internal static readonly Tag HatingPersone = MbebGenerator.HatingPersone;
    internal static readonly Tag DifettiSociali = MbebGenerator.DifettiSociali;
    internal static readonly Tag Vibes = MbebGenerator.Vibes;
    internal static readonly Tag Percezione = MbebGenerator.Percezione;
    internal static readonly Tag FrasiTipiche = MbebGenerator.FrasiTipiche;
    internal static readonly Tag CommentiSprezzantiGenerici = MbebGenerator.CommentiSprezzantiGenerici;
    internal static readonly Tag TerroriQuotidiani = MbebGenerator.TerroriQuotidiani;
    // Segnaposto PROPRI dell'incel.
    internal static readonly Tag AbbigliamentoScadente = new("abbigliamento_scadente")
    {
        ("completi in poliestere scadente", 3),
        ("magliette con grafiche cringe", 3),
        ("camicie hawaiane plasticose", 3),
        ("felpe con scritte pseudo-filosofiche", 3),
        ("t-shirt attillate comprate su Shein", 3),
        ("felpe oversize con loghi taroccati", 3),
        ("giubbotti di finta pelle scamosciata", 3),
        ("pantaloni cargo pseudo-militari", 3),
        ("camicie di raso con le tigri stampate", 3),
        ("gilet tattici da finto operatore", 3),
        ("magliette con il lupo che ulula alla luna", 3),
        ("giacche di pelle ecologica che sanno di plastica bruciata", 4),
        ("felpe con il teschio e la scritta gotica in inglese sbagliato", 4),
        ("polo tarocche col coccodrillo che guarda dalla parte opposta", 4),
        ("infradito coi calzini bianchi tirati su", 3),
    };

    internal static readonly Tag StrumentiMisura = new("strumenti_misura")
    {
        ("un righello di plastica dei Power Rangers delle elementari", 3),
        new($"un calibro digitale comprato su {Marketplace.Any}", 3),
        ("un'app per lo smartphone scaricata da siti russi", 3),
        new($"un metro da sarto rubato a sua {Parente.Anziano.F}", 3),
        ("un compasso arrugginito trovato in cantina", 3),
        ("il righello scolastico di Spongebob", 3),
        ("un calibro stampato in 3D storto", 3),
        ("un metro a nastro dell'IKEA", 3),
        ("un'app chiamata _‘AlphaMeasure Pro’_ scaricata da un forum", 3),
        new($"il regolo calcolatore di suo {Parente.Anziano.M}", 3),
        ("un metro pieghevole da geometra preso all'Obi", 3),
        ("il calibro del corso di disegno tecnico delle superiori", 4),
        ("una stecca da biliardo usata come riferimento", 3),
        ("il righello flessibile con la tabellina dietro", 3),
        ("un livello a bolla dell'IKEA tenuto in orizzontale", 4),
    };

    internal static readonly Tag CommentiSprezzantiPene = new("commenti_sprezzanti_pene")
    {
        new($"misura che ha calcolato usando {StrumentiMisura}", 3),
        ("calcolata partendo rigorosamente dalla spina dorsale", 3),
        ("un'evidente sovrastima dovuta a un uso improprio del righello", 3),
        new($"o almeno così scrive nel suo profilo di {Social.Any} per compensare", 3),
        new($"anche se la {Donne} avrebbe molto da ridire in proposito", 3),
        ("misura ovviamente arrotondata per eccesso", 3),
        ("record raggiunto una volta sola e mai più replicato", 3),
        ("in erezione, al freddo e con il vento a favore", 3),
        ("un numero che cambia ogni volta che lo racconta", 3),
        ("certificata da nessuno tranne lui", 3),
        new($"e a smentirlo ci sono pure quelli che ha su {Social.Any}", 3),
        ("misurata subito dopo una doccia bollente e in condizioni climatiche ottimali", 4),
        ("dato che include anche i due centimetri di margine di sicurezza", 4),
        ("un primato omologato solo dalla giuria di suo cugino", 4),
        ("calcolata col metodo scientifico del _‘fidati’_", 3),
    };

    internal static readonly Tag OggettiStatus = new("oggetti_status")
    {
        ("il suo orologio in acciaio", 3),
        ("il suo G-Shock enorme", 3),
        ("il suo bracciale in finta pelle", 3),
        ("il suo braccialetto di perline energetiche", 3),
        ("il suo Apple Watch di seconda mano", 3),
        ("il suo cinturino militare in nylon", 3),
        ("il suo bracciale magnetico anti-stress", 3),
        ("il suo smartband cinese", 3),
        ("il suo braccialetto in paracord", 3),
        ("il suo portachiavi dell'Audi (ma la macchina è di sua madre)", 4),
        ("la sua penna Montblanc taroccata comprata a Napoli", 4),
        ("i suoi occhiali da sole specchiati indossati anche al chiuso", 4),
        ("il suo accendino Zippo che non ha mai acceso una sigaretta", 4),
        ("il suo powerbank da 30000 mAh grande come un mattone", 4),
        ("la sua catenina d'oro col cornetto portafortuna", 4),
    };

    // Etichette uniche: quelle in comune col mbeb sono gli STESSI simboli; le altre sono proprie
    // ("fetic" era dichiarata per errore nel mbeb: il contenuto feticista è qui).
    private static readonly Etichetta Vanta = MbebGenerator.Vanta;
    private static readonly Etichetta Definisce = MbebGenerator.Definisce;
    private static readonly Etichetta FaCommenti = new("fa commenti");
    private static readonly Etichetta Fetic = new("fetic");

    /// <inheritdoc />
    public override string Slug => "incel";

    /// <inheritdoc />
    public override IReadOnlyList<string> ComposeWith => ["mbeb"];

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 1, Name = "Generatore Incel", Description = "Genera il tuo incel di fiducia" };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 3, MaxPhrases = 4, MinScore = 36, Separators = [". ", "; ", ".\n"] };

    /// <inheritdoc />
    public override Frase? Apertura => new($"## {Nome.M},\n");

    /// <inheritdoc />
    public override List<Etichetta>? UniqueLabels { get; } = [Definisce, FaCommenti, Vanta, Fetic];

    /// <inheritdoc />
    public override List<string>? ExclusiveGroups { get; } = [Gruppi.Identita, FrasiTipiche.Key];

    // ── ESTENSIONI: tag costruiti sul segnaposto del master (o condiviso) con voci proprie.
    // Il RuntimeBuilder fonde per chiave: la vena incel si AGGIUNGE alle voci del mbeb, non le
    // sostituisce. Il suffisso "Incel" distingue l'estensione dall'alias nudo in testa al file. ──

    internal static readonly Tag IdoliIncel = new(Idoli)
    {
        ("Andrew Tate", 2),
        ("Rollo Tomassi", 2),
        ("Joe Rogan", 2),
        ("Jordan Peterson", 2),
        ("Ben Shapiro", 2),
        ("Tucker Carlson", 2),
        ("Marco Crepaldi", 2),
        ("Alex Jones", 2),
        ("Elliot Rodger", 2),
        ("Nick Fuentes", 2),
        ("Tommy Robinson", 2),
    };

    internal static readonly Tag OssessioniIncel = new(Ossessioni)
    {
        ("aspetto fisico", 2),
        ("ipergamia femminile", 2),
        ("status", 2),
        ("inutili dating app", 3),
        ("looksmaxxing", 2),
        ("declino dell'Occidente", 2),
    };

    // Bersagli dell'incel, CATEGORIZZATI: estendono i sottogruppi del mbeb, così finiscono sia nella
    // categoria giusta (per i retarget: ‘A Morte [concetto]’ ecc.) sia nell'unione {Hating} — che il
    // RuntimeBuilder ricompone dopo il merge. L'incel non nomina persone reali → niente "hating-persone".
    internal static readonly Tag HatingGruppiIncel = new(MbebGenerator.HatingGruppi)
    {
        ("le femministe", 2),
        ("le ragazze _‘che la danno a tutti’_", 3),
        ("le femmine di oggi", 3),
        ("tutte le donne", 3),
        ("le _‘tipe di Tinder’_", 3),
        ("donne che cercano solo soldi", 3),
        ("i chad", 2),
        ("i simp", 2),
        ("i normie", 2),
        ("quelli che vanno in palestra", 3),
        ("le coppie felici", 3),
        ("i maschi alfa", 3),
        ("gli uomini che hanno successo con le donne", 3),
        ("i cuck", 2),
        ("gli uomini che difendono le donne", 3),
        ("i maschi che piacciono alle ragazze", 3),
        ("quelli che non capiscono la Red Pill", 3),
        ("i white pillati", 3),
        ("chi non ha sofferto come lui", 3),
    };

    internal static readonly Tag HatingConcettiIncel = new(MbebGenerator.HatingConcetti)
    {
        ("OnlyFans", 2),
        ("le relazioni moderne", 3),
        ("il femminismo", 2),
        ("la società moderna", 3),
    };

    internal static readonly Tag DonneIncel = new(Donne)
    {
        ("ragazza che lo friendzona", 3),
        ("ragazza che lo ha rifiutato", 3),
        ("ragazza che non gli risponde ai messaggi", 3),
        ("sua crush che sta con un altro", 3),
        ("ragazza che lo ha ghostato", 3),
        ("ragazza che _‘va con i chad’_", 3),
        ("ragazza che lo respinge", 3),
    };

    internal static readonly Tag FrasiTipicheIncel = new(FrasiTipiche)
    {
        ("non sono sessista, è biologia", 3),
        new($"io sono un {Percezione} e il mondo mi ha ridotto a un guscio vuoto", 4),
        new($"quando morirò sarà colpa sai di chi? dico solo una cosa: {Hating}", 4),
        ("diventeranno vecchie, rugose e inutili, mentre io riderò dalla mia tomba sapendo che le ho superate tutte", 3),
        new($"l'unica cosa che mi tiene vivo è l'idea di vederle tutte infelici, grasse e abbandonate a {40..80} anni", 4),
        new($"sai cosa ha creato una generazione di gente senza valore che meritano solo sofferenza eterna? {Hating}!", 4),
        new($"mi hanno trasformato in un {Percezione}", 4),
        new($"Diventeranno tutte zitelle depressive con {2..15} gatti e zero rimpianti... toh", 4),
        new($"Mi hanno rifiutato solo perché non sono egemone e apprezzo {Hating}", 4),
        new($"L'amore vero non esiste più, è stato ucciso da una cosa: {HatingConcetti}", 4),
        ("diventeranno tutte gattare", 3),
        ("resteranno tutte da sole e pentite", 3),
        ("si pentiranno di avermi rifiutato", 3),
        ("tradiranno tutti, come hanno fatto con me", 3),
        ("essere gentile non serve a niente con le donne", 3),
        ("essere un bravo ragazzo non paga mai", 3),
        ("il femminismo ha distrutto la società", 3),
        ("il loro amore è solo un'illusione", 3),
        ("il loro rifiuto mi ha reso più forte", 3),
        ("il romanticismo è morto grazie alle donne", 3),
        ("l'amore è una bugia inventata dalle femministe", 3),
        ("l'unica cosa che le donne vogliono è attenzione", 3),
        ("la società favorisce solo le donne, non gli uomini", 3),
        ("la società è contro gli uomini come me", 3),
        ("le donne amano solo i bastardi", 3),
        ("le donne fanno solo drammi inutili", 3),
        ("le donne fingono interesse solo per usarti", 3),
        ("le donne hanno distrutto la mia vita", 3),
        ("le donne moderne non sanno cosa vogliono", 3),
        ("le donne non sanno cosa sia la vera fedeltà", 3),
        ("le donne sono attratte solo dai soldi e dal potere", 3),
        ("le donne usano gli uomini come atm", 3),
        ("loro non possono capire il mio dolore", 3),
        ("mi rifiutano solo perché non sono un modello", 3),
        ("mi sono arreso, non ci proverò più", 3),
        ("nessuna donna merita il mio tempo o la mia attenzione", 3),
        ("non c'è speranza per gli uomini come me", 3),
        ("non ci sono più vere donne oggi", 3),
        ("non ho bisogno di nessuna di loro per essere felice", 3),
        ("non ho bisogno di nessuna, loro hanno bisogno di me", 3),
        ("non sarò mai abbastanza per loro", 3),
        ("non sprecherò più energie per loro", 3),
        ("non vedono l'uomo dietro i miei difetti", 3),
        ("non voglio essere un simp, preferisco stare solo", 3),
        ("ogni volta che sono gentile, mi trattano come uno zerbino", 3),
        ("perché dovrei rispettare chi non mi rispetta?", 3),
        ("prima o poi capiranno il loro errore", 3),
        ("se non hai i muscoli, non esisti per loro", 3),
        ("se non mi avessero rifiutato, non sarei così", 3),
        new($"se non sei alto 1.{80..95} non hai speranza", 4),
        ("se non sei un alfa, sei invisibile per loro", 3),
        ("se solo avessi i soldi, tutte le donne mi vorrebbero", 3),
        ("sono loro che hanno perso, non io", 3),
        ("sono stufo delle loro bugie e dei loro giochi mentali", 3),
        ("sono troppo buono per loro", 3),
        ("sono troppo intelligente per essere capito dalle donne", 3),
        ("sono tutte troie", 3),
        ("tanto alla fine cercano sempre il più cattivo", 3),
        ("tanto finiscono per essere infelici con quel chad", 3),
        ("tutte le ragazze vogliono solo i chad", 3),
        ("le donne si offendono per niente, ormai", 3),
        ("tutte quelle che mi rifiutano finiranno sole", 3),
    };

    internal static readonly Tag DifettiSocialiIncel = new(DifettiSociali)
    {
        ("misogino", 2),
        ("nichilista", 2),
        ("violento", 2),
        ("pervertito", 2),
        ("incontenibile", 2),
        ("indisponente", 2),
        ("manipolatore", 2),
        ("narcisista", 2),
        ("passivo-aggressivo", 2),
        ("scontroso", 2),
        ("vendicativo", 2),
        ("feticista dei piedi", 3),
    };

    internal static readonly Tag VibesIncel = new(Vibes)
    {
        ("arrabbiato", 2),
        ("deluso", 2),
        ("disilluso", 2),
        ("disperato", 2),
        ("insicuro", 2),
        ("invidioso", 2),
        ("paranoico", 2),
        ("rancoroso", 2),
        ("scontento", 2),
        ("scoraggiato", 2),
        ("triste", 2),
        ("autocommiserante", 2),
        ("vittimista", 2),
        ("autodistruttivo", 2),
        ("rassegnato", 2),
    };

    internal static readonly Tag PercezioneIncel = new(Percezione)
    {
        ("genio incompreso", 2),
        ("emarginato dalla società", 3),
        ("unico uomo vero rimasto", 3),
        ("troppo puro per questo mondo", 3),
        ("ribelle contro il sistema", 3),
        ("lupo solitario", 2),
        ("redpillato", 2),
        ("blackpillato", 2),
        ("eroe tragico", 2),
        ("anima tormentata", 2),
        ("vero uomo", 2),
        ("isolato", 2),
        ("elemento superiore", 2),
        ("abbandonato", 2),
        ("non convenzionale", 2),
        ("immortale", 2),
        ("ribelle", 2),
        ("solitario estremo", 2),
        ("disperato perenne", 2),
        ("intoccabile", 2),
        ("eccentrico", 2),
        ("malinconico eroe", 2),
        ("eternamente giovane", 2),
        ("mentore tormentato", 2),
        ("invisibile", 2),
        ("saggio sofferente", 2),
        ("infallibile", 2),
        ("nemico del sistema", 3),
        ("paladino perduto", 2),
        ("combattente solitario", 2),
        ("individuo fuori dal coro", 3),
        ("giustiziere silenzioso", 2),
        ("solitario by choice", 3),
        ("martire del femminismo", 3),
        ("poveraccio vittima del sistema", 3),
        ("paladino della verità", 3),
    };

    // Estende la lista CONDIVISA sotto la stessa chiave (RuntimeBuilder concatena): la vena
    // cripto dell'incel si aggiunge alle professioni comuni, non le sostituisce.
    internal static readonly Tag ProfessioniIncel = new(Professioni.M)
    {
        ("esperto in criptovalute", 3),
        ("web developer", 2),
        ("programmatore", 2),
        ("programmatore di videogiochi", 3),
        ("analista di dati", 3),
        ("analista di marketing", 3),
        ("imprenditore", 2),
        ("ingegnere del software", 3),
        ("trader di criptovalute", 3),
        ("sviluppatore di smart contract", 3),
        ("analista di mercato cripto", 3),
        ("consulente per investimenti in criptovalute", 3),
        ("amministratore di piattaforme di scambio cripto", 3),
        ("consulente per la tokenizzazione di asset", 3),
    };

    internal static readonly Tag CommentiSprezzantiGenericiIncel = new(CommentiSprezzantiGenerici)
    {
        ("peccato non abbia ancora imparato ad avviare la lavatrice da solo", 3),
        new($"alle {TimeSlot.Notte}, illuminato solo dal monitor mentre mangia merendine sottomarca al buio", 3),
        new($"nella sua testa sta pensando a {Idoli}", 3),
        new($"ma in realtà è palesemente {Vibes}", 3),
        new($"la sua ultima interazione umana risale al {2019..2025}", 3),
        ("la madre gli prepara la merenda tutti i giorni", 3),
        ("e lo hanno capito tutti tranne lui", 3),
    };


    // Piccola lista per dare una variante a una frase altrimenti fissa (senza cambiarne il senso).
    internal static readonly Tag Dispositivo = new("dispositivo")
    {
        "sul pc", "sul telefono", "su un hard disk esterno", "nel cloud",
        "su una chiavetta USB", "sul PC dell'ufficio", "su un vecchio Nokia",
        "in una cartella chiamata 'documenti fiscali'", "su un floppy disk", "in un account Mega",
        "su un NAS in cantina", "dietro una password di quaranta caratteri", "su un Raspberry Pi nascosto",
        "in una nota di iCloud", "su un disco esterno in soffitta",
    };

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        new($"{Idoli} è la sua guida spirituale (forse gli ha dato dei soldi in un corso non ho capito)", 8),
        new($"{Professioni.M.Fissato} che odia {Hating}", 2),
        new($"odia solo {Hating}, per il resto ok, gode persino {Hating}", 4),
        new($"è convinto di non essere più giovane per la riproduzione (anche se ha solo {Eta.Minorenne} anni)", 7),
        new($"{Professioni.M.Fissato} che non apprezza {Hating}", 3),
        new($"ha un tatuaggio con scritto _‘{Percezione}’_ (fatto nello scantinato di un tizio a {City.Any} e rigorosamente con un errore di battitura)", 25),
        new($"ha {Eta.Giovane} anni, ma già malsopporta {Hating} e lo dimostra lamentandosi con frasi di circostanza tipo _‘{FrasiTipiche}’_", 7),
        new($"fa commenti da {DifettiSociali} su {Social.Any}, sempre con frasi tipo _‘{FrasiTipiche}’_", 6),
        new($"fa commenti da {DifettiSociali} sul suo {Social.Any} (da un profilo rigorosamente con l'avatar di un personaggio degli anime)", 8),
        new($"cerca di emulare lo stile di {Idoli} (comprando online {AbbigliamentoScadente} di {2..3} taglie più grandi)", 25),
        new($"{DifettiSociali} nei commenti ai post su {Hating}", 3),
        new($"ha {Eta.Giovane} anni e si comporta sempre da {DifettiSociali}, dicendo cose tipo _‘{FrasiTipiche}’_, o comunque un concetto simile", 7),
        new($"ha {Eta.Giovane} anni e una tendenza a essere {Vibes}", 4),
        new($"ha un modo distorto di vedere {Hating}, in realtà è solo {DifettiSociali}", 4),
        new($"il perfetto ritratto di un {Eta.Giovane}enne {Vibes}", 3),
        new($"considera l'uso quotidiano del deodorante un'inutile imposizione indovinate di chi?... Esatto, {Hating}!", 4),
        new($"la prima cosa sulla sua lista nera è: {HatingConcetti}", 4),
        new($"se c'è una cosa che crede di aver imparato da {Idoli} è che: _‘{FrasiTipiche}’_ ({CommentiSprezzantiGenerici})", 10),
        new($"non ha mai avuto successo con la {Donne} (non mi sorprende dato che dice sempre _‘{FrasiTipiche}’_)", 9),
        new($"non si è mai fidanzato, lui è un _‘{Percezione}’_", 6),
        new($"nonostante i suoi {Eta.Giovane} anni è ancora {DifettiSociali}", 3),
        new($"nonostante i suoi {Eta.Giovane} anni, è sempre {DifettiSociali} e la sua frase distintiva è _‘{FrasiTipiche}’_ (ultimamente ha il coraggio di dirlo persino quando si parla di {Hating})", 10),
        new($"odia {Hating} oltre che se stesso", 3),
        new($"odia tutto ciò che riguarda {Hating} e lo dice sommessamente su {Social.Any} ({CommentiSprezzantiGenerici})", 10),
        new($"sempre e comunque {DifettiSociali}", 2),
        new($"si autodefinisce un _‘{Percezione}’_ su {Social.Any} ({CommentiSprezzantiGenerici})", 9),
        new($"si definisce un _‘{Percezione}’_ e su {Social.Any} continua a dire cose tipo _‘{FrasiTipiche}’_", 6),
        new($"si definisce un _‘{Percezione}’_ ma è solo {Vibes}", 5),
        new($"si dimostra sempre {DifettiSociali} su {Social.Any}", 4),
        new($"è un _‘{Percezione} di {Eta.Giovane} anni e {Percezione}’_ ({CommentiSprezzantiGenerici})", 8),
        new($"si vanta su {Social.Any} di essere un _‘{Percezione}’_ e ripete _‘{FrasiTipiche}’_ con un tono da {Vibes}", 7),
        new($"si vanta su {Social.Any} di essere un _‘{Percezione}’_ ({CommentiSprezzantiGenerici})", 9),
        new($"{Vibes} di {Eta.Giovane} anni che su {Social.Any} ripete sempre cose strane tipo _‘{FrasiTipiche}’_", 6),
        new($"{Vibes} di {Eta.Giovane} anni", 2),
        new($"{Professioni.M.Fissato} {DifettiSociali}", 2),
        new($"ascolta le OST dei videogiochi (perché _‘la musica commerciale è in mano a...? Esatto, {HatingPersone}!’_)", 6),
        new($"con complessi sulle dimensioni del suo pene ({CommentiSprezzantiPene})", 15),
        new($"{Eta.Giovane}enne {Vibes} che si lamenta spesso dicendo cose tipo _‘{FrasiTipiche}’_", 6),
        new($"{Eta.Giovane}enne {Vibes} che su {Social.Any} dice _‘{FrasiTipiche}’_ ogni giorno", 6),
        new($"{Eta.Minorenne}enne che si definisce un _‘{Percezione} che ha capito come gira il mondo: {FrasiTipiche}’_", 6),
        new($"su {Social.Any} ha la bio _‘{Percezione} - {FrasiTipiche}’_ te lo ricordi perché è {DifettiSociali}", 6),
        new($"{Eta.Giovane}enne che su {Social.Any} si lamenta con argomenti riassumibili in una frase: _‘{FrasiTipiche}’_", 6),
        new($"è contro: {Hating}, {Hating}, {Hating}, {Hating}, {Hating} e sorpresa sorpresa... {Hating}!", 4),
        new($"{Vibes} di {Eta.Giovane} anni che ama dire _‘{FrasiTipiche}’_ su {Social.Any}", 6),
        new($"si vanta del pene sopra i {6..12} cm ({CommentiSprezzantiPene})", 25),
        new($"ha fondato il fanclub _‘A Morte {HatingConcetti}’_ (che attualmente conta l'incredibile cifra di {4..25} membri)", 9),
        new($"ha uno strano feticcio per i piedi (che gli si aggrava quando pensa alla {Donne}), e sarà perché in fondo è {Vibes}", 8),
        new($"misura i polsi ogni mattina per controllare di non aver perso circonferenza ossea (ed è terrorizzato che {OggettiStatus} preso a {City.Any} sembri troppo grande)", 25),
        new($"ha calcolato l'angolo perfetto della sua mandibola usando un goniometro comprato dai cinesi e lo paragona a quello dei modelli su {Social.Any}", 35),
        new($"conserva una cartella criptata {Dispositivo} con le foto delle mani di altri uomini per fare confronti ossessivi", 35),
        new($"ha comprato delle solette rialzanti da {2..5} cm su {Marketplace.Any} per sembrare più alto", 15),
        new($"si atteggia a _‘{Percezione}’_ con tutti, ma la sua più grande paura è {TerroriQuotidiani}", 12),
        new($"nella sua testa è un alfa intoccabile, nella realtà è terrorizzato da una cosa: {TerroriQuotidiani}", 12),
        new($"si definisce un _‘{Percezione}’_ su {Social.Any} (eppure va nel panico al solo pensiero di {TerroriQuotidiani})", 9),
        // NB: DateRangeSlot rende già "dal … al …" per i range → il template NON premette "dal"/"durante".
        new($"è stato mollato dalla {Donne} {DateRangeSlot.Estate}, giusto per rovinargli l'estate", 12),
        new($"alle {TimeSlot.Notte} controlla il cellulare ogni {2..5} minuti cercando messaggi che non arriveranno mai", 12),
        new($"il {Parente.M} l'ha disconosciuto {DateRangeSlot.Lavorativi} (troppo tardi per rimediare)", 9),
    ];
}
