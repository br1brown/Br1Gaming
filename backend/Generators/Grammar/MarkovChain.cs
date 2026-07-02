using System.Text;

namespace Backend.Generators.Grammar;

/// <summary>
/// Catena di Markov a livello di CARATTERE: impara l'ortografia da una lista di parole e ne conia
/// di nuove — plausibili ma inventate, con lo stesso "sapore" (es. da nomi reali → «Arnazio»,
/// «Gernanio»; da cognomi → «Mariotti», «Vernazzi»). Dà un tocco di varietà ai segnaposto, opt-in via
/// <see cref="GenerationSettings.MarkovChaos"/>. Costruita UNA VOLTA al boot (come tutto il Runtime),
/// poi solo letta: il conio a runtime è O(lunghezza parola).
/// </summary>
public sealed class MarkovChain
{
    // ── Parametri (policy del conio, in un solo posto) ────────────────────────────────
    /// <summary>
    /// Tasso di conio STANDARD applicato alle sole liste dichiarate coniabili dai loro simboli
    /// (<c>le chiavi coniabili, private del motore</c>: nomi e cognomi, curati apposta per il conio; città,
    /// social e parenti devono restare reali e non ci sono). Un generatore può sovrascriverlo via
    /// <see cref="GenerationSettings.MarkovChaos"/> (anche 0 per disattivarlo del tutto).
    /// </summary>
    public const double DefaultChaos = 0.25;
    /// <summary>Ordine (in caratteri) di default del modello, se il generatore non lo specifica.</summary>
    public const int DefaultOrder = 2;
    /// <summary>Ordine minimo/massimo ammessi (oltre, il modello degenera o ricopia gli originali).</summary>
    private const int MinOrder = 1, MaxOrder = 4;
    /// <summary>Voci minime per addestrare: sotto, il modello è troppo povero → niente conio.</summary>
    private const int MinSamples = 12;
    /// <summary>Frazione minima di voci a parola singola (i nomi propri lo sono).</summary>
    private const double MinSingleWordFraction = 0.8;
    /// <summary>Frazione minima di voci con iniziale maiuscola: il char-Markov conia bene i NOMI PROPRI
    /// (nomi/cognomi), ma mangia le parole comuni in non-parole tipo refuso. Restare sui propri.</summary>
    private const double MinProperNounFraction = 0.8;
    /// <summary>Tentativi massimi di conio prima di rinunciare (e far ripiegare sul pescaggio normale).</summary>
    private const int MaxCoinAttempts = 24;

    // Sentinelle di inizio/fine parola (caratteri di controllo: non compaiono nei contenuti).
    private const char Start = '\u0002';
    private const char End = '\u0003';

    private readonly int _order;
    private readonly IReadOnlyDictionary<string, IReadOnlyList<char>> _trans; // k-gramma → caratteri successivi (con ripetizioni = frequenza)
    private readonly IReadOnlySet<string> _known; // originali (case-insensitive): il conio deve essere NUOVO
    private readonly int _minLen, _maxLen;

    private MarkovChain(int order, IReadOnlyDictionary<string, IReadOnlyList<char>> trans,
        IReadOnlySet<string> known, int minLen, int maxLen)
    {
        _order = order; _trans = trans; _known = known; _minLen = minLen; _maxLen = maxLen;
    }

    /// <summary>
    /// Decide se un insieme di voci è adatto al conio: il char-Markov rende bene SOLO su insiemi
    /// numerosi di nomi propri a parola singola (vedi <see cref="MinSamples"/>,
    /// <see cref="MinSingleWordFraction"/>, <see cref="MinProperNounFraction"/>).
    /// </summary>
    public static bool IsSuitable(IReadOnlyList<string> words)
    {
        if (words.Count < MinSamples) return false;
        int singleWord = words.Count(w => !w.Contains(' '));
        int properNoun = words.Count(w => w.Length > 0 && char.IsUpper(w[0]));
        return singleWord >= words.Count * MinSingleWordFraction
            && properNoun >= words.Count * MinProperNounFraction;
    }

    /// <summary>
    /// Allena la catena sulle voci LETTERALI di <paramref name="entries"/> (scarta quelle con tag
    /// annidati). Ritorna <c>null</c> se l'insieme non è adatto (<see cref="IsSuitable"/>): per quella
    /// flatlist semplicemente non si conia, si pesca come sempre.
    /// </summary>
    public static MarkovChain? Train(IReadOnlyList<string> entries, int order)
    {
        order = Math.Clamp(order, MinOrder, MaxOrder);
        var words = entries.Where(e => !e.Contains('[')).ToList(); // niente template con tag annidati
        if (!IsSuitable(words)) return null;

        var trans = new Dictionary<string, List<char>>();
        var known = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        int sumLen = 0, maxLen = 0;

        foreach (var w in words)
        {
            if (string.IsNullOrWhiteSpace(w)) continue;
            known.Add(w);
            sumLen += w.Length; maxLen = Math.Max(maxLen, w.Length);

            var s = new string(Start, order) + w + End;
            for (int i = 0; i + order < s.Length; i++)
            {
                var key = s.Substring(i, order);
                if (!trans.TryGetValue(key, out var next)) trans[key] = next = [];
                next.Add(s[i + order]);
            }
        }
        if (trans.Count == 0) return null;

        int avg = sumLen / Math.Max(1, words.Count);
        var ro = trans.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<char>)kv.Value);
        // Vincoli di lunghezza ragionevoli attorno alla distribuzione reale (evita monconi/parole-fiume).
        return new MarkovChain(order, ro, known, Math.Max(2, avg / 2), Math.Min(maxLen + 3, maxLen * 2));
    }

    /// <summary>
    /// Conia una parola nuova (assente dagli originali) entro i vincoli di lunghezza, oppure <c>null</c>
    /// se dopo alcuni tentativi non ci riesce (il chiamante ripiega sul pescaggio normale).
    /// </summary>
    public string? Coin(Random rng)
    {
        for (int attempt = 0; attempt < MaxCoinAttempts; attempt++)
        {
            var state = new string(Start, _order);
            var sb = new StringBuilder();
            for (int i = 0; i < _maxLen + 4; i++)
            {
                if (!_trans.TryGetValue(state, out var next)) break;
                var c = next[rng.Next(next.Count)];
                if (c == End) break;
                sb.Append(c);
                state = (state + c)[^_order..];
            }
            var word = sb.ToString();
            if (word.Length >= _minLen && word.Length <= _maxLen && !_known.Contains(word))
                return word;
        }
        return null;
    }
}
