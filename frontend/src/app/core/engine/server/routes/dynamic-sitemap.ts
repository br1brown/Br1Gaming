import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { environment } from '../../../../../environments/environment';
import { ContestoSito } from '../../../../site';
import { serverEnv } from '../server-env';
import { flattenDynamicParams, applyPathParams, type SitemapEntry, type DynamicParamsContext } from '../../siteBuilder';
import { buildSitemapSet, SITEMAP_LIMITS, type SitemapSet } from '../../services/sitemap-xml';

/** Endpoint `/sitemap.xml`: combina le entry statiche (`ContestoSito`) con l'espansione delle
 *  pagine `dynamicParams` (catalogo da API, non enumerabile a build time). Cache in-process
 *  invalidata da `POST /internal/revalidate-sitemap` (sotto); il TTL è solo un fallback. */

// Alto (7 giorni): l'aggiornamento primario è la notifica `POST /internal/revalidate-sitemap`,
// il TTL è solo un fallback per il caso in cui quella notifica si perda.
const _ttlMs = Number(process.env['SITEMAP_CACHE_TTL_MS']);
const CACHE_TTL_MS = Number.isFinite(_ttlMs) && _ttlMs > 0 ? _ttlMs : 7 * 24 * 60 * 60 * 1000;

// Oltre questo numero di URL per file `/sitemap.xml` diventa un indice di sotto-sitemap (`/sitemap-N.xml`). Di serie il limite del
// protocollo (50.000); un valore più basso (`SITEMAP_MAX_URLS`) dà file più piccoli da generare e da leggere.
const _maxUrls = Number(process.env['SITEMAP_MAX_URLS']);
const MAX_URLS = Number.isInteger(_maxUrls) && _maxUrls >= 1 && _maxUrls <= SITEMAP_LIMITS.maxUrls ? _maxUrls : SITEMAP_LIMITS.maxUrls;

interface SitemapCacheEntry {
    xml: string;
    expiresAt: number;
}

// Cache in-memory locale al processo Node: in un cluster multi-nodo la revalidazione pulisce solo
// il nodo che riceve la POST, gli altri servono la sitemap vecchia fino al TTL. Per scale-out
// spinto serve Redis (o si accetta il TTL sui nodi non notificati).
let cached: { set: SitemapSet; expiresAt: number } | null = null;
let inFlight: Promise<SitemapSet> | null = null;

// Stessa cache/dedup della XML sopra, ma sulle SitemapEntry[] grezze (pre-serializzazione):
// condivisa fra computeSitemapXml() sotto e dynamicAuditPathsHandler (in fondo al file), così
// un backend con un catalogo dynamicParams costoso viene interrogato una sola volta ogni
// CACHE_TTL_MS invece che una volta per /sitemap.xml e una per /internal/dynamic-audit-paths.
let entriesCache: { entries: SitemapEntry[]; expiresAt: number } | null = null;
let entriesInFlight: Promise<SitemapEntry[]> | null = null;

async function getDynamicEntries(): Promise<SitemapEntry[]> {
    const cacheEnabled = ContestoSito.config.dynamicSitemapCache;
    const now = Date.now();
    if (cacheEnabled && entriesCache && entriesCache.expiresAt > now) return entriesCache.entries;

    entriesInFlight ??= computeDynamicEntries().finally(() => { entriesInFlight = null; });
    const entries = await entriesInFlight;
    if (cacheEnabled) entriesCache = { entries, expiresAt: now + CACHE_TTL_MS };
    return entries;
}

/** Implementazione di `DynamicParamsContext.fetchBackendJson`: stesso backend/API key del
 *  proxy `/api/*`, ma chiamato direttamente (gira già lato server). */
async function fetchBackendJson<T>(path: string): Promise<T> {
    const url = `${serverEnv.backend.origin}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
        headers: { 'x-api-key': serverEnv.backend.apiKey },
        // Senza timeout un backend che accetta la connessione ma non risponde mai lascerebbe
        // pendente ogni richiesta concorrente a /sitemap.xml (condividono la stessa `inFlight`).
        signal: AbortSignal.timeout(serverEnv.server.proxyTimeout),
    });
    if (!response.ok) {
        throw new Error(`[dynamic-sitemap] fetchBackendJson("${path}") → HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
}

/** Implementazione di `DynamicParamsContext.fetchBackendPages`: vedi la doc del tipo. */
export async function fetchBackendPages<T>(path: string, options?: { pageSize?: number; maxPages?: number }): Promise<T[]> {
    const pageSize = Number.isInteger(options?.pageSize) && options!.pageSize! >= 1 ? options!.pageSize! : 5000;
    const maxPages = Number.isInteger(options?.maxPages) && options!.maxPages! >= 1 ? options!.maxPages! : 1000;
    const items: T[] = [];
    for (let page = 1; page <= maxPages; page++) {
        const separator = path.includes('?') ? '&' : '?';
        const body = await fetchBackendJson<T[] | { items?: T[] }>(`${path}${separator}page=${page}&pageSize=${pageSize}`);
        const batch = Array.isArray(body) ? body : body?.items;
        if (!Array.isArray(batch)) throw new Error(`[dynamic-sitemap] fetchBackendPages("${path}") pagina ${page}: attesi un array o { items: [] }.`);
        items.push(...batch);
        if (batch.length < pageSize) return items;
    }
    throw new Error(`[dynamic-sitemap] fetchBackendPages("${path}") oltre ${maxPages} pagine: il backend ignora forse page/pageSize.`);
}

/** Espande ogni pagina con `dynamicParams` in `SitemapEntry[]` concrete. Chiamata una volta per
 *  pagina, non per lingua (il catalogo di slug è dato di dominio, indipendente dalla lingua). */
async function computeDynamicEntries(): Promise<SitemapEntry[]> {
    const dynamicPages = ContestoSito.getDynamicPages();
    if (dynamicPages.length === 0) return [];

    const ctx: DynamicParamsContext = { fetchBackendJson, fetchBackendPages };

    // Parallelizza le richieste `dynamicParams` verso il backend. Niente try/catch per pagina
    // di proposito: una sitemap monca de-indicizzerebbe URL su Google in silenzio, meglio far
    // fallire tutto e lasciare che il chiamante serva una cache vecchia o un 500.
    const nestedResults = await Promise.all(dynamicPages.map(async (page) => {
        const tree = await page.dynamicParams(ctx);
        const entries: SitemapEntry[] = [];
        for (const [lang, template] of Object.entries(page.pathByLang)) {
            for (const { params, lastModified } of flattenDynamicParams(template, tree)) {
                entries.push({
                    path: applyPathParams(template, params, `dynamicSitemap("${String(page.pageType)}")`),
                    description: page.description,
                    lang,
                    pageType: page.pageType,
                    // Stessi `params` in ogni variante-lingua della stessa entità: identifica il
                    // gruppo hreflang (SitemapEntry.groupKey), evitando che entità diverse con lo
                    // stesso pageType finiscano mescolate.
                    groupKey: JSON.stringify(params),
                    // Niente fallback silenzioso sulla data del sito: senza data dal nodo, omesso.
                    lastmod: lastModified ?? null,
                });
            }
        }
        return entries;
    }));

    return nestedResults.flat();
}

async function computeSitemapSet(): Promise<SitemapSet> {
    const [staticEntries, dynamicEntries] = [ContestoSito.getSitemapEntries(), await getDynamicEntries()];
    const baseUrl = serverEnv.site.baseUrl || 'https://example.com';
    if (baseUrl === 'https://example.com') {
        console.warn('[dynamic-sitemap] FRONTEND_BASE_URL non configurato — sitemap generata con URL placeholder.');
    }
    return buildSitemapSet([...staticEntries, ...dynamicEntries], {
        baseUrl,
        defaultLang: environment.defaultLang,
        availableLangs: environment.availableLanguages,
    }, { ...SITEMAP_LIMITS, maxUrls: MAX_URLS });
}

/** Le sitemap di adesso: dalla cache se valida, altrimenti ricalcolate (una sola generazione per volta, condivisa dalle richieste in corso).
 *  Backend giù ma una cache scaduta ancora c'è: meglio quella di un 500 (un crawler la rilegge al giro successivo). */
async function getSitemapSet(): Promise<SitemapSet> {
    // Letto ad ogni richiesta, non a module-load: tiene il file disaccoppiato dall'ordine di
    // inizializzazione (il valore comunque non cambia più a runtime una volta avviato il server).
    const cacheEnabled = ContestoSito.config.dynamicSitemapCache;
    const now = Date.now();
    if (cacheEnabled && cached && cached.expiresAt > now) return cached.set;

    try {
        // La dedup resta attiva anche a cache disattivata (vedi doc del modulo).
        inFlight ??= computeSitemapSet().finally(() => { inFlight = null; });
        const set = await inFlight;
        if (cacheEnabled) cached = { set, expiresAt: now + CACHE_TTL_MS };
        return set;
    } catch (err) {
        console.error('[dynamic-sitemap] generazione fallita:', err);
        // Solo a cache attiva: a `false` non c'è mai una `cached` da cui ripiegare, per costruzione.
        if (cacheEnabled && cached) return cached.set;
        throw err;
    }
}

export async function dynamicSitemapHandler(_req: Request, res: Response): Promise<void> {
    // `no-cache` (non `no-store`): permette la cache a browser/CDN ma sempre con revalidazione.
    // Express genera già un ETag debole su `res.send()` di una stringa, quindi è "gratis".
    res.set('Cache-Control', 'no-cache');
    try {
        res.type('application/xml').send((await getSitemapSet()).root);
    } catch {
        res.status(500).type('text/plain').send('Errore nella generazione della sitemap.');
    }
}

/** `/sitemap-:n.xml`: la n-esima sotto-sitemap, quando `/sitemap.xml` è un indice (oltre `MAX_URLS`). Senza indice, o con un numero che
 *  non c'è (zero, troppo grande, non intero), 404: nessun file è mai mostrato al posto di un altro. */
export async function dynamicSitemapPartHandler(req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-cache');
    const n = Number(req.params['0']);
    try {
        const { parts } = await getSitemapSet();
        if (!Number.isInteger(n) || n < 1 || n > parts.length) {
            res.status(404).type('text/plain').send('Sitemap non trovata.');
            return;
        }
        res.type('application/xml').send(parts[n - 1]);
    } catch {
        res.status(500).type('text/plain').send('Errore nella generazione della sitemap.');
    }
}

let llmsCached: SitemapCacheEntry | null = null;
let llmsInFlight: Promise<string> | null = null;

async function computeLlmsTxt(): Promise<string> {
    const [staticEntries, dynamicEntries] = [ContestoSito.getSitemapEntries(), await getDynamicEntries()];
    const baseUrl = serverEnv.site.baseUrl || 'https://example.com';
    const entries = [...staticEntries, ...dynamicEntries];
    const desc = environment.config.description?.[environment.defaultLang] ?? '';

    const lines = [
        `# ${environment.appName}`,
        '',
        `> ${desc}`,
        '',
        '## Pagine',
        ...entries.map(({ path }) => `- ${baseUrl}${path}`),
    ];

    return lines.join('\n') + '\n';
}

export async function dynamicLlmsTxtHandler(_req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-cache');

    const cacheEnabled = ContestoSito.config.dynamicSitemapCache;
    const now = Date.now();
    if (cacheEnabled && llmsCached && llmsCached.expiresAt > now) {
        res.type('text/plain').send(llmsCached.xml);
        return;
    }

    try {
        llmsInFlight ??= computeLlmsTxt().finally(() => { llmsInFlight = null; });
        const txt = await llmsInFlight;
        if (cacheEnabled) llmsCached = { xml: txt, expiresAt: now + CACHE_TTL_MS };
        res.type('text/plain').send(txt);
    } catch (err) {
        console.error('[dynamic-sitemap] llms.txt generazione fallita:', err);
        if (cacheEnabled && llmsCached) {
            res.type('text/plain').send(llmsCached.xml);
            return;
        }
        res.status(500).type('text/plain').send('Errore nella generazione di llms.txt.');
    }
}

/**
 * `POST /internal/revalidate-sitemap`: azzera la cache in-process, così la richiesta successiva
 * a `/sitemap.xml` ricalcola invece di aspettare il TTL. Chiamato dal backend via `SitemapNotifier`,
 * autenticato con la stessa `x-api-key` (direzione opposta a `fetchBackendJson` sopra).
 */
export function revalidateSitemapHandler(req: Request, res: Response): void {
    if (!isValidApiKey(req.get('x-api-key'))) {
        res.status(401).json({ status: 401, title: 'Unauthorized', detail: 'x-api-key mancante o non valida.' });
        return;
    }
    // A cache disattivata sono sempre già null: qui diventa un no-op innocuo.
    cached = null;
    entriesCache = null;
    llmsCached = null;
    res.status(204).end();
}

/** `/internal/dynamic-audit-paths`: path pubblici (lingua default) delle pagine `dynamicParams`,
 *  raggruppati per `pageType` — consumato da scripts/test/discover-audit-paths.cjs per campionare
 *  N istanze PER COMPONENTE negli audit live (Pa11y/Lighthouse), non un campione unico mescolato
 *  tra template con popolazioni di entità diverse. Nessuna autenticazione: stessi dati pubblici
 *  di /sitemap.xml, solo raggruppati invece che appiattiti in <loc>. */
export async function dynamicAuditPathsHandler(_req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-cache');
    try {
        const entries = await getDynamicEntries();
        const groups: Record<string, string[]> = {};
        for (const entry of entries) {
            if (entry.lang !== environment.defaultLang) continue;
            (groups[entry.pageType] ??= []).push(entry.path);
        }
        res.json(groups);
    } catch (err) {
        console.error('[dynamic-sitemap] dynamic-audit-paths generazione fallita:', err);
        res.status(500).type('text/plain').send('Errore nel recupero dei path dinamici per audit.');
    }
}

/** Confronto a tempo costante, stesso principio del check `x-api-key` lato backend
 *  (`CryptographicOperations.FixedTimeEquals`, vedi ApiKeyAuthentication.cs) — un `===` normale
 *  qui aprirebbe lo stesso timing side-channel che quel codice evita esplicitamente. */
function isValidApiKey(candidate: string | undefined): boolean {
    if (!candidate) return false;
    const expected = Buffer.from(serverEnv.backend.apiKey);
    const actual = Buffer.from(candidate);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}
