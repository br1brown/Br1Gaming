/**
 * Configurazione dell'ambiente Node SSR, letta una volta al boot.
 * Unica sorgente di verità per server.ts e app.config.server.ts.
 *
 * Le sezioni sono valutate in modo lazy: l'import del modulo non legge
 * nessuna variabile d'ambiente, così il build Angular può importare questo
 * file durante la route extraction senza richiedere le variabili runtime.
 *
 * La validazione delle variabili obbligatorie avviene in server.ts prima
 * di avviare il listener Express, non qui: questo consente al processo di
 * build di completarsi normalmente e all'errore di emergere solo all'avvio
 * reale del server Node.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Lettura global-settings.json (+ override global-settings.local.json) ──────────────
// GLOBAL_SETTINGS_PATH (env var) → path esplicito (Docker: /app/global-settings.json,
//   già file effettivo base+.local fuso da scripts/lib/br1-config.sh)
// Fallback 1: global-settings.json nella cwd (Docker dev)
// Fallback 2: ../global-settings.json rispetto alla cwd (dev locale: cwd=frontend/)
// In DEV locale i segreti (ApiKeys, Token) stanno in global-settings.local.json: viene
// fuso sopra il base con lo stesso deep-merge di br1-config.sh, così l'SSR locale ha la
// API key come backend e proxy. In Docker/prod il .local non esiste → merge no-op.

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge: oggetti fusi ricorsivamente, array e scalari sostituiti (semantica di br1-config.sh). */
function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...base };
    for (const k of Object.keys(over)) {
        out[k] = isPlainObject(out[k]) && isPlainObject(over[k])
            ? deepMerge(out[k] as Record<string, unknown>, over[k] as Record<string, unknown>)
            : over[k];
    }
    return out;
}

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

    return local ? deepMerge(base, local) : base;
}

/** Forma tipizzata dei campi di global-settings.json letti da questo modulo.
 *  Partial: i campi possono mancare se global-settings.json è incompleto o assente. */
interface Br1Json {
    Security?: { ApiKeys?: string[] };
    frontend?: { hostname?: string; port?: number };
}

// ── Lettura security-headers.json ─────────────────────────────────────────────
// File del template (uguale per ogni progetto): contiene gli header di sicurezza fissi.
// Stessa logica di ricerca di global-settings.json (env var → cwd → ../cwd). Se manca,
// security-headers.ts ricade su FALLBACK_SECURITY_HEADERS, così il server parte protetto.
function loadSecurityHeaders(): Record<string, string> {
    const candidates = [
        process.env['SECURITY_HEADERS_PATH'],
        resolve(process.cwd(), 'security-headers.json'),
        resolve(process.cwd(), '../security-headers.json'),
    ].filter((p): p is string => Boolean(p));

    for (const p of candidates) {
        try {
            if (existsSync(p)) {
                const parsed = JSON.parse(readFileSync(p, 'utf-8')) as { Security?: { Headers?: Record<string, string> } };
                return parsed.Security?.Headers ?? {};
            }
        } catch { /* prova il prossimo */ }
    }
    return {};
}

let _securityHeaders: Record<string, string> | undefined;

let _br1: Record<string, unknown> | undefined;
function br1(): Br1Json {
    return (_br1 ??= loadBr1Settings()) as Br1Json;
}

/** Accesso diretto all'intero global-settings.json — utile per leggere Custom.*  */
export function getBr1Settings(): Record<string, unknown> {
    return _br1 ??= loadBr1Settings();
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
    /** Valore per Express `trust proxy`. Impostato da TRUST_PROXY. */
    readonly trustProxy: string;
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
}

/** Header di sicurezza condivisi col backend, letti da security-headers.json (file del template). */
export interface SecurityEnv {
    /** Mappa header→valore. La CSP contiene {SCRIPT_NONCE_PLACEHOLDER}, sostituito per-request. */
    readonly headers: Readonly<Record<string, string>>;
}

/** Configurazione completa dell'ambiente server Node, tipizzata e raggruppata per area. */
export interface ServerEnv {
    readonly backend: BackendEnv;
    readonly server: NodeServerEnv;
    readonly site: SiteEnv;
    readonly security: SecurityEnv;
}

// ── Helper ────────────────────────────────────────────────────────────────────

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Host locali usati come fallback quando frontend.hostname e NG_ALLOWED_HOSTS sono entrambi vuoti.
 *  @angular/ssr NON riconosce '*' come wildcard globale (fa match solo letterale o '*.dominio'),
 *  quindi usarlo causa 400 Bad Request per qualsiasi host reale (localhost incluso).
 *  Il fallback a host locali espliciti permette lo sviluppo locale senza configurazione aggiuntiva. */
const LOCAL_DEV_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Parsa la lista host separata da virgole. Se il risultato è vuoto (né NG_ALLOWED_HOSTS né
 * frontend.hostname forniscono valori), usa LOCAL_DEV_HOSTS come fallback.
 *
 * Per restringere o ampliare l'allowlist: valorizzare NG_ALLOWED_HOSTS (env var, lista
 * separata da virgola) oppure frontend.hostname in global-settings.json.
 */
const parseAllowedHosts = (value: string | undefined): readonly string[] => {
    const hosts = (value ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter((host) => host.length > 0);
    return hosts.length > 0 ? hosts : LOCAL_DEV_HOSTS;
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
            apiKey: br1().Security?.ApiKeys?.[0] ?? process.env['BACKEND_API_KEY'] ?? '',
        };
    },
    get server(): NodeServerEnv {
        const hostname = br1().frontend?.hostname ?? '';
        return _server ??= {
            port:         parsePositiveInt(process.env['PORT'], br1().frontend?.port ?? 3000),
            trustProxy:   process.env['TRUST_PROXY'] ?? 'loopback, linklocal, uniquelocal',
            proxyTimeout: parsePositiveInt(process.env['PROXY_TIMEOUT_MS'], 30_000),
            allowedHosts: parseAllowedHosts(process.env['NG_ALLOWED_HOSTS'] || hostname),
        };
    },
    get site(): SiteEnv {
        const hostname = br1().frontend?.hostname ?? '';
        return _site ??= {
            baseUrl:             process.env['FRONTEND_BASE_URL'] || (hostname ? `https://${hostname}` : ''),
            assetsDir:           process.env['ASSETS_DIR'] ?? '',
            previewCryptoSecret: process.env['PREVIEW_CRYPTO_SECRET'] ?? '',
        };
    },
    get security(): SecurityEnv {
        return _security ??= {
            headers: (_securityHeaders ??= loadSecurityHeaders()),
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
            ['Security.ApiKeys[0]', serverEnv.backend.apiKey],
        ] as const
    ).filter(([, v]) => !v).map(([name]) => name);

    if (missing.length > 0)
        throw new Error(`[server-env] Configurazione obbligatoria mancante: ${missing.join(', ')}`);
}
