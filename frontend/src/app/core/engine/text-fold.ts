/** Testo senza maiuscole né accenti per i confronti («forli» trova «Forlì») e in forma di indirizzo (`slugify`).
 *  Dà lo stesso risultato di `Backend.Engine.TextFold` del backend. */

/** Minuscolo e senza segni diacritici. `null`/`undefined` valgono stringa vuota. */
export function foldText(text: string | null | undefined): string {
    if (!text) return '';
    // Minuscolo carattere per carattere: `toLowerCase()` sull'intera stringa sceglie `ς` o `σ` in base al contesto
    // (sigma finale), il C# no; così i due backend danno lo stesso testo.
    return Array.from(text.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC'), c => c.toLowerCase()).join('');
}

/** `true` se `haystack` contiene `needle`, ignorando maiuscole e accenti. Un `needle` vuoto è sempre contenuto. */
export function containsFolded(haystack: string | null | undefined, needle: string | null | undefined): boolean {
    return foldText(haystack).includes(foldText(needle));
}

/**
 * Il testo come segmento di indirizzo: minuscolo, senza accenti, solo lettere e cifre ASCII separate da un singolo
 * trattino, mai ai bordi. Tagliato a `maxLength` caratteri (senza trattino in coda); `fallback` se non resta niente.
 */
export function slugify(text: string | null | undefined, maxLength = 60, fallback = ''): string {
    let slug = foldText(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (maxLength > 0 && slug.length > maxLength) slug = slug.slice(0, maxLength).replace(/-+$/, '');
    return slug.length === 0 ? fallback : slug;
}
