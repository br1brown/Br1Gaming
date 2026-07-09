
// Alias tipizzato per i contenuti condivisi: niente stringhe magiche nei segnaposto.
using City = Backend.Generators.SharedContent.City;

namespace Backend.Generators.Catalog;

/// <summary>
/// Nomi di kebabbari e locali "stranieri" all'italiana: l'altra faccia del <see cref="LocaliGenerator"/>,
/// con pagina e slug propri come ogni altro generatore. Le parti del nome sono atomiche e si ricombinano:
/// <list type="bullet">
///   <item><c>cibo</c>: gli atomi del menù (Kebab, Doner, Pizza, Shawarma…) che si impilano liberamente,
///         così "[cibo] [cibo]" produce sia accoppiate reali (Doner Kebab, Pizza Kebab) sia ibridi
///         improbabili ma plausibili (Doner Pizza);</item>
///   <item><c>suffisso</c> / <c>prefisso</c>: i contenitori d'insegna (House, Express, Point…) e i
///         qualificatori anteposti (Super, Iper, Planet…);</item>
///   <item><c>aggettivo</c>: la qualità postposta (Buono, Buonissimo, d'Oro…);</item>
///   <item><c>titolare</c> / <c>evocativo</c> / <c>sovrano</c>: toponimi esteri, nomi del
///         titolare (Da Alì Baba), epiteti postposti e la formula "[sovrano] di [cibo]" (Il Mago di Doner);</item>
///   <item><c>pun</c>: insegne-formula (giochi di parole e modi di dire) col cibo a segnaposto (Voglia di
///         [cibo]); la concordanza con "del" è volutamente imperfetta sui femminili (Amici del Pizza) —
///         si parodia il nome italiano coniato da non italiani, la comicità è nel risultato.</item>
/// </list>
/// Alcuni pattern pescano anche la città italiana condivisa <c>[city]</c> (Kebab Milano). Ogni pattern
/// del core compone un singolo nome: senza <c>PhraseSettings</c> il default è una frase sola, come il
/// generatore dei bar italiani.
/// </summary>
public sealed class KebabGenerator : GeneratorBase
{
    // Segnaposto LOCALI tipizzati: la chiave vive qui, liste e frasi referenziano il simbolo.
    // Atomi del menù: si impilano fra loro ("[cibo] [cibo]") e con i contenitori d'insegna. Ogni voce
    // deve leggere bene sia da sola sia incollata a un'altra.
    internal static readonly Tag Cibo = new("cibo")
    {
        ("Kebab", 2),
        ("Doner", 2),
        ("Döner", 2),
        ("Pizza", 2),
        ("Piadina", 2),
        ("Piza", 2),
        ("Köfte", 2),
        ("Shawarma", 2),
        ("Falafel", 2),
        ("Piada", 2),
        ("Durum", 2),
        ("Hamburger", 2),
        ("Kebap", 3),
        ("Arrosticini", 2),
        ("Gyros", 2),
        ("Adana", 3),
    };

    // Contenitori d'insegna postposti: "[cibo] [suffisso]" (Kebab House, Doner Express, Pizza Point).
    internal static readonly Tag Suffisso = new("suffisso")
    {
        ("House", 2),
        ("Express", 2),
        ("Point", 2),
        ("Station", 2),
        ("Land", 2),
        ("Time", 2),
        ("World", 2),
        ("City", 2),
        ("Palace", 2),
        ("Mania", 2),
        ("Center", 2),
        ("Corner", 2),
        ("Zone", 2),
        ("Palast", 3),
        ("Sultanato", 3),
    };

    // Qualificatori anteposti: "[prefisso] [cibo]" deve sempre suonare bene (Super Kebab, Planet Doner).
    internal static readonly Tag Prefisso = new("prefisso")
    {
        ("Super", 2),
        ("Iper", 3),
        ("Mega", 2),
        ("New", 2),
        ("Best", 2),
        ("Old", 2),
        ("Royal", 2),
        ("Master", 2),
        ("Mister", 2),
        ("Planet", 2),
        ("King", 2),
        ("Number One", 3),
        ("Casa", 2),
        ("Turbo", 2),
        ("Big", 2),
        ("Antico", 3),
    };

    // Qualità postposta.
    internal static readonly Tag Aggettivo = new("aggettivo")
    {
        ("Buono", 2),
        ("Buonissimo", 2),
        ("Top", 2),
        ("2", 2),
        ("Number One", 2),
        ("Numero Uno", 2),
        ("Originale", 2),
        ("Tipico", 2),
        ("Speciale", 2),
        ("d'Oro", 2),
        ("Autentico", 2),
        ("Doc", 2),
        ("Extra", 2),
        ("Deluxe", 2),
        ("Family", 2),
    };

    internal static readonly Tag Titolare = new("titolare")
    {
        ("Hassan", 2),
        ("Alì", 2),
        ("Alì Baba", 3),
        ("Hossein", 2),
        ("Mohammed", 2),
        ("Murat", 2),
        ("Mustafa", 2),
        ("Mehmet", 2),
        ("Yusuf", 2),
        ("Khalid", 2),
        ("Demir", 2),
        ("Mido", 2),
        ("Habibi", 2),
        ("Baba", 2),
        ("Kebabci", 2),
    };

    internal static readonly Tag Evocativo = new("evocativo")
    {
        ("King", 2),
        ("Sultan", 2),
        ("Express", 2),
        ("Number One", 2),
        ("Da Asporto", 2),
        ("H24", 3),
        ("Lo Sfizio", 2),
        ("Sapori d'Oriente", 3),
        ("Mille e Una Notte", 3),
        ("del Sultano", 2),
        ("dei Faraoni", 2),
        ("dello Sceicco", 3),
        ("del Bosforo", 3),
        ("delle Piramidi", 3),
        ("di Istanbul", 2),
    };

    internal static readonly Tag Sovrano = new("sovrano")
    {
        ("Re", 2),
        ("Il Re", 2),
        ("Il Sultano", 2),
        ("Il Mago", 2),
        ("Sua Maestà il Re", 3),
        ("L'Imperatore", 2),
        ("Il Califfo", 2),
        ("Lo Sceicco", 2),
        ("Il Faraone", 2),
        ("Il Gran Visir", 3),
        ("Il Boss", 2),
        ("Il Dio", 2),
        ("Sua Altezza", 3),
        ("L'Emiro", 2),
        ("Il Padrone", 2),
    };

    internal static readonly Tag Pun = new("pun")
    {
        ("Abra Kebabra", 3),
        new($"Mamma li Turchi: {Cibo} {Aggettivo}", 3),
        new($"Che {Cibo}", 2),
        new($"Voglia di {Cibo}", 2),
        new($"L'Arte del {Cibo}", 3),
        new($"Amici del {Cibo}", 2),
        new($"Il Paradiso del {Cibo}", 3),
        new($"{Cibo} Therapy {Aggettivo}", 3),
        new($"Mondo {Cibo}", 2),
        new($"Tutto {Cibo}", 2),
        ("Kebabbo Mio", 3),
        ("Obi Wan Kebabi", 4),
        new($"Non Solo {Cibo}", 2),
        new($"{Cibo} & Love", 2),
        new($"La Casa del {Cibo}", 2),
    };


    /// <inheritdoc />
    public override string Slug => "kebab";

    /// <inheritdoc />
    public override GeneratorInfo Info { get; } = new() { Order = 6, Name = "Kebabaro di Fiducia", Description = "Trova il nome del tuo kebabbaro di fiducia, aperto anche fino alle due di notte" };

    /// <inheritdoc />
    public override List<Frase> Core { get; } =
    [
        new($"{Prefisso} {Cibo} {Evocativo}", 2),
        new($"{Cibo} {Cibo} {Aggettivo} {Aggettivo}", 2),
        new($"{Cibo} {Suffisso} {Aggettivo}", 2),
        new($"{Cibo} {Cibo} {Suffisso}", 3),
        new($"{Prefisso} {Cibo} {Suffisso}", 3),
        new($"{Cibo} {Aggettivo}", 2),
        new($"{Cibo} {Cibo} {Aggettivo} {Aggettivo}", 3),
        new($"{Cibo} {City.Any}: {Aggettivo}", 2),
        new($"{Prefisso} {Cibo} in the {City.Any}", 3),
        new($"{Cibo} da {Titolare}: {Evocativo} ", 2),
        new($"{Prefisso} Da {Titolare}: {Pun} ", 2),
        new($"{Cibo} {Evocativo}", 2),
        new($"{Sovrano} di {Cibo}", 3),
        new($"{Pun}", 3),
    ];
}
