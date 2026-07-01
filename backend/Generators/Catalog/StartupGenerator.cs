using Backend.Models;

// Alias tipizzato per i parenti condivisi: niente stringhe magiche nei segnaposto.
using Parente = Backend.Generators.SharedContent.Tags.Parente;

namespace Backend.Generators.Catalog;

/// <summary>
/// Generatore di IDEE per app/software (non di imprenditori): sforna il classico progetto "da bar". Ogni
/// output è una singola idea, montata così:
/// <list type="bullet">
///   <item><b>testa</b> (<see cref="Apertura"/>): il titolo dell'app — <c>[piattaforma]</c> per una
///         <c>[funzione]</c> generica (roba che esiste già ovunque) + un <c>[dettaglio_specifico]</c>
///         iper-specifico tra parentesi, dove ogni tanto spunta la <c>[city]</c>;</item>
///   <item><b>centro</b> (<see cref="Core"/>): il cortocircuito <c>[lavoro_reale]</c> ↔ <c>[percepito]</c>
///         (una roba enorme liquidata come "la fa il cugino") e la battuta ricorrente vera, <c>[problema_utenti]</c>:
///         il difficile non è farla, è che non la usa nessuno;</item>
///   <item><b>coda</b> (<see cref="Chiusura"/>, discorsiva): chi l'ha avuta — <c>[nome-m]</c>,
///         <c>[professioni]</c> e la <c>[genesi]</c> (sempre dopo troppo tempo su un social).</item>
/// </list>
/// I "parenti che smanettano" arrivano dai condivisi tipizzati (<see cref="Parente"/>). Autonomo, in stile
/// rant come i generatori dei maschi. Gruppi esclusivi: una sola battuta per tipo (contrasto/utenti/sicumera).
/// </summary>
public sealed class StartupGenerator : GeneratorBase
{
    /// <inheritdoc />
    public override string Slug => "startup";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 2, Name = "Generatore di Idee per App", Description = "L'idea geniale per un'app: esiste già e non la userà nessuno" };

    /// <inheritdoc />
    // MarkovChaos = 0: niente conio dei nomi. Qui vogliamo realismo (nomi veri), non varianti inventate.
    public override GenerationSettings? PhraseSettings { get; } = new() { MinPhrases = 2, MaxPhrases = 3, MinScore = 10, Separators = [". ", ".\n"], MarkovChaos = 0 };

    /// <summary>Testa: il titolo dell'idea (piattaforma + funzione generica + dettaglio iper-specifico).</summary>
    public override string? Apertura => "## [piattaforma] per [funzione] _([dettaglio_specifico])_\n\n";

    /// <summary>Coda discorsiva: chi l'ha avuta, cosa fa e dove gli è venuta.</summary>
    public override string? Chiusura => "\n\n_L'idea è di [nome-m], [professioni]. [genesi]._";

    /// <inheritdoc />
    public override List<string>? ExclusiveGroups { get; } = ["lavoro_reale", "problema_utenti", "sicumera"];

    /// <inheritdoc />
    public override Dictionary<string, List<ScoredItem>> FlatLists { get; } = new()
    {
        // ══ TESTA ══ (nell'apertura: non concorrono al punteggio)
        ["piattaforma"] =
        [
            "Un'app", "Un sito", "Un'applicazione desktop", "Un gestionale", "Un portale", "Un social", "Un marketplace", "Una piattaforma",
        ],
        // Funzioni generiche: versioni "da bar" di app che esistono già a bizzeffe. Nessun nome di brand.
        ["funzione"] =
        [
            "trovare persone con le tue stesse passioni vicino a te",
            "dirti cosa cucinare con quello che hai nel frigo",
            "riconoscere una pianta da una foto",
            "dirti se un prodotto del supermercato fa male",
            "trovare lavoro in zona",
            "dividere le spese tra amici",
            "prenotare dal barbiere senza telefonare",
            "trovare un parcheggio libero",
            "sapere a che ora passa davvero l'autobus",
            "vendere le cose che non usi più",
            "condividere la macchina con chi fa la tua strada",
            "trovarti compagni per andare in palestra",
            "ricordarti di bere l'acqua",
            "organizzarti le vacanze col budget che hai",
            "farti portare la spesa a casa",
        ],
        // Il twist iper-specifico tra parentesi: qui ogni tanto spunta la città.
        ["dettaglio_specifico"] =
        [
            "ma solo se hai un cane",
            "ma solo per chi è nato sotto lo stesso segno",
            "con l'IA che ti capisce l'umore",
            "che ti evita la faccia dell'ex",
            "ma i match solo entro 5 km da [city]",
            "però funziona solo il martedì",
            "ma solo per gente di [city]",
            "con le notifiche che ti fanno i complimenti",
            "che però parla nel dialetto di [city]",
            "ma senza pubblicità, quindi gratis per sempre (e senza incassi)",
            "con un sistema di punti che non serve a niente",
            "ma solo per veri intenditori",
        ],

        // ══ CENTRO ══ (pesati: entrano nel punteggio)
        // Quello che servirebbe DAVVERO (enorme).
        ["lavoro_reale"] =
        [
            ("un algoritmo di matching geolocalizzato in tempo reale", 3),
            ("un sistema di riconoscimento immagini", 3),
            ("un modello di IA che nessuna multinazionale ha ancora fatto girare bene", 3),
            ("un'infrastruttura che regge milioni di utenti in contemporanea", 3),
            ("un accordo con mezza grande distribuzione", 3),
            ("un database aggiornato di ogni prodotto in commercio", 3),
            ("una rete di rider e magazzini in tutta Italia", 3),
            ("la moderazione di milioni di contenuti al giorno", 3),
        ],
        // Come lo liquida ("il sito del cugino"): pesca i parenti condivisi tipizzati.
        ["percepito"] =
        [
            ($"la fa mio {Parente.Pari.M} che smanetta, due sere", 2),
            ($"è il sito del {Parente.Giovane.M}, due click", 2),
            ("la butto giù con ChatGPT in un weekend", 2),
            ("l'IA ormai fa tutto lei, io ci metto l'idea", 2),
            ($"tanto mi ha detto mio {Parente.Anziano.M} che è una figata", 2),
            ("ci vuole niente, è solo questione di mettersi lì", 2),
            ("basta un programmatore e siamo a posto", 2),
            ($"me la fa mia {Parente.Pari.F} che studia informatica", 2),
        ],
        // La battuta ricorrente vera.
        ["problema_utenti"] =
        [
            ("poi però non la scarica nessuno", 2),
            ("dopo un mese, download totali: 4", 3),
            ($"l'hanno installata in tre: lui, sua madre e il {Parente.Giovane.M} che gliel'ha fatta", 3),
            ("zero utenti attivi, ma già pensa allo spot in TV", 3),
            ("il difficile non è farla, è convincere qualcuno a usarla", 2),
            ("gli manca solo una cosa per sfondare: le persone che la usano", 3),
            ("l'unico iscritto, per ora, è lui", 2),
        ],
        ["sicumera"] =
        [
            "la cosa più semplice del mondo", "una passeggiata", "roba da niente", "una cosa già mezzo fatta",
        ],

        // ══ CODA ══ (nella chiusura: non concorrono al punteggio)
        ["professioni"] =
        [
            "geometra", "barista", "rappresentante", "magazziniere", "personal trainer",
            "neo-diplomato", "parrucchiere", "agente immobiliare", "promotore finanziario",
            "cassiere al discount", "meccanico", "cameriere", "studente al primo anno",
        ],
        // Dove è nata: sempre dal social. Frasi con verbo, così scorrono dopo il ";".
        ["genesi"] =
        [
            "gli è venuta dopo tre ore su TikTok",
            "gli è venuta sotto un reel di un motivatore alle 2 di notte",
            "ci ha pensato leggendo i commenti sotto il video di uno streamer",
            "l'ha avuta dopo un carosello motivazionale su [social]",
            "gli è venuta guardando uno che vende corsi con la Lambo a nolo",
            "ci ha pensato sul divano, mentre scrollava",
            "gli è venuta dopo l'ennesimo tutorial su come diventare ricchi",
            "l'ha avuta al bar, dopo il terzo spritz",
        ],
    };

    /// <inheritdoc />
    public override List<ScoredItem> Core { get; } =
    [
        // Contrasto lavoro reale ↔ percepito (una sola per testo: gruppo esclusivo "lavoro_reale").
        ("In realtà servirebbe [lavoro_reale], ma per lui _«[percepito]»_", 4),
        ("Dietro ci sarebbe [lavoro_reale], che però lui liquida con _«[percepito]»_", 4),
        ("La parte difficile — [lavoro_reale] — per lui non esiste: _«[percepito]»_", 5),
        ("Tecnicamente vuol dire [lavoro_reale], ma _«tanto [percepito]»_", 4),
        // Problema utenti (gruppo esclusivo "problema_utenti").
        ("Il problema, come sempre, non è l'app: [problema_utenti]", 4),
        ("Poi c'è il dettaglio da nulla: [problema_utenti]", 4),
        // Sicumera (gruppo esclusivo "sicumera").
        ("Ne parla come se fosse [sicumera]", 3),
        ("Per lui è [sicumera], una formalità", 3),
    ];
}
