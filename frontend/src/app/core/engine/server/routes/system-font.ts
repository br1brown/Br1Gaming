import type { Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { isSystemFont, SYSTEM_FONTS } from '../../font-system';
import { ContestoSito } from '../../../../site';
import { customFontFacePath } from '../custom-font-detect';

/** MIME per le estensioni font di progetto ammesse (gli 11 di `SYSTEM_FONTS` sono sempre `.ttf`,
 *  noto a priori — questa mappa serve solo ai font custom (`font.principale` o `font.aggiuntivi`), che un
 *  progetto può caricare in qualunque di questi formati). */
const FONT_CONTENT_TYPE: Record<string, string> = {
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
};

/** Endpoint `/cdn-cgi/font/:key/:index` — serve i file reali di un font, di sistema (`SYSTEM_FONTS`)
 *  o custom di progetto (`customFontsCatalog`, incluse le voci "secondarie" di `font.aggiuntivi`), per
 *  il `@font-face` self-hosted. `:key` prova prima `SystemFont`, poi il catalogo custom; qualunque
 *  altra stringa è 404. `:index` è la posizione nell'array `faces` risolto, mai un nome file
 *  dall'esterno: nessun path traversal per costruzione. Un font di sistema assente è un'immagine
 *  Docker mal costruita (`apk add` a build-time); un font custom assente è normale (volume di
 *  progetto) — in entrambi i casi 404 esplicito invece di un crash. */
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
