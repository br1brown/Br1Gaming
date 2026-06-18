/**
 * Genera gli sprite isometrici del gioco "Burocrazia" come file SVG statici.
 *
 * Perché un generatore e non disegno a runtime: gli sprite sono FISSI (auto, palazzi,
 * alberi, casa). Disegnarli una volta come asset e poi solo "blittarli" su canvas è più
 * veloce e più curato che ridisegnarli a poligoni ad ogni frame. La proiezione qui DEVE
 * combaciare con quella del motore (ZOOM 0.9, altezze in px-schermo) così gli sprite si
 * appoggiano perfettamente su strade e tessere disegnate ancora in modo procedurale.
 *
 * Output:
 *   • src/assets/files/burocrazia/*.svg        (gli sprite, tracciati da git)
 *   • src/assets/mapping.json                  (fonde le voci "buro.*", preserva il resto)
 *   • src/app/pages/burocrazia/burocrazia.sprites.ts  (manifest: id → dimensioni/anchor/footprint)
 *
 * Eseguire con:  npm run generate:sprites      (NON gira nei pre-hook: gli asset sono committati)
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../../../../');                          // -> frontend/
const ASSETS_DIR = join(ROOT, 'src', 'assets', 'files', 'burocrazia');
const MAPPING_PATH = join(ROOT, 'src', 'assets', 'mapping.json');
const MANIFEST_PATH = join(ROOT, 'src', 'app', 'pages', 'burocrazia', 'burocrazia.sprites.ts');

const Z = 0.9;   // === ZOOM del motore: footprint in px-schermo = (wx-wy)*Z ===

// ── colore: scurisci/schiarisci moltiplicando l'rgb ──────────────────────────
function shade(hex: string, f: number): string {
    const n = parseInt(hex.slice(1), 16);
    const c = (i: number): string => Math.max(0, Math.min(255, Math.round(((n >> i) & 255) * f))).toString(16).padStart(2, '0');
    return '#' + c(16) + c(8) + c(0);
}

// ── tela di uno sprite: accumula poligoni/ellissi e traccia il bounding box ───
// Origine locale (0,0) = centro a terra dello sprite (il punto iso(x,y,0) nel motore).
class Canvas {
    private parts: string[] = [];
    minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;

    private bx(x: number, y: number): void {
        if (x < this.minX) this.minX = x; if (x > this.maxX) this.maxX = x;
        if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y;
    }
    // proiezione locale: wx,wy in world-px ; h in px-schermo (sottratta diretta)
    private sx(wx: number, wy: number): number { return +((wx - wy) * Z).toFixed(2); }
    private sy(wx: number, wy: number, h = 0): number { return +(((wx + wy) * Z * 0.5) - h).toFixed(2); }

    private pt(wx: number, wy: number, h: number): string {
        const x = this.sx(wx, wy), y = this.sy(wx, wy, h); this.bx(x, y); return `${x},${y}`;
    }
    poly(pts: [number, number, number][], fill: string, opacity?: number): void {
        const p = pts.map(a => this.pt(a[0], a[1], a[2])).join(' ');
        this.parts.push(`<polygon points="${p}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`);
    }
    /** Ellisse centrata su un punto-mondo proiettato (ruote, ombre, fari). */
    ellipse(wx: number, wy: number, h: number, rx: number, ry: number, fill: string, opacity?: number): void {
        const x = this.sx(wx, wy), y = this.sy(wx, wy, h);
        this.ellipseXY(x, y, rx, ry, fill, opacity);
    }
    /** Ellisse in coordinate-schermo dirette (chiome alberi). */
    ellipseXY(x: number, y: number, rx: number, ry: number, fill: string, opacity?: number): void {
        this.bx(x - rx, y - ry); this.bx(x + rx, y + ry);
        this.parts.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`);
    }
    /** Box isometrico: footprint ±(sx,sy) world-px, da z0 a z1 px-schermo. */
    box(cx: number, cy: number, sx: number, sy: number, z0: number, z1: number, col: string): void {
        const x0 = cx - sx, x1 = cx + sx, y0 = cy - sy, y1 = cy + sy;
        this.poly([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], shade(col, 0.62)); // +y
        this.poly([[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]], shade(col, 0.80)); // +x
        this.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], col);              // top
    }
    /** Quad verticale su una faccia (finestre/parabrezza/porte). side: +1 faccia +, -1 faccia -. */
    facePane(cx: number, cy: number, sx: number, sy: number, face: 'x' | 'y', side: number, u0: number, u1: number, z0: number, z1: number, fill: string, opacity?: number): void {
        if (face === 'y') {
            const yy = cy + side * sy;
            this.poly([[cx + u0, yy, z1], [cx + u1, yy, z1], [cx + u1, yy, z0], [cx + u0, yy, z0]], fill, opacity);
        } else {
            const xx = cx + side * sx;
            this.poly([[xx, cy + u0, z1], [xx, cy + u1, z1], [xx, cy + u1, z0], [xx, cy + u0, z0]], fill, opacity);
        }
    }
    diamond(cx: number, cy: number, r: number, h: number, fill: string): void {
        this.poly([[cx, cy - r, h], [cx + r, cy, h], [cx, cy + r, h], [cx - r, cy, h]], fill);
    }
    body(): string { return this.parts.join(''); }
}

interface Meta { w: number; h: number; ax: number; ay: number; foot: number; }
interface Built { id: string; file: string; svg: string; meta: Meta; }

function finish(id: string, file: string, c: Canvas, foot: number): Built {
    const pad = 1;
    const minX = Math.floor(c.minX - pad), minY = Math.floor(c.minY - pad);
    const w = Math.ceil(c.maxX + pad) - minX, h = Math.ceil(c.maxY + pad) - minY;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${w} ${h}">${c.body()}</svg>\n`;
    return { id, file, svg, meta: { w, h, ax: -minX, ay: -minY, foot } };
}

// ── finestre su due facce (lit/unlit da seed) ────────────────────────────────
interface WinPal { on: string; off: string; }
function windows(c: Canvas, sx: number, sy: number, z: number, floors: number, seed: number, win: WinPal): void {
    const lit = win.on, off = win.off;
    const fh = (z - 8) / floors;
    for (let f = 0; f < floors; f++) {
        const z0 = 5 + f * fh, z1 = z0 + fh * 0.58;
        for (let col = 0; col < 2; col++) {
            const u0y = -sx + sx * 0.45 + col * sx * 0.9, u0x = -sy + sy * 0.45 + col * sy * 0.9;
            const onY = ((seed >> (f * 4 + col)) & 1) === 1;
            const onX = ((seed >> (f * 4 + col + 2)) & 1) === 1;
            c.facePane(0, 0, sx, sy, 'y', 1, u0y, u0y + sx * 0.5, z0, z1, onY ? lit : off);
            c.facePane(0, 0, sx, sy, 'x', 1, u0x, u0x + sy * 0.5, z0, z1, onX ? lit : off);
        }
    }
}

// ── PALAZZO ──────────────────────────────────────────────────────────────────
function building(id: string, file: string, sx: number, sy: number, z: number, col: string, floors: number, seed: number, win: WinPal): Built {
    const c = new Canvas();
    c.ellipse(0, 0, 0, sx * Z * 1.15, sx * Z * 0.6, 'rgba(0,0,0,0.28)');     // ombra
    c.box(0, 0, sx, sy, 0, z, col);
    windows(c, sx, sy, z, floors, seed, win);
    c.diamond(0, 0, sx, z, shade(col, 0.7));                                  // bordo tetto
    c.diamond(0, 0, sx * 0.8, z + 3, shade(col, 1.12));                       // tetto rialzato
    c.box(sx * 0.34, sy * 0.2, sx * 0.2, sy * 0.2, z + 3, z + 13, shade(col, 0.85)); // volume tecnico
    return finish(id, file, c, sx);
}

// ── AUTO (axis 'x'|'y', front +1/-1 = lato muso) ─────────────────────────────
function car(id: string, file: string, color: string, axis: 'x' | 'y', front: number): Built {
    const c = new Canvas();
    const sx = axis === 'x' ? 23 : 12, sy = axis === 'x' ? 12 : 23;
    c.ellipse(0, 0, 0, sx * Z + 6, sy * Z + 3, 'rgba(0,0,0,0.30)');           // ombra
    // ruote (agli angoli opposti, in coord-schermo)
    c.ellipse(-sx * 0.6, -sy * 0.6, 1, 4, 2.3, '#15181d');
    c.ellipse(sx * 0.6, sy * 0.6, 1, 4, 2.3, '#15181d');
    c.box(0, 0, sx, sy, 3, 12, color);                                        // telaio
    const cbx = axis === 'x' ? -front * 3 : 0, cby = axis === 'y' ? -front * 3 : 0;
    c.box(cbx, cby, sx * 0.62, sy * 0.62, 12, 20, shade(color, 1.0));         // cabina
    // parabrezza sul lato muso
    if (axis === 'x') c.facePane(cbx, cby, sx * 0.62, sy * 0.62, 'x', front, -sy * 0.5, sy * 0.5, 13, 19, '#bfe8f5', 0.85);
    else c.facePane(cbx, cby, sx * 0.62, sy * 0.62, 'y', front, -sx * 0.5, sx * 0.5, 13, 19, '#bfe8f5', 0.85);
    // fari sul muso
    const fx = axis === 'x' ? front * sx : 0, fy = axis === 'y' ? front * sy : 0;
    c.ellipse(fx, fy, 7, 3.2, 1.8, '#fff3c4');
    return finish(id, file, c, sx);
}

// ── ALBERO ───────────────────────────────────────────────────────────────────
function tree(id: string, file: string, scale: number, seed: number): Built {
    const c = new Canvas();
    const r = 16 * scale, th = 16 * scale;
    c.ellipse(0, 0, 0, r * 0.85, r * 0.45, 'rgba(0,0,0,0.28)');               // ombra
    c.box(0, 0, 2.4, 2.4, 0, th, '#5a4030');                                  // tronco
    const topY = -th, dx = ((seed >> 1) & 3) - 1.5;                           // chioma sopra il tronco
    const blobs: [number, number, number, number, string][] = [
        [0, -8 * scale, r, r * 0.86, '#1f5a33'],
        [-6 * scale, -16 * scale, r * 0.66, r * 0.62, '#2c763f'],
        [7 * scale, -13 * scale, r * 0.55, r * 0.52, '#34924c'],
        [-2 * scale, -22 * scale, r * 0.36, r * 0.34, '#46ad5e'],
    ];
    for (const [bx, by, brx, bry, fill] of blobs) c.ellipseXY(bx + dx, topY + by, brx, bry, fill);
    return finish(id, file, c, r * 0.4);
}

// ── CASA ──────────────────────────────────────────────────────────────────────
function home(id: string, file: string): Built {
    const c = new Canvas();
    const s = 20, hh = 22, rh = 16;
    c.ellipse(0, 0, 0, s * Z * 1.2, s * Z * 0.62, 'rgba(0,0,0,0.28)');        // ombra
    c.box(0, 0, s, s, 0, hh, '#C2703B');
    // tetto a falde (apice)
    c.poly([[0, 0, hh + rh], [-s, -s, hh], [s, -s, hh]], '#7E2F22');
    c.poly([[0, 0, hh + rh], [s, -s, hh], [s, s, hh]], '#9B3A2A');
    c.poly([[0, 0, hh + rh], [s, s, hh], [-s, s, hh]], '#7E2F22');
    c.poly([[0, 0, hh + rh], [-s, s, hh], [-s, -s, hh]], '#5F231A');
    c.facePane(0, 0, s, s, 'y', 1, -s * 0.3, s * 0.3, 0, hh * 0.6, '#3a1a12');   // porta
    c.facePane(0, 0, s, s, 'y', 1, s * 0.4, s * 0.7, hh * 0.45, hh * 0.8, 'rgba(255,221,160,0.9)'); // finestra
    c.box(s * 0.5, -s * 0.4, 3, 3, hh + 4, hh + 12, '#8a4a2a');               // comignolo
    return finish(id, file, c, s);
}

// ── definizione del set ────────────────────────────────────────────────────────
// id-suffix, sx, sy, z(px), piani, seed-finestre, colore-SCURO, colore-CHIARO
const BUILDINGS: [string, number, number, number, number, number, string, string][] = [
    ['a', 34, 34, 78, 3, 0b101101, '#3d5184', '#aab6d8'],
    ['b', 32, 32, 52, 2, 0b011010, '#2d3c58', '#b6c0d4'],
    ['c', 36, 36, 34, 1, 0b000110, '#7a6450', '#d6c6ac'],
    ['d', 33, 33, 70, 3, 0b110011, '#46577d', '#b3bedb'],
    ['e', 34, 34, 50, 2, 0b101010, '#37514e', '#aec7c0'],
    ['f', 35, 35, 38, 1, 0b011100, '#3a4a66', '#b8c2d6'],
];
// finestre: di notte (tema scuro) calde su buio; di giorno (tema chiaro) soft su grigio
const WIN_DARK: WinPal = { on: 'rgba(255,221,160,0.92)', off: 'rgba(10,16,26,0.5)' };
const WIN_LIGHT: WinPal = { on: 'rgba(250,228,160,0.85)', off: 'rgba(110,128,155,0.42)' };
/** Suffisso della variante palazzo per tema chiaro (stesso geometria/anchor, solo colori). */
const LIGHT_SUFFIX = '.lt';
const CAR_COLORS = ['#F2B441', '#FF6B6B', '#B084F5', '#5BC0EB', '#9CE37D', '#F58CC1', '#FF9F5B'];
const CAR_DIRS: [string, 'x' | 'y', number][] = [['e', 'x', 1], ['w', 'x', -1], ['n', 'y', -1], ['s', 'y', 1]];
const TREES: [string, number, number][] = [['a', 1.0, 0b011], ['b', 0.8, 0b101], ['c', 1.2, 0b110]];

function main(): void {
    mkdirSync(ASSETS_DIR, { recursive: true });
    const built: Built[] = [];

    for (const [suf, sx, sy, z, fl, seed, dark, light] of BUILDINGS) {
        built.push(building(`buro.bld.${suf}`, `burocrazia/bld-${suf}.svg`, sx, sy, z, dark, fl, seed, WIN_DARK));
        built.push(building(`buro.bld.${suf}${LIGHT_SUFFIX}`, `burocrazia/bld-${suf}-lt.svg`, sx, sy, z, light, fl, seed, WIN_LIGHT));
    }
    CAR_COLORS.forEach((col, i) => { for (const [d, axis, front] of CAR_DIRS) built.push(car(`buro.car.${i}.${d}`, `burocrazia/car-${i}-${d}.svg`, col, axis, front)); });
    for (const [suf, sc, sd] of TREES) built.push(tree(`buro.tree.${suf}`, `burocrazia/tree-${suf}.svg`, sc, sd));
    built.push(home('buro.home', 'burocrazia/home.svg'));

    // scrivi gli SVG
    for (const b of built) writeFileSync(join(ROOT, 'src', 'assets', 'files', b.file), b.svg);

    // fondi mapping.json (preserva tutte le altre voci)
    const mapping = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8')) as Record<string, string>;
    for (const b of built) mapping[b.id] = b.file;
    writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2) + '\n');

    // scrivi il manifest TS
    const meta: Record<string, Meta> = {};
    for (const b of built) meta[b.id] = b.meta;
    const carIds = CAR_COLORS.map((_, i) => CAR_DIRS.map(d => `'buro.car.${i}.${d[0]}'`).join(', '));
    const manifest = `// GENERATO da scripts/generate-burocrazia-sprites.ts — non modificare a mano.
// Metadati degli sprite isometrici: dimensioni px, anchor (offset del centro-a-terra
// dall'angolo alto-sx dell'immagine) e footprint world-px (collisione/ombra).

export interface BuroSpriteMeta { w: number; h: number; ax: number; ay: number; foot: number; }

export const BURO_SPRITE_META: Record<string, BuroSpriteMeta> = ${JSON.stringify(meta, null, 4)};

export const BURO_BUILDINGS: readonly string[] = [${BUILDINGS.map(b => `'buro.bld.${b[0]}'`).join(', ')}];
/** Su tema chiaro, aggiungere questo suffisso all'id del palazzo per la variante chiara. */
export const BURO_BUILDING_LIGHT = '${LIGHT_SUFFIX}';
export const BURO_TREES: readonly string[] = [${TREES.map(t => `'buro.tree.${t[0]}'`).join(', ')}];
export const BURO_HOME = 'buro.home';

/** Auto: [indiceColore][direzione e|w|n|s] → id sprite. L'indice combacia con carColors nel motore. */
export const BURO_CARS: readonly (readonly string[])[] = [
    ${carIds.map(row => `[${row}]`).join(',\n    ')},
];
export const BURO_CAR_DIR: Record<string, number> = { e: 0, w: 1, n: 2, s: 3 };
`;
    writeFileSync(MANIFEST_PATH, manifest);

    console.log(`[buro-sprites] ${built.length} sprite generati in ${ASSETS_DIR}`);
    console.log(`[buro-sprites] mapping.json aggiornato (${built.length} voci buro.*)`);
    console.log(`[buro-sprites] manifest: ${MANIFEST_PATH}`);
}

main();
