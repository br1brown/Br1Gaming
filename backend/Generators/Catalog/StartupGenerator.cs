
// Alias tipizzati per i contenuti condivisi: niente stringhe magiche nei segnaposto.
using static Backend.Generators.SharedContent;
using City = Backend.Generators.SharedContent.City;
using Giorni = Backend.Generators.SharedContent.Giorni;
using Nome = Backend.Generators.SharedContent.Nome;
using Parente = Backend.Generators.SharedContent.Parente;
using Professioni = Backend.Generators.SharedContent.Professioni;
using Social = Backend.Generators.SharedContent.Social;
using TimeSlot = Backend.Generators.SharedContent.TimeSlot;

namespace Backend.Generators.Catalog;

/// <summary>
/// Generatore di IDEE "da terza birra": NON un imprenditore, ma il tizio qualunque a cui è capitata
/// ‘un'idea incredibile’ per un'app — una roba banale o che esiste già, raccontata senza saperlo.
/// Bersaglio: non la persona (nessun giudizio su di lei), ma la CONVINZIONE di innovare copiando
/// innovazioni altrui senza accorgersene — quindi mai un nome di prodotto/concorrente reale, mai il
/// narratore che dice "è inutile": la si riconosce da sola dalla specificità di <c>[funzione]</c>, non
/// da un verdetto. Niente pitch/round/business plan, niente gergo da soli addetti ai lavori. Ordine:
/// <list type="bullet">
///   <item><b>l'IDEA</b> (<see cref="Apertura"/>, prima di tutto): il titolo — <c>[piattaforma]</c> per
///         una <c>[funzione]</c> raccontata nei minimi dettagli, con un twist <c>[dettaglio_specifico]</c>
///         opzionale;</item>
///   <item><b>il TIPO</b> (sotto, in corsivo): chi l'ha avuta — <c>[nome-m]</c>, <c>[professioni]</c> — e
///         la <c>[genesi]</c>: un momento passivo e qualunque (mai "ci ha lavorato sopra");</item>
///   <item><b>la DESCRIZIONE</b> (<see cref="Core"/>): sottovaluta la difficoltà (‘la fa il cugino’), poi
///         elabora solo l'idea — a chi servirebbe, come "funziona", come ci guadagna. Mai una scena sulla
///         persona: il bersaglio è sempre l'idea.</item>
/// </list>
/// Gruppi esclusivi (anche locali multi-tag): un solo tema per testo, niente ripetizioni.
/// </summary>
public sealed class StartupGenerator : GeneratorBase
{
    // Segnaposto LOCALI tipizzati: la chiave vive qui, liste e frasi referenziano il simbolo.
    // ══ TESTA ══ (nell'apertura: non concorrono al punteggio)
    internal static readonly Tag Piattaforma = new("piattaforma")
    {
        "Un'app", "Un sito", "Un'applicazione desktop", "Un gestionale", "Un portale", "Un social", "Un marketplace", "Una piattaforma",
        "Un bot di Telegram", "Un'estensione del browser", "Un tool con l'IA", "Un aggregatore", "Un chatbot", "Un'app in realtà aumentata",
        "Un canale WhatsApp", "Un widget da mettere sul telefono", "Un abbonamento in stile Netflix", "Un NFT (non ha capito cosa sia)",
    };

    // Pezzi VARIABILI che alcile filzioni pescano (come i "dove" della genesi): più combinazioni, meno noia.
    // L'articolo sta nella voce, così l'incastro concorda sempre ("per {la cappa}", "se {lo yogurt} è buono").
    internal static readonly Tag Mestiere = new("mestiere")
    {
        "l'elettricista", "l'idraulico", "il fabbro", "il tecnico della caldaia",
        "il tuttofare", "l'antennista", "il vetraio", "il giardiniere",
        "il muratore", "l'imbianchino", "il piastrellista", "il condizionatorista",
        "lo spazzacamino", "il gommista", "il corniciaio", "il tappezziere",
    };
    internal static readonly Tag Attrezzo = new("attrezzo")
    {
        "il trapano", "la scala", "il tagliaerba", "l'idropulitrice",
        "l'avvitatore", "il decespugliatore", "la levigatrice", "il carrello",
        "il flessibile", "la betoniera", "il tagliasiepi", "la sega circolare",
        "la chiave inglese", "il martello pneumatico", "la pistola termica", "il saldatore",
    };
    internal static readonly Tag Elettrodomestico = new("elettrodomestico")
    {
        "la cappa", "la lavatrice", "l'aspirapolvere", "il condizionatore",
        "l'addolcitore", "la caldaia", "il depuratore dell'acqua", "la lavastoviglie",
        "il forno", "il congelatore", "l'asciugatrice", "il boiler",
        "la friggitrice ad aria", "il robot da cucina", "lo scaldabagno", "il tritarifiuti",
    };
    internal static readonly Tag Alimento = new("alimento")
    {
        "il latte", "lo yogurt", "la panna", "il sugo aperto",
        "la maionese", "il pesto", "quel formaggio", "l'affettato",
        "il tonno in scatola aperto", "la ricotta", "il mascarpone", "quel würstel",
        "il ragù di domenica scorsa", "la mozzarella nel siero", "quello yogurt greco", "il burro dimenticato fuori",
    };

    /// <summary>Le IA che "fanno tutto loro": brand reali. Prima di Percepito, che le cita.</summary>
    internal static readonly Tag Ai = new("ai")
    {
        "ChatGPT", "un'IA", "l'intelligenza artificiale", "Gemini", "Copilot", "Claude",
        "Grok", "Perplexity", "DeepSeek", "Mistral", "un modello open source", "un'AI cinese",
        "un'IA che ha visto in un reel", "Alexa", "quel robot di ChatGPT",
    };

    // Funzioni generiche: versioni "da bar" di app che esistono già a bizzeffe. Nessun nome di brand.
    // Due registri: (1) plausibili-ma-esistono-già; (2) iper-banali mono-scopo (l'app per la cosa
    // talmente minima che non ti serve un'app). Più voci = meno ripetizione, quindi meno noia.
    internal static readonly Tag Funzione = new("funzione")
    {
        new($"trovare persone con le tue stesse passioni nella zona di {City.Any}"),
        "dirti cosa cucinare con quello che hai nel frigo",
        "riconoscere una pianta da una foto",
        "dirti se un prodotto del supermercato fa male",
        new($"trovare lavoro nella zona di {City.Any}"),
        "dividere le spese tra amici",
        "prenotare dal barbiere senza telefonare",
        new($"trovare un parcheggio libero vicino a {Genera("locali")}"),
        "sapere a che ora passa davvero l'autobus",
        "vendere le cose che non usi più",
        "condividere la macchina con chi fa la tua strada",
        "trovarti compagni per andare in palestra",
        "ricordarti di bere l'acqua",
        "organizzarti le vacanze col budget che hai",
        "farti portare la spesa a casa",
        // ── Plausibili, ma esistono già a bizzeffe ──
        "sapere quale fila è più corta al supermercato",
        new($"trovare qualcuno che ti presta {Attrezzo} nella zona di {City.Any}"),
        "ricordarti quando scadono documenti e bollette",
        "confrontare automaticamente i prezzi dei supermercati vicini",
        "sapere se un negozio è davvero aperto in questo momento",
        new($"trovare {Mestiere} disponibile entro un'ora"),
        new($"scoprire gli eventi gratuiti nella zona di {City.Any} questo weekend"),
        "condividere gli avanzi di cibo invece di buttarli",
        "trovare persone con cui studiare la stessa materia",
        "calcolare quanto spendi davvero ogni mese",
        "trovare il distributore di benzina più conveniente lungo il percorso",
        "ricordarti dove hai parcheggiato",
        "ricevere un avviso quando un prodotto torna disponibile",
        "organizzare automaticamente i turni di una squadra",
        new($"trovare chi porta a spasso il cane nella zona di {City.Any}"),
        "sapere quanto vale un oggetto fotografandolo",
        "ricevere un avviso quando piove dove sei",
        "trovare un tavolo libero nei locali senza telefonare",
        "condividere l'abbonamento della palestra con un amico",
        "trovare il percorso più sicuro per tornare a casa",
        "sapere se una recensione online è probabilmente falsa",
        "ricordarti tutte le garanzie dei prodotti acquistati",
        "ricevere offerte solo sui prodotti che compri davvero",
        new($"trovare babysitter disponibili nella zona di {City.Any}"),
        "organizzare automaticamente una lista della spesa per la settimana",
        "sapere quanta fila c'è al pronto soccorso",
        "trovare campi sportivi liberi da prenotare",
        "riconoscere automaticamente un problema dell'auto dal rumore",
        "conservare tutti gli scontrini in automatico",
        "trovare il regalo perfetto in base alla persona e al budget",
        "sapere se una casa è un buon affare prima di visitarla",
        "trovare persone con cui condividere un ufficio",
        "calcolare il momento migliore per partire evitando il traffico",
        new($"trovare chi può dare ripetizioni nella zona di {City.Any}"),
        "ricordarti quando cambiare pneumatici, filtri e manutenzione",
        "sapere se un prezzo è davvero conveniente rispetto allo storico",
        "organizzare automaticamente i documenti importanti",
        "trovare fotografi, musicisti o professionisti disponibili per un evento",
        "ricevere un avviso quando un volo scende sotto il tuo budget",
        "trasformare automaticamente appunti scritti a mano in testo ordinato",
        // ── Iper-banali ma PLAUSIBILI: la cosa minima, ma è l'idea che qualcuno la pensa davvero ──
        "sapere quale telecomando controlla quel dispositivo",
        "ricordarti dove hai nascosto i regali di Natale",
        new($"dirti se {Alimento} è ancora buono senza aprirlo"),
        "capire quale chiave apre quella serratura",
        new($"farti ricordare dove hai messo {Attrezzo}"),
        "calcolare se hai abbastanza avanzi per evitare di cucinare",
        "dirti se vale la pena fare la fila in quel locale",
        "ricordarti l'ultima volta che hai cambiato le lenzuola",
        "scegliere quale maglietta mettere in base a quelle che non usi da tempo",
        "ricordarti chi ti ha prestato quel libro",
        "ricordarti a chi hai prestato quel libro",
        "dirti se hai già visto quel film",
        "ricordarti quale vino era quello che ti era piaciuto",
        new($"capire se hai già trovato il {Piatti.M} al supermercato"),
        new($"capire se hai già trovato la {Piatti.F} al supermercato"),
        new($"dirti se {Giorni.Any} hai già annaffiato la pianta"),
        new($"ricordarti quale filtro comprare per {Elettrodomestico}"),
        new($"ricordarti dove hai parcheggiato la bici nella zona di {City.Any}"),
        "dirti quale vite serve per quel mobile IKEA",
        new($"ricordarti in quale scatolone hai messo {Elettrodomestico} durante il trasloco"),
        "ricordarti quale password hai cambiato sul televisore",
        new($"dirti se hai già chiamato tua {Parente.F} questa settimana"),
        "dirti quale finestra hai lasciato aperta",
        "calcolare se hai abbastanza batteria per arrivare a casa",
        "ricordarti dove hai lasciato l'ombrello l'ultima volta",
        "ricordarti dove hai salvato quel PDF importantissimo",
        new($"trovare un kebab ancora aperto a {City.Any} alle {TimeSlot.Notte}"),
        "sapere se conviene aspettare i saldi o comprarlo adesso",
        new($"dirti se tuo {Parente.M} ti sta chiamando per soldi prima ancora di rispondere"),
    };

    // Il twist iper-specifico tra parentesi: qui ogni tanto spunta la città.
    internal static readonly Tag DettaglioSpecifico = new("dettaglio_specifico")
    {
        new($"con {Ai} che ti capisce l'umore"),
        new($"nel range di {2..8} km da {City.Any}"),
        new($"ma solo per gente di {City.Any}"),
        "con le notifiche push",
        new($"nel dialetto di {City.Any}"),
        "ma senza pubblicità, quindi gratis per sempre",
        "con un sistema di punti che non serve a niente",
        "con la blockchain (non sa spiegare perché)",
        "con un avatar 3D che ti fa l'occhiolino",
        new($"ma solo in dialetto stretto di {City.Any}"),
        "con un abbonamento premium a 99 centesimi al mese",
        new($"con la voce di sua {Parente.F} come assistente"),
        "che funziona anche offline (ma serve internet)",
        "con un badge da sbloccare tipo Duolingo",
        "gamificata, con le monetine finte",
    };

    // Il twist NON è vincolato alla parentesi: spesso il titolo resta pulito, quando c'è di solito scorre
    // INLINE come parte della funzione (dopo una virgola) e solo ogni tanto tra parentesi. Selezione
    // uniforme + chiavi locali che non deduplicano → il rapporto lo dà la molteplicità delle voci: qui
    // ~metà titoli puliti, un quarto inline, un quarto tra parentesi.
    internal static readonly Tag Dettaglio = new("dettaglio")
    {
        "",
        "",
        "",
        "",
        new($", {DettaglioSpecifico}"),
        new($" _({DettaglioSpecifico})_"),
    };

    // ══ CENTRO ══ (pesati: entrano nel punteggio)
    // Come lo liquida ("il sito del cugino"): pesca i parenti condivisi tipizzati.
    internal static readonly Tag Percepito = new("percepito")
    {
        new($"la fa mio {Parente.Pari.M} che smanetta, due sere", 2),
        new($"è il sito del {Parente.Giovane.M}, due click", 2),
        new($"la butto giù con {Ai} in un weekend", 2),
        new($"{Ai} ormai fa tutto lei, io ci metto l'idea", 2),
        new($"tanto mi ha detto mio {Parente.Anziano.M} che è una figata", 2),
        ("ci vuole niente, è solo questione di mettersi lì", 2),
        ("basta un programmatore e siamo a posto", 2),
        new($"me la fa mia {Parente.Pari.F} che studia informatica", 2),
        new($"me lo smanetta il {Parente.Giovane.M} nel weekend", 2),
        new($"ci pensa mio {Parente.Pari.M} che ha fatto un corso online", 2),
        new($"copio il codice da un tutorial su {Social.Any}", 2),
        ("scarico un template e cambio il logo", 2),
        new($"lo genero tutto con {Ai}, gratis", 2),
        ("prendo un tema di WordPress e via", 2),
        new($"la fa mio {Parente.Giovane.M} che ha tredici anni ma ci sa fare col computer", 2),
    };

    // A CHI SERVIREBBE: iper-specifico apposta, ma abbastanza generico da valere per qualunque idea
    // (mai legato al dominio della {Funzione} pescata in apertura). Voce del narratore, non sua.
    internal static readonly Tag Pubblico = new("pubblico")
    {
        ("pensata per chi si scorda sempre l'ombrello quando piove", 3),
        ("fatta apposta per chi arriva sempre tardi agli appuntamenti", 3),
        ("pensata per chi non trova mai le chiavi la mattina", 3),
        ("fatta per chi rimanda la spesa fino all'ultimo momento", 3),
        ("pensata per chi si addormenta con la TV accesa", 3),
        ("fatta apposta per chi cambia idea sul da farsi ogni due minuti", 3),
        ("pensata per chi ha sempre il telefono scarico al momento sbagliato", 3),
        ("fatta per chi non ricorda mai le password", 3),
        ("pensata per chi rimanda le cose importanti a domani", 3),
        ("fatta apposta per chi controlla le notifiche in continuazione", 3),
        ("pensata per chi non chiede mai indicazioni a nessuno", 3),
        ("fatta per chi si lamenta sempre ma non cambia mai abitudini", 3),
        ("pensata per chi perde sempre lo scontrino", 3),
        ("fatta apposta per chi non legge mai le istruzioni", 3),
        ("pensata per chi ha sempre da ridire ma non fa mai nulla per cambiarlo", 3),
    };

    // COME "FUNZIONA": spiegazione semplicistica e generica, mai gergo tecnico — deve restare chiara
    // anche a chi non programma. Frasi complete (soggetto sottinteso: l'idea).
    internal static readonly Tag Meccanismo = new("meccanismo")
    {
        ("funziona con un pulsante, tanto basta quello", 3),
        ("basta una notifica e sai già tutto quello che ti serve", 3),
        ("ci pensa un algoritmo, anche se lui non sa spiegare come funzioni", 3),
        ("basta fare una domanda e la risposta arriva subito", 3),
        ("funziona da sola una volta aperta, dice", 3),
        ("funziona con un sistema di voti tra gli utenti", 3),
        ("ci pensa una chat automatica, sempre sveglia", 3),
        ("funziona semplicemente mettendo in contatto le persone", 3),
        ("basta un abbonamento e si sblocca tutto", 3),
        ("ci pensa una lista che si aggiorna da sola", 3),
        ("funziona con la geolocalizzazione, anche se non se ne capisce il motivo", 3),
        ("basta una foto e il resto lo fa l'app", 3),
        ("funziona mandando un avviso al momento giusto", 3),
        ("ci pensa una community di persone che si aiutano tra loro", 3),
        ("funziona con un questionario di due minuti", 3),
    };

    // IL MODELLO DI GUADAGNO: ingenuo e sicuro di sé quanto il resto. Frasi complete.
    internal static readonly Tag Modello = new("modello")
    {
        ("guadagna con la pubblicità di un'attività del quartiere", 3),
        ("ci mette un abbonamento a due euro al mese, tanto lo pagano tutti", 3),
        ("è gratis per sempre, poi si vedrà", 3),
        ("ha già pensato al tasto per togliere la pubblicità, ovviamente a pagamento", 3),
        ("guadagna con una piccola commissione che, dice, nessuno noterà", 3),
        ("ha in mente un abbonamento premium per chi ha davvero fretta", 3),
        ("è gratis, tanto poi si ripaga in altro modo", 3),
        ("ha già pensato al tasto dona, per chi proprio ci tiene", 3),
        ("ci mette una versione a pagamento con più opzioni", 3),
        ("guadagna vendendo lo spazio pubblicitario, non i dati, giura", 3),
        ("ha pensato a un abbonamento annuale scontato del 20%", 3),
        ("è gratis, ma solo per i primi mille iscritti", 3),
    };

    // Il QUANDO/DOVE: frammenti (scorrono in "…{nome}, {professione}, {genesi}."). Il "dove" pesca il
    // social condiviso. Momenti passivi/qualunque apposta: chi ha l'idea non ci ha "lavorato sopra",
    // gli è capitata — non prendiamoci gioco della persona, solo dell'idea (vedi Funzione).
    internal static readonly Tag Genesi = new("genesi")
    {
        "al terzo spritz",
        new($"dopo l'ennesima ora su {Social.Any}"),
        new($"una sera sul divano, scrollando {Social.Any}"),
        new($"al _‘{Genera("locali")}’_, verso il terzo giro"),
        "davanti all'ennesimo tutorial per diventare ricchi",
        "in coda da qualche parte, per ammazzare il tempo",
        new($"sotto un reel di un motivatore, alle {TimeSlot.Notte} su {Social.Any}"),
        "dopo un documentario sui miliardari",
        "tornando a casa dall'aperitivo",
        new($"leggendo i commenti di un video su {Social.Any}"),
        "in pausa pranzo, fissando il vuoto",
        new($"alle {TimeSlot.Notte}, aspettando il sonno"),
        "in bagno, col telefono in mano da mezz'ora",
        "in tangenziale, imbottigliato nel traffico",
        new($"al matrimonio di suo {Parente.Pari.M}, annoiato a morte", 2),
    };

    internal static readonly Etichetta LblDettaglio = new("dettagli");


    /// <inheritdoc />
    public override string Slug => "startup";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 7, Name = "Soluzioni tech incredibili", Description = "Hai una soluzione ma forse non c'è il problema! Ecco l'idea!" };

    /// <inheritdoc />
    // MarkovChaos = 0: niente conio dei nomi. Qui vogliamo realismo (nomi veri), non varianti inventate.
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 3, MaxPhrases = 4, MinScore = 12, Separators = [". ", ".\n"], MarkovChaos = 0 };

    /// <summary>Apertura = l'IDEA (titolo) + IL TIPO che l'ha avuta. Poi il Core fa la DESCRIZIONE.</summary>
    public override Frase? Apertura => new($"## {Piattaforma} per {Funzione}{Dettaglio}\n\n_L'ha avuta {Nome.M}, {Professioni.M}, {Genesi}._\n\n");

    // Oltre a "dettagli": parole di contenuto che ricorrono in gruppi Core/Tag diversi e che, se
    // duplicate nello stesso testo, si notano (brand, tecnicismi, il "weekend" onnipresente…). Scoperte
    // scansionando le liste per parole condivise tra bucket distinti — non le particelle generiche
    // ("cosa", "solo"…), che ricorrono ovunque e renderebbero la generazione quasi impossibile.
    public override List<Etichetta>? UniqueLabels { get; } =
        [LblDettaglio, "weekend", "gratis", "abbonamento", "pubblicità"];


    /// <inheritdoc />
    // Un tema per gruppo: mai due frasi che dicono la stessa cosa nello stesso testo.
    public override List<string>? ExclusiveGroups { get; } =
        [Pubblico.Key, Meccanismo.Key, Modello.Key];

    /// <inheritdoc />
    // LA DESCRIZIONE: elabora solo l'IDEA — come pensa di realizzarla ({Percepito}, la sua voce), a chi
    // servirebbe, come "funziona", come ci guadagna. Niente verdetto del narratore sull'inutilità
    // dell'idea (quella la ricava da solo il lettore dalla specificità di {Funzione} in apertura), niente
    // gergo da addetti ai lavori, e niente aggettivo del narratore sulla sua sicumera: quello giudica LUI,
    // non l'idea — {Percepito} mostra il piano (concreto, suo), non lo etichetta.
    public override List<Frase> Core { get; } =
    [
        // ── COME PENSA DI REALIZZARLA: {Percepito} è la sua voce, non un giudizio. UN SOLO template:
        // {Percepito} non è esclusivo (voluto: ogni voce è un dettaglio concreto, non un tema ripetibile),
        // quindi un secondo template qui pescherebbe un'ALTRA citazione — stesso concetto ("ci pensa
        // qualcun altro") ripetuto con parole diverse, ridondante quanto un vero stutter testuale ──
        new($"Il piano è semplice: _‘{Percepito}’_", 4),
        // ── A CHI SERVIREBBE (gruppo "pubblico") ──
        new($"È {Pubblico}", 4),
        // ── COME "FUNZIONA" (gruppo "meccanismo") ──
        new($"{Meccanismo}", 5),
        // ── COME CI GUADAGNA (gruppo "modello") ──
        new($"{Modello}", 5),
    ];
}
