import type { Request, Response } from 'express';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ContestoSito } from '../../../../site';
import { ThemeService } from '../../services/theme.service';
import { ImgBuilderService } from '../../services/img-builder.service';
import { PreviewCrypto } from '../preview-crypto.server';
import { PreviewBuilder } from '../preview-builder';
import { cacheDir } from '../server-paths';
import { resolveAssetPath } from '../asset-mapping';
import { AssetHandler } from '../asset-handler';
import { inProgress, runImageJob } from '../image-cache';
import { fileExists } from '../fs-utils';

/** Normalizza gli spazi del testo e lo tronca entro `max` caratteri, aggiungendo `…` come
 *  carattere finale se eccede, così si capisce che il contenuto continua oltre il limite.
 *  Il `…` occupa un carattere, quindi si tronca a `max - 1` per restare entro il limite totale.
 *  Se `max <= 1` non c'è spazio per testo + puntini (sostituirebbero tutto): si tronca e basta. */
function normalizeAndTruncate(text: string, max: number): string {
    const normalized = ImgBuilderService.normalizeWhitespace(text).trim();
    if (normalized.length <= max) return normalized;
    if (max <= 1) return normalized.slice(0, max);
    return normalized.slice(0, max - 1).trim() + '…';
}

/**
 * Endpoint Social Preview unico: genera al volo l'immagine Open Graph / Twitter Card.
 *
 * Parametri:
 *   - p: blob AES-GCM (base64url) prodotto da `PreviewCrypto.encrypt()` in
 *        preview-crypto.server.ts. Decifra a `{ title, subtitle?, id? }`.
 *        Manomissione → decifrazione fallisce → 403.
 *
 * Dispatch variante: `id` presente nel payload → sovrapposizione asset; assente → SVG testo.
 */
export async function ogPreviewHandler(req: Request, res: Response): Promise<void> {
    try {
        const blob = String(req.query['p'] ?? '').trim();
        if (!blob) { res.status(400).send('Missing p'); return; }

        let payload: Record<string, string>;
        try {
            payload = PreviewCrypto.decrypt(blob);
        } catch {
            res.status(403).send('Invalid payload');
            return;
        }

        const title = normalizeAndTruncate(String(payload['title'] ?? ''), 200);
        const subtitle = normalizeAndTruncate(String(payload['subtitle'] ?? ''), 300);
        const id = String(payload['id'] ?? '').trim();
        const onlyImage = payload['onlyImage'] === 'true';

        // Titolo assente NON è un errore: la home lascia il <title> = solo AppName, quindi cifra un
        // payload col titolo vuoto. In quel caso il nome app fa da titolo grande; nella variante
        // testuale l'etichetta in alto (anch'essa il nome app) si svuota per non ripeterlo.
        const { appName } = ContestoSito.config;
        const effectiveTitle = title || appName;

        if (id) { await renderPreviewWithImage(res, id, effectiveTitle, onlyImage); return; }
        await renderPreviewText(res, effectiveTitle, subtitle, title ? appName : '');
    } catch (err) {
        console.error('[Preview Error]:', err);
        // Ultima risorsa: invece di un 500 (che lascerebbe l'anteprima social rotta) si serve la
        // favicon statica. L'URL og:image punta sempre qui, quindi un'immagine valida è meglio di
        // un errore. Se manca pure la favicon, allora 500.
        if (!res.headersSent) {
            try {
                const faviconPath = await resolveAssetPath('favIcon');
                if (faviconPath) { AssetHandler.serveImage(res, faviconPath); return; }
            } catch { /* best-effort: si cade sul 500 */ }
            res.status(500).send('Error generating preview');
        }
    }
}

/** Variante testuale: SVG con app name + favicon + titolo + sottotitolo. `appNameLabel` può essere
 *  vuoto (es. home, dove il nome app fa già da titolo): in tal caso l'etichetta in alto è omessa. */
async function renderPreviewText(res: Response, title: string, subtitle: string, appNameLabel: string): Promise<void> {
    const { colorTema, version } = ContestoSito.config;
    const r = PreviewBuilder.resolvePreviewBuilder({ appName: appNameLabel, title, subtitle, bgColor: colorTema });

    const keyData = JSON.stringify({ version, ...r });
    const hash = createHash('sha1').update(keyData).digest('hex').slice(0, 16);
    // PNG (non WebP): testo su sfondo pieno → bordi netti senza artefatti di compressione,
    // e formato universalmente supportato dai crawler social (a differenza di WebP).
    const cacheKey = `preview_${hash}.png`;
    const cacheFile = join(cacheDir, cacheKey);

    if (await fileExists(cacheFile)) { AssetHandler.serveImage(res, cacheFile); return; }

    let job = inProgress.get(cacheKey);
    if (!job) {
        job = runImageJob(async () => {
            let faviconDataUrl = '';
            const faviconPath = await resolveAssetPath('favIcon');
            if (faviconPath) {
                faviconDataUrl = `data:image/png;base64,${(await readFile(faviconPath)).toString('base64')}`;
            }
            const { svg } = PreviewBuilder.buildPreview({ ...r, faviconDataUrl });
            await sharp(Buffer.from(svg, 'utf-8')).png({ compressionLevel: 9 }).toFile(cacheFile);
        }).finally(() => inProgress.delete(cacheKey));
        inProgress.set(cacheKey, job);
    }
    await job;
    AssetHandler.serveImage(res, cacheFile);
}

/** Variante con immagine: sfondo + immagine + favicon + badge titolo. */
async function renderPreviewWithImage(res: Response, ogImageId: string, title: string, onlyImage?: boolean): Promise<void> {
    const absolutePath = await resolveAssetPath(ogImageId);
    if (!absolutePath) { res.status(404).send('Asset not found'); return; }

    // SVG incluso: sharp lo rasterizza, così entra nella pipeline 1200x630 come gli altri
    // asset (e i meta og:image:width/height/type restano coerenti). Solo gli asset non-immagine
    // vengono serviti tal quali (ripiego).
    const filename = absolutePath.split(/[\\/]/).pop()!;
    const isSvg = /\.svg$/i.test(filename);
    if (!isSvg && !AssetHandler.isSharpCompatible(filename)) { AssetHandler.serveFile(res, absolutePath); return; }

    const normalizedTitle = normalizeAndTruncate(title, 100);
    const { version } = ContestoSito.config;
    const hash = createHash('sha1').update(JSON.stringify({ version, id: ogImageId, title: normalizedTitle, onlyImage: !!onlyImage })).digest('hex').slice(0, 16);
    // JPEG (non WebP): formato universale per le anteprime social. WebP non è renderizzato
    // in modo affidabile da Slack/Signal e da vari client WhatsApp/LinkedIn. La foto + blur
    // comprime ottimamente in JPEG, restando ben sotto il peso consigliato.
    const cacheKey = `preview_img_${hash}.jpg`;
    const cacheFile = join(cacheDir, cacheKey);

    if (await fileExists(cacheFile)) { AssetHandler.serveImage(res, cacheFile); return; }

    let job = inProgress.get(cacheKey);
    if (!job) {
        job = runImageJob(async () => {
            const OG_W = 1200, OG_H = 630;
            // SVG: densità alta in input così la rasterizzazione resta nitida a 1200x630.
            const inputOpts = isSvg ? { density: 384 } : undefined;

            const bgBuffer = await sharp(absolutePath, inputOpts)
                .resize(OG_W, OG_H, { fit: 'cover' })
                .blur(28)
                .webp({ quality: 50 })
                .toBuffer();

            const fgBuffer = await sharp(absolutePath, inputOpts)
                .resize(OG_W, OG_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png()
                .toBuffer();

            const composites: sharp.OverlayOptions[] = [{ input: fgBuffer, left: 0, top: 0 }];

            if (!onlyImage) {
                const iconSize = Math.round(OG_H * 0.26);
                const padding = Math.round(iconSize * 0.30);
                const iconLeft = padding;
                const iconTop = OG_H - iconSize - padding;
                const faviconPath = await resolveAssetPath('favIcon');
                if (faviconPath) {
                    // Chip bianco arrotondato dietro la favicon: su foto chiare/caotiche garantisce
                    // sempre leggibilità e dà l'aspetto "app icon" (le favicon sono pensate per il bianco).
                    const chipPad = Math.round(iconSize * 0.12);
                    const chipSize = iconSize + chipPad * 2;
                    const chipRadius = Math.round(chipSize * 0.18);
                    const chipSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${chipSize}" height="${chipSize}"><rect width="${chipSize}" height="${chipSize}" rx="${chipRadius}" ry="${chipRadius}" fill="#ffffff" fill-opacity="0.95"/></svg>`;
                    composites.push({ input: Buffer.from(chipSvg, 'utf-8'), left: iconLeft - chipPad, top: iconTop - chipPad });

                    const iconBuffer = await sharp(faviconPath)
                        .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                        .png()
                        .toBuffer();
                    composites.push({ input: iconBuffer, left: iconLeft, top: iconTop });
                }
                if (normalizedTitle) {
                    const badgeSvg = PreviewBuilder.buildTitleBadge({
                        canvasW: OG_W,
                        canvasH: OG_H,
                        anchorLeft: iconLeft + iconSize + Math.round(iconSize * 0.20),
                        anchorCenterY: iconTop + iconSize / 2,
                        maxRight: OG_W - padding,
                        title: normalizedTitle,
                        bgColor: ThemeService.computePalette(ContestoSito.config.colorTema).colorPrimary,
                        fontSize: 40,
                    });
                    composites.push({ input: Buffer.from(badgeSvg, 'utf-8'), left: 0, top: 0 });
                }
            }

            await sharp(bgBuffer)
                .composite(composites)
                .jpeg({ quality: 85, mozjpeg: true })
                .toFile(cacheFile);
        }).finally(() => inProgress.delete(cacheKey));
        inProgress.set(cacheKey, job);
    }
    try {
        await job;
    } catch (err) {
        // Se la rasterizzazione dell'SVG non è supportata da sharp, ripiega servendo
        // il file originale invece di propagare un errore (opzione A).
        if (isSvg) { console.warn('[Preview] SVG non rasterizzabile, servo l\'originale:', err); AssetHandler.serveFile(res, absolutePath); return; }
        throw err;
    }
    AssetHandler.serveImage(res, cacheFile);
}
