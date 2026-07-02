
namespace Backend.Generators;

/// <summary>Informazioni di catalogo e identità di un generatore.</summary>
public record GeneratorInfo
{
    /// <summary>Nome visualizzato del generatore.</summary>
    public string? Name { get; init; }

    /// <summary>Descrizione breve per catalogo e SEO.</summary>
    public string? Description { get; init; }

    /// <summary>Posizione nel catalogo (crescente; assente = in coda).</summary>
    public int? Order { get; init; }
}

/// <summary>Regole di composizione del testo.</summary>
public record GenerationSettings
{
    /// <summary>Numero minimo di frasi del testo generato.</summary>
    public int? MinPhrases { get; init; }

    /// <summary>Numero massimo di frasi del testo generato.</summary>
    public int? MaxPhrases { get; init; }

    /// <summary>Separatori estratti a caso tra una frase e l'altra.</summary>
    public List<string>? Separators { get; init; }

    /// <summary>
    /// Soglia minima di peso/rarità per orchestrare le generazioni: se il testo non raggiunge
    /// questo punteggio viene rigenerato, fino a un tetto di tentativi (poi si tiene il migliore).
    /// Assente o 0 = nessuna soglia. In una composizione vince la soglia più alta tra i generatori.
    /// </summary>
    public double? MinScore { get; init; }

    /// <summary>
    /// Override (0..1) del tasso STANDARD di "conio" Markov (<see cref="Grammar.MarkovChain.DefaultChaos"/>):
    /// probabilità che un segnaposto venga inventato da una catena di Markov invece di pescato — parole
    /// nuove ma plausibili, stesso sapore ortografico. Assente = usa il default standard; 0 = disattiva.
    /// Vale comunque solo per le liste dichiarate coniabili (<c>le chiavi coniabili, private del motore</c>: nomi e cognomi).
    /// In una composizione, tra i generatori che lo impostano vince la probabilità più alta.
    /// </summary>
    public double? MarkovChaos { get; init; }

    /// <summary>Ordine (in caratteri) del modello di Markov per il conio. Default 2 (più alto = più vicino agli originali).</summary>
    public int? MarkovOrder { get; init; }
}

/// <summary>Quota di frasi "identitarie" da garantire quando il generatore è ospite di un altro.</summary>
public record RequiredInjectData
{
    /// <summary>Numero minimo di frasi da iniettare.</summary>
    public int Min { get; init; }

    /// <summary>Numero massimo di frasi da iniettare.</summary>
    public int Max { get; init; }

    /// <summary>Frasi candidate all'iniezione (con punteggio opzionale).</summary>
    public List<Frase> Phrases { get; init; } = [];

    /// <summary>Costruttore vuoto.</summary>
    public RequiredInjectData() { }

    /// <summary>Costruttore diretto per le quote calcolate a runtime.</summary>
    /// <param name="min">Numero minimo di frasi da iniettare.</param>
    /// <param name="max">Numero massimo di frasi da iniettare.</param>
    /// <param name="phrases">Frasi candidate all'iniezione.</param>
    public RequiredInjectData(int min, int max, List<Frase> phrases)
    {
        Min = min;
        Max = max;
        Phrases = phrases;
    }
}

/// <summary>
/// Contratto di un generatore di testo. Ogni generatore è un'istanza di classe (non più un file JSON):
/// espone identità, regole di composizione e i propri contenuti (frasi del core e dizionari di parole).
/// </summary>
/// <remarks>
/// Le composizioni tra generatori (es. l'Incel che "estende" il Maschio Basico) si esprimono come
/// <b>dato esplicito</b>: <see cref="ComposeWith"/> elenca gli slug dei master da fondere prima di
/// questo generatore (vedi <c>GeneratorService</c>). Ogni classe espone solo i <i>propri</i> contenuti:
/// la fusione è responsabilità del servizio. La direzione è a senso unico — l'ospite accede ai
/// comportamenti del master, non viceversa — e un generatore può dichiarare più master.
/// </remarks>
public interface IGenerator
{
    /// <summary>Slug univoco del generatore (usato nell'URL e nel registro).</summary>
    string Slug { get; }

    /// <summary>Informazioni di catalogo e identità.</summary>
    GeneratorInfo? Info { get; }

    /// <summary>
    /// Slug dei generatori "master" che fanno da base e vengono fusi PRIMA di questo (master-first),
    /// o vuoto se il generatore è autonomo. Esprime la composizione come dato esplicito: es. l'Incel
    /// dichiara <c>["mbeb"]</c> perché estende il Maschio Basico (accesso a senso unico: l'ospite
    /// attinge ai contenuti del master, non viceversa).
    /// </summary>
    IReadOnlyList<string> ComposeWith { get; }

    /// <summary>Regole di composizione del testo, o <c>null</c> per usare i default.</summary>
    GenerationSettings? PhraseSettings { get; }

    /// <summary>Quota di frasi identitarie quando questo generatore è iniettato in un altro, o <c>null</c>.</summary>
    RequiredInjectData? CoreRequired { get; }

    /// <summary>Frase di apertura del testo (tipizzata o template legacy), o <c>null</c>.</summary>
    Frase? Apertura { get; }

    /// <summary>Frase di chiusura del testo (tipizzata o template legacy), o <c>null</c>.</summary>
    Frase? Chiusura { get; }

    /// <summary>Frasi centrali del generatore (tipizzate o template legacy, con punteggio opzionale).</summary>
    List<Frase> Core { get; }

    /// <summary>
    /// I tag CON VOCI del generatore: le sue liste locali ed eventuali estensioni di liste altrui
    /// (<c>new(AltroTag) { ... }</c>), fusi per chiave con i condivisi e con la catena dei master.
    /// L'implementazione di default (<see cref="GeneratorBase"/>) li scopre dai campi statici della
    /// classe: dichiarare il campo è dichiarare la lista.
    /// </summary>
    IReadOnlyList<Tag> Liste { get; }

    /// <summary>
    /// I tag UNIONE del generatore (creati con <see cref="Tag.Unione"/>): non hanno voci proprie, le loro
    /// voci sono l'unione — composta al boot, DOPO il merge della catena — dei sotto-tag indicati. Così le
    /// estensioni ai sotto-tag (anche di altri generatori via <see cref="ComposeWith"/>) rifluiscono
    /// nell'unione. Scoperti come le <see cref="Liste"/> dai campi statici della classe.
    /// </summary>
    IReadOnlyList<Tag> Composte { get; }

    /// <summary>Etichette che possono comparire una sola volta nel testo generato, o <c>null</c>.
    /// Validate al boot: ognuna deve comparire in almeno una frase della catena.</summary>
    List<Etichetta>? UniqueLabels { get; }

    /// <summary>Nomi di gruppi di esclusione reciproca da attivare, o <c>null</c>. Un nome si risolve (in
    /// quest'ordine) in: un <see cref="PolicyGroups"/> LOCALE, un PolicyGroup CONDIVISO, o — se è la chiave
    /// di una flatlist — un gruppo-singoletto su quel solo tag.</summary>
    List<string>? ExclusiveGroups { get; }

    /// <summary>Gruppi di esclusione reciproca LOCALI: nome → chiavi dei tag che, comparendo in frasi
    /// diverse dello stesso testo, si escludono a vicenda (al massimo una frase per gruppo). Come i
    /// PolicyGroups condivisi ma definiti dal generatore; si ATTIVANO elencandone il nome in
    /// <see cref="ExclusiveGroups"/>. Servono a evitare che due frasi ripetano lo stesso TEMA quando
    /// più tag sono concettualmente equivalenti. <c>null</c> se il generatore non ne ha.</summary>
    IReadOnlyDictionary<string, IReadOnlyList<string>>? PolicyGroups { get; }
}
