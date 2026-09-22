import { access } from 'node:fs/promises';

/** Verifica asincrona dell'esistenza di un path senza bloccare l'event loop (sostituisce
 *  `existsSync`: `access()` non sospende il thread mentre il disco risponde). Ritorna false su
 *  qualsiasi errore. */
export async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}
