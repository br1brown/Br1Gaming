using Backend.Models;

namespace Backend.Generators.Catalog;

/// <summary>
/// Il visionario dell'innovazione a orologeria: l'aspirante imprenditore che «ha avuto un'idea» — di
/// solito <i>«[colosso] ma [twist]»</i>, cioè clonare da zero qualcosa che esiste già da vent'anni, con
/// un taglio iperlocalizzato («ma solo per [city]») e zero percezione del mercato. Profilo in stile rant,
/// come i generatori dei maschi, ma qui il bersaglio è lo startupparo con la slide della concorrenza vuota:
/// <list type="bullet">
///   <item><c>colosso</c>: il servizio già esistente da «reinventare» (LinkedIn, Netflix, Uber…);</item>
///   <item><c>twist</c>: il differenziatore fantasma («ma italiano», «ma per [city]», «ma con la blockchain»);</item>
///   <item><c>buzzword</c> / <c>percezione</c>: il gergo da pitch e l'auto-mitologia («il prossimo Steve Jobs»);</item>
///   <item><c>professioni</c>: cosa fa davvero nella vita (nel gruppo <c>identita</c>, così il soggetto si
///         definisce una volta sola: niente «CEO seriale» che è pure «studente al primo anno»);</item>
///   <item><c>frasi_tipiche</c>: le battute-feticcio del founder pre-prodotto, con <c>[colosso]</c>/<c>[twist]</c>
///         a segnaposto (gruppo esclusivo: una sola per testo, come nell'Incel).</item>
/// </list>
/// Generatore autonomo (niente <c>ComposeWith</c>): la satira è tutta sua.
/// </summary>
public sealed class StartupGenerator : GeneratorBase
{
    /// <inheritdoc />
    public override string Slug => "startup";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 2, Name = "Generatore Startupparo", Description = "Genera l'imprenditore visionario con l'idea geniale (in ritardo di vent'anni)" };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 3, MaxPhrases = 5, MinScore = 28, Separators = [". ", "; ", ".\n"] };

    /// <inheritdoc />
    public override string? Apertura => "## [nome-m],\n";

    /// <inheritdoc />
    public override List<string>? UniqueLabels { get; } = ["vuole fare", "cerca un socio", "ti fa firmare", "valuta la sua", "si definisce"];

    /// <inheritdoc />
    public override List<string>? ExclusiveGroups { get; } = ["identita", "frasi_tipiche"];

    /// <inheritdoc />
    public override Dictionary<string, List<ScoredItem>> FlatLists { get; } = new()
    {
        // Il servizio già esistente che vuole «reinventare da zero». Deve leggere bene sia da solo sia
        // dentro "[colosso] ma [twist]" e "l'ha già fatta [colosso]".
        ["colosso"] =
        [
            ("LinkedIn", 2),
            ("Netflix", 2),
            ("Facebook", 2),
            ("Amazon", 2),
            ("Uber", 2),
            ("Tinder", 2),
            ("Spotify", 2),
            ("Airbnb", 2),
            ("YouTube", 2),
            ("TikTok", 2),
            ("Instagram", 2),
            ("PayPal", 2),
            ("Booking", 2),
            ("Just Eat", 2),
            ("Glovo", 2),
            ("Twitch", 2),
            ("WhatsApp", 2),
            ("Google", 3),
            ("Trainline", 2),
            ("Subito.it", 2),
        ],
        // Il differenziatore fantasma. Alcune varianti pescano la città condivisa: l'iperlocalizzazione
        // è metà della comicità («il social network di [city]»).
        ["twist"] =
        [
            ("ma italiano", 2),
            ("ma per [city]", 3),
            ("ma solo per [city]", 3),
            ("ma con la blockchain", 3),
            ("ma con l'AI", 2),
            ("ma etico", 2),
            ("ma per gli over 60", 3),
            ("ma per parrucchieri", 3),
            ("ma per la Serie B", 3),
            ("ma cattolico", 2),
            ("ma decentralizzato", 3),
            ("ma con le crypto", 3),
            ("ma senza gli algoritmi cattivi", 3),
            ("ma con la privacy vera", 3),
            ("ma per veri intenditori", 3),
            ("ma green", 2),
        ],
        // Il gergo del pitch: infilato ovunque, sempre con la faccia serissima.
        ["buzzword"] =
        [
            ("disruptive", 2),
            ("scalabile", 2),
            ("verticale", 2),
            ("un ecosistema", 2),
            ("una sinergia", 2),
            ("first mover", 3),
            ("un MVP", 2),
            ("un unicorno", 2),
            ("un marketplace", 2),
            ("growth hacking", 3),
            ("una exit strategy", 3),
            ("un pivot", 2),
            ("data-driven", 2),
            ("customer-centric", 3),
            ("un oceano blu", 3),
            ("una value proposition", 3),
            ("un funnel", 2),
        ],
        ["idoli"] =
        [
            ("Steve Jobs", 2),
            ("Elon Musk", 2),
            ("Mark Zuckerberg", 2),
            ("Jeff Bezos", 2),
            ("Jack Ma", 2),
            ("Flavio Briatore", 3),
            ("big Luca", 3),
            ("i fratelli Winklevoss", 3),
            ("il tizio del corso di trading su Instagram", 4),
            ("Gary Vaynerchuk", 3),
            ("un guru di LinkedIn con 40mila follower", 4),
        ],
        // Auto-mitologia. Sempre tra virgolette nel testo: è come si presenta, non come è.
        ["percezione"] =
        [
            ("il prossimo Steve Jobs", 3),
            ("lo Zuckerberg italiano", 3),
            ("un visionario", 2),
            ("un disruptor", 2),
            ("un founder seriale", 3),
            ("un serial entrepreneur", 3),
            ("un self-made man", 3),
            ("un business angel in incognito", 4),
            ("un genio incompreso dell'innovazione", 3),
            ("un imprenditore digitale", 2),
            ("un innovatore nato", 2),
            ("il futuro Elon Musk della [city]", 4),
            ("un CEO visionario", 3),
            ("un ragazzo con le idee giuste", 2),
        ],
        // Cosa fa DAVVERO (gruppo "identita": esclusivo con l'età).
        ["professioni"] =
        [
            ("studente di economia al primo anno", 3),
            ("promotore finanziario", 2),
            ("ex agente immobiliare", 3),
            ("venditore di materassi", 3),
            ("dropshipper part-time", 3),
            ("consulente non si sa bene di cosa", 3),
            ("laureando fuoricorso in scienze della comunicazione", 4),
            ("stagista non retribuito", 3),
            ("influencer con 300 follower", 3),
            ("trader di criptovalute in perdita", 3),
            ("cassiere che sogna in grande", 3),
            ("network marketer", 2),
        ],
        ["vibes"] =
        [
            ("iper-motivato", 2),
            ("logorroico", 2),
            ("caffeinomane", 2),
            ("perennemente in call", 3),
            ("allergico al lavoro dipendente", 3),
            ("convinto", 2),
            ("instancabile a parole", 3),
            ("in modalità pitch h24", 3),
            ("esaltato", 2),
            ("insopportabile ai cenoni", 3),
            ("visionario a vuoto", 3),
        ],
        // Le battute-feticcio: [colosso], [twist], [buzzword] a segnaposto. Una sola per testo (gruppo esclusivo).
        ["frasi_tipiche"] =
        [
            ("è tipo [colosso], [twist]", 3),
            ("praticamente è [colosso] [twist], ma il nostro è diverso", 4),
            ("basta prendere l'[1-5]% del mercato di [colosso] e siamo ricchi", 4),
            ("l'idea vale, l'esecuzione è un dettaglio", 3),
            ("ho solo bisogno di un programmatore e siamo a posto", 4),
            ("cerco un socio tecnico che sviluppi in cambio di visibilità", 4),
            ("non posso dirti l'idea, prima firma l'NDA", 4),
            ("è un progetto [buzzword], capisci? Cambierà tutto", 3),
            ("quando facciamo la exit ci ricompri l'attico", 4),
            ("sì lo so che esiste già, ma nessuno l'ha fatto per [city]", 4),
            ("mi manca solo il capitale iniziale, per il resto è fatta", 4),
            ("è [buzzword], è il momento giusto, dobbiamo muoverci ora", 3),
            ("gli utenti arriveranno da soli, il prodotto si vende da sé", 4),
            ("ho già registrato il dominio, ormai è quasi fatta", 4),
            ("il mercato è enorme, siamo [buzzword]", 3),
            ("dammi retta, tra un anno siamo su Forbes", 3),
        ],
        // Le sue paure profonde: che gli rubino l'idea, che l'abbiano già fatta.
        ["terrori"] =
        [
            ("che qualcuno gli rubi l'idea", 3),
            ("scoprire che l'ha già fatta [colosso]", 4),
            ("dover scrivere una riga di codice", 3),
            ("che il socio tecnico si arrenda", 3),
            ("che qualcuno gli chieda il fatturato", 4),
            ("un investitore che chiede i numeri", 4),
            ("finire l'attico dei suoi entro i 30", 3),
        ],
        // Oggetti di scena del personaggio.
        ["props"] =
        [
            ("un MacBook pieno di adesivi di acceleratori", 3),
            ("un pitch deck di [30-90] slide", 3),
            ("biglietti da visita con scritto _«CEO & Founder»_", 4),
            ("una felpa col logo della startup che non esiste ancora", 4),
            ("un dominio .io comprato a mezzanotte", 3),
            ("un logo fatto su Canva in cinque minuti", 3),
            ("un abbonamento premium a LinkedIn", 3),
            ("una lavagna piena di frecce e _«[buzzword]»_", 3),
        ],
        // Dove lo trovi.
        ["luoghi"] =
        [
            ("un coworking di [city]", 3),
            ("l'incubatore dove non è mai stato ammesso", 4),
            ("un acceleratore visto solo su Instagram", 4),
            ("il bar dove tiene i _«meeting strategici»_", 4),
            ("una fiera di startup con l'ingresso gratuito", 4),
            ("un evento di networking per il buffet", 4),
        ],
    };

    /// <inheritdoc />
    public override List<ScoredItem> Core { get; } =
    [
        ("vuole fare _«[colosso] [twist]»_ (sì, sa che esiste già, ma _«il nostro è diverso»_ — non è diverso)", 12),
        ("ha avuto l'idea del secolo: _«[colosso], [twist]»_, con soli [12-20] anni di ritardo", 10),
        ("è convinto che basti l'[1-5]% del mercato di [colosso] per diventare [buzzword]", 9),
        ("cerca un socio tecnico che sviluppi tutto gratis _«in cambio di visibilità e di una piccola parte delle quote»_", 12),
        ("ti fa firmare un NDA prima di rivelarti l'idea (che poi è: [colosso] [twist])", 12),
        ("valuta la sua startup [1-50] milioni pre-money, pre-prodotto, pre-tutto", 11),
        ("si definisce _«[percezione]»_ su [social] (di lavoro fa il [professioni])", 9),
        ("ha già pensato all'exit, anche se l'azienda ha zero utenti e zero euro di fatturato", 11),
        ("il suo pitch deck ha [30-90] slide e quella della concorrenza dice sempre _«nessuno fa quello che facciamo noi»_ (lo fa [colosso] da [10-25] anni)", 15),
        ("parla solo per [buzzword] e ogni tanto ripete _«[frasi_tipiche]»_", 7),
        ("il logo l'ha già fatto su Canva, il codice lo scriverà _«qualcuno»_", 8),
        ("gira ogni conversazione su _«senti, ma tu di lavoro cosa fai? no perché io avrei un'idea...»_", 9),
        ("[professioni] che si presenta come _«[percezione]»_", 4),
        ("ha [eta-giovane] anni e già [vibes], ripete a chiunque _«[frasi_tipiche]»_", 7),
        ("[vibes] di [eta-giovane] anni, lo trovi sempre in [luoghi]", 6),
        ("porta ovunque [props] e te lo mostra prima ancora di salutarti", 8),
        ("quando gli dici che [colosso] lo fa già, risponde _«sì ma [twist]»_ e cambia argomento", 11),
        ("il suo terrore più grande è [terrori], per questo non dice mai l'idea per intero", 9),
        ("ha registrato il dominio, aperto la partita IVA e ordinato le felpe: manca solo il prodotto", 12),
        ("secondo lui l'idea è tutto e l'esecuzione _«la fa il tecnico»_, che ovviamente non ha ancora trovato", 10),
        ("ha [eta-giovane] anni, fa il [professioni], ma sui suoi biglietti c'è scritto _«[percezione]»_", 8),
        ("passa le giornate in [luoghi] a _«fare networking»_ e a spiegare perché _«[frasi_tipiche]»_", 9),
        ("il suo idolo è [idoli] e cita i suoi tweet come fossero il Vangelo", 6),
        ("vuole _«essere il [idoli] della [city]»_, ma per ora ha solo [props]", 10),
        ("è [buzzword], almeno secondo la sua bio di [social]", 4),
        ("[vibes], convinto che _«[frasi_tipiche]»_", 5),
        ("ti spiega che la sua idea è _«un oceano blu»_ (in realtà è [colosso] [twist])", 9),
        ("non ha mai scritto una riga di codice, ma ha già deciso il nome dell'azienda e il colore del logo", 9),
        ("ha pitchato l'idea a [3-15] investitori, a tutti i parenti e al barista: risposta unanime, _«bella, però...»_", 11),
        ("il suo business plan si regge su una frase: _«[frasi_tipiche]»_", 7),
        ("[professioni] che dopo un corso online da [90-400] euro si sente [percezione]", 8),
        ("è terrorizzato all'idea di [terrori], quindi ogni riunione inizia con un NDA", 10),
        ("ha [eta-giovane] anni e una startup che esiste solo come logo, dominio e _«[frasi_tipiche]»_", 8),
        ("dice che gli manca _«solo il capitale iniziale»_ (e il prodotto, e i clienti, e il tecnico)", 10),
        ("promette che _«tra [1-3] anni siamo su Forbes»_, intanto la beta è ferma a una slide", 9),
        ("[percezione] a parole, [professioni] nei fatti, [vibes] sempre", 5),
        ("ti offre l'[1-5]% della società _«che varrà milioni»_ se gli sviluppi l'app entro venerdì", 12),
        ("ha lanciato un sondaggio su [social] per _«validare il mercato»_: hanno risposto sua madre e due bot", 11),
        ("convinto che [colosso] _«non abbia capito niente»_ e che lui, [twist], li spazzerà via", 9),
    ];
}
