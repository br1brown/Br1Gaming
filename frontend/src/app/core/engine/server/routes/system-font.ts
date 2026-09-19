import type { Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { isSystemFont, SYSTEM_FONTS } from '../../font-system';
import { ContestoSito } from '../../../../site';
import { customFontFacePath } from '../custom-font-detect';

/** MIME per le estensioni font di progetto ammesse (gli 11 di `SYSTEM_FONTS` sono sempre `.ttf`,
 *  noto a priori — questa mappa serve solo ai font custom (`defaultFont` o `addonFonts`), che un
 *  progetto può caricare in qualunque di questi formati). */
const FONT_CONTENT_TYPE: Record<string, string> = {
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
};

/**
 * Endpoint `/cdn-cgi/font/:key/:index` — serve i file reali di un font, di sistema
 * (`SYSTEM_FONTS`, font-system.ts) o di progetto (`DesignSystemPreset.defaultFont`/`addonFonts`,
 * quando custom), al browser per il `@font-face` self-hosted (`AppearanceService`). Stesso
 * endpoint per entrambi: `:key` è prima provato contro `SystemFont` (whitelist chiusa), poi contro
 * `ContestoSito.config.customFontsCatalog` (OGNI `CustomFontDef` di questo sito — quello di
 * `defaultFont` se custom, più quelli di `addonFonts`, scelti o no come font attivo: le voci
 * "secondarie" restano comunque servibili) — qualunque altra stringa è 404. `:index` è la
 * posizione nell'array `faces` della voce risolta — mai un nome di file dall'esterno, quindi
 * nessun path traversal possibile per costruzione, non solo per validazione.
 *
 * `fileExists` a ogni richiesta. Per `SYSTEM_FONTS` i file arrivano da `apk add` a build-time
 * dell'immagine Docker (mai un volume montato) — "assente" qui è un'immagine mal costruita. Per
 * un font custom sono invece un volume di progetto: "assente" è uno scenario normale (il progetto
 * non ha ancora caricato il file, o l'ha rinominato) — in entrambi i casi un 404 esplicito (font
 * di fallback del browser) batte un crash del processo.
 */
export function systemFontHandler(req: Request, res: Response): void {
    const rawKey = req.params['key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    const rawIndex = req.params['index'];
    // `Number('')` vale `0`, non `NaN` — un :index vuoto risolverebbe silenziosamente alla faccia 0
    // invece di 404 se si saltasse questo controllo esplicito (Number.isInteger da solo non basta).
    const index = rawIndex ? Number(rawIndex) : NaN;
    if (!key || !Number.isInteger(index) || index < 0) {
        res.status(404).end();
        return;
    }

    if (isSystemFont(key)) {
        const faces = SYSTEM_FONTS[key].faces;
        if (index >= faces.length || !existsSync(faces[index].file)) {
            res.status(404).end();
            return;
        }
        res.setHeader('Content-Type', 'font/ttf');
        // Eterna: stesso file per tutta la vita dell'immagine Docker (mai un aggiornamento a runtime).
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.sendFile(faces[index].file);
        return;
    }

    const custom = ContestoSito.config.customFontsCatalog.find(c => c.key === key);
    const face = custom?.faces[index];
    if (!face) {
        res.status(404).end();
        return;
    }
    const path = customFontFacePath(face.file);
    if (!existsSync(path)) {
        res.status(404).end();
        return;
    }
    res.setHeader('Content-Type', FONT_CONTENT_TYPE[extname(path).toLowerCase()] ?? 'application/octet-stream');
    // Non immutabile: un font custom è un volume di progetto, può essere sostituito senza
    // rinominare il file (a differenza degli 11 di sistema, fissi per l'intera vita dell'immagine).
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path);
}
