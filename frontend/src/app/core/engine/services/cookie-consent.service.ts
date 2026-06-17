import { isPlatformBrowser } from '@angular/common';
import { Injectable, computed, inject, isDevMode, PLATFORM_ID, REQUEST, signal, DOCUMENT } from '@angular/core';
import { COOKIE_MAP, type CookieKey } from '../../services/cookie-registry';
import { LOCALE_CONFIG } from '../services/translate.service';
import { SITE_CONFIG } from '../siteBuilder';
import { CookieCategory, CookieConfig, ENGINE_COOKIE_MAP, EngineCookieKey, CONSENT_COOKIE_MAP, CONSENT_KEYS } from './cookie/cookie-type';

export type { CookieKey } from '../../services/cookie-registry';

/**
 * Utility type per inferire il tipo di ritorno di getCookie/setCookie in base alla configurazione.
 * Legge la proprietà 'valueType' da COOKIE_MAP o ENGINE_COOKIE_MAP. Se non specificata, ricade su 'string'.
 */
export type InferCookieType<K extends CookieKey | EngineCookieKey> =
    (typeof ENGINE_COOKIE_MAP & typeof COOKIE_MAP)[K] extends { valueType: 'boolean' } ? boolean :
    (typeof ENGINE_COOKIE_MAP & typeof COOKIE_MAP)[K] extends { valueType: 'number' } ? number :
    (typeof ENGINE_COOKIE_MAP & typeof COOKIE_MAP)[K] extends { valueType: 'json' } ? unknown :
    string;

/**
 * Controlla se il consenso tecnico è stato già salvato nei cookie fisici del browser.
 * Fonte unica della chiave — usata anche da app.config.ts per decidere
 * se abilitare il Service Worker all'avvio dell'app prima del bootstrap di Angular.
 * 
 * @returns {boolean} True se il cookie di consenso tecnico è presente e vale '1'.
 */
export function isTechnicalConsentGiven(): boolean {
    try {
        if (typeof document === 'undefined') return false;

        // Per recuperare la chiave usiamo direttamente il builder bypassando la DI
        const fullKey = buildPhysicalCookieKey(CONSENT_KEYS.technical);
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

/**
 * Costruisce il nome fisico completo (namespace) con cui il cookie verrà salvato nel browser.
 * Questa funzione è esportata ma vive fuori dalla classe del servizio, in modo da non sporcare
 * l'API pubblica che gli sviluppatori vedono quando iniettano CookieConsentService.
 *
 * @param rawKey Chiave di base censita in COOKIE_MAP o ENGINE_COOKIE_MAP.
 * @param config Parametro opzionale per fornire la configurazione senza re-interrogare la mappa.
 * @returns Il nome del cookie sanificato e prefissato, o null se la chiave non è censita.
 */
export function buildPhysicalCookieKey(rawKey: CookieKey | EngineCookieKey, config?: CookieConfig): string | null {
    if (rawKey === CookieConsentService.NGSW_WORKER) {
        return rawKey;
    }

    const cfg = config ?? ({ ...ENGINE_COOKIE_MAP, ...COOKIE_MAP } as Readonly<Record<string, CookieConfig | undefined>>)[rawKey];
    if (!cfg) {
        console.error(`[CookieConsentService] Cookie "${rawKey}" non censito.`);
        return null;
    }

    // Sanitizzazione sicura (sottobanco): rimuove qualsiasi carattere che non sia
    // alfanumerico, trattino o underscore per evitare problemi nel parser nativo
    const safeKey = rawKey.replace(/[^a-zA-Z0-9_-]/g, '');
    const prefix = CookieCategory[cfg.category].toLowerCase();
    return `${prefix}_${safeKey}`;
}

/**
 * COOKIE CONSENT SERVICE
 * Gestione centralizzata del consenso cookie — Conformità EU (ePrivacy + GDPR).
 *
 * Il principio cardine è il "Privacy by Default": le scritture sono bloccate
 * finché l'utente non esprime un consenso esplicito per la categoria relativa.
 *
 * isXxxNeeded è auto-calcolata dalla propria fetta di COOKIE_MAP.
 * Aggiungere un cookie a COOKIE_MAP fa comparire automaticamente la sezione nel banner.
 *
 * Le funzionalità built-in (lingua e service worker) sono gestite tramite
 * ENGINE_COOKIE_MAP per mantenere la COOKIE_MAP pulita per lo sviluppatore.
 */
@Injectable({ providedIn: 'root' })
export class CookieConsentService {
    public static readonly NGSW_WORKER = 'ngsw-worker.js';

    private readonly document = inject(DOCUMENT);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    /** Richiesta SSR: serve a leggere i cookie lato server (document.cookie è vuoto in SSR). */
    private readonly request = inject(REQUEST, { optional: true });
    private readonly localeConfig = inject(LOCALE_CONFIG);
    private readonly siteConfig = inject(SITE_CONFIG);

    // ─── CATEGORIE: isNeeded ────────────────────────────────────────────
    //
    // Ogni computed guarda esclusivamente la propria fetta di COOKIE_MAP.
    // isTechnicalNeeded include anche lingua built-in (multilingua) e SW (isWebApp).
    //
    // Usa localeConfig.availableLanguages (lista raw da global-settings.json) — non la lista
    // post-probeLanguages di TranslateService, che può essere ridotta se un file JSON
    // manca. La decisione sul cookie deve riflettere la configurazione dichiarata,
    // non l'esito dei file probe: altrimenti un file mancante fa sparire silenziosamente
    // il banner e blocca il salvataggio del consenso in un loop.

    readonly isTechnicalNeeded = computed(() =>
        this.localeConfig.availableLanguages.length > 1
        || this.siteConfig.isWebApp
        || (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === CookieCategory.Technical)
    );

    readonly isAnalyticsNeeded = computed(() =>
        (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === CookieCategory.Analytics)
    );

    readonly isProfilingNeeded = computed(() =>
        (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === CookieCategory.Profiling)
    );

    /** True se almeno una categoria richiede il consenso.
     *  Falso lato server: il banner non va nell'HTML SSR, compare solo dopo l'idratazione. */
    readonly isNeeded = computed(() =>
        this.isBrowser && (this.isTechnicalNeeded() || this.isAnalyticsNeeded() || this.isProfilingNeeded())
    );

    // ─── CONSENSO PER CATEGORIA ─────────────────────────────────────────

    private readonly _technicalAccepted = signal(false);
    private readonly _analyticsAccepted = signal(false);
    private readonly _profilingAccepted = signal(false);

    readonly technicalAccepted = this._technicalAccepted.asReadonly();
    readonly analyticsAccepted = this._analyticsAccepted.asReadonly();
    readonly profilingAccepted = this._profilingAccepted.asReadonly();

    /** True se l'utente ha interagito con il banner (ora o in sessioni precedenti).
     *  Sola lettura: si modifica solo via accept/reject/saveSelected/reopen. */
    private readonly _responded = signal(false);
    readonly responded = this._responded.asReadonly();

    private readonly _activeEngineCookies = signal<Record<string, CookieConfig>>({});
    readonly activeEngineCookies = this._activeEngineCookies.asReadonly();
    private readonly _cm: Readonly<Record<string, CookieConfig | undefined>>;

    constructor() {
        // Popoliamo i cookie "engine" (built-in) dinamicamente in base alla configurazione.
        const engineCookies: Record<string, CookieConfig> = {};

        // Se ci sono più lingue, il cookie della lingua diventa tecnicamente necessario
        if (this.localeConfig.availableLanguages.length > 1) {
            engineCookies['lang'] = ENGINE_COOKIE_MAP['lang'];
        }

        // Se è una PWA, il cookie del service worker diventa necessario
        if (this.siteConfig.isWebApp) {
            engineCookies[CookieConsentService.NGSW_WORKER] = ENGINE_COOKIE_MAP['ngsw-worker.js'];
        }

        // ATTENZIONE: le proprietà isXxxNeeded() sono computed signals.
        // Durante la fase di costruttore (o init), chiamarle potrebbe restituire dati falsati o dare errore 
        // se altri signal di cui dipendono non si sono stabilizzati.
        // Per questo motivo, qui ricalcoliamo la stessa logica "a mano" in modo sincrono usando i dati grezzi.
        const isTechnicalNeededNow =
            this.localeConfig.availableLanguages.length > 1
            || this.siteConfig.isWebApp
            || (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === CookieCategory.Technical);

        const isAnalyticsNeededNow = (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === CookieCategory.Analytics);
        const isProfilingNeededNow = (Object.values(COOKIE_MAP) as CookieConfig[]).some(c => c.category === CookieCategory.Profiling);

        // Se una categoria richiede consenso, registriamo i cookie built-in che memorizzano quel consenso
        if (isTechnicalNeededNow) engineCookies[CONSENT_KEYS.technical] = CONSENT_COOKIE_MAP[CONSENT_KEYS.technical];
        if (isAnalyticsNeededNow) engineCookies[CONSENT_KEYS.analytics] = CONSENT_COOKIE_MAP[CONSENT_KEYS.analytics];
        if (isProfilingNeededNow) engineCookies[CONSENT_KEYS.profiling] = CONSENT_COOKIE_MAP[CONSENT_KEYS.profiling];

        this._activeEngineCookies.set(engineCookies);
        this._cm = { ...engineCookies, ...COOKIE_MAP };

        if (this.isBrowser) {
            try {
                const technicalStored = this.getCookie(CONSENT_KEYS.technical);
                const analyticsStored = this.getCookie(CONSENT_KEYS.analytics);
                const profilingStored = this.getCookie(CONSENT_KEYS.profiling);

                if (technicalStored !== null) this._technicalAccepted.set(technicalStored);
                if (analyticsStored !== null) this._analyticsAccepted.set(analyticsStored);
                if (profilingStored !== null) this._profilingAccepted.set(profilingStored);

                const anyStored = technicalStored !== null || analyticsStored !== null || profilingStored !== null;
                const allAnswered =
                    (!isTechnicalNeededNow || technicalStored !== null) &&
                    (!isAnalyticsNeededNow || analyticsStored !== null) &&
                    (!isProfilingNeededNow || profilingStored !== null);
                if (anyStored && allAnswered) this._responded.set(true);

                // ─── PULIZIA DEI COOKIE REVOCATI ───
                this.clearRevokedCookies();

                // ─── PULIZIA SW ALL'AVVIO ───
                // Se la PWA non deve essere attiva (isWebApp:false o consenso tecnico negato) ma un
                // SW è rimasto da una sessione/configurazione precedente, de-registralo subito: gli
                // utenti di ritorno già "risposti" non rivedono il banner e non ripassano da
                // persistConsent, quindi senza questo il SW resterebbe vivo a servire una cache obsoleta.
                if (!isDevMode() && (!this.siteConfig.isWebApp || !this._technicalAccepted())) {
                    this.unregisterServiceWorker();
                }
            } catch { }
        }
    }



    // ─── GESTIONE CONSENSO ──────────────────────────────────────────────

    /** Accetta tutte le categorie attualmente attive. */
    accept(): void {
        if (this.isTechnicalNeeded()) this._technicalAccepted.set(true);
        if (this.isAnalyticsNeeded()) this._analyticsAccepted.set(true);
        if (this.isProfilingNeeded()) this._profilingAccepted.set(true);
        this._responded.set(true);
        this.persistConsent();
    }

    /** Rifiuta tutte le categorie. */
    reject(): void {
        this._technicalAccepted.set(false);
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
    saveSelected(technical: boolean, analytics: boolean, profiling: boolean): void {
        if (this.isTechnicalNeeded()) this._technicalAccepted.set(technical);
        if (this.isAnalyticsNeeded()) this._analyticsAccepted.set(analytics);
        if (this.isProfilingNeeded()) this._profilingAccepted.set(profiling);
        this._responded.set(true);
        this.persistConsent();
    }

    /**
     * Salva le scelte per categoria, poi applica i side effect.
     * Include log per dimostrare la conformità in caso di audit (Accountability GDPR).
     */
    private persistConsent(): void {
        if (!this.isBrowser) return;
        try {
            if (this.isTechnicalNeeded())
                this.setCookie(CONSENT_KEYS.technical, this._technicalAccepted());
            else
                this.removeCookie(CONSENT_KEYS.technical);

            if (this.isAnalyticsNeeded())
                this.setCookie(CONSENT_KEYS.analytics, this._analyticsAccepted());
            else
                this.removeCookie(CONSENT_KEYS.analytics);

            if (this.isProfilingNeeded())
                this.setCookie(CONSENT_KEYS.profiling, this._profilingAccepted());
            else
                this.removeCookie(CONSENT_KEYS.profiling);

            const logValue = JSON.stringify({
                categories: {
                    technical: this._technicalAccepted(),
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

            // 1. Service Worker: allinea lo stato del SW al flag isWebApp e al consenso tecnico.
            if (!isDevMode() && 'serviceWorker' in navigator) {
                if (this.siteConfig.isWebApp && this._technicalAccepted()) {
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

    // ─── GESTIONE COOKIE ────────────────────────────────────────────────
    //
    // Chiave fisica nel browser: {category}.{rawKey} (eccetto service worker)
    //
    // Gestisce in modo unificato sia CookieKey (progetto) che EngineCookieKey (built-in).
    //
    // I tre metodi includono un check runtime difensivo per eventuali cast `as any`.
    // Una chiave non censita blocca la scrittura con console.error (Privacy by Default).

    /**
     * Scrive un cookie fisicamente nel browser dell'utente.
     * La scrittura viene automaticamente bloccata se la chiave non è censita (per prevenire cookie "orfani")
     * o se l'utente non ha prestato il consenso per la categoria relativa.
     *
     * @param key La chiave tipizzata del cookie (es. 'temaScuro'), deve essere presente in `COOKIE_MAP`.
     * @param value Il valore tipizzato in base alla configurazione.
     * @param maxAgeSeconds La durata del cookie in secondi (es. `60 * 60 * 24` per un giorno).
     */
    setCookie<K extends CookieKey | EngineCookieKey>(key: K, value: InferCookieType<K>, maxAgeSeconds: number = 60 * 60 * 24 * 365): void {
        const rawKey = key as string;
        const config = this._cm[rawKey];
        const fullKey = buildPhysicalCookieKey(key, config);
        
        // I cookie di stato del consenso bypassano il blocco di scrittura,
        // altrimenti non potremmo memorizzare uno "0" se l'utente rifiuta i tecnici!
        const isConsentMemo = (Object.values(CONSENT_KEYS) as string[]).includes(rawKey);
        
        if (!fullKey || !config || (!this.isCategoryAccepted(config.category) && !isConsentMemo) || !this.isBrowser) return;

        let strValue = '';
        const type = config.valueType || 'string';

        if (type === 'boolean')
            strValue = value ? '1' : '0';
        else if (type === 'number')
            strValue = String(value);
        else if (type === 'json')
            strValue = JSON.stringify(value);
        else
            strValue = String(value);

        this.document.cookie = `${fullKey}=${encodeURIComponent(strValue)}; Max-Age=${maxAgeSeconds}${this.cookieSecurityAttributes()}`;
    }

    /**
     * Attributi di sicurezza comuni a tutti i cookie scritti dal template.
     * `Secure` viene aggiunto automaticamente quando la pagina è servita su HTTPS:
     * in produzione (dietro reverse proxy TLS) i cookie viaggiano solo cifrati, mentre
     * in locale su http restano scrivibili. Zero-config, deciso a runtime dal protocollo.
     */
    private cookieSecurityAttributes(): string {
        const secure = this.isBrowser && this.document.location?.protocol === 'https:' ? '; Secure' : '';
        return `; Path=/; SameSite=Lax${secure}`;
    }

    /**
     * Legge il valore di un cookie.
     * La lettura viene bloccata (ritorna `null`) se la chiave non è censita.
     * Non verifica il consenso attuale, limitandosi a restituire il valore fisicamente presente nel browser.
     *
     * @param key La chiave tipizzata del cookie.
     * @returns Il valore decodificato e castato automaticamente, o `null` se il cookie non esiste o non è censito.
     */
    getCookie<K extends CookieKey | EngineCookieKey>(key: K): InferCookieType<K> | null {
        const fullKey = buildPhysicalCookieKey(key);
        if (!fullKey) return null;

        const rawString = this.readRawCookie(fullKey);
        if (rawString === null) return null;

        const config = this._cm[key as string];
        const type = config?.valueType || 'string';

        // Gestione del casting automatico basato sul 'valueType' della configurazione:
        // Se è 'boolean', consideriamo validi i valori testuali '1' o 'true'
        if (type === 'boolean') return (rawString === '1' || rawString === 'true') as InferCookieType<K>;
        // Se è 'number', parsiamo a Float, restituendo null se non è un numero valido
        if (type === 'number') {
            const num = parseFloat(rawString);
            return isNaN(num) ? null : (num as InferCookieType<K>);
        }
        // Se è 'json', parsiamo il payload (avvolto nel try-catch per sicurezza)
        if (type === 'json') {
            try { return JSON.parse(rawString) as InferCookieType<K>; } catch { return null; }
        }
        // Default: restituisce stringa
        return rawString as InferCookieType<K>;
    }

    /**
     * Valore grezzo di un cookie: da `document.cookie` nel browser, dall'header `cookie`
     * della REQUEST in SSR. Senza la lettura SSR, getCookie tornerebbe null lato server
     * (document.cookie è vuoto): la lingua salvata verrebbe ignorata e l'HTML SSR uscirebbe
     * in defaultLang → hydration mismatch col primo render client. Le letture non richiedono
     * consenso (il gate GDPR è solo sulla scrittura).
     */
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

    /**
     * Rimuove un cookie dal browser dell'utente.
     * A differenza della scrittura, l'eliminazione è sempre consentita anche se l'utente ha revocato il consenso.
     *
     * @param key La chiave tipizzata del cookie da eliminare.
     */
    removeCookie(key: CookieKey | EngineCookieKey): void {
        if (!this.isBrowser) return;
        // Rimozione "best-effort": una chiave non censita qui è innocua, quindi
        // risolviamo il nome fisico in silenzio — niente console.error, a differenza
        // di set/getCookie dove una chiave ignota segnala un errore di programmazione.
        const config = this._cm[key as string];
        const fullKey = config
            ? buildPhysicalCookieKey(key, config) ?? (key as string)
            : (key as string);
        this.document.cookie = `${fullKey}=; Max-Age=0${this.cookieSecurityAttributes()}`;
    }

    // ─── PREFERENZA LINGUA (built-in) ───────────────────────────────────
    //
    // Metodi cappello per esporre un'API pulita, appoggiati sui primitivi standard
    // e sull'ENGINE_COOKIE_MAP.

    getSavedLanguage(): string | null {
        return this.getCookie('lang');
    }

    setSavedLanguage(language: string): void {
        this.setCookie('lang', language);
    }

    clearSavedLanguage(): void {
        this.removeCookie('lang');
    }

    // ─── HELPER INTERNI ───────────────────────────────────────────────

    private isCategoryAccepted(category: CookieCategory): boolean {
        switch (category) {
            case CookieCategory.Technical: return this._technicalAccepted();
            case CookieCategory.Analytics: return this._analyticsAccepted();
            case CookieCategory.Profiling: return this._profilingAccepted();
            default: return false;
        }
    }

    /**
     * De-registra ogni Service Worker residuo e svuota le sue cache. Idempotente e browser-only:
     * se non c'è nulla da rimuovere è un no-op. Usato quando la PWA non deve essere attiva
     * (`isWebApp:false` o consenso tecnico negato), sia all'avvio sia al cambio di consenso, così
     * un SW registrato in passato non continua a servire una copia in cache obsoleta.
     */
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
     * Rimuove fisicamente dal browser tutti i cookie gestiti la cui categoria associata
     * è attualmente rifiutata dall'utente.
     * I cookie di "memoria" del consenso vengono ignorati per non perdere la scelta dell'utente.
     */
    private clearRevokedCookies(): void {
        if (!this.isBrowser) return;

        for (const [rawKey, config] of Object.entries(this._cm) as [string, CookieConfig | undefined][]) {
            // Saltiamo il file del Service Worker e i cookie di "memoria" del consenso
            if (!config || rawKey === CookieConsentService.NGSW_WORKER || (Object.values(CONSENT_KEYS) as string[]).includes(rawKey)) {
                continue;
            }
            if (!this.isCategoryAccepted(config.category)) {
                this.removeCookie(rawKey as CookieKey | EngineCookieKey);
            }
        }
    }
}
