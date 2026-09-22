using Nome = Backend.Generators.SharedContent.Nome;
using City = Backend.Generators.SharedContent.City;
using Professioni = Backend.Generators.SharedContent.Professioni;
using Parente = Backend.Generators.SharedContent.Parente;
using Eta = Backend.Generators.SharedContent.Eta;
using Giorni = Backend.Generators.SharedContent.Giorni;
using Social = Backend.Generators.SharedContent.Social;
using Marketplace = Backend.Generators.SharedContent.Marketplace;

namespace Backend.Generators.Catalog;

/// <summary>
/// Contenuti del Lombroso Scanner: i 36 archetipi come <see cref="GeneratorVariant"/> (uno stile,
/// non una vera analisi) più un Core combinatorio che li ricombina con le liste CONDIVISE (nomi,
/// città, professioni, parenti, età, giorni...) — le stesse di Oroscopo/Incel/Mbeb — così i 36
/// restano il PUNTO DI PARTENZA fisso (titolo + indizio, sempre gli stessi per lo stesso archetipo)
/// mentre il "corredo probatorio" intorno varia a ogni scatto.
/// </summary>
/// <remarks>
/// <see cref="IHiddenGenerator"/> di proposito: l'auto-discovery in <c>GeneratorRegistration</c> lo
/// esclude dal catalogo pubblico (<c>GET /generators</c>) — <see cref="Services.LombrosoScanner"/> lo
/// istanzia e compila a mano, sceglie L'ARCHETIPO dall'hash del client (non a caso, "stesso frame →
/// stesso archetipo" resta vero), e lascia che sia il Core a variare col normale RNG del motore.
/// </remarks>
public sealed class LombrosoGenerator : GeneratorBase, IHiddenGenerator
{
    /// <summary>Indizio pseudo-antropometrico originale dell'archetipo — fissato dalla <see cref="Variant"/>
    /// scelta (un valore per archetipo): il pool qui è solo fallback/validazione di boot, mai realmente
    /// pescato. Il TITOLO invece non passa dal motore: è <see cref="GeneratorVariantOption.Label"/>,
    /// letto direttamente da <see cref="Services.LombrosoScanner"/> — non serve interpolarlo in una
    /// Frase per usarlo (e infatti l'unica Frase che lo cita sarebbe l'Apertura, dove risulterebbe
    /// ridondante: il frontend mostra già il titolo separato dal testo generato).</summary>
    internal static readonly Tag Indizio = new("lombroso-indizio") { "Nessuna stigmata rilevata." };

    /// <summary>Strumenti (parodia) del gabinetto lombrosiano — alcuni veri (antropometro, estesiometro,
    /// ergografo, craniometro di Broca), altri assurdi per estensione: prima era un solo strumento
    /// fisso citato sempre uguale nel Core, ora un Tag come gli altri, varietà a ogni generazione.</summary>
    internal static readonly Tag Strumento = new("lombroso-strumento")
    {
        "l'antropometro (di legno, 1876)",
        "l'estesiometro per la soglia del dolore",
        "l'ergografo per la fatica muscolare",
        "il craniometro di Broca, requisito al museo apposta per l'occasione",
        "un calibro da falegname riadattato",
        "il dinamometro a molla, tarato l'ultima volta nel secolo scorso",
    };

    /// <summary>Gergo misto: i termini VERI di Lombroso (indice cefalico, angolo facciale, bernoccolo
    /// dell'onestà — vedi MEASURING_STEPS nel frontend) accanto a quelli altrettanto pseudo-scientifici
    /// del looksmaxxing da forum (canthal tilt, gonial angle, midface ratio, hunter eyes): la stessa
    /// ossessione di misurare il volto per dedurne un giudizio assoluto, un secolo e mezzo dopo.</summary>
    internal static readonly Tag Gergo = new("lombroso-gergo")
    {
        "l'indice cefalico", "l'angolo facciale", "il bernoccolo dell'onestà",
        "il canthal tilt", "il gonial angle", "il midface ratio", "lo sguardo da hunter eyes",
    };

    /// <summary>Come si chiude (per ora) il fascicolo — varietà sull'esito, mai una vera conseguenza:
    /// il bersaglio resta la pseudoscienza stessa, non un destino a cui credere davvero.</summary>
    internal static readonly Tag Esito = new("lombroso-esito")
    {
        "il fascicolo resta aperto a tempo indeterminato",
        "il caso passa al collega del turno successivo, che lo riaprirà identico",
        "la pratica viene archiviata per manifesta assurdità, salvo essere riaperta per abitudine",
        "il verdetto finisce affisso in bacheca, giusto per la cronaca",
    };

    /// <summary>
    /// Prova debole, COMBINATA: nome + città + professione in un'unica frase riusabile — stesso
    /// principio di annidamento di Incel/Complotto (una voce di Tag che è essa stessa un'interpolazione
    /// con altri Tag dentro, non solo testo fisso). Va dichiarata DOPO i Tag che cita (Nome/City/
    /// Professioni sono condivisi, sempre pronti; l'ordine conta solo per i campi di QUESTA classe).
    /// </summary>
    internal static readonly Tag ProvaDebole = new("lombroso-prova-debole")
    {
        new($"un testimone di nome {Nome.Any}, residente a {City.Any}, giura di averti riconosciuto sul luogo esatto dei fatti", 2),
        new($"il fascicolo cita un {Professioni.M} di {City.Any} come consulente esterno, pagato profumatamente e mai davvero interpellato", 2),
        new($"un {Professioni.M} anonimo ha segnalato tutto da {City.Any}, salvo ritrattare in {Giorni.Any}", 2),
    };

    public override string Slug => "lombroso";

    public override GeneratorInfo Info { get; } = new()
    {
        Name = "Lombroso Scanner",
        Description = "Verdetto pseudo-antropometrico (parodia) — non un generatore autonomo, orchestrato da LombrosoScanner.",
    };

    public override GenerationSettings? PhraseSettings { get; } = new()
    {
        // Scala allineata a Incel/Complotto (3-4 frasi, non 2-3): con un Core più ampio regge meglio.
        MinPhrases = 3,
        MaxPhrases = 4,
        Separators = [". ", "; ", ".\n"],
        // Come Complotto (MinScore 10): con frasi da punteggio 2-4 e 3-4 frasi, quasi sempre superata
        // al primo tentativo, ma scarta le rare combinazioni troppo scarne.
        MinScore = 10,
    };

    /// <summary>
    /// Come Incel/Complotto: le liste condivise più "affollate" da questo generatore (città,
    /// professione, parente) contano UNA sola volta per generazione, anche se citate da più frasi
    /// diverse del Core (direttamente o via <see cref="ProvaDebole"/>) — evita il "due testimoni
    /// diversi nella stessa città" o "due professionisti citati" nello stesso verdetto.
    /// </summary>
    public override List<string>? ExclusiveGroups { get; } =
        [City.Any.Key, Professioni.M.Key, Parente.M.Key];

    /// <summary>Sempre presente: il verdetto originale dell'archetipo, testo piano (niente Markdown —
    /// il frontend lo mostra come semplice `desc`, non lo passa per il pipe `markdown`). Spazio finale
    /// esplicito: Composer non inserisce da sé un separatore tra Apertura e il Core (a differenza che
    /// tra una frase del Core e l'altra), quindi senza andrebbero a incollarsi senza soluzione.</summary>
    public override Frase? Apertura { get; } = new($"{Indizio.Fissato} ");

    /// <summary>Punto d'apertura esplicito: se la frase precedente finisce già con punteggiatura,
    /// ArmonizzaTesto collassa il doppio segno in uno solo (vedi GeneratorService), quindi è sempre
    /// sicuro — anche quando l'ultima frase del Core non ha punteggiatura propria.</summary>
    public override Frase? Chiusura { get; } =
        ". Fascicolo aggiornato a oggi, Museo di Antropologia Criminale di Torino (1876) — misurazioni non validate da alcun ente scientifico.";

    /// <summary>
    /// "Corredo probatorio" generico: si combina con QUALUNQUE archetipo (nessun <c>SoloOpzione</c>),
    /// pescando dalle liste condivise — stesso principio delle frasi di Oroscopo/Incel, tono coerente
    /// con la parodia pseudo-scientifica (mai un tratto reale, sempre il metodo/l'assurdo del verdetto).
    /// </summary>
    public override List<Frase> Core { get; } =
    [
        // ── Prova debole (nome+città+professione annidati, vedi ProvaDebole) ──────────────
        new($"{ProvaDebole}", 2),
        new($"{ProvaDebole}, ma ritratta tutto appena arriva {Strumento}", 3),

        // ── Strumentazione e gergo, variabili a ogni scatto ───────────────────────────────
        new($"{Strumento} assegna un indice di sospettosità di {60..99} su 100", 2),
        new($"Secondo {Strumento}, {Gergo} è fuori norma di almeno {2..15} punti", 3),
        new($"{Gergo} risulta borderline: né innocente né colpevole, ma lo scanner non contempla vie di mezzo", 2),
        new($"Il valore di {Gergo} viene ricontrollato tre volte: cambia ogni volta, il verdetto no", 3),

        // ── Precedenti e statistiche pseudo-scientifiche ──────────────────────────────────
        new($"Secondo l'atlante, chi presenta questa stigmata ha in media {18..70} precedenti per reati altrettanto immaginari", 2),
        new($"Età presunta secondo l'ergografo: {Eta.Adulto} anni, ma nelle foto segnaletiche dimostra di meno", 2),
        new($"Il fascicolo digitale segna {1..9} procedimenti pendenti, tutti apertisi lo stesso {Giorni.Any}", 2),

        // ── Parente/testimoni di famiglia (Parente.M per l'accordo, vedi sopra) ───────────
        new($"Tuo {Parente.M} conferma: \"lo dicevo sempre, quello sguardo non mi tornava\"", 3),
        new($"Tuo {Parente.M} produce come prova una foto di {2..15} anni fa, comunque ammissibile", 2),

        // ── Giudiziario/burocratico, con città (ExclusiveGroups la limita a una sola comparsa) ──
        new($"Prossima udienza fissata a {City.Any}, ma nessuno ha ancora trovato l'aula", 2),
        new($"Il verbale, redatto a {City.Any}, riporta {Gergo} sbagliato per errore di trascrizione — non cambia il verdetto", 2),

        // ── Eco social/commerciale del verdetto ───────────────────────────────────────────
        new($"Un annuncio su {Marketplace.Any} venderebbe già la tua \"vera storia\" per {5..40} euro, spese di spedizione escluse", 2),
        new($"Su {Social.Any} circola già uno screenshot del verdetto, con didascalia \"chiamate un {Professioni.M}\"", 2),
        new($"Su {Social.Any}, {Nome.Any} ha già commentato \"lo sapevo\" senza aver letto il fascicolo", 2),

        // ── Esito e prossimi passi ─────────────────────────────────────────────────────────
        new($"Prossimo controllo di routine: {Giorni.Any}, salvo imprevisti — ce ne saranno", 2),
        new($"Per ora {Esito}", 2),
        new($"Il collega di turno propone una seconda misurazione con {Strumento}; {Esito}", 3),
    ];

    /// <summary>
    /// I 36 archetipi originali (titolo + indizio), portati 1:1 dalla versione precedente
    /// (<c>lombroso.component.ts</c>/prima <c>LombrosoScanner.Verdicts</c>): stesso testo, ora
    /// come punto di partenza combinabile invece che verdetto fisso e isolato.
    /// </summary>
    public override GeneratorVariant? Variant { get; } = new("archetipo", "Archetipo Lombroso",
    [
        Opt("polli", "Ladro di polli seriale", "Zigomi sporgenti, gonial angle acuto e canthal tilt positivo da manuale: profilo da pollaio conforme in ogni misura."),
        Opt("innocente", "Innocente ma sospetto", "Midface ratio nella norma, canthal tilt neutro: nessuna stigmata rilevata — ed è proprio questo, secondo lo scanner, a insospettire."),
        Opt("doppiafila", "Recidivo da parcheggio in doppia fila", "Lieve prognatismo e gonial angle da bulldog: mascella di chi non arretra di un centimetro, tanto meno in retromarcia."),
        Opt("barsport", "Sovversivo da bar sport", "Seni frontali pronunciati e arcata sopraccigliare a tenda: la fronte grida \"arbitro venduto\" da sola."),
        Opt("distributori", "Manomettitore di distributori automatici", "Mani grandi rispetto al busto, ergografo compatibile con lo scuotimento energico."),
        Opt("poste", "Evasore della fila alle Poste", "Mandibola sviluppata e gonial angle da looksmaxxing riuscito, tipica di chi si intrufola senza chiedere permesso."),
        Opt("code", "Tagliatore di code al supermercato", "Orecchie a manico d'ansa e lieve asimmetria del padiglione: nell'atlante del 1876 era già un classico."),
        Opt("whatsapp", "Sabotatore di gruppi WhatsApp", "Asimmetria cranica lieve, compatibile con il \"rispondo dopo\"."),
        Opt("ombrellone", "Occupante abusivo di ombrellone", "Zigomi larghi, sguardo da hunter eyes e indice cranico da mattiniero seriale: primo in spiaggia, primo ovunque."),
        Opt("disabili", "Falso invalido nel parcheggio disabili", "Fronte sfuggente e canthal tilt negativo: il Museo di Torino non avrebbe avuto dubbi."),
        Opt("parmigiano", "Rosicatore di parmigiano altrui dal frigo condiviso", "Narici dilatate, compatibili con l'intenditore furtivo."),
        Opt("rispondiatutti", "Molestatore seriale del pulsante \"rispondi a tutti\"", "Mandibola pronunciata e midface ratio da manuale, tipica del reply-all recidivo."),
        Opt("chad30", "Guru del corso \"Diventa Chad in 30 giorni\"", "Gonial angle da miniatura di YouTube, canthal tilt corretto in post-produzione: l'antropometro non mente, il pacchetto Premium sì."),
        Opt("integratori", "Rivenditore di integratori per il gonial angle", "Scorta di flaconi \"BoneBroth Maxxer\" nel bagagliaio, mandibola pubblicizzata come \"chirurgicamente naturale\"."),
        Opt("piramide", "Fondatore di una piramide di affiliazioni in criptovalute", "Zigomi da webinar, sorriso da landing page: promette il 10x a chi entra prima delle 23:59."),
        Opt("redpillimm", "Life coach della \"red pill\" immobiliare", "Fronte ampia da stratega, portafoglio da esordiente: il vero investimento resta il suo corso da 997€."),
        Opt("seduzione", "Truffatore di corsi di seduzione via videochiamata", "Canthal tilt disegnato col trucco, voce da podcast motivazionale: \"hunter eyes\" garantite o rimborso (mai)."),
        Opt("calibri", "Rivenditore di calibri e gadget da looksmaxxing sul Marketplace", "Un calibro di plastica e un \"mewing trainer\" di gomma: l'antropometro certifica solo la truffa, non la mascella."),
        Opt("nft", "Promotore di NFT del \"volto perfetto\"", "Midface ratio calcolato su un'immagine generata, portafoglio crypto vuoto da tre cicli di mercato consecutivi."),
        Opt("multilivello", "Ambasciatore non retribuito di un multilivello di proteine", "Zigomi enfatizzati dal filtro, scorta di barrette invendute in garage: indice cranico da chi ci crede ancora."),
        Opt("mewing", "Fondatore della setta del \"mewing estremo\"", "Mandibola serrata H24 nonostante il dentista lo sconsigli da anni, seguaci convinti comunque."),
        Opt("coachforum", "Coach di looksmaxxing certificato da un forum", "Diploma auto-rilasciato, gonial angle misurato con un righello dell'IKEA: stessa serietà del calibro, zero credenziali in più."),
        Opt("affiliato3", "Affiliato di terzo livello in una piramide di corsi motivazionali", "Presentazione da quaranta slide, unico guadagno reale quello di chi gliel'ha venduta."),
        Opt("cryptoidolo", "Investitore nella criptovaluta lanciata dal suo idolo da \"red pill\"", "Convinto sia \"la prossima Bitcoin\": portafoglio già a -97%, canthal tilt inalterato."),
        Opt("bootcamp", "Ex allievo del bootcamp \"Alpha Transformation Weekend\"", "Certificato plastificato in tasca, prognatismo da chi sostiene ancora sia valso i 1.500€."),
        Opt("scout", "Sostenitore instancabile degli scout", "Nodo Savoia già pronto nel taschino, mandibola quadrata da capo-reparto: fedeltà al giglio rilevata anche a quarant'anni suonati."),
        Opt("postonlibero", "Occupante di un parcheggio non ancora libero", "Piedi piantati sulla striscia bianca: gonial angle da guardiano non retribuito, il posto è già suo."),
        Opt("incontinente", "Incontinente verbale cronico", "Midface iperattivo, nessuna pausa articolatoria rilevata dallo scanner: il flusso prosegue anche in assenza di ascoltatori."),
        Opt("sovrapponitore", "Sovrapponitore seriale di conversazioni altrui", "Mandibola già in movimento mentre l'interlocutore è a metà frase: ha sempre \"giusto una cosa veloce\" da aggiungere."),
        Opt("sminuitore", "Sminuitore professionista dei problemi altrui", "Sopracciglio sollevato in automatico a ogni lamentela ricevuta, seguito immancabilmente da \"eh ma io ho avuto di peggio\"."),
        Opt("pedante", "Pedante correttore compulsivo", "Indice cranico da enciclopedia vivente, mandibola pronta a intervenire su ogni congiuntivo sbagliato altrui — richiesto o meno."),
        Opt("telefonoauto", "Automobilista con lo sguardo fisso sul telefono", "Canthal tilt rivolto verso il basso, verso lo schermo, non verso la strada: priorità alterate secondo ogni misurazione."),
        Opt("telefonoparla", "Interlocutore che guarda il telefono mentre gli parli", "Hunter eyes puntati altrove, sul telefono, mentre annuisce a un discorso che non sta ascoltando."),
        Opt("lamentoso", "Lamentoso cronico", "Rughe di espressione già scavate in assetto permanente \"poteva andare peggio, e infatti\"."),
        Opt("glaciale", "Rispondente perennemente glaciale", "Temperatura del tono costantemente sotto zero indipendentemente dalla domanda ricevuta: un \"ok\" è già un'apertura generosa."),
        Opt("mansplainer", "Mansplainer seriale", "Sopracciglio inarcato in modalità \"lascia che ti spieghi\": midface ratio di chi crede di aver capito tutto per primo."),
    ]);

    private static GeneratorVariantOption Opt(string key, string titolo, string indizio) =>
        new(key, titolo, new Dictionary<string, IReadOnlyList<string>>
        {
            [Indizio.Key] = [indizio],
        });
}
