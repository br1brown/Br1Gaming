import { isPlatformBrowser } from '@angular/common';
import { Injectable, computed, inject, isDevMode, PLATFORM_ID, REQUEST, signal, DOCUMENT } from '@angular/core';
import { COOKIE_MAP, type CookieKey } from '../../services/cookie-registry';
import { SITE_CONFIG } from '../siteBuilder';
import { ConsentCategory, CookieConfig, CookieValueType, ENGINE_COOKIE_MAP, EngineCookieKey, ESSENTIAL_ENGINE_STORAGE_KEYS, CONSENT_COOKIE_MAP, CONSENT_KEYS, StorageMedium } from './cookie/cookie-type';

export type { CookieKey } from '../../services/cookie-registry';

/** Inferisce il tipo di ritorno di get/set da `valueType` in COOKIE_MAP/ENGINE_COOKIE_MAP; assente ⇒ string. */
export type InferCookieType<K extends CookieKey | EngineCookieKey> =
    (typeof ENGINE_COOKIE_MAP & typeof COOKIE_MAP)[K] extends { valueType: 'boolean' } ? boolean :
    (typeof ENGINE_COOKIE_MAP & typeof COOKIE_MAP)[K] extends { valueType: 'number' } ? number :
    (typeof ENGINE_COOKIE_MAP & typeof COOKIE_MAP)[K] extends { valueType: 'json' } ? unknown :
    string;

/** Se il consenso ai cookie TechnicalOptional (PWA/SW built-in o categoria omonima) è già salvato nel browser. Usata anche da app.config.ts per decidere il Service Worker prima del bootstrap Angular. */
export function isTechnicalOptionalConsentGiven(): boolean {
    try {
        if (typeof document === 'undefined') return false;

        // Per recuperare la chiave usiamo direttamente il builder bypassando la DI
        const fullKey = buildPhysicalCookieKey(CONSENT_KEYS.technicalOptional);
        if (!fullKey) return false;

        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(fullKey + '=')) {
                return decodeURIComponent(cookie.substring(fullKey.length + 1)) === '1';
            }
        }
        return false;
    } catch {
        return false;
    }
}

/** Nome fisico (namespace) con cui il cookie viene salvato. Esportata fuori dalla classe per non sporcare l'API pubblica del servizio. Null se `rawKey` non è censita. */
export function buildPhysicalCookieKey(rawKey: CookieKey | EngineCookieKey, config?: CookieConfig): string | null {
    if (rawKey === CookieConsentService.NGSW_WORKER) {
        return rawKey;
    }

    const cfg = config ?? ({ ...ENGINE_COOKIE_MAP, ...COOKIE_MAP } as Readonly<Record<string, CookieConfig | undefined>>)[rawKey];
    if (!cfg) {
        console.error(`[CookieConsentService] Cookie "${rawKey}" non censito.`);
        return null;
    }

    // Cookie di un provider terzo (`provider` valorizzato): il nome lo decide lui (`_ga`), non noi.
    // Prefissarlo darebbe in Cookie Policy un cookie che non esiste e alla revoca cancellerebbe quello sbagliato.
    if (cfg.provider) return rawKey;

    // Sanitizzazione sicura (sottobanco): rimuove qualsiasi carattere che non sia
    // alfanumerico, trattino o underscore per evitare problemi nel parser nativo
    const safeKey = rawKey.replace(/[^a-zA-Z0-9_-]/g, '');
    const prefix = ConsentCategory[cfg.category].toLowerCase();
    return `${prefix}_${safeKey}`;
}

/** Gestione centralizzata del consenso (ePrivacy + GDPR), "Privacy by Default": Technical è esente per legge (si dichiara, non si chiede); Analytics/Profiling/TechnicalOptional sbloccano la scrittura solo a consenso esplicito. */
@Injectable({ providedIn: 'root' })
export class CookieConsentService {
    public static readonly NGSW_WORKER = 'ngsw-worker.js';
    /** Memoria del consenso: 180 giorni. Le Linee guida cookie del Garante (2021) vietano di riproporre
     *  il banner prima di 6 mesi; allo scadere è ammesso. Più corta del Max-Age di default di `set()` (1
     *  anno), che vale per i cookie applicativi non soggetti a questo vincolo. */
    private static readonly CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

    private readonly document = inject(DOCUMENT);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    /** Richiesta SSR: serve a leggere i cookie lato server (document.cookie è vuoto in SSR). */
    private readonly request = inject(REQUEST, { optional: true });
    private readonly siteConfig = inject(SITE_CONFIG);

    /** True se il browser manda Global Privacy Control (opt-out universale, obbligatorio in California/Colorado/Connecticut dal 2026). `navigator.globalPrivacyControl` non è ancora in lib.dom: accesso tipizzato a mano. Sempre false in SSR (stato browser-only). */
    readonly gpcSignaled: boolean = this.isBrowser
        && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

    // ─── CATEGORIE: isNeeded ────────────────────────────────────────────
    //
    // Ogni computed guarda esclusivamente la propria fetta di COOKIE_MAP.

    /** True se c'è almeno una voce TechnicalOptional che richiede una VERA scelta (SW/PWA built-in o un cookie di progetto in quella categoria); tutte condividono lo stesso switch. Technical vero è esente per legge, non passa da qui — vedi `hasTechnicalCategory`. */
    readonly isTechnicalOptionalNeeded = computed(() =>
        this.siteConfig.isWebApp
        || (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === ConsentCategory.TechnicalOptional)
    );

    readonly isAnalyticsNeeded = computed(() =>
        (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === ConsentCategory.Analytics)
    );

    readonly isProfilingNeeded = computed(() =>
        (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === ConsentCategory.Profiling)
    );

    /** True se c'è almeno una voce Technical da DICHIARARE (banner/policy), a prescindere dal bisogno di consenso: cookie tecnici di progetto, `bearerToken` col login, e le memorie del consenso stesso quando un'altra categoria è attiva. Domanda diversa da `isCategoryAccepted` ("c'è da dichiarare?" vs "è permesso scrivere?"). Una nuova voce Technical built-in va aggiunta anche qui. */
    readonly hasTechnicalCategory = computed(() =>
        (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === ConsentCategory.Technical)
        || this.siteConfig.loginPage != null
        || this.isTechnicalOptionalNeeded()
        || this.isAnalyticsNeeded()
        || this.isProfilingNeeded()
    );

    /** True se almeno una categoria richiede una scelta dell'utente (quindi il banner deve
     *  comparire). I cookie strettamente necessari NON bastano da soli a farlo comparire: non c'è
     *  nulla su cui l'utente possa scegliere, solo l'obbligo di dichiararli nella Cookie Policy.
     *  Falso lato server: il banner non va nell'HTML SSR, compare solo dopo l'idratazione. */
    readonly isNeeded = computed(() =>
        this.isBrowser && (this.isTechnicalOptionalNeeded() || this.isAnalyticsNeeded() || this.isProfilingNeeded())
    );

    // ─── CONSENSO PER CATEGORIA ─────────────────────────────────────────

    private readonly _technicalOptionalAccepted = signal(false);
    private readonly _analyticsAccepted = signal(false);
    private readonly _profilingAccepted = signal(false);

    readonly technicalOptionalAccepted = this._technicalOptionalAccepted.asReadonly();
    readonly analyticsAccepted = this._analyticsAccepted.asReadonly();
    readonly profilingAccepted = this._profilingAccepted.asReadonly();

    /** Categorie spente per Global Privacy Control: segnale attivo, categoria in uso e non accettata.
     *  Un consenso esplicito già salvato prevale sul segnale (`applyGpcOptOut`): quella categoria è
     *  accesa e qui risulta `false`. */
    readonly gpcOptedOut = computed(() => ({
        analytics: this.gpcSignaled && this.isAnalyticsNeeded() && !this._analyticsAccepted(),
        profiling: this.gpcSignaled && this.isProfilingNeeded() && !this._profilingAccepted(),
    }));

    /** True se l'utente ha interagito con il banner (ora o in sessioni precedenti).
     *  Sola lettura: si modifica solo via accept/reject/saveSelected/reopen. */
    private readonly _responded = signal(false);
    readonly responded = this._responded.asReadonly();

    /** Voci built-in del motore attive per questa configurazione (cookie lingua/SW/memorie del
     *  consenso + Web Storage consent_log/bearerToken). Esposte alla policy per l'elenco unico. */
    private readonly _activeEngine = signal<Record<string, CookieConfig>>({});
    readonly activeEngine = this._activeEngine.asReadonly();
    private readonly _cm: Readonly<Record<string, CookieConfig | undefined>>;

    constructor() {
        // Popoliamo le voci "engine" (built-in) dinamicamente in base alla configurazione.
        // Mappa unica: cookie (lingua, SW, memorie del consenso) + Web Storage (consent_log, bearerToken).
        const engine: Record<string, CookieConfig> = {};

        // Se è una PWA, il cookie del service worker diventa necessario
        if (this.siteConfig.isWebApp) {
            engine[CookieConsentService.NGSW_WORKER] = ENGINE_COOKIE_MAP['ngsw-worker.js'];
        }

        // Architettura reattiva: le proprietà isXxxNeeded() sono computed signals.
        // Durante la fase di costruttore (o init), chiamarle potrebbe restituire dati falsati o dare errore
        // se altri signal di cui dipendono non si sono stabilizzati.
        // Per questo motivo, qui ricalcoliamo la stessa logica "a mano" in modo sincrono usando i dati grezzi.
        const isTechnicalOptionalNeededNow =
            this.siteConfig.isWebApp
            || (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === ConsentCategory.TechnicalOptional);

        const isAnalyticsNeededNow = (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === ConsentCategory.Analytics);
        const isProfilingNeededNow = (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === ConsentCategory.Profiling);

        // Se una categoria richiede consenso, registriamo i cookie built-in che memorizzano quel consenso
        if (isTechnicalOptionalNeededNow) engine[CONSENT_KEYS.technicalOptional] = CONSENT_COOKIE_MAP[CONSENT_KEYS.technicalOptional];
        if (isAnalyticsNeededNow) engine[CONSENT_KEYS.analytics] = CONSENT_COOKIE_MAP[CONSENT_KEYS.analytics];
        if (isProfilingNeededNow) engine[CONSENT_KEYS.profiling] = CONSENT_COOKIE_MAP[CONSENT_KEYS.profiling];

        // Web Storage del motore: consent_log quando il banner è attivo, bearerToken solo se è
        // configurato un login. Essenziali → elencati in policy ma esclusi dalla pulizia alla revoca.
        if (isTechnicalOptionalNeededNow || isAnalyticsNeededNow || isProfilingNeededNow) {
            engine['consent_log'] = ENGINE_COOKIE_MAP['consent_log'];
        }
        if (this.siteConfig.loginPage != null) {
            engine['bearerToken'] = ENGINE_COOKIE_MAP['bearerToken'];
        }

        this._activeEngine.set(engine);
        this._cm = { ...engine, ...COOKIE_MAP };

        if (this.isBrowser) {
            try {
                const technicalOptionalStored = this.get(CONSENT_KEYS.technicalOptional);
                let analyticsStored = this.get(CONSENT_KEYS.analytics);
                let profilingStored = this.get(CONSENT_KEYS.profiling);

                // GPC: opt-out per Analytics/Profiling (mai Technical/TechnicalOptional, GPC riguarda
                // solo vendita/condivisione dati), solo se l'utente non ha già risposto (una scelta dal
                // banner prevale sempre). Va REGISTRATO subito, non solo applicato in-memory, altrimenti
                // il banner riproporrebbe la domanda ogni visita nonostante il browser dica già "no".
                analyticsStored = this.applyGpcOptOut(CONSENT_KEYS.analytics, isAnalyticsNeededNow, analyticsStored);
                profilingStored = this.applyGpcOptOut(CONSENT_KEYS.profiling, isProfilingNeededNow, profilingStored);

                if (technicalOptionalStored !== null) this._technicalOptionalAccepted.set(technicalOptionalStored);
                if (analyticsStored !== null) this._analyticsAccepted.set(analyticsStored);
                if (profilingStored !== null) this._profilingAccepted.set(profilingStored);

                const anyStored = technicalOptionalStored !== null || analyticsStored !== null || profilingStored !== null;
                const allAnswered =
                    (!isTechnicalOptionalNeededNow || technicalOptionalStored !== null) &&
                    (!isAnalyticsNeededNow || analyticsStored !== null) &&
                    (!isProfilingNeededNow || profilingStored !== null);
                if (anyStored && allAnswered) this._responded.set(true);

                // ─── PULIZIA DEI COOKIE REVOCATI ───
                this.clearRevokedCookies();

                // ─── PULIZIA SW ALL'AVVIO ───
                // Se la PWA non deve essere attiva (isWebApp:false o consenso negato) ma un
                // SW è rimasto da una sessione/configurazione precedente, de-registralo subito: gli
                // utenti di ritorno già "risposti" non rivedono il banner e non ripassano da
                // persistConsent, quindi senza questo il SW resterebbe vivo a servire una cache obsoleta.
                if (!isDevMode() && (!this.siteConfig.isWebApp || !this._technicalOptionalAccepted())) {
                    this.unregisterServiceWorker();
                }
            } catch { }
        }
    }

    /** Applica l'opt-out da Global Privacy Control a una categoria (Analytics o Profiling): se il
     *  segnale è attivo, la categoria serve, e l'utente non ha ancora risposto, registra un rifiuto
     *  e ritorna `false`; altrimenti ritorna `stored` invariato. Fattorizza la stessa logica per le
     *  due categorie a cui GPC si applica (mai Technical/TechnicalOptional). */
    private applyGpcOptOut(
        key: typeof CONSENT_KEYS.analytics | typeof CONSENT_KEYS.profiling,
        needed: boolean,
        stored: boolean | null,
    ): boolean | null {
        if (!this.gpcSignaled || !needed || stored !== null) return stored;
        this.set(key, false, CookieConsentService.CONSENT_MAX_AGE_SECONDS);
        return false;
    }


    // ─── GESTIONE CONSENSO ──────────────────────────────────────────────

    /** Accetta tutte le categorie attualmente attive. */
    accept(): void {
        if (this.isTechnicalOptionalNeeded()) this._technicalOptionalAccepted.set(true);
        if (this.isAnalyticsNeeded()) this._analyticsAccepted.set(true);
        if (this.isProfilingNeeded()) this._profilingAccepted.set(true);
        this._responded.set(true);
        this.persistConsent();
    }

    /** Rifiuta tutte le categorie. */
    reject(): void {
        this._technicalOptionalAccepted.set(false);
        this._analyticsAccepted.set(false);
        this._profilingAccepted.set(false);
        this._responded.set(true);
        this.persistConsent();
    }

    /** Riapre il banner per permettere all'utente di modificare le proprie preferenze. */
    reopen(): void {
        this._responded.set(false);
    }

    /** Salva la selezione granulare fatta dall'utente tramite i toggle del banner. */
    saveSelected(technicalOptional: boolean, analytics: boolean, profiling: boolean): void {
        if (this.isTechnicalOptionalNeeded()) this._technicalOptionalAccepted.set(technicalOptional);
        if (this.isAnalyticsNeeded()) this._analyticsAccepted.set(analytics);
        if (this.isProfilingNeeded()) this._profilingAccepted.set(profiling);
        this._responded.set(true);
        this.persistConsent();
    }

    /**
     * Salva le scelte per categoria, poi applica i side effect. Scrive anche `consent_log`: l'ultima
     * scelta salvata sul dispositivo (categorie, data, versione del sito), non un registro lato server.
     */
    private persistConsent(): void {
        if (!this.isBrowser) return;
        try {
            if (this.isTechnicalOptionalNeeded())
                this.set(CONSENT_KEYS.technicalOptional, this._technicalOptionalAccepted(), CookieConsentService.CONSENT_MAX_AGE_SECONDS);
            else
                this.remove(CONSENT_KEYS.technicalOptional);

            if (this.isAnalyticsNeeded())
                this.set(CONSENT_KEYS.analytics, this._analyticsAccepted(), CookieConsentService.CONSENT_MAX_AGE_SECONDS);
            else
                this.remove(CONSENT_KEYS.analytics);

            if (this.isProfilingNeeded())
                this.set(CONSENT_KEYS.profiling, this._profilingAccepted(), CookieConsentService.CONSENT_MAX_AGE_SECONDS);
            else
                this.remove(CONSENT_KEYS.profiling);

            const logValue = JSON.stringify({
                categories: {
                    technicalOptional: this._technicalOptionalAccepted(),
                    analytics: this._analyticsAccepted(),
                    profiling: this._profilingAccepted(),
                },
                timestamp: new Date().toISOString(),
                version: this.siteConfig.version,
            });
            localStorage.setItem('consent_log', logValue);
        } catch { }

        try {
            // ─── SIDE EFFECT DEL CONSENSO ───────────────────────────────────────

            // 1. Service Worker: allinea lo stato del SW al flag isWebApp e al consenso TechnicalOptional.
            if (!isDevMode() && 'serviceWorker' in navigator) {
                if (this.siteConfig.isWebApp && this._technicalOptionalAccepted()) {
                    // PWA attiva e consenso dato: registra nella sessione corrente (se non già presente).
                    navigator.serviceWorker.getRegistration().then(existing => {
                        if (!existing) {
                            navigator.serviceWorker.register(CookieConsentService.NGSW_WORKER, { scope: '/' }).catch(() => { });
                        }
                    });
                } else {
                    // PWA disattivata (isWebApp:false) o consenso tecnico negato: de-registra ogni SW
                    // residuo e svuota le sue cache, così chi aveva già il SW non resta servito da una
                    // copia obsoleta. Stessa pulizia gira anche all'avvio (costruttore), per gli utenti
                    // di ritorno che non ripassano da qui.
                    this.unregisterServiceWorker();
                }
            }

            // 2. Pulizia: rimuove attivamente tutti i cookie la cui categoria non è approvata
            this.clearRevokedCookies();
        } catch { }
    }

    // ─── GESTIONE ARCHIVIAZIONE (cookie + Web Storage) ──────────────────
    // Chiave fisica del cookie: {category}_{rawKey} (eccetto service worker); per il Web Storage
    // è raw. Il mezzo lo decide `config.storage`. Una chiave non censita blocca la scrittura.

    /** Scrive una voce (cookie o Web Storage, secondo `config.storage`). Bloccata se la chiave non è censita o manca il consenso (Privacy by Default); i memo del consenso stesso bypassano il gate. */
    set<K extends CookieKey | EngineCookieKey>(key: K, value: InferCookieType<K>, maxAgeSeconds: number = 60 * 60 * 24 * 365): void {
        const rawKey = key as string;
        const config = this._cm[rawKey];
        if (!config || !this.isBrowser) return;

        // Voce a prefisso: rappresenta una famiglia di chiavi create dal provider (non da noi) →
        // la scrittura via API non ha una chiave singola su cui operare. È solo policy + pulizia.
        if (config.match === 'prefix') return;

        // I memo del consenso bypassano il gate, altrimenti non potremmo salvare uno "0" su rifiuto.
        const isConsentMemo = (Object.values(CONSENT_KEYS) as string[]).includes(rawKey);
        if (!this.isCategoryAccepted(config.category) && !isConsentMemo) return;

        const strValue = this.serialize(value, config.valueType);
        if (strValue === null) return; // valore non serializzabile → nessuna scrittura (niente crash)
        const medium = config.storage ?? 'cookie';

        if (medium === 'cookie') {
            const fullKey = buildPhysicalCookieKey(key, config);
            if (!fullKey) return;
            this.document.cookie = `${fullKey}=${encodeURIComponent(strValue)}; Max-Age=${maxAgeSeconds}${this.cookieSecurityAttributes()}`;
        } else {
            this.writeWebStorage(rawKey, strValue, medium);
        }
    }

    /** Serializza un valore in stringa secondo il `valueType` (comune a cookie e Web Storage).
     *  Ritorna `null` se il valore non è serializzabile (JSON circolare, `undefined`, ecc.): la
     *  scrittura viene SALTATA invece di propagare un'eccezione e rompere il chiamante. */
    private serialize(value: unknown, type: CookieValueType = 'string'): string | null {
        try {
            if (type === 'boolean') return value ? '1' : '0';
            if (type === 'number') return String(value);
            if (type === 'json') return JSON.stringify(value) ?? null;
            return String(value);
        } catch (err) {
            if (isDevMode()) console.warn('[CookieConsentService] valore non serializzabile, scrittura saltata', err);
            return null;
        }
    }

    /** Attributi di sicurezza comuni: `Secure` aggiunto automaticamente se la pagina è su HTTPS, deciso a runtime dal protocollo (zero-config). */
    private cookieSecurityAttributes(): string {
        const secure = this.isBrowser && this.document.location?.protocol === 'https:' ? '; Secure' : '';
        return `; Path=/; SameSite=Lax${secure}`;
    }

    /** Legge una voce (cookie o Web Storage). Le letture non richiedono consenso (il gate è solo sulla scrittura). I cookie si leggono anche in SSR; il Web Storage è browser-only → null in SSR (non usarlo per contenuto renderizzato SSR). */
    get<K extends CookieKey | EngineCookieKey>(key: K): InferCookieType<K> | null {
        const config = this._cm[key as string];
        if (!config) return null;
        const medium = config.storage ?? 'cookie';
        const raw = medium === 'cookie'
            ? this.readRawCookie(buildPhysicalCookieKey(key, config) ?? (key as string))
            : this.readWebStorage(key as string, medium);
        if (raw === null) return null;
        return this.deserialize<InferCookieType<K>>(raw, config.valueType);
    }

    /** Deserializza una stringa nel tipo dichiarato (`valueType`). Comune a cookie e Web Storage. */
    private deserialize<T>(raw: string, type: CookieValueType = 'string'): T | null {
        if (type === 'boolean') return (raw === '1' || raw === 'true') as T;
        if (type === 'number') { const n = parseFloat(raw); return isNaN(n) ? null : (n as T); }
        if (type === 'json') { try { return JSON.parse(raw) as T; } catch { return null; } }
        return raw as T;
    }

    /** Valore grezzo: da `document.cookie` nel browser, dall'header `cookie` della REQUEST in SSR — senza, `get` tornerebbe sempre null lato server e un cookie letto per personalizzare il render SSR uscirebbe con l'HTML sbagliato fino all'idratazione. */
    private readRawCookie(fullKey: string): string | null {
        const header = this.isBrowser
            ? this.document.cookie
            : (this.request?.headers.get('cookie') ?? '');
        if (!header) return null;
        for (const part of header.split(';')) {
            const cookie = part.trim();
            if (cookie.startsWith(fullKey + '=')) {
                return decodeURIComponent(cookie.substring(fullKey.length + 1));
            }
        }
        return null;
    }

    /** Rimuove una voce; a differenza della scrittura, sempre consentita anche a consenso revocato. */
    remove(key: CookieKey | EngineCookieKey): void {
        if (!this.isBrowser) return;
        const config = this._cm[key as string];
        const medium = config?.storage ?? 'cookie';
        if (medium === 'cookie') {
            // Best-effort: una chiave non censita qui è innocua, risolviamo il nome in silenzio.
            const fullKey = config ? buildPhysicalCookieKey(key, config) ?? (key as string) : (key as string);
            this.document.cookie = `${fullKey}=; Max-Age=0${this.cookieSecurityAttributes()}`;
            // Un SDK terzo scrive di solito con `Domain=.dominio.tld`: senza lo stesso Domain la
            // cancellazione non lo tocca. Best-effort sul dominio corrente e sui suoi genitori; il gate
            // vero resta non caricare l'SDK prima del consenso.
            if (config?.provider) {
                const parts = (this.document.location?.hostname ?? '').split('.');
                for (let i = 0; i < parts.length - 1; i++) {
                    const domain = parts.slice(i).join('.');
                    this.document.cookie = `${fullKey}=; Max-Age=0; Path=/; Domain=${domain}${this.cookieSecurityAttributes()}`;
                    this.document.cookie = `${fullKey}=; Max-Age=0; Path=/; Domain=.${domain}${this.cookieSecurityAttributes()}`;
                }
            }
        } else {
            this.removeWebStorage(key as string, medium, config?.match);
        }
    }

    /** Scrive nel Web Storage (browser-only, best-effort). Chiave raw, non prefissata come i cookie. */
    private writeWebStorage(rawKey: string, value: string, medium: StorageMedium): void {
        if (!this.isBrowser) return;
        try { (medium === 'session' ? sessionStorage : localStorage).setItem(rawKey, value); } catch { }
    }

    /** Legge dal Web Storage (browser-only). Chiave raw. */
    private readWebStorage(rawKey: string, medium: StorageMedium): string | null {
        if (!this.isBrowser) return null;
        try { return (medium === 'session' ? sessionStorage : localStorage).getItem(rawKey); } catch { return null; }
    }

    // ─── HELPER INTERNI ───────────────────────────────────────────────

    /** Technical è esente per legge (art. 122 Codice Privacy / art. 5.3 ePrivacy): SEMPRE true, senza condizioni. NON legarla a `hasTechnicalCategory()`: quel computed non vede tutte le vie con cui un cookie Technical built-in entra in `_cm` (es. `bearerToken` col login) — legarli bloccherebbe in silenzio siti solo-login. */
    private isCategoryAccepted(category: ConsentCategory): boolean {
        switch (category) {
            case ConsentCategory.Technical: return true;
            case ConsentCategory.TechnicalOptional: return this._technicalOptionalAccepted();
            case ConsentCategory.Analytics: return this._analyticsAccepted();
            case ConsentCategory.Profiling: return this._profilingAccepted();
            default: return false;
        }
    }

    /** De-registra ogni Service Worker residuo e svuota le cache; idempotente. Usato quando la PWA non deve essere attiva, così un SW registrato in passato non continua a servire una copia obsoleta. */
    private unregisterServiceWorker(): void {
        if (!this.isBrowser || !('serviceWorker' in navigator)) return;
        navigator.serviceWorker.getRegistrations()
            .then(regs => regs.forEach(r => r.unregister().catch(() => { })))
            .catch(() => { });
        if (typeof caches !== 'undefined') {
            caches.keys()
                .then(keys => keys.forEach(k => caches.delete(k).catch(() => { })))
                .catch(() => { });
        }
    }

    /**
     * Rimuove fisicamente dal browser tutte le voci gestite (cookie + Web Storage) la cui categoria
     * è attualmente rifiutata dall'utente. Sono ignorate: le memorie del consenso e il Web Storage
     * essenziale del motore (consent_log, bearerToken), per non perdere l'ultima scelta salvata e la sessione.
     */
    private clearRevokedCookies(): void {
        if (!this.isBrowser) return;

        for (const [rawKey, config] of Object.entries(this._cm) as [string, CookieConfig | undefined][]) {
            // Saltiamo: Service Worker, memorie del consenso e Web Storage essenziale del motore.
            if (!config
                || rawKey === CookieConsentService.NGSW_WORKER
                || (Object.values(CONSENT_KEYS) as string[]).includes(rawKey)
                || (ESSENTIAL_ENGINE_STORAGE_KEYS as readonly string[]).includes(rawKey)) {
                continue;
            }
            // remove() instrada da solo su cookie o Web Storage in base a config.storage.
            if (!this.isCategoryAccepted(config.category)) {
                this.remove(rawKey as CookieKey | EngineCookieKey);
            }
        }
    }

    /** Rimuove una voce dal Web Storage (browser-only, best-effort). Il nome è la chiave raw,
     *  non prefissata come i cookie. Con `match:'prefix'` rimuove l'intera famiglia di chiavi che
     *  iniziano per `rawKey` (telemetria di terza parte con suffisso dinamico), altrimenti la
     *  singola chiave esatta. */
    private removeWebStorage(rawKey: string, medium: StorageMedium, match: 'exact' | 'prefix' = 'exact'): void {
        if (!this.isBrowser) return;
        try {
            const store = medium === 'session' ? sessionStorage : localStorage;
            if (match === 'prefix') {
                // Snapshot delle chiavi: removeItem muta l'indice dello Storage durante il ciclo.
                // Le chiavi ESSENZIALI del motore (consent_log, bearerToken) sono saltate SEMPRE: un
                // prefisso del progetto non può conoscerle né distinguerle, ma cancellarle vuol dire
                // perdere l'ultima scelta di consenso salvata o la sessione. Sono protette a monte in
                // clearRevokedCookies per le loro voci; qui va difeso anche il match collaterale.
                for (const k of Object.keys(store)) {
                    if (k.startsWith(rawKey) && !(ESSENTIAL_ENGINE_STORAGE_KEYS as readonly string[]).includes(k)) {
                        store.removeItem(k);
                    }
                }
            } else {
                store.removeItem(rawKey);
            }
        } catch { }
    }
}
