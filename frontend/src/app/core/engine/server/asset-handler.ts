import type { Response } from 'express';
import { utimes } from 'node:fs';
import { lookup as mimeLookup } from 'mime-types';

/**
 * Pattern per identificare asset con hash nel nome (gestiti da Angular, `outputHashing: "all"`
 * in angular.json) per abilitare la cache immutabile. Il builder Angular/esbuild non produce
 * `nome.HASH.ext` (notazione webpack) ma `nome-HASH.ext`, con un hash di 8 caratteri
 * nell'alfabeto [0-9A-Z] (es. `chunk-3FVXKXES.js`, `main-K5W646K5.js`, `styles-4B7UGN6G.css`,
 * `fa-solid-900-5ZUYHGA7.woff2`) — MAI lowercase e MAI la notazione a punto assunta prima, che
 * non ha mai combaciato con l'output reale (bug: ogni asset con hash finiva servito `no-cache`
 * invece che con cache eterna). L'hash SOLO maiuscolo è anche ciò che esclude gli asset statici
 * non hashati con nomi trattino-separati (es. `ngsw-worker.js`, `theme-init.js`): sono minuscoli,
 * un case-sensitive match su [0-9A-Z] non li tocca.
 */
export const immutableAssetPattern = /-[0-9A-Z]{6,10}\.(?:js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|avif|ico)$/;

/** Raggruppa le utility per gestire l'invio dei file e il controllo dei formati. */
export class AssetHandler {
    /** Verifica se il file è un'immagine raster (no SVG) supportata per il resize. */
    static isSharpCompatible(filename: string): boolean {
        const mime = mimeLookup(filename);
        if (mime) return mime.startsWith('image/') && mime !== 'image/svg+xml';
        return false;
    }

    /** Spedisce l'immagine al browser deducendo il Content-Type dall'estensione
     *  (WebP, AVIF, PNG, JPEG, ...) e impostando cache eterna (1 anno). */
    static serveImage(res: Response, path: string): void {
        // Rinfresca mtime (fire-and-forget) per la politica LRU dello sweep: un hit
        // marca il file come "caldo" e lo protegge dall'eviction. L'errore è ininfluente.
        const now = new Date();
        utimes(path, now, now, () => { /* best-effort */ });
        res.setHeader('Content-Type', mimeLookup(path) || 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.sendFile(path);
    }

    /** Spedisce un file non-immagine (PDF, ecc) mantenendo il formato originale e cache eterna. */
    static serveFile(res: Response, path: string): void {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.sendFile(path);
    }
}
