import type { Response } from 'express';
import { utimes } from 'node:fs';
import { lookup as mimeLookup } from 'mime-types';

/** Pattern per identificare asset con hash nel nome (`outputHashing: "all"` in angular.json) e
 *  abilitarne la cache immutabile. Il builder Angular/esbuild produce `nome-HASH.ext` (trattino,
 *  MAI la notazione a punto di webpack), hash di 8 caratteri SOLO MAIUSCOLO [0-9A-Z] — es.
 *  `chunk-3FVXKXES.js`. Il case-sensitive su maiuscolo è anche ciò che esclude gli statici non
 *  hashati (`ngsw-worker.js`, `theme-init.js`): sono minuscoli, non combaciano. */
export const immutableAssetPattern = /-[0-9A-Z]{6,10}\.(?:js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|avif|ico)$/;

/** Raggruppa le utility per gestire l'invio dei file e il controllo dei formati. */
export class AssetHandler {
    /** Verifica se il file è un'immagine raster (no SVG) supportata per il resize. */
    static isSharpCompatible(filename: string): boolean {
        const mime = mimeLookup(filename);
        if (mime) return mime.startsWith('image/') && mime !== 'image/svg+xml';
        return false;
    }

    /** Intestazioni di cache comuni a immagini e file: cache di un anno (`immutable`) solo quando
     *  l'URL identifica quel contenuto (slug di un blob, che non cambia contenuto); altrimenti
     *  `no-cache`, il browser rivalida e riceve 304 finché l'ETag resta. */
    private static setCacheHeaders(res: Response, etag: string, immutable: boolean): void {
        res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
        res.setHeader('ETag', `"${etag}"`);
    }

    /** Spedisce l'immagine al browser deducendo il Content-Type dall'estensione (WebP, AVIF, PNG,
     *  JPEG, ...). `etag` è il nome della copia in cache, che porta già l'impronta del sorgente. */
    static serveImage(res: Response, path: string, etag: string, immutable: boolean): void {
        // Rinfresca mtime (fire-and-forget) per la politica LRU dello sweep: un hit
        // marca il file come "caldo" e lo protegge dall'eviction. L'errore è ininfluente.
        const now = new Date();
        utimes(path, now, now, () => { /* best-effort */ });
        res.setHeader('Content-Type', mimeLookup(path) || 'image/webp');
        AssetHandler.setCacheHeaders(res, etag, immutable);
        // Niente Last-Modified: l'mtime della copia cambia a ogni hit (LRU sopra) e farebbe
        // sembrare nuova la risposta a ogni rivalidazione. Decide l'ETag.
        res.sendFile(path, { lastModified: false });
    }

    /** Spedisce un file non-immagine (PDF, ecc) mantenendo il formato originale. */
    static serveFile(res: Response, path: string, etag: string, immutable: boolean): void {
        AssetHandler.setCacheHeaders(res, etag, immutable);
        res.sendFile(path);
    }
}
