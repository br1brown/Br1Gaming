/** DSL tipizzato + adapter verso schema.org: lo sviluppatore dichiara campi dal nome parlante senza
 *  conoscere il vocabolario schema.org, `buildStructuredData` sotto è l'unico punto che traduce in
 *  JSON-LD. Non copre l'intero schema.org, solo i `kind` utili al 90% dei siti (per i casi rari
 *  c'è `kind: 'raw'`). Si imposta staticamente (`site.ts` otherSEO.structuredData) o dinamicamente. */

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

/** Pagina "profilo" (portfolio, chi-sono, pagina autore): rich result "Profile page" di Google. Nessun campo proprio: il `mainEntity` punta al nodo Person/Organization già costruito dall'Engine da identity.json. */
export interface SdProfile {
    kind: 'profile';
}

/** Via di fuga: JSON-LD schema.org grezzo, aggiunto al grafo così com'è (un nodo o più). */
export interface SdRaw {
    kind: 'raw';
    jsonLd: Record<string, unknown> | Record<string, unknown>[];
}

/** Unione discriminata su `kind`: ciò che lo sviluppatore dichiara. */
export type StructuredData = SdArticle | SdFaq | SdProduct | SdEvent | SdProfile | SdRaw;

/** Un item: una **stringa** (solo `@type`, es. 'AboutPage' — OK solo per tipi senza proprietà
 *  aggiuntive richieste) o un oggetto tipizzato `{ kind, … }` (ricco, con default a cascata). I
 *  sette `@type` con un `kind` dedicato (`'ProfilePage'`/`'FAQPage'`/`'Article'`/`'NewsArticle'`/
 *  `'BlogPosting'`/`'Product'`/`'Event'`) come stringa nuda producono un nodo incompleto che Google
 *  segnala prima o poi (`buildStructuredDataGraph` avvisa in console): usa sempre `{ kind, ... }`. */
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

/** `@type` schema.org che schema.org/Google richiedono SEMPRE accompagnati da proprietà
 *  aggiuntive (`mainEntity`, `headline`, `name`, `startDate`...) — la stringa nuda imposta SOLO
 *  `@type`, quindi per questi produce sempre un nodo incompleto (Search Console lo segnala prima
 *  o poi). Ognuno ha già un `kind` dedicato che fornisce quei campi correttamente: la mappa serve
 *  solo al warning qui sotto, mai alla resa vera e propria. */
const UNSAFE_BARE_TYPES: Record<string, StructuredData['kind']> = {
    ProfilePage: 'profile', FAQPage: 'faq', Article: 'article', NewsArticle: 'article',
    BlogPosting: 'article', Product: 'product', Event: 'event',
};

/** Un solo avviso per `@type` per processo (SSR: una pagina con questo bug lo servirebbe a ogni
 *  richiesta, non solo alla prima — qui basta accorgersene una volta nei log). */
const warnedBareTypes = new Set<string>();

function warnIfUnsafeBareType(type: string): void {
    const kind = UNSAFE_BARE_TYPES[type];
    if (!kind || warnedBareTypes.has(type)) return;
    warnedBareTypes.add(type);
    console.warn(
        `[structured-data] otherSEO.structuredData: '${type}' come stringa nuda produce un @type `
        + `senza le proprietà che schema.org/Google richiedono per questo tipo (Search Console lo `
        + `segnalerà come dato strutturato incompleto) — usa { kind: '${kind}', ... } invece della stringa.`,
    );
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
        case 'profile':
            // mainEntity SOLO se il grafo ha un publisher risolto (sempre vero nella pratica: lo
            // passa page-meta.service.ts a ogni chiamata) — mai un riferimento a un @id inventato.
            return { type: 'ProfilePage', ...(ctx.publisherId && { props: { mainEntity: { '@id': ctx.publisherId } } }) };
        case 'raw':
            return { nodes: Array.isArray(data.jsonLd) ? data.jsonLd : [data.jsonLd] };
        default:
            // kind non riconosciuto (input malformato): nessun arricchimento, la pagina resta WebPage.
            return {};
    }
}

/** Compone uno o più `StructuredData` nel contributo al grafo. Singolo item: arricchisce `WebPage`. Array: il primo tipizzato arricchisce `WebPage`, gli altri diventano nodi standalone, i `raw` sono sempre aggiunti. null/undefined ⇒ contributo vuoto, ogni item passa per `buildStructuredData` (mai lancia) quindi voci malformate degradano senza rompere il grafo. */
export function buildStructuredDataGraph(input: StructuredDataInput | null | undefined, ctx: SdContext): SdGraph {
    const items = input == null ? [] : (Array.isArray(input) ? input : [input]);
    const out: SdGraph = { pageProps: {}, nodes: [], ogMeta: [] };
    let enriched = false;
    for (const item of items) {
        // Stringa = solo il @type della pagina (vuota/spazi → ignorata); oggetto = item tipizzato.
        let r: SdResult;
        if (typeof item === 'string') {
            const type = item.trim();
            if (type) warnIfUnsafeBareType(type);
            r = type ? { type } : {};
        } else {
            r = buildStructuredData(item, ctx);
        }
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
