import type { SitemapEntry } from '../siteBuilder';

/**
 * Costruisce sitemap.xml a partire da un elenco di `SitemapEntry` — pura, nessun I/O. Chiamata
 * da `server/routes/dynamic-sitemap.ts` (statiche + dinamiche unite), separata apposta così un
 * futuro consumer build-time potrebbe riusarla (config passata, non letta da env/file qui dentro).
 */

// Limiti del protocollo sitemap (sitemaps.org / Google): 50.000 URL o 50MB (non compressi) per singola sitemap.
// Oltre, `buildSitemapSet` spezza in più sotto-sitemap e serve un sitemap-index su `/sitemap.xml`.
const SITEMAP_MAX_URLS = 50_000;
const SITEMAP_MAX_BYTES = 50 * 1024 * 1024;
/** Margine sotto i 50MB per l'involucro `<urlset>` e per una stima dei byte che non è esatta al carattere. */
const SITEMAP_BYTES_MARGIN = 64 * 1024;

/** Quanto può contenere una sitemap prima di essere spezzata (di serie i limiti del protocollo). */
export interface SitemapLimits {
    maxUrls: number;
    maxBytes: number;
}
export const SITEMAP_LIMITS: SitemapLimits = { maxUrls: SITEMAP_MAX_URLS, maxBytes: SITEMAP_MAX_BYTES };

/** Le sitemap di un sito: `root` è ciò che si serve su `/sitemap.xml`. Senza `parts` è l'`<urlset>` unico; con `parts` è un
 *  `<sitemapindex>` e `parts[i]` è l'`<urlset>` da servire su `/sitemap-${i + 1}.xml`. */
export interface SitemapSet {
    root: string;
    parts: readonly string[];
}
export interface SitemapBuildConfig {
    /** URL base del sito, senza slash finale (es. `https://example.com`). */
    baseUrl: string;
    defaultLang: string;
    /** Tutte le lingue del sito — `entries` può contenerne un sottoinsieme (es. solo quelle
     *  statiche note quando questo viene chiamato per il pezzo dinamico separatamente). */
    availableLangs: readonly string[];
}

/**
 * Escape XML per testo/attributi (`&` prima degli altri, altrimenti double-escape). `entry.path`/
 * `lastmod` possono arrivare da `dynamicParams` (dato di dominio dal backend): senza escaping,
 * uno slug con `&`/`<`/`>`/`"` renderebbe l'intera sitemap malformata.
 */
function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

/** Il testo di una sitemap come è servita: raggruppa le varianti-lingua di una stessa pagina, rende ogni `<url>` e li chiude in un `<urlset>`. */
function renderer(entries: readonly SitemapEntry[], cfg: SitemapBuildConfig) {
    const { baseUrl, defaultLang, availableLangs } = cfg;
    // Con una sola lingua configurata: nessun blocco hreflang.
    const multiLang = availableLangs.length > 1;

    // Raggruppate per pageType + groupKey, non per path (con URL localizzati due varianti-lingua
    // della stessa pagina possono avere segmenti diversi). `groupKey` distingue le entità concrete
    // di uno stesso pageType dinamico (es. le varianti IT/EN di "instagram" da quelle di "github").
    const groupOf = (entry: SitemapEntry): string => entry.groupKey ? `${entry.pageType}::${entry.groupKey}` : entry.pageType;
    const groups = new Map<string, SitemapEntry[]>();
    if (multiLang) {
        for (const entry of entries) {
            const key = groupOf(entry);
            const group = groups.get(key);
            if (group) group.push(entry); else groups.set(key, [entry]);
        }
    }

    const renderUrl = (entry: SitemapEntry): string => {
        const lines = ['  <url>', `    <loc>${escapeXml(baseUrl + entry.path)}</loc>`];
        if (multiLang) {
            // Blocchi hreflang incrociati verso ogni variante-lingua della stessa pagina
            // (raccomandazione Google per sitemap multilingua URL-based) + x-default.
            const siblings = groups.get(groupOf(entry)) ?? [entry];
            for (const sibling of siblings) {
                lines.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(sibling.lang)}" href="${escapeXml(baseUrl + sibling.path)}" />`);
            }
            const defaultSibling = siblings.find(s => s.lang === defaultLang);
            if (defaultSibling) {
                lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(baseUrl + defaultSibling.path)}" />`);
            }
        }
        // Nessuna data nota → `<lastmod>` OMESSO, mai un fallback sulla data generica del sito:
        // identica su ogni URL, Google la ignora come segnale (lastmod non verificabile).
        if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
        lines.push('  </url>');
        return lines.join('\n');
    };

    const wrap = (urls: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${multiLang ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}>
${urls}
</urlset>
`;

    // Le unità che non si separano: le varianti-lingua di una stessa pagina stanno nello stesso file (ogni `<url>` elenca tutte le
    // sue varianti: spezzarle farebbe puntare un file a URL che sono in un altro). Senza hreflang ogni entry è un'unità.
    const units = (): SitemapEntry[][] => multiLang ? [...groups.values()] : entries.map(e => [e]);

    return { renderUrl, wrap, units };
}

/** Una sola sitemap, qualunque sia la dimensione (con un avviso oltre i limiti del protocollo). Per un sito grande `buildSitemapSet`. */
export function buildSitemapXml(entries: SitemapEntry[], cfg: SitemapBuildConfig): string {
    const { renderUrl, wrap } = renderer(entries, cfg);
    const xml = wrap(entries.map(renderUrl).join('\n'));

    // Limiti del protocollo (vedi sopra): un warning non blocca nulla (la sitemap resta generata
    // e servita così com'è — molti crawler la leggono comunque, solo oltre i limiti ufficiali),
    // ma segnala che serve spezzarla (`buildSitemapSet`) prima che qualche crawler inizi a troncarla o ignorarla.
    if (entries.length > SITEMAP_MAX_URLS) {
        console.warn(`[sitemap] ${entries.length} URL superano il limite di ${SITEMAP_MAX_URLS} per singola sitemap (protocollo sitemaps.org / Google) — usa buildSitemapSet per spezzarla con un sitemap-index.`);
    }
    const byteSize = Buffer.byteLength(xml, 'utf-8');
    if (byteSize > SITEMAP_MAX_BYTES) {
        console.warn(`[sitemap] ${(byteSize / (1024 * 1024)).toFixed(1)}MB superano il limite di 50MB (non compressi) per singola sitemap (protocollo sitemaps.org / Google) — usa buildSitemapSet per spezzarla con un sitemap-index.`);
    }

    return xml;
}

/** Le sitemap del sito: entro `limits` (di serie 50.000 URL e 50MB) una `<urlset>`, oltre un `<sitemapindex>` con più `<urlset>`.
 *  Le varianti-lingua di una pagina restano nello stesso file e l'ordine si conserva; `<lastmod>` nell'indice è la data più recente del file. */
export function buildSitemapSet(entries: SitemapEntry[], cfg: SitemapBuildConfig, limits: SitemapLimits = SITEMAP_LIMITS): SitemapSet {
    if (!Number.isInteger(limits.maxUrls) || limits.maxUrls < 1 || !(limits.maxBytes > SITEMAP_BYTES_MARGIN)) {
        throw new Error(`[sitemap] limiti non validi: maxUrls=${limits.maxUrls}, maxBytes=${limits.maxBytes}.`);
    }
    const { renderUrl, wrap, units } = renderer(entries, cfg);
    const budget = limits.maxBytes - SITEMAP_BYTES_MARGIN;

    const chunks: { blocks: string[]; urls: number; bytes: number; entries: SitemapEntry[] }[] = [];
    let current: (typeof chunks)[number] = { blocks: [], urls: 0, bytes: 0, entries: [] };
    for (const unit of units()) {
        const blocks = unit.map(renderUrl);
        const bytes = blocks.reduce((n, b) => n + Buffer.byteLength(b, 'utf-8') + 1, 0);
        const overflows = current.urls + unit.length > limits.maxUrls || current.bytes + bytes > budget;
        if (overflows && current.urls > 0) {
            chunks.push(current);
            current = { blocks: [], urls: 0, bytes: 0, entries: [] };
        }
        current.blocks.push(...blocks);
        current.urls += unit.length;
        current.bytes += bytes;
        current.entries.push(...unit);
    }
    if (current.urls > 0 || chunks.length === 0) chunks.push(current);

    if (chunks.length === 1) return { root: wrap(chunks[0].blocks.join('\n')), parts: [] };

    const parts = chunks.map(c => wrap(c.blocks.join('\n')));
    const items = chunks.map((c, i) => {
        const lastmod = c.entries.reduce<string | null>((max, e) => e.lastmod && (max === null || e.lastmod > max) ? e.lastmod : max, null);
        return `  <sitemap>\n    <loc>${escapeXml(`${cfg.baseUrl}/sitemap-${i + 1}.xml`)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''}\n  </sitemap>`;
    });
    const root = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items.join('\n')}
</sitemapindex>
`;
    return { root, parts };
}
