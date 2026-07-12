import { ConsentCategory, type CookieConfig } from "../engine/services/cookie/cookie-type";

/**
 * Registro UNICO dell'archiviazione client (cookie + Web Storage): una riga qui attiva toggle nel
 * banner GDPR, tipizzazione di set/get/remove, riga in {{cookieList}} e pulizia alla revoca.
 * Shape, campi opzionali e variante `prefix`: frontend/README.md §"Aggiungere un cookie…".
 * La data legale sta in `pages/policy/legal.pages.ts` (`legalUpdated`), non qui.
 */
export const COOKIE_MAP = {
    'storyPlayerState': { category: ConsentCategory.Technical, descriptionKey: 'gamingCookieDescStoryPlayerState' },
    'duceNonDuceRecord': { category: ConsentCategory.Technical, descriptionKey: 'gamingCookieDescDuceNonDuceRecord' },
    'burocraziaTutorialDone': { category: ConsentCategory.Technical, valueType: 'boolean', descriptionKey: 'gamingCookieDescBurocraziaTutorial' },
    'burocraziaZoom': { category: ConsentCategory.Technical, valueType: 'number', descriptionKey: 'gamingCookieDescBurocraziaZoom' },
    'burocraziaRun': { category: ConsentCategory.Technical, valueType: 'json', descriptionKey: 'gamingCookieDescBurocraziaRun' },
    // Web Storage: timeline storie (parte voluminosa del salvataggio, fuori dai 4KB del cookie).
    'storyPlayerTimeline': { category: ConsentCategory.Technical, storage: 'local', valueType: 'json', descriptionKey: 'gamingStorageDescStoryPlayerTimeline' },
    // Web Storage di TERZA PARTE (Mapbox): telemetria/turnstile scritta da mapbox-gl sul radar chiese.
    // Le chiavi hanno suffisso dinamico (base64 del token) → censita a PREFISSO: `match:'prefix'`
    // copre `mapbox.eventData`, `mapbox.eventData.uuid`, `mapbox.eventData.uuidTimestamp`. È Analytics
    // di terza parte → gated dal consenso (il radar NON importa mapbox-gl senza consenso Analytics) e
    // l'intera famiglia viene rimossa alla revoca.
    'mapbox.eventData': { category: ConsentCategory.Analytics, storage: 'local', match: 'prefix', provider: 'Mapbox', providerUrl: 'https://www.mapbox.com/legal/privacy', descriptionKey: 'gamingStorageDescMapbox' }
} as const satisfies Readonly<Record<string, CookieConfig>>;

export type CookieKey = keyof typeof COOKIE_MAP;
