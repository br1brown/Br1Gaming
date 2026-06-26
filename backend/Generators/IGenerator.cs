using Backend.Models;

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
    /// Vale comunque solo per le flatlist idonee (nomi propri a parola singola: nomi, città, cognomi…).
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
    public List<ScoredItem> Phrases { get; init; } = [];

    /// <summary>Costruttore vuoto.</summary>
    public RequiredInjectData() { }

    /// <summary>Costruttore diretto per le quote calcolate a runtime.</summary>
    /// <param name="min">Numero minimo di frasi da iniettare.</param>
    /// <param name="max">Numero massimo di frasi da iniettare.</param>
    /// <param name="phrases">Frasi candidate all'iniezione.</param>
    public RequiredInjectData(int min, int max, List<ScoredItem> phrases)
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

    /// <summary>Frase di apertura del testo (template con placeholder), o <c>null</c>.</summary>
    string? Apertura { get; }

    /// <summary>Frase di chiusura del testo (template con placeholder), o <c>null</c>.</summary>
    string? Chiusura { get; }

    /// <summary>Frasi centrali del generatore (template con placeholder, con punteggio opzionale).</summary>
    List<ScoredItem> Core { get; }

    /// <summary>Dizionari di parole locali del generatore (con punteggio opzionale), fusi con quelli condivisi.</summary>
    Dictionary<string, List<ScoredItem>> FlatLists { get; }

    /// <summary>Etichette che possono comparire una sola volta nel testo generato, o <c>null</c>.</summary>
    List<string>? UniqueLabels { get; }

    /// <summary>Nomi di PolicyGroups (condivisi) da attivare come gruppi di esclusione reciproca, o <c>null</c>.</summary>
    List<string>? ExclusiveGroups { get; }
}
