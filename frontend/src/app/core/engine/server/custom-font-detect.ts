import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serverEnv } from './server-env';
import { resolvedFonts } from '../../../../styles/font-config';

/**
 * Percorso assoluto di `resolvedFonts.custom.file`, se esiste davvero nella cartella (`fontsDir`)
 * — altrimenti `null`. Calcolato una volta al boot. Usato da `server.ts` (route del file) e
 * `server-font-metrics.ts` (metriche OG). Lo stack CSS lato web NON dipende da questo: è già dato
 * puro in `resolvedFonts` — qui si verifica solo che il file promesso esista per davvero.
 */
export const customFontFilePath: string | null = resolvedFonts.custom
    ? (() => {
        const path = join(serverEnv.site.fontsDir, resolvedFonts.custom!.file);
        return existsSync(path) ? path : null;
    })()
    : null;
