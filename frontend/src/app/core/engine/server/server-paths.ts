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
 * Percorso cache (effimero e isolato) per le miniature Sharp.
 * Vive in `os.tmpdir()` per evitare cicli di reload su `ng serve` o l'inclusione forzata in `dist`.
 * Sovrascrivibile tramite `IMAGE_CACHE_DIR` per puntarla a un volume persistente in produzione.
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
