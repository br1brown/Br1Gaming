import type { Request, Response } from 'express';
import { join } from 'node:path';
import sharp from 'sharp';
import { ContestoSito } from '../../../../site';
import { ALLOWED_WIDTHS } from '../../asset-config';
import { cacheDir } from '../server-paths';
import { resolveAssetPath } from '../asset-mapping';
import { AssetHandler } from '../asset-handler';
import { defaultBlobUrl, defaultBlobUrlRaw, fetchBackendImage } from '../backend-blob';
import { inProgress, runImageJob } from '../image-cache';
import { recordCacheHit, recordCacheMiss } from '../image-cache-metrics';
import { fileExists } from '../fs-utils';

/** Tetto al tempo di decode/resize per singola richiesta: blinda contro file patologici/decode lenti
 *  (il cap sui pixel d'ingresso lo dà già `limitInputPixels` di default di Sharp, ~268MP). */
const SHARP_TIMEOUT = { seconds: 15 };

/** Endpoint CDN Asset: risolve l'ID nel file sorgente, valida la larghezza contro la whitelist,
 *  serve (o genera al volo) una miniatura in cache — richieste concorrenti per la stessa chiave
 *  riusano lo stesso job sharp (mappa `inProgress`). Formato AVIF se il browser lo dichiara in
 *  `Accept`, altrimenti WebP; il formato entra nella cache key e la risposta porta `Vary: Accept`
 *  perché cache/CDN intermedie non servano la variante sbagliata a un client diverso. */
export async function cdnAssetHandler(req: Request, res: Response): Promise<void> {
    try {
        const id = req.query['id'] as string;
        if (!id) { res.status(400).send('Missing id'); return; }

        const absolutePath = await resolveAssetPath(id);
        let sharpSource: string | Buffer | null = absolutePath;

        if (!sharpSource) {
            // Non è una chiave di mapping.json: prova come GUID di un blob del backend (es. icona
            // di brand dinamica). Mapping prima (fonte reale), blob come fallback.
            const override = ContestoSito.config.resolveBlobImageUrl;
            const path = override?.(id) ?? defaultBlobUrl(id);
            sharpSource = await fetchBackendImage(path);
            if (!sharpSource && !override) sharpSource = await fetchBackendImage(defaultBlobUrlRaw(id));
        }
        if (!sharpSource) { res.status(404).send('Asset not found'); return; }
        const source: string | Buffer = sharpSource; // stabile da qui in poi, evita di ri-allargare a `| null` sotto

        // File locale non-immagine: serve diretto senza elaborazione. Un blob del backend non ha
        // un path fisico da servire tal quale — si tenta sempre la rasterizzazione sharp.
        if (typeof source === 'string') {
            const filename = source.split(/[\\/]/).pop()!;
            if (!AssetHandler.isSharpCompatible(filename)) { AssetHandler.serveFile(res, source); return; }
        }

        // Formato: AVIF se il browser lo supporta (Accept), altrimenti WebP. La risposta
        // varia in base ad Accept, quindi le cache intermedie devono distinguerla.
        const format = (req.headers['accept'] ?? '').includes('image/avif') ? 'avif' : 'webp';
        res.setHeader('Vary', 'Accept');

        // Larghezza: usa il massimo consentito se non specificata; rifiuta valori fuori whitelist
        let requestedWidth = parseInt(req.query['w'] as string);

        /** Gestione larghezza: usa il massimo consentito se omessa, valida contro la whitelist */
        if (isNaN(requestedWidth)) {
            requestedWidth = Math.max(...ALLOWED_WIDTHS);
        } else if (!(ALLOWED_WIDTHS as readonly number[]).includes(requestedWidth)) {
            res.status(400).send(`Invalid width. Allowed: ${ALLOWED_WIDTHS.join(', ')}`);
            return;
        }

        /** Analizza i metadati dell'originale per evitare di ingrandire immagini piccole (pixel sgranati) */
        const metadata = await sharp(source).timeout(SHARP_TIMEOUT).metadata();
        const originalWidth = metadata.width || 0;
        const finalWidth = originalWidth < requestedWidth ? originalWidth : requestedWidth;

        /** Chiave cache basata su ID e dimensione: identifica univocamente la miniatura generata */
        const cacheKey = `${id}_w${finalWidth}.${format}`;
        const cacheFile = join(cacheDir, cacheKey);

        /** Se la miniatura esiste già in cache, la serve istantaneamente */
        if (await fileExists(cacheFile)) { recordCacheHit(); AssetHandler.serveImage(res, cacheFile); return; }
        recordCacheMiss();

        /** Se la generazione è già in corso riusa la stessa Promise, altrimenti ne avvia una
         *  nuova; il `.finally()` rimuove l'entry a fine job (successo o errore). */
        let job = inProgress.get(cacheKey);
        if (!job) {
            // AVIF rende qualità equivalente a WebP con quality più bassa (file più piccoli).
            // runImageJob limita la concorrenza globale dei job sharp (CPU/RAM).
            job = runImageJob(() => sharp(source)
                .timeout(SHARP_TIMEOUT)
                .resize(finalWidth, null, { withoutEnlargement: true, fastShrinkOnLoad: true })
                .toFormat(format, { quality: format === 'avif' ? 55 : 80 })
                .toFile(cacheFile)
            ).finally(() => inProgress.delete(cacheKey));
            inProgress.set(cacheKey, job);
        }
        await job;

        AssetHandler.serveImage(res, cacheFile);
    } catch (err) {
        console.error('[Asset Error]:', err);
        res.status(500).send('Error processing asset');
    }
}
