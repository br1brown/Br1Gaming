namespace Backend.Stories.Catalog;

/// <summary>
/// "Sopravviveresti agli USA?" — avventura a bivi adattata da un video, in italiano,
/// mantenendo il registro deadpan/satirico del narratore originale (seconda persona,
/// niente pistolotti): la satira anti-imperialista sta nei fatti, non nei commenti.
/// Tocco leftist leggero. Ambientata nella nazione fittizia di Oippaderp.
/// Struttura lineare: A = ti fanno il golpe (finale) / B = sopravvivi (continui).
/// </summary>
public class SurviveUsaStory : IStory
{
    /// <inheritdoc />
    public string Slug => "sopravvivi-agli-usa";

    /// <inheritdoc />
    public int Order => 3;

    /// <inheritdoc />
    public string Title => "Sopravviveresti agli USA?";

    /// <inheritdoc />
    public string? Description =>
        "Sei a capo di Oippaderp. Riesci a governarla senza farti rovesciare dal governo degli Stati Uniti?";

    /// <inheritdoc />
    public string StartSceneId => "petrolio";

    /// <inheritdoc />
    public Dictionary<string, object> InitialState => [];

    /// <inheritdoc />
    public bool HasScene(string id) => _scenes.ContainsKey(id);

    /// <inheritdoc />
    public SceneDef GetScene(string id, GameState state)
    {
        if (!_scenes.TryGetValue(id, out var factory) || factory is null)
            throw new KeyNotFoundException($"Scena '{id}' non trovata in {Slug}");

        return factory(state);
    }

    private static readonly Dictionary<string, Func<GameState, SceneDef>> _scenes = new()
    {
        ["petrolio"] = _ => new()
        {
            Text = """
Mettiamo che tu sia a capo di **Oippaderp**. Riuscirai a governarla senza farti rovesciare dal governo degli Stati Uniti?

Ops: il tuo piccolo Paese ha appena scoperto di avere il petrolio. E ne ha **parecchio**. Gli Stati Uniti si presentano puntuali alla tua porta: *«Ehi, ce lo daresti il petrolio, alle compagnie americane, gratis o quasi?»*
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "«Certo, ho il terrore di voi.» E gli cedi il petrolio.",
                    NextSceneId = "finale_petrolio"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "«Assolutamente no, questo petrolio è nostro. Levatevi dai piedi.»",
                    NextSceneId = "uomo_in_tv",
                    Effect      = _ => "Te la cavi. Per ora."
                }
            ]
        },

        ["finale_petrolio"] = _ => new()
        {
            IsEnding    = true,
            EndingTitle = "Golpe al primo giorno",
            EndingImageId = "story.sopravvivi-agli-usa.petrolio",
            Text = """
Mi spiace informarti: ti hanno appena fatto il golpe.

La ExxonMobil è ora il tuo governo. Sarà per la prossima volta.
"""
        },

        ["uomo_in_tv"] = _ => new()
        {
            Text = """
Un giorno accendi la TV e c'è un signore che dice cose terribili su di te. Sei un *dittatore*, dice, forse nemmeno il leader legittimo, e il popolo di Oippaderp ha fame di **libertà**: quella che arriva vendendo il petrolio agli Stati Uniti — pardon, *«aprendosi al mondo libero e alla democrazia occidentale».*

I tuoi consiglieri scoprono che ha studiato ad Harvard, che sua moglie lavora al Dipartimento di Stato americano, e che la sua emittente ha appena ricevuto un quarto di milione di dollari dal *National Endowment for Democracy*, una ONG fondata dalla CIA. La libertà, si sa, arriva sempre ben finanziata.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Non fai niente: lo lasci candidare contro di te e lasci trasmettere la sua emittente.",
                    NextSceneId = "finale_elezioni"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Chiudi l'emittente e gli vieti di candidarsi: lavora per un governo straniero.",
                    NextSceneId = "manifestanti",
                    Effect      = _ => "Lo metti a tacere. Apriti cielo."
                }
            ]
        },

        ["finale_elezioni"] = _ => new()
        {
            IsEnding    = true,
            EndingTitle = "Comprato, non eletto",
            EndingImageId = "story.sopravvivi-agli-usa.elezioni",
            Text = """
Ha vinto le elezioni: gli americani hanno tasche profonde e la propaganda era imbattibile.

Ti hanno fatto il golpe, ma con una scheda elettorale. Adesso governa lui, da fantoccio, per conto delle compagnie petrolifere americane.
"""
        },

        ["manifestanti"] = _ => new()
        {
            Text = """
A un sacco di gente non è piaciuto che tu abbia zittito quel tizio e chiuso le emittenti. Scendono in piazza — e non in modo pacifico. Ammazzano giornalisti, ammazzano medici, ammazzano persino bambini.

Curiosamente, i cartelli sono **tutti in inglese**, in un Paese dove quasi nessuno lo parla. I tuoi servizi ti confermano che dietro i «manifestanti» ci sono i soldi e la regia degli Stati Uniti.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Non fai niente: è il loro sacrosanto diritto a manifestare.",
                    NextSceneId = "finale_proteste"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Reprimi, in fretta e con durezza, questa violenza pagata dall'estero.",
                    NextSceneId = "sanzioni",
                    Effect      = _ => "Fai capire che le ingerenze straniere qui non sono il benvenuto."
                }
            ]
        },

        ["finale_proteste"] = _ => new()
        {
            IsEnding    = true,
            EndingTitle = "Cacciato di palazzo",
            EndingImageId = "story.sopravvivi-agli-usa.proteste",
            Text = """
I manifestanti assaltano il palazzo del governo e ti cacciano via — o peggio.

Ti hanno fatto il golpe. Al tuo posto mettono un fantoccio, probabilmente quel signore della TV, e a tirare i fili sono — ovviamente — gli Stati Uniti e le loro aziende.
"""
        },

        ["sanzioni"] = _ => new()
        {
            Text = """
Adesso la «comunità internazionale» è indignata per come hai trattato quei *manifestanti pacifici*. Così ti sanziona e ti mette sotto embargo: nessuno può comprare il tuo petrolio, e tu non puoi importare le cose che servono per vivere — medicine, cibo. Più o meno quello che fanno a Cuba da sessant'anni.

Ti restano due soldi in cassa. Puoi spenderli una volta sola.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Li spendo per sfamare la mia gente.",
                    NextSceneId = "finale_invasione"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Li spendo per costruire una bomba atomica.",
                    NextSceneId = "finale_sopravvivenza"
                }
            ]
        },

        ["finale_invasione"] = _ => new()
        {
            IsEnding    = true,
            EndingTitle = "Colto allo stremo",
            EndingImageId = "story.sopravvivi-agli-usa.invasione",
            Text = """
Molto carino da parte tua. Peccato che fosse esattamente quello che aspettavano: gli Stati Uniti hanno aspettato che fossi allo stremo e poi ti hanno invaso via terra per toglierti di mezzo.

Ti hanno fatto il golpe. Il petrolio, in fondo, non è mai stato il punto.
"""
        },

        ["finale_sopravvivenza"] = _ => new()
        {
            IsEnding    = true,
            EndingTitle = "Vivo per combattere ancora",
            EndingImageId = "story.sopravvivi-agli-usa.sopravvivenza",
            Text = """
Congratulazioni: sei sopravvissuto senza farti rovesciare dal governo degli Stati Uniti.

Il rovescio della medaglia è che adesso ti odieranno per sempre, proprio perché non sono riusciti a fregarti. Aspettati bugie assurde, propaganda a valanga e un embargo senza fine: resterai tagliato fuori dal «mondo libero» per un bel pezzo.

Però il petrolio è rimasto del tuo popolo, e Oippaderp è ancora in piedi. Povera e isolata, ma tua. Buona fortuna.
"""
        }
    };
}
