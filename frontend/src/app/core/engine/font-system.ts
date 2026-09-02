/**
 * FONT SYSTEM (Engine) — catalogo, tipi, risoluzione. La scelta del progetto vive nel Dominio,
 * in `frontend/src/styles/font-config.ts` — separata apposta, per non generare conflitti di merge
 * quando il template aggiorna il catalogo.
 */

/** Font server installati nel container. Enum, non stringhe magiche: `ServerFont.Liberation`. */
export enum ServerFont {
    Roboto = 'Roboto',
    DejaVu = 'DejaVu',
    Noto = 'Noto',
    Liberation = 'Liberation',
}

/** Fallback emoji comune a ogni stack (Apple/Segoe, a colori). */
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji"';

/** Compone uno stack CSS: famiglie + fallback emoji + famiglia generica. */
const stack = (families: string, generic: 'sans-serif' | 'serif' | 'monospace' = 'sans-serif'): string =>
    `${families}, ${EMOJI}, ${generic}`;

/** Font browser/Canvas di sistema. Aggiungerne uno: basta una voce qui. */
export const WEB_FONTS = {
    System: stack('system-ui, "Segoe UI", Arial'),
    Arial: stack('Arial'),
    Verdana: stack('Verdana'),
    Georgia: stack('Georgia', 'serif'),
    Times: stack('"Times New Roman", Times', 'serif'),
    CourierNew: stack('"Courier New"', 'monospace'),
} as const;

/** Font Sharp/OG installati nel Docker. Aggiungerne uno: enum `ServerFont` + qui +
 *  `FONT_METRICS` (obbligatoria) + installazione nel Dockerfile. */
export const SERVER_FONTS: Record<ServerFont, string> = {
    [ServerFont.Roboto]: stack('Roboto'),
    [ServerFont.DejaVu]: stack('DejaVu Sans'),
    [ServerFont.Noto]: stack('"Noto Sans"'),
    [ServerFont.Liberation]: stack('"Liberation Sans"'),
};

/** Font da un file caricato dal progetto (cartella `fonts/`, vedi `styles/font-config.ts`). */
export interface CustomFontDef {
    /** Nome CSS della font-family. */
    family: string;
    /** Nome del file nella cartella (es. 'Marlboro.woff2'). */
    file: string;
}

/** Contratto compilato dal Dominio (`siteFonts` in `styles/font-config.ts`). `custom` non ha
 *  tipizzazione forte sul nome: è un puntatore libero a un file, non un catalogo chiuso. */
export interface AppFontConfig {
    /** Quale WEB_FONTS è il default. */
    webDefault: keyof typeof WEB_FONTS;
    /** Quale SERVER_FONTS è il default (font-metrics.ts indicizza le metriche su questo). */
    serverDefault: ServerFont;
    /** Se presente, sostituisce ENTRAMBI i default sopra. Assente = comportamento invariato. */
    custom?: CustomFontDef;
}

/** Output di `resolveFonts`: quello che i consumer (ThemeService, server.ts, PreviewBuilder)
 *  leggono davvero — mai il catalogo o `AppFontConfig` direttamente. */
export interface ResolvedFonts {
    /** Stack CSS per il browser (`--fontFamily`). */
    webStack: string;
    /** Stack CSS per le immagini OG (`PreviewBuilder`). */
    serverStack: string;
    /** Chiave per le metriche server: `custom.family` se presente, altrimenti `serverDefault`. */
    serverKey: ServerFont | string;
    /** Eco di `AppFontConfig.custom`, per i consumer che devono sapere SE c'è un custom. */
    custom?: CustomFontDef;
}

/** C'è un custom? Sostituisce entrambi i default, in testa allo stack (il fallback di sistema
 *  resta comunque presente per emoji/generic-family). Pura: nessun accesso al filesystem — che il
 *  file dichiarato esista davvero è compito del layer server (`custom-font-detect.ts`). */
export function resolveFonts(config: AppFontConfig): ResolvedFonts {
    const { custom } = config;
    return {
        webStack: custom ? `"${custom.family}", ${WEB_FONTS[config.webDefault]}` : WEB_FONTS[config.webDefault],
        serverStack: custom ? `"${custom.family}", ${SERVER_FONTS[config.serverDefault]}` : SERVER_FONTS[config.serverDefault],
        serverKey: custom?.family ?? config.serverDefault,
        custom,
    };
}
