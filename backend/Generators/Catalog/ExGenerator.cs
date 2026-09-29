using Nome = Backend.Generators.SharedContent.Nome;
using City = Backend.Generators.SharedContent.City;
using Social = Backend.Generators.SharedContent.Social;
using TimeSlot = Backend.Generators.SharedContent.TimeSlot;

namespace Backend.Generators.Catalog;

public sealed class ExGenerator : GeneratorBase
{
    // Posti "appartati": ogni voce porta già la preposizione (come i Luoghi di ComplottoGenerator),
    // così {Luoghi} si usa nudo in posizione di complemento mai come soggetto di una frase.
    internal static readonly Tag Luoghi = new("luoghi_ex")
    {
        new($"in un bar chiamato «{Genera("locali")}» a {City.Any} dove non prende il telefono l'ho già controllato apposta", 4),
        new($"nel parco giochi dove andavi da bambina «tranquilla, ci sono i bambini, cosa vuoi che succeda»", 4),
        ("a casa mia, «tanto i vicini a quest'ora dormono»", 4),
        ("sotto casa tua, in macchina con le luci spente «così non ci vede nessuno»", 5),
        new($"in un locale di {City.Any} che ho scelto su Google Maps cercando \"posti isolati\"", 5),
        new($"nel parcheggio del centro commerciale di {City.Any} dove vi siete lasciati, ma stavolta {TimeSlot.Notte}", 4),
        new($"in un bar chiamato «{Genera("locali")}» a {City.Any} dove lavora un mio amico, così se serve un testimone ce l'ho già pronto", 4),
        ("in un posto \"neutro\" scelto da me, comunicato solo all'ultimo per email di sicurezza", 3),
        ("nel retro del locale dove vi siete conosciuti, chiuso al pubblico apposta per l'occasione", 4),
        new($"su un sentiero del parco di {City.Any} senza telecamere ho verificato di persona", 5),
    };

    // Le "scuse": sproporzionate per costruzione, mai un motivo plausibile e basta. Frasi complete in
    // prima persona: si usano SOLE, mai spezzate a metà da un predicato che segue.
    internal static readonly Tag Scuse = new("scuse_ex")
    {
        ("Ti ho tradita mentre eri in ospedale, ma giuro che è stato \"un momento di debolezza\"", 6),
        new($"Ti ho bloccata ovunque per {3..9} mesi e ora ti scrivo come se fosse passato un weekend", 5),
        ("Ho detto a tutti gli amici comuni che la pazza eri tu", 5),
        ("Ho messo like alla proposta di matrimonio della mia nuova storia mentre ti scrivevo di notte", 5),
        new($"Ho venduto il nostro gatto senza dirtelo e per {2..4} anni ho detto che era scappato", 5),
        new($"Ho dimenticato il tuo compleanno {2..4} anni di fila e ora me ne pento pubblicamente su Instagram con una storia da {5..9} slide", 4),
        ("Ti ho ghostata il giorno dopo averti chiesto di trasferirti per me", 4),
        new($"Ho raccontato ai comuni amici una versione della rottura in cui io sono la vittima, per {6..14} mesi di fila", 5),
        ("Ho continuato a guardare le tue storie da un profilo falso mentre ti dicevo di essermi \"fatto una vita\"", 6),
        ("Ho chiesto scusa alla ex prima di te e a quella prima ancora, con lo stesso identico messaggio", 6),
    };

    // Escalation religiosa/da disperato: la "richiesta di preghiera". Frasi complete in prima persona.
    internal static readonly Tag Preghiera = new("preghiera_ex")
    {
        ("Ti prego in ginocchio, ho pure acceso una candela in chiesa stamattina", 5),
        ("Ho promesso a Dio che se rispondi cambio vita da domani", 4),
        ("Ho chiesto la benedizione di don Franco apposta per questo messaggio", 5),
        ("Ti scongiuro sulla tomba di mio nonno (che sta benissimo, l'ho sentito ieri)", 5),
        ("Ho fatto una novena di nove giorni solo per trovare il coraggio di scriverti", 4),
        new($"Giuro sulla Madonna che stavolta è diverso, come le altre {3..6} volte", 5),
        ("Ho promesso al prete di smettere di controllarti i social, appena tu mi rispondi però", 5),
        ("Ho acceso un cero per ogni mese di silenzio, ormai in chiesa mi conoscono di vista", 4),
    };

    // Buoni propositi che durano il tempo di scriverli: il "sono cambiato" smontato dal dettaglio.
    // Frasi complete in prima persona.
    internal static readonly Tag Promesse = new("promesse_ex")
    {
        ("Giuro che mi sono iscritto in terapia (una seduta finora, ma conta)", 5),
        new($"Mi sono iscritto in palestra apposta per diventare l'uomo che meriti ci sono andato {1..2} volte, ma l'abbonamento dura {6..12} mesi", 4),
        ("Ho cancellato il numero di tutte le altre dal telefono (tranne quelle salvate nel cloud, quelle non contano)", 6),
        new($"Prometto che stavolta ti ascolterò davvero, come nelle altre {2..5} occasioni in cui te l'ho promesso", 5),
        ("Ho buttato la felpa con su scritto \"non sono tossico\" per dimostrarti che sono cambiato", 5),
        new($"Ho iniziato un libro sull'amore consapevole, sono arrivato a pagina {3..12}", 4),
        ("Ho smesso di controllarti i social te lo scrivo tre minuti dopo aver guardato la tua ultima storia", 6),
        ("Ho fatto una lista dei miei difetti e l'ho condivisa su Instagram con l'hashtag #crescitapersonale", 5),
    };

    // Chi gli fa da megafono: la manipolazione funziona meglio con un pubblico che la convalida.
    // Descrizioni della persona (soggetto), non frasi complete: usate come soggetto di un piccolo
    // predicato ("{Testimoni} è d'accordo") o come complemento ("chiedi pure a {Testimoni}").
    internal static readonly Tag Testimoni = new("testimoni_ex")
    {
        ("mia madre, già pronta a giurare che sei stata tu a rovinare tutto", 5),
        ("il mio migliore amico, pronto a confermare qualunque cosa io dica", 5),
        ("mia sorella, che nel gruppo di famiglia ti ha già definita \"quella difficile\"", 5),
        new($"un mio collega, conosciuto da {2..4} settimane ma già aggiornato su tutta la nostra storia", 4),
        ("il barista del bar sotto casa mia, che mi consola ogni sera con la stessa identica versione", 4),
        ("il terapeuta di mio cugino, sentito una volta per un \"parere spassionato\"", 5),
        ("il gruppo WhatsApp dei miei amici, che vota se devo scriverti o no", 5),
    };

    // Le ammissioni di controllo: mai un metodo vero, solo il dettaglio patetico che si autodenuncia.
    // Frasi complete in prima persona.
    internal static readonly Tag SegnaliControllo = new("segnali_controllo_ex")
    {
        ("Ho già chiesto a tua madre il tuo nuovo indirizzo, solo per mandarti un fiore, tranquilla", 6),
        ("So che uscirai sabato perché seguo l'amica di un'amica che ha commentato il tuo post", 5),
        ("Ho salvato tutte le tue vecchie foto in una cartella chiamata \"ricordi\", ordinata per data", 5),
        new($"Controllo il tuo ultimo accesso su WhatsApp {4..14} volte al giorno, ma giuro che è solo curiosità", 5),
        ("Ho notato che hai cambiato la foto profilo tre giorni fa e ci ho scritto una poesia", 5),
        new($"So a che ora esci dal lavoro perché me l'hai detto tu, {2..3} anni fa, una volta sola", 5),
        ("Ho un promemoria sul telefono per ogni nostro anniversario, compresi quelli festeggiati una volta sola", 4),
    };

    /// <inheritdoc />
    public override string Slug => "ex";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new()
    {
        Name = "Il ritorno dell'ex",
        Description = "Messaggi di ex tossici che sono romantici. circa.",
    };

    /// <inheritdoc />
    public override GenerationSettings? PhraseSettings { get; } = new()
    {
        MinPhrases = 1,
        MaxPhrases = 2,
        Separators = [". ", ".\n", ".\n\n"],
        MinScore = 10,
    };

    /// <inheritdoc />
    public override Frase? Apertura => new($"Scusa se ti scrivo, {Nome.F}\n");

    /// <inheritdoc />
    public override Frase? Chiusura =>
        new($"\n\n*(scritto alle {TimeSlot.Notte}, salvato nelle bozze {3..7} volte prima di premere invio)*");

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        new($"{Scuse}. {Preghiera}. Dammi solo {10..20} minuti, vediamoci {Luoghi}", 6),
        new($"{Promesse}. Se non mi credi chiedi pure a {Testimoni}: vediamoci {Luoghi} e te lo dimostro di persona", 6),
        new($"Ho riletto tutte le nostre chat vecchie {TimeSlot.Notte}. {Scuse} {Testimoni} può confermartelo, per questo meritavo una seconda possibilità", 5),
        new($"Non ti chiedo di tornare insieme, ti chiedo solo di vederci {Luoghi}. {Promesse}, e {Testimoni} lo sa già", 6),
        new($"{SegnaliControllo}. {Scuse}. {Preghiera}", 6),
        new($"È colpa tua se sono uscito con la tua migliore amica (mi hai abbandonato tu per primo emotivamente, tipo quella volta che sei andata dal dentista senza avvisarmi) {Testimoni} è d'accordo. {Scuse}. Comunque, {Promesse}", 5),
        new($"Ho parlato con uno psicologo (una volta, ma conta): dice che soffrire così tanto è normale. {Scuse}. {Promesse}, e {Testimoni} era in sala d'attesa e conferma", 6),
        new($"Ti ho scritto una lettera di {2..4} pagine che voglio leggerti di persona {Luoghi}, così nessuno ci disturba. {Preghiera}", 6),
        new($"Se non rispondi capirò che non ti importa più niente di quello che abbiamo passato insieme per {2..7} anni (l'ho scritto anche sotto al tuo ultimo post su {Social.Any}, tanto per sicurezza, e {Testimoni} ha messo like)", 5),
        new($"Ho già prenotato {Luoghi} per dopodomani e ho pure avvisato {Testimoni}, nel caso ti serva un secondo parere. {Promesse}", 6),
        new($"{Scuse}. {Promesse}. {Preghiera}", 5),
        new($"Su {Social.Any} ho visto che sei uscita con delle amiche sabato ({SegnaliControllo}), quindi so che va tutto bene e possiamo vederci {Luoghi} senza problemi", 6),
        new($"{Preghiera}. {Promesse}. E {Testimoni} può giurartelo: se tu almeno provassi a crederci capiresti quanto ci tengo", 5),
        new($"Non è da me chiedere scusa, ma per te faccio un'eccezione: vieni {Luoghi}, {Testimoni} sa che sarà l'ultima volta. {Promesse}", 6),
        new($"{SegnaliControllo}, niente di strano, tranquilla. {Scuse}. {Preghiera}", 6),
        new($"{Scuse}, lo ammetto, ma {Promesse} chiedi pure a {Testimoni} e tu mi conosci meglio di chiunque altro", 5),
        new($"A {City.Any} c'è un posticino che mi hai detto ti piaceva: {Testimoni} dice che dovrei portarti lì. {Preghiera}. Chiudiamo questa storia come si deve, di persona", 5),
        new($"Non dormo da {3..10} giorni pensando a noi ({SegnaliControllo}): l'unico modo per farmi stare meglio è vederti {Luoghi}", 5),
    ];
}
