/** Genera le icone del sito dal favicon dichiarato in mapping.json, in public/icons/ (non
 *  tracciati da git). Gira in automatico nei pre-hook (prestart/predev/prebuild): favicon/
 *  Apple Touch Icon sempre, icona maskable solo se `isWebApp:true`. */

import '@angular/compiler'; // richiesto per importare site.ts (ContestoSito) fuori da un bootstrap Angular — stesso pattern di generate-statics.ts
import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ContestoSito } from '../../../../site';

const ROOT = join(__dirname, '../../../../../../');
const ASSETS_DIR = join(ROOT, 'src', 'assets', 'files');
const ICONS_DIR = join(ROOT, 'public', 'icons');
const MASKABLE_SAFE_ZONE = 0.8;

type RawMappingEntry = string | { file: string;[key: string]: unknown };

type Treatment =
    /** Resize semplice, trasparenza dell'originale preservata (favicon del tab). */
    | 'transparent'
    /** Sfondo brand pieno, artwork a bordo pieno — niente trasparenza, niente riduzione. */
    | 'opaque-full-bleed'
    /** Sfondo brand pieno + artwork ridotta al safe-zone (maskable/Apple Touch: niente
     *  trasparenza E niente contenuto a ridosso del bordo, che un masking adattivo taglierebbe). */
    | 'opaque-safe-zone';

type IconSpec = { file: string; size: number; treatment: Treatment };

// Deve restare in sync con l'array `icons` di generate-statics.ts (manifest.webmanifest) e con
// il `<link rel="apple-touch-icon">` di index.html.
const ICONS: IconSpec[] = [
    { file: 'icon-192x192.png', size: 192, treatment: 'transparent' },
    { file: 'icon-512x512.png', size: 512, treatment: 'opaque-full-bleed' },
    { file: 'icon-512x512-maskable.png', size: 512, treatment: 'opaque-safe-zone' },
    { file: 'apple-touch-icon-180x180.png', size: 180, treatment: 'opaque-safe-zone' },
];

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

/** Colore brand per lo sfondo delle icone a safe-zone — da `ContestoSito.config.colorTema`, stessa
 *  fonte usata da `generate-statics.ts`/`og-preview.ts` per ogni altro colore derivato (mai una
 *  seconda lettura indipendente di global-settings.json, che potrebbe divergere). */
function resolveBrandColor(): { r: number; g: number; b: number } {
    return parseHexColor(ContestoSito.config.colorTema);
}

async function main(): Promise<void> {
    const faviconPath = resolveFaviconPath();

    if (!existsSync(faviconPath)) {
        // Errore duro (non un warning silenzioso): la chiave "favIcon" è dichiarata in
        // mapping.json ma il file non esiste sul disco. Proseguire lascerebbe il sito senza
        // favicon/icone (404 su index.html, manifest e anteprime social) senza che il build
        // se ne accorga.
        throw new Error(`[icons] File favicon non trovato: ${faviconPath} (dichiarato come "favIcon" in mapping.json)`);
    }

    mkdirSync(ICONS_DIR, { recursive: true });

    try {
        const sharp = (await import('sharp')).default;
        const brand = resolveBrandColor();
        for (const { file, size, treatment } of ICONS) {
            const dest = join(ICONS_DIR, file);
            if (treatment === 'transparent') {
                await sharp(faviconPath).resize(size, size).toFile(dest);
                console.log(`[icons] Generata ${file} (${size}x${size}): ${dest}`);
                continue;
            }

            // 'opaque-full-bleed' riempie l'intero canvas (nessuna safe-zone), 'opaque-safe-zone'
            // riduce l'artwork all'80% prima di comporla — in entrambi i casi su sfondo brand pieno.
            const inner = treatment === 'opaque-safe-zone' ? Math.round(size * MASKABLE_SAFE_ZONE) : size;
            const foreground = await sharp(faviconPath)
                .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();
            await sharp({
                create: { width: size, height: size, channels: 4, background: { ...brand, alpha: 1 } },
            })
                .composite([{ input: foreground, gravity: 'center' }])
                .png()
                .toFile(dest);
            const label = treatment === 'opaque-safe-zone' ? `safe-zone ${Math.round(MASKABLE_SAFE_ZONE * 100)}% su sfondo brand` : 'sfondo brand, bordo pieno';
            console.log(`[icons] Generata ${file} (${size}x${size}, ${label}): ${dest}`);
        }
    } catch {
        for (const { file } of ICONS) {
            const dest = join(ICONS_DIR, file);
            if (!existsSync(dest)) {
                copyFileSync(faviconPath, dest);
                console.log(`[icons] Copiata favicon come ${file} (installa sharp per resize/safe-zone/sfondo brand): ${dest}`);
            } else {
                console.log(`[icons] ${file} gia' presente: ${dest}`);
            }
        }
    }
}

main().catch(err => {
    console.error('[icons] ERRORE:', err);
    process.exit(1);
});
