import { FontConfig, ServerFont } from '../../../../styles/font-config';

/**
 * FONT METRICS
 *
 * Misura della larghezza del testo senza canvas/DOM, per il layer server (Sharp/SSR) dove non
 * esiste `ctx.measureText`. Le metriche vivono in un dizionario `FONT_METRICS` keyed sulle
 * **costanti dei font server** (`FontConfig.SERVER_FONTS`), così ogni font ha i suoi valori e la
 * misura resta corretta anche cambiando `DEFAULT_SERVER_FONT_KEY`.
 *
 * Le tabelle `advance` (unità/1000 em, code point 32–126) sono ESTRATTE dai file dei font
 * realmente installati nel container (LiberationSans/Roboto/DejaVuSans/NotoSans, Regular), così
 * corrispondono al rendering. Per rigenerarle: leggere `head.unitsPerEm` + `cmap` + `hmtx` con un
 * parser TTF (es. `fonttools`) e scalare `advance·1000/unitsPerEm`. `fallbackAdvance` (≈ advance
 * di 'o') copre i code point fuori tabella (accentate rare, emoji, CJK). `boldFactor` = rapporto
 * medio bold/regular sulle lettere. Limite noto: solo advance per-glifo (niente kerning/ligature).
 */

/** Metriche di un singolo font, per il calcolo della larghezza testo lato server. */
export interface FontMetric {
    /** Advance width per code point. Assente → si usa `fallbackAdvance` per ogni glifo. */
    advance?: Readonly<Record<number, number>>;
    /** Advance dei glifi fuori `advance`, o di OGNI glifo se `advance` è assente. */
    fallbackAdvance: number;
    /** Maggiorazione media del grassetto (il rendering OG usa font-weight 700). */
    boldFactor: number;
}

/** Liberation Sans (metric-compatibile con Arial/Helvetica). */
const LIBERATION_ADVANCE: Readonly<Record<number, number>> = {
    32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
    40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
    48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
    56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556,
    64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
    72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778,
    80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
    88: 667, 89: 667, 90: 611, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556,
    96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
    104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556, 111: 556,
    112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556, 118: 500, 119: 722,
    120: 500, 121: 500, 122: 500, 123: 334, 124: 260, 125: 334, 126: 584,
};

/** Roboto (Regular). */
const ROBOTO_ADVANCE: Readonly<Record<number, number>> = {
    32: 248, 33: 258, 34: 320, 35: 616, 36: 562, 37: 732, 38: 622, 39: 175,
    40: 342, 41: 348, 42: 431, 43: 567, 44: 197, 45: 276, 46: 264, 47: 413,
    48: 562, 49: 562, 50: 562, 51: 562, 52: 562, 53: 562, 54: 562, 55: 562,
    56: 562, 57: 562, 58: 242, 59: 211, 60: 508, 61: 549, 62: 523, 63: 473,
    64: 898, 65: 652, 66: 623, 67: 651, 68: 656, 69: 568, 70: 553, 71: 681,
    72: 713, 73: 272, 74: 552, 75: 627, 76: 539, 77: 873, 78: 713, 79: 688,
    80: 631, 81: 688, 82: 616, 83: 594, 84: 597, 85: 648, 86: 637, 87: 887,
    88: 627, 89: 601, 90: 599, 91: 265, 92: 411, 93: 265, 94: 418, 95: 451,
    96: 309, 97: 544, 98: 562, 99: 523, 100: 564, 101: 530, 102: 348, 103: 562,
    104: 551, 105: 243, 106: 239, 107: 507, 108: 243, 109: 877, 110: 552, 111: 570,
    112: 562, 113: 568, 114: 339, 115: 516, 116: 327, 117: 551, 118: 484, 119: 751,
    120: 496, 121: 473, 122: 496, 123: 338, 124: 244, 125: 338, 126: 680,
};

/** DejaVu Sans (più largo della media). */
const DEJAVU_ADVANCE: Readonly<Record<number, number>> = {
    32: 318, 33: 401, 34: 460, 35: 838, 36: 636, 37: 950, 38: 780, 39: 275,
    40: 390, 41: 390, 42: 500, 43: 838, 44: 318, 45: 361, 46: 318, 47: 337,
    48: 636, 49: 636, 50: 636, 51: 636, 52: 636, 53: 636, 54: 636, 55: 636,
    56: 636, 57: 636, 58: 337, 59: 337, 60: 838, 61: 838, 62: 838, 63: 531,
    64: 1000, 65: 684, 66: 686, 67: 698, 68: 770, 69: 632, 70: 575, 71: 775,
    72: 752, 73: 295, 74: 295, 75: 656, 76: 557, 77: 863, 78: 748, 79: 787,
    80: 603, 81: 787, 82: 695, 83: 635, 84: 611, 85: 732, 86: 684, 87: 989,
    88: 685, 89: 611, 90: 685, 91: 390, 92: 337, 93: 390, 94: 838, 95: 500,
    96: 500, 97: 613, 98: 635, 99: 550, 100: 635, 101: 615, 102: 352, 103: 635,
    104: 634, 105: 278, 106: 278, 107: 579, 108: 278, 109: 974, 110: 634, 111: 612,
    112: 635, 113: 635, 114: 411, 115: 521, 116: 392, 117: 634, 118: 592, 119: 818,
    120: 592, 121: 592, 122: 525, 123: 636, 124: 337, 125: 636, 126: 838,
};

/** Noto Sans (Regular). */
const NOTO_ADVANCE: Readonly<Record<number, number>> = {
    32: 260, 33: 269, 34: 408, 35: 646, 36: 572, 37: 831, 38: 732, 39: 225,
    40: 300, 41: 300, 42: 551, 43: 572, 44: 268, 45: 322, 46: 268, 47: 372,
    48: 572, 49: 572, 50: 572, 51: 572, 52: 572, 53: 572, 54: 572, 55: 572,
    56: 572, 57: 572, 58: 268, 59: 268, 60: 572, 61: 572, 62: 572, 63: 434,
    64: 899, 65: 639, 66: 650, 67: 632, 68: 730, 69: 556, 70: 519, 71: 728,
    72: 741, 73: 339, 74: 273, 75: 619, 76: 524, 77: 907, 78: 760, 79: 781,
    80: 605, 81: 781, 82: 622, 83: 549, 84: 556, 85: 731, 86: 600, 87: 930,
    88: 586, 89: 566, 90: 572, 91: 329, 92: 372, 93: 329, 94: 572, 95: 444,
    96: 281, 97: 561, 98: 615, 99: 480, 100: 615, 101: 564, 102: 344, 103: 615,
    104: 618, 105: 258, 106: 258, 107: 534, 108: 258, 109: 935, 110: 618, 111: 605,
    112: 615, 113: 615, 114: 413, 115: 479, 116: 361, 117: 618, 118: 508, 119: 786,
    120: 529, 121: 510, 122: 470, 123: 380, 124: 551, 125: 380, 126: 572,
};

/** Metriche per ogni font server. Chiavi = enum `ServerFont` (a prova di typo).
 *  Tutte con tabella `advance` precisa estratta dai file font installati. */
export const FONT_METRICS: Record<ServerFont, FontMetric> = {
    [ServerFont.Liberation]: { advance: LIBERATION_ADVANCE, fallbackAdvance: 556, boldFactor: 1.051 },
    [ServerFont.Roboto]: { advance: ROBOTO_ADVANCE, fallbackAdvance: 570, boldFactor: 1.014 },
    [ServerFont.DejaVu]: { advance: DEJAVU_ADVANCE, fallbackAdvance: 612, boldFactor: 1.125 },
    [ServerFont.Noto]: { advance: NOTO_ADVANCE, fallbackAdvance: 605, boldFactor: 1.060 },
};

export class FontMetrics {
    /**
     * Larghezza in pixel del testo al `fontSizePx` indicato, con le metriche del font server di
     * default (`FontConfig.DEFAULT_SERVER_FONT_KEY`). `bold` applica la maggiorazione del peso 700.
     *
     * Niente parametro `font`: la scelta vive solo in FontConfig (sorgente unica) ed è lo stesso
     * font che genera l'SVG → misura e rendering coincidono sempre. La firma `(text, fontSizePx,
     * bold)` combacia con `FitOptions.measureFn`, così `measure` si passa come callback nudo
     * (es. `measureFn: FontMetrics.measure`), senza dipendere da `this` alla chiamata.
     */
    static measure(text: string, fontSizePx: number, bold = false): number {
        const m = FONT_METRICS[FontConfig.DEFAULT_SERVER_FONT_KEY];
        let units = 0;
        for (const ch of text) units += m.advance?.[ch.codePointAt(0)!] ?? m.fallbackAdvance;
        const px = (units * fontSizePx) / 1000;
        return bold ? px * m.boldFactor : px;
    }
}
