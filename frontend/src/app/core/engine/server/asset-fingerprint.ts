import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

/** Impronta di un contenuto: i primi 12 caratteri esadecimali dello SHA-1 dei byte. Entra nella
 *  chiave delle copie su disco e nell'ETag: dipende solo dal contenuto, non da mtime o macchina. */
export function contentFingerprint(data: Buffer): string {
    return createHash('sha1').update(data).digest('hex').slice(0, 12);
}

/** Impronte già calcolate per file, valide finché mtime e dimensione restano quelli: il file si
 *  rilegge la prima volta e dopo ogni modifica, non a ogni richiesta. Le chiavi sono i file di
 *  `mapping.json`, quindi la mappa resta piccola. */
const memo = new Map<string, { mtimeMs: number; size: number; fingerprint: string }>();

/** Impronta del contenuto di un file sorgente su disco (vedi {@link contentFingerprint}). */
export async function fileFingerprint(path: string): Promise<string> {
    const { mtimeMs, size } = await stat(path);
    const known = memo.get(path);
    if (known && known.mtimeMs === mtimeMs && known.size === size) return known.fingerprint;
    const fingerprint = contentFingerprint(await readFile(path));
    memo.set(path, { mtimeMs, size, fingerprint });
    return fingerprint;
}
