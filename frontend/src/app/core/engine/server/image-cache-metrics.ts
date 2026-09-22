/** Contatori hit/miss della cache immagini su disco: quante richieste trovano già la miniatura
 *  (`hit`) contro quante lanciano un job sharp (`miss`). In-memory per-processo, si azzerano ad
 *  ogni riavvio — bastano a valutare l'efficacia della cache in un dato deploy (bassa hit-rate →
 *  CACHE_MAX_BYTES troppo piccolo o traffico con varianti disperse). Esposti su GET /health. */

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
