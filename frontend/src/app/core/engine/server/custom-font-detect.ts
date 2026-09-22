import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { serverEnv } from './server-env';
import { ContestoSito } from '../../../site';
import { isSystemFont, systemFontServerStack, customFontServerFamilyStack, SystemFont, type FontChoice, type CustomFontDef } from '../font-system';

/** Percorso assoluto di una faccia di un font custom di progetto (`fontsDir` + nome file
 *  dichiarato in `CustomFontFace.file`) — solo risoluzione, nessuna verifica di esistenza (la fa
 *  chi legge, a runtime: `system-font.ts` per servire il file, qui sotto per `fc-scan`). */
export function customFontFacePath(fileName: string): string {
    return join(serverEnv.site.fontsDir, fileName);
}

/** Nome che fontconfig usa DAVVERO per il file (letto via `fc-scan`), non necessariamente la `family` dichiarata: Sharp/librsvg risolvono i font tramite fontconfig, non @font-face. `null` se la faccia regular manca o `fc-scan` fallisce. Memoizzata per `key`. */
const realFamilyCache = new Map<string, string | null>();
function realServerFamily(def: CustomFontDef): string | null {
    if (realFamilyCache.has(def.key)) return realFamilyCache.get(def.key)!;
    const result = ((): string | null => {
        const file = def.faces[0]?.file;
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

/** Stack CSS server per QUALUNQUE `FontChoice` (default o da `DesignSystemPreset.ogTextTransform`): stessa correzione `fc-scan` in entrambi i casi, mai un font "di serie B". SystemFont risolve già per nome, CustomFontDef usa il nome vero se disponibile, altrimenti la family dichiarata. */
export function serverStackForChoice(choice: FontChoice): string {
    if (typeof choice === 'string') return systemFontServerStack(choice);
    return customFontServerFamilyStack(realServerFamily(choice) ?? choice.family);
}

/** Stack CSS server per le OG image di DEFAULT: il font attivo del sito (o Liberation), con la correzione `fc-scan` già applicata. Un `ogTextTransform` con font diverso usa `serverStackForChoice` direttamente. */
export const customFontServerStack: string = serverStackForChoice(ContestoSito.config.defaultFont ?? SystemFont.Liberation);

/** Valida un font da `DesignSystemPreset.ogTextTransform`: SystemFont sempre valido; CustomFontDef deve coincidere per `key` con uno già registrato (mai un font nuovo al volo). Ritorna sempre la definizione CANONICA registrata, null se non valido (il chiamante ripiega sul default). */
export function validateOgFontOverride(choice: FontChoice): FontChoice | null {
    if (typeof choice === 'string') return isSystemFont(choice) ? choice : null;
    return ContestoSito.config.customFontsCatalog.find(c => c.key === choice.key) ?? null;
}
