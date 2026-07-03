
namespace Backend.Generators;

/// <summary>
/// Dati condivisi tra tutti i generatori (un tempo <c>data/generators/shared.json</c>):
/// dizionari di parole comuni, gruppi di policy, liste composte e fasce d'età.
/// </summary>
/// <remarks>
/// VOCABOLARIO DEI SEGNAPOSTO (cosa si può interpolare in una <c>Frase</c>):
/// <list type="bullet">
///   <item>Liste per-generatore → i campi <c>Tag</c> del generatore stesso o del suo master
///         (per composizione, es. l'Incel che riusa i simboli del Mbeb). Si auto-documentano lì.</item>
///   <item>Liste condivise → i token tipizzati degli static qui sotto (<see cref="Social"/>, <see cref="City"/>,
///         <see cref="Nome"/>, <see cref="Cognome"/>, <see cref="Professioni"/>, <see cref="Parente"/>):
///         es. <c>new($"...{Social.Any}...")</c>.</item>
///   <item>Fasce d'età → le costanti di <see cref="Eta"/> (<c>Eta.Minorenne</c> … <c>Eta.Anziano</c>),
///         risolte in un numero entro il range della fascia.</item>
///   <item>Range numerico → il range literal: <c>{2..5}</c> estrae un intero tra 2 e 5, estremi compresi.</item>
///   <item>Variabile condivisa → <c>{X.Fissato}</c> / <c>{Eta.X.Fissata}</c>: pesca una volta e riusa
///         lo stesso valore in tutta la composizione. In un GRUPPO ESCLUSIVO permette di RIBADIRE
///         l'attributo in più frasi (stesso valore garantito) invece di escluderle: "fa l'idraulico…"
///         e "…da idraulico" convivono, una seconda professione o un'altra età no.</item>
///   <item>Innesto → la generazione di un ALTRO generatore: <c>{Genera("locali")}</c> esegue il
///         generatore dei bar e ne incolla il testo (vedi <see cref="Innesto"/>).</item>
/// </list>
/// Qualunque altra cosa interpolata NON COMPILA (il <c>FraseBuilder</c> accetta solo i tipi qui sopra):
/// il linter dei segnaposto è il compilatore. Al boot resta solo la validazione di catena (una lista
/// referenziata ma non presente nella fusione, un ciclo tra liste → <c>GeneratorConfigException</c>).
/// </remarks>
public static class SharedContent
{
    // I tipi qui sotto (Tag, FasciaEta, FasciaParente, Gruppo, Etichetta — definiti in fondo al file)
    // sono il contratto: la CHIAVE è l'unica fonte e il token "[chiave]" si DERIVA, mai il contrario.

    /// <summary>
    /// La cultura italiana (it-IT) UNICA e condivisa da tutto il sottosistema dei generatori: ogni
    /// formattazione di date/ore la usa, così l'output è SEMPRE italiano corretto a prescindere dalla
    /// locale del server (un container non-IT non deve alterare mesi/cifre). <c>GetCultureInfo</c>
    /// restituisce già un'istanza cached: qui la si nomina una volta sola per non ripeterne il nome ovunque.
    /// </summary>
    public static readonly System.Globalization.CultureInfo CulturaIt =
        System.Globalization.CultureInfo.GetCultureInfo("it-IT");

    // ── Contenuti condivisi tipizzati ─────────────────────────────────────────────────────────────
    // Ogni concetto è uno static autosufficiente: il Tag scrive il segnaposto (via interpolazione,
    // es. $"...{Social.Any}...") e POSSIEDE le proprie voci nelle graffe. Tag, chiave e contenuto
    // vivono nello stesso posto e non possono divergere: un refuso lo becca il compilatore.
    // Gli assemblaggi per il motore vivono in una classe file-scoped dentro RuntimeBuilder.cs: privati.

    /// <summary>Social network esistenti: brand reali, non coniabile (il conio riguarda solo nomi e cognomi).</summary>
    internal static class Social
    {
        public static readonly Tag Any = new("social")
        {
            "Instagram",
            "TikTok",
            "Facebook",
            "Twitter (o X)",
            "LinkedIn",
            "YouTube",
            "WhatsApp",
            "Telegram",
            "Snapchat",
            "Reddit",
            "Twitch",
            "Pinterest",
        };
    }

    /// <summary>Città e paesi italiani reali: toponimi veri, non coniabile (il conio riguarda solo nomi e cognomi).</summary>
    internal static class City
    {
        public static readonly Tag Any = new("city")
        {
            "Ascoli Piceno",
            "Assisi",
            "Asti",
            "Benevento",
            "Bergamo",
            "Brescia",
            "Brindisi",
            "Cosenza",
            "Cremona",
            "Cuneo",
            "Enna",
            "Fermo",
            "Ferrara",
            "Gubbio",
            "Lecce",
            "Lucca",
            "L’Aquila",
            "Macerata",
            "Mantova",
            "Matera",
            "Modena",
            "Orvieto",
            "Otranto",
            "Padova",
            "Parma",
            "Perugia",
            "Piacenza",
            "Potenza",
            "Ragusa",
            "Ravenna",
            "Rieti",
            "Salerno",
            "Siena",
            "Siracusa",
            "Spoleto",
            "Teramo",
            "Trapani",
            "Treviso",
            "Urbino",
            "Viterbo",
            "Acireale",
            "Adrano",
            "Agrigento",
            "Albenga",
            "Alcamo",
            "Alessandria",
            "Altamura",
            "Ancona",
            "Andria",
            "Anzio",
            "Aosta",
            "Aprilia",
            "Arezzo",
            "Arzignano",
            "Aversa",
            "Avellino",
            "Avezzano",
            "Bagheria",
            "Barletta",
            "Belluno",
            "Biella",
            "Bisceglie",
            "Bitonto",
            "Bolzano",
            "Bordighera",
            "Bronte",
            "Busto",
            "Caltagirone",
            "Caltanissetta",
            "Camogli",
            "Campobasso",
            "Canicattì",
            "Capua",
            "Carbonia",
            "Carmagnola",
            "Carpi",
            "Carrara",
            "Casarano",
            "Caserta",
            "Cassino",
            "Catania",
            "Catanzaro",
            "Cattolica",
            "Cefalù",
            "Cento",
            "Cerignola",
            "Cervia",
            "Cesena",
            "Cesenatico",
            "Chiavari",
            "Chieri",
            "Chieti",
            "Chioggia",
            "Chivasso",
            "Civitavecchia",
            "Collegno",
            "Comacchio",
            "Como",
            "Conegliano",
            "Corato",
            "Cordenons",
            "Correggio",
            "Cortona",
            "Crema",
            "Crotone",
            "Desenzano",
            "Eboli",
            "Empoli",
            "Erice",
            "Fabriano",
            "Faenza",
            "Fano",
            "Fasano",
            "Feltre",
            "Fidenza",
            "Foggia",
            "Foligno",
            "Follonica",
            "Forlì",
            "Formia",
            "Fossano",
            "Frosinone",
            "Gaeta",
            "Galatina",
            "Gallarate",
            "Gallipoli",
            "Gela",
            "Giarre",
            "Ginosa",
            "Giulianova",
            "Gorizia",
            "Grosseto",
            "Grottaglie",
            "Guidonia",
            "Iglesias",
            "Imola",
            "Imperia",
            "Iseo",
            "Isernia",
            "Ivrea",
            "Jesi",
            "Ladispoli",
            "Lanciano",
            "Latina",
            "Lavagna",
            "Lentini",
            "Licata",
            "Loano",
            "Lucera",
            "Lugo",
            "Macomer",
            "Maddaloni",
            "Magenta",
            "Manduria",
            "Manfredonia",
            "Marsala",
            "Massa",
            "Melfi",
            "Mesagne",
            "Milazzo",
            "Mirandola",
            "Modica",
            "Modugno",
            "Moncalieri",
            "Mondovì",
            "Monopoli",
            "Monreale",
            "Montesilvano",
            "Monza",
            "Mottola",
            "Nardò",
            "Nichelino",
            "Nocera",
            "Nola",
            "Noto",
            "Novara",
            "Nuoro",
            "Olbia",
            "Oristano",
            "Ostuni",
            "Ozieri",
            "Palmi",
            "Paola",
            "Partinico",
            "Patti",
            "Pavia",
            "Penne",
            "Pesaro",
            "Pescara",
            "Pianoro",
            "Pietrasanta",
            "Pinerolo",
            "Piombino",
            "Pisa",
            "Pistoia",
            "Poggibonsi",
            "Pomezia",
            "Pomigliano",
            "Pordenone",
            "Portici",
            "Pozzuoli",
            "Prato",
            "Rapallo",
            "Recanati",
            "Rho",
            "Rimini",
            "Rivoli",
            "Rossano",
            "Rovereto",
            "Rovigo",
            "Sabaudia",
            "Sacile",
            "Saluzzo",
            "Sanremo",
            "Saronno",
            "Sassari",
            "Sassuolo",
            "Savona",
            "Scafati",
            "Sciacca",
            "Scordia",
            "Seregno",
            "Siderno",
            "Sondrio",
            "Soverato",
            "Sora",
            "Squinzano",
            "Sulmona",
            "Taranto",
            "Termoli",
            "Terni",
            "Terracina",
            "Thiene",
            "Tivoli",
            "Todi",
            "Tortona",
            "Trani",
            "Trento",
            "Treviglio",
            "Tricase",
            "Trieste",
            "Udine",
            "Varese",
            "Vasto",
            "Velletri",
            "Venosa",
            "Vercelli",
            "Verona",
            "Veroli",
            "Viareggio",
            "Vicenza",
            "Vigevano",
            "Vignola",
            "Vimercate",
            "Voghera",
            "Volterra",
            "Occhiobello",
            "Golasecca",
            "Bastardo",
            "Belsedere",
            "Paperino",
            "Strangolagalli",
            "Buonvicino",
            "Lunamatrona",
            "Cocconato",
            "Trepalle",
            "Malcontenta",
            "Rottofreno",
            "Acqualagna",
            "Schifanoia",
            "Bomba",
            "Gorgoglione",
            "Filadelfia",
            "Portocannone",
            "Sorso",
            "Gnocca",
            "Sesso",
            "Altolà",
            "Femminamorta",
            "Campodimele",
            "Purgatorio",
            "Fiumelatte",
            "Pisciotta",
            "Pofi",
            "Ficarra",
            "Ficulle",
            "Roghudi",
            "Vò",
            "Ne",
            "Re",
        };
    }

    /// <summary>Nomi propri italiani per genere; <see cref="Any"/> è la composta di entrambi (ComposedLists). Coniabili.</summary>
    internal static class Nome
    {
        public static readonly Tag M = new("nome-m")
        {
            "Adolfo",
            "Agostino",
            "Albino",
            "Aldo",
            "Alfredo",
            "Alvaro",
            "Amedeo",
            "Andrea",
            "Anselmo",
            "Arnaldo",
            "Arturo",
            "Attilio",
            "Bachisio",
            "Basilio",
            "Benito",
            "Bernardo",
            "Biagio",
            "Bonifacio",
            "Bruno",
            "Camillo",
            "Cesare",
            "Ciro",
            "Costantino",
            "Dalmazio",
            "Danilo",
            "Efisio",
            "Egidio",
            "Elio",
            "Ennio",
            "Erminio",
            "Ettore",
            "Eugenio",
            "Eusebio",
            "Fausto",
            "Ferdinando",
            "Franco",
            "Gastone",
            "Gavino",
            "Gennaro",
            "Gervasio",
            "Gianfranco",
            "Giannantonio",
            "Gianni",
            "Gino",
            "Guglielmo",
            "Ido",
            "Ignazio",
            "Innocenzo",
            "Ivano",
            "Lamberto",
            "Leopoldo",
            "Luigi",
            "Mario",
            "Nestore",
            "Onofrio",
            "Orlando",
            "Ottavio",
            "Pasquale",
            "Pietro",
            "Pino",
            "Pio",
            "Raimondo",
            "Rodolfo",
            "Romolo",
            "Sandro",
            "Serafino",
            "Silvio",
            "Tullio",
            "Ugo",
            "Abbondio",
            "Achille",
            "Adelmo",
            "Adriano",
            "Agapito",
            "Alarico",
            "Alberico",
            "Alberto",
            "Aldobrando",
            "Almerindo",
            "Amato",
            "Ambrogio",
            "Amerigo",
            "Amilcare",
            "Anacleto",
            "Annibale",
            "Antimo",
            "Apollinare",
            "Aristide",
            "Armando",
            "Arnolfo",
            "Ascanio",
            "Audace",
            "Augusto",
            "Aureliano",
            "Averardo",
            "Baldassarre",
            "Bartolomeo",
            "Bassiano",
            "Beniamino",
            "Berardo",
            "Bonaventura",
            "Brizio",
            "Calogero",
            "Carmine",
            "Casimiro",
            "Cataldo",
            "Celestino",
            "Cipriano",
            "Cirino",
            "Claudio",
            "Clemente",
            "Corrado",
            "Cosimo",
            "Crescenzo",
            "Damiano",
            "Dario",
            "Demetrio",
            "Desiderio",
            "Diego",
            "Diomede",
            "Dionigi",
            "Domenico",
            "Donato",
            "Edmondo",
            "Elia",
            "Eligio",
            "Emidio",
            "Emiliano",
            "Epifanio",
            "Ermanno",
            "Ermenegildo",
            "Ernesto",
            "Eufemio",
            "Evaristo",
            "Ezio",
            "Fabiano",
            "Fabrizio",
            "Federico",
            "Felice",
            "Fiorenzo",
            "Firmino",
            "Flaviano",
            "Folco",
            "Fortunato",
            "Fulgenzio",
            "Furio",
            "Gabriele",
            "Gaetano",
            "Galdino",
            "Gaspare",
            "Generoso",
            "Geremia",
            "Gerlando",
            "Germano",
            "Gioacchino",
            "Giordano",
            "Giosuè",
            "Girolamo",
            "Goffredo",
            "Gualtiero",
            "Guido",
            "Iacopo",
            "Igino",
            "Ilario",
            "Ippolito",
            "Ireneo",
            "Isidoro",
            "Ladislao",
            "Lazzaro",
            "Leandro",
            "Liborio",
            "Lino",
            "Lorenzo",
            "Lucio",
            "Ludovico",
            "Marcello",
            "Mariano",
            "Marino",
            "Massimo",
            "Maurilio",
            "Melchiorre",
            "Narciso",
            "Natale",
            "Nazzareno",
            "Nicodemo",
            "Norberto",
            "Oddone",
            "Olindo",
            "Oliviero",
            "Orazio",
            "Oreste",
            "Orfeo",
            "Osvaldo",
            "Ottaviano",
            "Ottone",
            "Pacifico",
            "Palmiro",
            "Pancrazio",
            "Paride",
            "Patrizio",
            "Pellegrino",
            "Placido",
            "Pompeo",
            "Primo",
            "Prospero",
            "Quirino",
            "Raffaele",
            "Reginaldo",
            "Remigio",
            "Renato",
            "Rinaldo",
            "Rocco",
            "Rolando",
            "Romeo",
            "Romualdo",
            "Rosario",
            "Ruggero",
            "Sabino",
            "Salvatore",
            "Sante",
            "Saturnino",
            "Saverio",
            "Sebastiano",
            "Secondo",
            "Settimio",
            "Severino",
            "Sigismondo",
            "Silvano",
            "Silvestro",
            "Sinibaldo",
            "Spartaco",
            "Stanislao",
            "Tancredi",
            "Tarcisio",
            "Teobaldo",
            "Teodoro",
            "Terenzio",
            "Tiburzio",
            "Tito",
            "Torquato",
            "Ubaldo",
            "Uberto",
            "Ulisse",
            "Umberto",
            "Urbano",
            "Valentino",
            "Valerio",
            "Venanzio",
            "Vincenzo",
            "Virgilio",
            "Vitale",
            "Vittorio",
            "Zaccaria",
            "Zeno",
            "Zenone",
        };

        public static readonly Tag F = new("nome-f")
        {
            "Ada",
            "Adele",
            "Amalia",
            "Angela",
            "Antonietta",
            "Assunta",
            "Aurora",
            "Beatrice",
            "Carla",
            "Carmela",
            "Caterina",
            "Clara",
            "Concetta",
            "Deborah",
            "Dorotea",
            "Elena",
            "Elisa",
            "Emilia",
            "Eva",
            "Flora",
            "Francesca",
            "Gemma",
            "Genoveffa",
            "Giovanna",
            "Giulia",
            "Irene",
            "Isabella",
            "Lia",
            "Lucia",
            "Luisa",
            "Margherita",
            "Marisa",
            "Mariuccia",
            "Matilde",
            "Natalia",
            "Olga",
            "Paola",
            "Rosa",
            "Sara",
            "Teresa",
            "Valentina",
            "Vera",
            "Vilma",
            "Vittoria",
            "Zita",
            "Adalgisa",
            "Addolorata",
            "Agata",
            "Agnese",
            "Albina",
            "Alfonsina",
            "Allegra",
            "Almerinda",
            "Amelia",
            "Anastasia",
            "Annunziata",
            "Apollonia",
            "Arianna",
            "Armida",
            "Artemisia",
            "Assuntina",
            "Augusta",
            "Bambina",
            "Bernarda",
            "Bianca",
            "Brunilde",
            "Calogera",
            "Camilla",
            "Candida",
            "Carolina",
            "Cecilia",
            "Celeste",
            "Cesira",
            "Cinzia",
            "Clelia",
            "Cleofe",
            "Cleopatra",
            "Clotilde",
            "Colomba",
            "Concettina",
            "Cornelia",
            "Cosima",
            "Costanza",
            "Cristina",
            "Cunegonda",
            "Diamante",
            "Diletta",
            "Dirce",
            "Domenica",
            "Donata",
            "Egle",
            "Elda",
            "Elettra",
            "Eleonora",
            "Eloisa",
            "Elsa",
            "Emerenziana",
            "Enrica",
            "Ermelinda",
            "Ersilia",
            "Esmeralda",
            "Eufemia",
            "Eugenia",
            "Eulalia",
            "Eusebia",
            "Evelina",
            "Fausta",
            "Fedora",
            "Felicita",
            "Filomena",
            "Fiorella",
            "Fiorenza",
            "Flaminia",
            "Flavia",
            "Fortunata",
            "Fosca",
            "Franca",
            "Frida",
            "Gaetana",
            "Gelsomina",
            "Geltrude",
            "Gilda",
            "Ginevra",
            "Gioconda",
            "Giuditta",
            "Greca",
            "Guendalina",
            "Ida",
            "Ifigenia",
            "Ilaria",
            "Immacolata",
            "Incoronata",
            "Iolanda",
            "Ippolita",
            "Iride",
            "Iris",
            "Isolina",
            "Italia",
            "Ivana",
            "Lavinia",
            "Leda",
            "Leonilde",
            "Letizia",
            "Liana",
            "Liberata",
            "Licia",
            "Lidia",
            "Loredana",
            "Loreta",
            "Luigina",
            "Maddalena",
            "Mafalda",
            "Marcella",
            "Mariangela",
            "Marina",
            "Massimina",
            "Melania",
            "Mercede",
            "Milena",
            "Mirella",
            "Modesta",
            "Morena",
            "Nadia",
            "Natalina",
            "Nerina",
            "Nicoletta",
            "Ninfa",
            "Norma",
            "Nunziata",
            "Oliva",
            "Ondina",
            "Orsola",
            "Ortensia",
            "Ottavia",
            "Palma",
            "Palmira",
            "Pasqualina",
            "Penelope",
            "Petronilla",
            "Pierina",
            "Placida",
            "Prisca",
            "Quintina",
            "Rachele",
            "Raffaella",
            "Raimonda",
            "Regina",
            "Renata",
            "Rita",
            "Romana",
            "Romilda",
            "Rosalba",
            "Rosalia",
            "Rosaria",
            "Rosita",
            "Rosmunda",
            "Sabina",
            "Samuela",
            "Saveria",
            "Scolastica",
            "Sebastiana",
            "Selvaggia",
            "Serafina",
            "Severina",
            "Sibilla",
            "Silvana",
            "Smeralda",
            "Sofia",
            "Speranza",
            "Stefania",
            "Tarsilla",
            "Tecla",
            "Teodora",
            "Tina",
            "Tosca",
            "Tullia",
            "Velia",
            "Venere",
            "Veronica",
            "Vincenza",
            "Viola",
            "Violante",
            "Virginia",
            "Viviana",
            "Wanda",
            "Zaira",
            "Zelinda",
            "Zoe",
        };

        /// <summary>Composta di entrambi i generi: unione tipizzata di <see cref="M"/> e <see cref="F"/>.</summary>
        public static readonly Tag Any = Tag.Unione("nome", M, F);
    }

    /// <summary>Cognomi italiani. Coniabili.</summary>
    internal static class Cognome
    {
        public static readonly Tag Any = new("cognome")
        {
            "Barbieri",
            "Bianchi",
            "Caruso",
            "Colombo",
            "Conti",
            "De Angelis",
            "De Luca",
            "Esposito",
            "Ferrara",
            "Ferrari",
            "Ferri",
            "Gallo",
            "Greco",
            "Leone",
            "Lombardi",
            "Mancini",
            "Marchetti",
            "Mariani",
            "Marini",
            "Martini",
            "Messina",
            "Moretti",
            "Palmieri",
            "Pellegrino",
            "Ricci",
            "Rinaldi",
            "Rizzo",
            "Romano",
            "Rossetti",
            "Rossi",
            "Russo",
            "Santoro",
            "Sartori",
            "Serra",
            "Abate",
            "Aiello",
            "Albano",
            "Alfonsi",
            "Amato",
            "Amico",
            "Angelini",
            "Antonelli",
            "Bagnoli",
            "Baldini",
            "Barbato",
            "Barone",
            "Basile",
            "Battaglia",
            "Bellini",
            "Belotti",
            "Benedetti",
            "Bernardi",
            "Berti",
            "Biagi",
            "Bonfanti",
            "Borghi",
            "Bottini",
            "Buonomo",
            "Caiazzo",
            "Calabrese",
            "Caligiuri",
            "Cammarata",
            "Campana",
            "Cannavaro",
            "Cantoni",
            "Capone",
            "Cappelli",
            "Caputo",
            "Carbone",
            "Cardillo",
            "Casadei",
            "Cattaneo",
            "Cavallaro",
            "Cerullo",
            "Chiappa",
            "Ciampi",
            "Coppola",
            "Corsi",
            "Cosentino",
            "Costa",
            "Costantini",
            "Crippa",
            "Cucinotta",
            "Damiani",
            "Donati",
            "Drago",
            "Fabbri",
            "Falcone",
            "Farina",
            "Fava",
            "Ferraro",
            "Festa",
            "Fiore",
            "Fontana",
            "Fortunato",
            "Franchi",
            "Fumagalli",
            "Gabrielli",
            "Galante",
            "Galli",
            "Gargano",
            "Gatti",
            "Genovese",
            "Gentile",
            "Giannini",
            "Giordano",
            "Giuliani",
            "Grasso",
            "Grimaldi",
            "Guarino",
            "Guerra",
            "Iacono",
            "Iannucci",
            "Izzo",
            "Lanza",
            "Lazzari",
            "Leoni",
            "Liberti",
            "Locatelli",
            "Longo",
            "Lupo",
            "Maggio",
            "Magnani",
            "Mainardi",
            "Manzo",
            "Marotta",
            "Masi",
            "Mattei",
            "Mazza",
            "Mele",
            "Meloni",
            "Merlo",
            "Milani",
            "Montanari",
            "Monti",
            "Morelli",
            "Mosca",
            "Napolitano",
            "Negri",
            "Nigro",
            "Orlando",
            "Pace",
            "Pagano",
            "Palumbo",
            "Panzera",
            "Parisi",
            "Pascale",
            "Pellegrini",
            "Perrone",
            "Petrucci",
            "Piazza",
            "Pinto",
            "Pisani",
            "Pittaluga",
            "Poggi",
            "Polidoro",
            "Preziosi",
            "Proietti",
            "Quaranta",
            "Raimondi",
            "Rana",
            "Riva",
            "Rizzi",
            "Ronchi",
            "Rotunno",
            "Ruggiero",
            "Sabatini",
            "Sala",
            "Sanna",
            "Savino",
            "Scala",
            "Schiavone",
            "Sgarbi",
            "Simeoni",
            "Sorrentino",
            "Spada",
            "Spinelli",
            "Stella",
            "Tarantino",
            "Testa",
            "Toscano",
            "Tucci",
            "Vacca",
            "Valente",
            "Vassallo",
            "Ventura",
            "Vigna",
            "Villa",
            "Vinci",
            "Violante",
            "Vitale",
            "Zanetti",
            "Zappia",
            "Zito",
        };
    }

    /// <summary>
    /// Professioni comuni dell'italiano medio: il ritratto anagrafico buono per qualunque persona
    /// generata. Un generatore può ESTENDERLA con voci di colore registrando la propria lista sotto
    /// la stessa chiave (l'Incel aggiunge la vena cripto): il RuntimeBuilder concatena per chiave.
    /// Nel gruppo <c>identita</c> (PolicyGroups) insieme alle età: una sola definizione del soggetto.
    /// Non coniabili (il conio riguarda solo nomi e cognomi): le professioni restano reali.
    /// </summary>
    internal static class Professioni
    {
        /// <summary>Mestieri EPICENI (stessa forma nei due generi: "un/una barista"): definiti UNA volta
        /// e spinti DENTRO sia <see cref="M"/> sia <see cref="F"/> — l'inverso di Any (invece di fondere
        /// M+F verso l'alto, cala le neutre giù in entrambi). Include la ristorazione epicene e vari
        /// mestieri gender-neutral (anche "maschili" tipo elettricista → così una donna può farlo).</summary>
        public static readonly Tag Neutre = new("professioni-neutre")
        {
            ("barista", 2), ("musicista", 2), ("receptionist", 2), ("tassista", 2),
            ("personal trainer", 2), ("geometra", 2), ("rappresentante", 2),
            ("agente immobiliare", 2), ("nutrizionista", 2), ("giornalista", 2),
            ("commercialista", 2), ("farmacista", 2), ("fisioterapista", 3),
            ("dietista", 3), ("consulente", 2), ("dentista", 2), ("elettricista", 2),
            ("insegnante di sostegno", 3), ("dog-sitter", 3), ("baby-sitter", 2),
            ("influencer", 2), ("custode", 2),
        };

        /// <summary>Mestieri al solo MASCHILE (forme -o/-e). Mix bilanciato: colletti bianchi + manuale/
        /// precario (serve alla satira del "basico"). Ristorazione al maschile. Building block: le frasi
        /// usano <see cref="M"/> (che aggiunge le <see cref="Neutre"/>).</summary>
        public static readonly Tag SoloM = new("professioni-m-solo")
        {
            ("avvocato", 2), ("ingegnere", 2), ("architetto", 2), ("dottore", 2),
            ("professore", 2), ("ragioniere", 2), ("imprenditore", 2),
            ("impiegato statale", 2), ("poliziotto", 2), ("agricoltore", 2),
            ("idraulico", 2), ("meccanico", 2), ("muratore", 2), ("magazziniere", 2),
            ("autista di Uber", 3), ("addetto alle consegne", 3), ("operatore di call center", 3),
            ("tecnico informatico", 2), ("pensionato", 2), ("disoccupato", 2),
            ("studente universitario", 2), ("studente di medicina", 3), ("neo-diplomato", 2),
            // ristorazione (M) — le neutre/femminili hanno le controparti
            ("cameriere", 2), ("cuoco", 2), ("pizzaiolo", 2), ("pasticcere", 2),
        };

        /// <summary>Mestieri al solo FEMMINILE: stereotipati ma DIGNITOSI + non-stereotipici (ingegnera,
        /// architetta…) per non incasellare. Niente voci oggettificanti/sessualizzate. Ristorazione al
        /// femminile. Building block: le frasi usano <see cref="F"/> (che aggiunge le <see cref="Neutre"/>).</summary>
        public static readonly Tag SoloF = new("professioni-f-solo")
        {
            ("ingegnera", 2), ("architetta", 2), ("avvocata", 2), ("dottoressa", 2),
            ("professoressa", 2), ("ragioniera", 2), ("imprenditrice", 2),
            ("impiegata statale", 2), ("poliziotta", 2), ("agricoltrice", 2),
            ("infermiera", 2), ("ostetrica", 3), ("psicologa", 2), ("veterinaria", 2),
            ("estetista", 2), ("parrucchiera", 2), ("maestra d'asilo", 3), ("maestra elementare", 3),
            ("commessa", 2), ("sarta", 2), ("fioraia", 2), ("bibliotecaria", 2), ("traduttrice", 2),
            ("istruttrice di pilates", 3), ("insegnante di yoga", 3),
            ("studentessa universitaria", 2), ("neolaureata", 3),
            // ristorazione (F)
            ("cameriera", 2), ("cuoca", 2), ("pizzaiola", 2), ("pasticcera", 2),
        };

        /// <summary>Maschile completo (= <see cref="SoloM"/> + <see cref="Neutre"/>): il tag da usare nelle frasi con soggetto uomo.</summary>
        public static readonly Tag M = Tag.Unione("professioni-m", SoloM, Neutre);
        /// <summary>Femminile completo (= <see cref="SoloF"/> + <see cref="Neutre"/>): il tag da usare con soggetto donna.</summary>
        public static readonly Tag F = Tag.Unione("professioni-f", SoloF, Neutre);
        /// <summary>Entrambi i generi: <see cref="SoloM"/> + <see cref="SoloF"/> + <see cref="Neutre"/>
        /// (composta da liste OWNING, non da M/F, così niente unione-di-unioni). Solo dove il genere non è fissato.</summary>
        public static readonly Tag Any = Tag.Unione("professioni", SoloM, SoloF, Neutre);
    }

    /// <summary>
    /// Piatti tipici italiani, divisi per genere per la concordanza (come Nome/Parente). Solo
    /// maschili che prendono "il/un" e femminili singolari che prendono "la/una": niente elisioni
    /// (l'arrosto, l'amatriciana) né plurali, così ogni incastro ("il {M} perfetto", "una bella {F}")
    /// concorda sempre. Non coniabili: i piatti restano reali.
    /// </summary>
    internal static class Piatti
    {
        public static readonly Tag M = new("piatto-m")
        {
            "ragù", "tagliere di salumi", "brasato", "bollito misto",
            "risotto", "minestrone", "baccalà", "cotechino",
            "timballo", "vitello tonnato",
        };

        public static readonly Tag F = new("piatto-f")
        {
            "carbonara", "fiorentina", "gricia", "cotoletta alla milanese",
            "grigliata", "pizza verace", "parmigiana", "tagliata",
            "focaccia", "polenta", "caprese",
        };

        /// <summary>Composta di entrambi i generi: unione tipizzata di <see cref="M"/> e <see cref="F"/>.</summary>
        public static readonly Tag Any = Tag.Unione("piatto", M, F);
    }

    /// <summary>Piattaforme dove si comprano cinesate online. Brand reali, non coniabili.</summary>
    internal static class Marketplace
    {
        public static readonly Tag Any = new("marketplace")
        {
            "Amazon", "Wish", "AliExpress", "Temu", "eBay", "Subito", "Wallapop",
            "Shein", "Vinted", "Alibaba", "Etsy",
        };
    }

    /// <summary>
    /// I sette giorni della settimana, presi dal FRAMEWORK (cultura it-IT): zero voci a mano, e il
    /// nome è sempre giusto. Attenzione al genere ("la domenica"): negli incastri usare forme neutre
    /// tipo <c>"solo di {Giorni.Any}"</c>, che concordano con tutti.
    /// </summary>
    internal static class Giorni
    {
        public static readonly Tag Any = CostruisciGiorni();

        private static Tag CostruisciGiorni()
        {
            var giorni = new Tag("giorno");
            foreach (var nome in CulturaIt.DateTimeFormat.DayNames)
                giorni.Add(nome);
            return giorni;
        }
    }

    /// <summary>
    /// Contenuti CALCOLATI al momento della generazione, non fissabili al boot (il Runtime è compilato
    /// una volta sola). A differenza delle liste — curate o derivate dal framework ma comunque FISSE —
    /// questi valori cambiano nel tempo: oggi solo la <see cref="DataOggi"/>. Il motore li pre-appunta
    /// come seed condiviso (<see cref="Seed"/>) a OGNI generazione, così qualunque generatore può usare
    /// <c>{DataOggi.Any.Fissato}</c> e ottenere il valore del momento senza calcolarlo.
    /// </summary>
    internal static class Dinamici
    {
        /// <summary>
        /// La data di OGGI in formato lungo it-IT (es. "12 settembre 2026"): variabile condivisa (token
        /// <c>[$data-oggi]</c>). Il valore reale lo inietta il motore da <see cref="Seed"/> a ogni
        /// generazione; la voce qui è solo fallback e validazione al boot (il token dev'esistere nella
        /// fusione delle liste, come ogni altro segnaposto).
        /// </summary>
        internal static class DataOggi
        {
            public static readonly Tag Any = new("data-oggi") { "di oggi" };

            /// <summary>La data di oggi, calcolata al momento della generazione (cultura it-IT esplicita,
            /// così il mese è quello giusto a prescindere dalla locale del server).</summary>
            public static string Valore() =>
                DateTime.Now.ToString("d MMMM yyyy", CulturaIt);
        }

            /// <summary>
        /// I valori calcolati a OGNI generazione (chiave del tag → produttore): il motore li pre-appunta
        /// come seed condivisi prima di comporre, così i relativi <c>[$chiave]</c> escono col valore del
        /// momento in qualunque generatore. È il gancio per aggiungerne altri (ora solo la data di oggi).
        /// </summary>
        internal static IReadOnlyDictionary<string, Func<string>> Seed { get; } =
            new Dictionary<string, Func<string>>
            {
                [DataOggi.Any.Key] = DataOggi.Valore,
            };
    }

    /// <summary>Fascia oraria interpolabile: genera un orario "HH:mm di &lt;fascia&gt;" (es. "03:47 di notte").
    /// Usa così nei generatori: <c>{TimeSlot.Mattina}</c>. <see cref="Locuzione"/> è la parola detta accanto
    /// all'orario. Le fasce PRINCIPALI coprono l'INTERA giornata senza buchi, alla convenzione italiana:
    /// notte 1-4, mattina 5-12, pomeriggio 13-18, sera 19→1 (19:00 fino a mezzanotte inclusa, 00:xx —
    /// l'ora 24 fa il giro di boa a 00 via modulo nel motore). <see cref="Serata"/> è una fascia AGGIUNTIVA
    /// che si sovrappone (aperitivo/dopocena, 17-21): essendo una forzatura nostra, la sua locuzione è "sera".</summary>
    /// <param name="Nome">Nome della fascia (identità del token <c>[time-nome]</c>).</param>
    /// <param name="OraMin">Ora minima inclusa.</param>
    /// <param name="OraMax">Ora massima inclusa (24 = mezzanotte, resa 00 col modulo).</param>
    /// <param name="Locuzione">La parola detta accanto all'orario ("03:47 di {Locuzione}").</param>
    public sealed record TimeSlot(string Nome, int OraMin, int OraMax, string Locuzione)
    {
        /// <summary>Notte: 1-4 → "di notte".</summary>
        public static readonly TimeSlot Notte = new("notte", 1, 4, "notte");
        /// <summary>Mattina: 5-12 → "di mattina".</summary>
        public static readonly TimeSlot Mattina = new("mattina", 5, 12, "mattina");
        /// <summary>Pomeriggio: 13-18 → "di pomeriggio".</summary>
        public static readonly TimeSlot Pomeriggio = new("pomeriggio", 13, 18, "pomeriggio");
        /// <summary>Sera: 19→1 (19:00-00:59) → "di sera". OraMax=24 → mezzanotte (00) col modulo nel motore.</summary>
        public static readonly TimeSlot Sera = new("sera", 19, 24, "sera");
        /// <summary>Serata (aperitivo/dopocena): 17-21, si sovrappone a pomeriggio/sera. Forzatura nostra → locuzione "sera".</summary>
        public static readonly TimeSlot Serata = new("serata", 17, 21, "sera");

        /// <summary>Token per il <c>Raw</c> (identità della frase); l'orario vero lo genera il motore.</summary>
        public override string ToString() => $"[time-{Nome}]";
    }

    /// <summary>
    /// Intervallo di date interpolabile in una frase: <c>{new DateRangeSlot(new(2026, 6, 1), new(2026, 8, 31))}</c>.
    /// I due filtri sono OPT-IN e indipendenti: <see cref="SoloFeriali"/> scarta sab/dom, <see cref="SaltaFestivi"/>
    /// scarta i festivi nazionali FISSI (non le mobili come Pasquetta, fuori scope). Per periodi comodi ci sono le
    /// preset <see cref="Estate"/>/<see cref="Feste"/>. Il motore rende il testo con <see cref="Formatta"/>.
    /// <para>AUTHORING: per un range <see cref="Formatta"/> emette GIÀ la clausola completa ("dal 1° giugno
    /// al 31 agosto", o "da lunedì … a domenica …" con <see cref="ConGiornoSettimana"/>): nel template NON
    /// premettere "dal"/"durante" o esce doppio. Scrivi "l'ha lasciato {range}".</para>
    /// <para>Il GIORNO DELLA SETTIMANA è opt-in (<see cref="ConGiornoSettimana"/>): utile per un evento
    /// SPECIFICO e datato, ma fuorviante per periodi ricorrenti (le "feste" cadono in giorni diversi ogni
    /// anno) → di default è spento.</para>
    /// </summary>
    /// <param name="Start">Primo giorno dell'intervallo (incluso).</param>
    /// <param name="End">Ultimo giorno dell'intervallo (incluso).</param>
    /// <param name="SoloFeriali">Se true, scarta sabato e domenica.</param>
    /// <param name="SaltaFestivi">Se true, scarta i festivi nazionali a data fissa.</param>
    /// <param name="ConGiornoSettimana">Se true, antepone il giorno della settimana ("lunedì 1° giugno")
    /// e usa il connettore "da … a …"; se false (default) resta "dal 1° giugno al 31 agosto".</param>
    public sealed record DateRangeSlot(DateTime Start, DateTime End,
        bool SoloFeriali = false, bool SaltaFestivi = false, bool ConGiornoSettimana = false)
    {
        // Festivi nazionali italiani a data FISSA (mese, giorno). Pasquetta è mobile → non inclusa.
        private static readonly HashSet<(int Mese, int Giorno)> FestiviFissi =
        [
            (1, 1),   // Capodanno
            (1, 6),   // Epifania
            (4, 25),  // Festa della Liberazione
            (5, 1),   // Festa del Lavoro
            (6, 2),   // Festa della Repubblica
            (8, 15),  // Ferragosto
            (11, 1),  // Ognissanti
            (12, 8),  // Immacolata Concezione
            (12, 25), // Natale
            (12, 26), // Santo Stefano
        ];

        /// <summary>Preset: l'estate dell'anno corrente (21 giugno – 22 settembre). Anno fissato al boot.</summary>
        public static DateRangeSlot Estate => new(new(DateTime.Now.Year, 6, 21), new(DateTime.Now.Year, 9, 22));
        /// <summary>Preset: le feste natalizie (24 dicembre – 6 gennaio dell'anno dopo). Anno fissato al boot.</summary>
        public static DateRangeSlot Feste => new(new(DateTime.Now.Year, 12, 24), new(DateTime.Now.Year + 1, 1, 6));
        /// <summary>Preset: i giorni LAVORATIVI dell'anno corrente (feriali, festivi esclusi).</summary>
        public static DateRangeSlot Lavorativi => new(new(DateTime.Now.Year, 1, 1), new(DateTime.Now.Year, 12, 31), SoloFeriali: true, SaltaFestivi: true);

        /// <summary>Token per il <c>Raw</c> (identità della frase); il testo vero lo produce <see cref="Formatta"/>.</summary>
        public override string ToString() => $"[date-{Start:yyyyMMdd}-{End:yyyyMMdd}{(SoloFeriali ? "-fe" : "")}{(SaltaFestivi ? "-nf" : "")}{(ConGiornoSettimana ? "-gg" : "")}]";

        /// <summary>Rende l'intervallo in italiano. Default: "dal 1° giugno al 31 agosto". Con
        /// <see cref="ConGiornoSettimana"/>: "da lunedì 1° giugno a domenica 22 settembre" — connettore
        /// "da … a …" senza articolo (regge anche il femminile "domenica", dove "al domenica" sarebbe errato).</summary>
        public string Formatta()
        {
            var giorni = GiorniValidi();
            return giorni.Count switch
            {
                0 => "in un periodo indefinito",
                1 => DataItaliana(giorni[0], ConGiornoSettimana),
                _ when ConGiornoSettimana => $"da {DataItaliana(giorni[0], true)} a {DataItaliana(giorni[^1], true)}",
                _ => $"dal {DataItaliana(giorni[0], false)} al {DataItaliana(giorni[^1], false)}",
            };
        }

        /// <summary>I giorni dell'intervallo (inclusi) dopo i filtri OPT-IN feriali/festivi.</summary>
        private List<DateTime> GiorniValidi()
        {
            var giorni = new List<DateTime>();
            for (var d = Start.Date; d <= End.Date; d = d.AddDays(1))
            {
                if (SaltaFestivi && FestiviFissi.Contains((d.Month, d.Day))) continue;
                if (SoloFeriali && d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;
                giorni.Add(d);
            }
            return giorni;
        }

        /// <summary>Data all'italiana: "1° giugno" o, con <paramref name="conGiorno"/>, "lunedì 1° giugno".
        /// Mese e giorno-settimana li dà la cultura (<c>MMMM</c>/<c>dddd</c>, già in italiano minuscolo);
        /// l'UNICA cosa che nessun format string produce è l'ordinale del primo ("1°") → a mano.</summary>
        private static string DataItaliana(DateTime data, bool conGiorno)
        {
            var mese = data.ToString("MMMM", CulturaIt);
            var giorno = data.Day == 1 ? "1°" : data.Day.ToString(CulturaIt);
            var testa = conGiorno ? $"{data.ToString("dddd", CulturaIt)} " : "";
            return $"{testa}{giorno} {mese}";
        }
    }

    /// <summary>
    /// Parenti, divisi per genere e per fascia generazionale (relativa a chi parla). Legami reali,
    /// non coniabili: il conio li renderebbe assurdi. Aggiungere una fascia =
    /// un campo + la voce in <see cref="Fasce"/>: registrazione e composte si derivano da lì.
    /// </summary>
    internal static class Parente
    {
        /// <summary>Generazione sotto (nipote, cuginetto…).</summary>
        public static readonly FasciaParente Giovane = new(
            new("parente-giovane-m") { "nipote", "nipotino", "cuginetto", "figlioccio", "figlio", "figliastro", "pronipote", "bisnipote", "genero", "nipotastro", "cuginetto piccolo", "figlio del cugino", "nipote acquisito", "figlio di primo letto", "erede designato" },
            new("parente-giovane-f") { "nipote", "nipotina", "cuginetta", "figlioccia", "figlia", "figliastra", "pronipote", "bisnipote", "nuora", "nipotastra", "cuginetta piccola", "figlia del cugino", "nipote acquisita", "figlia di primo letto", "erede designata" });
        /// <summary>Stessa generazione (cugino, fratello, cognato…).</summary>
        public static readonly FasciaParente Pari = new(
            new("parente-pari-m") { "cugino", "fratello", "cognato", "fratellastro", "gemello", "marito", new($"cugino di {2..5}° grado"), "cugino alla lontana", "consuocero", "cugino acquisito", "fratello di latte", "cognato del cognato", "cugino emigrato in Germania", "quasi-cognato", "cugino di campagna", "cognato juventino" },
            new("parente-pari-f") { "cugina", "sorella", "cognata", "sorellastra", "gemella", "moglie", new($"cugina di {2..5}° grado"), "cugina alla lontana", "consuocera", "cugina acquisita", "sorella di latte", "cognata della cognata", "cugina emigrata in Germania", "quasi-cognata", "cugina di campagna", "cognata juventina" });
        /// <summary>Generazione sopra (zio, suocero, nonno…).</summary>
        public static readonly FasciaParente Anziano = new(
            new("parente-anziano-m") { "zio", "suocero", "nonno", "prozio", "bisnonno", "trisnonno", "patrigno", "padrino", "nonnastro", "zio acquisito", "zio d'America", "prozio del Molise", "nonno materno", "suocero in pensione", "zio scapolo" },
            new("parente-anziano-f") { "zia", "suocera", "nonna", "prozia", "bisnonna", "trisnonna", "matrigna", "madrina", "nonnastra", "zia acquisita", "zia d'America", "prozia del Molise", "nonna materna", "suocera in pensione", "zia zitella" });
        /// <summary>Tutte le fasce: la fonte unica da cui si deriva il resto.</summary>
        public static readonly FasciaParente[] Fasce = [Giovane, Pari, Anziano];

        /// <summary>Composti: tutte le fasce di un genere, o entrambe — unioni tipizzate delle fasce.</summary>
        public static readonly Tag M = Tag.Unione("parente-m", Giovane.M, Pari.M, Anziano.M);
        public static readonly Tag F = Tag.Unione("parente-f", Giovane.F, Pari.F, Anziano.F);
        public static readonly Tag Any = Tag.Unione("parente", Giovane.M, Giovane.F, Pari.M, Pari.F, Anziano.M, Anziano.F);
    }

    /// <summary>
    /// Fasce d'età: nei template si interpola la fascia stessa (scrive <c>[eta-nome]</c>) e il parser
    /// la risolve in un numero pescato tra <c>Min</c> e <c>Max</c> — direttamente dagli interi, nessun
    /// range-stringa di mezzo. Aggiungere una fascia = un campo + la voce in <see cref="Tutte"/>:
    /// gruppo di policy e risoluzione (nel motore) si derivano da lì.
    /// </summary>
    internal static class Eta
    {
        public static readonly FasciaEta Minorenne = new("minorenne", 12, 17);
        public static readonly FasciaEta Giovane = new("giovane", 18, 26);
        public static readonly FasciaEta Cresciuto = new("cresciuto", 24, 44);
        public static readonly FasciaEta Adulto = new("adulto", 35, 65);
        public static readonly FasciaEta Anziano = new("anziano", 46, 86);
        /// <summary>Tutte le fasce: la fonte unica da cui si deriva il resto.</summary>
        public static readonly FasciaEta[] Tutte = [Minorenne, Giovane, Cresciuto, Adulto, Anziano];
    }

    /// <summary>
    /// Nomi tipizzati dei gruppi esclusivi CONDIVISI (le chiavi dei gruppi di policy del motore): nei
    /// generatori si scrive <c>ExclusiveGroups = [Gruppi.Identita, ...]</c>. I gruppi locali di un
    /// generatore (es. "frasi_tipiche") restano stringhe: lì il nome è la chiave della flatlist, e il
    /// RuntimeBuilder li valida al boot.
    /// </summary>
    internal static class Gruppi
    {
        public static readonly Gruppo Eta = new("eta");
        public static readonly Gruppo Identita = new("identita");
    }

    // Gli assemblaggi per il motore (liste condivise, gruppi, composte, fasce, chiavi coniabili) NON
    // stanno qui: vivono in una classe `file`-scoped dentro RuntimeBuilder.cs, invisibile per il
    // linguaggio a chiunque fuori da quel file. Un generatore vede solo gli static qui sopra.
}

/// <summary>
/// Segnaposto tipizzato: la CHIAVE è l'unica fonte e il token <c>[chiave]</c> da template si DERIVA
/// (<see cref="ToString"/>), mai il contrario. Un tag può POSSEDERE le proprie voci — le graffe del
/// collection initializer: <c>new("vibes") { ("stronzo", 2), ... }</c> — oppure essere un puro
/// RIFERIMENTO (nudo: gli alias verso il master, i condivisi citati nelle frasi). Il concetto di
/// "flatlist" come struttura a parte non esiste più: la lista È il tag che la possiede, e il
/// RuntimeBuilder scopre i tag con voci dai campi statici del generatore (vedi <c>GeneratorBase.Liste</c>) —
/// dichiarare il campo è dichiarare la lista.
/// </summary>
public sealed class Tag : System.Collections.Generic.IEnumerable<Frase>
{
    /// <summary>La chiave nuda (es. <c>"vibes"</c>): l'identità del segnaposto in tutto il motore.</summary>
    public string Key { get; }

    private List<Frase>? _voci;

    /// <summary>Tag nuovo: nudo è un riferimento, con le graffe possiede le voci.</summary>
    public Tag(string key) => Key = key;

    /// <summary>ESTENSIONE: stesso segnaposto di <paramref name="estende"/>, voci proprie (graffe).
    /// Il RuntimeBuilder fonde per chiave: le voci si AGGIUNGONO a quelle del tag esteso.</summary>
    public Tag(Tag estende) : this(estende.Key) { }

    /// <summary>Le voci possedute (vuoto per un tag puro riferimento).</summary>
    internal IReadOnlyList<Frase> Voci => _voci is null ? [] : _voci;

    /// <summary>Possiede voci? (= è una lista, non solo un riferimento).</summary>
    internal bool HaVoci => _voci is { Count: > 0 };

    /// <summary>Aggiunge una voce: è il metodo che le graffe del collection initializer chiamano.</summary>
    public void Add(Frase voce) => (_voci ??= []).Add(voce);

    private string[]? _componenti;

    /// <summary>Se è un tag-UNIONE, le chiavi dei sotto-tag di cui è l'unione; altrimenti <c>null</c>.</summary>
    internal IReadOnlyList<string>? Componenti => _componenti;

    /// <summary>
    /// UNIONE ("Any") dichiarativa: un tag SENZA voci proprie le cui voci sono, a boot, l'unione dei
    /// <paramref name="parti"/>. Il <c>RuntimeBuilder</c> la compone DOPO il merge della catena, così le
    /// estensioni ai sotto-tag (anche da altri generatori via <c>ComposeWith</c>) rifluiscono qui — a
    /// differenza di una concatenazione a static-init, che fisserebbe solo le voci del momento. È il modo
    /// generico per esporre un bersaglio "qualunque" sopra un gruppo di sotto-liste (es. età/parente).
    /// </summary>
    public static Tag Unione(string chiave, params Tag[] parti)
    {
        var unione = new Tag(chiave);
        var chiavi = new string[parti.Length];
        for (int i = 0; i < parti.Length; i++) chiavi[i] = parti[i].Key;
        unione._componenti = chiavi;
        return unione;
    }

    /// <summary>Il token da template: <c>[chiave]</c>.</summary>
    public override string ToString() => $"[{Key}]";

    /// <summary>Variante "appuntata" da interpolare (<c>{X.Fissato}</c>): variabile condivisa — la
    /// prima occorrenza nella composizione pesca e memorizza, le successive riusano il valore.</summary>
    public TagFissato Fissato => new(this);

    /// <summary>Richiesto solo per abilitare il collection initializer.</summary>
    public IEnumerator<Frase> GetEnumerator() => Voci.GetEnumerator();
    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
}

/// <summary>Un <see cref="Tag"/> in modalità variabile condivisa (vedi <see cref="Tag.Fissato"/>).</summary>
public readonly record struct TagFissato(Tag Tag);

/// <summary>
/// Fascia d'età con range NUMERICO: il parser legge <see cref="Min"/>/<see cref="Max"/> come interi,
/// senza round-trip su un range-stringa. Interpolata in un template scrive il proprio tag.
/// </summary>
/// <param name="Nome">Il nome della fascia; il tag <c>[eta-nome]</c> si deriva da qui.</param>
/// <param name="Min">Età minima inclusa.</param>
/// <param name="Max">Età massima inclusa.</param>
public sealed record FasciaEta(string Nome, int Min, int Max)
{
    /// <summary>Il tag da template (<c>[eta-nome]</c>).</summary>
    public Tag Tag { get; } = new($"eta-{Nome}");
    /// <inheritdoc cref="Tag.ToString"/>
    public override string ToString() => Tag.ToString();

    /// <summary>Variante "appuntata" da interpolare (<c>{Eta.X.Fissata}</c>): stessa età per tutta la composizione.</summary>
    public FasciaFissata Fissata => new(this);
}

/// <summary>Una <see cref="FasciaEta"/> in modalità variabile condivisa (vedi <see cref="FasciaEta.Fissata"/>).</summary>
public readonly record struct FasciaFissata(FasciaEta Fascia);

/// <summary>
/// Fascia generazionale dei parenti: i due tag (che possiedono le proprie voci) in un valore solo,
/// così registrazione e composte si derivano enumerando <c>Parente.Fasce</c>.
/// </summary>
public sealed record FasciaParente(Tag M, Tag F)
{
    /// <summary>Composta della fascia SENZA genere (es. <c>parente-anziano</c> = zii, nonne, suoceri…):
    /// per gli incastri dove il genere non conta ("il ragù di {Parente.Anziano.Any}"). Chiave derivata
    /// da quella maschile senza il suffisso.</summary>
    public Tag Any { get; } = Tag.Unione(M.Key[..^2], M, F);
}

/// <summary>
/// Etichetta unica di un generatore (<c>IGenerator.UniqueLabels</c>): una sottostringa che può
/// comparire una sola volta nel testo generato. Tipizzata per lo stesso motivo dei <see cref="Tag"/>:
/// le etichette condivise tra master e ospite (es. mbeb→incel) si dichiarano UNA volta e si
/// referenziano dal simbolo; una parola-chiave usa la conversione implicita da stringa, un'etichetta
/// che coincide con un segnaposto usa quella da <see cref="Tag"/>. Il RuntimeBuilder valida al boot
/// che ogni etichetta compaia in almeno una frase: un refuso non può disattivarla in silenzio.
/// </summary>
public sealed record Etichetta(string Testo)
{
    /// <summary>Parola-chiave letterale.</summary>
    public static implicit operator Etichetta(string testo) => new(testo);
    /// <summary>Etichetta che coincide con un segnaposto: unicità sul token del tag.</summary>
    public static implicit operator Etichetta(Tag tag) => new(tag.ToString());
    /// <summary>Il testo nudo, dove serve una stringa.</summary>
    public static implicit operator string(Etichetta etichetta) => etichetta.Testo;
    /// <inheritdoc />
    public override string ToString() => Testo;
}

/// <summary>
/// Riferimento alla GENERAZIONE di un altro generatore: interpolato in una frase — si scrive con
/// l'helper <c>GeneratorBase.Genera</c>, es. <c>new($"tiene banco al {Genera("locali")}")</c> — alla
/// composizione esegue quel generatore per intero e ne INNESTA il testo. Validato al boot: lo slug
/// deve esistere e il grafo degli innesti tra generatori essere aciclico. Come i numeri, il testo
/// innestato non concorre al punteggio della frase.
/// </summary>
public sealed record Innesto(string Slug)
{
    /// <summary>Variante "appuntata" (<c>{Genera("locali").Fissato}</c>): la prima occorrenza nella
    /// composizione genera, le successive — anche in altre frasi — riusano LO STESSO testo. È il modo
    /// di avere un solo bar per tutto il testo invece di uno diverso per frase.</summary>
    public InnestoFissato Fissato => new(this);
}

/// <summary>Un <see cref="Innesto"/> in modalità variabile condivisa (vedi <see cref="Innesto.Fissato"/>).</summary>
public readonly record struct InnestoFissato(Innesto Innesto);

/// <summary>
/// Nome tipizzato di un gruppo esclusivo condiviso (vedi <see cref="SharedContent.Gruppi"/>): si passa
/// la costante dove serve una stringa (conversione implicita), il nome non si riscrive mai a mano.
/// </summary>
public sealed record Gruppo(string Nome)
{
    /// <summary>Un <c>ExclusiveGroups = [Gruppi.Identita, ...]</c> resta una lista di stringhe.</summary>
    public static implicit operator string(Gruppo gruppo) => gruppo.Nome;
    /// <summary>Il nome nudo del gruppo.</summary>
    public override string ToString() => Nome;
}
