
// Alias tipizzati per i contenuti condivisi: niente stringhe magiche nei segnaposto.
using Eta = Backend.Generators.SharedContent.Eta;
using Nome = Backend.Generators.SharedContent.Nome;
using Parente = Backend.Generators.SharedContent.Parente;
using Piatti = Backend.Generators.SharedContent.Piatti;
using Social = Backend.Generators.SharedContent.Social;

namespace Backend.Generators.Catalog;

/// <summary>Rant anti-vegani.</summary>
public sealed class AntivegGenerator : GeneratorBase
{
    // Segnaposto LOCALI tipizzati: la chiave vive qui, liste e frasi referenziano il simbolo.
    internal static readonly Tag Vegani = new("vegani")
    {
        ("mangiaerba", 2),
        ("estremisti del tofu", 3),
        ("fanatici dei semi", 3),
        ("nemici della bistecca", 3),
        ("integralisti della verdura", 3),
        ("adoratori del cavolo", 3),
        ("fan del seitan", 3),
        ("apostoli del broccolo", 3),
        ("militanti della lattuga", 3),
        ("crociati del cavolfiore", 3),
        ("devoti della soia", 3),
        ("sacerdoti del pisello", 3),
        ("talebani del tofu", 3),
        ("erbivori mancati", 2),
        ("salutisti da tastiera", 3),
        ("figli dei fiori", 3),
        ("mangiasemi", 2),
        ("predicatori dell'insalata", 2),
        ("integralisti della carota", 3),
        ("veg-crociati", 2),
    };

    internal static readonly Tag Pregiudizi = new("pregiudizi")
    {
        ("non sanno nemmeno da dove prendere le proteine", 3),
        ("devono integrare la B12 con le pasticche, naturalissimo eh", 3),
        ("piangono per una mucca ma nella mietitura ne muoiono a migliaia", 3),
        ("col latte di mandorla prosciugano mezza California", 3),
        ("comprano avocado spediti dall'altro capo del mondo", 3),
        ("mangiano roba ultraprocessata uscita da un laboratorio", 3),
        ("sono pallidi come un cero pasquale", 3),
        ("te lo dicono nei primi cinque minuti che li conosci", 3),
        ("si credono Gandhi perché masticano un'insalata", 3),
        ("stanno con la PETA, che ne ammazza più di un macello", 3),
        ("vogliono salvare mucche che senza di noi manco esisterebbero", 3),
        ("predicano dal divano e poi ordinano il sushi", 3),
        ("rosicchiano una carota e si sentono in pace col mondo", 3),
        new($"scrivono trattati su {Social.Any} tra un integratore e l'altro", 4),
        ("fanno la morale col telefono pieno di plastica", 3),
        ("vogliono imporre a tutti il loro credo", 3),
        ("guardano lo spot ma non la filiera completa", 3),
        ("si bevono i numeri gonfiati dei documentari", 3),
    };

    internal static readonly Tag Concetto = new("concetto")
    {
        ("veganesimo", 2),
        ("veganismo", 2),
        ("vegetarianismo", 2),
        ("crudismo", 2),
        ("fruttarianismo", 2),
        ("crudismo vegetale", 2),
        ("macrobiotismo", 2),
        ("fruttarianesimo", 2),
        ("regime a base vegetale", 3),
        ("regime a zero impatto", 3),
        ("movimento plant-based", 2),
        ("credo vegano", 2),
        ("veganismo etico", 3),
        ("crudismo militante", 3),
        ("stile di vita cruelty-free", 3),
        ("dieta a impatto zero", 3),
    };

    // ESTENSIONI dei piatti condivisi: la carne pesante è roba da antivegano, gli altri generatori
    // restano coi piatti neutri. Stesse regole di concordanza (niente elisioni).
    internal static readonly Tag PiattiCarneM = new(Piatti.M)
    {
        "cotechino", "filetto", "galletto alla diavola",
    };
    internal static readonly Tag PiattiCarneF = new(Piatti.F)
    {
        "bistecca", "salsiccia", "porchetta", "trippa",
    };

    // I piatti arrivano dai CONDIVISI (concordanza per genere); la chiave è "piatto-antiveg" per
    // non collidere con la composta condivisa "piatto". I template portano il colore (il parente
    // anziano senza articolo concorda sempre: "di nonna", "di zio", "di suocera"); i letterali
    // coprono i casi che non stanno nelle liste condivise.
    internal static readonly Tag Piatto = new("piatto-antiveg")
    {
        new($"un bel {Piatti.M} di {Parente.Anziano.Any}", 3),
        new($"una {Piatti.F} come Dio comanda", 3),
        new($"un {Piatti.M} della domenica", 3),
        new($"un bel {Piatti.M}", 3),
        new($"una bella {Piatti.F}", 3),
        ("una fiorentina al sangue", 3),
        ("una grigliata tra amici", 3),
        ("uno spezzatino della mamma", 3),
        ("delle braciole alla brace", 3),
        ("un bel piatto di salsicce", 3),
        ("un tagliere di salumi misti", 3),
        ("un arrosto della domenica", 3),
        ("una costata alta tre dita", 4),
        ("un fritto misto di carne", 3),
        ("delle costine glassate al barbecue", 4),
    };

    internal static readonly Tag Carne = new("carne")
    {
        ("carne", 2),
        ("carne rossa", 2),
        ("carne al sangue", 3),
        ("proteina animale", 2),
        ("proteina nobile", 2),
        ("ciccia", 2),
        ("carne vera", 2),
        ("carne del macellaio di fiducia", 3),
        ("una bella tagliata", 3),
        ("proteina come si deve", 2),
        ("ciccia genuina", 2),
        ("carne allevata a terra", 3),
        ("carne di manzo piemontese", 3),
        ("una bistecca di frisona", 3),
        ("roba con dentro il ferro", 2),
    };

    internal static readonly Tag Aggettivo = new("aggettivo")
    {
        ("deboli", 2),
        ("malnutriti", 2),
        ("anemici", 2),
        ("pallidi", 2),
        ("smunti", 2),
        ("carenti di ferro", 3),
        ("tristi", 2),
        ("illusi", 2),
        ("carenti di B12", 3),
        ("mosci", 2),
        ("spenti", 2),
        ("esangui", 2),
        ("gracili", 2),
        ("carenti di creatina", 3),
        ("con l'aria da martiri", 3),
    };

    internal static readonly Tag Idoli = new("idoli")
    {
        ("il Liver King", 3),
        ("Joe Rogan", 2),
        ("la dieta carnivora", 3),
        ("i video sulla dieta carnivora", 3),
        ("il mio personal trainer", 3),
        ("i veri uomini di una volta", 3),
        ("il macellaio di fiducia", 3),
        ("mio nonno che è arrivato a novantacinque anni a suon di lardo", 4),
        ("un bodybuilder ucraino su YouTube", 3),
        ("il dottore che dice quello che voglio sentire", 4),
        ("un powerlifter norvegese", 3),
        ("il cugino che fa crossfit", 3),
        ("Bear Grylls che mangia crudo", 3),
        ("un tizio su Reddit con la dieta ancestrale", 4),
        ("il pastore abruzzese che campa di formaggio e salsiccia", 4),
    };

    /// <summary>Piattaforme di streaming: brand reali.</summary>
    internal static readonly Tag Streaming = new("streaming")
    {
        "Netflix", "Prime Video", "Disney+", "YouTube", "Rai Play",
        "Twitch", "Mediaset Infinity", "DAZN", "NOW", "Apple TV+",
        "Paramount+", "Crunchyroll", "Pluto TV", "il canale Telegram del cugino", "un gruppo Facebook di complottisti",
    };

    internal static readonly Tag Indottrina = new("indottrina")
    {
        new($"indottrinati da un documentario su {Streaming}", 3),
        new($"convinti da un reel su {Social.Any}", 3),
        ("plagiati da quattro influencer", 3),
        ("cresciuti a propaganda catastrofista", 3),
        ("col cervello lavato da un docu-film", 3),
        new($"convertiti da un tiktoker su {Social.Any}", 3),
        ("plagiati da una tesina universitaria", 3),
        new($"catechizzati da un podcast su {Streaming}", 3),
        ("convinti da un'infografica su Instagram", 3),
        ("cresciuti a suon di documentari Netflix", 3),
        ("radicalizzati in un forum vegano", 3),
        ("persuasi da una nutrizionista influencer", 3),
        ("plagiati dalla ragazza del liceo artistico", 4),
        ("convertiti dopo un weekend in un ritiro yoga", 4),
        ("indottrinati da un TED talk di quindici minuti", 3),
    };

    // Chiosa da rant in coda ai tormentoni "fissi": aggiunge una minima variazione senza cambiarne il
    // senso (registro da bar). Serve solo a dare un tag anche alle frasi altrimenti identiche a sé stesse.
    internal static readonly Tag Rincaro = new("rincaro")
    {
        "punto", "e basta", "chiaro?", "sveglia", "apri gli occhi",
        "e non si scappa", "fidati", "fine della storia", "è così", "senza storie",
        "e chi se ne frega", "punto e a capo", "te lo dico io", "e amen",
        "capito come", "e non se ne parla più", "svegliati", "questo è quanto",
    };


    /// <inheritdoc />
    public override string Slug => "antiveg";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 8, Name = "Generatore Rant Anti-Vegani", Description = "Senti cosa ha da dire ancora il generico negazionista vegano" };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 2, MaxPhrases = 4, Separators = ["!! ", "!1! ", "! ", "\n"] };

    /// <inheritdoc />
    public override Frase? Apertura => "``";

    /// <inheritdoc />
    public override Frase? Chiusura => new($"``\n\n- _{Nome.Any} {Eta.Adulto} anni, su {Social.Any}_");

    /// <inheritdoc />
    // Le prime tre etichette SONO i segnaposto (unicità sul token, conversione implicita Tag→Etichetta);
    // le altre sono parole-chiave del testo, validate al boot contro le frasi della catena.
    public override List<Etichetta>? UniqueLabels { get; } = [Concetto, Piatto, Idoli, "proteine", "canini", "catena alimentare", "leone", "mietitura", "PETA", "mandorla", "B12", "soia", "mammut", "bacon", "setta", "specchio", "Dio", "provetta", "fiorentina", "ragù", "onnivori", "avocado", "spotted", "ferro", "verdura urla", "rispetto", "grigliata", "filiera", "dati", "tofu", "trattore", "integratori", "quinoa", "monocolture", "complottista", "inquina"];

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        new($"ma le piante allora? anche loro soffrono quando le strappi, ci hai mai pensato {Vegani}?", 8),
        new($"da dove le prendi le proteine, dall'aria? questi {Vegani} {Pregiudizi}", 6),
        // Recuperate dal JSON originale: usavano la lista "indottrina", persa nel refactor JSON→classi.
        new($"sti {Vegani} sono semplicemente {Indottrina}", 6),
        new($"questi {Vegani} sono {Indottrina} e {Aggettivo}", 6),
        new($"abbiamo i canini per un motivo, mica per masticare la lattuga, {Rincaro}", 20),
        new($"siamo in cima alla catena alimentare, fattene una ragione, {Rincaro}", 20),
        new($"il leone mica chiede scusa alla gazzella, è la natura bellezza, {Rincaro}", 20),
        new($"nella mietitura del grano muoiono più topi che in un allevamento, altro che {Carne}", 5),
        new($"la PETA ammazza più cani e gatti di una macelleria, informati prima di aprire bocca, {Rincaro}", 20),
        new($"il tuo latte di mandorla sta prosciugando la California, altro che ambientalista, {Rincaro}", 20),
        new($"se devi integrare la B12 con le pasticche, forse la natura ti sta dicendo qualcosa, {Rincaro}", 20),
        new($"troppa soia abbassa il testosterone, è risaputo, {Rincaro}", 20),
        new($"una persona sola non cambia niente, mangiati della {Carne} e stai sereno", 5),
        new($"se non le allevassimo le mucche si estinguerebbero, siamo noi a salvarle, {Rincaro}", 20),
        new($"i nostri antenati cacciavano i mammut mentre voi {Vegani} piangete per un broccolo", 5),
        new($"vabbè ma il bacon però... non dirmi che non ti manca, {Rincaro}", 20),
        new($"siete una setta, lo dite entro cinque minuti che vi si conosce, {Rincaro}", 20),
        new($"guardatevi allo specchio, {Aggettivo}, e poi venite a parlarmi di salute", 5),
        new($"fai come il Liver King, un po' di carne cruda e ti rimetti in sesto, {Rincaro}", 20),
        new($"l'ha spiegato pure Joe Rogan nel podcast, ma 'sti {Vegani} {Pregiudizi}", 5),
        new($"le mie mucche pascolano felici, mica come la tua roba di laboratorio, {Rincaro}", 20),
        new($"Dio ci ha messo gli animali sulla terra per un motivo, {Rincaro}", 20),
        new($"è una mia scelta, non venire a impormi il tuo {Concetto}", 5),
        new($"mangi seitan e tofu, roba uscita da una provetta, e ti senti pure superiore, {Rincaro}", 20),
        new($"una bella fiorentina al sangue e ti passano tutte 'ste fisime, {Rincaro}", 20),
        new($"il ragù di {Parente.Anziano.Any} lo rifai col seitan? è un insulto bello e buono", 8),
        new($"siamo onnivori, lo dice la biologia, non un documentario su Netflix, {Rincaro}", 20),
        new($"i tuoi avocado arrivano dall'altra parte del mondo, bell'ambientalista, {Rincaro}", 20),
        new($"spotted the vegan, ci mette sempre il becco in ogni discorso, {Rincaro}", 20),
        new($"il {Concetto} è roba da ricchi annoiati, prova a farlo con lo stipendio vero", 5),
        new($"il cervello va a ferro e B12, mica a quinoa, {Rincaro}", 20),
        new($"una grigliata tra amici e voi {Vegani} lì tristi a rosicchiare una carota", 5),
        new($"la verdura urla quando la tagli, solo che tu non la senti, {Rincaro}", 20),
        new($"io gli animali li rispetto: me li mangio dal primo all'ultimo pezzo, zero sprechi, {Rincaro}", 20),
        new($"il {Concetto} è solo il nuovo modo per sentirsi speciali su {Social.Any}", 5),
        new($"carnivoro da generazioni e sto benissimo, 'sti {Vegani} {Pregiudizi}", 5),
        new($"ma davvero rinunci a {Piatto} per un'ideologia?", 5),
        new($"{Vegani} {Aggettivo} che {Pregiudizi}", 3),
        new($"guarda {Idoli}, altro che il tuo {Concetto}", 4),
        new($"questi {Vegani} {Pregiudizi}", 3),
        new($"non rompete con 'sto {Concetto}, lasciatemi mangiare in pace", 5),
        new($"rinunceresti a {Piatto}? io manco morto", 5),
        new($"questi {Vegani} {Pregiudizi}, ma poi {Pregiudizi}", 4),
        new($"il {Concetto} è una moda da {Social.Any}, tra sei mesi non se lo fila più nessuno", 6),
        new($"noi {Aggettivo}? ma sono questi {Vegani} che {Pregiudizi}", 5),
        new($"mezzo chilo di {Carne} e ti torna il sorriso, fidati", 5),
        new($"non sono contro l'ambiente, ma se guardi tutta la filiera l'agricoltura vegetale inquina più degli allevamenti, {Rincaro}", 20),
        new($"informati sui dati veri: per un chilo di tofu serve più acqua che per una bistecca, {Rincaro}", 20),
        new($"le monocolture di soia divorano più foreste di qualsiasi allevamento, guarda i numeri, {Rincaro}", 20),
        new($"io per primo voglio salvare il pianeta, ma bisogna guardare tutta la filiera, non lo spot, {Rincaro}", 20),
        new($"il trattore che ara il campo inquina più di una mandria intera, ma questo non te lo dicono, {Rincaro}", 20),
        new($"se conti trasporti e fertilizzanti, la tua insalata importata inquina più dell'agnello del contadino qui sotto, {Rincaro}", 20),
        new($"gli integratori che prendete li fanno in laboratorio col petrolio, altro che naturale, {Rincaro}", 20),
        new($"non è ideologia, è guardare i dati reali invece dei documentari, {Rincaro}", 20),
        new($"la quinoa arriva in aereo dal Perù, altro che impatto zero, {Rincaro}", 20),
        new($"non sono complottista, ma chiediti chi ci guadagna a venderti il {Concetto}", 5),
    ];
}
