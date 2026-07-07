namespace Backend.Generators.Grammar;

/// <summary>
/// Compila un <see cref="IGenerator"/> (con la sua catena di master da <see cref="IGenerator.ComposeWith"/>)
/// in un <see cref="Runtime"/>: fonde i contenuti, li parsa in AST e VALIDA al boot (tag ignoti e cicli
/// → <see cref="GeneratorConfigException"/>). Tutto il lavoro a stringhe avviene qui, una volta sola.
/// </summary>
public static class RuntimeBuilder
{
    /// <summary>
    /// Costruisce il runtime di <paramref name="target"/>. <paramref name="resolve"/> mappa uno slug al
    /// suo generatore (per i master di <see cref="IGenerator.ComposeWith"/> e per validare gli innesti);
    /// <paramref name="risolviInnesto"/> mappa lo slug di un innesto al suo Runtime, a boot completato.
    /// </summary>
    public static Runtime Build(IGenerator target, Func<string, IGenerator> resolve, Func<string, Runtime> risolviInnesto)
    {
        // Catena master-first: i master (da ComposeWith) prima, poi il generatore stesso.
        var chain = new List<IGenerator>();
        foreach (var masterSlug in target.ComposeWith) chain.Add(resolve(masterSlug));
        chain.Add(target);

        // ── Settings: max sulla catena per min/max frasi e soglia; separatori = unione ──
        int min = chain.Max(g => g.PhraseSettings?.MinPhrases ?? 1);
        int max = chain.Max(g => g.PhraseSettings?.MaxPhrases ?? min);
        var definedScores = chain.Where(g => g.PhraseSettings?.MinScore is > 0)
                                 .Select(g => g.PhraseSettings!.MinScore!.Value).ToList();
        double minScore = definedScores.Count > 0 ? definedScores.Max() : 0;
        var separators = chain.Where(g => g.PhraseSettings?.Separators is { Count: > 0 })
                              .SelectMany(g => g.PhraseSettings!.Separators!).Distinct().ToList();
        if (separators.Count == 0) separators.Add(". ");

        // ── FlatLists: owning condivise ∪ catena (concat + dedup per testo); poi le UNIONI ──
        var flat = new Dictionary<string, List<Frase>>();
        foreach (var (key, list) in Condivisi.FlatLists) flat[key] = [.. list];
        foreach (var g in chain)
            foreach (var lista in g.Liste)
                flat[lista.Key] = flat.TryGetValue(lista.Key, out var existing)
                    ? existing.Concat(lista.Voci).DistinctBy(item => item.Raw).ToList()
                    : [.. lista.Voci];

        // ── UNIONI (Tag.Unione), condivise + della catena: flat[unione] = (eventuale estensione diretta)
        // ∪ delle sottochiavi. DOPO il merge, così le estensioni ai sotto-tag (anche lungo la catena
        // ComposeWith) rifluiscono. Le unioni compongono da liste OWNING, non da altre unioni → un passo. ──
        foreach (var unione in Condivisi.Unioni.Concat(chain.SelectMany(g => g.Composte)))
            flat[unione.Key] = (flat.TryGetValue(unione.Key, out var estensione) ? estensione : [])
                .Concat(unione.Componenti!.Where(flat.ContainsKey).SelectMany(chiave => flat[chiave]))
                .DistinctBy(item => item.Raw)
                .ToList();

        // ── Validazione DETERMINISTICA: il grafo dei riferimenti tra flatlist è aciclico ──
        if (FindCycle(BuildRefGraph(flat)) is { } cycle)
            throw new GeneratorConfigException(
                $"Generatore '{target.Slug}': ciclo di riferimenti tra flatlist: {string.Join(" → ", cycle)}");

        // ── Gruppi esclusivi attivi (nome → tag): da PolicyGroups locali/condivisi, o singoletto ──
        var exclusiveNames = chain.Where(g => g.ExclusiveGroups != null)
                                  .SelectMany(g => g.ExclusiveGroups!).Distinct();
        // PolicyGroups LOCALI dei generatori (nome → chiavi), fusi per nome lungo la catena.
        var localPolicy = chain.Where(g => g.PolicyGroups != null)
            .SelectMany(g => g.PolicyGroups!)
            .GroupBy(kv => kv.Key)
            .ToDictionary(grp => grp.Key, grp => grp.SelectMany(kv => kv.Value).Distinct().ToArray());
        // Fail-fast: un membro di un gruppo locale che non è una flatlist nota è un refuso silenzioso.
        foreach (var (nome, chiavi) in localPolicy)
            foreach (var chiave in chiavi)
                if (!flat.ContainsKey(chiave))
                    throw new GeneratorConfigException(
                        $"Generatore '{target.Slug}': il gruppo locale '{nome}' referenzia un tag sconosciuto '{chiave}'");
        var activeGroups = exclusiveNames.ToDictionary(
            name => name,
            name =>
            {
                if (localPolicy.TryGetValue(name, out var localTags)) return localTags;
                if (Condivisi.PolicyGroups.TryGetValue(name, out var tags)) return tags.ToArray();
                // Gruppo-singoletto: il nome È la chiave del tag da rendere esclusivo, quindi si valida
                // qui — un refuso diventerebbe altrimenti un gruppo che non aggancia nulla, in silenzio.
                if (!flat.ContainsKey(name) && !Condivisi.FasceEta.ContainsKey(name))
                    throw new GeneratorConfigException(
                        $"Generatore '{target.Slug}': gruppo esclusivo sconosciuto '{name}' (né PolicyGroups locali/condivisi, né flatlist, né fascia d'età)");
                return new[] { name };
            });

        var uniqueLabels = chain.Where(g => g.UniqueLabels != null)
                                .SelectMany(g => g.UniqueLabels!).Select(e => e.Testo).Distinct().ToList();

        var parser = new PhraseParser(flat.Keys.ToHashSet(), activeGroups, uniqueLabels);

        // ── Parse (qui un tag ignoto fa fallire il boot) ──
        var resolvedFlat = flat.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyList<FlatEntry>)kv.Value
                .Select(item => new FlatEntry(parser.Parse(item, "flat"), item.Score, item.Raw))
                .ToList());

        var globalCore = chain.SelectMany(g => g.Core.Select(c => parser.Parse(c, g.Slug)))
                              .DistinctBy(p => p.Raw).ToList();

        // ── Required: master se esplicito; altrimenti quota proporzionale per gli ospiti ──
        var requirements = new List<Requirement>();
        for (int i = 0; i < chain.Count; i++)
        {
            var instance = chain[i];
            if (i == 0)
            {
                if (instance.CoreRequired is { Phrases.Count: > 0 } masterReq)
                    requirements.Add(ParseRequirement(masterReq, instance.Slug, parser));
            }
            else if (instance.Core.Count > 0)
            {
                if (instance.CoreRequired is { Phrases.Count: > 0 } guestReq)
                    requirements.Add(ParseRequirement(guestReq, instance.Slug, parser));
                else
                {
                    var phrases = instance.Core.Select(c => parser.Parse(c, instance.Slug)).ToList();
                    requirements.Add(new Requirement(Math.Max(1, (min + 1) / 2), max / 2, phrases));
                }
            }
        }

        var aperturaTpl = chain.Select(g => g.Apertura).FirstOrDefault(a => !string.IsNullOrEmpty(a?.Raw));
        var chiusuraTpl = chain.Select(g => g.Chiusura).FirstOrDefault(c => !string.IsNullOrEmpty(c?.Raw));
        var apertura = aperturaTpl is null ? null : parser.Parse(aperturaTpl, "frame");
        var chiusura = chiusuraTpl is null ? null : parser.Parse(chiusuraTpl, "frame");

        // ── Coerenza dei contenuti (il boot è il linter): tutte le frasi del runtime in un corpus ──
        var frasi = globalCore
            .Concat(requirements.SelectMany(r => r.Phrases))
            .Concat(resolvedFlat.Values.SelectMany(entries => entries.Select(e => e.Ast)))
            .Concat(new[] { apertura, chiusura }.OfType<Phrase>())
            .ToList();

        // Etichette uniche: ognuna deve comparire in ALMENO una frase — un'etichetta senza riscontro
        // è un refuso che disattiverebbe l'unicità in silenzio.
        var morte = uniqueLabels.Where(label => !frasi.Any(p => p.Raw.Contains(label))).ToList();
        if (morte.Count > 0)
            throw new GeneratorConfigException(
                $"Generatore '{target.Slug}': etichette uniche senza riscontro in alcuna frase: {string.Join(", ", morte)}");

        // Liste dichiarate ma mai citate: un tag con voci che nessuna frase pesca è contenuto morto.
        var citate = frasi.SelectMany(p => p.Parts).OfType<Slot>()
            .Where(s => s.Kind == SlotKind.FlatList).Select(s => s.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var inerti = chain.SelectMany(g => g.Liste).Select(t => t.Key).Distinct()
            .Where(key => !citate.Contains(key)).ToList();
        if (inerti.Count > 0)
            throw new GeneratorConfigException(
                $"Generatore '{target.Slug}': liste dichiarate ma mai citate da alcuna frase: {string.Join(", ", inerti)}");

        // Innesti ({Genera("...")}): ogni slug citato deve esistere e il grafo tra generatori essere
        // aciclico — due generatori che si innestano a vicenda genererebbero all'infinito.
        foreach (var slug in frasi.SelectMany(p => p.Parts).OfType<Slot>()
                     .Where(s => s.Kind == SlotKind.Innesto).Select(s => s.Key).Distinct())
            ValidaInnesto(slug, resolve, [target.Slug]);

        // ── Markov ("conio" di varianti): SOLO sulle liste dichiarate coniabili dai loro simboli
        // (Condivisi.ChiaviConiabili: nomi e cognomi, curati apposta) — opt-in esplicito, niente
        // deduzione per esclusione. Le liste dei singoli generatori non si coniano mai: lì un termine
        // inventato è un refuso, non una variante. Il tasso è il default condiviso, salvo override esplicito
        // di un generatore della catena (max tra quelli impostati; 0 disattiva). Ordine = primo esplicito, o default.
        var chaosOverrides = chain.Select(g => g.PhraseSettings?.MarkovChaos)
                                  .Where(v => v.HasValue).Select(v => v!.Value).ToList();
        double markovChaos = chaosOverrides.Count > 0 ? chaosOverrides.Max() : MarkovChain.DefaultChaos;
        int markovOrder = chain.Select(g => g.PhraseSettings?.MarkovOrder).FirstOrDefault(o => o is > 0)
                          ?? MarkovChain.DefaultOrder;
        var markov = new Dictionary<string, MarkovChain>();
        if (markovChaos > 0)
            foreach (var (key, list) in flat)
                if (Condivisi.ChiaviConiabili.Contains(key)
                    && MarkovChain.Train(list.Select(i => i.Raw).ToList(), markovOrder) is { } ch)
                    markov[key] = ch;

        return new Runtime(
            FlatLists: resolvedFlat,
            GlobalCore: globalCore,
            Requirements: requirements,
            MinPhrases: min, MaxPhrases: max, MinScore: minScore,
            Separators: separators,
            Apertura: apertura,
            Chiusura: chiusura,
            UniqueLabels: uniqueLabels,
            Markov: markov, MarkovChaos: markovChaos,
            RisolviInnesto: risolviInnesto);
    }

    private static Requirement ParseRequirement(RequiredInjectData data, string origin, PhraseParser parser) =>
        new(data.Min, data.Max, data.Phrases.Select(p => parser.Parse(p, origin)).ToList());

    /// <summary>
    /// Valida ricorsivamente un innesto: lo slug esiste e il grafo degli innesti (attraverso i
    /// contenuti del bersaglio E dei suoi master) non torna mai su un generatore già in catena.
    /// </summary>
    private static void ValidaInnesto(string slug, Func<string, IGenerator> resolve, List<string> catena)
    {
        if (catena.Contains(slug, StringComparer.OrdinalIgnoreCase))
            throw new GeneratorConfigException(
                $"Ciclo di innesti tra generatori: {string.Join(" → ", catena)} → {slug}");

        IGenerator bersaglio;
        try { bersaglio = resolve(slug); }
        catch
        {
            throw new GeneratorConfigException(
                $"Generatore '{catena[0]}': innesto verso uno slug sconosciuto '{slug}'");
        }

        var catenaBersaglio = bersaglio.ComposeWith.Select(resolve).Append(bersaglio).ToList();
        var frasi = catenaBersaglio.SelectMany(g => g.Core
            .Concat(g.Liste.SelectMany(lista => lista.Voci))
            .Concat(new[] { g.Apertura, g.Chiusura }.OfType<Frase>()));
        foreach (var sub in frasi.SelectMany(f => f.Parti).OfType<ProtoSlot>()
                     .Where(p => p.Kind == SlotKind.Innesto).Select(p => p.Key).Distinct())
            ValidaInnesto(sub, resolve, [.. catena, slug]);
    }

    // ── Grafo dei riferimenti tra flatlist (solo le flatlist possono ciclare; range/età sono foglie) ──
    private static Dictionary<string, List<string>> BuildRefGraph(Dictionary<string, List<Frase>> flat)
    {
        var graph = new Dictionary<string, List<string>>();
        foreach (var (key, entries) in flat)
        {
            var outs = new List<string>();
            foreach (var entry in entries)
                // I riferimenti sono già slot tipizzati (anche quelli "fissati"): nessun testo da scandire.
                foreach (var slot in entry.Parti.OfType<ProtoSlot>())
                    if (slot.Kind == SlotKind.FlatList && flat.ContainsKey(slot.Key))
                        outs.Add(slot.Key);
            graph[key] = outs;
        }
        return graph;
    }

    /// <summary>DFS con colorazione: ritorna il primo ciclo trovato (per il messaggio d'errore), o null.</summary>
    private static List<string>? FindCycle(Dictionary<string, List<string>> graph)
    {
        var color = new Dictionary<string, int>(); // 0 mai visto, 1 in pila, 2 chiuso
        var stack = new List<string>();
        List<string>? found = null;

        bool Dfs(string node)
        {
            color[node] = 1; stack.Add(node);
            foreach (var dep in graph.GetValueOrDefault(node) ?? [])
            {
                if (color.GetValueOrDefault(dep) == 1) { found = [.. stack.SkipWhile(x => x != dep), dep]; return true; }
                if (color.GetValueOrDefault(dep) == 0 && Dfs(dep)) return true;
            }
            stack.RemoveAt(stack.Count - 1); color[node] = 2; return false;
        }

        foreach (var key in graph.Keys) if (color.GetValueOrDefault(key) == 0 && Dfs(key)) break;
        return found;
    }
}

/// <summary>
/// Compila una <see cref="Frase"/> in un <see cref="Phrase"/> AST. Le parti tipizzate esistono già
/// dalla costruzione (interpolazione, vedi <c>FraseBuilder</c>): qui resta solo il lavoro che dipende
/// dal RUNTIME della catena — agganciare i gruppi esclusivi attivi, le label uniche, e validare che
/// le flatlist referenziate esistano nella fusione. Nessun parsing: il testo non si scandisce mai.
/// </summary>
internal sealed class PhraseParser(
    IReadOnlySet<string> flatKeys,
    IReadOnlyDictionary<string, string[]> activeGroups,
    IReadOnlyList<string> uniqueLabels)
{
    public Phrase Parse(Frase frase, string origin)
    {
        var parts = new List<Part>(frase.Parti.Count);
        foreach (var proto in frase.Parti)
            parts.Add(proto switch
            {
                ProtoLit lit => new Lit(lit.Text),
                ProtoSlot slot => MapSlot(slot, frase.Raw, origin),
                _ => throw new GeneratorConfigException($"Parte di frase sconosciuta: {proto}"),
            });

        // SHALLOW (come sempre): contano solo i tag DIRETTI del template.
        var groups = parts.OfType<Slot>().SelectMany(s => s.Groups).ToHashSet();
        var labels = uniqueLabels.Where(frase.Raw.Contains).ToHashSet();
        return new Phrase(frase.Score, parts, groups, labels, origin, frase.Raw);
    }

    private Slot MapSlot(ProtoSlot proto, string template, string origin)
    {
        // Il TIPO dello slot è già noto dal costruttore tipizzato; resta da validare che una flatlist
        // referenziata esista nella catena di questo runtime (il Tag di un altro generatore compila,
        // ma senza ComposeWith la sua lista qui non c'è).
        if (proto.Kind == SlotKind.FlatList && !flatKeys.Contains(proto.Key))
            throw new GeneratorConfigException(
                $"Generatore '{origin}': tag sconosciuto [{proto.Key}] nella frase \"{template}\"");
        return new Slot(proto.Key, proto.Kind, proto.Lo, proto.Hi, GroupsFor(proto.Key), proto.Bound);
    }

    private HashSet<string> GroupsFor(string key)
    {
        var set = new HashSet<string>();
        foreach (var (name, tags) in activeGroups)
            if (tags.Contains(key)) set.Add(name);
        return set;
    }
}

/// <summary>
/// Gli assemblaggi dei contenuti condivisi (da <see cref="SharedContent"/>) nella forma che serve al
/// motore. Classe <c>file</c>-scoped: PRIVATA di questo file per il linguaggio — un generatore non può
/// nominarla nemmeno volendo. La sua superficie di authoring resta SharedContent e basta.
/// </summary>
file static class Condivisi
{
    /// <summary>Le liste condivise, assemblate dai tag-con-voci (chiave = <c>Tag.Key</c>).</summary>
    internal static Dictionary<string, List<Frase>> FlatLists { get; } = BuildFlatLists();

    private static Dictionary<string, List<Frase>> BuildFlatLists()
    {
        Tag[] condivisi =
        [
            SharedContent.Social.Any, SharedContent.City.Any,
            SharedContent.Nome.M, SharedContent.Nome.F,
            SharedContent.Cognome.Any,
            SharedContent.Professioni.SoloM, SharedContent.Professioni.SoloF, SharedContent.Professioni.Neutre,
            SharedContent.Piatti.M, SharedContent.Piatti.F,
            SharedContent.Marketplace.Any, SharedContent.Giorni.Any,
            SharedContent.Dinamici.DataOggi.Any,
            .. SharedContent.Parente.Fasce.SelectMany(fascia => new[] { fascia.M, fascia.F }),
        ];
        return condivisi.ToDictionary(tag => tag.Key, tag => tag.Voci.ToList());
    }

    /// <summary>Gruppi di tag mutuamente esclusivi referenziabili per nome (vedi <c>SharedContent.Gruppi</c>).</summary>
    internal static Dictionary<string, List<string>> PolicyGroups { get; } = new()
    {
        [SharedContent.Gruppi.Eta] = [.. SharedContent.Eta.Tutte.Select(fascia => fascia.Tag.Key)],
        // "identità": età E professione nello stesso gruppo, così un testo definisce il soggetto
        // una sola volta (niente "50 anni, nonno" + "studente universitario" nella stessa descrizione).
        [SharedContent.Gruppi.Identita] =
            [SharedContent.Professioni.M.Key, SharedContent.Professioni.F.Key, .. SharedContent.Eta.Tutte.Select(fascia => fascia.Tag.Key)],
    };

    /// <summary>Le UNIONI condivise (<see cref="Tag.Unione"/>): il RuntimeBuilder le compone come quelle
    /// dei generatori (<c>IGenerator.Composte</c>). La struttura vive accanto ai dati in
    /// <see cref="SharedContent"/> — qui si elencano soltanto; le sottochiavi le porta ogni unione
    /// (<c>Componenti</c>). Coprono nomi/piatti (M∪F) e i parenti (fasce per genere e complessivi).</summary>
    internal static Tag[] Unioni { get; } =
    [
        SharedContent.Nome.Any, SharedContent.Piatti.Any,
        SharedContent.Professioni.M, SharedContent.Professioni.F, SharedContent.Professioni.Any,
        SharedContent.Parente.M, SharedContent.Parente.F, SharedContent.Parente.Any,
        .. SharedContent.Parente.Fasce.Select(fascia => fascia.Any),
    ];

    /// <summary>Le fasce d'età indicizzate per chiave di tag (per la validazione dei gruppi).</summary>
    internal static IReadOnlyDictionary<string, FasciaEta> FasceEta { get; } =
        SharedContent.Eta.Tutte.ToDictionary(fascia => fascia.Tag.Key);

    /// <summary>
    /// Le SOLE liste su cui lavora il conio Markov: coniare è una proprietà OPT-IN del contenuto, non
    /// una deduzione per esclusione. Nomi e cognomi (e la composta dei nomi) sono insiemi numerosi di
    /// nomi propri curati apposta per le varianti inventate; tutto il resto — condiviso o locale —
    /// resta reale e non si conia mai. <c>MarkovChain.IsSuitable</c> fa da rete di sicurezza in più.
    /// </summary>
    internal static IReadOnlySet<string> ChiaviConiabili { get; } =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            SharedContent.Nome.M.Key, SharedContent.Nome.F.Key,
            SharedContent.Nome.Any.Key, SharedContent.Cognome.Any.Key,
        };
}
