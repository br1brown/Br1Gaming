using Backend.Models;

namespace Backend.Generators.Catalog;

/// <summary>
/// Invettive automobilistiche. Le liste sono divise per ruolo semantico (come in mbeb/incel):
/// <list type="bullet">
///   <item><c>insulto-m</c>: insulti rivolti al guidatore (vanno in apposizione: "[insulto] di pirata della strada");</item>
///   <item><c>espletivo-m</c>/<c>espletivo-f</c>: nomi volgari per oggetti/luoghi ("quel [espletivo] di telefono");</item>
///   <item><c>imprecazione</c>: intensificatori avverbiali ("ma dove [imprecazione] guardi").</item>
/// </list>
/// Così un insulto-a-persona non finisce mai a qualificare un oggetto (niente "demente di telefono").
/// </summary>
public sealed class AutoGenerator : GeneratorBase
{
    /// <inheritdoc />
    public override string Slug => "auto";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 4, Name = "Generatore Invettive Automobilistiche", Description = "Non sai cosa dire quando un guidatore fa delle manovre poco piacevoli?" };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 2, MaxPhrases = 4, Separators = ["! eh?!?! ", "! cosa cazzo?! ", "! ma porca miseria!! ", "! oh cazzo no!! ", "! eh?! ma come cazzo è possibile?! ", "! che cazzo stai facendo?! ", "! no, no e poi no, cazzo!! ", "! ma vaffanculo!! ", "! oh madonna, mi stai prendendo per il culo?! ", "! eh... fighi un cazzo!! ", "! ma davvero?! ma davvero cazzo?! ", "! basta, ho finito la pazienza!! ", "! oh! oh! oh! non ci posso credere!! ", "! ma che cazzo vuoi?! ", "! eeeeeh?!?! ", "! porca puttana!! ", "! ma tu sei fuori di testa?! ", "! ho detto no, cazzo!! ", "! mi stai facendo incazzare di brutto!! ", "! ma va a cagare!! ", "! ma sei nato in autostrada?! ", "! ma vai a quel paese!! ", "! testa di cazzo!! ", "! ma chi cazzo ti caga?! ", "! ma stai sul cazzo a tutti?! ", "! porco il clacson!! ", "! ma suona te 'sto clacson, no?! ", "! ma t'hanno dato la patente coi punti?! ", "! porca troia!! ", "! ma che cazzo combini?! ", "! madonna santa che pena!! ", "! ma quanto sei coglione?! ", "! ma muoviti, cazzo!! ", "! ma t'hanno svitato la testa?! ", "! oh, ma ci sei o ci fai?! "] };

    /// <inheritdoc />
    public override string? Chiusura => "!";

    /// <inheritdoc />
    public override List<string>? UniqueLabels { get; } = ["guidi"];

    /// <inheritdoc />
    public override Dictionary<string, List<ScoredItem>> FlatLists { get; } = new()
    {
        // Insulti rivolti alla PERSONA del guidatore (apposizione "[insulto-m] di <ruolo>").
        ["insulto-m"] =
        [
            ("coglione", 2),
            ("deficiente", 2),
            ("imbecille", 2),
            ("cretino", 2),
            ("scemo", 2),
            ("demente", 2),
            ("infame", 2),
            ("disgraziato", 2),
            ("sciagurato", 2),
            ("bastardo", 2),
            ("stronzo", 2),
            ("rincoglionito", 2),
            ("cazzone", 2),
            ("rompicazzo", 2),
            ("testa di cazzo", 3),
            ("figlio di p-", 3),
            ("figlio di mignotta", 3),
            ("pezzo di merda", 3),
            ("cafone", 2),
            ("mentecatto", 2),
            ("cialtrone", 2),
            ("zotico", 2),
            ("buzzurro", 2),
            ("minchione", 2),
            ("zuccone", 2),
            ("testa di rapa", 3),
            ("pezzo d'asino", 3),
            ("sacco di merda", 3),
            ("sfigato", 2),
            ("decerebrato", 2),
        ],
        // Nomi volgari MASCHILI per qualificare oggetti/luoghi ("quel [espletivo-m] di telefono").
        ["espletivo-m"] =
        [
            ("cazzo", 2),
            ("schifo", 2),
            ("cesso", 2),
            ("casino", 2),
            ("pezzo di merda", 3),
            ("macello", 2),
            ("bordello", 2),
            ("letamaio", 2),
            ("porcaio", 2),
            ("sfacelo", 2),
            ("obbrobrio", 2),
            ("manicomio", 2),
            ("schifo immondo", 3),
        ],
        // Nomi volgari FEMMINILI per qualificare cose femminili ("una [espletivo-f] di pista").
        ["espletivo-f"] =
        [
            ("merda", 2),
            ("schifezza", 2),
            ("cagata", 2),
            ("cazzata", 2),
            ("porcheria", 2),
            ("rottura", 2),
            ("buffonata", 2),
            ("pagliacciata", 2),
            ("tragedia", 2),
            ("vergogna", 2),
            ("barzelletta", 2),
        ],
        // Intensificatori avverbiali ("ma dove [imprecazione] guardi", "chi [imprecazione] ti ha dato...").
        ["imprecazione"] =
        [
            ("cazzo", 2),
            ("minchia", 2),
            ("diavolo", 2),
            ("porco diavolo", 2),
            ("cazzo di cazzo", 2),
        ],
        // Epiteti = vocativo del guidatore: insulto+ruolo, trovate comiche e qualche regionalismo (raro).
        ["epiteti"] =
        [
            ("[insulto-m] di un aspirante pilota", 4),
            ("[insulto-m] di un guidatore folle", 4),
            ("[insulto-m] di un spericolato", 4),
            ("[insulto-m] di un apprendista autista", 4),
            ("[insulto-m] di un pilota improvvisato", 4),
            ("[insulto-m] di un distratto", 4),
            ("[insulto-m] di un pirata della strada", 4),
            ("[insulto-m] di un assassino", 4),
            ("[insulto-m] di un terrorista del traffico", 4),
            ("[insulto-m] di un kamikaze del traffico", 4),
            ("[insulto-m] di un criminale al volante", 4),
            ("[insulto-m] di una disgrazia motorizzata", 4),
            ("[insulto-m] di una lumaca col motore", 4),
            ("[insulto-m] di un autista della domenica", 4),
            ("[insulto-m] di uno scappato di casa", 4),
            ("[insulto-m] di un tamarro", 4),
            ("[insulto-m] di un coatto", 4),
            ("[insulto-m] di un neopatentato", 4),
            ("[insulto-m] di un prepotente della strada", 4),
            ("[insulto-m] di un patentato col Kinder sorpresa", 4),
            ("[insulto-m] di un mago delle manovre del cazzo", 4),
            ("[insulto-m] di un flagello della corsia", 4),
            ("[insulto-m] di un cervello in panne... altro che la macchina", 4),
            ("pilota da corsa mancato", 3),
            ("amante della velocità", 3),
            ("aspirante stuntman", 2),
            ("disastro su gomma", 3),
            ("vergogna dell'asfalto", 3),
            ("incapace totale", 3),
            ("demente del volante", 3),
            ("pericolo ambulante", 2),
            ("pericolo pubblico", 2),
            ("caos su ruote", 3),
            ("patentato al Gratta e Vinci", 3),
            ("quaquaraquà", 2),
            ("pirla", 2),
            ("bischero", 2),
            ("grullo", 2),
            ("belin", 2),
        ],
        ["luoghi"] =
        [
            ("in un [espletivo-m] di circo", 4),
            ("in un [espletivo-m] di videogame", 4),
            ("in un [espletivo-m] di parco giochi", 4),
            ("in un [espletivo-m] di film d'azione", 4),
            ("in un [espletivo-m] di gioco di realtà virtuale", 4),
            ("da un [espletivo-m] di venditore di tappeti volanti", 4),
            ("in un [espletivo-m] di mercatino dell'usato", 4),
            ("in un [espletivo-m] di tendone da circo", 4),
            ("in un [espletivo-m] di girone infernale", 4),
            ("in un [espletivo-m] di simulatore di guida con il volante storto", 4),
            ("in un [espletivo-m] di arcade degli anni '80", 4),
            ("in un [espletivo-m] di autoscontro del luna park", 4),
            ("in un [espletivo-m] di campo di patate", 4),
            ("dentro un [espletivo-m] di flipper", 4),
            ("in un [espletivo-m] di trattore senza freni", 4),
            ("a un [espletivo-m] di Gran Premio", 4),
            ("al [espletivo-m] di mercato", 4),
            ("in una [espletivo-f] di lotteria", 4),
            ("in una [espletivo-f] di pista da corsa fatta in casa", 4),
            ("su una [espletivo-f] di giostra", 4),
            ("in una [espletivo-f] di sagra di paese", 4),
            ("in mezzo a una [espletivo-f] di gincana", 4),
            ("in una pista da corsa", 3),
            ("nei simulatori di guida", 3),
            ("nelle quinte di un film d'azione di terza categoria", 3),
        ],
        ["dimenticati"] =
        [
            ("il [espletivo-m] di buonsenso", 4),
            ("il [espletivo-m] di cervello", 4),
            ("il [espletivo-m] di codice della strada", 4),
            ("ogni [espletivo-m] di neurone che ti era rimasto", 4),
            ("la vista", 2),
            ("le frecce, che esistono", 3),
            ("lo specchietto retrovisore", 3),
            ("come si usano gli specchietti", 3),
            ("la precedenza", 2),
            ("il cervello a casa", 3),
        ],
        ["azioni"] =
        [
            ("ritornare alla scuola guida", 3),
            ("rifare la scuola guida da capo", 3),
            ("prendere qualche lezione in più", 3),
            ("rottamare quel [espletivo-m] di catorcio", 4),
            ("togliere le mani da quel [espletivo-m] di telefono", 4),
            ("guardare ogni tanto gli specchietti", 3),
            ("guardare lo specchietto prima di svoltare", 3),
            ("usare la freccia ogni tanto", 3),
            ("dare la precedenza", 3),
            ("rispettare la distanza di sicurezza", 3),
            ("imparare cos'è la distanza di sicurezza", 3),
            ("guidare col cervello invece che con i piedi", 3),
            ("riconsegnare la patente", 3),
            ("andartene [luoghi] a fare i danni finti", 3),
            ("scendere da quella [espletivo-f] di macchina e farti investire", 4),
        ],
    };

    /// <inheritdoc />
    public override List<ScoredItem> Core { get; } =
    [
        ("ma sei serio, [epiteti]? sembra che tu abbia preso la patente [luoghi]!", 6),
        ("questo è il colmo, [epiteti]! stai guidando come se fossimo [luoghi]!", 7),
        ("[epiteti], hai trasformato la strada [luoghi]! sei fuori di testa?", 6),
        ("incredibile, [epiteti]! la tua guida è peggio di stare [luoghi]!", 7),
        ("[epiteti], sei un [epiteti]! smettila di [azioni]", 4),
        ("sei completamente pazzo, [epiteti]! dove hai lasciato [dimenticati]? [luoghi]?", 6),
        ("[epiteti], è ora di smetterla! smettila di [azioni]!", 5),
        ("chi diavolo ti ha dato la patente, [epiteti]? sembra un lavoro da uno senza [dimenticati]!", 7),
        ("svegliati, [epiteti]! guidi come se fossi [luoghi]!", 6),
        ("sei un disastro ambulante, [epiteti]! impara a [azioni]!", 6),
        ("ehi tu, [epiteti]! dove hai preso la patente, [luoghi]?", 6),
        ("ehi [epiteti], attenzione! qui non siamo [luoghi]!", 6),
        ("[epiteti], non siamo [luoghi]!", 4),
        ("spero che tu, [epiteti], guidi meglio [luoghi]!", 5),
        ("fai attenzione [epiteti], cerca di [azioni]!", 4),
        ("hai dimenticato [dimenticati], [epiteti]?", 3),
        ("forse dovresti, [epiteti], [azioni]!", 3),
        ("chi ti ha dato la patente? [epiteti]?", 3),
        ("[epiteti], guidi come [luoghi]!", 4),
        ("[epiteti], sei sicuro di non [azioni]?", 3),
        ("ma dove [imprecazione] guardi, [epiteti]?! gli specchietti non te li hanno messi lì mica per bellezza", 7),
        ("ma chi [imprecazione] ti ha dato la patente, [epiteti]?! l'hai vinta [luoghi]?", 7),
        ("rallenta, [epiteti]! non sei [luoghi], qui c'è gente vera che vuole arrivare a casa", 6),
        ("non si guida a cazzo, [epiteti]! metti la freccia e guarda dove [imprecazione] vai", 6),
        ("ma ti rendi conto, [epiteti]?! per un pelo non ci ammazzavi tutti e manco te ne accorgi", 7),
        ("tornatene [luoghi], [epiteti]! lì i danni che fai sono finti", 6),
        ("freccia, specchietti, cervello: hai dimenticato [dimenticati], vero [epiteti]?", 6),
        ("la strada non è solo tua, [epiteti]! impara a [azioni]", 5),
        ("ma sei deficiente o ci fai, [epiteti]?! [azioni], e subito", 6),
        ("lo specchietto serve, [epiteti]! non è un [espletivo-m] di soprammobile", 6),
        ("ma che [espletivo-f] di manovra era, [epiteti]?! hai rischiato di mandarci tutti al cimitero", 7),
        ("usa la testa, [epiteti], non il clacson! anche se a momenti dovevo usarlo io su di te", 6),
        ("è verde, [epiteti]! che aspetti, il [espletivo-m] di Natale?", 6),
        ("ma chi ti ha dato la patente, [epiteti]?! l'hai trovata in un [espletivo-m] di ovetto Kinder?", 7),
        ("la freccia, [epiteti]! quella perfetta sconosciuta esiste, usala", 6),
        ("ma 'ndo vai, [epiteti]?! la precedenza era mia, mica tua", 6),
        ("ma c'hai gli occhi o i fari spenti, [epiteti]?! guarda dove [imprecazione] vai", 6),
        ("tieni le distanze, [epiteti]! mica sei attaccato con il [espletivo-m] di velcro", 6),
        ("ma parcheggi o abbandoni la macchina, [epiteti]?! hai preso due posti", 6),
        ("esci da quel [espletivo-m] di telefono, [epiteti]! la strada è qui, non sullo schermo", 6),
        ("ma sei in autostrada o al Gran Premio, [epiteti]?! rallenta", 6),
        ("frena con la testa, [epiteti], non all'ultimo [espletivo-m] di secondo", 6),
        ("alla rotonda si dà la precedenza, [epiteti]! non è un [espletivo-m] di autoscontro", 6),
        ("ma mettila 'sta [espletivo-f] di freccia, [epiteti]! mica devo indovinare dove giri", 6),
        ("ma stammi a distanza, [epiteti]! mi stai praticamente nel bagagliaio", 6),
        ("il sorpasso in curva cieca, [epiteti]?! ma ti vuoi ammazzare e portarci pure noi?", 7),
        ("è un attraversamento pedonale, [epiteti]! la gente ci cammina, non è una [espletivo-f] di pista", 6),
        ("ma sei mezzo nella mia corsia, [epiteti]?! o di qua o di là, deciditi", 6),
        ("è rosso, [epiteti]! rosso vuol dire fermo, mica è una [espletivo-f] di decorazione", 6),
        ("ma in motorino in mezzo alle macchine, [epiteti]?! ti credi in un [espletivo-m] di videogioco", 6),
        ("li mortacci tua e di chi t'ha imparato a guidare, [epiteti]!", 6),
        ("va' in mona, [epiteti]! la freccia, 'sta cosa che manco agli indiani spiegavano", 6),
        ("ma porca puttana, [epiteti]! freccia, clacson, cervello: tutto optional per te, eh?", 7),
        ("ma che cazzo hai nel cranio, [epiteti]?! segatura?! il cervello di sicuro no", 7),
        ("ma l'hai presa a premio in un [espletivo-m] di autogrill, la patente, [epiteti]?!", 7),
        ("ma chi cazzo t'ha messo al volante, [epiteti]?! tua madre lo sa che giri così?", 7),
        ("la strada non è la tua [espletivo-f] di cameretta, [epiteti]! rientra in corsia", 6),
        ("freni sempre all'ultimo, [epiteti]! ma ce l'hai un [espletivo-m] di cervello o no?", 6),
        ("ma spostati, [epiteti]! occupi la corsia come un [espletivo-m] di trattore in tangenziale", 6),
        ("guidare è un privilegio, mica un [espletivo-m] di videogioco, [epiteti]!", 6),
        ("ma vaffanculo proprio, [epiteti]! sei un [espletivo-m] di pericolo con le ruote", 7),
        ("ma rallenta, porca l'oca, [epiteti]! non sei mica inseguito dai carabinieri", 6),
        ("metti la freccia, [epiteti]! mica te la fanno pagare a parte", 6),
    ];
}
