import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { serverEnv } from './server-env';
import { extendCsp } from './csp';

/** Header di sicurezza di fallback se security-headers.json non è presente. */
export const FALLBACK_SECURITY_HEADERS: Record<string, string> = {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    'Content-Security-Policy':
        "default-src 'self'; script-src 'self' {NONCE_PLACEHOLDER}; style-src 'self'; style-src-elem 'self' {NONCE_PLACEHOLDER}; style-src-attr 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
};

/** Hash atteso di security-headers.json per la verifica di integrità del template. */
const EXPECTED_TEMPLATE_SHA256 = '56d6081c516c60227d58d659936a3c7842a08ebfa95ab4062e44d2ee50242091';

if (serverEnv.security.templateHash !== null && serverEnv.security.templateHash !== EXPECTED_TEMPLATE_SHA256) {
    throw new Error(
        '[security-headers] security-headers.json risulta modificato rispetto al file del template ' +
        `(atteso sha256 ${EXPECTED_TEMPLATE_SHA256}, trovato ${serverEnv.security.templateHash}). ` +
        'Questo file è condiviso tra progetti e si aggiorna SOLO dal merge del template: non va editato ' +
        'a mano. Per estendere la Content-Security-Policy (nuovi domini in script-src/img-src/connect-src/' +
        'frame-src/...) crea o modifica security-headers.override.json nella root del progetto.'
    );
}

const configuredHeaders = Object.keys(serverEnv.security.headers).length > 0
    ? serverEnv.security.headers
    : FALLBACK_SECURITY_HEADERS;

/** CSP completa con placeholder del nonce, estesa con security-headers.override.json (se
 *  presente) e usata dal catch-all SSR per-request. */
export const defaultCsp = extendCsp(
    configuredHeaders['Content-Security-Policy'] ?? FALLBACK_SECURITY_HEADERS['Content-Security-Policy'],
    serverEnv.security.cspOverride
);

/** CSP per file statici (assets, index.csr.html): placeholder sostituiti con 'unsafe-inline'
 *  (compare due volte, in script-src e style-src-elem — stesso nonce riusato tra le direttive). */
export const staticCsp = defaultCsp.replaceAll('{NONCE_PLACEHOLDER}', "'unsafe-inline'");

/** Hash sha256 dello script event-dispatch di Angular per abilitarlo in CSP con nonce (SSR). */
function computeEventDispatchScriptHash(): string | null {
    try {
        const path = createRequire(import.meta.url).resolve('@angular/core/event-dispatch-contract.min.js');
        const hash = createHash('sha256').update(readFileSync(path)).digest('base64');
        return `'sha256-${hash}'`;
    } catch (err) {
        console.warn('[security-headers] Hash event-dispatch non calcolabile: con CSP nonce in prod '
            + "l'event replay potrebbe restare bloccato. Dettaglio:", err);
        return null;
    }
}

/** Token extra per lo script-src della variante nonce (stringa con spazio iniziale, o '' se non calcolabile). */
export const eventReplayScriptSrc = ((): string => {
    const hash = computeEventDispatchScriptHash();
    return hash ? ` ${hash}` : '';
})();

/** Header di sicurezza standard applicati a tutte le risposte non-API. */
export const htmlSecurityHeaders: [string, string][] = [
    ...Object.entries(configuredHeaders)
        .filter(([name]) => name.toLowerCase() !== 'content-security-policy'),
    ['Content-Security-Policy', staticCsp],
];
