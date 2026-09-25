import { existsSync, readFileSync } from 'node:fs';
import { readTables } from '../../server/server-font-metrics';
import { closestFace, SYSTEM_FONTS, SystemFont, type AppFontConfig } from '../../font-system';
import { customFontFacePath } from '../../server/custom-font-detect';

/** Fallback font metric-compatibile (`size-adjust`/`ascent-override`/…): evita il salto di riga (CLS)
 *  quando il font self-hosted arriva dopo il fallback di `font-display: swap`. `null` se le tabelle
 *  mancano o danno numeri implausibili — mai un valore sbagliato. */

/** Metriche verticali/orizzontali lette da head/hhea/OS2. `xAvgCharWidth` null se OS/2 manca
 *  (rarissimo per un font da web: niente `size-adjust` in quel caso, non un calcolo alla cieca). */
interface RawFontMetrics {
    unitsPerEm: number;
    ascent: number;
    descent: number; // hhea: negativo (sotto la baseline)
    lineGap: number;
    xAvgCharWidth: number | null;
}

/** Legge head.unitsPerEm, hhea.ascender/descender/lineGap e OS/2.xAvgCharWidth — stesse tabelle e
 *  stessi offset di `server-font-metrics.ts` (verificati lì), qui senza hmtx/cmap: non serve
 *  l'advance per-glifo, solo i quattro numeri per il calcolo sotto. */
function readRawMetrics(file: string): RawFontMetrics {
    const { b, table } = readTables(readFileSync(file));
    const head = table['head'];
    const hhea = table['hhea'];
    if (head == null || hhea == null) throw new Error('font: tabella head/hhea mancante');
    const os2 = table['OS/2'];
    return {
        unitsPerEm: b.readUInt16BE(head + 18),
        ascent: b.readInt16BE(hhea + 4),
        descent: b.readInt16BE(hhea + 6),
        lineGap: b.readInt16BE(hhea + 8),
        xAvgCharWidth: os2 != null ? b.readInt16BE(os2 + 2) : null,
    };
}

/** Descrittori CSS del fallback (già in `%`, `_tokens.scss` li interpola così come sono). */
export interface FontFallbackOverride {
    ascentOverride: string;
    descentOverride: string;
    lineGapOverride: string;
    sizeAdjust: string;
}

/** Riproporziona ascent/descent/lineGap del font vero sull'em square scalato da `size-adjust` (non
 *  sull'`unitsPerEm` nudo): è quello scaling a rendere il confronto con `fallback` valido. `null` se
 *  manca `xAvgCharWidth` o i numeri escono dal range plausibile per un font reale. */
function computeOverride(target: RawFontMetrics, fallback: RawFontMetrics): FontFallbackOverride | null {
    if (target.xAvgCharWidth == null || fallback.xAvgCharWidth == null) return null;
    if (target.xAvgCharWidth <= 0 || fallback.xAvgCharWidth <= 0 || target.unitsPerEm <= 0 || fallback.unitsPerEm <= 0) return null;

    const targetXAvgRatio = target.xAvgCharWidth / target.unitsPerEm;
    const fallbackXAvgRatio = fallback.xAvgCharWidth / fallback.unitsPerEm;
    const sizeAdjust = targetXAvgRatio / fallbackXAvgRatio;
    const adjustedEmSquare = target.unitsPerEm * sizeAdjust;
    const ascentOverride = target.ascent / adjustedEmSquare;
    const descentOverride = Math.abs(target.descent) / adjustedEmSquare;
    const lineGapOverride = target.lineGap / adjustedEmSquare;

    // Backstop di insensatezza (stesso spirito di assertSane in server-font-metrics.ts), non un
    // filtro sul buon gusto tipografico: qualunque font reale sta ben dentro questi margini.
    if (!(sizeAdjust > 0.5 && sizeAdjust < 2)) return null;
    if (!(ascentOverride > 0.5 && ascentOverride < 1.3)) return null;
    if (!(descentOverride > 0 && descentOverride < 0.6)) return null;
    if (!(lineGapOverride >= 0 && lineGapOverride < 0.6)) return null;

    const pct = (n: number): string => `${Math.round(n * 10000) / 100}%`;
    return { ascentOverride: pct(ascentOverride), descentOverride: pct(descentOverride), lineGapOverride: pct(lineGapOverride), sizeAdjust: pct(sizeAdjust) };
}

/** Fallback scelto per un font senza `generic` dichiarabile (ogni `CustomFontDef`): sans-serif,
 *  stessa scelta di `familyAndGenericFor` in font-system.ts. */
const FALLBACK_BY_GENERIC: Record<'sans-serif' | 'serif' | 'monospace', SystemFont> = {
    'sans-serif': SystemFont.Liberation,
    serif: SystemFont.LiberationSerif,
    monospace: SystemFont.LiberationMono,
};

/** Dati per la `@font-face` di fallback e per lo stack CSS che la referenzia (`theme-scss.ts`). */
export interface FontFallbackTheme extends FontFallbackOverride {
    /** Family del font vero, per inserire `fallbackFamily` subito dopo nello stack CSS. */
    targetFamily: string;
    /** Nome sintetico della `@font-face` di fallback (mai una family reale: evita collisioni). */
    fallbackFamily: string;
    /** Family che `local()` deve trovare — sempre uno dei Liberation, sempre installato (stesso
     *  pacchetto Alpine di ogni font del catalogo). */
    localName: string;
}

/** Nome sintetico della `@font-face` di fallback per una family — unica convenzione, usata sia qui
 *  sia da chi la referenzia nello stack. */
export function fallbackFamilyName(family: string): string {
    return `${family} Fallback`;
}

/** Fallback solo per `font.principale` (non `font.aggiuntivi`, mai garantiti attivi). `null` se non
 *  self-hosted, file assente, o metriche non lette/implausibili — mai un errore che ferma `generate:statics`. */
export function buildFontFallback(config: AppFontConfig): FontFallbackTheme | null {
    const choice = config.principale;
    if (choice == null) return null;

    let targetFamily: string;
    let generic: 'sans-serif' | 'serif' | 'monospace';
    let targetFile: string;
    if (typeof choice === 'string') {
        const def = SYSTEM_FONTS[choice];
        const face = closestFace(def.faces, 400);
        if (!face) return null;
        targetFamily = def.family;
        generic = def.generic;
        targetFile = face.file;
    } else {
        const face = closestFace(choice.faces, 400);
        if (!face) return null;
        targetFamily = choice.family;
        generic = 'sans-serif';
        targetFile = customFontFacePath(face.file);
    }

    const fallbackDef = SYSTEM_FONTS[FALLBACK_BY_GENERIC[generic]];
    const fallbackFace = closestFace(fallbackDef.faces, 400)!; // i Liberation del catalogo hanno sempre le 4 facce
    const fallbackFile = fallbackFace.file;

    // Font vero uguale al fallback (font.principale è già un Liberation): l'override risulterebbe
    // 100%/identico, corretto ma inutile — via prima del parsing.
    if (targetFile === fallbackFile) return null;
    if (!existsSync(targetFile) || !existsSync(fallbackFile)) return null;

    try {
        const override = computeOverride(readRawMetrics(targetFile), readRawMetrics(fallbackFile));
        if (!override) return null;
        return { targetFamily, fallbackFamily: fallbackFamilyName(targetFamily), localName: fallbackDef.family, ...override };
    } catch (err) {
        console.warn(`[font-fallback] "${targetFamily}": metriche non calcolabili, nessun fallback metric-matched (font-display: swap resta attivo): ${(err as Error).message}`);
        return null;
    }
}
