import { ConsentCategory, type CookieConfig } from "../engine/services/cookie/cookie-type";

/**
 * Registro UNICO dell'archiviazione client del progetto (cookie + Web Storage).
 *
 * Chiave  = nome raw della voce. Valore = configurazione: categoria, `storage` (mezzo: omesso =
 *           cookie, `'local'`/`'session'` = Web Storage), `valueType` (cast) e chiave i18n.
 *
 * Aggiungere una riga qui è sufficiente per:
 *   - Attivare automaticamente la sezione nel banner GDPR (per categoria)
 *   - Rendere la chiave tipizzata e leggibile/scrivibile via set/get/remove (instradati sul mezzo)
 *   - Includerla nella tabella {{cookieList}} nelle policy (col mezzo indicato)
 *   - Farla pulire automaticamente alla revoca del consenso della sua categoria
 *
 * Con mappa vuota: CookieKey = never → set/get non sono invocabili a compile-time.
 *
 * Esempi:
 *   '_ga':          { category: ConsentCategory.Analytics, descriptionKey: 'cookieDescGa' },               // cookie
 *   'mioSalvataggio':{ category: ConsentCategory.Technical, storage: 'local', valueType: 'json', ... },     // localStorage
 */
export const COOKIE_MAP = {
    'storyPlayerState': { category: ConsentCategory.Technical, descriptionKey: 'gamingCookieDescStoryPlayerState' },
    'duceNonDuceRecord': { category: ConsentCategory.Technical, descriptionKey: 'gamingCookieDescDuceNonDuceRecord' },
    'burocraziaTutorialDone': { category: ConsentCategory.Technical, valueType: 'boolean', descriptionKey: 'gamingCookieDescBurocraziaTutorial' },
    'burocraziaZoom': { category: ConsentCategory.Technical, valueType: 'number', descriptionKey: 'gamingCookieDescBurocraziaZoom' },
    'burocraziaRun': { category: ConsentCategory.Technical, valueType: 'json', descriptionKey: 'gamingCookieDescBurocraziaRun' },
    // Web Storage: timeline storie (parte voluminosa del salvataggio, fuori dai 4KB del cookie).
    'storyPlayerTimeline': { category: ConsentCategory.Technical, storage: 'local', valueType: 'json', descriptionKey: 'gamingStorageDescStoryPlayerTimeline' }
} as const satisfies Readonly<Record<string, CookieConfig>>;

export type CookieKey = keyof typeof COOKIE_MAP;
