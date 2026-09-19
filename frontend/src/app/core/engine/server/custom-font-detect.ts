import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { serverEnv } from './server-env';
import { ContestoSito } from '../../../site';
import { isSystemFont, systemFontWebStack, customFontWebStack, SystemFont, type FontChoice, type CustomFontDef } from '../font-system';

/** Percorso assoluto di una faccia di un font custom di progetto (`fontsDir` + nome file
 *  dichiarato in `CustomFontFace.file`) — solo risoluzione, nessuna verifica di esistenza (la fa
 *  chi legge, a runtime: `system-font.ts` per servire il file, qui sotto per `fc-scan`). */
export function customFontFacePath(fileName: string): string {
    return join(serverEnv.site.fontsDir, fileName);
}

/**
 * Nome che fontconfig usa DAVVERO per il file di UN `CustomFontDef`, letto dai suoi metadati
 * interni via `fc-scan` (funziona sul file diretto, non serve che sia in una cartella già nota a
 * fontconfig) — non necessariamente la `family` dichiarata in `CustomFontDef`, che è solo
 * un'etichetta per il browser (il `@font-face` la lega esplicitamente all'URL del file).
 *
 * Sharp/librsvg (le OG image, `preview-builder.ts`) risolvono invece i font tramite fontconfig,
 * che indicizza ogni font per questo nome interno: se `family` non coincide, l'SVG chiede a
 * fontconfig un nome che non esiste e ripiega silenziosamente sul font di sistema, pur avendo il
 * file corretto sotto mano. Usare qui il nome vero (invece di richiedere che lo sviluppatore lo
 * indovini in `defaultFont`) rende il font custom effettivo nelle OG image senza alcuna
 * dichiarazione né file aggiuntivi — un font aggiunto alla cartella `fonts/` basta.
 *
 * `null` se la faccia regular non esiste, o `fc-scan` manca/fallisce (es. `ng serve` in sviluppo
 * locale, o un formato che non sa leggere). Memoizzata per `key`: più richieste per lo stesso font
 * (es. il default PIÙ lo stesso font scelto da `DesignSystemPreset.ogTextTransform`, o più
 * immagini OG nello stesso processo server) costano un solo `fc-scan`, non uno a chiamata.
 */
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

/**
 * Stack CSS server (`PreviewBuilder`, OG image) per QUALUNQUE `FontChoice` — non solo il font
 * attivo del sito: la stessa funzione serve sia il default (`customFontServerStack` sotto) sia un
 * font restituito da `DesignSystemPreset.ogTextTransform` (`og-preview.ts`), stessa identica
 * garanzia in entrambi i casi — mai un font "di serie B" senza la correzione `fc-scan`. Un
 * `SystemFont` risolve già per nome via fontconfig senza bisogno di correzione (family dichiarata
 * == family vera, verificato a monte in `SYSTEM_FONTS`); un `CustomFontDef` usa il nome vero letto
 * da `fc-scan` se disponibile, altrimenti la `family` dichiarata (comportamento pre-esistente).
 */
export function serverStackForChoice(choice: FontChoice): string {
    if (typeof choice === 'string') return systemFontWebStack(choice);
    return customFontWebStack(realServerFamily(choice) ?? choice.family);
}

/**
 * Stack CSS server (`PreviewBuilder`) da usare per le OG image DI DEFAULT — il font attivo del
 * sito (`ContestoSito.config.defaultFont`, o Liberation se il sito non ne sceglie uno esplicito,
 * stesso fallback di `systemUiFonts()`), con la correzione `fc-scan` già applicata se custom. Un
 * `DesignSystemPreset.ogTextTransform` che restituisce un font diverso usa invece
 * `serverStackForChoice` sopra direttamente (vedi `og-preview.ts`) — stessa funzione, font diverso.
 */
export const customFontServerStack: string = serverStackForChoice(ContestoSito.config.defaultFont ?? SystemFont.Liberation);

/**
 * Valida un font restituito da `DesignSystemPreset.ogTextTransform` (`og-preview.ts`): un
 * `SystemFont` è sempre valido (il catalogo è sempre raggiungibile, indipendentemente da cosa il
 * sito ha scelto — stessa libertà di `ImgBuildOptions.fontFamily`); un `CustomFontDef` deve
 * coincidere per `key` con uno già registrato (`defaultFont` o `addonFonts`, via
 * `customFontsCatalog`) — mai un font nuovo scritto lì al volo, l'unico modo di restare dentro le
 * stesse garanzie di reachability/correzione server di ogni altro font del catalogo. Ritorna
 * sempre la definizione CANONICA registrata (mai l'oggetto passato, che potrebbe avere `family`/
 * `faces` divergenti sotto la stessa `key`) — `null` se non valido, il chiamante ripiega sul
 * default, mai un crash.
 */
export function validateOgFontOverride(choice: FontChoice): FontChoice | null {
    if (typeof choice === 'string') return isSystemFont(choice) ? choice : null;
    return ContestoSito.config.customFontsCatalog.find(c => c.key === choice.key) ?? null;
}
