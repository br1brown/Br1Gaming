import type { ParamMap } from '@angular/router';
import { ContestoSito, PageType } from '../../site';
import { environment } from '../../../environments/environment';

/** Il parametro della pagina di login con l'indirizzo a cui tornare dopo l'accesso. */
export const PARAM_RETURN_URL = 'returnUrl';

/** Il parametro con il `PageType` della pagina riservata che ha rimandato al login (messo da `authGuard`). */
export const PARAM_RETURN_PAGE_TYPE = 'returnPageType';

/** Lunghezza massima del ritorno decodificato: codificato in base64url sono circa 5,4 kB, sotto gli 8 kB della riga di richiesta di nginx. */
const MAX_RETURN_URL = 4000;

/** `raw` se è un indirizzo interno (una sola `/` iniziale, niente spazi né `\`, al più 4000 caratteri) e non è la pagina di login in
 *  nessuna lingua; altrimenti `null`. Così un `?returnUrl=` scritto da altri non porta fuori dal sito. */
export function validReturnUrl(raw: string | null | undefined, lang: string): string | null {
    if (!raw || raw.length > MAX_RETURN_URL) return null;
    if (!raw.startsWith('/') || raw.startsWith('//') || /[\s\\]/.test(raw)) return null;
    return isLoginPath(raw, lang) ? null : raw;
}

/** True se `url` (query e hash ignorati) è la pagina di login in una lingua qualsiasi del sito, anche con maiuscole o percent-encoding. */
export function isLoginPath(url: string, lang: string): boolean {
    const loginPage = ContestoSito.config.loginPage;
    if (loginPage == null) return false;
    const pathname = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    for (const l of new Set([lang, ...environment.availableLanguages])) {
        const loginPath = (ContestoSito.getPath(loginPage, l) ?? '').replace(/\/+$/, '');
        if (loginPath && sameLoginPath(pathname, loginPath)) return true;
    }
    return false;
}

function sameLoginPath(a: string, b: string): boolean {
    const norm = (p: string): string => { try { return decodeURIComponent(p).toLowerCase(); } catch { return p.toLowerCase(); } };
    return norm(a) === norm(b);
}

/** Il ritorno come va in `?returnUrl=`: base64url dei byte UTF-8 di `url`, un solo blocco di `[A-Za-z0-9_-]` senza `%` annidati. */
export function encodeReturnUrl(url: string): string {
    let binary = '';
    for (const byte of new TextEncoder().encode(url)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Il ritorno letto da `?returnUrl=` (base64url), o `null` se non si decodifica in UTF-8 valido. L'indirizzo lo controlla {@link validReturnUrl}. */
export function decodeReturnUrl(raw: string | null | undefined): string | null {
    if (!raw || !/^[A-Za-z0-9_-]+$/.test(raw) || raw.length > Math.ceil(MAX_RETURN_URL * 4 / 3) + 4) return null;
    try {
        const binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
        return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
    } catch {
        return null;
    }
}

/** Il valore di `?returnUrl=` per tornare a `url`, o `undefined` se `url` non è un ritorno valido (il parametro allora non si mette). */
export function returnUrlParam(url: string, lang: string): string | undefined {
    const back = validReturnUrl(url, lang);
    return back ? encodeReturnUrl(back) : undefined;
}

/** L'indirizzo del login nella lingua data per chi è su `here`: con `?returnUrl=` se `here` è un ritorno valido, senza se non lo è.
 *  Già sul login rende `here` com'è, col suo ritorno. `null` senza pagina di login. */
export function loginUrlFrom(lang: string, here: string): string | null {
    const loginPage = ContestoSito.config.loginPage;
    const loginPath = loginPage != null ? ContestoSito.getPath(loginPage, lang) : null;
    if (!loginPath) return null;
    if (isLoginPath(here, lang)) return here;
    const back = returnUrlParam(here, lang);
    return back ? `${loginPath}?${PARAM_RETURN_URL}=${back}` : loginPath;
}

/** La home nella lingua data: la pagina dello slot `homePage`, o la radice della lingua (`/` per la lingua di default, `/en` per le altre). Dove si torna senza un ritorno valido. */
function homeFor(lang: string): string {
    const home = ContestoSito.config.homePage;
    const path = home != null ? ContestoSito.getPath(home, lang) : null;
    if (path) return path;
    if (lang === environment.defaultLang || !environment.availableLanguages.includes(lang)) return '/';   // una lingua che il sito non ha non ha una radice
    return `/${lang}`;
}

/** Dove andare a login riuscito: `returnUrl` se valido, poi la pagina `returnPageType` (scartata se il percorso ha un `:param`),
 *  poi `fallback`, di serie la home della lingua corrente. */
export function loginReturnTarget(params: ParamMap, lang: string, fallback: string = homeFor(lang)): string {
    const url = validReturnUrl(decodeReturnUrl(params.get(PARAM_RETURN_URL)), lang);
    if (url) return url;

    const raw = params.get(PARAM_RETURN_PAGE_TYPE);
    if (raw != null && (Object.values(PageType) as string[]).includes(raw)) {
        const path = ContestoSito.getPath(raw as PageType, lang);
        if (path && !path.includes(':')) return path;
    }
    return fallback;
}
