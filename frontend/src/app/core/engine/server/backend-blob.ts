/** Recupero di un'immagine blob dal backend, lato server — condiviso da `og-preview.ts`
 *  (`OgImageRef.blobGuid`) e `cdn-asset.ts` (icona di brand dinamica). `blob/{guid}` è la
 *  convenzione di `EngineBlobController` (Engine, `sealed`): override in `SiteConfig.resolveBlobImageUrl`. */

import { serverEnv } from './server-env';

/** Percorso di default (ottimizzato, `webopt=true`) per un blob dato il GUID: i consumatori
 *  ridimensionano comunque, la piena risoluzione originale non serve. */
export function defaultBlobUrl(guid: string): string {
    return `blob/${encodeURIComponent(guid)}?webopt=true`;
}

/** Variante "raw" (senza `webopt`): ripiego se l'ottimizzata fallisce (es. formato non ricodificabile). */
export function defaultBlobUrlRaw(guid: string): string {
    return `blob/${encodeURIComponent(guid)}`;
}

/** Recupera un'immagine dal backend lato server (stesso backend/API key del proxy `/api/*`, body
 *  binario). Ritorna null su errore/HTTP non-ok: il chiamante decide il fallback. */
export async function fetchBackendImage(path: string): Promise<Buffer | null> {
    try {
        const url = `${serverEnv.backend.origin}${path.startsWith('/') ? path : `/${path}`}`;
        const response = await fetch(url, {
            headers: { 'x-api-key': serverEnv.backend.apiKey },
            signal: AbortSignal.timeout(serverEnv.server.proxyTimeout),
        });
        return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
    } catch {
        return null;
    }
}
