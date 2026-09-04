import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { environment } from '../../../../../environments/environment';
import { ContestoSito } from '../../../../site';
import { serverEnv } from '../server-env';
import { flattenDynamicParams, applyPathParams, type SitemapEntry, type DynamicParamsContext } from '../../siteBuilder';
import { buildSitemapXml } from '../../services/sitemap-xml';

/**
 * Endpoint `/sitemap.xml`: genera la sitemap combinando le entry statiche (`ContestoSito`,
 * `buildSitemapXml()`) con l'espansione delle pagine `dynamicParams`, il cui catalogo arriva da
 * un'API e non è enumerabile a build time. Cache in-process invalidata da
 * `POST /internal/revalidate-sitemap` (sotto); il TTL è solo una rete di sicurezza per il caso
 * raro in cui quella notifica si perda.
 */

// Alto (7 giorni) perché non è più il meccanismo primario di aggiornamento — solo un fallback.
const _ttlMs = Number(process.env['SITEMAP_CACHE_TTL_MS']);
const CACHE_TTL_MS = Number.isFinite(_ttlMs) && _ttlMs > 0 ? _ttlMs : 7 * 24 * 60 * 60 * 1000;

interface SitemapCacheEntry {
    xml: string;
    expiresAt: number;
}

// Cache in-memory locale al processo Node: in un cluster multi-nodo la revalidazione pulisce solo
// il nodo che riceve la POST, gli altri servono la sitemap vecchia fino al TTL. Per scale-out
// spinto serve Redis (o si accetta il TTL sui nodi non notificati).
let cached: SitemapCacheEntry | null = null;
let inFlight: Promise<string> | null = null;

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

/** Espande ogni pagina con `dynamicParams` in `SitemapEntry[]` concrete. Chiamata una volta per
 *  pagina, non per lingua (il catalogo di slug è dato di dominio, indipendente dalla lingua). */
async function computeDynamicEntries(): Promise<SitemapEntry[]> {
    const dynamicPages = ContestoSito.getDynamicPages();
    if (dynamicPages.length === 0) return [];

    const ctx: DynamicParamsContext = { fetchBackendJson };

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

async function computeSitemapXml(): Promise<string> {
    const [staticEntries, dynamicEntries] = [ContestoSito.getSitemapEntries(), await computeDynamicEntries()];
    const baseUrl = serverEnv.site.baseUrl || 'https://example.com';
    if (baseUrl === 'https://example.com') {
        console.warn('[dynamic-sitemap] FRONTEND_BASE_URL non configurato — sitemap generata con URL placeholder.');
    }
    return buildSitemapXml([...staticEntries, ...dynamicEntries], {
        baseUrl,
        defaultLang: environment.defaultLang,
        availableLangs: environment.availableLanguages,
    });
}

export async function dynamicSitemapHandler(_req: Request, res: Response): Promise<void> {
    // `no-cache` (non `no-store`): permette la cache a browser/CDN ma sempre con revalidazione.
    // Express genera già un ETag debole su `res.send()` di una stringa, quindi è "gratis".
    res.set('Cache-Control', 'no-cache');

    // Letto ad ogni richiesta, non a module-load: tiene il file disaccoppiato dall'ordine di
    // inizializzazione (il valore comunque non cambia più a runtime una volta avviato il server).
    const cacheEnabled = ContestoSito.config.dynamicSitemapCache;
    const now = Date.now();
    if (cacheEnabled && cached && cached.expiresAt > now) {
        res.type('application/xml').send(cached.xml);
        return;
    }

    try {
        // La dedup resta attiva anche a cache disattivata (vedi doc del modulo).
        inFlight ??= computeSitemapXml().finally(() => { inFlight = null; });
        const xml = await inFlight;
        if (cacheEnabled) cached = { xml, expiresAt: now + CACHE_TTL_MS };
        res.type('application/xml').send(xml);
    } catch (err) {
        console.error('[dynamic-sitemap] generazione fallita:', err);
        if (cacheEnabled && cached) {
            // Backend giù ma abbiamo ancora una sitemap valida (pure scaduta): meglio quella di
            // un 500 — un crawler la rilegge comunque al giro successivo. Solo a cache attiva:
            // a `false` non c'è mai una `cached` da cui ripiegare, per costruzione.
            res.type('application/xml').send(cached.xml);
            return;
        }
        res.status(500).type('text/plain').send('Errore nella generazione della sitemap.');
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
    // A cache disattivata `cached` è sempre già null: qui diventa un no-op innocuo.
    cached = null;
    res.status(204).end();
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
