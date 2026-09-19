import { SystemFont } from '../font-system';
import { ContestoSito } from '../../../site';

/**
 * FONT METRICS
 *
 * Misura della larghezza del testo senza canvas/DOM, per il layer server (Sharp/SSR) dove non
 * esiste `ctx.measureText`. Le metriche vivono in un dizionario `FONT_METRICS` keyed su
 * `SystemFont` (`core/engine/font-system.ts`), così ogni font ha i suoi valori e la misura resta
 * corretta anche cambiando il font scelto dal design system attivo.
 *
 * Le metriche reali le deriva a runtime il loader server (`server/server-font-metrics`), che legge
 * DIRETTAMENTE i file di `SYSTEM_FONTS` (percorso già noto, nessun `fc-match` — a differenza del
 * font custom di progetto, per il catalogo il path è verificato a priori, vedi font-system.ts) e
 * li parsa come TTF: così restano allineate ai file senza rigenerare a mano. Il loader si inietta
 * con `FontMetrics.configure`; gira pigro al primo `measure` e su QUALSIASI intoppo (file non
 * leggibile, numeri implausibili) cade sulle tabelle `FONT_METRICS` qui sotto. Quindi questo file
 * resta privo di dipendenze node, e le tabelle sono lo **snapshot di fallback** — non più l'unica
 * fonte.
 *
 * Le tabelle `advance` (unità/1000 em, code point 32–126) sono ESTRATTE dai font reali installati
 * nel container (Regular di ciascuna delle 11 voci di `SystemFont`) con lo stesso parser TTF di
 * `server/server-font-metrics.ts` (`head.unitsPerEm` + `cmap` + `hmtx`), non inventate. Per
 * rigenerare uno snapshot dopo un aggiornamento dei pacchetti Alpine: leggere `head.unitsPerEm` +
 * `cmap` + `hmtx` con un parser TTF (es. `fonttools`) e scalare `advance·1000/unitsPerEm`.
 * `fallbackAdvance` (≈ advance di 'o') copre i code point fuori tabella (accentate rare, emoji,
 * CJK). `boldFactor` = rapporto medio bold/regular sulle lettere. Limite noto: solo advance
 * per-glifo (niente kerning/ligature).
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

/** Noto Serif (Regular). */
const NOTO_SERIF_ADVANCE: Readonly<Record<number, number>> = {
    32: 260, 33: 332, 34: 408, 35: 559, 36: 559, 37: 896, 38: 742, 39: 220,
    40: 346, 41: 346, 42: 500, 43: 559, 44: 250, 45: 310, 46: 250, 47: 288,
    48: 559, 49: 559, 50: 559, 51: 559, 52: 559, 53: 559, 54: 559, 55: 559,
    56: 559, 57: 559, 58: 286, 59: 286, 60: 559, 61: 559, 62: 559, 63: 474,
    64: 921, 65: 705, 66: 654, 67: 614, 68: 727, 69: 623, 70: 590, 71: 714,
    72: 793, 73: 367, 74: 357, 75: 700, 76: 623, 77: 938, 78: 763, 79: 742,
    80: 604, 81: 742, 82: 656, 83: 544, 84: 613, 85: 717, 86: 675, 87: 1047,
    88: 660, 89: 625, 90: 592, 91: 360, 92: 288, 93: 360, 94: 559, 95: 459,
    96: 274, 97: 563, 98: 614, 99: 492, 100: 614, 101: 535, 102: 369, 103: 538,
    104: 635, 105: 320, 106: 300, 107: 585, 108: 310, 109: 945, 110: 645, 111: 577,
    112: 614, 113: 614, 114: 471, 115: 451, 116: 352, 117: 635, 118: 579, 119: 862,
    120: 578, 121: 565, 122: 511, 123: 428, 124: 559, 125: 428, 126: 559,
};

/** Liberation Serif (Regular, metric-compatibile con Times New Roman). */
const LIBERATION_SERIF_ADVANCE: Readonly<Record<number, number>> = {
    32: 250, 33: 333, 34: 408, 35: 500, 36: 500, 37: 833, 38: 778, 39: 180,
    40: 333, 41: 333, 42: 500, 43: 564, 44: 250, 45: 333, 46: 250, 47: 278,
    48: 500, 49: 500, 50: 500, 51: 500, 52: 500, 53: 500, 54: 500, 55: 500,
    56: 500, 57: 500, 58: 278, 59: 278, 60: 564, 61: 564, 62: 564, 63: 444,
    64: 921, 65: 722, 66: 667, 67: 667, 68: 722, 69: 611, 70: 556, 71: 722,
    72: 722, 73: 333, 74: 389, 75: 722, 76: 611, 77: 889, 78: 722, 79: 722,
    80: 556, 81: 722, 82: 667, 83: 556, 84: 611, 85: 722, 86: 722, 87: 944,
    88: 722, 89: 722, 90: 611, 91: 333, 92: 278, 93: 333, 94: 469, 95: 500,
    96: 333, 97: 444, 98: 500, 99: 444, 100: 500, 101: 444, 102: 333, 103: 500,
    104: 500, 105: 278, 106: 278, 107: 500, 108: 278, 109: 778, 110: 500, 111: 500,
    112: 500, 113: 500, 114: 333, 115: 389, 116: 278, 117: 500, 118: 500, 119: 722,
    120: 500, 121: 500, 122: 444, 123: 480, 124: 200, 125: 480, 126: 541,
};

/** Liberation Mono (Regular, metric-compatibile con Courier New) — monospace: ogni glifo 600. */
const LIBERATION_MONO_ADVANCE: Readonly<Record<number, number>> = {
    32: 600, 33: 600, 34: 600, 35: 600, 36: 600, 37: 600, 38: 600, 39: 600,
    40: 600, 41: 600, 42: 600, 43: 600, 44: 600, 45: 600, 46: 600, 47: 600,
    48: 600, 49: 600, 50: 600, 51: 600, 52: 600, 53: 600, 54: 600, 55: 600,
    56: 600, 57: 600, 58: 600, 59: 600, 60: 600, 61: 600, 62: 600, 63: 600,
    64: 600, 65: 600, 66: 600, 67: 600, 68: 600, 69: 600, 70: 600, 71: 600,
    72: 600, 73: 600, 74: 600, 75: 600, 76: 600, 77: 600, 78: 600, 79: 600,
    80: 600, 81: 600, 82: 600, 83: 600, 84: 600, 85: 600, 86: 600, 87: 600,
    88: 600, 89: 600, 90: 600, 91: 600, 92: 600, 93: 600, 94: 600, 95: 600,
    96: 600, 97: 600, 98: 600, 99: 600, 100: 600, 101: 600, 102: 600, 103: 600,
    104: 600, 105: 600, 106: 600, 107: 600, 108: 600, 109: 600, 110: 600, 111: 600,
    112: 600, 113: 600, 114: 600, 115: 600, 116: 600, 117: 600, 118: 600, 119: 600,
    120: 600, 121: 600, 122: 600, 123: 600, 124: 600, 125: 600, 126: 600,
};

/** DejaVu Serif (Regular). */
const DEJAVU_SERIF_ADVANCE: Readonly<Record<number, number>> = {
    32: 318, 33: 402, 34: 460, 35: 838, 36: 636, 37: 950, 38: 890, 39: 275,
    40: 390, 41: 390, 42: 500, 43: 838, 44: 318, 45: 338, 46: 318, 47: 337,
    48: 636, 49: 636, 50: 636, 51: 636, 52: 636, 53: 636, 54: 636, 55: 636,
    56: 636, 57: 636, 58: 337, 59: 337, 60: 838, 61: 838, 62: 838, 63: 536,
    64: 1000, 65: 722, 66: 735, 67: 765, 68: 802, 69: 730, 70: 694, 71: 799,
    72: 872, 73: 395, 74: 401, 75: 747, 76: 664, 77: 1024, 78: 875, 79: 820,
    80: 673, 81: 820, 82: 753, 83: 685, 84: 667, 85: 843, 86: 722, 87: 1028,
    88: 712, 89: 660, 90: 695, 91: 390, 92: 337, 93: 390, 94: 838, 95: 500,
    96: 500, 97: 596, 98: 640, 99: 560, 100: 640, 101: 592, 102: 370, 103: 640,
    104: 644, 105: 320, 106: 310, 107: 606, 108: 320, 109: 948, 110: 644, 111: 602,
    112: 640, 113: 640, 114: 478, 115: 513, 116: 402, 117: 644, 118: 565, 119: 856,
    120: 564, 121: 565, 122: 527, 123: 636, 124: 337, 125: 636, 126: 838,
};

/** DejaVu Sans Mono (Regular) — monospace: ogni glifo 602. */
const DEJAVU_MONO_ADVANCE: Readonly<Record<number, number>> = {
    32: 602, 33: 602, 34: 602, 35: 602, 36: 602, 37: 602, 38: 602, 39: 602,
    40: 602, 41: 602, 42: 602, 43: 602, 44: 602, 45: 602, 46: 602, 47: 602,
    48: 602, 49: 602, 50: 602, 51: 602, 52: 602, 53: 602, 54: 602, 55: 602,
    56: 602, 57: 602, 58: 602, 59: 602, 60: 602, 61: 602, 62: 602, 63: 602,
    64: 602, 65: 602, 66: 602, 67: 602, 68: 602, 69: 602, 70: 602, 71: 602,
    72: 602, 73: 602, 74: 602, 75: 602, 76: 602, 77: 602, 78: 602, 79: 602,
    80: 602, 81: 602, 82: 602, 83: 602, 84: 602, 85: 602, 86: 602, 87: 602,
    88: 602, 89: 602, 90: 602, 91: 602, 92: 602, 93: 602, 94: 602, 95: 602,
    96: 602, 97: 602, 98: 602, 99: 602, 100: 602, 101: 602, 102: 602, 103: 602,
    104: 602, 105: 602, 106: 602, 107: 602, 108: 602, 109: 602, 110: 602, 111: 602,
    112: 602, 113: 602, 114: 602, 115: 602, 116: 602, 117: 602, 118: 602, 119: 602,
    120: 602, 121: 602, 122: 602, 123: 602, 124: 602, 125: 602, 126: 602,
};

/** Open Sans (Regular). */
const OPENSANS_ADVANCE: Readonly<Record<number, number>> = {
    32: 260, 33: 264, 34: 398, 35: 646, 36: 572, 37: 827, 38: 729, 39: 219,
    40: 295, 41: 295, 42: 551, 43: 572, 44: 259, 45: 322, 46: 263, 47: 367,
    48: 572, 49: 572, 50: 572, 51: 572, 52: 572, 53: 572, 54: 572, 55: 572,
    56: 572, 57: 572, 58: 263, 59: 263, 60: 572, 61: 572, 62: 572, 63: 432,
    64: 896, 65: 632, 66: 646, 67: 630, 68: 726, 69: 556, 70: 516, 71: 727,
    72: 737, 73: 279, 74: 269, 75: 612, 76: 522, 77: 899, 78: 753, 79: 778,
    80: 602, 81: 778, 82: 617, 83: 548, 84: 551, 85: 729, 86: 596, 87: 923,
    88: 578, 89: 559, 90: 572, 91: 327, 92: 367, 93: 327, 94: 572, 95: 438,
    96: 277, 97: 556, 98: 612, 99: 479, 100: 612, 101: 562, 102: 336, 103: 543,
    104: 613, 105: 252, 106: 252, 107: 525, 108: 252, 109: 926, 110: 613, 111: 602,
    112: 612, 113: 612, 114: 409, 115: 477, 116: 356, 117: 613, 118: 500, 119: 775,
    120: 523, 121: 501, 122: 469, 123: 375, 124: 549, 125: 375, 126: 572,
};

/** JetBrains Mono (Regular) — monospace: ogni glifo 600. */
const JETBRAINS_MONO_ADVANCE: Readonly<Record<number, number>> = {
    32: 600, 33: 600, 34: 600, 35: 600, 36: 600, 37: 600, 38: 600, 39: 600,
    40: 600, 41: 600, 42: 600, 43: 600, 44: 600, 45: 600, 46: 600, 47: 600,
    48: 600, 49: 600, 50: 600, 51: 600, 52: 600, 53: 600, 54: 600, 55: 600,
    56: 600, 57: 600, 58: 600, 59: 600, 60: 600, 61: 600, 62: 600, 63: 600,
    64: 600, 65: 600, 66: 600, 67: 600, 68: 600, 69: 600, 70: 600, 71: 600,
    72: 600, 73: 600, 74: 600, 75: 600, 76: 600, 77: 600, 78: 600, 79: 600,
    80: 600, 81: 600, 82: 600, 83: 600, 84: 600, 85: 600, 86: 600, 87: 600,
    88: 600, 89: 600, 90: 600, 91: 600, 92: 600, 93: 600, 94: 600, 95: 600,
    96: 600, 97: 600, 98: 600, 99: 600, 100: 600, 101: 600, 102: 600, 103: 600,
    104: 600, 105: 600, 106: 600, 107: 600, 108: 600, 109: 600, 110: 600, 111: 600,
    112: 600, 113: 600, 114: 600, 115: 600, 116: 600, 117: 600, 118: 600, 119: 600,
    120: 600, 121: 600, 122: 600, 123: 600, 124: 600, 125: 600, 126: 600,
};

/** Snapshot di fallback per ogni font di sistema. Chiavi = enum `SystemFont` (a prova di typo).
 *  Usato quando il loader runtime non può leggere i font reali (vedi nota di testa). Tabelle
 *  `advance` estratte dai file font installati — tutte e 11, non solo i 4 Sans originali. */
export const FONT_METRICS: Record<SystemFont, FontMetric> = {
    [SystemFont.Liberation]: { advance: LIBERATION_ADVANCE, fallbackAdvance: 556, boldFactor: 1.051 },
    [SystemFont.Roboto]: { advance: ROBOTO_ADVANCE, fallbackAdvance: 570, boldFactor: 1.014 },
    [SystemFont.DejaVu]: { advance: DEJAVU_ADVANCE, fallbackAdvance: 612, boldFactor: 1.125 },
    [SystemFont.Noto]: { advance: NOTO_ADVANCE, fallbackAdvance: 605, boldFactor: 1.060 },
    [SystemFont.NotoSerif]: { advance: NOTO_SERIF_ADVANCE, fallbackAdvance: 577, boldFactor: 1.061 },
    [SystemFont.LiberationSerif]: { advance: LIBERATION_SERIF_ADVANCE, fallbackAdvance: 500, boldFactor: 1.061 },
    [SystemFont.LiberationMono]: { advance: LIBERATION_MONO_ADVANCE, fallbackAdvance: 600, boldFactor: 1 },
    [SystemFont.DejaVuSerif]: { advance: DEJAVU_SERIF_ADVANCE, fallbackAdvance: 602, boldFactor: 1.089 },
    [SystemFont.DejaVuMono]: { advance: DEJAVU_MONO_ADVANCE, fallbackAdvance: 602, boldFactor: 1 },
    [SystemFont.OpenSans]: { advance: OPENSANS_ADVANCE, fallbackAdvance: 602, boldFactor: 1.069 },
    [SystemFont.JetBrainsMono]: { advance: JETBRAINS_MONO_ADVANCE, fallbackAdvance: 600, boldFactor: 1 },
};

/** Chiave di lookup nelle metriche: un `SystemFont` di catalogo o `ContestoSito.config.fonts.custom.family`.
 *  `ContestoSito.config.fonts.serverKey` è di questo tipo. */
export type ServerFontKey = SystemFont | string;

/** Loader (lato server) che deriva le metriche dai font realmente installati/montati, incluso
 *  l'eventuale custom (`ContestoSito.config.fonts.custom`). Iniettato via `FontMetrics.configure`; assente
 *  fuori dal server → si usano le tabelle `FONT_METRICS` (tutte e 11 le voci di `SystemFont`). */
export type ServerMetricsLoader = () => Record<string, FontMetric>;

/** Loader registrato dal layer server, e cache delle metriche risolte (una volta per processo). */
let metricsLoader: ServerMetricsLoader | null = null;
let activeMetrics: Record<string, FontMetric> | null = null;

export class FontMetrics {
    /**
     * Registra il loader che legge le metriche dai font reali (vedi `server/server-font-metrics`).
     * Lo chiama il layer server una volta sola, all'avvio; il loader gira pigro al primo `measure` e
     * cade da solo su `FONT_METRICS` se i font non sono leggibili. Senza `configure` (o se il loader
     * lancia) si usano direttamente le tabelle di fallback.
     */
    static configure(loader: ServerMetricsLoader): void {
        metricsLoader = loader;
        activeMetrics = null;
    }

    /** Metriche attive: derivate dai font reali al primo uso (loader memoizzato), o snapshot di fallback. */
    private static resolve(): Record<string, FontMetric> {
        if (activeMetrics) return activeMetrics;
        try {
            activeMetrics = metricsLoader ? metricsLoader() : FONT_METRICS;
        } catch {
            activeMetrics = FONT_METRICS;
        }
        return activeMetrics;
    }

    /**
     * Larghezza in pixel del testo al `fontSizePx` indicato, con le metriche del font server
     * effettivo (`ContestoSito.config.fonts.serverKey`: il custom se impostato, altrimenti il default di
     * sistema). `bold` applica la maggiorazione del peso 700. Se la chiave effettiva non ha
     * metriche risolte (es. custom dichiarato ma file assente dalla cartella montata), ripiega su
     * Liberation — mai un lookup a vuoto.
     *
     * Niente parametro `font`: la scelta vive solo nel design system attivo (`DesignSystemPreset.
     * defaultFont`/`addonFonts`, risolti in `ContestoSito.config.fonts` — sorgente unica) ed è lo
     * stesso font che genera l'SVG → misura e rendering coincidono sempre. La firma `(text, fontSizePx,
     * bold)` combacia con `FitOptions.measureFn`, così `measure` si passa come callback nudo
     * (es. `measureFn: FontMetrics.measure`), senza dipendere da `this` alla chiamata.
     */
    static measure(text: string, fontSizePx: number, bold = false): number {
        const m = FontMetrics.resolve()[ContestoSito.config.fonts.serverKey] ?? FONT_METRICS[SystemFont.Liberation];
        let units = 0;
        for (const ch of text) units += m.advance?.[ch.codePointAt(0)!] ?? m.fallbackAdvance;
        const px = (units * fontSizePx) / 1000;
        return bold ? px * m.boldFactor : px;
    }
}
