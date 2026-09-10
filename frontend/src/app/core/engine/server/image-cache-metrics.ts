/**
 * Contatori hit/miss della cache immagini su disco (cdn-asset.ts, og-preview.ts): quante
 * richieste trovano già la miniatura in cache (`hit`, serve diretto) contro quante devono
 * lanciare un job sharp (`miss`, decode/resize). In-memory, per-processo: niente persistenza,
 * si azzerano a ogni riavvio — bastano a valutare l'efficacia della cache in un dato deploy
 * (bassa hit-rate → CACHE_MAX_BYTES troppo piccolo o traffico con varianti molto disperse).
 * Esposti su GET /health (vedi server.ts).
 */

let hits = 0;
let misses = 0;

export function recordCacheHit(): void {
    hits++;
}

export function recordCacheMiss(): void {
    misses++;
}

export function getImageCacheStats(): { hits: number; misses: number; hitRate: number | null } {
    const total = hits + misses;
    return { hits, misses, hitRate: total > 0 ? hits / total : null };
}
