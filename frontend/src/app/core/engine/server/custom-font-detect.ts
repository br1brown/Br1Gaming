import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { serverEnv } from './server-env';
import { ContestoSito } from '../../../site';
import { closestFace, isSystemFont, systemFontServerStack, customFontServerFamilyStack, type FontChoice, type CustomFontDef } from '../font-system';

/** Percorso assoluto di una faccia di un font custom di progetto (`fontsDir` + nome file
 *  dichiarato in `CustomFontFace.file`) — solo risoluzione, nessuna verifica di esistenza (la fa
 *  chi legge, a runtime: `system-font.ts` per servire il file, qui sotto per `fc-scan`). */
export function customFontFacePath(fileName: string): string {
    return join(serverEnv.site.fontsDir, fileName);
}

/** Nome che fontconfig usa DAVVERO per il file (letto via `fc-scan`), non necessariamente la `family` dichiarata: Sharp/librsvg risolvono i font tramite fontconfig, non @font-face. `null` se la faccia regular manca o `fc-scan` fallisce. Memoizzata per `key` una volta per processo: un file sostituito sul volume `fonts/` si rilegge solo al riavvio. */
const realFamilyCache = new Map<string, string | null>();
function realServerFamily(def: CustomFontDef): string | null {
    if (realFamilyCache.has(def.key)) return realFamilyCache.get(def.key)!;
    const result = ((): string | null => {
        const file = closestFace(def.faces, 400)?.file;
        if (!file) return null;
        const path = customFontFacePath(file);
        if (!existsSync(path)) return null;
        try {
            const out = execFileSync('fc-scan', ['--format', '%{family[0]}\n', path], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            return out || null;
        } catch {
            return null;
        }
    })();
    realFamilyCache.set(def.key, result);
    return result;
}

/** Stack CSS server per QUALUNQUE `FontChoice` (default o da `DesignSystemPreset.og.testo`): stessa correzione `fc-scan` in entrambi i casi, mai un font "di serie B". SystemFont risolve già per nome, CustomFontDef usa il nome vero se disponibile, altrimenti la family dichiarata. */
export function serverStackForChoice(choice: FontChoice): string {
    if (typeof choice === 'string') return systemFontServerStack(choice);
    return customFontServerFamilyStack(realServerFamily(choice) ?? choice.family);
}


/** Valida un font da `DesignSystemPreset.og.testo`: SystemFont sempre valido; CustomFontDef deve coincidere per `key` con un font custom del catalogo (`font.principale` o `font.aggiuntivi`), mai un font nuovo al volo. Ritorna sempre la definizione CANONICA registrata, null se non valido (il chiamante ripiega sul default). */
export function validateOgFontOverride(choice: FontChoice): FontChoice | null {
    if (typeof choice === 'string') return isSystemFont(choice) ? choice : null;
    if (choice == null || typeof choice !== 'object') return null;
    return ContestoSito.config.customFontsCatalog.find(c => c.key === choice.key) ?? null;
}
