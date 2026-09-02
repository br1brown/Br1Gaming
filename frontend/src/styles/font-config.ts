/**
 * Scelta font del progetto — l'unico file da toccare per cambiare font. Catalogo e logica sono
 * nell'Engine (`core/engine/font-system.ts`, INTOCCABILE); qui c'è solo il dato.
 */
import { resolveFonts, ServerFont, type AppFontConfig } from '../app/core/engine/font-system';

export const siteFonts: AppFontConfig = {
    webDefault: 'System',
    serverDefault: ServerFont.Liberation,
    // Font caricato dal cliente: metti il file nella cartella `fonts/` accanto a
    // global-settings.json, poi scommenta con lo stesso nome file.
    // custom: { family: 'Marlboro', file: 'Marlboro.woff2' },
};

/** Valori finali (stack CSS, chiave metriche) letti da ThemeService/server.ts/PreviewBuilder. */
export const resolvedFonts = resolveFonts(siteFonts);
