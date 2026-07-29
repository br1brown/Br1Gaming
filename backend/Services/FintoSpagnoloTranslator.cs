using System.Text.RegularExpressions;

namespace Backend.Services;

/// <summary>
/// "Finto spagnolo": la parodia algoritmica dello spagnolo come lo immaginano gli italiani —
/// una "s" a fine parola, i "gn" che diventano "ñ", le "-zione"/"-ità" travestite e un pizzico di
/// ¿…? ¡…!. Puramente scherzosa, NON è vero spagnolo. È il gemello C# di <c>finto-spagnolo.ts</c>:
/// la logica vive qui (fonte unica), il frontend la consuma via <see cref="Controllers.BaseController"/>.
/// </summary>
/// <remarks>
/// Lavora parola per parola (le sequenze <c>\p{L}+</c>): spazi, punteggiatura e numeri restano dove
/// sono. Su ogni parola, in ordine: 1) lista di sostituzioni note (come→como, città→ciudad, …), che
/// ha la precedenza e NON riceve la "s"; 2) suffissi "-ità"→"-idad" e "-zione/-zioni"→"-ciones";
/// 3) "gn"→"ñ"; 4) "s impura" (s+consonante a inizio parola → "e" davanti: spagnolo→españolo);
/// 5) la "s" finale (vocale → +s; consonante → ultima vocale + s). Le parole elise dall'apostrofo
/// restano invariate; il case delle parole si preserva, poi <see cref="GeneratorService.CapitalizzaFrasi"/>
/// forza le maiuscole d'inizio frase in base alla punteggiatura; alla fine i ¿/¡ davanti a domande/esclamazioni.
/// </remarks>
public sealed class FintoSpagnoloTranslator
{
    /// <summary>Vocali riconosciute (incluse le accentate più comuni).</summary>
    private const string Vocali = "aeiouàáâäèéêëìíîïòóôöùúûü";

    /// <summary>Parole italiane → corrispettivo spagnolo (o quasi). Precedenza su tutte le regole.</summary>
    private static readonly Dictionary<string, string> Sostituzioni = new(StringComparer.Ordinal)
    {
        // essere / stare ("sono" a parte: dipende dal soggetto → RisolviSono)
        ["sei"] = "eres", ["è"] = "es", ["siamo"] = "somos", ["siete"] = "sois", ["era"] = "era",
        ["sto"] = "estoy", ["stai"] = "estás", ["sta"] = "está", ["stiamo"] = "estamos", ["stanno"] = "están",
        // avere
        ["ho"] = "tengo", ["hai"] = "tienes", ["ha"] = "tiene", ["abbiamo"] = "tenemos", ["hanno"] = "tienen",
        // andare / venire / fare
        ["vado"] = "voy", ["vai"] = "vas", ["va"] = "va", ["andiamo"] = "vamos", ["andare"] = "ir", ["vieni"] = "ven",
        ["faccio"] = "hago", ["fai"] = "haces", ["fa"] = "hace", ["fare"] = "hacer", ["facciamo"] = "hacemos",
        // volere / potere / dovere
        ["voglio"] = "quiero", ["vuoi"] = "quieres", ["posso"] = "puedo", ["puoi"] = "puedes", ["devo"] = "debo",
        ["volere"] = "querer", ["potere"] = "poder", ["capire"] = "entender",
        // pronomi
        ["io"] = "yo", ["tu"] = "tú", ["lui"] = "él", ["lei"] = "ella", ["noi"] = "nosotros", ["voi"] = "vosotros", ["loro"] = "ellos",
        ["mi"] = "me", ["ti"] = "te", ["ci"] = "nos", ["vi"] = "os", ["me"] = "mí", ["te"] = "ti",
        // articoli
        ["il"] = "el", ["lo"] = "lo", ["la"] = "la", ["i"] = "los", ["gli"] = "los", ["le"] = "las",
        ["un"] = "un", ["uno"] = "un", ["una"] = "una",
        // preposizioni semplici
        ["in"] = "en", ["di"] = "de", ["da"] = "de", ["tra"] = "entre", ["fra"] = "entre",
        ["con"] = "con", ["per"] = "por", ["su"] = "sobre", ["a"] = "a",
        // preposizioni articolate (mappate a mano)
        ["al"] = "al", ["allo"] = "al", ["alla"] = "a la", ["ai"] = "a los", ["agli"] = "a los", ["alle"] = "a las",
        ["del"] = "del", ["dello"] = "del", ["della"] = "de la", ["dei"] = "de los", ["degli"] = "de los", ["delle"] = "de las",
        ["dal"] = "del", ["dallo"] = "del", ["dalla"] = "de la", ["dai"] = "de los", ["dagli"] = "de los", ["dalle"] = "de las",
        ["nel"] = "en el", ["nello"] = "en el", ["nella"] = "en la", ["nei"] = "en los", ["negli"] = "en los", ["nelle"] = "en las",
        ["sul"] = "sobre el", ["sullo"] = "sobre el", ["sulla"] = "sobre la", ["sui"] = "sobre los", ["sugli"] = "sobre los", ["sulle"] = "sobre las",
        ["col"] = "con el", ["coi"] = "con los",
        // possessivi
        ["mio"] = "mi", ["mia"] = "mi", ["miei"] = "mis", ["mie"] = "mis", ["tuo"] = "tu", ["tua"] = "tu", ["tuoi"] = "tus", ["tue"] = "tus",
        ["suo"] = "su", ["sua"] = "su", ["suoi"] = "sus", ["sue"] = "sus",
        ["nostro"] = "nuestro", ["nostra"] = "nuestra", ["nostri"] = "nuestros", ["nostre"] = "nuestras",
        ["vostro"] = "vuestro", ["vostra"] = "vuestra", ["vostri"] = "vuestros", ["vostre"] = "vuestras",
        // congiunzioni / avverbi
        ["e"] = "y", ["o"] = "o", ["ma"] = "pero", ["che"] = "que", ["ché"] = "que", ["chi"] = "quién", ["come"] = "como",
        ["perché"] = "porque", ["perche"] = "porque", ["più"] = "mas", ["piu"] = "mas",
        ["anche"] = "también", ["sempre"] = "siempre", ["mai"] = "nunca", ["forse"] = "quizás", ["poi"] = "luego",
        ["niente"] = "nada", ["molto"] = "muy", ["troppo"] = "mucho", ["poco"] = "poco", ["tutto"] = "todo",
        ["bene"] = "bien", ["male"] = "mal", ["sì"] = "sí", ["si"] = "sí", ["no"] = "no", ["non"] = "no", ["già"] = "ya",
        ["oggi"] = "hoy", ["ieri"] = "ayer", ["adesso"] = "ahora", ["ora"] = "ahora",
        ["qui"] = "aquí", ["qua"] = "acá", ["dove"] = "dónde", ["quando"] = "cuándo", ["quanto"] = "cuánto",
        // dimostrativi
        ["questo"] = "esto", ["questa"] = "esta", ["questi"] = "estos", ["queste"] = "estas",
        ["quello"] = "aquel", ["quella"] = "aquella",
        // saluti / cortesia
        ["ciao"] = "hola", ["salve"] = "hola", ["arrivederci"] = "adiós", ["grazie"] = "gracias", ["prego"] = "de nada",
        ["buongiorno"] = "buenos días", ["buonasera"] = "buenas tardes", ["buonanotte"] = "buenas noches",
        ["buono"] = "bueno", ["buon"] = "buen", ["buona"] = "buena", ["buoni"] = "buenos", ["buone"] = "buenas",
        ["favore"] = "favor",
        // sostantivi / aggettivi / verbi comuni
        ["uomo"] = "hombre", ["donna"] = "mujer", ["maschio"] = "macho", ["ragazzo"] = "chico", ["ragazza"] = "chica",
        ["amico"] = "amigo", ["amica"] = "amiga", ["gente"] = "gente", ["famiglia"] = "familia", ["persona"] = "persona",
        ["lavoro"] = "trabajo", ["lavorare"] = "trabajar", ["parlo"] = "hablo", ["parlare"] = "hablar",
        ["tempo"] = "tiempo", ["acqua"] = "agua", ["cibo"] = "comida", ["mangiare"] = "comer", ["bere"] = "beber",
        ["cane"] = "perro", ["gatto"] = "gato", ["bambino"] = "niño", ["bambina"] = "niña", ["bambini"] = "niños",
        ["festa"] = "fiesta", ["notte"] = "noche", ["giorno"] = "día", ["mare"] = "mar",
        ["scuola"] = "escuela", ["auto"] = "coche", ["autobus"] = "autobús",
        ["soldi"] = "dinero", ["strada"] = "calle", ["casa"] = "casa", ["cuore"] = "corazón",
        ["signore"] = "señor", ["signora"] = "señora", ["signorina"] = "señorita",
        ["bello"] = "bonito", ["bella"] = "bonita", ["brutto"] = "feo", ["piccolo"] = "pequeño", ["grande"] = "grande", ["caldo"] = "calor",
        // irregolari in "-tà" che la regola "-ità" non prende
        ["città"] = "ciudad", ["società"] = "sociedad", ["libertà"] = "libertad",
        ["età"] = "edad", ["metà"] = "mitad", ["realtà"] = "realidad",
    };

    /// <summary>Possessivi che, in spagnolo, mangiano l'articolo davanti (il mio → mi, le mie → mis).</summary>
    private const string Possessivi =
        "mio|mia|miei|mie|tuo|tua|tuoi|tue|suo|sua|suoi|sue|nostro|nostra|nostri|nostre|vostro|vostra|vostri|vostre";

    /// <summary>Preposizione articolata → preposizione semplice italiana (per il caso "articolata + possessivo").</summary>
    private static readonly Dictionary<string, string> PrepSemplice = new(StringComparer.Ordinal)
    {
        ["al"] = "a", ["allo"] = "a", ["alla"] = "a", ["ai"] = "a", ["agli"] = "a", ["alle"] = "a",
        ["del"] = "di", ["dello"] = "di", ["della"] = "di", ["dei"] = "di", ["degli"] = "di", ["delle"] = "di",
        ["dal"] = "da", ["dallo"] = "da", ["dalla"] = "da", ["dai"] = "da", ["dagli"] = "da", ["dalle"] = "da",
        ["nel"] = "in", ["nello"] = "in", ["nella"] = "in", ["nei"] = "in", ["negli"] = "in", ["nelle"] = "in",
        ["sul"] = "su", ["sullo"] = "su", ["sulla"] = "su", ["sui"] = "su", ["sugli"] = "su", ["sulle"] = "su",
        ["col"] = "con", ["coi"] = "con",
    };

    /// <summary>Tetto di caratteri tradotti in una volta: oltre, si tronca (protegge l'endpoint da input enormi).</summary>
    public const int MaxCaratteri = 13000;

    private const RegexOptions Opt = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

    private static readonly Regex ReArticoloPossessivo =
        new($@"\b(il|lo|la|i|gli|le)\s+({Possessivi})\b", Opt);
    private static readonly Regex RePrepPossessivo =
        new($@"\b({string.Join("|", PrepSemplice.Keys)})\s+({Possessivi})\b", Opt);
    private static readonly Regex ReParola = new(@"\p{L}+", RegexOptions.CultureInvariant);
    private static readonly Regex ReFrase = new(@"[^.!?¿¡\n]*[!?]+", RegexOptions.CultureInvariant);
    private static readonly Regex RePrecedente = new(@"(\p{L}+)['’]?\s*$", RegexOptions.CultureInvariant);

    /// <summary>Traduce un testo italiano nel "finto spagnolo".</summary>
    public string Translate(string? testo)
    {
        if (string.IsNullOrEmpty(testo)) return string.Empty;

        testo = TroncaAllaParola(testo, MaxCaratteri);
        var preparato = TogliArticoloPossessivo(testo);
        var tradotto = ReParola.Replace(preparato, m =>
        {
            var parola = m.Value;
            var fine = m.Index + parola.Length;
            var dopo = fine < preparato.Length ? preparato[fine] : '\0';
            if (dopo == '\'' || dopo == '’') return parola;   // elisione: l', d', dell', un'…
            if (string.Equals(parola, "sono", StringComparison.OrdinalIgnoreCase))
            {
                var prec = RePrecedente.Match(preparato[..m.Index]);
                return RisolviSono(parola, prec.Success ? prec.Groups[1].Value : null);
            }
            return TrasformaParola(parola);
        });
        // Riusa l'armonizzatore dei generatori: forza le maiuscole d'inizio frase in base alla punteggiatura
        // (così anche un input tutto minuscolo esce "autentico"), senza toccare le maiuscole interne. Prima
        // dell'inversione, così i ¿/¡ anteposti restano davanti alla lettera già capitalizzata.
        var capitalizzato = GeneratorService.CapitalizzaFrasi(tradotto);
        return InvertiPunteggiatura(capitalizzato);
    }

    /// <summary>Se il testo supera <paramref name="max"/> caratteri, taglia all'ultima parola intera (niente parole spezzate).</summary>
    private static string TroncaAllaParola(string testo, int max)
    {
        if (testo.Length <= max) return testo;
        var tagliato = testo[..max];
        var ultimoSpazio = tagliato.LastIndexOfAny(new[] { ' ', '\n', '\r', '\t' });
        return ultimoSpazio > 0 ? tagliato[..ultimoSpazio] : tagliato;
    }

    private static bool IsVocale(char ch) => Vocali.Contains(char.ToLowerInvariant(ch));

    /// <summary>Ricopia il "case" dell'originale sulla parola trasformata (TUTTO MAIUSCOLO, Iniziale, minuscolo).</summary>
    private static string ApplicaCase(string originale, string trasformata)
    {
        if (string.IsNullOrEmpty(trasformata)) return trasformata;
        if (originale.Length > 1 && originale == originale.ToUpperInvariant()) return trasformata.ToUpperInvariant();
        if (originale[0] == char.ToUpperInvariant(originale[0]))
            return char.ToUpperInvariant(trasformata[0]) + trasformata[1..];
        return trasformata;
    }

    /// <summary>Aggiunge la "s" finale (vocale → +s; consonante → ultima vocale + s; senza vocali → +s).</summary>
    private static string AggiungiEsse(string parola)
    {
        if (IsVocale(parola[^1])) return parola + "s";
        for (var i = parola.Length - 1; i >= 0; i--)
            if (IsVocale(parola[i])) return parola + parola[i] + "s";
        return parola + "s";
    }

    /// <summary>Trasforma una parola (sostituzione → suffissi → gn/ñ → s impura → s finale).</summary>
    private static string TrasformaParola(string parola)
    {
        var lower = parola.ToLowerInvariant();
        if (Sostituzioni.TryGetValue(lower, out var sost)) return ApplicaCase(parola, sost);

        var core = lower;
        var fatta = false;
        if (core.EndsWith("ità", StringComparison.Ordinal))
        {
            core = string.Concat(core.AsSpan(0, core.Length - 3), "idad");
            fatta = true;
        }
        else if (core.EndsWith("zione", StringComparison.Ordinal) || core.EndsWith("zioni", StringComparison.Ordinal))
        {
            core = string.Concat(core.AsSpan(0, core.Length - 5), "ciones");
            fatta = true;
        }

        core = core.Replace("gn", "ñ", StringComparison.Ordinal);
        if (core.Length >= 2 && core[0] == 's' && !IsVocale(core[1])) core = "e" + core;
        if (!fatta) core = AggiungiEsse(core);
        return ApplicaCase(parola, core);
    }

    /// <summary>Toglie l'articolo davanti a un possessivo (il mio→mio) e appiattisce le articolate (sulla sua→su sua).</summary>
    private static string TogliArticoloPossessivo(string testo)
    {
        static string ConMaiuscola(string fonte, string parola) =>
            fonte[0] == char.ToUpperInvariant(fonte[0]) ? char.ToUpperInvariant(parola[0]) + parola[1..] : parola;

        var senzaArticolo = ReArticoloPossessivo.Replace(testo, m => ConMaiuscola(m.Groups[1].Value, m.Groups[2].Value));
        return RePrepPossessivo.Replace(senzaArticolo, m =>
            $"{ConMaiuscola(m.Groups[1].Value, PrepSemplice[m.Groups[1].Value.ToLowerInvariant()])} {m.Groups[2].Value}");
    }

    /// <summary>"io sono" → soy, tutto il resto → son.</summary>
    private static string RisolviSono(string parola, string? prima) =>
        ApplicaCase(parola, string.Equals(prima, "io", StringComparison.OrdinalIgnoreCase) ? "soy" : "son");

    /// <summary>Antepone ¿ alle domande e ¡ alle esclamazioni, frase per frase.</summary>
    private static string InvertiPunteggiatura(string testo) => ReFrase.Replace(testo, m =>
    {
        var segmento = m.Value;
        var spazi = Regex.Match(segmento, @"^\s*").Value;
        var corpo = segmento[spazi.Length..];
        if (!Regex.IsMatch(corpo, @"\p{L}")) return segmento;
        var segno = corpo.Contains('?') ? "¿" : "¡";
        return spazi + segno + corpo;
    });
}
