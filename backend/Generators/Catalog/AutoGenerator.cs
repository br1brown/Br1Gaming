
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
    // Segnaposto LOCALI tipizzati: la chiave vive qui, liste e frasi referenziano il simbolo.
    // ORDINE = dipendenze: epiteti e luoghi compongono insulti/espletivi, che devono nascere prima.
    // Insulti rivolti alla PERSONA del guidatore (apposizione "[insulto-m] di <ruolo>").
    internal static readonly Tag InsultoM = new("insulto-m")
    {
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
    };

    // Nomi volgari MASCHILI per qualificare oggetti/luoghi ("quel [espletivo-m] di telefono").
    internal static readonly Tag EspletivoM = new("espletivo-m")
    {
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
        ("porcile", 2),
        ("sfascio", 2),
        ("delirio", 2),
        ("cimitero di ferraglia", 3),
    };

    // Nomi volgari FEMMINILI per qualificare cose femminili ("una [espletivo-f] di pista").
    internal static readonly Tag EspletivoF = new("espletivo-f")
    {
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
        ("pantomima", 2),
        ("carnevalata", 2),
        ("sciagura", 2),
        ("sceneggiata napoletana", 3),
        ("manfrina", 2),
    };

    // Intensificatori avverbiali ("ma dove [imprecazione] guardi", "chi [imprecazione] ti ha dato...").
    internal static readonly Tag Imprecazione = new("imprecazione")
    {
        ("cazzo", 2),
        ("minchia", 2),
        ("diavolo", 2),
        ("porco diavolo", 2),
        ("cazzo di cazzo", 2),
        ("cristo", 2),
        ("porco dio", 3),
        ("dio cane", 3),
        ("porca miseria", 2),
        ("porco cane", 2),
        ("belino", 2),
        ("madonna santa", 2),
        ("accidenti", 2),
        ("porca paletta", 2),
        ("sacramento", 2),
        ("boia deh", 3),
    };

    // Epiteti = vocativo del guidatore: insulto+ruolo, trovate comiche e qualche regionalismo (raro).
    internal static readonly Tag Epiteti = new("epiteti")
    {
        new($"{InsultoM} di un aspirante pilota", 4),
        new($"{InsultoM} di un guidatore folle", 4),
        new($"{InsultoM} di un spericolato", 4),
        new($"{InsultoM} di un apprendista autista", 4),
        new($"{InsultoM} di un pilota improvvisato", 4),
        new($"{InsultoM} di un distratto", 4),
        new($"{InsultoM} di un pirata della strada", 4),
        new($"{InsultoM} di un assassino", 4),
        new($"{InsultoM} di un terrorista del traffico", 4),
        new($"{InsultoM} di un kamikaze del traffico", 4),
        new($"{InsultoM} di un criminale al volante", 4),
        new($"{InsultoM} di una disgrazia motorizzata", 4),
        new($"{InsultoM} di una lumaca col motore", 4),
        new($"{InsultoM} di un autista della domenica", 4),
        new($"{InsultoM} di uno scappato di casa", 4),
        new($"{InsultoM} di un tamarro", 4),
        new($"{InsultoM} di un coatto", 4),
        new($"{InsultoM} di un neopatentato", 4),
        new($"{InsultoM} di un prepotente della strada", 4),
        new($"{InsultoM} di un patentato col Kinder sorpresa", 4),
        new($"{InsultoM} di un mago delle manovre del cazzo", 4),
        new($"{InsultoM} di un flagello della corsia", 4),
        new($"{InsultoM} di un cervello in panne... altro che la macchina", 4),
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
    };

    internal static readonly Tag Luoghi = new("luoghi")
    {
        new($"in un {EspletivoM} di circo", 4),
        new($"in un {EspletivoM} di videogame", 4),
        new($"in un {EspletivoM} di parco giochi", 4),
        new($"in un {EspletivoM} di film d'azione", 4),
        new($"in un {EspletivoM} di gioco di realtà virtuale", 4),
        new($"da un {EspletivoM} di venditore di tappeti volanti", 4),
        new($"in un {EspletivoM} di mercatino dell'usato", 4),
        new($"in un {EspletivoM} di tendone da circo", 4),
        new($"in un {EspletivoM} di girone infernale", 4),
        new($"in un {EspletivoM} di simulatore di guida con il volante storto", 4),
        new($"in un {EspletivoM} di arcade degli anni '80", 4),
        new($"in un {EspletivoM} di autoscontro del luna park", 4),
        new($"in un {EspletivoM} di campo di patate", 4),
        new($"dentro un {EspletivoM} di flipper", 4),
        new($"in un {EspletivoM} di trattore senza freni", 4),
        new($"a un {EspletivoM} di Gran Premio", 4),
        new($"al {EspletivoM} di mercato", 4),
        new($"in una {EspletivoF} di lotteria", 4),
        new($"in una {EspletivoF} di pista da corsa fatta in casa", 4),
        new($"su una {EspletivoF} di giostra", 4),
        new($"in una {EspletivoF} di sagra di paese", 4),
        new($"in mezzo a una {EspletivoF} di gincana", 4),
        ("in una pista da corsa", 3),
        ("nei simulatori di guida", 3),
        ("nelle quinte di un film d'azione di terza categoria", 3),
    };

    internal static readonly Tag Azioni = new("azioni")
    {
        ("ritornare alla scuola guida", 3),
        ("rifare la scuola guida da capo", 3),
        ("prendere qualche lezione in più", 3),
        new($"rottamare quel {EspletivoM} di catorcio", 4),
        new($"togliere le mani da quel {EspletivoM} di telefono", 4),
        ("guardare ogni tanto gli specchietti", 3),
        ("guardare lo specchietto prima di svoltare", 3),
        ("usare la freccia ogni tanto", 3),
        ("dare la precedenza", 3),
        ("rispettare la distanza di sicurezza", 3),
        ("imparare cos'è la distanza di sicurezza", 3),
        ("guidare col cervello invece che con i piedi", 3),
        ("riconsegnare la patente", 3),
        new($"andartene {Luoghi} a fare i danni finti", 3),
        new($"scendere da quella {EspletivoF} di macchina e farti investire", 4),
    };

    internal static readonly Tag Dimenticati = new("dimenticati")
    {
        new($"il {EspletivoM} di buonsenso", 4),
        new($"il {EspletivoM} di cervello", 4),
        new($"il {EspletivoM} di codice della strada", 4),
        new($"ogni {EspletivoM} di neurone che ti era rimasto", 4),
        ("la vista", 2),
        ("le frecce, che esistono", 3),
        ("lo specchietto retrovisore", 3),
        ("come si usano gli specchietti", 3),
        ("la precedenza", 2),
        ("il cervello a casa", 3),
        new($"l'esame di teoria del {1988..2005}", 4),
        ("il manuale di guida sotto il sedile", 4),
        ("che esiste anche la retromarcia", 3),
        ("come si esce da una rotonda", 4),
        ("che gli altri sulla strada esistono", 3),
    };

    // Etichetta unica: una sola frase sul "come guidi" per invettiva.
    private static readonly Etichetta Guidi = new("guidi");

    /// <inheritdoc />
    public override string Slug => "auto";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 7, Name = "Generatore Invettive Automobilistiche", Description = "Per tutte le volte che il clacson da solo non basta a far capire il concetto" };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 2, MaxPhrases = 4, Separators = ["! eh?!?! ", "! cosa cazzo?! ", "! ma porca miseria!! ", "! oh cazzo no!! ", "! eh?! ma come cazzo è possibile?! ", "! che cazzo stai facendo?! ", "! no, no e poi no, cazzo!! ", "! ma vaffanculo!! ", "! oh madonna, mi stai prendendo per il culo?! ", "! eh... fighi un cazzo!! ", "! ma davvero?! ma davvero cazzo?! ", "! basta, ho finito la pazienza!! ", "! oh! oh! oh! non ci posso credere!! ", "! ma che cazzo vuoi?! ", "! eeeeeh?!?! ", "! porca puttana!! ", "! ma tu sei fuori di testa?! ", "! ho detto no, cazzo!! ", "! mi stai facendo incazzare di brutto!! ", "! ma va a cagare!! ", "! ma sei nato in autostrada?! ", "! ma vai a quel paese!! ", "! testa di cazzo!! ", "! ma chi cazzo ti caga?! ", "! ma stai sul cazzo a tutti?! ", "! porco il clacson!! ", "! ma suona te 'sto clacson, no?! ", "! ma t'hanno dato la patente coi punti?! ", "! porca troia!! ", "! ma che cazzo combini?! ", "! madonna santa che pena!! ", "! ma quanto sei coglione?! ", "! ma muoviti, cazzo!! ", "! ma t'hanno svitato la testa?! ", "! oh, ma ci sei o ci fai?! "] };

    /// <inheritdoc />
    public override Frase? Chiusura => "!";

    /// <inheritdoc />
    public override List<Etichetta>? UniqueLabels { get; } = [Guidi];

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        new($"ma sei serio, {Epiteti}? sembra che tu abbia preso la patente {Luoghi}!", 6),
        new($"questo è il colmo, {Epiteti}! stai guidando come se fossimo {Luoghi}!", 7),
        new($"{Epiteti}, hai trasformato la strada {Luoghi}! sei fuori di testa?", 6),
        new($"incredibile, {Epiteti}! la tua guida è peggio di stare {Luoghi}!", 7),
        new($"{Epiteti}, sei un {Epiteti}! smettila di {Azioni}", 4),
        new($"sei completamente pazzo, {Epiteti}! dove hai lasciato {Dimenticati}? {Luoghi}?", 6),
        new($"{Epiteti}, è ora di smetterla! smettila di {Azioni}!", 5),
        new($"chi diavolo ti ha dato la patente, {Epiteti}? sembra un lavoro da uno senza {Dimenticati}!", 7),
        new($"svegliati, {Epiteti}! guidi come se fossi {Luoghi}!", 6),
        new($"sei un disastro ambulante, {Epiteti}! impara a {Azioni}!", 6),
        new($"ehi tu, {Epiteti}! dove hai preso la patente, {Luoghi}?", 6),
        new($"ehi {Epiteti}, attenzione! qui non siamo {Luoghi}!", 6),
        new($"{Epiteti}, non siamo {Luoghi}!", 4),
        new($"spero che tu, {Epiteti}, guidi meglio {Luoghi}!", 5),
        new($"fai attenzione {Epiteti}, cerca di {Azioni}!", 4),
        new($"hai dimenticato {Dimenticati}, {Epiteti}?", 3),
        new($"forse dovresti, {Epiteti}, {Azioni}!", 3),
        new($"chi ti ha dato la patente? {Epiteti}?", 3),
        new($"{Epiteti}, guidi come {Luoghi}!", 4),
        new($"{Epiteti}, sei sicuro di non {Azioni}?", 3),
        new($"ma dove {Imprecazione} guardi, {Epiteti}?! gli specchietti non te li hanno messi lì mica per bellezza", 7),
        new($"ma chi {Imprecazione} ti ha dato la patente, {Epiteti}?! l'hai vinta {Luoghi}?", 7),
        new($"rallenta, {Epiteti}! non sei {Luoghi}, qui c'è gente vera che vuole arrivare a casa", 6),
        new($"non si guida a cazzo, {Epiteti}! metti la freccia e guarda dove {Imprecazione} vai", 6),
        new($"ma ti rendi conto, {Epiteti}?! per un pelo non ci ammazzavi tutti e manco te ne accorgi", 7),
        new($"tornatene {Luoghi}, {Epiteti}! lì i danni che fai sono finti", 6),
        new($"freccia, specchietti, cervello: hai dimenticato {Dimenticati}, vero {Epiteti}?", 6),
        new($"la strada non è solo tua, {Epiteti}! impara a {Azioni}", 5),
        new($"ma sei deficiente o ci fai, {Epiteti}?! {Azioni}, e subito", 6),
        new($"lo specchietto serve, {Epiteti}! non è un {EspletivoM} di soprammobile", 6),
        new($"ma che {EspletivoF} di manovra era, {Epiteti}?! hai rischiato di mandarci tutti al cimitero", 7),
        new($"usa la testa, {Epiteti}, non il clacson! anche se a momenti dovevo usarlo io su di te", 6),
        new($"è verde, {Epiteti}! che aspetti, il {EspletivoM} di Natale?", 6),
        new($"ma chi ti ha dato la patente, {Epiteti}?! l'hai trovata in un {EspletivoM} di ovetto Kinder?", 7),
        new($"la freccia, {Epiteti}! quella perfetta sconosciuta esiste, usala", 6),
        new($"ma 'ndo vai, {Epiteti}?! la precedenza era mia, mica tua", 6),
        new($"ma c'hai gli occhi o i fari spenti, {Epiteti}?! guarda dove {Imprecazione} vai", 6),
        new($"tieni le distanze, {Epiteti}! mica sei attaccato con il {EspletivoM} di velcro", 6),
        new($"ma parcheggi o abbandoni la macchina, {Epiteti}?! hai preso due posti", 6),
        new($"esci da quel {EspletivoM} di telefono, {Epiteti}! la strada è qui, non sullo schermo", 6),
        new($"ma sei in autostrada o al Gran Premio, {Epiteti}?! rallenta", 6),
        new($"frena con la testa, {Epiteti}, non all'ultimo {EspletivoM} di secondo", 6),
        new($"alla rotonda si dà la precedenza, {Epiteti}! non è un {EspletivoM} di autoscontro", 6),
        new($"ma mettila 'sta {EspletivoF} di freccia, {Epiteti}! mica devo indovinare dove giri", 6),
        new($"ma stammi a distanza, {Epiteti}! mi stai praticamente nel bagagliaio", 6),
        new($"il sorpasso in curva cieca, {Epiteti}?! ma ti vuoi ammazzare e portarci pure noi?", 7),
        new($"è un attraversamento pedonale, {Epiteti}! la gente ci cammina, non è una {EspletivoF} di pista", 6),
        new($"ma sei mezzo nella mia corsia, {Epiteti}?! o di qua o di là, deciditi", 6),
        new($"è rosso, {Epiteti}! rosso vuol dire fermo, mica è una {EspletivoF} di decorazione", 6),
        new($"ma in motorino in mezzo alle macchine, {Epiteti}?! ti credi in un {EspletivoM} di videogioco", 6),
        new($"li mortacci tua e di chi t'ha imparato a guidare, {Epiteti}!", 6),
        new($"va' in mona, {Epiteti}! la freccia, 'sta cosa che manco agli indiani spiegavano", 6),
        new($"ma porca puttana, {Epiteti}! freccia, clacson, cervello: tutto optional per te, eh?", 7),
        new($"ma che cazzo hai nel cranio, {Epiteti}?! segatura?! il cervello di sicuro no", 7),
        new($"ma l'hai presa a premio in un {EspletivoM} di autogrill, la patente, {Epiteti}?!", 7),
        new($"ma chi cazzo t'ha messo al volante, {Epiteti}?! tua madre lo sa che giri così?", 7),
        new($"la strada non è la tua {EspletivoF} di cameretta, {Epiteti}! rientra in corsia", 6),
        new($"freni sempre all'ultimo, {Epiteti}! ma ce l'hai un {EspletivoM} di cervello o no?", 6),
        new($"ma spostati, {Epiteti}! occupi la corsia come un {EspletivoM} di trattore in tangenziale", 6),
        new($"guidare è un privilegio, mica un {EspletivoM} di videogioco, {Epiteti}!", 6),
        new($"ma vaffanculo proprio, {Epiteti}! sei un {EspletivoM} di pericolo con le ruote", 7),
        new($"ma rallenta, porca l'oca, {Epiteti}! non sei mica inseguito dai carabinieri", 6),
        new($"metti la freccia, {Epiteti}! mica te la fanno pagare a parte", 6),
    ];
}
