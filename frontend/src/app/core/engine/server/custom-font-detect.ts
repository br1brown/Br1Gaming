import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { serverEnv } from './server-env';
import { ContestoSito } from '../../../site';

/**
 * Percorso assoluto di `ContestoSito.config.fonts.custom.file`, se esiste davvero nella cartella (`fontsDir`)
 * — altrimenti `null`. Calcolato una volta al boot. Usato da `server.ts` (route del file) e
 * `server-font-metrics.ts` (metriche OG). Lo stack CSS lato web NON dipende da questo: è già dato
 * puro in `ContestoSito.config.fonts` — qui si verifica solo che il file promesso esista per davvero.
 */
export const customFontFilePath: string | null = ContestoSito.config.fonts.custom
    ? (() => {
        const path = join(serverEnv.site.fontsDir, ContestoSito.config.fonts.custom!.file);
        return existsSync(path) ? path : null;
    })()
    : null;

/**
 * Nome che fontconfig usa DAVVERO per il file, letto dai suoi metadati interni via `fc-scan`
 * (funziona sul file diretto, non serve che sia in una cartella già nota a fontconfig) —
 * non necessariamente la stringa `family` scelta in `DesignSystemPreset.customFont`, che è solo
 * un'etichetta per il browser (il suo `@font-face` la lega esplicitamente all'URL del file).
 *
 * Sharp/librsvg (le OG image, `preview-builder.ts`) risolvono invece i font tramite fontconfig,
 * che indicizza ogni font per questo nome interno: se `family` non coincide, l'SVG chiede a
 * fontconfig un nome che non esiste e ripiega silenziosamente sul font di sistema, pur avendo il
 * file corretto sotto mano. Usare qui il nome vero (invece di richiedere che lo sviluppatore lo
 * indovini nel `customFont` del design system) rende il font custom effettivo nelle OG image senza
 * alcuna dichiarazione né file aggiuntivi — un semplice font aggiunto alla cartella `fonts/` basta.
 *
 * `null` se `fc-scan` manca o fallisce (es. `ng serve` in sviluppo locale, o font in un formato
 * che non sa leggere): si ripiega sul nome dichiarato, comportamento invariato.
 */
const customFontServerFamily: string | null = customFontFilePath
    ? (() => {
        try {
            const out = execFileSync('fc-scan', ['--format', '%{family[0]}\n', customFontFilePath], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            return out || null;
        } catch {
            return null;
        }
    })()
    : null;

/**
 * Stack CSS server (`PreviewBuilder`) da usare per le OG image: uguale a `ContestoSito.config.fonts.
 * serverStack`, ma con la famiglia custom sostituita dal nome che fontconfig userà davvero per il
 * file (`customFontServerFamily`) — se scoperto, altrimenti resta lo stack originale, identico al
 * comportamento pre-esistente.
 */
export const customFontServerStack: string = ContestoSito.config.fonts.custom && customFontServerFamily
    ? ContestoSito.config.fonts.serverStack.replace(`"${ContestoSito.config.fonts.custom.family}"`, `"${customFontServerFamily}"`)
    : ContestoSito.config.fonts.serverStack;
