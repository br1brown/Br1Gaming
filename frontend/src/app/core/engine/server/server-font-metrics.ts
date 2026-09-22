import { existsSync, readFileSync } from 'node:fs';
import { FontMetric, FONT_METRICS } from '../services/font-metrics';
import { SystemFont, SYSTEM_FONTS, isSystemFont } from '../font-system';
import { ContestoSito } from '../../../site';
import { customFontFacePath } from './custom-font-detect';

/**
 * Loader runtime delle metriche font lato server: le deriva dai font REALMENTE installati nel
 * container (parser TTF minimale: head/hhea/maxp/cmap formato 4/hmtx, no fontkit) invece di fidarsi
 * delle tabelle baked-in, così un aggiornamento pacchetti nel Dockerfile resta allineato senza
 * rigenerare a mano. Ogni font è isolato in try/catch + sanity-gate (`assertSane`): su qualunque
 * intoppo ripiega sul suo snapshot in `FONT_METRICS`.
 */

/** Code point delle lettere ASCII (A–Z, a–z): base per il rapporto bold/regular. */
const LETTERS: number[] = [
    ...Array.from({ length: 26 }, (_, i) => 65 + i),
    ...Array.from({ length: 26 }, (_, i) => 97 + i),
];

/** Font TTF aperto: em e lookup advance (unità font) per code point, o `null` se il glifo manca. */
interface ParsedFont {
    unitsPerEm: number;
    advanceForCp(cp: number): number | null;
}

/** Apre un TTF e prepara il lookup advance per code point. Lancia su struttura non gestita. */
function parseFont(file: string): ParsedFont {
    const b = readFileSync(file);

    // Offset table: numTables a +4, poi record da 16 byte (tag, checksum, offset, length) da +12.
    const numTables = b.readUInt16BE(4);
    const table: Record<string, number> = {};
    for (let i = 0; i < numTables; i++) {
        const rec = 12 + i * 16;
        table[b.toString('latin1', rec, rec + 4)] = b.readUInt32BE(rec + 8);
    }
    const { head, hhea, maxp, hmtx, cmap } = table;
    if (head == null || hhea == null || maxp == null || hmtx == null || cmap == null) {
        throw new Error('TTF: tabella richiesta mancante');
    }

    const unitsPerEm = b.readUInt16BE(head + 18);
    const numHMetrics = b.readUInt16BE(hhea + 34);

    // hmtx: array di numHMetrics longHorMetric (advance uint16 + lsb int16). I glifi oltre numHMetrics
    // ereditano l'advance dell'ultimo (coda monospazio): clamp all'ultimo indice valido.
    const glyphAdvance = (gid: number): number =>
        b.readUInt16BE(hmtx + Math.min(gid, numHMetrics - 1) * 4);

    const cpToGlyph = parseCmapFormat4(b, findUnicodeCmap(b, cmap));

    return {
        unitsPerEm,
        advanceForCp(cp: number): number | null {
            const gid = cpToGlyph(cp);
            return gid === 0 ? null : glyphAdvance(gid);
        },
    };
}

/** Trova l'offset della sottotabella cmap Unicode BMP (Windows 3/1 preferito, poi Unicode 0/*). */
function findUnicodeCmap(b: Buffer, cmap: number): number {
    const n = b.readUInt16BE(cmap + 2);
    let chosen = -1;
    for (let i = 0; i < n; i++) {
        const rec = cmap + 4 + i * 8;
        const platform = b.readUInt16BE(rec);
        const encoding = b.readUInt16BE(rec + 2);
        const offset = b.readUInt32BE(rec + 4);
        const isUnicode = (platform === 3 && (encoding === 1 || encoding === 0)) || platform === 0;
        if (!isUnicode) continue;
        chosen = cmap + offset;
        if (platform === 3 && encoding === 1) break; // Windows Unicode BMP: il migliore, fermati
    }
    if (chosen < 0) throw new Error('cmap: nessuna sottotabella Unicode');
    return chosen;
}

/** Lookup code point → glyph id da una sottotabella cmap formato 4. Lancia se non è formato 4. */
function parseCmapFormat4(b: Buffer, sub: number): (cp: number) => number {
    if (b.readUInt16BE(sub) !== 4) throw new Error('cmap: formato non gestito (atteso 4)');
    const segCount = b.readUInt16BE(sub + 6) / 2;
    const endCodes = sub + 14;
    const startCodes = endCodes + segCount * 2 + 2; // +2 = reservedPad
    const idDeltas = startCodes + segCount * 2;
    const idRangeOffsets = idDeltas + segCount * 2;

    return (cp: number): number => {
        for (let i = 0; i < segCount; i++) {
            if (cp > b.readUInt16BE(endCodes + i * 2)) continue;
            const start = b.readUInt16BE(startCodes + i * 2);
            if (cp < start) return 0;
            const delta = b.readInt16BE(idDeltas + i * 2);
            const rangeOffPos = idRangeOffsets + i * 2;
            const rangeOff = b.readUInt16BE(rangeOffPos);
            if (rangeOff === 0) return (cp + delta) & 0xffff;
            const gid = b.readUInt16BE(rangeOffPos + rangeOff + (cp - start) * 2);
            return gid === 0 ? 0 : (gid + delta) & 0xffff;
        }
        return 0;
    };
}

/** Calcola advance/fallbackAdvance da un font già aperto — nucleo condiviso da `buildSystemMetric`
 *  (font di catalogo, percorso già noto) e `buildMetricFromFile` (font custom, path già noto). */
function metricFromParsed(regular: ParsedFont, fallback: FontMetric, boldFactor: number): FontMetric {
    const toThousandEm = (units: number, font: ParsedFont): number => Math.round((units * 1000) / font.unitsPerEm);
    const advance: Record<number, number> = {};
    for (let cp = 32; cp <= 126; cp++) {
        const units = regular.advanceForCp(cp);
        if (units != null) advance[cp] = toThousandEm(units, regular);
    }
    const fallbackAdvance = advance[111] /* 'o' */ ?? fallback.fallbackAdvance;
    const metric: FontMetric = { advance, fallbackAdvance, boldFactor };
    assertSane(metric);
    return metric;
}

/** Costruisce le metriche di un font di `SYSTEM_FONTS` dai file reali (regular + bold, percorso
 *  già noto — `faces[0]`/`faces[1]`, vedi `SystemFontDef`, nessun `fc-match`). */
function buildSystemMetric(key: SystemFont, fallback: FontMetric): FontMetric {
    const [regularFace, boldFace] = SYSTEM_FONTS[key].faces;
    if (!existsSync(regularFace.file)) throw new Error(`file assente: ${regularFace.file}`);
    const regular = parseFont(regularFace.file);

    // boldFactor: rapporto medio bold/regular sulle lettere; se il bold non si legge tieni il fallback.
    let boldFactor = fallback.boldFactor;
    try {
        if (!existsSync(boldFace.file)) throw new Error(`file assente: ${boldFace.file}`);
        const bold = parseFont(boldFace.file);
        let sumRegular = 0, sumBold = 0;
        for (const cp of LETTERS) {
            const r = regular.advanceForCp(cp);
            const bAdv = bold.advanceForCp(cp);
            if (r && bAdv) {
                sumRegular += r / regular.unitsPerEm;
                sumBold += bAdv / bold.unitsPerEm;
            }
        }
        if (sumRegular > 0) boldFactor = Math.round((sumBold / sumRegular) * 1000) / 1000;
    } catch { /* bold non leggibile: resta il boldFactor di fallback */ }

    return metricFromParsed(regular, fallback, boldFactor);
}

/** Come `buildSystemMetric`, ma da un path arbitrario (font custom di progetto) — nessuna
 *  variante ":bold" nota a priori, quindi boldFactor resta sempre quello di fallback. */
function buildMetricFromFile(filePath: string, fallback: FontMetric): FontMetric {
    return metricFromParsed(parseFont(filePath), fallback, fallback.boldFactor);
}

/** Scarta risultati di parsing palesemente sbagliati (che il fallback per-errore non intercetterebbe). */
function assertSane(m: FontMetric): void {
    const count = Object.keys(m.advance ?? {}).length;
    const space = m.advance?.[32] ?? 0;
    if (count < 90) throw new Error(`metriche: troppi glifi mancanti (${count}/95)`);
    if (space <= 0) throw new Error('metriche: advance dello spazio non valido');
    if (m.fallbackAdvance < 150 || m.fallbackAdvance > 1000) throw new Error('metriche: fallbackAdvance fuori range');
    if (m.boldFactor < 1 || m.boldFactor > 1.4) throw new Error('metriche: boldFactor fuori range');
}

/** Metriche per ogni `SYSTEM_FONTS` dai file reali, fallback per-font sullo snapshot baked-in. Se il font attivo (`serverKey`) è un custom di progetto, aggiunge anche la sua voce (solo lui: le voci secondarie di `addonFonts` non renderizzano mai un'OG image). Da passare a `FontMetrics.configure`, sincrono e una-tantum. */
export function loadServerFontMetrics(): Record<string, FontMetric> {
    const result: Record<string, FontMetric> = {};
    for (const key of Object.values(SystemFont) as SystemFont[]) {
        try {
            result[key] = buildSystemMetric(key, FONT_METRICS[key]);
        } catch {
            result[key] = FONT_METRICS[key];
        }
    }
    const activeKey = ContestoSito.config.fonts.serverKey;
    if (!isSystemFont(activeKey)) {
        const activeCustom = ContestoSito.config.customFontsCatalog.find(c => c.key === activeKey);
        const file = activeCustom?.faces[0]?.file;
        if (file) {
            try {
                result[activeKey] = buildMetricFromFile(customFontFacePath(file), FONT_METRICS[SystemFont.Liberation]);
            } catch {
                result[activeKey] = FONT_METRICS[SystemFont.Liberation];
            }
        }
    }
    return result;
}
