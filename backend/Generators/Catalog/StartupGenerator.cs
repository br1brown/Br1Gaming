
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
/// Generatore di IDEE "da terza birra": NON un imprenditore, ma il tizio qualunque che ha ‘un'idea
/// incredibile’ per un'app — una roba banale o che esiste già — e la racconta all'amico informatico,
/// convinto di essere un genio. Niente pitch/round/business plan. Ordine dell'output:
/// <list type="bullet">
///   <item><b>l'IDEA</b> (<see cref="Apertura"/>): il titolo — <c>[piattaforma]</c> per una
///         <c>[funzione]</c> banale, con un twist <c>[dettaglio_specifico]</c> opzionale;</item>
///   <item><b>il TIPO</b> (sempre in <see cref="Apertura"/>): chi l'ha avuta — <c>[nome-m]</c>,
///         <c>[professioni]</c>, un <c>[tratto]</c> da genio-illuso e la <c>[genesi]</c> (dove/quando);</item>
///   <item><b>la DESCRIZIONE</b> (<see cref="Core"/>): il core annida molte questioni come mbeb/incel —
///         sottovaluta la difficoltà (‘la fa il cugino’), è inutile/esiste già, è euforico, l'amico
///         incassa, e a farla dovrebbe pensarci qualcun altro.</item>
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
    // Quello che servirebbe DAVVERO (enorme). Voci singolari E plurali mescolate: i template le usano
    // in APPOSIZIONE (dopo un trattino o i due punti), così nessun verbo deve accordarsi al numero.
    internal static readonly Tag LavoroReale = new("lavoro_reale")
    {
        ("un algoritmo di matching geolocalizzato in tempo reale", 3),
        ("un sistema di riconoscimento immagini che funzioni davvero", 3),
        ("un modello di IA che nessuna multinazionale ha ancora fatto girare bene", 3),
        ("un'infrastruttura che regge milioni di utenti in contemporanea", 3),
        ("partnership con chi ha già milioni di utenti, non zero", 3),
        ("una base dati che si aggiorna da sola, non a mano", 3),
        ("un servizio clienti che risponda anche di notte", 3),
        ("la moderazione di milioni di contenuti al giorno", 3),
        ("un team di data scientist pagati a peso d'oro", 3),
        ("l'integrazione coi sistemi di pagamento di mezzo mondo", 3),
        ("una compliance GDPR che spaventa gli avvocati", 3),
        ("un backend che non crolli il giorno del lancio", 3),
        ("una moderazione umana 24 ore su 24", 3),
        ("un'app che non si pianti ogni due schermate", 3),
        ("un motore di raccomandazione che non faccia ridere", 3),
        ("anni di dati puliti che nessuno ti regala", 3),
        ("server che reggano più di quattro persone alla volta", 3),
        ("mesi di lavoro solo per la schermata di login", 3),
        ("decine di ingegneri che ci sbattano la testa per anni", 3),
        ("milioni in server, prima ancora del primo utente", 3),
        ("accordi legali con mezzo pianeta", 3),
        ("test su migliaia di dispositivi diversi", 3),
        ("permessi e certificazioni che ci mettono mesi", 3),
        ("traduzioni e assistenza in venti lingue", 3),
    };

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

    // L'idea è INUTILE / esiste già / non la chiede nessuno — come la vede l'amico che ascolta (mai
    // "l'ha costruita": il tizio ha SOLO l'idea). Frasi-clausola: scorrono dopo "…è che" / "…è che".
    internal static readonly Tag Inutilita = new("inutilita")
    {
        ("esiste già, guarda caso, in dodici versioni", 3),
        ("è il tipo di cosa che risolvi con una nota sul telefono", 2),
        ("è roba utile a lui e forse a nessun altro sul pianeta", 3),
        ("il telefono la fa già da solo, gratis, da anni", 3),
        ("è l'ennesima app da scaricare una volta e dimenticare in una cartella", 3),
        ("è la classica soluzione in cerca di un problema", 3),
        ("non l'ha chiesta nessuno, mai", 2),
        ("è esattamente ciò che il mondo non stava aspettando", 3),
        ("risolve un problema che, a ben vedere, ha solo lui", 3),
        ("dopo due giorni la disinstalli e non ci pensi più", 3),
        ("fa esattamente quello che fa un foglio Excel, ma peggio", 3),
        ("la useresti una volta, il giorno del download, e mai più", 3),
        ("la fa già Google da dieci anni e pure meglio", 3),
        ("è il genere di cosa che risolvi chiedendo a un amico", 3),
        ("occupa spazio sul telefono e basta", 2),
    };

    internal static readonly Tag Sicumera = new("sicumera")
    {
        "la cosa più semplice del mondo", "una passeggiata", "roba da niente", "una cosa già mezzo fatta",
        "una banalità", "un gioco da ragazzi", "due righe di codice", "una sciocchezza", "roba da un pomeriggio", "una passeggiata di salute",
        "una cosa da fare in un weekend", "praticamente già fatta", "un copia-incolla", "una cavolata", "roba da mezz'ora",
    };

    // L'EUFORIA da terza birra: è convintissimo di avere in mano una cosa enorme. Frasi-clausola (3ª pers.).
    internal static readonly Tag Entusiasmo = new("entusiasmo")
    {
        ("ne parla come se avesse inventato il fuoco", 3),
        ("è convintissimo che stavolta è la volta buona", 3),
        ("già si vede ricco sfondato", 3),
        ("giura che è ‘l'idea del secolo’, minimo", 3),
        ("ti guarda con gli occhi che brillano, aspettando l'applauso", 3),
        ("ha paura che gliela rubino, quindi la dice solo a te", 3),
        ("è persuaso di essere l'unico al mondo ad averci pensato", 3),
        ("la considera già un successo, manca solo il dettaglio di farla", 3),
        ("parla di milioni con la serenità di chi non ne ha mai visti", 3),
        ("ha già deciso il nome della società e il colore del logo", 3),
        ("dice che Elon Musk ha iniziato così, dal garage", 3),
        ("ha già in mente in che quartiere comprare l'attico", 3),
        ("sostiene che tra un anno la vendono a Google", 3),
        ("è pronto a mollare il lavoro appena parte tutto", 3),
        ("dice che è come Uber, ma per una cosa che non serve", 3),
    };

    // La reazione dell'AMICO informatico che si becca il pistolotto (verbi in 2ª persona, dopo un "e"/virgola).
    internal static readonly Tag AmicoReazione = new("amico_reazione")
    {
        ("annuisci fingendo un entusiasmo che non hai", 3),
        ("non hai il cuore di dirgli come stanno le cose", 3),
        ("aspetti solo che cambi argomento", 2),
        ("gli spieghi che no, non è così semplice", 3),
        ("fai finta di prendere appunti mentali", 3),
        ("ti chiedi come reggere fino alla fine del discorso", 3),
        ("ordini un'altra birra, che serve", 3),
        ("per educazione dici ‘bella idea’ e muori un po' dentro", 3),
        ("calcoli mentalmente quanti mesi di lavoro sta liquidando in una frase", 3),
        ("annuisci e cambi discorso sul calcio prima che sia troppo tardi", 3),
        ("provi a spiegargli cos'è un database e vedi lo sguardo spegnersi", 3),
        ("gli chiedi ‘e chi la scrive?’ e cala il silenzio", 3),
        ("controlli l'orologio sperando sia ora di andare", 3),
        ("gli dici che ci penserai, sapendo già che non lo farai", 3),
        ("sorridi e pensi a quanto era meglio restare a casa stasera", 3),
        // Accattivanti: sotto l'ironia, l'affetto vero per il sognatore innocuo.
        ("in fondo gli vuoi bene, anche se stavolta la spara davvero grossa", 3),
        ("per un secondo, contro ogni logica, speri quasi che ce la faccia", 3),
        ("gli offri tu la prossima birra, che almeno quella se la merita", 3),
    };

    // Il dettaglio trascurabile: a farla, ovviamente, dovrebbe pensarci qualcun altro (gratis).
    internal static readonly Tag PretendeAltri = new("pretende_altri")
    {
        ("a scriverla, ovviamente, ci pensa qualcun altro", 3),
        ("manca solo un amico ‘che smanetta’ disposto a farla per la gloria", 3),
        ("conta su di te per la parte ‘facile’, cioè tutta", 3),
        new($"tanto la fa suo {Parente.Pari.M}, no?", 2),
        ("il codice, quisquilia trascurabile, lo scrive qualcun altro", 3),
        ("conta sul fatto che ‘tu che sei del mestiere’ gliela fai gratis", 3),
        ("basta uno bravo che ci lavori gratis un paio di weekend", 3),
        ("l'idea è sua, il lavoro (cioè tutto) è degli altri", 3),
        ("ti offre il 5% di società in cambio di sei mesi di lavoro gratis", 3),
        new($"tanto la scrive mio {Parente.Giovane.M}, che ha la play e quindi ci sa fare", 2),
        ("il difficile lo fa qualcun altro, lui ci mette ‘la visione’", 3),
        ("cerca solo un socio tecnico che faccia il 100% del lavoro", 3),
        ("‘tu la programmi e ci dividiamo i guadagni’, che ancora non esistono", 3),
        new($"delega la parte tecnica a suo {Parente.Giovane.M} in cambio della merenda", 2),
        ("basta che qualcuno la scriva, poi lui ‘ci mette la faccia’", 3),
    };

    // ══ IL TIPO ══ (nell'apertura, dopo il titolo). Non un imprenditore: il tizio qualunque convinto di
    // essere un genio. Apposizione: scorre dopo la professione ("…{professione} {tratto}, {genesi}").
    internal static readonly Tag Tratto = new("tratto")
    {
        "convinto di essere un genio incompreso",
        "sicuro di tutto ed esperto di niente",
        "che di informatica sa giusto accendere il computer",
        "che chiama ‘svilupparla’ il girarla a qualcun altro",
        "che ha già in mente come spenderli, i soldi",
        new($"reduce da altre {2..5} idee ‘geniali’ morte lì"),
        "che le idee ce le ha, è il farle che è un dettaglio",
        "con lo sguardo di chi ha appena visto il futuro",
        "che non ha ancora capito perché nessuno l'ha fatta prima",
        "che una volta ha quasi finito un corso di programmazione",
        "che ha guardato un video di Elon Musk e si è sentito imprenditore",
        "che pronuncia ‘startup’ con l'accento sbagliato",
        "che ha comprato il dominio ma non sa cosa metterci",
        "che parla di ‘scalabilità’ senza sapere cosa significhi",
        "con la partita IVA aperta da un mese e già in crisi",
    };

    // Il QUANDO/DOVE: frammenti (scorrono in "…{tratto}, {genesi}."). Il "dove" pesca il social condiviso.
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
    public override GeneratorInfo Info { get; } = new() { Order = 2, Name = "Generatore di Idee Fallimentari per Applicazioni", Description = "L'idea geniale che ti viene alla terza birra: esiste già e non serve a nessuno" };

    /// <inheritdoc />
    // MarkovChaos = 0: niente conio dei nomi. Qui vogliamo realismo (nomi veri), non varianti inventate.
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 3, MaxPhrases = 4, MinScore = 12, Separators = [". ", ".\n"], MarkovChaos = 0 };

    /// <summary>Apertura = l'IDEA (titolo) + IL TIPO che l'ha avuta. Poi il Core fa la DESCRIZIONE.</summary>
    public override Frase? Apertura => new($"## {Piattaforma} per {Funzione}{Dettaglio}\n\n_L'ha avuta {Nome.M}, {Professioni.M} {Tratto}, {Genesi}._\n\n");

    // Oltre a "dettagli": parole di contenuto che ricorrono in gruppi Core/Tag diversi e che, se
    // duplicate nello stesso testo, si notano (brand, tecnicismi, il "weekend" onnipresente…). Scoperte
    // scansionando le liste per parole condivise tra bucket distinti — non le particelle generiche
    // ("cosa", "solo"…), che ricorrono ovunque e renderebbero la generazione quasi impossibile.
    public override List<Etichetta>? UniqueLabels { get; } =
        [LblDettaglio, "weekend", "gratis", "Elon Musk", "Google", "database", "logo", "codice", "corso"];


    /// <inheritdoc />
    // Un gruppo LOCALE multi-tag per "sottovaluta" (lavoro-reale ≡ sicumera: stesso tema); gli altri
    // temi sono un tag solo, quindi bastano come gruppi-singoletto.
    public override IReadOnlyDictionary<string, IReadOnlyList<string>>? PolicyGroups { get; } = new Dictionary<string, IReadOnlyList<string>>
    {
        ["sottovaluta"] = [LavoroReale.Key, Sicumera.Key],
    };

    /// <inheritdoc />
    // Un tema per gruppo: mai due frasi che dicono la stessa cosa nello stesso testo.
    public override List<string>? ExclusiveGroups { get; } =
        ["sottovaluta", Inutilita.Key, Entusiasmo.Key, AmicoReazione.Key, PretendeAltri.Key];

    /// <inheritdoc />
    // LA DESCRIZIONE: il core annida molte questioni (come mbeb/incel) — sottovaluta la difficoltà, è
    // inutile, è euforico, l'amico incassa, e a farla dovrebbe pensarci un altro.
    public override List<Frase> Core { get; } =
    [
        // ── SOTTOVALUTA: per lui è facile, ‘la fa il cugino’ (gruppo "sottovaluta") ──
        new($"La parte difficile — {LavoroReale} — per lui non esiste: _‘{Percepito}’_", 5),
        new($"Gli fai notare cosa ci vorrebbe davvero — {LavoroReale} — e lui, serissimo: _‘{Percepito}’_", 5),
        new($"Per lui tirarla su è {Sicumera}: _‘{Percepito}’_", 4),
        new($"Ne parla come se fosse {Sicumera}, manco sapesse che ci vorrebbe {LavoroReale}", 4),
        // ── INUTILE: esiste già / non serve a nessuno (gruppo "inutilita") ──
        new($"Il dettaglio è che {Inutilita}", 5),
        new($"Quello che non gli dici è che {Inutilita}", 4),
        // ── EUFORIA: parla la terza birra (gruppo "entusiasmo") ──
        new($"Intanto {Entusiasmo}", 5),
        new($"E ovviamente {Entusiasmo}", 4),
        // ── L'AMICO che ascolta (gruppo "amico_reazione") ──
        new($"Tu lo lasci finire e {AmicoReazione}", 4),
        new($"Mentre parla, {AmicoReazione}", 4),
        // ── A FARLA CI PENSA UN ALTRO (gruppo "pretende_altri") ──
        new($"Il piano è semplice: {PretendeAltri}", 5),
        new($"C'è solo un dettaglio: {PretendeAltri}", 5),
        new($"L'unica cosa: {PretendeAltri}", 5),
    ];
}
