import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { serverEnv } from './server-env';

/** Alias sulla sezione site, valutata al caricamento del modulo. */
const { site } = serverEnv;

/** Individua la cartella dove risiede il codice server eseguito da Node. */
export const serverDistFolder = dirname(fileURLToPath(import.meta.url));

/** Risolve il percorso della cartella 'browser' che contiene gli asset statici finali. */
export const browserDistFolder = resolve(serverDistFolder, '../browser');

/** Definisce la sorgente dei file: usa ASSETS_DIR se impostata, altrimenti la cartella di build. */
export const assetFilesDir = site.assetsDir
    ? resolve(site.assetsDir)
    : join(browserDistFolder, 'assets/files');

/**
 * Percorso della cache per le immagini processate da Sharp (thumbnail CDN + preview social).
 *
 * È dato derivato ed effimero: rigenerabile su richiesta e servito SOLO dagli handler Node
 * (l'accesso diretto a /assets/files è 404 in server.ts), mai come file statico. Per questo
 * NON deve vivere sotto src/assets né nel build output: starci dentro la farebbe (a) sorvegliare
 * da `ng serve` → reload della pagina a ogni miniatura generata, (b) copiare in dist a ogni build.
 *
 * Default: cartella dedicata nella temp di sistema, isolata per progetto tramite un hash del
 * percorso asset — così più siti (questo template e i suoi figli) sullo stesso host non si
 * mischiano le immagini, mentre in container ogni istanza ha già la sua /tmp.
 *
 * Override con IMAGE_CACHE_DIR per puntarla a un volume persistente in produzione (cache calda
 * tra i restart); senza override la cache è fredda dopo un riavvio e si rigenera on-demand.
 */
const cacheDirOverride = process.env['IMAGE_CACHE_DIR']?.trim();
export const cacheDir = cacheDirOverride
    ? resolve(cacheDirOverride)
    : join(tmpdir(), `br1-image-cache-${createHash('sha1').update(assetFilesDir).digest('hex').slice(0, 12)}`);

/**
 * Crea la cartella di cache se non esiste (recursive evita errori se mancano i padri).
 * Resta sincrono: gira una sola volta all'import del modulo, prima che il server
 * accetti richieste — qui bloccare l'event loop è irrilevante e semplifica l'ordine d'avvio.
 */
mkdirSync(cacheDir, { recursive: true });
