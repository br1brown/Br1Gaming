import type { SitemapEntry } from '../siteBuilder';

/**
 * Costruisce sitemap.xml a partire da un elenco di `SitemapEntry` — pura, nessun I/O. Chiamata
 * da `server/routes/dynamic-sitemap.ts` (statiche + dinamiche unite), separata apposta così un
 * futuro consumer build-time potrebbe riusarla (config passata, non letta da env/file qui dentro).
 */

// Limiti del protocollo sitemap (sitemaps.org / Google): 50.000 URL o 50MB per singola sitemap.
// Oltre serve un sitemap-index con più sotto-sitemap, non ancora costruito in questo Engine —
// per ora solo un warning (sotto) che lo segnali.
const SITEMAP_MAX_URLS = 50_000;
const SITEMAP_MAX_BYTES = 50 * 1024 * 1024;
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

export function buildSitemapXml(entries: SitemapEntry[], cfg: SitemapBuildConfig): string {
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

    const urls = entries
        .map((entry) => {
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
        })
        .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${multiLang ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}>
${urls}
</urlset>
`;

    // Limiti del protocollo (vedi sopra): un warning non blocca nulla (la sitemap resta generata
    // e servita così com'è — molti crawler la leggono comunque, solo oltre i limiti ufficiali),
    // ma segnala che serve un sitemap-index prima che qualche crawler inizi a troncarla o ignorarla.
    if (entries.length > SITEMAP_MAX_URLS) {
        console.warn(`[sitemap] ${entries.length} URL superano il limite di ${SITEMAP_MAX_URLS} per singola sitemap (protocollo sitemaps.org / Google) — serve un sitemap-index con più sotto-sitemap.`);
    }
    const byteSize = Buffer.byteLength(xml, 'utf-8');
    if (byteSize > SITEMAP_MAX_BYTES) {
        console.warn(`[sitemap] ${(byteSize / (1024 * 1024)).toFixed(1)}MB superano il limite di 50MB (non compressi) per singola sitemap (protocollo sitemaps.org / Google) — serve un sitemap-index con più sotto-sitemap.`);
    }

    return xml;
}
