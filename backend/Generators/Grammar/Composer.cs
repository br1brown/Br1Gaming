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

    /// <summary>Genera il testo migliore (rispetto alla soglia) e il suo punteggio.</summary>
    public static (string Text, double Score) Generate(Runtime rt, Random rng)
    {
        var best = ComposeOnce(rt, rng);
        for (int attempt = 1; best.Score < rt.MinScore && attempt < MaxComposeAttempts; attempt++)
        {
            var candidate = ComposeOnce(rt, rng);
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
        var closedGroups = new HashSet<string>();
        var usedLabels = new HashSet<string>();

        bool Accept(Phrase p) =>
            !texts.Contains(p.Raw) && !p.Groups.Overlaps(closedGroups) && !p.Labels.Overlaps(usedLabels);
        void Commit(Phrase p)
        {
            chosen.Add(p); texts.Add(p.Raw);
            closedGroups.UnionWith(p.Groups); usedLabels.UnionWith(p.Labels);
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

    private static (string Text, double Score) ComposeOnce(Runtime rt, Random rng)
    {
        var ctx = new EvalContext(rt, rng);
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
    private sealed class EvalContext(Runtime rt, Random rng)
    {
        public readonly Runtime Rt = rt;
        public readonly Random Rng = rng;
        public readonly Dictionary<string, HashSet<string>> Used = new(); // unicità per-chiave nel testo
        public double Product = 1;                                        // prodotto dei pesi (per frase)
        public int PickCount;
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

    private static string EvalPart(Part part, EvalContext ctx) => part switch
    {
        Lit lit => lit.Text,
        // Range ed età producono numeri: non concorrono al punteggio.
        Slot { Kind: SlotKind.Range or SlotKind.Age } s => ctx.Rng.Next(s.Lo, s.Hi + 1).ToString(),
        Slot s => EvalFlat(s.Key, ctx),
        _ => "",
    };

    private static string EvalFlat(string key, EvalContext ctx)
    {
        var pool = ctx.Rt.FlatLists[key];
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
