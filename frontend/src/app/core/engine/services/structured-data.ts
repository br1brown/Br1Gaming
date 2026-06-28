/**
 * STRUCTURED DATA — DSL tipizzato + adapter verso schema.org
 *
 * Lo sviluppatore dichiara i dati strutturati con campi dal nome parlante, SENZA conoscere
 * il vocabolario schema.org. L'unico punto che traduce verso JSON-LD valido è `buildStructuredData`
 * qui sotto: se domani schema.org cambia, si tocca solo l'adapter, non i tipi che vede il figlio.
 *
 * Non è una copia 1:1 di schema.org: copre i `kind` utili al 90% dei siti. Per i casi rari c'è
 * la via di fuga `kind: 'raw'` (JSON-LD grezzo passato così com'è).
 *
 * Dove si imposta (vedi PageInfo / ResolvedPage):
 *   - statico  → `site.ts` `otherSEO.structuredData` (es. una FAQ con domande fisse)
 *   - dinamico → un caso del `ContentResolver`, derivandolo dal contenuto (es. autore/data di un Article)
 */

/** Autore in forma minima: solo il nome, o nome + URL. L'adapter lo mappa su `Person`. */
export type SdAuthor = string | { name: string; url?: string };

/** Disponibilità prodotto in termini comuni; l'adapter la mappa sugli enum schema.org. */
export type SdAvailability = 'in-stock' | 'out-of-stock' | 'preorder';

/** Articolo / post di blog. La pagina È l'articolo (arricchisce il nodo pagina). */
export interface SdArticle {
    kind: 'article';
    /** Titolo dell'articolo. Default: titolo della pagina. */
    headline?: string;
    author?: SdAuthor;
    /** Data di pubblicazione, ISO 8601 (es. `2026-01-31`). */
    publishedOn?: string;
    /** Data ultima modifica, ISO 8601. Default: il valore di `og:updated_time`. */
    updatedOn?: string;
    /** URL assoluto dell'immagine. Default: l'og:image della pagina. */
    image?: string;
    /** Sezione/categoria dell'articolo (es. 'Tecnologia'). → `articleSection` + `article:section`. */
    section?: string;
    /** Tag/parole chiave. → `keywords` (JSON-LD) + un `article:tag` per ciascuno. */
    tags?: string[];
}

/** Pagina di FAQ: coppie domanda/risposta. */
export interface SdFaq {
    kind: 'faq';
    questions: { question: string; answer: string }[];
}

/** Prodotto. */
export interface SdProduct {
    kind: 'product';
    /** Nome prodotto. Default: titolo della pagina. */
    name?: string;
    brand?: string;
    /** URL assoluto dell'immagine. Default: l'og:image della pagina. */
    image?: string;
    price?: { amount: number; currency: string; availability?: SdAvailability };
    rating?: { value: number; count: number };
}

/** Evento. */
export interface SdEvent {
    kind: 'event';
    /** Nome evento. Default: titolo della pagina. */
    name?: string;
    /** Inizio, ISO 8601 (data o data-ora). */
    startsOn: string;
    /** Fine, ISO 8601. */
    endsOn?: string;
    location?: string | { name: string; address?: string };
    /** URL assoluto dell'immagine. Default: l'og:image della pagina. */
    image?: string;
    url?: string;
}

/** Via di fuga: JSON-LD schema.org grezzo, aggiunto al grafo così com'è (un nodo o più). */
export interface SdRaw {
    kind: 'raw';
    jsonLd: Record<string, unknown> | Record<string, unknown>[];
}

/** Unione discriminata su `kind`: ciò che lo sviluppatore dichiara. */
export type StructuredData = SdArticle | SdFaq | SdProduct | SdEvent | SdRaw;

/** Un item di structured data: una **stringa** (= solo il `@type` schema.org della pagina, es.
 *  'AboutPage', 'ContactPage'; per i tipi non coperti dai `kind`) oppure un oggetto tipizzato
 *  `{ kind, … }` (ricco, con default a cascata). */
export type StructuredDataItem = string | StructuredData;

/** Ciò che si passa a `structuredData`: un item o una lista (più entità sulla stessa pagina,
 *  es. un Article + una FAQ + un `raw`). Stringhe e `raw` sono item come gli altri. */
export type StructuredDataInput = StructuredDataItem | StructuredDataItem[];

/** Contesto fornito dall'Engine all'adapter (valori già risolti della pagina corrente).
 *  Sono le "altre cose" da cui l'adapter pesca i default quando un campo non è impostato. */
export interface SdContext {
    /** Nome/titolo della pagina (fallback per headline/name). */
    pageName: string;
    /** URL og:image della pagina, se presente (fallback per le immagini). */
    imageUrl?: string | null;
    /** Data ultima modifica effettiva (da `og:updated_time`), se presente (fallback per le date). */
    dateModified?: string;
    /** `@id` del nodo Organization del sito (fallback per `author`/`publisher`). */
    publisherId?: string;
}

/** Arricchimento prodotto dall'adapter per il grafo JSON-LD. */
export interface SdResult {
    /** `@type` da assegnare al nodo pagina (override del default `WebPage`). */
    type?: string;
    /** Proprietà aggiuntive da fondere nel nodo pagina. */
    props?: Record<string, unknown>;
    /** Nodi JSON-LD standalone da aggiungere al grafo (usato da `kind: 'raw'`). */
    nodes?: Record<string, unknown>[];
    /** Meta tag Open Graph da emettere per questa entità (es. `article:*`). Property ripetibili
     *  (più `article:tag`). Valgono solo per l'entità principale della pagina. */
    ogMeta?: { property: string; content: string }[];
}

/** Contributo combinato di uno o più `StructuredData` al grafo JSON-LD della pagina. */
export interface SdGraph {
    /** `@type` per il nodo pagina (`WebPage`), dal primo item tipizzato. Undefined = resta il default. */
    pageType?: string;
    /** Proprietà da fondere nel nodo pagina (dal primo item tipizzato). */
    pageProps: Record<string, unknown>;
    /** Nodi standalone da aggiungere al grafo (item successivi al primo + tutti i `raw`). */
    nodes: Record<string, unknown>[];
    /** Meta OG dell'entità principale della pagina (es. `article:*`), da emettere nel <head>. */
    ogMeta: { property: string; content: string }[];
}

const AVAILABILITY: Record<SdAvailability, string> = {
    'in-stock': 'https://schema.org/InStock',
    'out-of-stock': 'https://schema.org/OutOfStock',
    'preorder': 'https://schema.org/PreOrder',
};

const toPerson = (a?: SdAuthor): Record<string, unknown> | undefined =>
    a == null ? undefined
        : typeof a === 'string' ? { '@type': 'Person', name: a }
            : { '@type': 'Person', name: a.name, ...(a.url && { url: a.url }) };

/**
 * Traduce i dati `kind`-based in arricchimento del grafo schema.org. UNICO punto di
 * accoppiamento a schema.org. Non lancia: i campi assenti vengono semplicemente omessi.
 */
export function buildStructuredData(data: StructuredData, ctx: SdContext): SdResult {
    // Guardia robusta: input null/undefined (es. da un resolver con dati incompleti) → nessun
    // arricchimento. I `kind` sconosciuti cadono invece nel `default` sotto.
    if (data == null) return {};
    const img = (i?: string) => i ?? ctx.imageUrl ?? undefined;

    switch (data.kind) {
        case 'article': {
            // Default a cascata dalle "altre cose": autore → Organization del sito; date → ultima modifica.
            const author = toPerson(data.author) ?? (ctx.publisherId ? { '@id': ctx.publisherId } : undefined);
            const datePublished = data.publishedOn ?? ctx.dateModified;
            const dateModified = data.updatedOn ?? ctx.dateModified;
            const tags = Array.isArray(data.tags) ? data.tags.filter(t => typeof t === 'string' && t.trim()) : [];
            // Meta Open Graph article:* — gemelli dei dati JSON-LD (l'autore solo se esplicito).
            const ogMeta: { property: string; content: string }[] = [];
            if (datePublished) ogMeta.push({ property: 'article:published_time', content: datePublished });
            if (dateModified) ogMeta.push({ property: 'article:modified_time', content: dateModified });
            const authorName = typeof data.author === 'string' ? data.author : data.author?.name;
            if (authorName) ogMeta.push({ property: 'article:author', content: authorName });
            if (data.section) ogMeta.push({ property: 'article:section', content: data.section });
            for (const t of tags) ogMeta.push({ property: 'article:tag', content: t });
            return { type: 'Article', props: {
                headline: data.headline ?? ctx.pageName,
                ...(author && { author }),
                ...(datePublished && { datePublished }),
                ...(dateModified && { dateModified }),
                ...(img(data.image) && { image: img(data.image) }),
                ...(data.section && { articleSection: data.section }),
                ...(tags.length && { keywords: tags.join(', ') }),
            }, ogMeta };
        }
        case 'faq': {
            // Robusto a input malformati: `questions` assente/non-array → lista vuota; si tengono
            // solo le voci con una domanda non vuota, la risposta mancante diventa stringa vuota.
            const raw: unknown[] = Array.isArray(data.questions) ? data.questions : [];
            const mainEntity = raw
                .filter((q): q is { question: string; answer?: unknown } =>
                    !!q && typeof (q as { question?: unknown }).question === 'string'
                    && (q as { question: string }).question.trim().length > 0)
                .map(q => ({
                    '@type': 'Question',
                    name: q.question,
                    acceptedAnswer: { '@type': 'Answer', text: typeof q.answer === 'string' ? q.answer : '' },
                }));
            return { type: 'FAQPage', props: { mainEntity } };
        }
        case 'product': {
            const p = data.price;
            // brand non impostato → ricade sull'Organization del sito (il sito È il brand).
            const brand = data.brand
                ? { '@type': 'Brand', name: data.brand }
                : (ctx.publisherId ? { '@id': ctx.publisherId } : undefined);
            return { type: 'Product', props: {
                name: data.name ?? ctx.pageName,
                ...(brand && { brand }),
                ...(img(data.image) && { image: img(data.image) }),
                ...(p && { offers: {
                    '@type': 'Offer',
                    price: p.amount,
                    priceCurrency: p.currency,
                    ...(p.availability && { availability: AVAILABILITY[p.availability] }),
                } }),
                ...(data.rating && { aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: data.rating.value,
                    reviewCount: data.rating.count,
                } }),
            } };
        }
        case 'event': {
            const loc = data.location;
            // organizer non impostato → ricade sull'Organization del sito (è il sito a organizzarlo).
            const organizer = ctx.publisherId ? { '@id': ctx.publisherId } : undefined;
            return { type: 'Event', props: {
                name: data.name ?? ctx.pageName,
                startDate: data.startsOn,
                ...(data.endsOn && { endDate: data.endsOn }),
                ...(loc && { location: typeof loc === 'string'
                    ? { '@type': 'Place', name: loc }
                    : { '@type': 'Place', name: loc.name, ...(loc.address && { address: loc.address }) } }),
                ...(img(data.image) && { image: img(data.image) }),
                ...(organizer && { organizer }),
                ...(data.url && { url: data.url }),
            } };
        }
        case 'raw':
            return { nodes: Array.isArray(data.jsonLd) ? data.jsonLd : [data.jsonLd] };
        default:
            // kind non riconosciuto (input malformato): nessun arricchimento, la pagina resta WebPage.
            return {};
    }
}

/**
 * Compone uno o più `StructuredData` nel contributo al grafo della pagina.
 *
 * - Singolo item → arricchisce il nodo `WebPage` (comportamento storico).
 * - Array → il **primo** item tipizzato arricchisce il `WebPage` (il "cos'è" della pagina); gli
 *   altri item tipizzati diventano **nodi standalone**; i nodi `raw` sono sempre aggiunti al grafo.
 *
 * Robusto: `null`/`undefined` → contributo vuoto; ogni item passa per `buildStructuredData`
 * (che non lancia mai), quindi voci malformate degradano senza rompere il grafo.
 */
export function buildStructuredDataGraph(input: StructuredDataInput | null | undefined, ctx: SdContext): SdGraph {
    const items = input == null ? [] : (Array.isArray(input) ? input : [input]);
    const out: SdGraph = { pageProps: {}, nodes: [], ogMeta: [] };
    let enriched = false;
    for (const item of items) {
        // Stringa = solo il @type della pagina (vuota/spazi → ignorata); oggetto = item tipizzato.
        const r: SdResult = typeof item === 'string'
            ? (item.trim() ? { type: item.trim() } : {})
            : buildStructuredData(item, ctx);
        if (!enriched && (r.type || r.props)) {
            out.pageType = r.type;
            out.pageProps = r.props ?? {};
            // I meta OG (article:*) valgono per l'entità PRINCIPALE della pagina (la prima).
            if (r.ogMeta) out.ogMeta = r.ogMeta;
            enriched = true;
        } else if (r.type || r.props) {
            out.nodes.push({ '@context': 'https://schema.org', ...(r.type && { '@type': r.type }), ...(r.props ?? {}) });
        }
        if (r.nodes) out.nodes.push(...r.nodes);
    }
    return out;
}
