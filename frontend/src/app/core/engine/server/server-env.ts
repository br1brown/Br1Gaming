/** Configurazione dell'ambiente Node SSR, letta una volta al boot: unica sorgente per server.ts e app.config.server.ts. Sezioni lazy (l'import non legge env var, così la route extraction non le richiede); validazione in server.ts, non qui. */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { GlobalSettings } from '../global-settings.types';
import { deepMergeSettings } from '../scripts/config/settings-merge';
import type { CspOverride } from './csp';
import type { PermissionsPolicyOverride } from './permissions-policy';
import { parseHostingInfo, type HostingInfo, type LegalFacts } from '../legal/hosting-info';
import { environment } from '../../../../environments/environment';

// ── Lettura global-settings.json (+ override global-settings.local.json) ──────────────
// GLOBAL_SETTINGS_PATH (Docker) → cwd → ../cwd (dev locale). In dev i segreti stanno in
// global-settings.local.json, fuso sopra il base con lo stesso deep-merge di generate-statics.ts.
// In Docker/prod il .local non esiste → merge no-op.

/** Primo file esistente lungo la catena, parsato come oggetto; null se nessuno c'è/è valido. */
function readJsonFile(candidates: (string | undefined)[]): Record<string, unknown> | null {
    for (const p of candidates.filter((x): x is string => Boolean(x))) {
        try {
            if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>;
        } catch { /* prova il prossimo */ }
    }
    return null;
}

function loadBr1Settings(): Record<string, unknown> {
    const base = readJsonFile([
        process.env['GLOBAL_SETTINGS_PATH'],
        resolve(process.cwd(), 'global-settings.json'),
        resolve(process.cwd(), '../global-settings.json'),
    ]) ?? {};

    const local = readJsonFile([
        resolve(process.cwd(), 'global-settings.local.json'),
        resolve(process.cwd(), '../global-settings.local.json'),
    ]);

    return local ? deepMergeSettings(base, local) : base;
}

/** Forma tipizzata di global-settings.json: il tipo `GlobalSettings` è generato dallo schema
 *  (`npm run generate:types`), sorgente unica — niente più interfaccia partial scritta a mano. */
type Br1Json = GlobalSettings;

// ── Lettura security-headers.json ─────────────────────────────────────────────
// File del template (header di sicurezza fissi), stessa logica di ricerca del precedente.
// Se manca, security-headers.ts ricade su FALLBACK_SECURITY_HEADERS. Il contenuto grezzo viene
// anche hashato (templateHash): security-headers.ts si rifiuta di avviarsi se l'hash non combacia
// con quello shipped, per intercettare una modifica a mano invece di security-headers.override.json.
interface LoadedSecurityHeaders {
    readonly headers: Record<string, string>;
    /** sha256 esadecimale del file letto, null se il file non è stato trovato/leggibile. */
    readonly templateHash: string | null;
}

function loadSecurityHeaders(): LoadedSecurityHeaders {
    const candidates = [
        process.env['SECURITY_HEADERS_PATH'],
        resolve(process.cwd(), 'security-headers.json'),
        resolve(process.cwd(), '../security-headers.json'),
    ].filter((p): p is string => Boolean(p));

    for (const p of candidates) {
        try {
            if (existsSync(p)) {
                const raw = readFileSync(p, 'utf-8');
                const parsed = JSON.parse(raw) as { Security?: { Headers?: Record<string, string> } };
                return {
                    headers: parsed.Security?.Headers ?? {},
                    templateHash: createHash('sha256').update(raw).digest('hex'),
                };
            }
        } catch { /* prova il prossimo */ }
    }
    return { headers: {}, templateHash: null };
}

// ── Lettura security-headers.override.json ────────────────────────────────────
// File del PROGETTO FIGLIO (committabile, non un segreto): estensioni dichiarative alla CSP
// del template (es. aggiungere un dominio embed a connect-src/frame-src/img-src), senza dover
// toccare security-headers.json. Stessa logica di ricerca degli altri file di config. Assente
// di default: nessuna estensione, la CSP resta quella del template.
function loadCspOverride(): CspOverride | null {
    const candidates = [
        process.env['SECURITY_HEADERS_OVERRIDE_PATH'],
        resolve(process.cwd(), 'security-headers.override.json'),
        resolve(process.cwd(), '../security-headers.override.json'),
    ].filter((p): p is string => Boolean(p));

    for (const p of candidates) {
        try {
            if (existsSync(p)) {
                const parsed = JSON.parse(readFileSync(p, 'utf-8')) as { csp?: Record<string, unknown> };
                const csp = parsed.csp;
                if (!csp || typeof csp !== 'object') return null;
                const result: Record<string, string[]> = {};
                for (const [directive, sources] of Object.entries(csp)) {
                    if (Array.isArray(sources)) {
                        result[directive] = sources.filter((s): s is string => typeof s === 'string');
                    }
                }
                return result;
            }
        } catch { /* prova il prossimo */ }
    }
    return null;
}

// ── Lettura security-headers.override.json (sezione permissionsPolicy) ────────────
// Stesso file dell'override CSP (progetto figlio, committabile): estensioni dichiarative alla
// Permissions-Policy del template (es. autorizzare la geolocalizzazione per il proprio dominio),
// senza dover toccare security-headers.json. Stessa logica di ricerca degli altri file di config.
function loadPermissionsPolicyOverride(): PermissionsPolicyOverride | null {
    const candidates = [
        process.env['SECURITY_HEADERS_OVERRIDE_PATH'],
        resolve(process.cwd(), 'security-headers.override.json'),
        resolve(process.cwd(), '../security-headers.override.json'),
    ].filter((p): p is string => Boolean(p));

    for (const p of candidates) {
        try {
            if (existsSync(p)) {
                const parsed = JSON.parse(readFileSync(p, 'utf-8')) as { permissionsPolicy?: Record<string, unknown> };
                const policy = parsed.permissionsPolicy;
                if (!policy || typeof policy !== 'object') return null;
                const result: Record<string, string[]> = {};
                for (const [feature, origins] of Object.entries(policy)) {
                    if (Array.isArray(origins)) {
                        result[feature] = origins.filter((s): s is string => typeof s === 'string');
                    }
                }
                return result;
            }
        } catch { /* prova il prossimo */ }
    }
    return null;
}

let _securityHeaders: LoadedSecurityHeaders | undefined;
let _cspOverride: CspOverride | null | undefined;
let _permissionsPolicyOverride: PermissionsPolicyOverride | null | undefined;

let _br1: Record<string, unknown> | undefined;
function br1(): Br1Json {
    return (_br1 ??= loadBr1Settings()) as Br1Json;
}

/** File dei fatti dell'installazione: HOSTING_INFO_PATH (Docker: lo monta il deploy, `/dev/null` se non
 *  configurato) oppure `frontend.hostingInfo` relativo alla cartella di global-settings.json (dev locale).
 *  File vuoto o percorso non configurato = null; file mancante o non valido = errore. */
function loadHostingInfo(): HostingInfo | null {
    const configured = br1().frontend?.hostingInfo?.trim();
    const settingsDir = [process.env['GLOBAL_SETTINGS_PATH'], resolve(process.cwd(), 'global-settings.json'), resolve(process.cwd(), '../global-settings.json')]
        .find((p): p is string => Boolean(p) && existsSync(p!));
    const file = process.env['HOSTING_INFO_PATH']
        || (configured ? resolve(settingsDir ? dirname(settingsDir) : process.cwd(), configured) : '');
    if (!file) return null;
    if (!existsSync(file)) throw new Error(`[br1-engine] frontend.hostingInfo: il file ${file} non esiste.`);
    const text = readFileSync(file, 'utf-8').trim();
    if (!text) return null;
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new Error(`[br1-engine] ${file}: JSON non valido.`); }
    return parseHostingInfo(raw, file);
}

let _hostingInfo: HostingInfo | null | undefined;

/** Accesso diretto all'intero global-settings.json (tipizzato) — utile per leggere Custom.*  */
export function getBr1Settings(): GlobalSettings {
    return (_br1 ??= loadBr1Settings()) as GlobalSettings;
}

/** Fatti per la Privacy Policy (installazione, sito coperto, finestra del rate limiting): stessa fonte per
 *  il provider Angular (SSR di ogni pagina) e per l'endpoint di scorta (`/internal/legal-facts`), che il
 *  browser interroga solo quando una pagina caricata senza SSR (`requiresAuth`) non gliel'ha già passata.
 *  Già ridotti a ciò che il testo scrive (vedi `LegalFacts`): il limite spento è `null`, non "spento", e la finestra
 *  dei login entra solo col login acceso, fusa in un solo numero. Calcolati una volta: la configurazione non cambia
 *  a processo avviato. */
let _legalFacts: LegalFacts | undefined;
export function computeLegalFacts(): LegalFacts {
    return (_legalFacts ??= (() => {
        const rl = getBr1Settings().Security?.ApiConfig?.RateLimiting;
        const attivo = rl?.Enabled ?? true;
        const finestra = Math.max(rl?.Global?.WindowSeconds ?? 60, environment.features.login ? rl?.Login?.WindowSeconds ?? 60 : 0);
        return {
            installazione: serverEnv.hostingInfo,
            sito: serverEnv.site.baseUrl || null,
            limiteRichiesteSecondi: attivo ? finestra : null,
        };
    })());
}

// ── Interfacce ────────────────────────────────────────────────────────────────

/** Configurazione della connessione al backend ASP.NET Core. */
export interface BackendEnv {
    /** Origine del backend, es. "http://backend:8080". Impostata da BACKEND_ORIGIN. */
    readonly origin: string;
    /** Chiave API condivisa per l'header X-Api-Key. Impostata da BACKEND_API_KEY. */
    readonly apiKey: string;
}

/** Parametri operativi del server Node/Express. */
export interface NodeServerEnv {
    /** Porta di ascolto. Impostata da PORT (default: 3000). */
    readonly port: number;
    /** Valore per Express `trust proxy`. Impostato da TRUST_PROXY: `true`/`false`, un numero di hop, o una lista di reti/nomi. */
    readonly trustProxy: boolean | number | string;
    /** Timeout ms per le chiamate proxy al backend. Impostato da PROXY_TIMEOUT_MS (default: 30000). */
    readonly proxyTimeout: number;
    /** Host autorizzati per le richieste SSR. Impostato da NG_ALLOWED_HOSTS (lista separata
     *  da virgole) o da frontend.hostname. Se nessuno dei due è valorizzato, fallback agli host
     *  locali (localhost/127.0.0.1/[::1]): fail-closed, così in produzione senza hostname il
     *  traffico reale viene rifiutato (421) invece di accettare qualsiasi Host. */
    readonly allowedHosts: readonly string[];
}

/** Configurazione del sito e funzionalità opzionali. */
export interface SiteEnv {
    /** URL canonico del sito, es. "https://tuodominio.it". Impostato da FRONTEND_BASE_URL. */
    readonly baseUrl: string;
    /** Percorso cartella asset caricati dall'utente. Impostato da ASSETS_DIR. */
    readonly assetsDir: string;
    /** Chiave per cifrare i payload di preview social. Impostato da PREVIEW_CRYPTO_SECRET.
     *  Se vuota, viene usato il fallback pubblico `appName:version`. */
    readonly previewCryptoSecret: string;
    /** Se `true`, l'intero deploy è non-indicizzabile: il server emette `X-Robots-Tag:
     *  noindex, nofollow` su ogni risposta e serve un `robots.txt` che vieta tutto.
     *  Impostato da SEO_NOINDEX (1/true/yes). Default `false` (sito indicizzabile).
     *  Pensato per ambienti di staging/anteprima dietro lo stesso reverse proxy della prod. */
    readonly noindex: boolean;
    /** Cartella del font custom montata da Docker (docker-compose: BR1_FONTS_DIR, default
     *  `/app/fonts` — coincide col default in produzione perché WORKDIR è `/app`; in dev locale
     *  risolve a `frontend/fonts/`). Cartella assente o vuota = nessun font custom (vedi
     *  `custom-font-detect.ts`). Impostato da FONTS_DIR. */
    readonly fontsDir: string;
    /** Qualità WebP (1-100) della variante web-ottimizzata — STESSO `Media.WebOptQuality` letto
     *  lato backend (`MediaOptions`), unica sorgente `global-settings.json`. Le dimensioni
     *  richiedibili per `?webopt=true&size=N` NON sono qui: sono la whitelist fissa dell'Engine
     *  `ALLOWED_WIDTHS` (`asset-config.ts`) — un consumer SSR la importa direttamente da lì, non
     *  da `serverEnv` (non è più una sezione di `global-settings.json`). Default 85. */
    readonly webOptQuality: number;
}

/** Header di sicurezza condivisi col backend, letti da security-headers.json (file del template). */
export interface SecurityEnv {
    /** Mappa header→valore. La CSP contiene {NONCE_PLACEHOLDER} (in script-src e style-src-elem),
     *  sostituito per-request con lo stesso nonce. */
    readonly headers: Readonly<Record<string, string>>;
    /** sha256 di security-headers.json così com'è su disco; null se il file manca. Usato da
     *  security-headers.ts per il controllo di integrità (fail-fast se modificato a mano). */
    readonly templateHash: string | null;
    /** Estensioni CSP dichiarate in security-headers.override.json (progetto figlio); null se
     *  il file manca o non definisce una sezione "csp". */
    readonly cspOverride: CspOverride | null;
    /** Estensioni Permissions-Policy dichiarate in security-headers.override.json (progetto
     *  figlio); null se il file manca o non definisce una sezione "permissionsPolicy". */
    readonly permissionsPolicyOverride: PermissionsPolicyOverride | null;
}

/** Configurazione completa dell'ambiente server Node, tipizzata e raggruppata per area. */
export interface ServerEnv {
    readonly backend: BackendEnv;
    readonly server: NodeServerEnv;
    readonly site: SiteEnv;
    readonly security: SecurityEnv;
    /** Fatti dell'installazione per le pagine legali (file di `frontend.hostingInfo`); null se non configurato.
     *  Lancia se il file configurato manca o non rispetta lo schema: server.ts lo controlla all'avvio. */
    readonly hostingInfo: HostingInfo | null;
}

// ── Helper ────────────────────────────────────────────────────────────────────

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Interpreta una env var booleana: `1`, `true`, `yes`, `on` (case-insensitive) → true. */
const parseBool = (value: string | undefined): boolean =>
    ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());

/** Host locali usati come fallback quando frontend.hostname e NG_ALLOWED_HOSTS sono entrambi vuoti.
 *  @angular/ssr NON riconosce '*' come wildcard globale (fa match solo letterale o '*.dominio'),
 *  quindi usarlo causa 400 Bad Request per qualsiasi host reale (localhost incluso).
 *  Il fallback a host locali espliciti permette lo sviluppo locale senza configurazione aggiuntiva. */
const LOCAL_DEV_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

/** Parsa la lista host separata da virgole; se vuota (né NG_ALLOWED_HOSTS né frontend.hostname), ripiega su LOCAL_DEV_HOSTS.
 *  L'host canonico di `FRONTEND_BASE_URL` (es. `www.dominio.it` con `frontend.hostname` senza www) entra sempre:
 *  altrimenti ogni richiesta finirebbe 301 verso un host che il server stesso rifiuta con 421. */
const parseAllowedHosts = (value: string | undefined, baseUrl?: string): readonly string[] => {
    const hosts = (value ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter((host) => host.length > 0);
    const list = hosts.length > 0 ? hosts : [...LOCAL_DEV_HOSTS];
    try {
        const canonical = baseUrl ? new URL(baseUrl).hostname.toLowerCase() : '';
        if (canonical && !list.some(h => h.toLowerCase() === canonical)) list.push(canonical);
    } catch { /* baseUrl malformato: nessun canonico, nessun redirect */ }
    return list;
};

/** `TRUST_PROXY` come lo vuole Express: `'true'`/`'false'` booleani, un numero di hop, altrimenti la lista di reti/nomi.
 *  Una stringa `'true'` passata tale quale farebbe lanciare Express (`invalid IP address: true`) all'avvio. */
const parseTrustProxy = (value: string | undefined): boolean | number | string => {
    const v = (value ?? '').trim();
    if (!v) return 'loopback, linklocal, uniquelocal';
    if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
    if (/^\d+$/.test(v)) return Number(v);
    return v;
};

// ── Configurazione lazy per sezione ──────────────────────────────────────────
//
// Ogni sezione è un getter: la lettura delle variabili d'ambiente avviene
// solo al primo accesso alla sezione, non all'import del modulo.
// Il risultato viene memorizzato per evitare letture ripetute.

let _backend: BackendEnv | undefined;
let _server: NodeServerEnv | undefined;
let _site: SiteEnv | undefined;
let _security: SecurityEnv | undefined;

export const serverEnv: ServerEnv = {
    get backend(): BackendEnv {
        return _backend ??= {
            origin: (process.env['BACKEND_ORIGIN'] ?? '').replace(/\/$/, ''),
            // BACKEND_ORIGIN è sempre un env var (URL Docker-interno, non config utente)
            apiKey: br1().Security?.ApiConfig?.Keys?.[0] ?? process.env['BACKEND_API_KEY'] ?? '',
        };
    },
    get server(): NodeServerEnv {
        const hostname = br1().frontend?.hostname ?? '';
        return _server ??= {
            port:         parsePositiveInt(process.env['PORT'], br1().frontend?.port ?? 3000),
            trustProxy:   parseTrustProxy(process.env['TRUST_PROXY']),
            proxyTimeout: parsePositiveInt(process.env['PROXY_TIMEOUT_MS'], 30_000),
            allowedHosts: parseAllowedHosts(process.env['NG_ALLOWED_HOSTS'] || hostname, process.env['FRONTEND_BASE_URL']),
        };
    },
    get site(): SiteEnv {
        const hostname = br1().frontend?.hostname ?? '';
        const media = br1().Media;
        return _site ??= {
            baseUrl:             process.env['FRONTEND_BASE_URL'] || (hostname ? `https://${hostname}` : ''),
            assetsDir:           process.env['ASSETS_DIR'] ?? '',
            previewCryptoSecret: process.env['PREVIEW_CRYPTO_SECRET'] ?? '',
            noindex:             parseBool(process.env['SEO_NOINDEX']),
            fontsDir:            process.env['FONTS_DIR'] || resolve(process.cwd(), 'fonts'),
            webOptQuality:       media?.WebOptQuality ?? 85,
        };
    },
    get hostingInfo(): HostingInfo | null {
        if (_hostingInfo === undefined) _hostingInfo = loadHostingInfo();
        return _hostingInfo;
    },
    get security(): SecurityEnv {
        const loaded = (_securityHeaders ??= loadSecurityHeaders());
        return _security ??= {
            headers: loaded.headers,
            templateHash: loaded.templateHash,
            cspOverride: (_cspOverride ??= loadCspOverride()),
            permissionsPolicyOverride: (_permissionsPolicyOverride ??= loadPermissionsPolicyOverride()),
        };
    },
};

/**
 * Verifica che le variabili d'ambiente obbligatorie siano impostate.
 * Da chiamare in server.ts prima di avviare il listener Express,
 * non all'import del modulo: il build Angular non le richiede.
 */
export function assertRequiredEnv(): void {
    const missing = (
        [
            ['BACKEND_ORIGIN',    serverEnv.backend.origin],
            ['Security.ApiConfig.Keys[0]', serverEnv.backend.apiKey],
        ] as const
    ).filter(([, v]) => !v).map(([name]) => name);

    if (missing.length > 0)
        throw new Error(`[server-env] Configurazione obbligatoria mancante: ${missing.join(', ')}`);
}
