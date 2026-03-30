/** Categoria GDPR/ePrivacy del cookie, usata per abbinare il cookie al consenso dell'utente. */
export enum CookieCategory {
    /** Strettamente necessari al funzionamento del sito (lingua, SW, sessione). */
    Technical,
    /** Raccolta dati aggregati per misurare l'utilizzo del sito. */
    Analytics,
    /** Pubblicità comportamentale e profilazione utente. */
    Profiling,
}

export type CookieValueType = 'string' | 'number' | 'boolean' | 'json';

/** Metadati di un cookie registrato in `COOKIE_MAP`. */
export interface CookieConfig {
    /** Categoria di consenso a cui appartiene il cookie. */
    category: CookieCategory;
    /** Chiave i18n per la descrizione nella pagina Cookie Policy (opzionale). */
    descriptionKey?: string;
    /** Tipo primitivo per il cast automatico. Se omesso, di default è 'string' */
    valueType?: CookieValueType;
}

export const CONSENT_KEYS = {
    technical: 'consent_technical',
    analytics: 'consent_analytics',
    profiling: 'consent_profiling'
} as const;

export const CONSENT_COOKIE_MAP = {
    /** Memorizza le preferenze dell'utente sui cookie tecnici */
    [CONSENT_KEYS.technical]: {
        category: CookieCategory.Technical,
        descriptionKey: 'consentTechnicalDescrizioneListaCookie',
        valueType: 'boolean'
    },
    /** Memorizza le preferenze dell'utente sui cookie analitici */
    [CONSENT_KEYS.analytics]: {
        category: CookieCategory.Technical,
        descriptionKey: 'consentAnalyticsDescrizioneListaCookie',
        valueType: 'boolean'
    },
    /** Memorizza le preferenze dell'utente sui cookie di profilazione */
    [CONSENT_KEYS.profiling]: {
        category: CookieCategory.Technical,
        descriptionKey: 'consentProfilingDescrizioneListaCookie',
        valueType: 'boolean'
    }
} as const satisfies Readonly<Record<string, CookieConfig>>;

export const ENGINE_COOKIE_MAP = {
    /** Incluso nella lista cookie pubblica solo se `localeConfig.availableLanguages.length > 1` */
    lang: {
        category: CookieCategory.Technical,
        descriptionKey: 'linguaDescrizioneListaCookie',
    },
    /** Incluso nella lista cookie pubblica solo se `isWebApp` è `true` in site.ts */
    'ngsw-worker.js': {
        category: CookieCategory.Technical,
        descriptionKey: 'swDescrizioneListaCookie',
    },
    ...CONSENT_COOKIE_MAP
} as const satisfies Readonly<Record<string, CookieConfig>>;

export type EngineCookieKey = keyof typeof ENGINE_COOKIE_MAP;
