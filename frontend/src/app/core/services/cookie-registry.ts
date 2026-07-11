import { ConsentCategory, type CookieConfig } from "../engine/services/cookie/cookie-type";

/**
 * Registro UNICO dell'archiviazione client (cookie + Web Storage): una riga qui attiva toggle nel
 * banner GDPR, tipizzazione di set/get/remove, riga in {{cookieList}} e pulizia alla revoca.
 * Shape, campi opzionali e variante `prefix`: frontend/README.md §"Aggiungere un cookie…".
 * La data legale sta in `pages/policy/legal.pages.ts` (`legalUpdated`), non qui.
 */
export const COOKIE_MAP = {
    // Esempi — scommenta e adatta (la chiave è il nome raw della voce):
    // '_ga':            { category: ConsentCategory.Analytics, descriptionKey: 'cookieDescGa', provider: 'Google Analytics' }, // cookie di terza parte
    // 'mioSalvataggio': { category: ConsentCategory.Technical, storage: 'local', valueType: 'json', descriptionKey: 'cookieDescSalva' }, // localStorage
} as const satisfies Readonly<Record<string, CookieConfig>>;

export type CookieKey = keyof typeof COOKIE_MAP;
