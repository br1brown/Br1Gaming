import type { Request, RequestHandler, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { serverEnv } from '../server-env';

/** Alias sulla sezione server (timeout proxy), valutata al caricamento del modulo. */
const { server: nodeCfg } = serverEnv;

/**
 * Istanza http-proxy-middleware creata pigramente alla prima richiesta.
 *
 * createProxyMiddleware legge `target` al momento della costruzione: crearla a
 * runtime (non all'import) preserva il contratto lazy di server-env, così la
 * route-extraction del build può importare server.ts senza BACKEND_ORIGIN.
 * A quel punto assertRequiredEnv() ha già garantito che l'origin sia presente.
 */
let proxy: RequestHandler | undefined;

function buildProxy(): RequestHandler {
    // Fail-fast sull'origin: un valore malformato in configurazione (typo, schema mancante)
    // emerge qui come errore esplicito, invece che come errore criptico del proxy a ogni richiesta.
    const origin = serverEnv.backend.origin;
    const protocol = new URL(origin).protocol; // lancia TypeError se l'origin non è un URL
    if (protocol !== 'http:' && protocol !== 'https:') {
        throw new Error(`BACKEND_ORIGIN non valido (atteso http/https): ${origin}`);
    }

    return createProxyMiddleware({
        target: origin,
        // changeOrigin riscrive l'Host verso il backend (come faceva fetch leggendo l'URL).
        changeOrigin: true,
        // Timeout sulla risposta del backend → on.error → 504.
        proxyTimeout: nodeCfg.proxyTimeout,
        // xfwd:false: NON lasciamo che la libreria appenda l'IP socket all'eventuale
        // x-forwarded-for del client. La catena XFF la controlliamo noi in on.proxyReq.
        xfwd: false,
        on: {
            proxyReq: (proxyReq, req) => {
                // req è l'IncomingMessage arricchito da Express: lo trattiamo come Request.
                const r = req as unknown as Request;

                // BFF: la chiave API è un segreto server-side, iniettata qui e mai esposta al browser.
                proxyReq.setHeader('x-api-key', serverEnv.backend.apiKey);

                // X-Forwarded-For: SEMPRE req.ip (risolto da Express via `trust proxy`, fidandosi
                // dell'header solo dagli hop fidati). http-proxy copia di default gli header in ingresso,
                // quindi un eventuale x-forwarded-for del client sarebbe inoltrato verbatim: setHeader lo
                // sovrascrive, removeHeader lo elimina quando req.ip manca. Inoltrarlo verbatim
                // permetterebbe lo spoofing dell'IP e l'aggiramento del rate limiter del backend.
                if (r.ip) proxyReq.setHeader('x-forwarded-for', r.ip);
                else proxyReq.removeHeader('x-forwarded-for');

                // Proto/host: come l'XFF sopra, usa i valori risolti da Express via `trust proxy`.
                // r.protocol/r.hostname leggono gli X-Forwarded-* SOLO dagli hop fidati, altrimenti
                // ricadono sui valori reali della connessione. Leggere gli header grezzi del client
                // bypasserebbe quel filtro → host/proto header injection da chi colpisce il server in diretta.
                const proto = r.protocol;
                const host = r.hostname;
                if (proto) proxyReq.setHeader('x-forwarded-proto', proto);
                else proxyReq.removeHeader('x-forwarded-proto');
                if (host) proxyReq.setHeader('x-forwarded-host', host);
                else proxyReq.removeHeader('x-forwarded-host');
            },
            error: (err, _req, res) => {
                console.error('[proxy /api]', err);
                const response = res as Response;
                if (!response.headersSent) {
                    // ECONNRESET/ETIMEDOUT = timeout reale → 504. ECONNREFUSED/ENOTFOUND/EHOSTUNREACH
                    // = backend non raggiungibile → 502 Bad Gateway (non un timeout).
                    const code = (err as NodeJS.ErrnoException).code;
                    const isTimeout = code === 'ECONNRESET' || code === 'ETIMEDOUT';
                    const status = isTimeout ? 504 : 502;
                    response.status(status).json({
                        status,
                        title: isTimeout ? 'Gateway Timeout' : 'Bad Gateway',
                        detail: isTimeout
                            ? 'Il backend non ha risposto in tempo.'
                            : 'Il backend non è raggiungibile.',
                    });
                }
            },
        },
    });
}

/**
 * Proxy /api/* → backend. Montato su API_PREFIX in server.ts: Express strippa il
 * prefisso da req.url, quindi http-proxy-middleware inoltra il path già pulito al backend.
 * Delega all'istanza lazy creata alla prima richiesta.
 */
export const apiProxyHandler: RequestHandler = (req, res, next) => {
    (proxy ??= buildProxy())(req, res, next);
};
