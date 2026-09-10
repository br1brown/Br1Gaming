/**
 * Genera le icone PWA (192x192 e 512x512) a partire dal favicon definito in mapping.json.
 * Output: public/icons/ (file generati, non tracciati da git)
 *
 * Eseguire con:  npm run generate:icons
 * (gira già in automatico nei passi prestart/predev/prebuild, insieme a generate:statics)
 *
 * La 512 (unica dichiarata `maskable` in manifest.webmanifest) va composta su uno sfondo
 * pieno col colore brand, artwork ridotta all'80% del canvas: senza questa safe-zone il
 * masking del sistema (cerchio, squircle...) taglia contenuto a ridosso del bordo. La 192
 * (`any`, mai mascherata) resta un resize semplice.
 */

import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../../../../../');
const ASSETS_DIR = join(ROOT, 'src', 'assets', 'files');
const ICONS_DIR = join(ROOT, 'public', 'icons');
const SIZES = [192, 512];
// Deve restare in sync con le taglie `purpose: "any maskable"` di generate-statics.ts (oggi solo 512).
const MASKABLE_SIZES = new Set([512]);
const MASKABLE_SAFE_ZONE = 0.8;

type RawMappingEntry = string | { file: string;[key: string]: unknown };

function resolveFaviconPath(): string {
    const mappingPath = join(ROOT, 'src', 'assets', 'mapping.json');
    const raw = JSON.parse(readFileSync(mappingPath, 'utf-8')) as Record<string, RawMappingEntry>;
    const entry = raw['favIcon'];
    if (!entry) throw new Error('[icons] Chiave "favIcon" non trovata in mapping.json');
    const filename = typeof entry === 'string' ? entry : entry.file;
    return join(ASSETS_DIR, filename);
}

/** '#rgb' o '#rrggbb' → {r,g,b}, pad con '0' se corta/malformata invece di NaN (stesso
 *  pattern di SmokeEffectComponent.parseHexColor, duplicato qui: script Node standalone). */
function parseHexColor(input: string | undefined): { r: number; g: number; b: number } {
    const hex = (input ?? 'ffffff').replace('#', '').trim();
    const expanded = hex.length === 3
        ? hex.split('').map(c => c + c).join('')
        : hex.padEnd(6, 'f').slice(0, 6);
    const r = parseInt(expanded.substring(0, 2), 16);
    const g = parseInt(expanded.substring(2, 4), 16);
    const b = parseInt(expanded.substring(4, 6), 16);
    return { r: Number.isNaN(r) ? 255 : r, g: Number.isNaN(g) ? 255 : g, b: Number.isNaN(b) ? 255 : b };
}

/** Colore brand per lo sfondo delle icone maskable — lettura diretta di global-settings.json,
 *  stesso pattern di generate-statics.ts: niente import di site.ts solo per un colore. */
function resolveBrandColor(): { r: number; g: number; b: number } {
    const candidates = [
        process.env['GLOBAL_SETTINGS_PATH'],
        join(ROOT, '../global-settings.json'),
        join(ROOT, 'global-settings.json'),
    ].filter((p): p is string => Boolean(p));
    for (const p of candidates) {
        try {
            if (existsSync(p)) {
                const parsed = JSON.parse(readFileSync(p, 'utf-8')) as { site?: { colorTema?: string } };
                return parseHexColor(parsed.site?.colorTema);
            }
        } catch { /* file illeggibile o JSON invalido: prova il prossimo candidato */ }
    }
    return parseHexColor(undefined);
}

async function main(): Promise<void> {
    const faviconPath = resolveFaviconPath();

    if (!existsSync(faviconPath)) {
        console.warn('[icons] favicon non trovata in', faviconPath);
        return;
    }

    mkdirSync(ICONS_DIR, { recursive: true });

    try {
        const sharp = (await import('sharp')).default;
        const brand = resolveBrandColor();
        for (const size of SIZES) {
            const dest = join(ICONS_DIR, `icon-${size}x${size}.png`);
            if (MASKABLE_SIZES.has(size)) {
                const inner = Math.round(size * MASKABLE_SAFE_ZONE);
                const foreground = await sharp(faviconPath)
                    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .toBuffer();
                await sharp({
                    create: { width: size, height: size, channels: 4, background: { ...brand, alpha: 1 } },
                })
                    .composite([{ input: foreground, gravity: 'center' }])
                    .png()
                    .toFile(dest);
                console.log(`[icons] Generata ${size}x${size} (maskable, safe-zone ${Math.round(MASKABLE_SAFE_ZONE * 100)}%): ${dest}`);
            } else {
                await sharp(faviconPath).resize(size, size).toFile(dest);
                console.log(`[icons] Generata ${size}x${size}: ${dest}`);
            }
        }
    } catch {
        for (const size of SIZES) {
            const dest = join(ICONS_DIR, `icon-${size}x${size}.png`);
            if (!existsSync(dest)) {
                copyFileSync(faviconPath, dest);
                console.log(`[icons] Copiata favicon come ${size}x${size} (installa sharp per resize${MASKABLE_SIZES.has(size) ? ' e safe-zone maskable' : ''}): ${dest}`);
            } else {
                console.log(`[icons] ${size}x${size} gia' presente: ${dest}`);
            }
        }
    }
}

main().catch(err => {
    console.error('[icons] ERRORE:', err);
    process.exit(1);
});
