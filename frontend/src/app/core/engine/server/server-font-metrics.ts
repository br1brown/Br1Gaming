import { existsSync, readFileSync } from 'node:fs';
import { brotliDecompressSync, inflateSync } from 'node:zlib';
import { FontMetric, FONT_METRICS } from '../services/font-metrics';
import { closestFace, SystemFont, SYSTEM_FONTS } from '../font-system';
import { ContestoSito } from '../../../site';
import { customFontFacePath } from './custom-font-detect';

/**
 * Loader runtime delle metriche font lato server: le deriva dai file font REALI (i `SYSTEM_FONTS`
 * installati nel container e i font custom del catalogo in `fonts/`), con un parser minimale
 * TTF/OTF/WOFF/WOFF2 (head/hhea/maxp/cmap formato 4 o 12/hmtx, no fontkit): un aggiornamento
 * pacchetti nel Dockerfile resta allineato senza rigenerare tabelle a mano. Ogni font è isolato in
 * try/catch + sanity-gate (`assertSane`): su qualunque intoppo ripiega sul suo snapshot in
 * `FONT_METRICS` (Liberation per un font custom), con una riga di log.
 */

/** Code point delle lettere ASCII (A–Z, a–z): base per il rapporto bold/regular. */
const LETTERS: number[] = [
    ...Array.from({ length: 26 }, (_, i) => 65 + i),
    ...Array.from({ length: 26 }, (_, i) => 97 + i),
];

/** Code point misurati: ASCII, Latin-1 e Latin Extended-A (accentate), più la punteggiatura
 *  tipografica che finisce nei titoli (virgolette, trattini, `…`, `€`). */
const MEASURED_CODEPOINTS: number[] = [
    ...Array.from({ length: 95 }, (_, i) => 32 + i),
    ...Array.from({ length: 224 }, (_, i) => 160 + i),
    0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2022, 0x2026, 0x20ac,
];

/** Font aperto: em e lookup advance (unità font) per code point, o `null` se il glifo manca. */
interface ParsedFont {
    unitsPerEm: number;
    advanceForCp(cp: number): number | null;
}

/** Le tabelle che servono, già decompresse: buffer e offset di ciascuna. `hmtxStride` 2 = hmtx
 *  trasformato di WOFF2 (solo gli advance, dopo un byte di flag), 4 = hmtx normale. */
interface FontTables {
    b: Buffer;
    table: Record<string, number>;
    hmtxStart: number;
    hmtxStride: 2 | 4;
}

/** Tetto ai byte decompressi di un WOFF/WOFF2: un font reale sta ben sotto, un file anomalo non
 *  può gonfiare la memoria del processo. */
const MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024;

/** Tag delle tabelle note di WOFF2, per indice (spec W3C, "Known Table Tags"). */
const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf',
    'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
    'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ',
    'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
    'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

/** Tabelle di un TTF/OTF, di un WOFF (zlib per tabella) o di un WOFF2 (un unico flusso Brotli). */
function readTables(b: Buffer): FontTables {
    const signature = b.toString('latin1', 0, 4);
    if (signature === 'wOFF') {
        const parts: Buffer[] = [];
        const table: Record<string, number> = {};
        let offset = 0;
        for (let i = 0; i < b.readUInt16BE(12); i++) {
            const rec = 44 + i * 20;
            const start = b.readUInt32BE(rec + 4), compLength = b.readUInt32BE(rec + 8), origLength = b.readUInt32BE(rec + 12);
            const raw = b.subarray(start, start + compLength);
            parts.push(compLength < origLength ? inflateSync(raw, { maxOutputLength: MAX_DECOMPRESSED_BYTES }) : raw);
            table[b.toString('latin1', rec, rec + 4)] = offset;
            offset += origLength;
        }
        return { b: Buffer.concat(parts), table, hmtxStart: 0, hmtxStride: 4 };
    }
    if (signature === 'wOF2') {
        if (b.toString('latin1', 4, 8) === 'ttcf') throw new Error('WOFF2: collezioni non gestite');
        let pos = 48;
        const uintBase128 = (): number => {
            let value = 0;
            for (let i = 0; i < 5; i++) {
                const byte = b[pos++];
                value = value * 128 + (byte & 0x7f);
                if (!(byte & 0x80)) return value;
            }
            throw new Error('WOFF2: UIntBase128 non valido');
        };
        const entries: { tag: string; length: number; transformed: boolean }[] = [];
        for (let i = 0; i < b.readUInt16BE(12); i++) {
            const flags = b[pos++];
            const tag = (flags & 0x3f) === 63 ? b.toString('latin1', pos, (pos += 4)) : WOFF2_TAGS[flags & 0x3f];
            const version = flags >> 6;
            const origLength = uintBase128();
            // glyf/loca sono trasformati con la versione 0, ogni altra tabella con una versione ≠ 0.
            const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
            entries.push({ tag, length: transformed ? uintBase128() : origLength, transformed });
        }
        const data = brotliDecompressSync(b.subarray(pos, pos + b.readUInt32BE(20)), { maxOutputLength: MAX_DECOMPRESSED_BYTES });
        const table: Record<string, number> = {};
        let offset = 0;
        let hmtxTransformed = false;
        for (const e of entries) {
            table[e.tag] = offset;
            if (e.tag === 'hmtx') hmtxTransformed = e.transformed;
            offset += e.length;
        }
        return { b: data, table, hmtxStart: hmtxTransformed ? 1 : 0, hmtxStride: hmtxTransformed ? 2 : 4 };
    }
    // TTF/OTF: record da 16 byte (tag, checksum, offset, length) da +12.
    const table: Record<string, number> = {};
    for (let i = 0; i < b.readUInt16BE(4); i++) {
        const rec = 12 + i * 16;
        table[b.toString('latin1', rec, rec + 4)] = b.readUInt32BE(rec + 8);
    }
    return { b, table, hmtxStart: 0, hmtxStride: 4 };
}

/** Apre un font e prepara il lookup advance per code point. Lancia su struttura non gestita. */
function parseFont(file: string): ParsedFont {
    const { b, table, hmtxStart, hmtxStride } = readTables(readFileSync(file));
    const { head, hhea, maxp, hmtx, cmap } = table;
    if (head == null || hhea == null || maxp == null || hmtx == null || cmap == null) {
        throw new Error('font: tabella richiesta mancante');
    }

    const unitsPerEm = b.readUInt16BE(head + 18);
    const numHMetrics = b.readUInt16BE(hhea + 34);

    // hmtx: un advance per glifo fino a numHMetrics; i glifi oltre ereditano l'ultimo (coda monospazio).
    const glyphAdvance = (gid: number): number =>
        b.readUInt16BE(hmtx + hmtxStart + Math.min(gid, numHMetrics - 1) * hmtxStride);

    const sub = findUnicodeCmap(b, cmap);
    const cpToGlyph = b.readUInt16BE(sub) === 12 ? parseCmapFormat12(b, sub) : parseCmapFormat4(b, sub);

    return {
        unitsPerEm,
        advanceForCp(cp: number): number | null {
            const gid = cpToGlyph(cp);
            return gid === 0 ? null : glyphAdvance(gid);
        },
    };
}

/** Priorità di una sottotabella cmap (più bassa = migliore), `Infinity` se inutilizzabile: formato
 *  12 Unicode (copre anche oltre il BMP), poi formato 4 Windows BMP (3,1), Unicode (0,3)/(0,4),
 *  ogni altra Unicode (0,*), infine Windows Symbol (3,0). Ogni altro formato (0, 6, 13, 14…) non si usa. */
function cmapRank(platform: number, encoding: number, format: number): number {
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (format === 12) return unicode ? 0 : Infinity;
    if (format !== 4) return Infinity;
    if (platform === 3 && (encoding === 1 || encoding === 10)) return 1;
    if (platform === 0) return encoding === 3 || encoding === 4 ? 2 : 3;
    if (platform === 3 && encoding === 0) return 4;
    return Infinity;
}

/** Offset della sottotabella cmap da usare, la migliore per `cmapRank`. Lancia se non ce n'è una utilizzabile. */
function findUnicodeCmap(b: Buffer, cmap: number): number {
    let chosen = -1;
    let chosenRank = Infinity;
    for (let i = 0; i < b.readUInt16BE(cmap + 2); i++) {
        const rec = cmap + 4 + i * 8;
        const sub = cmap + b.readUInt32BE(rec + 4);
        const rank = cmapRank(b.readUInt16BE(rec), b.readUInt16BE(rec + 2), b.readUInt16BE(sub));
        if (rank < chosenRank) { chosen = sub; chosenRank = rank; }
    }
    if (chosen < 0) throw new Error('cmap: nessuna sottotabella Unicode in formato 4 o 12');
    return chosen;
}

/** Lookup code point → glyph id da una sottotabella cmap formato 4 (segmenti a 16 bit, solo BMP). */
function parseCmapFormat4(b: Buffer, sub: number): (cp: number) => number {
    const segCount = b.readUInt16BE(sub + 6) / 2;
    const endCodes = sub + 14;
    const startCodes = endCodes + segCount * 2 + 2; // +2 = reservedPad
    const idDeltas = startCodes + segCount * 2;
    const idRangeOffsets = idDeltas + segCount * 2;

    return (cp: number): number => {
        if (cp > 0xffff) return 0;
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

/** Lookup code point → glyph id da una sottotabella cmap formato 12: gruppi ordinati
 *  (startChar, endChar, startGlyph) da 12 byte, ricerca binaria. */
function parseCmapFormat12(b: Buffer, sub: number): (cp: number) => number {
    const numGroups = b.readUInt32BE(sub + 12);
    const groups = sub + 16;
    return (cp: number): number => {
        let lo = 0, hi = numGroups - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const g = groups + mid * 12;
            const start = b.readUInt32BE(g);
            if (cp < start) hi = mid - 1;
            else if (cp > b.readUInt32BE(g + 4)) lo = mid + 1;
            else return b.readUInt32BE(g + 8) + (cp - start);
        }
        return 0;
    };
}

/** Advance (unità/1000 em) dei code point misurati che il font ha: gli altri restano fuori tabella
 *  e in misura valgono `fallbackAdvance`. */
function advanceTable(font: ParsedFont): Record<number, number> {
    const advance: Record<number, number> = {};
    for (const cp of MEASURED_CODEPOINTS) {
        const units = font.advanceForCp(cp);
        if (units != null) advance[cp] = Math.round((units * 1000) / font.unitsPerEm);
    }
    return advance;
}

/** Advance medio (in em) delle lettere ASCII che il font ha. Lancia se non ne ha nessuna. */
function meanLetterEm(font: ParsedFont): number {
    let sum = 0, count = 0;
    for (const cp of LETTERS) {
        const units = font.advanceForCp(cp);
        if (units) { sum += units / font.unitsPerEm; count++; }
    }
    if (count === 0) throw new Error('metriche: nessuna lettera ASCII nel font');
    return sum / count;
}

/** Fattore arrotondato a 3 decimali, mai sotto 1: il grassetto non si misura più stretto del regular. */
function roundFactor(factor: number): number {
    return Math.max(1, Math.round(factor * 1000) / 1000);
}

/** Rapporto reale bold/regular: somma degli advance (in em) delle lettere ASCII presenti in entrambe le facce. */
function realBoldFactor(regular: ParsedFont, bold: ParsedFont): number {
    let sumRegular = 0, sumBold = 0;
    for (const cp of LETTERS) {
        const r = regular.advanceForCp(cp);
        const bAdv = bold.advanceForCp(cp);
        if (r && bAdv) {
            sumRegular += r / regular.unitsPerEm;
            sumBold += bAdv / bold.unitsPerEm;
        }
    }
    if (sumRegular <= 0) throw new Error('nessuna lettera ASCII in comune col regular');
    return roundFactor(sumBold / sumRegular);
}

/** Grassetto sintetico (nessuna faccia 700: lo disegna fontconfig/FreeType allargando ogni glifo di
 *  ~1/24 em): fattore = (lettera media + 1/24 em) / lettera media. Stima, in eccesso più che in difetto. */
function syntheticBoldFactor(regular: ParsedFont): number {
    const mean = meanLetterEm(regular);
    return roundFactor((mean + 1 / 24) / mean);
}

/** Metriche di un font dalle sue facce (`SystemFontDef.faces` o `CustomFontDef.faces`): advance
 *  dalla faccia più vicina a 400 (quella che disegna il testo regular), `boldFactor` dalla faccia
 *  che disegna il grassetto. Il fattore si applica una volta sola, sopra gli advance regular:
 *  - una faccia 700 distinta → rapporto reale medio bold/regular sulle lettere;
 *  - nessuna faccia 700, o il suo file assente → grassetto sintetico di fontconfig;
 *  - l'unica faccia è già 700 → regular e bold escono dallo stesso file: fattore 1.
 *  `pathOf` risolve `face.file` in percorso assoluto. Lancia se la faccia regular non si legge. */
function buildMetric(
    faces: readonly { file: string; weight: number; style: 'normal' | 'italic' }[],
    pathOf: (file: string) => string,
): FontMetric {
    const regularFace = closestFace(faces, 400);
    const boldFace = closestFace(faces, 700);
    if (!regularFace || !boldFace) throw new Error('font: nessuna faccia dichiarata');
    const regular = parseFont(pathOf(regularFace.file));

    let boldFactor: number;
    if (boldFace === regularFace) {
        boldFactor = regularFace.weight >= 700 ? 1 : syntheticBoldFactor(regular);
    } else if (!existsSync(pathOf(boldFace.file))) {
        // fontconfig non trova la faccia bold: sintetizza il grassetto dal regular.
        boldFactor = syntheticBoldFactor(regular);
    } else {
        try {
            boldFactor = realBoldFactor(regular, parseFont(pathOf(boldFace.file)));
        } catch (err) {
            console.warn(`[font-metrics] ${boldFace.file}: faccia bold non leggibile, grassetto stimato come sintetico: ${(err as Error).message}`);
            boldFactor = syntheticBoldFactor(regular);
        }
    }

    // Un glifo fuori tabella (o che il font non ha e prende da un altro) vale un em: meglio andare a
    // capo prima che uscire dal badge.
    const metric: FontMetric = { advance: advanceTable(regular), fallbackAdvance: 1000, boldFactor };
    assertSane(metric);
    return metric;
}

/** Scarta risultati di parsing palesemente sbagliati (che il fallback per-errore non intercetterebbe):
 *  troppi glifi mancanti, spazio nullo, `o`/`M` fuori da larghezze plausibili, grassetto implausibile. */
function assertSane(m: FontMetric): void {
    const count = Object.keys(m.advance ?? {}).length;
    const space = m.advance?.[0x20] ?? 0;
    const o = m.advance?.[0x6f] ?? 0;
    const M = m.advance?.[0x4d] ?? 0;
    if (count < 90) throw new Error(`metriche: troppi glifi mancanti (${count}/${MEASURED_CODEPOINTS.length})`);
    if (space <= 0 || space > 1000) throw new Error(`metriche: advance dello spazio non valido (${space})`);
    if (o < 200 || o > 1000) throw new Error(`metriche: advance di "o" fuori range (${o})`);
    if (M < 300 || M > 1500) throw new Error(`metriche: advance di "M" fuori range (${M})`);
    if (m.boldFactor < 1 || m.boldFactor > 1.4) throw new Error(`metriche: boldFactor fuori range (${m.boldFactor})`);
}

/** Metriche per ogni `SYSTEM_FONTS` dai file reali (fallback per-font sullo snapshot `FONT_METRICS`),
 *  più ogni font custom del catalogo (fallback Liberation): `og.testo` può disegnare l'og:image con
 *  qualunque `SystemFont` o font custom del catalogo. Da passare a `FontMetrics.configure`, sincrono
 *  e una-tantum. Log: una riga sola se nessun font di sistema è installato (dev fuori dal
 *  container), altrimenti una riga per ogni font che ripiega sul fallback. */
export function loadServerFontMetrics(): Record<string, FontMetric> {
    const result: Record<string, FontMetric> = {};
    const systemKeys = Object.values(SystemFont) as SystemFont[];
    const absent: { key: SystemFont; file: string }[] = [];
    for (const key of systemKeys) {
        result[key] = FONT_METRICS[key];
        const faces = SYSTEM_FONTS[key].faces;
        const regularFile = closestFace(faces, 400)!.file;
        if (!existsSync(regularFile)) { absent.push({ key, file: regularFile }); continue; }
        try {
            result[key] = buildMetric(faces, file => file);
        } catch (err) {
            console.warn(`[font-metrics] ${key}: font non leggibile, misurato con le tabelle di fallback: ${(err as Error).message}`);
        }
    }
    if (absent.length === systemKeys.length) {
        console.info('[font-metrics] nessun font di sistema installato: misure dalle tabelle di fallback');
    } else {
        for (const { key, file } of absent) console.warn(`[font-metrics] ${key}: ${file} assente, misurato con le tabelle di fallback`);
    }

    for (const custom of ContestoSito.config.customFontsCatalog) {
        const regularFile = closestFace(custom.faces, 400)?.file;
        if (!regularFile) continue;
        // Senza metriche vere il testo si misura con Liberation: con un font più largo esce dai badge.
        result[custom.key] = FONT_METRICS[SystemFont.Liberation];
        const path = customFontFacePath(regularFile);
        if (!existsSync(path)) {
            console.info(`[font-metrics] "${custom.key}": ${path} assente, misurato come Liberation`);
            continue;
        }
        try {
            result[custom.key] = buildMetric(custom.faces, customFontFacePath);
        } catch (err) {
            console.warn(`[font-metrics] "${custom.key}" (${regularFile}) non leggibile, misurato come Liberation: ${(err as Error).message}`);
        }
    }
    return result;
}
