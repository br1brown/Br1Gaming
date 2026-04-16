import express, { type NextFunction, type Request, type Response } from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
    AngularNodeAppEngine,
    createNodeRequestHandler,
    isMainModule,
    writeResponseToNodeResponse
} from '@angular/ssr/node';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const immutableAssetPattern =
    /\.[0-9a-f]{16,}\.(?:js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|avif|ico)$/i;

const app = express();
const angularApp = new AngularNodeAppEngine();
const port = Number(process.env['PORT'] ?? process.env['FRONTEND_PORT'] ?? 3000);
const backendPort = Number(process.env['BACKEND_PORT'] ?? 8080);
const externalApiOrigin = process.env['API_URL']?.trim().replace(/\/$/, '');
const internalApiOrigin = `http://backend:${backendPort}`;
const apiOrigin = externalApiOrigin || internalApiOrigin;
const proxyTimeoutMs = Number(process.env['PROXY_TIMEOUT_MS'] ?? 30_000);

// Security headers per le risposte HTML e gli asset statici.
// Le API (/api/*) ricevono questi header dal backend; li escludiamo qui per evitare duplicati.
//
// connect-src include automaticamente l'origine esterna quando API_URL è impostato
// (deploy separato frontend/backend): senza questo il browser bloccherebbe le chiamate API.
//
// Tutti i valori sono sovrascrivibili via env (es. SECURITY_CSP=...) per i progetti derivati
// che devono aggiungere origini (Google Fonts, CDN, analytics, ecc.).
const defaultCsp = [
    "default-src 'self'",
    // 'unsafe-inline' richiesto da Angular withEventReplay() (SSR hydration):
    // Angular inietta script inline nell'HTML per catturare eventi utente prima che
    // la hydration sia completata. Senza questo flag la CSP li bloccherebbe.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${externalApiOrigin ? `'self' ${externalApiOrigin}` : "'self'"}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'"
].join('; ');

// Usare || invece di ?? per trattare la stringa vuota come "usa il default":
// docker-compose passa le variabili come SECURITY_CSP="${SECURITY_CSP:-}" che
// produce una stringa vuota se non impostata — ?? non cattura il caso vuoto.
const htmlSecurityHeaders: [string, string][] = [
    ['X-Frame-Options',        process.env['SECURITY_X_FRAME_OPTIONS'] || 'SAMEORIGIN'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy',        process.env['SECURITY_REFERRER_POLICY'] || 'strict-origin-when-cross-origin'],
    ['Permissions-Policy',     process.env['SECURITY_PERMISSIONS_POLICY'] || 'camera=(), microphone=(), geolocation=()'],
    ['Content-Security-Policy', process.env['SECURITY_CSP'] || defaultCsp],
];

app.disable('x-powered-by');
app.set('trust proxy', true);

app.get('/health', (_request, response) => {
    response.json({
        status: 'ok',
        mode: 'ssr'
    });
});

// Proxy /api/* → backend.
// Montato a root con pathFilter (non app.use('/api', ...)): Express con app.use('/api', ...)
// striscia il prefisso /api prima di passare la richiesta al middleware, causando 404.
// Con pathFilter il percorso completo (/api/generators ecc.) viene preservato.
app.use(createProxyMiddleware({
    target: apiOrigin,
    pathFilter: '/api',
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: proxyTimeoutMs,
    timeout: proxyTimeoutMs,
    on: {
        error: (err, _req, res, next) => {
            const response = res as Response;
            if (response.headersSent) {
                // Headers già inviati: non possiamo mandare un nuovo status.
                // Passiamo l'errore a Express per logging e cleanup.
                (next as NextFunction)(err);
                return;
            }
            // ProblemDetails (RFC 9457): il frontend legge .detail per il messaggio.
            // Tutti gli errori del proxy sono errori gateway (504), indipendentemente
            // dalla causa (timeout, ECONNREFUSED, ecc.).
            response.status(504).json({
                status: 504,
                title: 'Gateway Timeout',
                detail: 'Il backend non ha risposto in tempo.'
            });
        }
    }
}));

// Applica security headers a tutte le risposte non-API (HTML, assets statici).
// Posizionato dopo il proxy /api: quelle risposte non passano da qui.
app.use((_request, response, next) => {
    for (const [name, value] of htmlSecurityHeaders) {
        response.setHeader(name, value);
    }
    next();
});

app.use(
    express.static(browserDistFolder, {
        maxAge: '1y',
        index: false,
        redirect: false,
        setHeaders(response, filePath) {
            const fileName = filePath.split(/[\\/]/).pop() ?? '';

            if (immutableAssetPattern.test(fileName)) {
                response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                return;
            }

            if (fileName === 'ngsw-worker.js' || fileName === 'ngsw.json') {
                response.setHeader('Cache-Control', 'no-store');
                return;
            }

            if (fileName === 'manifest.webmanifest') {
                response.setHeader('Cache-Control', 'public, max-age=86400');
            }
        }
    })
);

app.use((request, response, next) => {
    angularApp
        .handle(request)
        .then(renderedResponse => {
            if (renderedResponse) {
                return writeResponseToNodeResponse(renderedResponse, response);
            }

            next();
            return undefined;
        })
        .catch(next);
});

if (isMainModule(import.meta.url)) {
    app.listen(port, () => {
        console.log(`[frontend] Node SSR server listening on http://localhost:${port}`);
        console.log(
            `[frontend] API mode: ${externalApiOrigin ? `direct (${externalApiOrigin})` : `proxy (${internalApiOrigin})`}`
        );
    });
}

export const reqHandler = createNodeRequestHandler(app);
