import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { availableParallelism } from 'node:os';
import { cacheDir } from './server-paths';

/** Cap massimo della cache immagini su disco (MB → byte). Oltre questa soglia lo sweep
 *  LRU elimina i file meno recenti. Configurabile via IMAGE_CACHE_MAX_MB (default 500). */
const _cacheMaxMb = Number(process.env['IMAGE_CACHE_MAX_MB']);
export const CACHE_MAX_BYTES = (Number.isFinite(_cacheMaxMb) && _cacheMaxMb > 0 ? _cacheMaxMb : 500) * 1024 * 1024;

/** Intervallo dello sweep periodico della cache (6 ore). */
export const CACHE_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Job di generazione miniature attualmente in volo: richieste concorrenti per la stessa chiave
 *  riusano la stessa Promise invece di rilanciare sharp. Condiviso tra le rotte cdn-asset e og-preview. */
export const inProgress = new Map<string, Promise<unknown>>();

/** Tetto di job sharp eseguiti contemporaneamente. La dedup (inProgress) evita il lavoro
 *  duplicato sulla STESSA chiave; questo semaforo limita invece il numero di chiavi DIVERSE
 *  elaborate insieme, così una raffica di richieste con id/width differenti non fa esplodere
 *  CPU e RAM (ogni decode/resize alloca il bitmap in memoria). Configurabile via IMAGE_JOBS_MAX. */
const _maxJobs = Number(process.env['IMAGE_JOBS_MAX']);
export const IMAGE_JOBS_MAX = Number.isFinite(_maxJobs) && _maxJobs > 0
    ? Math.floor(_maxJobs)
    : Math.max(2, availableParallelism());

let _activeJobs = 0;
const _jobQueue: Array<() => void> = [];

/** Acquisisce uno slot: se ce n'è uno libero parte subito, altrimenti aspetta in coda. */
function acquireJobSlot(): Promise<void> {
    if (_activeJobs < IMAGE_JOBS_MAX) {
        _activeJobs++;
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => _jobQueue.push(resolve));
}

/** Rilascia lo slot. Se c'è un'attesa in coda gli passa lo slot direttamente (handoff,
 *  _activeJobs invariato) invece di decrementare e farlo ri-controllare: così si evita
 *  la finestra in cui un nuovo arrivo si infila e supera il limite. */
function releaseJobSlot(): void {
    const next = _jobQueue.shift();
    if (next) next();
    else _activeJobs--;
}

/**
 * Esegue un job di image processing rispettando il tetto di concorrenza IMAGE_JOBS_MAX.
 * Le richieste in eccesso aspettano in coda invece di lanciare tutte insieme operazioni
 * sharp che saturerebbero CPU e memoria. Lo slot viene sempre rilasciato (anche su errore).
 */
export async function runImageJob<T>(task: () => Promise<T>): Promise<T> {
    await acquireJobSlot();
    try {
        return await task();
    } finally {
        releaseJobSlot();
    }
}

/**
 * Sweep LRU della cache immagini. Se la dimensione totale supera CACHE_MAX_BYTES,
 * elimina i file meno recenti (per mtime) finché la cache scende sotto il 90% del cap.
 * Il margine al 90% evita di ri-sweepare a ogni singolo file aggiunto.
 * mtime viene "rinfrescato" a ogni hit (vedi AssetHandler.serveImage), così i file
 * realmente usati sopravvivono e vengono scartati solo i thumbnail dimenticati.
 *
 * Interamente asincrono (fs/promises): lo sweep gira in background su una cache che può
 * contenere centinaia di file, quindi non deve bloccare l'event loop come farebbe la
 * variante sync di readdir/stat/unlink.
 */
export async function pruneImageCache(): Promise<void> {
    try {
        const names = await readdir(cacheDir);
        const stats = await Promise.all(names.map(async (name) => {
            const full = join(cacheDir, name);
            try {
                const st = await stat(full);
                return st.isFile() ? { full, size: st.size, mtime: st.mtimeMs } : null;
            } catch { return null; }
        }));
        const entries = stats.filter((e): e is { full: string; size: number; mtime: number } => e !== null);

        let total = entries.reduce((sum, e) => sum + e.size, 0);
        if (total <= CACHE_MAX_BYTES) return;

        const target = CACHE_MAX_BYTES * 0.9;
        entries.sort((a, b) => a.mtime - b.mtime); // meno recenti per primi

        for (const e of entries) {
            if (total <= target) break;
            try { await unlink(e.full); total -= e.size; } catch { /* già rimosso da un'altra istanza */ }
        }
    } catch (err) {
        console.error('[cache-prune]', err);
    }
}
