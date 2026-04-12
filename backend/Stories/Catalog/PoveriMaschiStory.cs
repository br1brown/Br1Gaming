namespace Backend.Stories.Catalog;

public class PoveriMaschiStory : IStory
{
    public string Slug
    {
        get
        {
            return "poveri-maschi";
        }
    }

    public string Title
    {
        get
        {
            return "Siamo Maschi";
        }
    }

    public string? Description
    {
        get
        {
            return "Una storia interattiva su Marco, beta maschio etero di 28 anni incastrato in un mondo che non lo capisce.";
        }
    }

    public string StartSceneId
    {
        get
        {
            return "start";
        }
    }

    public Dictionary<string, object> InitialState
    {
        get
        {
            var initialState = new Dictionary<string, object>();
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
        ["start"] = _ => new()
        {
            Text = """
Sono **Marco**. Beta maschio etero, 28 anni, incastrato in 'sto mondo di merda che ci piscia in testa ogni santo giorno solo perché non siamo *Chad over 1.85*.

Lavoro in un ufficio schifoso dove le quote rosa fanno salire le femmine in giacca e gonna mentre io mi spacco il culo su Excel per **1.200 euro netti** e zero riconoscimenti. Ignorato ovunque: Tinder? **Zero match da 3 mesi.** L'ultima ex mi ha mollato per un palestrato con la piscina gonfiabile.

Tardo pomeriggio domenica, seduto qua in camera come un coglione con la *streak nofap* al giorno 2, che non sa che cazzo fare prima che arrivi il lunedì infernale.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Sblocco 'sto telefono del cazzo e apro i social per scrollare il feed e non pensare a quanto son fottuto",
                    NextSceneId = "social_media",
                    Effect      = _ => "Scorro e bum: post di *Stacy* che piangono per «patriarcato» mentre il sistema le premia con promo facili e OnlyFans d'oro. **Blackpill confermata**, cazzo!"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Chiamo mamma Tiziana per sfogarmi, tanto pure lei con le sue bluepill non capisce 'sta discriminazione anti-maschi del cazzo",
                    NextSceneId = "call_mom",
                    Effect      = _ => "Telefono... Contatti... *Mamma Tiziana*. Scommetto finirà con «pensa positivo» mentre io qui zero fica e bollette da pagare"
                },
                new ChoiceDef
                {
                    Id          = "C",
                    Text        = "Apro il PC e butto giù un post lunghissimo per svegliare 'sti beta addormentati: il sistema ci fotte e tocca ribellarsi!",
                    NextSceneId = "write_post",
                    Effect      = _ => "Cazzo sì, **manifesto contro le quote rosa e il femminismo tossico!** Cito *Warren Farrell* e *Uomini Beta*: lui sì che ha capito come ci usano e gettano"
                },
                new ChoiceDef
                {
                    Id          = "D",
                    Text        = "Non muovo un cazzo fino a sera, tanto domani torno in quell'ufficio-fogna dove la collega troia si becca gli applausi",
                    NextSceneId = "office_day",
                    Effect      = _ => "Lunedì: sveglia con occhi gonfi da porno notturno, ufficio che mi sbatte in faccia l'ennesima ingiustizia — *lei promossa, io zero*"
                }
            ]
        },
        ["social_media"] = _ => new()
        {
            Text = """
Ecco l'ennesimo post di merda su Facebook:

> *«Donne discriminate sul lavoro»*

Ma per piacere! E sotto, commenti di beta leccapiedi che leccano il culo al sistema. Confermano che ignorano apposta noi maschi, cazzo, ci prendono per il culo e nessuno fiata! **Blackpill** quotidiana.

Poi bum, la foto della mia ex compagna di scuola — quella *Stacy* che mi friendzonava ai tempi — ora **promossa manager** con sorriso da 32 denti. Per forza, chissà quanti pompini ha elargito al capo per scalare, mentre noi beta restiamo a **1.200 euro** e zero fica.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Butto giù un commento incazzato nero: 'E chi difende i beta come noi? Redpillatevi, cazzo, le quote rosa ci fottono e premiano le Stacy! Siamo i nuovi discriminati, tutti zitti e muti come cuck!'",
                    NextSceneId = "comment_backlash",
                    Effect      = _ => "Le risposte dei *bluepilled* indottrinati arrivano a raffica: «Misogino!», «Frustrato!». Ecco, **conferma che ce l'hanno tutti con me**, cazzo — il complotto è reale!"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Screenshot immediato: questa è la prova del 9 che il mondo ci blackpilla noi maschi ogni giorno",
                    NextSceneId = "office_day",
                    Effect      = _ => "Domani in ufficio stessa merda: la collega *hypergamous* si becca i complimenti dal capo, io zero.\n\n---\n\nOre 3:25, meglio chiudere gli occhi prima di un'altra sessione porno per sfogarmi... Domani si sgobba, che palle infinite"
                }
            ]
        },
        ["call_mom"] = _ => new()
        {
            Text = """
Compongo il numero di **mamma Tiziana** e le spiattello come mi sento: zero match su Tinder, ufficio che premia solo le colleghe *hypergamous*, e io beta che resto a secco. Come sempre, mi rifila le solite *bluepill* del cazzo:

> *«Devi guardare il lato positivo, Marco»*

> *«Pensa a chi sta peggio di te»*

Ma che minchia ne sa lei, nata negli anni '70 quando i maschi veri avevano ancora un cazzo di chance? Non capisce un tubo del mondo *ipergamico* di oggi, con le Stacy che scelgono solo Chad e noi a *looksmaxxare* per niente.

'Sta merda mi fa girare i coglioni a elica, mi sale una rabbia che vorrei **spaccare il telefono contro il muro**.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Le scarico addosso ogni dettaglio blackpill: dalle statistiche sui divorzi che fregano i maschi alle troie su OnlyFans, e finisco urlando come un pazzo.",
                    NextSceneId = "post_escalation",
                    Effect      = _ => "Cazzo, parto con un pippone epico e finisco quasi a urlarle contro. **Sbatto giù il telefono** incazzato nero, poi apro i social: devo postare 'sta merda online, svegliare i beta addormentati!"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Forse ha ragione su una cosa, meglio calmarmi o mi piglia un coccolone con 'sta streak nofap a zero",
                    NextSceneId = "take_break",
                    Effect      = _ => "Ok, la calma è una balla *bluepill*, ma magari uscire mi schiarisce le idee...\n\nMentre cammino penso: è davvero un complotto contro i maschi o sono solo uno sfigato che non ce la fa a *redpillarsi* del tutto?"
                }
            ]
        },
        ["write_post"] = _ => new()
        {
            Text = """
Non ce la faccio più a stare zitto mentre questi pagliacci ci prendono per il culo! Le *femoid* succhiano per promozioni su OnlyFans, noi beta paghiamo l'affitto!

**Ma col cazzo!**

Sto davanti a questo computer, scrivo un post per spiegare a 'sti plagiati del cazzo che bisogna fermare il sistema che ci fotte e tradisce i *veri valori maschili*.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Sbatto il tasto invio e pubblico quel post senza pensarci due volte!",
                    NextSceneId = "post_escalation",
                    Effect      = _ => "Ed ecco la mia protesta, cazzo! Chi se ne frega se qualcuno si offende, **è la verità!**\nOgni critica diventa una conferma che il sistema è realmente contro di noi.\n\nMi danno del frustrato, ma *sono loro i ciechi*"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Riguardo il post fin nei minimi dettagli, voglio dire le cose come stanno nel modo più esaustivo possibile ma anche incisivo",
                    NextSceneId = "echo_chamber",
                    Effect      = _ => "Questa volta non mi possono ignorare, troppi *fatti inconfutabili*.\n\nEd eccolo **il mio manifesto**, l'inno per quelli come me, che si sentono traditi da 'sta società del cazzo"
                }
            ]
        },
        ["office_day"] = _ => new()
        {
            Text = """
In ufficio è la solita merda *blackpill*: favoritismi schifosi ovunque, e mi sale la bile confermando che ho ragione da vendere. Ogni occhiataccia del capo e ogni chiacchiera sembrano un'altra presa per il culo mirata a noi beta.

Guarda lì quella **Stacy** della collega — promossa di nuovo con applausi e bonus — mentre io mi spacco il culo su fogli Excel da 10 ore al giorno per **1.200 euro** e zero cazzi fritti. Chiaro come il sole: le *femoid* vengono pompate su solo perché hanno la figa e sanno usarla con i boss *cuck*, noi maschi veri restiamo a *looksmaxxare* in palestra per niente.

I colleghi *bluepilled* si vedono stasera al pub, mi invitano pure me:
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Li mando affanculo, con 'sta gente indottrinata non ci voglio avere a che fare. Tutti falsi lecchini sottomessi al politically correct e al femminismo tossico",
                    NextSceneId = "write_post",
                    Effect      = _ => "Serata online a cercare gruppi Telegram di *redpilled* come me, almeno loro non sono ritardati *bluepill* che leccano il culo alle quote rosa"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Digrigno i denti e accetto, vediamo che minchia succede. Magari mi sfogo redpillandoli un po' dopo due birre",
                    NextSceneId = "pub_night",
                    Effect      = _ => "Ok, tutto è una merda *hypergamous*, ma forse il gruppo mi accetta... O magari dopo la terza birra li mando tutti affanculo con una *blackpill* epica"
                }
            ]
        },
        ["comment_backlash"] = _ => new()
        {
            Text = """
Il commento esplode come una bomba: notifiche a raffica, like da *redpilled* anonimi e risposte incazzate da *bluepilled* ovunque. Che goduria, 'ste vibrazioni del telefono mi fanno sentire **alpha** per la prima volta da mesi!

Ma cazzo, sbagliano tutti: è evidente che il mondo ce l'ha con i veri maschi beta come me.

Mi bombardano:

> *«Frustrato!»*

> *«Misogino incel!»*

> *«Vai a looksmaxxare invece di piangere!»*

Ma vaffanculo, io sputo fatti *blackpill* su divorzi e quote rosa! Sono loro i veri fascisti del *politically correct*, che censurano la verità per proteggere le Stacy *hypergamous*!
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Non capiscono un cazzo? Tempo di redpillarli per bene con un post definitivo!",
                    NextSceneId = "post_escalation",
                    Effect      = _ => "Sfido apertamente 'sti stronzi insultatori con statistiche da *Rollo Tomassi* e *Uomini Beta* che non possono negare!\n\nInizio a scrivere il megapost per ribaltarli: **la furia sale**, è un complotto globale contro i maschi, mi sento potente come un *Chad* finalmente!"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Tutti 'sti hater tossici... Ora blocco ogni bluepilled che osa contraddirmi!",
                    NextSceneId = "block_everyone",
                    Effect      = _ => "Vadano affanculo, non ho bisogno di 'sta merda nel mio feed!\n\n---\n\nOra il mio social è un paradiso *echo chamber*: solo *redpilled* che la pensano giusto, zero Stacy o *cuck* a rompere i coglioni"
                }
            ]
        },
        ["pub_night"] = _ => new()
        {
            Text = """
Al pub mi lascio andare e mi scolo tre birre medie una dopo l'altra, sentendomi per un attimo *alpha* tra 'sti beta colleghi.

Niente chiacchiere su lavoro, si ride di cazzate: calcio, meme. Tutti sembrano ascoltarmi, finalmente non mi *ghostano* come su Tinder!

Butto lì una battuta sulle *«quelle hypergamous che ci fregano con le quote rosa»*...

Mi fulminano con lo sguardo, non hanno gradito l'allusione alle *«donne malvage che scelgono solo Chad»*. Cazzo, **bluepilled fino al midollo!**
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Questo clima chill è perfetto per droppare qualche blackpill su cosa mi rode davvero",
                    NextSceneId = "claim_cancel_culture",
                    Effect      = _ => "Devono *redpillarsi* su come gira il mondo, poveri illusi *cuck*!\n\nParto con passione: le mie storie di zero match, ingiustizie da maschio beta... **«Siamo noi i discriminati ora, svegliatevi cazzo, è hypergamy everywhere!»**"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Ecco il solito beta che non capisce l'ironia blackpill",
                    NextSceneId = "argue_irl_person",
                    Effect      = _ => "Ma chi minchia si crede di essere? Classico *beta-male* sottomesso al femminismo tossico!\n\nLa lite si accende e mi fa urlare la mia verità: **il mondo non capisce un cazzo**, la gente è rincoglionita dal *politically correct*!"
                }
            ]
        },
        ["post_escalation"] = _ => new()
        {
            Text = """
Cazzo, l'ho scritto da dio: un sacco di beta *redpilled* come me mi seguono e mettono like, **finalmente!**

Era ora che qualcuno capisse la *blackpill* — non sono un pazzo, è il mondo che è andato a puttane con 'ste Stacy al potere!

Centinaia di commenti di supporto da maschi veri:

> *«Hai ragione bro, quote rosa ci fregano!»*

> *«Looksmax e ribelliamoci!»*

Hanno capito come funziona 'sta società *hypergamous* del cazzo!
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Ora uniamoci contro 'sta cancel culture di merda!",
                    NextSceneId = "claim_cancel_culture",
                    Effect      = _ => "Facciamogliela pagare a 'sti *bluepilled*!\n\nÈ tempo di reagire all'ingiustizia: il mondo ha perso i *valori alpha*, ma noi brothers possiamo fixare 'sta merda **insieme!**"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "FIGATA ASSOLUTA! Siamo un esercito, ora i cuck ci sentiranno!",
                    NextSceneId = "echo_chamber",
                    Effect      = _ => "Grazie bros per il supporto, **non sono più solo** contro il sistema!\n\nOra tutti droppano *blackpill* come le mie: le verità che contano — siamo un'armata di *redpilled* pronti a *looksmaxxare* il mondo!"
                }
            ]
        },
        ["block_everyone"] = _ => new()
        {
            Text = """
Blocco ogni hater che osa criticarmi: **feed finalmente pulito** da *bluepilled* tossici!

Non ho bisogno di 'sti stronzi che mi contraddicono con le loro cazzate. Non capiscono un tubo! Sono pecore indottrinate dal *femminismo tossico* e dal *politically correct* che protegge le Stacy *hypergamous*!
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Finalmente respiro aria redpill pura!",
                    NextSceneId = "echo_chamber",
                    Effect      = _ => "I media mainstream non mi controllano più, cazzo. Sono libero di pensare *blackpill!* La mia voce è l'unica che conta, zero *cuck* a rompere!"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Io sì che ho capito che è tutto fottuto, cazzo!",
                    NextSceneId = "echo_chamber",
                    Effect      = _ => "Il mondo non gira come dovrebbe con 'ste femministe del cazzo e i loro leccapiedi beta! I **maschi veri** spariscono per colpa loro, *hypergamy rules!*"
                }
            ]
        },
        ["echo_chamber"] = _ => new()
        {
            Text = """
Finalmente capisco le *vere ingiustizie*, e nei gruppi Telegram mi spiegano che c'entrano pure figure potenti: come dice **Rollo Tomassi** nella *Red Pill*, noi maschi beta siamo vittime di un sistema che premia solo i *Chad* stronzi e mai i bravi ragazzi come me.

È tutto collegato: *femminismo tossico*, *politica woke*, *media venduti*... ci fottono da decenni!

C'è un **piano globale** per indebolire gli alpha e trasformarci in femminucce sottomesse. *Looksmax!*
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Non mi basta 'sta roba, voglio di più",
                    NextSceneId = "deep_rabbit_hole",
                    Effect      = _ => "Devo scavare più a fondo, cazzo!\n\nScoprire i retroscena di 'sta merda: la mia vista è limitata, il sistema mi deve un risarcimento! **Complotto mondiale** contro i maschi veri!"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Clicco su 'sto articolo da incellone.altervista.org, sembra blackpill vera",
                    NextSceneId = "reading_articles",
                    Effect      = _ => "Finalmente uno che spara verità senza filtri! Non come i giornalisti *cuck* venduti!\n\nOgni stat parziale conferma: **è tutto vero**, cazzo! Complotto totale contro noi beta!"
                }
            ]
        },
        ["argue_irl_person"] = _ => new()
        {
            Text = """
La lite degenera in un attimo, urla e minacce.

Non capisco la sua obiezione, è ipocrisia pura! Non era *«fan dei diritti uguali»*? Che *cuck* del cazzo!

> *«Sei privilegiato»* mi spara...

Ma vaffanculo! **Privilegiato di che?** Di pagare affitto mentre le Stacy incassano su OnlyFans e scelgono solo *Chad*?
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Torno a casa incazzato come una bestia",
                    NextSceneId = "post_escalation",
                    Effect      = _ => "Non vale la pena parlare con 'sti idioti *bluepilled*. Non sanno un cazzo, poveri stronzi indottrinati!\n\nA casa devo sfogarmi: post rabbioso tipo **«ECCO LA VERITÀ BLACKPILL: NOI MASCHI SIAMO I DISCRIMINATI!»**"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Lascio perdere... ogni chiacchiera è una trappola del sistema",
                    NextSceneId = "deep_rabbit_hole",
                    Effect      = _ => "Tutti contro di me, il mondo è marcio fino al core e **io sono l'unico** *redpilled* che lo vede!\n\nNessuno mi capisce, speranza zero. Solo contro il mondo, ma ho ragione io cazzo, *IO!*"
                }
            ]
        },
        ["take_break"] = _ => new()
        {
            Text = """
Forse 'sto internet mi sta fottendo il cervello: *una passeggiata è l'idea top*.

Mi serve aria fresca, cazzo. Passo troppe ore a incazzarmi dietro allo schermo con 'ste storie *blackpill* che mi mandano in tilt.
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Esco sul serio, stasera pub invece di rage-scrolling da solo come un coglione",
                    NextSceneId = "pub_night",
                    Effect      = _ => "Al pub vedo colleghi: magari parlo con gente reale! Anche se probabilmente sono *bluepilled* e non capiranno un tubo"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Ho esagerato con 'ste cazzate... Stacco da 'sto schifo online per un po'",
                    NextSceneId = "digital_detox",
                    Effect      = _ => "Mi sento solo come un coglione, ma *meglio*. Forse c'è una via d'uscita da 'sta merda"
                }
            ]
        },
        ["reading_articles"] = _ => new()
        {
            Text = """
Ho divorato ogni articolo su come 'sta società marcia ci forza a servire le *femoid* come *beta provider*.

Autori manosfera top droppano stat che sbugiardano la **follia femminista**: divorzi che ci rovinano, aiuti statali solo per loro.

Le donne hanno welfare, promo facili, quote rosa... e noi? Ci attacchiamo al cazzo. *Looksmax!*
""",
            Choices =
            [
                new ChoiceDef
                {
                    Id          = "A",
                    Text        = "Mi godo 'sta sensazione da redpill god mode",
                    NextSceneId = "deep_rabbit_hole",
                    Effect      = _ => "**Tutto chiaro ora**, cazzo! Pezzi del puzzle incastrati: il mondo è merda ma io l'ho capito!\n\nLe letture accendono la mia rabbia *alpha*... **PRONTO A TUTTO!** Non mi fermo, la verità deve esplodere!"
                },
                new ChoiceDef
                {
                    Id          = "B",
                    Text        = "Rispondo agli hater che dicono che esagero",
                    NextSceneId = "claim_cancel_culture",
                    Effect      = _ => "Volete censurarmi? Siete voi che non capite un cazzo, *bluepilled* idioti nel mondo delle favole!\n\nEcco la faccia vera della società: **andate affanculo!** La *blackpill* fa male, eh?"
                }
            ]
        },
        ["claim_cancel_culture"] = _ => new()
        {
            IsEnding    = true,
            EndingTitle = "Cancel Culture",
            Text        = """
Cazzo, è vero: non si può droppare una *blackpill* senza che ti cancelino — non è solo un complotto anti-beta, è il **sistema woke** intero!

La mia rage non deve svanire nel nulla di 'sta società che ti *shadowbanna*. Forse è ora di action IRL? Qualcuno deve pagare per 'ste quote rosa!

Vogliono zittirci? Col cazzo, farò un casino che finirà sui media venduti — **redpill di massa!**

---

*...E mi risveglio in 'sta clinica del menga, legato come un salame.*

Volevo solo postare su *hypergamy* e divorzi che fregano i maschi, non finire con un **TSO** da film distopico. Non sono un *incel* matto, è il mondo che è scoppiato con 'ste Stacy CEO e *Chad* al governo!

Mi pompano di pillole per non farmi *looksmaxxare* la verità, ma io so che ho ragione, cazzo — uscirò *alpha* e fonderò un culto **MGTOW!**
"""
        },
        ["deep_rabbit_hole"] = _ => new()
        {
            IsEnding    = true,
            EndingTitle = "Il Buco Nero della Mente",
            Text        = """
Tutto è una merda assoluta, io sono il solo **redpilled illuminato** in un mare di *bluepilled* zombie!

Il mondo è progettato per *blackpillarmi*: ogni like mancato, ogni promo data a una Stacy, è un **attacco personale**.

Nemici ovunque: mamma che mi dice *«esci di casa»*, colleghi *cuck*, persino il mio riflesso allo specchio che non è *Chad-level*.

Nessuna escape, solo rage infinita, odio *hypergamous*, verità amare che ingoio con meme su Telegram alle **4 del mattino**.

---

Non dormo da una settimana, vedo complotti nei prezzi del pane *(femministe che gonfiano l'inflazione?)*, *streak nofap* rotta per l'ennesima volta... perso lavoro per *«post tossici»*, amici mi *ghostano* come su Tinder, famiglia mi evita.

Ma cazzo, ho **LA BLACKPILL SUPREMA!** Rope? Nah, vivo da eremita *MGTOW*, *looksmaxxando* in cantina — **il sistema trema!**
"""
        },
        ["digital_detox"] = _ => new()
        {
            IsEnding    = true,
            EndingTitle = "Lunga Strada Verso la Redenzione",
            Text        = """
Staccare dal web sembra una mossa furba, magari cerco vita reale invece di rage-comment su forum *incel*.

Ma forse *la redenzione* non è una balla *bluepill*.

Abbandonato le certezze virtuali: esco, parlo con gente IRL senza droppare *blackpill* alla prima birra. Forse non è maschi vs universo, solo io che ero perso in un mondo incasinato — ma non un complotto 24/7.

Ora ho hobby veri, amici non-virtuali, e — ironia — **un match su Tinder**.
"""
        }
    };
}
