import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { serverEnv } from './server-env';

/**
 * Header di sicurezza letti da security-headers.json (file del template, unica sorgente
 * condivisa col backend). Fallback usato solo se il file manca, così il server parte
 * comunque protetto.
 *
 * CSP base (con {SCRIPT_NONCE_PLACEHOLDER}): il catch-all Angular genera un nonce
 * per-request e lo sostituisce prima di inviare l'HTML. script-src non contiene
 * 'unsafe-inline'; style-src lo mantiene perché Angular usa [style.x] bindings ovunque
 * e i nonce non coprono gli attributi inline (solo i blocchi <style>).
 */
export const FALLBACK_SECURITY_HEADERS: Record<string, string> = {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // HSTS: i browser lo applicano solo su HTTPS e lo ignorano su HTTP (RFC 6797),
    // quindi è sicuro anche in locale. È il layer SSR a parlare col browser, non il backend.
    // includeSubDomains: estende la policy a tutti i sottodomini (assume deploy all-HTTPS).
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    'Content-Security-Policy':
        "default-src 'self'; script-src 'self' {SCRIPT_NONCE_PLACEHOLDER}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
};

const configuredHeaders = Object.keys(serverEnv.security.headers).length > 0
    ? serverEnv.security.headers
    : FALLBACK_SECURITY_HEADERS;

/** CSP completa con placeholder del nonce, usata dal catch-all SSR per-request. */
export const defaultCsp = configuredHeaders['Content-Security-Policy']
    ?? FALLBACK_SECURITY_HEADERS['Content-Security-Policy'];

/** CSP per file statici (assets, index.csr.html): placeholder sostituito con 'unsafe-inline'. */
export const staticCsp = defaultCsp.replace('{SCRIPT_NONCE_PLACEHOLDER}', "'unsafe-inline'");

/**
 * Hash sha256 dello script event-dispatch di Angular, da aggiungere allo script-src
 * SOLO nella variante con nonce (SSR).
 *
 * Perché serve: con provideClientHydration(withEventReplay()), il build inietta in
 * <body> uno <script id="ng-event-dispatch-contract"> (definisce __jsaction_bootstrap)
 * a build-time, quindi SENZA nonce per-request. A render-time Angular nonce-a solo lo
 * script che lo CHIAMA, non quello che lo definisce (bug noto angular/angular#59886,
 * #66540). Sotto CSP con nonce e senza 'unsafe-inline' viene bloccato → __jsaction_bootstrap
 * non esiste → event replay e idratazione si rompono, ma SOLO in prod (in dev lo script-src
 * usa 'unsafe-inline'). Lo script è statico → lo si autorizza col suo hash.
 *
 * Calcolato dal file reale a runtime → si auto-aggiorna a ogni upgrade di Angular, nessuna
 * costante da mantenere a mano. NB: l'hash va SOLO nella variante nonce: se presente un hash,
 * la CSP ignora 'unsafe-inline', quindi metterlo in staticCsp romperebbe gli inline statici.
 * Copre l'unico script inline build-time esistente oggi; se un futuro Angular ne aggiungesse
 * altri, andrebbero inclusi qui.
 */
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

/** Header di sicurezza standard applicati a tutte le risposte non-API.
 *  La CSP usa la variante static (placeholder→'unsafe-inline'); le risposte SSR
 *  la sovrascrivono col nonce per-request. */
export const htmlSecurityHeaders: [string, string][] = [
    ...Object.entries(configuredHeaders)
        .filter(([name]) => name.toLowerCase() !== 'content-security-policy'),
    ['Content-Security-Policy', staticCsp],
];
