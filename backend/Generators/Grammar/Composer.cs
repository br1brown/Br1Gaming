using System.Text;

namespace Backend.Generators.Grammar;

/// <summary>
/// Genera testo da un <see cref="Runtime"/> compilato: seleziona le frasi (iniezione Required + riempimento,
/// rispettando gruppi esclusivi e label uniche) e valuta il loro AST. Rigenera fino alla soglia di peso.
/// Non fa armonizzazione: il testo grezzo torna al chiamante (che applica la passata finale).
/// </summary>
public static class Composer
{
    /// <summary>Tetto di rigenerazioni quando il punteggio non raggiunge <see cref="Runtime.MinScore"/>.</summary>
    private const int MaxComposeAttempts = 30;

    /// <summary>
    /// Genera il testo migliore (rispetto alla soglia) e il suo punteggio. <paramref name="seed"/>
    /// pre-appunta alcune variabili condivise (segnaposto <c>[$chiave]</c>) a valori fissi: è il modo
    /// con cui una VARIANTE del generatore (es. il segno scelto per l'oroscopo) fissa parti del testo
    /// invece di lasciarle al caso. Assente = comportamento normale (tutto pescato a caso).
    /// </summary>
    public static (string Text, double Score) Generate(Runtime rt, Random rng, IReadOnlyDictionary<string, string>? seed = null)
    {
        var best = ComposeOnce(rt, rng, seed);
        for (int attempt = 1; best.Score < rt.MinScore && attempt < MaxComposeAttempts; attempt++)
        {
            var candidate = ComposeOnce(rt, rng, seed);
            if (candidate.Score > best.Score) best = candidate;
        }
        return best;
    }

    /// <summary>
    /// Seleziona le frasi per una singola composizione: prima soddisfa le quote Required, poi riempie
    /// dal Core globale, scartando i candidati in conflitto di gruppo/label. Esposto per la verifica.
    /// </summary>
    public static List<Phrase> Select(Runtime rt, Random rng)
    {
        int n = rt.MinPhrases >= rt.MaxPhrases ? rt.MinPhrases : rng.Next(rt.MinPhrases, rt.MaxPhrases + 1);
        int requiredTotal = rt.Requirements.Sum(r => r.Min);
        if (n < requiredTotal) n = requiredTotal; // anti-strozzamento

        var chosen = new List<Phrase>();
        var texts = new HashSet<string>();
        // Gruppo chiuso → per ogni chiave che l'ha toccato, se TUTTE le occorrenze erano Fissato.
        var closedGroups = new Dictionary<string, Dictionary<string, bool>>();
        var usedLabels = new HashSet<string>();

        // Un gruppo esclusivo chiuso si può RIBADIRE, non ridefinire: una frase che lo tocca passa
        // solo se i suoi slot nel gruppo sono Fissato sulla STESSA chiave già fissata (stesso valore
        // garantito dal binding). Così "fa l'idraulico…" e "…da idraulico" convivono, mentre una
        // seconda professione o un'altra fascia d'età restano fuori come sempre.
        bool Accept(Phrase p)
        {
            if (texts.Contains(p.Raw) || p.Labels.Overlaps(usedLabels)) return false;
            foreach (var slot in p.Parts.OfType<Slot>())
                foreach (var gruppo in slot.Groups)
                    if (closedGroups.TryGetValue(gruppo, out var chiavi)
                        && !(slot.Bound && chiavi.TryGetValue(slot.Key, out var eraFissato) && eraFissato))
                        return false;
            return true;
        }
        void Commit(Phrase p)
        {
            chosen.Add(p); texts.Add(p.Raw); usedLabels.UnionWith(p.Labels);
            foreach (var slot in p.Parts.OfType<Slot>())
                foreach (var gruppo in slot.Groups)
                {
                    if (!closedGroups.TryGetValue(gruppo, out var chiavi)) closedGroups[gruppo] = chiavi = [];
                    // La chiave resta "ribadibile" solo se OGNI sua occorrenza è Fissato.
                    chiavi[slot.Key] = !chiavi.TryGetValue(slot.Key, out var prima) ? slot.Bound : prima && slot.Bound;
                }
        }

        foreach (var req in rt.Requirements)
        {
            int limit = Math.Max(req.Min, Math.Min(req.Max, n));
            int target = rng.Next(req.Min, limit + 1);
            int added = 0;
            foreach (var p in Shuffle(req.Phrases, rng))
            {
                if (added >= target) break;
                if (!Accept(p)) continue;
                Commit(p); added++;
            }
        }

        foreach (var p in Shuffle(rt.GlobalCore, rng))
        {
            if (chosen.Count >= n) break;
            if (!Accept(p)) continue;
            Commit(p);
        }
        return chosen;
    }

    private static (string Text, double Score) ComposeOnce(Runtime rt, Random rng, IReadOnlyDictionary<string, string>? seed = null)
    {
        var ctx = new EvalContext(rt, rng, seed);
        // Apertura/chiusura: risolte (condividono lo stato di unicità) ma NON contribuiscono al punteggio.
        var apertura = rt.Apertura is null ? null : EvalPhrase(rt.Apertura, ctx).Text;
        var chiusura = rt.Chiusura is null ? null : EvalPhrase(rt.Chiusura, ctx).Text;

        var chosen = Select(rt, rng);
        var sb = new StringBuilder();
        double total = 0;
        for (int i = 0; i < chosen.Count; i++)
        {
            if (i > 0) sb.Append(rt.Separators[rng.Next(rt.Separators.Count)]);
            var (text, score) = EvalPhrase(chosen[i], ctx);
            sb.Append(text);
            total += score;
        }

        var body = sb.ToString();
        if (apertura is not null && body.Length > 0) body = apertura + body;
        if (chiusura is not null) body += chiusura;
        return (body, total);
    }

    // ── Valutazione dell'AST ──
    private sealed class EvalContext
    {
        public readonly Runtime Rt;
        public readonly Random Rng;
        public readonly Dictionary<string, HashSet<string>> Used = new(); // unicità per-chiave nel testo
        public readonly Dictionary<string, string> Bound = new();         // variabili `[$chiave]` appuntate (per composizione, anche tra frasi)
        public double Product = 1;                                        // prodotto dei pesi (per frase)
        public int PickCount;

        // Il seed pre-appunta le variabili condivise di una VARIANTE (es. il segno scelto): i relativi
        // `[$chiave]` leggono subito questo valore invece di pescarlo. Come le occorrenze successive di
        // un `[$chiave]`, i valori seed NON concorrono al punteggio (non passano da EvalFlat).
        public EvalContext(Runtime rt, Random rng, IReadOnlyDictionary<string, string>? seed = null)
        {
            Rt = rt;
            Rng = rng;
            if (seed is not null)
                foreach (var (key, value) in seed) Bound[key] = value;
        }
        // Reset solo degli accumulatori di punteggio (per-frase). Used e Bound NO: l'unicità e le
        // variabili condivise valgono per l'intera composizione (apertura, chiusura e tutte le frasi).
        public void ResetAccumulator() { Product = 1; PickCount = 0; }
    }

    private static (string Text, double Score) EvalPhrase(Phrase phrase, EvalContext ctx)
    {
        ctx.ResetAccumulator();
        var sb = new StringBuilder();
        foreach (var part in phrase.Parts) sb.Append(EvalPart(part, ctx));
        // peso = base + prodotto degli elementi pescati (0 se la frase non ne ha sostituito nessuno).
        return (sb.ToString(), phrase.Score + (ctx.PickCount > 0 ? ctx.Product : 0));
    }

    private static string EvalPart(Part part, EvalContext ctx)
    {
        switch (part)
        {
            case Lit lit:
                return lit.Text;
            // Variabile condivisa `[$chiave]`: alla prima occorrenza risolve come uno slot normale
            // (con punteggio e unicità) e memorizza; alle successive riusa il valore — niente nuovo
            // punteggio né unicità, così l'età/marca/persona resta identica in tutta la composizione.
            case Slot { Bound: true } s:
                if (ctx.Bound.TryGetValue(s.Key, out var cached)) return cached;
                var first = EvalSlotValue(s, ctx);
                ctx.Bound[s.Key] = first;
                return first;
            case Slot s:
                return EvalSlotValue(s, ctx);
            default:
                return "";
        }
    }

    // Valore "grezzo" di uno slot, ignorando il binding (lo gestisce EvalPart).
    private static string EvalSlotValue(Slot s, EvalContext ctx) => s.Kind switch
    {
        // Range ed età producono numeri: non concorrono al punteggio.
        SlotKind.Range or SlotKind.Age => ctx.Rng.Next(s.Lo, s.Hi + 1).ToString(),
        // Innesto: esegue l'altro generatore per intero (contesto suo, unicità sua) e incolla il
        // testo. Come i numeri, non concorre al punteggio. Termina: grafo aciclico validato al boot.
        SlotKind.Innesto => Generate(ctx.Rt.RisolviInnesto(s.Key), ctx.Rng).Text,
        // Time (fascia oraria): genera "HH:mm di <locuzione>" (es. "06:30 di mattina"). La Key = locuzione.
        SlotKind.Time => FormatTimeSlot(s.Key, s.Lo, s.Hi, ctx.Rng),
        // DateRange: genera un intervallo di date formattato in italiano.
        SlotKind.DateRange => FormatDateRange(s.Key),
        _ => EvalFlat(s.Key, ctx),
    };

    /// <summary>Genera "HH:mm di &lt;locuzione&gt;" nella fascia (Lo=ora_min, Hi=ora_max). Il modulo 24
    /// gestisce il giro di boa della mezzanotte: la sera (19-24) può pescare 24 → reso come 00. Cultura
    /// it-IT condivisa (<see cref="SharedContent.CulturaIt"/>): output stabile a prescindere dalla locale.</summary>
    private static string FormatTimeSlot(string locuzione, int oraMin, int oraMax, Random rng)
    {
        var cult = SharedContent.CulturaIt;
        var ora = rng.Next(oraMin, oraMax + 1) % 24;
        var minuti = rng.Next(0, 60);
        return $"{ora.ToString("00", cult)}:{minuti.ToString("00", cult)} di {locuzione}";
    }

    /// <summary>Ricostruisce il <see cref="SharedContent.DateRangeSlot"/> dalla key codificata da
    /// <c>FraseBuilder</c> (<c>daterange:YYYYMMDD:YYYYMMDD:soloFeriali:saltaFestivi:conGiorno</c>, flag 0/1) e lo
    /// rende in italiano. La key è sempre generata dal nostro codice: un formato inatteso è un bug, non input da tollerare.</summary>
    private static string FormatDateRange(string key)
    {
        var parts = key.Split(':');
        var inv = System.Globalization.CultureInfo.InvariantCulture;
        var start = System.DateTime.ParseExact(parts[1], "yyyyMMdd", inv);
        var end = System.DateTime.ParseExact(parts[2], "yyyyMMdd", inv);
        return new SharedContent.DateRangeSlot(start, end,
            SoloFeriali: parts[3] == "1", SaltaFestivi: parts[4] == "1", ConGiornoSettimana: parts[5] == "1").Formatta();
    }

    private static string EvalFlat(string key, EvalContext ctx)
    {
        var pool = ctx.Rt.FlatLists[key];

        // "Conio" Markov: con probabilità MarkovChaos, inventa una parola nuova invece di pescarla
        // (solo per le flatlist idonee, che hanno una catena). Un coniato NON ha una rarità definita:
        // come i numeri (Range/Età) NON concorre al punteggio, così la "valutazione" finale resta il
        // suo significato originale — la rarità dei soli elementi curati. Parola piana → torna com'è.
        if (ctx.Rt.MarkovChaos > 0 && ctx.Rng.NextDouble() < ctx.Rt.MarkovChaos
            && ctx.Rt.Markov.TryGetValue(key, out var chain) && chain.Coin(ctx.Rng) is { } coined)
            return coined;

        if (!ctx.Used.TryGetValue(key, out var used)) ctx.Used[key] = used = [];
        var available = pool.Where(e => !used.Contains(e.Raw)).ToList();
        if (available.Count == 0) { used.Clear(); available = [.. pool]; } // pool esaurito → reset
        var pick = available[ctx.Rng.Next(available.Count)];
        used.Add(pick.Raw);

        ctx.Product *= pick.Score; ctx.PickCount++;
        var sb = new StringBuilder();
        foreach (var part in pick.Ast.Parts) sb.Append(EvalPart(part, ctx)); // ricorsione sui tag annidati (termina: DAG)
        return sb.ToString();
    }

    private static List<T> Shuffle<T>(IReadOnlyList<T> source, Random rng)
    {
        var list = source.ToList();
        for (int i = list.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
        return list;
    }
}
