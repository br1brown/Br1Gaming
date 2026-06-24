using Backend.Models;

namespace Backend.Generators.Catalog;

/// <summary>Rant anti-vegani.</summary>
public sealed class AntivegGenerator : GeneratorBase
{
    /// <inheritdoc />
    public override string Slug => "antiveg";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 3, Name = "Generatore Rant Anti-Vegani", Description = "Senti cosa ha da dire ancora il generico negazionista vegano" };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 2, MaxPhrases = 4, Separators = ["!! ", "!1! ", "! ", "\n"] };

    /// <inheritdoc />
    public override string? Apertura => "``";

    /// <inheritdoc />
    public override string? Chiusura => "``\n\n- _[nome] [eta-adulto] anni, su [social]_";

    /// <inheritdoc />
    public override List<string>? UniqueLabels { get; } = ["[concetto]", "[piatto]", "[idoli]", "proteine", "canini", "catena alimentare", "leone", "mietitura", "PETA", "mandorla", "B12", "soia", "mammut", "bacon", "setta", "specchio", "Dio", "provetta", "fiorentina", "ragù", "onnivori", "avocado", "spotted", "ferro", "verdura urla", "rispetto", "grigliata", "filiera", "dati", "tofu", "trattore", "integratori", "quinoa", "monocolture", "complottista", "inquina"];

    /// <inheritdoc />
    public override Dictionary<string, List<ScoredItem>> FlatLists { get; } = new()
    {
        ["vegani"] =
        [
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
        ],
        ["concetto"] =
        [
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
        ],
        ["carne"] =
        [
            ("carne", 2),
            ("carne rossa", 2),
            ("carne al sangue", 3),
            ("proteina animale", 2),
            ("proteina nobile", 2),
            ("ciccia", 2),
            ("carne vera", 2),
        ],
        ["piatto"] =
        [
            ("una fiorentina al sangue", 3),
            ("un bel ragù della nonna", 3),
            ("una carbonara come Dio comanda", 3),
            ("un tagliere di salumi", 3),
            ("un arrosto della domenica", 3),
            ("una grigliata tra amici", 3),
            ("una cotoletta alla milanese", 3),
            ("uno spezzatino della mamma", 3),
            ("delle braciole alla brace", 3),
            ("un bel piatto di salsicce", 3),
        ],
        ["idoli"] =
        [
            ("il Liver King", 3),
            ("Joe Rogan", 2),
            ("la dieta carnivora", 3),
            ("i video sulla dieta carnivora", 3),
            ("il mio personal trainer", 3),
            ("i veri uomini di una volta", 3),
        ],
        ["aggettivo"] =
        [
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
        ],
        ["indottrina"] =
        [
            ("indottrinati da un documentario su Netflix", 3),
            ("convinti da un reel su Instagram", 3),
            ("plagiati da quattro influencer", 3),
            ("cresciuti a propaganda catastrofista", 3),
            ("col cervello lavato da un docu-film", 3),
        ],
        ["pregiudizi"] =
        [
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
            ("scrivono trattati su [social] tra un integratore e l'altro", 4),
            ("fanno la morale col telefono pieno di plastica", 3),
            ("vogliono imporre a tutti il loro credo", 3),
            ("guardano lo spot ma non la filiera completa", 3),
            ("si bevono i numeri gonfiati dei documentari", 3),
        ],
    };

    /// <inheritdoc />
    public override List<ScoredItem> Core { get; } =
    [
        ("ma le piante allora? anche loro soffrono quando le strappi, ci hai mai pensato [vegani]?", 8),
        ("da dove le prendi le proteine, dall'aria? questi [vegani] [pregiudizi]", 6),
        ("abbiamo i canini per un motivo, mica per masticare la lattuga", 20),
        ("siamo in cima alla catena alimentare, fattene una ragione", 20),
        ("il leone mica chiede scusa alla gazzella, è la natura bellezza", 20),
        ("nella mietitura del grano muoiono più topi che in un allevamento, altro che [carne]", 5),
        ("la PETA ammazza più cani e gatti di una macelleria, informati prima di aprire bocca", 20),
        ("il tuo latte di mandorla sta prosciugando la California, altro che ambientalista", 20),
        ("se devi integrare la B12 con le pasticche, forse la natura ti sta dicendo qualcosa", 20),
        ("troppa soia abbassa il testosterone, è risaputo", 20),
        ("una persona sola non cambia niente, mangiati della [carne] e stai sereno", 5),
        ("se non le allevassimo le mucche si estinguerebbero, siamo noi a salvarle", 20),
        ("i nostri antenati cacciavano i mammut mentre voi [vegani] piangete per un broccolo", 5),
        ("vabbè ma il bacon però... non dirmi che non ti manca", 20),
        ("siete una setta, lo dite entro cinque minuti che vi si conosce", 20),
        ("guardatevi allo specchio, [aggettivo], e poi venite a parlarmi di salute", 5),
        ("fai come il Liver King, un po' di carne cruda e ti rimetti in sesto", 20),
        ("l'ha spiegato pure Joe Rogan nel podcast, ma 'sti [vegani] [pregiudizi]", 5),
        ("le mie mucche pascolano felici, mica come la tua roba di laboratorio", 20),
        ("Dio ci ha messo gli animali sulla terra per un motivo", 20),
        ("è una mia scelta, non venire a impormi il tuo [concetto]", 5),
        ("mangi seitan e tofu, roba uscita da una provetta, e ti senti pure superiore", 20),
        ("una bella fiorentina al sangue e ti passano tutte 'ste fisime", 20),
        ("il ragù della nonna lo rifai col seitan? è un insulto bello e buono", 20),
        ("siamo onnivori, lo dice la biologia, non un documentario su Netflix", 20),
        ("i tuoi avocado arrivano dall'altra parte del mondo, bell'ambientalista", 20),
        ("spotted the vegan, ci mette sempre il becco in ogni discorso", 20),
        ("il [concetto] è roba da ricchi annoiati, prova a farlo con lo stipendio vero", 5),
        ("il cervello va a ferro e B12, mica a quinoa", 20),
        ("una grigliata tra amici e voi [vegani] lì tristi a rosicchiare una carota", 5),
        ("la verdura urla quando la tagli, solo che tu non la senti", 20),
        ("io gli animali li rispetto: me li mangio dal primo all'ultimo pezzo, zero sprechi", 20),
        ("il [concetto] è solo il nuovo modo per sentirsi speciali su [social]", 5),
        ("carnivoro da generazioni e sto benissimo, 'sti [vegani] [pregiudizi]", 5),
        ("ma davvero rinunci a [piatto] per un'ideologia?", 5),
        ("[vegani] [aggettivo] che [pregiudizi]", 3),
        ("guarda [idoli], altro che il tuo [concetto]", 4),
        ("questi [vegani] [pregiudizi]", 3),
        ("non rompete con 'sto [concetto], lasciatemi mangiare in pace", 5),
        ("rinunceresti a [piatto]? io manco morto", 5),
        ("questi [vegani] [pregiudizi], ma poi [pregiudizi]", 4),
        ("il [concetto] è una moda da [social], tra sei mesi non se lo fila più nessuno", 6),
        ("noi [aggettivo]? ma sono questi [vegani] che [pregiudizi]", 5),
        ("mezzo chilo di [carne] e ti torna il sorriso, fidati", 5),
        ("non sono contro l'ambiente, ma se guardi tutta la filiera l'agricoltura vegetale inquina più degli allevamenti", 20),
        ("informati sui dati veri: per un chilo di tofu serve più acqua che per una bistecca", 20),
        ("le monocolture di soia divorano più foreste di qualsiasi allevamento, guarda i numeri", 20),
        ("io per primo voglio salvare il pianeta, ma bisogna guardare tutta la filiera, non lo spot", 20),
        ("il trattore che ara il campo inquina più di una mandria intera, ma questo non te lo dicono", 20),
        ("se conti trasporti e fertilizzanti, la tua insalata importata inquina più dell'agnello del contadino qui sotto", 20),
        ("gli integratori che prendete li fanno in laboratorio col petrolio, altro che naturale", 20),
        ("non è ideologia, è guardare i dati reali invece dei documentari", 20),
        ("la quinoa arriva in aereo dal Perù, altro che impatto zero", 20),
        ("non sono complottista, ma chiediti chi ci guadagna a venderti il [concetto]", 5),
    ];
}
