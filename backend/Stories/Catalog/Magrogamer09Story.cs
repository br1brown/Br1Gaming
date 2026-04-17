namespace Backend.Stories.Catalog;

public class Magrogamer09Story : IStory
{
    public string Slug
    {
        get
        {
            return "magrogamer09";
        }
    }

    public string Title
    {
        get
        {
            return "Magrogamer09 - Il Simulatore di Gamer";
        }
    }

    public string? Description
    {
        get
        {
            return "50.000 follower, zero scandali. Questo gioco non ha un vincitore.";
        }
    }

    public string StartSceneId
    {
        get
        {
            return "tono_live";
        }
    }

    public Dictionary<string, object> InitialState
    {
        get
        {
            var initialState = new Dictionary<string, object>
            {
                ["percezionePublica"] = 5,
                ["amiciziaFavijanni"] = 5
            };

            return initialState;
        }
    }

    public bool HasScene(string id)
    {
        var hasScene = _scenes.ContainsKey(id);
        return hasScene;
    }

    public SceneDef GetScene(string id, GameState state)
    {
        var hasFactory = _scenes.TryGetValue(id, out var factory);
        if (!hasFactory || factory is null)
        {
            throw new KeyNotFoundException($"Scena '{id}' non trovata in {Slug}");
        }

        var scene = factory(state);
        return scene;
    }

    private static readonly Dictionary<string, Func<GameState, SceneDef>> _scenes = new()
    {
        ["tono_live"] = _ => new()
        {
            Text = """
Sei **Magrogamer09**. 50.000 follower, una community affezionata, zero scandali. Le live sono regolari, il clima è positivo.

Il tuo stile è chiaro fin dall'inizio.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Pacato e gentile - calmi i toni quando serve",
                    NextSceneId = "moderazione_chat",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 2);
                        return "Molti ti descrivono come *una presenza rassicurante*. Ci si aspetta che tu reagisca con calma anche quando le cose vanno storte.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Energico, urli spesso, punti sull'intrattenimento",
                    NextSceneId = "moderazione_chat",
                    Effect      = _ => "Il pubblico ti segue per l'energia. Non sempre sei preso sul serio, ma sei **molto guardato**."
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Ironico e distaccato - raramente prendi posizione",
                    NextSceneId = "moderazione_chat",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        return "Sei apprezzato per l'ironia, ma spesso si dice che *non si capisca da che parte stai*.";
                    }
                }
            ]
        },
        ["moderazione_chat"] = _ => new()
        {
            Text = "Fin dall'inizio hai scelto che tipo di moderazione avere. **Come hai impostato la chat?**",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Moderazione attiva e presente",
                    NextSceneId = "rapporto_streamer",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        return "La chat è tranquilla. Qualcuno la trova un po' rigida, ma *ci si sente al sicuro*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Standard - intervieni solo se necessario",
                    NextSceneId = "rapporto_streamer",
                    Effect      = _ => "La chat si autoregola quasi sempre. Ogni tanto scappa qualcosa, ma rientra."
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Minima - spazio alla community",
                    NextSceneId = "rapporto_streamer",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "La chat è molto viva. A volte diventa difficile *distinguere ironia e cattiveria*.";
                    }
                }
            ]
        },
        ["rapporto_streamer"] = _ => new()
        {
            Text = "Fai parte di un giro di streamer con cui collabori spesso, compreso un ragazzo con cui ti trovi bene, **Favijanni**. Come gestisci questi rapporti?",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Tieni molto ai rapporti personali - la fiducia prima delle opportunità",
                    NextSceneId = "rapporto_pubblico",
                    Effect      = state =>
                    {
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") + 1);
                        return "Gli altri streamer sanno che *possono fidarsi di te*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Rapporti cordiali ma professionali",
                    NextSceneId = "rapporto_pubblico",
                    Effect      = _ => "Ci si rispetta. Ognuno pensa al proprio canale."
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Usi le collaborazioni soprattutto per crescere",
                    NextSceneId = "rapporto_pubblico",
                    Effect      = state =>
                    {
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") - 1);
                        return "C'è chi ti stima, ma qualcuno inizia a vederti come *opportunista*.";
                    }
                }
            ]
        },
        ["rapporto_pubblico"] = _ => new()
        {
            Text = "Quando succede qualcosa di delicato, **come lo gestisci con il pubblico?**",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Parli apertamente con la community",
                    NextSceneId = "crash_live",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        return "Il pubblico sente di essere coinvolto. Crea **fiducia**, ma anche *aspettative*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Gestisci tutto dietro le quinte",
                    NextSceneId = "crash_live",
                    Effect      = _ => "All'esterno sembra che vada tutto liscio. *Non tutti capiscono cosa succede davvero.*"
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Eviti il più possibile le spiegazioni",
                    NextSceneId = "crash_live",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "Il silenzio è spesso *interpretato in modi diversi*.";
                    }
                }
            ]
        },
        ["crash_live"] = _ => new()
        {
            Text = """
Aspetti questo gioco da **quattro mesi**. Hai calendarizzato un'intera settimana di live in preparazione. Dieci minuti dopo l'inizio, **OBS ti crasha tre volte di fila**.

La chat diventa inquieta. Qualcuno sospetta che tu stia cercando un modo elegante di uscirne. Qualcuno ti insulta per l'incompetenza. *Non è colpa tua*, però tutti ti stanno guardando.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Respiri, su Instagram scherzi sulla sfortuna e riparti",
                    NextSceneId = "serata_minecraft",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 2);
                        return "Mostri leggerezza e calma. **La community apprezza.**";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Ti scusi nervosamente su ogni piattaforma, dici che non è giornata",
                    NextSceneId = "serata_minecraft",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        return "Con un atteggiamento spento, *la live si trascina*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Sbotti contro la piattaforma e contro chi si lamenta in un TikTok improvvisato",
                    NextSceneId = "serata_minecraft",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "La tensione aumenta. La chat si chiede *se finirai mai quella live*.";
                    }
                }
            ]
        },
        ["serata_minecraft"] = _ => new()
        {
            Text = """
Live chill su Minecraft: stai livellando una farm di zucchero di canna, musica lo-fi in sottofondo, **1.500 viewer** che chiacchierano di cavolate innocue.

All'improvviso la chat cambia tono:

> «SOLO TU SEI IL VERO GOAT DI MC»
> «GLI ALTRI SONO TUTTI FIGLI DI»
> «KING È TORNATO, IL RESTO È MERDA»

Poi, in meno di due minuti, la cosa degenera. Qualcuno scrive *«Comunque Favijanni fa schifo dal 2022»*, e parte il domino. I moderatori non si sono mossi. **Se lasci correre sembra che tu approvi.**
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Intervengo e chiedo di smettere",
                    NextSceneId = "meme_sfugge",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") + 2);
                        return "Una parte della chat si calma subito. Qualcun altro si lamenta: *«non si può più scherzare»*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Attivo i moderatori senza dire nulla",
                    NextSceneId = "meme_sfugge",
                    Effect      = state =>{
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") + 1);
                    return "I messaggi spariscono in fretta, ma resta *tensione e cose non dette*.";
                    }
                },
        new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Lascio correre senza intervenire",
                    NextSceneId = "meme_sfugge",
                    Effect      = state =>
                    {
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") -1);
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "La chat si scalda. I commenti diventano *sempre più cattivi* e attirano nuovi spettatori curiosi.";
                    }
                }
            ]
        },
        ["meme_sfugge"] = _ => new()
        {
            Text = """
Passa mezz'ora, stai raidando un villaggio su Minecraft e butti lì una battuta:

> *«Guardate questi villager come commerciano, deve essere una vera rottura lavorare... per fortuna che io sono uno streamer e queste cose non le faccio»*

In trenta secondi è già spam a raffica:

> «Per fortuna che io sono uno streamer e non pago le tasse»
> «...e non vado in palestra»
> «...e non tocco erba»

Il meme si diffonde. **Fuori dal tuo ecosistema suona diversamente.**
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Blocco il meme e lo condanno apertamente in live",
                    NextSceneId = "sponsor_succo",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        return "Dici chiaro che fuori contesto sembra classista e non lo vuoi sul canale. Qualcuno apprezza. Arrivano i primi *unfollow silenziosi*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Lascio che giri ogni tanto senza incoraggiarlo",
                    NextSceneId = "sponsor_succo",
                    Effect      = _ => "Non lo riprendi, non lo spingi. Quando appare fai finta di niente. *L'atmosfera rimane ambigua.*"
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Lo riprendo e lo rendo parte del canale",
                    NextSceneId = "sponsor_succo",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 2);
                        return "Fuori dal tuo ecosistema esplode: clip su TikTok, thread su Twitter, articoli drama. **«Magrogamer09: Non lavoro, sono uno streamer».**";
                    }
                }
            ]
        },
        ["sponsor_succo"] = _ => new()
        {
            Text = """
Finita la live ti arrivano DM da follower fidati: il succo alla pera *«BenBevi: 100% bio e zero schifezze»* che hai sponsorizzato tre mesi fa sta per finire in causa per **valori nutrizionali inventati** e tracce di contaminanti.

Lo scandalo non è ancora esploso, ma le carte stanno già girando tra giornalisti e pagine drama.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Fai un video in cui ti assumi la responsabilità e prometti più attenzione in futuro",
                    NextSceneId = "black_friday",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 3);
                        return "Viene percepito come un **esempio di assunzione di responsabilità**, anche se qualcuno sottolinea che l'errore resta.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Fai un video scaricando la colpa sul brand",
                    NextSceneId = "black_friday",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "Le scuse vengono percepite come *poco convincenti*. Iniziano i primi commenti sulla tua sincerità.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Ignori completamente la questione",
                    NextSceneId = "sponsor_aftermath",
                    Effect      = _ => null
                }
            ]
        },
        ["sponsor_aftermath"] = _ => new()
        {
            Text = """
Un paio di settimane dopo, il caso esplode. I mod hanno bloccato *«pera»* e *«succo»* nei filtri, ma sotto i video inizia a spuntare:

> *«Comunque il succo radioattivo?»*
> *«Quando le scuse per aver rifilato veleno ai follower?»*

Ogni volta che qualcuno tira fuori l'argomento si crea un cluster di flame. **Sei costretto a rispondere.**
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Affronto apertamente i commenti più critici in live",
                    NextSceneId = "black_friday",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        return "Alcuni apprezzano il confronto diretto, altri dicono che *così dai solo più spazio alle polemiche*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Ignoro i commenti e continuo con i contenuti abituali",
                    NextSceneId = "black_friday",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "La crescita prosegue, ma i commenti più duri restano *sotto la superficie*.";
                    }
                }
            ]
        },
        ["black_friday"] = _ => new()
        {
            Text = """
Dopo il **Black Friday** sono entrate migliaia di euro grazie ai link di affiliazione. La tua build del 2021 funziona ancora alla grande: 1440p ultra senza un singhiozzo, zero crash.

Non hai bisogno di aggiornare nulla. *Ma hai i soldi.*
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Lasci tutto com'è",
                    NextSceneId = "testata",
                    Effect      = _ => "Il pubblico continua a vivere le live come prima."
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Rifai completamente lo studio in modo vistoso",
                    NextSceneId = "testata",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        return "Il nuovo setup salta all'occhio. La chat esplode in complimenti. **Sembri in piena crescita.**";
                    }
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Aggiorni solo il computer senza dirlo a nessuno",
                    NextSceneId = "testata",
                    Effect      = _ => "Le live risultano leggermente più fluide, ma *pochi se ne accorgono*."
                }
            ]
        },
        ["testata"] = _ => new()
        {
            Text = """
La testata di pettegolezzo **IlWebbeh** ti contatta in privato. Stanno preparando un articolo su una presunta relazione tra **Favijanni** e **GinevraLaGamer**. Sai che è vero, ma i due ci tengono a mantenerla privata.

*Qualsiasi conferma da parte tua potrebbe far saltare tutto.*
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Dici di non saperne nulla",
                    NextSceneId = "preview_videogioco",
                    Effect      = state =>
                    {
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") + 1);
                        return "*IlWebbeh* prende tempo. Qualcuno inizia a chiedersi come mai proprio tu non ne sappia niente.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Confermi l'esistenza della relazione",
                    NextSceneId = "preview_videogioco",
                    Effect      = state =>
                    {
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") - 2);
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 3);
                        return "L'articolo esce e il tuo nome viene citato come **fonte diretta**. Le tensioni con Favijanni diventano *evidenti*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Non rispondi all'agenzia",
                    NextSceneId = "preview_videogioco",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "Il silenzio viene notato e *alimenta voci e supposizioni*.";
                    }
                }
            ]
        },
        ["preview_videogioco"] = _ => new()
        {
            Text = """
Vieni selezionato per una preview anticipata di **Dreaming Simulator**, uno dei giochi che sogni di portare da inizio canale. La build è ancora grezza, ma perfetta per preparare una recensione al day one.

Nel giro di poco ti arriva un messaggio da **Favijanni**: ti chiede se puoi passargli *«qualcosina»*, anche solo un breve spezzone. Non puoi condividere nulla. **Nemmeno uno screenshot.**
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Non condividi nulla",
                    NextSceneId = "ospite_controverso",
                    Effect      = state =>
                    {
                        var amiciziaFavijanniAttuale = state.Get<int>("amiciziaFavijanni");
                        var nuovaAmiciziaFavijanni = amiciziaFavijanniAttuale - 1;
                        state.Set("amiciziaFavijanni", nuovaAmiciziaFavijanni);

                        if (nuovaAmiciziaFavijanni >= 5)
                        {
                            return "Favijanni ti capisce, *non insiste*.";
                        }

                        return "I rapporti restano cordiali ma *più freddi*. Dice che sei diventato troppo rigido.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Condividi solo qualche spezzone non esplicito",
                    NextSceneId = "ospite_controverso",
                    Effect      = _ => "Nessuno dice nulla apertamente."
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Condividi tutto il materiale disponibile",
                    NextSceneId = "ospite_controverso",
                    Effect      = state =>
                    {
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") + 2);
                        return "Favijanni apprezza molto e *ti è grato*.";
                    }
                }
            ]
        },
        ["ospite_controverso"] = _ => new()
        {
            Text = """
Dopo settimane di organizzazione riesci a fissare una live con **Osvaldo Osvaldini**, uno dei nomi più rispettati nel gaming tecnico.

La sera prima, però, Twitter esplode: Osvaldo ha appena scritto che la modalità facile dei videogiochi è *«roba da [parola censurata e volgarissima]»*. La vostra live riguarda solo performance e ottimizzazione, *in teoria non c'entra nulla*. Ma il tweet sta girando ovunque e **tutti sanno che domani lui sarà da te**.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Annulli la live spiegando il motivo",
                    NextSceneId = "proposta_azienda",
                    Effect      = _ => "Viene letta come una presa di posizione coerente. Qualcuno parla di *occasione sprecata*."
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Fai la live evitando completamente l'argomento",
                    NextSceneId = "proposta_azienda",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "Il silenzio viene notato. La live viene commentata più per **ciò che non è stato detto** che per i contenuti.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Fai la live dando spazio all'ospite per chiarire",
                    NextSceneId = "proposta_azienda",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "La diretta attira attenzione, ma molti dicono che *così hai dato spazio a posizioni problematiche*.";
                    }
                }
            ]
        },
        ["proposta_azienda"] = _ => new()
        {
            Text = """
Ti arriva una mail da **Armand Letal**, una grande azienda videoludica. Nel settore tutti sanno com'è messa: ritmi di lavoro disumani, dipendenti spremuti, giochi che arrivano mediocri e pieni di compromessi.

L'offerta economica è però così alta da permetterti **un salto notevole** al canale.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Accetti la sponsorizzazione e promuovi il gioco",
                    NextSceneId = "nuove_regole",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 2);
                        return "Il gioco viene notato. Iniziano commenti critici sulla *coerenza delle tue scelte*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Rifiuti in privato",
                    NextSceneId = "nuove_regole",
                    Effect      = _ => "All'esterno non succede nulla."
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Rifiuti pubblicamente spiegando i motivi",
                    NextSceneId = "nuove_regole",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 2);
                        return "Fa discutere e ti espone a critiche, ma **rafforza l'immagine di coerenza**.";
                    }
                }
            ]
        },
        ["nuove_regole"] = _ => new()
        {
            Text = """
Un recente fatto di cronaca spinge la piattaforma a introdurre **nuove regole rigide** sui contenuti violenti. Il gioco che stai portando è ancora consentito, ma solo attivando la *modalità censura* — quella che smorza gli effetti e toglie il realismo che la tua community ama di più.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Segui le regole attivando la censura e lo spieghi in live",
                    NextSceneId = "reality_casa",
                    Effect      = _ => "Viene vista come la scelta corretta ma *poco coraggiosa*. Qualcuno dice che il canale sembri meno autentico."
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Segui le regole senza commentare la decisione",
                    NextSceneId = "reality_casa",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "Molti si accorgono del cambiamento. Senza una spiegazione, *il pubblico resta diviso* sul motivo.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Ignori le regole cercando di aggirarle tecnicamente",
                    NextSceneId = "reality_casa",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        return "Le live tornano come prima. Ma serpeggia l'idea che *prima o poi qualcuno farà un controllo*.";
                    }
                }
            ]
        },
        ["reality_casa"] = _ => new()
        {
            Text = """
Una grande azienda energetica, **Dorothea**, ti invita a un reality di una settimana chiamato *«Casa del Pianeta»* — sensibilizzazione ambientale, talk, attività green.

Tu però conosci bene l'azienda: investimenti in pozzi di petrolio, *greenwashing* che circolano da anni. L'offerta economica è alta e la visibilità sarebbe **enorme**.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Rifiuti l'invito",
                    NextSceneId = "metodo_follower",
                    Effect      = _ => "Non partecipi. Nessun rischio, nessuna visibilità."
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Accetti ma dichiari pubblicamente le contraddizioni dell'azienda",
                    NextSceneId = "metodo_follower",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        if (state.Get<int>("percezionePublica") >= 5)
                        {
                            state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                            return "Vieni criticato per l'incoerenza, ma alcuni ti elogiano per il **coraggio di dire ciò che molti evitano**.";
                        }

                        return "Il tuo nome gira molto, ma le critiche per l'incoerenza *pesano*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Accetti e glissi su ogni domanda scomoda",
                    NextSceneId = "metodo_follower",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 2);
                        return "Viene vista come un *sostegno implicito* al progetto. Iniziano commenti sul tuo opportunismo.";
                    }
                }
            ]
        },
        ["metodo_follower"] = _ => new()
        {
            Text = """
**Favijanni** ti parla di *«BoostiAMO»*, un sistema per far crescere i follower a una velocità impressionante. Non è chiaro come funzioni esattamente, *nessuno lo spiega in modo preciso*, ma nell'ambiente se ne sente parlare sempre più spesso.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Lo usi anche tu",
                    NextSceneId = "accusa_favijanni",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 2);
                        return "I numeri crescono rapidamente. Molti iniziano a chiedersi **come sia possibile un aumento così improvviso**.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Lo usi solo in minima parte per provare",
                    NextSceneId = "accusa_favijanni",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "La crescita è meno evidente, ma resta la sensazione di esserti mosso in *una zona poco chiara*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Rifiuti e continui con la crescita naturale",
                    NextSceneId = "accusa_favijanni",
                    Effect      = _ => "Nessun picco artificioso."
                }
            ]
        },
        ["accusa_favijanni"] = _ => new()
        {
            Text = """
All'improvviso **Favijanni viene accusato pubblicamente di non pagare le tasse**. La notizia esplode sui social e in pochi minuti arriva nella tua chat.

Tu però sai come stanno le cose: lo hai accompagnato tu stesso dal commercialista, ha pagato tutto, ha fatto il 730. Il problema è che l'Agenzia delle Entrate ha riattivato una vecchia multa legata a un'eredità — *una questione privata*, nulla che riguardi la sua condotta.

La tua community **chiede una tua posizione**.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Difendi Favijanni apertamente",
                    NextSceneId = "moderatore_disastro",
                    Effect      = state =>
                    {
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") + 1);
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        return "Escono articoli che mettono in discussione la tua obiettività. **La scelta divide il pubblico.**";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Dici che non vuoi entrare nel drama",
                    NextSceneId = "moderatore_disastro",
                    Effect      = state =>
                    {
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") - 1);
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") - 1);
                        return "Molti leggono il silenzio come prudenza. Altri come *un modo per non esporsi quando serviva*.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Ironizzi sulla vicenda",
                    NextSceneId = "moderatore_disastro",
                    Effect      = state =>
                    {
                        state.Set("amiciziaFavijanni", state.Get<int>("amiciziaFavijanni") - 3);
                        state.Set("percezionePublica", state.Get<int>("percezionePublica") + 1);
                        return "La battuta gira e genera attenzione. **I rapporti con Favijanni si incrinano.**";
                    }
                }
            ]
        },
        ["moderatore_disastro"] = state =>
        {
            var amiciziaFavijanni = state.Get<int>("amiciziaFavijanni");
            var intro = "";
            if (amiciziaFavijanni >= 7)
            {
                intro = "**Favijanni** pubblica un messaggio di sostegno: vi conosce da anni, avete *sempre gestito la community con serietà*.";
            }
            else if (amiciziaFavijanni >= 4)
            {
                intro = "**Favijanni** resta neutrale: *«La situazione è complessa e va gestita con attenzione»*.";
            }
            else
            {
                intro = "**Favijanni** pubblica una frase ambigua: *«Ognuno è responsabile del proprio staff»*. Molti la leggono come una **presa di distanza da te**.";
            }

            var percezionePublica = state.Get<int>("percezionePublica");
            var puoFareDichiarazioneTrasparente = percezionePublica >= 6;
            var testoScena = intro + "\n\n" + """
Un **moderatore storico** del tuo canale viene accusato su Discord di aver abusato del suo ruolo: zittire utenti, cancellare messaggi a caso, vantarsi di *«poteri speciali»*. In anni di onorato servizio non ha mai fatto cose così.

Nel giro di poche ore **circolano screenshot ovunque**. Quando apri la live la chat è già nel caos.
""";

            List<ChoiceDef> choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Rimuovi immediatamente il moderatore e chiedi scusa",
                    NextSceneId = "finale",
                    Effect      = sceneState =>
                    {
                        var percezioneAttuale = sceneState.Get<int>("percezionePublica");
                        var nuovaPercezione = percezioneAttuale + 1;
                        sceneState.Set("percezionePublica", nuovaPercezione);
                        return "Il gesto viene visto come **deciso**, anche se qualcuno dice che arrivi troppo tardi.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Chiedi tempo per verificare la situazione",
                    NextSceneId = "finale",
                    Effect      = _ => "Viene accolta male. Molti leggono la cautela come *un modo per non esporsi*."
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Difendi il moderatore - potrebbe essere un equivoco",
                    NextSceneId = "finale",
                    Effect      = sceneState =>
                    {
                        var percezioneAttuale = sceneState.Get<int>("percezionePublica");
                        var nuovaPercezione = percezioneAttuale - 1;
                        sceneState.Set("percezionePublica", nuovaPercezione);
                        return "Le reazioni diventano rapidamente ostili. Gli screenshot iniziano a girare su **pagine sempre più grandi**.";
                    }
                },
                new ChoiceDef
                {
                    Id          = "D",
                    Text        = "Fai una dichiarazione trasparente spiegando come gestisci la moderazione",
                    NextSceneId = "finale",
                    IsVisible   = puoFareDichiarazioneTrasparente,
                    Effect      = sceneState =>
                    {
                        var percezioneAttuale = sceneState.Get<int>("percezionePublica");
                        var nuovaPercezione = percezioneAttuale + 1;
                        sceneState.Set("percezionePublica", nuovaPercezione);
                        return "Viene letta come *un tentativo serio di chiarire*. **Molti apprezzano il tono.**";
                    }
                }
            ];

            return new SceneDef
            {
                Text = testoScena,
                Choices = choices
            };
        },
        ["finale"] = state =>
        {
            var amiciziaFavijanni = state.Get<int>("amiciziaFavijanni");
            var percezionePublica = state.Get<int>("percezionePublica");
            var routeToScene = "ending_chiusura";

            if (amiciziaFavijanni >= 9)
            {
                routeToScene = "ending_amicizia";
            }
            else if (percezionePublica >= 6)
            {
                routeToScene = "ending_indenne";
            }
            else if (percezionePublica >= 2)
            {
                routeToScene = "ending_difficile";
            }

            return new SceneDef
            {
                Text = string.Empty,
                RouteToScene = routeToScene
            };
        },
        ["ending_amicizia"] = _ => new()
        {
            IsEnding = true,
            EndingTitle = "Salvati dall'Amicizia",
            Text = "Il **sostegno pubblico di Favijanni** cambia il clima. Il suo intervento diventa virale e riporta *fiducia e stabilità* attorno al canale."
        },
        ["ending_indenne"] = _ => new()
        {
            IsEnding = true,
            EndingTitle = "Uscita Quasi Indenne",
            Text = "Lo scandalo non si spegne subito, ma la gestione viene apprezzata. **La community resta in gran parte con te mentre si beve succo alla pera.**"
        },
        ["ending_difficile"] = _ => new()
        {
            IsEnding = true,
            EndingTitle = "Sopravvivenza Difficile",
            Text = "Il canale non si ferma, ma *perde slancio e credibilità*. La ricostruzione della fiducia richiederà **molto tempo**."
        },
        ["ending_chiusura"] = _ => new()
        {
            IsEnding = true,
            EndingTitle = "Chiusura del Canale",
            Text = "**La sfiducia cresce** fino a rendere impossibile continuare. *Il canale si ferma.*"
        }
    };
}
