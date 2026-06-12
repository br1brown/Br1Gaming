namespace Backend.Models;

// ── Snapshot (stateless — nessuna sessione lato server) ──────────────

/// <summary>Scelta proposta al giocatore in uno snapshot di scena.</summary>
/// <param name="Id">Identificatore univoco della scelta nella scena.</param>
/// <param name="Text">Testo mostrato al giocatore.</param>
public record ChoiceSnapshot(string Id, string Text);

/// <summary>
/// Fotografia completa di un passo di gioco: scena corrente, scelte visibili e stato.
/// È l'unica risposta del play — il client la persiste e la rimanda, il server non tiene sessioni.
/// </summary>
/// <param name="StorySlug">Slug della storia a cui appartiene lo snapshot.</param>
/// <param name="StoryTitle">Titolo della storia.</param>
/// <param name="SceneId">Identificatore della scena corrente.</param>
/// <param name="SceneText">Testo della scena, già calcolato per lo stato corrente.</param>
/// <param name="EndingTitle">Titolo del finale, valorizzato solo se <paramref name="IsEnding"/> è true.</param>
/// <param name="Choices">Scelte visibili per lo stato corrente.</param>
/// <param name="IsEnding">True se la scena è un finale (nessuna scelta).</param>
/// <param name="Consequences">Testo della conseguenza dell'ultima scelta, o null.</param>
/// <param name="ChosenChoiceText">Testo della scelta appena fatta, o null all'avvio/resume.</param>
/// <param name="Stats">Stato di gioco esportato, da rimandare al play successivo.</param>
public record StorySnapshot(
    string StorySlug,
    string StoryTitle,
    string SceneId,
    string SceneText,
    string? EndingTitle,
    List<ChoiceSnapshot> Choices,
    bool IsEnding,
    string? Consequences,
    string? ChosenChoiceText,
    Dictionary<string, object> Stats);

// ── DTO esposti dall'API ──────────────────────────────────────────────

/// <summary>Voce di catalogo di una storia.</summary>
/// <param name="Slug">Slug univoco della storia.</param>
/// <param name="Title">Titolo della storia.</param>
/// <param name="Description">Descrizione breve, o null.</param>
public sealed record StorySummaryDto(string Slug, string Title, string? Description);

/// <summary>
/// Body del play: tutti i campi opzionali — nessuno = start, solo SceneId = resume,
/// SceneId + ChoiceId = scelta del giocatore.
/// </summary>
/// <param name="SceneId">Scena corrente del client, o null per iniziare da capo.</param>
/// <param name="ChoiceId">Scelta fatta nella scena corrente, o null.</param>
/// <param name="Stats">Stato di gioco salvato dal client (dall'ultimo <see cref="StorySnapshot.Stats"/>).</param>
public sealed record StoryPlayRequestDto(string? SceneId, string? ChoiceId, Dictionary<string, object>? Stats);

/// <summary>Voce di catalogo di un generatore.</summary>
/// <param name="Slug">Slug univoco del generatore.</param>
/// <param name="Name">Nome visualizzato (fallback: lo slug).</param>
/// <param name="Description">Descrizione breve, o null.</param>
public sealed record GeneratorInfoDto(string Slug, string Name, string? Description);

/// <summary>
/// Prodotto finale di un ciclo di generazione. Il client renderizza il Markdown
/// col pipe `markdown` dell'engine (sanificato): nessuna resa HTML lato server.
/// </summary>
/// <param name="Text">Testo piano, senza formattazione (per speech e condivisione).</param>
/// <param name="Markdown">Testo in Markdown.</param>
public sealed record GenerationResult(string Text, string Markdown);

// ── Modello dati dei generatori ───────────────────────────────────────

/// <summary>Dati condivisi tra tutti i generatori (caricati da <c>data/generators/shared.json</c>).</summary>
/// <param name="FlatLists">Dizionari di parole comuni, riusati dai placeholder di ogni generatore.</param>
/// <param name="PolicyGroups">Gruppi di tag mutuamente esclusivi referenziabili per nome.</param>
/// <param name="ComposedLists">Liste derivate, composte concatenando altre FlatLists.</param>
/// <param name="AgeAliases">Mappa alias → range d'età (es. <c>bambino</c> → <c>[5-12]</c>).</param>
public record SharedData(
    Dictionary<string, List<string>> FlatLists,
    Dictionary<string, List<string>> PolicyGroups,
    Dictionary<string, List<string>> ComposedLists,
    Dictionary<string, string> AgeAliases);

/// <summary>
/// Modello di un generatore così come vive nel suo file <c>data/generators/&lt;slug&gt;.json</c>.
/// </summary>
public class GeneratorData
{
    /// <summary>Informazioni di catalogo e identità.</summary>
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
    }

    /// <summary>Quota di frasi "identitarie" da garantire quando il generatore è ospite di un altro.</summary>
    public record RequiredInjectData
    {
        /// <summary>Numero minimo di frasi da iniettare.</summary>
        public int Min { get; init; }

        /// <summary>Numero massimo di frasi da iniettare.</summary>
        public int Max { get; init; }

        /// <summary>Frasi candidate all'iniezione.</summary>
        public List<string> Phrases { get; init; } = [];

        /// <summary>Costruttore per la deserializzazione JSON.</summary>
        public RequiredInjectData() { }

        /// <summary>Costruttore diretto per le quote calcolate a runtime.</summary>
        /// <param name="min">Numero minimo di frasi da iniettare.</param>
        /// <param name="max">Numero massimo di frasi da iniettare.</param>
        /// <param name="phrases">Frasi candidate all'iniezione.</param>
        public RequiredInjectData(int min, int max, List<string> phrases)
        {
            Min = min;
            Max = max;
            Phrases = phrases;
        }
    }

    /// <summary>Slug del generatore. Non sta nel JSON: lo store lo ricava dal nome del file.</summary>
    public string Slug { get; set; } = "";

    /// <summary>Informazioni di catalogo e identità.</summary>
    public GeneratorInfo? Info { get; set; }

    /// <summary>Regole di composizione del testo.</summary>
    public GenerationSettings? PhraseSettings { get; set; }

    /// <summary>Quota di frasi identitarie quando questo generatore è iniettato in un altro.</summary>
    public RequiredInjectData? CoreRequired { get; set; }

    /// <summary>Frase di apertura del testo (template con placeholder), o null.</summary>
    public string? Apertura { get; set; }

    /// <summary>Frase di chiusura del testo (template con placeholder), o null.</summary>
    public string? Chiusura { get; set; }

    /// <summary>Frasi centrali del generatore (template con placeholder).</summary>
    public List<string> Core { get; set; } = [];

    /// <summary>Dizionari di parole locali del generatore, fusi con quelli condivisi.</summary>
    public Dictionary<string, List<string>> FlatLists { get; set; } = [];

    /// <summary>Gruppi di tag mutuamente esclusivi propri del generatore.</summary>
    public Dictionary<string, List<string>>? PolicyGroups { get; set; }

    /// <summary>Liste derivate proprie del generatore.</summary>
    public Dictionary<string, List<string>>? ComposedLists { get; set; }

    /// <summary>Alias di fasce d'età propri del generatore.</summary>
    public Dictionary<string, string>? AgeAliases { get; set; }

    /// <summary>Etichette che possono comparire una sola volta nel testo generato.</summary>
    public List<string>? UniqueLabels { get; set; }

    /// <summary>Nomi di PolicyGroups da attivare come gruppi di esclusione reciproca.</summary>
    public List<string>? ExclusiveGroups { get; set; }
}
