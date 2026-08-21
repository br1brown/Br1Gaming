/** Categoria di consenso (GDPR/ePrivacy) di una voce di archiviazione — vale per cookie E Web
 *  Storage. Abbina la voce al consenso dell'utente; indipendente dal mezzo (`storage`). Quattro
 *  categorie SIMMETRICHE nel trattamento (stesso gate, stesso pattern "un consenso per l'intera
 *  categoria"): l'unica eccezione è Technical, sempre esente per legge — mai un vero consenso da
 *  chiedere. Aggiunta una voce qui = aggiornare anche `isCategoryAccepted` in
 *  `CookieConsentService` (uno switch/case coperto a compile-time da `default`, non da tutti i
 *  case: TypeScript non segnala un case mancante). */
export enum ConsentCategory {
    /** Strettamente necessari a erogare il servizio esplicitamente richiesto (sessione, memorie
     *  del consenso). Esenti da consenso per legge (art. 122 Codice Privacy / art. 5.3 ePrivacy):
     *  si dichiarano, non si chiedono — mai bloccati, mai ripuliti alla revoca, nel banner solo un
     *  badge "Necessari", mai uno switch. */
    Technical,
    /** Raccolta dati aggregati per misurare l'utilizzo del sito. */
    Analytics,
    /** Pubblicità comportamentale e profilazione utente. */
    Profiling,
    /** Tecnici ma NON strettamente necessari: vanno oltre il minimo per erogare il servizio
     *  richiesto (es. il Service Worker/PWA built-in, che abilita installabilità/uso offline —
     *  comodità, non requisito). A differenza di Technical restano a consenso esplicito, con lo
     *  stesso trattamento di Analytics/Profiling. */
    TechnicalOptional,
}

export type CookieValueType = 'string' | 'number' | 'boolean' | 'json';

/** Mezzo di archiviazione di una voce censita. Default `'cookie'`. `'local'`/`'session'` =
 *  Web Storage: instradate da `set`/`get`/`remove` come i cookie, ma non passano mai da
 *  `document.cookie` — sono comunque elencate nella policy automatica e pulite alla revoca. */
export type StorageMedium = 'cookie' | 'local' | 'session';

/** Metadati di una voce registrata in `COOKIE_MAP`/`ENGINE_COOKIE_MAP` (cookie o Web Storage, secondo `storage`). */
export interface CookieConfig {
    /** Categoria di consenso a cui appartiene la voce. */
    category: ConsentCategory;
    /** Chiave i18n per la descrizione nella pagina Cookie Policy (opzionale). */
    descriptionKey?: string;
    /** Tipo primitivo per il cast automatico (solo cookie). Se omesso, di default è 'string' */
    valueType?: CookieValueType;
    /** Mezzo di archiviazione. Omesso = `'cookie'`. */
    storage?: StorageMedium;
    /** Strategia di match della chiave per la pulizia sul Web Storage. Omesso/`'exact'` = chiave
     *  esatta. `'prefix'` = la voce rappresenta una FAMIGLIA di chiavi che condividono questo
     *  prefisso (tipico della telemetria di terza parte con suffisso dinamico, es. un token): alla
     *  revoca vengono rimosse TUTTE le chiavi che iniziano per la chiave della voce. Ha senso solo
     *  con `storage:'local'|'session'`. Su una voce `prefix` la scrittura via `set` è un no-op
     *  (le chiavi reali le crea il provider, non noi): esiste per la policy + la pulizia. */
    match?: 'exact' | 'prefix';
    /** Provider della voce, per la Cookie Policy. Omesso = prima parte (questo sito); valorizzato =
     *  nome del terzo che la imposta (es. `'Google Analytics'`). Il Web Storage è sempre prima parte. */
    provider?: string;
    /** URL alla privacy/cookie policy del provider terzo (opzionale). Se presente, nella policy il
     *  nome del provider diventa un link. Ha senso solo insieme a `provider`. */
    providerUrl?: string;
    /** Chiave i18n della durata dichiarata (solo cookie), per la Cookie Policy. Omessa → default
     *  "1 anno" (il Max-Age predefinito di `set()`). Per il Web Storage la durata è derivata dal
     *  mezzo (sessione / persistente) e questo campo è ignorato. */
    durationKey?: string;
}

export const CONSENT_KEYS = {
    technicalOptional: 'consent_technical_optional',
    analytics: 'consent_analytics',
    profiling: 'consent_profiling'
} as const;

export const CONSENT_COOKIE_MAP = {
    /** Memorizza le preferenze dell'utente sui cookie tecnici NON obbligatori (TechnicalOptional).
     *  Max-Age 180 giorni (vedi CookieConsentService.CONSENT_MAX_AGE_SECONDS): durationKey
     *  esplicito per non farlo ricadere sul default "1 anno" della Cookie Policy. Categoria
     *  Technical (non TechnicalOptional): memorizzare LA SCELTA è di per sé un'operazione esente,
     *  come tutto ciò che è strettamente necessario. */
    [CONSENT_KEYS.technicalOptional]: {
        category: ConsentCategory.Technical,
        descriptionKey: 'consentTechnicalOptionalDescrizioneListaCookie',
        durationKey: 'durataSeiMesiListaCookie',
        valueType: 'boolean'
    },
    /** Memorizza le preferenze dell'utente sui cookie analitici */
    [CONSENT_KEYS.analytics]: {
        category: ConsentCategory.Technical,
        descriptionKey: 'consentAnalyticsDescrizioneListaCookie',
        durationKey: 'durataSeiMesiListaCookie',
        valueType: 'boolean'
    },
    /** Memorizza le preferenze dell'utente sui cookie di profilazione */
    [CONSENT_KEYS.profiling]: {
        category: ConsentCategory.Technical,
        descriptionKey: 'consentProfilingDescrizioneListaCookie',
        durationKey: 'durataSeiMesiListaCookie',
        valueType: 'boolean'
    }
} as const satisfies Readonly<Record<string, CookieConfig>>;

/**
 * Voci built-in del MOTORE, su qualsiasi mezzo (`storage`): cookie (SW, memorie del
 * consenso) e Web Storage (consent_log, bearerToken). Mappa unica → la stessa logica di policy,
 * gate e pulizia le tratta tutte; il mezzo lo decide il campo `storage` di ogni voce.
 */
export const ENGINE_COOKIE_MAP = {
    /** Cookie. Incluso nella lista pubblica solo se `isWebApp` è `true` in site.ts. TechnicalOptional
     *  (non Technical): va oltre il minimo per erogare il servizio richiesto (offline/installabilità),
     *  quindi resta a consenso esplicito invece di essere esente. */
    'ngsw-worker.js': {
        category: ConsentCategory.TechnicalOptional,
        descriptionKey: 'swDescrizioneListaCookie',
    },
    /** localStorage. Log della scelta di consenso (accountability GDPR). Scritto da CookieConsentService.
     *  ESSENZIALE → elencato in policy ma mai cancellato dalla revoca. */
    consent_log: {
        category: ConsentCategory.Technical,
        storage: 'local',
        descriptionKey: 'consentLogDescrizioneListaCookie',
    },
    /** sessionStorage. Token di autenticazione (TokenService). Incluso solo se è configurato un login.
     *  ESSENZIALE → elencato in policy ma mai cancellato dalla revoca. */
    bearerToken: {
        category: ConsentCategory.Technical,
        storage: 'session',
        descriptionKey: 'bearerTokenDescrizioneListaCookie',
    },
    ...CONSENT_COOKIE_MAP
} as const satisfies Readonly<Record<string, CookieConfig>>;

export type EngineCookieKey = keyof typeof ENGINE_COOKIE_MAP;

/** Chiavi delle voci essenziali del motore su Web Storage: elencate in policy ma MAI cancellate
 *  alla revoca (prova del consenso + autenticazione). */
export const ESSENTIAL_ENGINE_STORAGE_KEYS = ['consent_log', 'bearerToken'] as const;
