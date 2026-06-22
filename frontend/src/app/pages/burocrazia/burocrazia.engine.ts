// Burocrazia — motore di gioco (canvas isometrico).
//
// Adattato dal sorgente standalone "La Pratica": la simulazione e il rendering su
// canvas restano imperativi (un gioco canvas lo è per natura: Angular non offre
// un'astrazione equivalente). Tutto ciò che era manipolazione del DOM o testo
// cablato è stato estratto:
//   • niente document.getElementById / innerHTML / classList: il motore riceve il
//     canvas e comunica lo stato della UI al componente tramite `hooks`, che li
//     mappa su signal Angular (clock, obiettivo, coach, modali).
//   • niente stringhe in chiaro: i testi passano da `t()` (TranslateService).
//   • niente input listener globali: il componente inoltra tastiera/puntatore.
//   • rimosso l'audio (sorgenti vuote → muto) e il bridge di test headless.

import {
    BURO_SPRITE_META, BURO_BUILDINGS, BURO_BUILDING_LIGHT, BURO_TREES, BURO_HOME, BURO_CAR_TYPES, BURO_PLAYER, type BuroSpriteMeta,
} from './burocrazia.sprites';
// Solo i metodi STATICI di ThemeService (conversione colore + contrasto): il README li dichiara
// puri/SSR-safe, quindi è il seam giusto per validare i colori dei prop di scena senza DI Angular.
import { ThemeService } from '../../core/engine/services/theme.service';

// ─── tipi condivisi col componente ──────────────────────────────────────────
export type ClockTone = 'none' | 'warn' | 'crit';
export type ServeTone = 'normal' | 'muted' | 'amber' | 'red' | 'green' | 'gold';
export type CoachPulse = 'joy' | 'act' | 'dismount' | null;

export interface PratData { item: string; nextOffice: string | null; stamps: number; total: number; }
export interface CoachData { label: string; text: string; pulse: CoachPulse; }
export interface ServeLine { text: string; tone: ServeTone; }
export interface ServeData { office: string; lines: ServeLine[]; cost: string; next: string; }
export interface ResultRecap { label: string; value: string; }
export interface ResultData { won: boolean; title: string; time: string; flavor: string; recap: ResultRecap[]; giro: string; }
export interface IntroOption { label: string; stamps: string; }
export interface IntroData { question: string; body: string; options: IntroOption[]; }
export interface WelcomeData { title: string; lines: string[]; cta: string; }

/**
 * Palette del canvas. Superfici e accenti arrivano dalle CSS var di Bootstrap/tema
 * (light o dark → mappa light o dark, in automatico); le tinte "artistiche" degli edifici
 * sono per-tono. Così i colori sul canvas restano coerenti col resto del sito.
 */
export interface Palette {
    void: string;          // sfondo mappa = --bs-body-bg (dissolve nella pagina)
    ground: string;        // isolati/verde = --bs-secondary-bg
    sidewalk: string;      // marciapiede/spazio pedonale che fiancheggia l'asfalto
    road: string;          // asfalto scuro
    surfaceOffice: string; // ufficio "a riposo" = --bs-secondary-bg
    surfaceDone: string;   // ufficio già fatto = --bs-tertiary-bg
    light: boolean;        // tema chiaro? → sceglie la variante sprite chiara dei palazzi
    buildings: string[];   // edifici (per-tono) — usati solo dal fallback vettoriale
    warning: string; info: string; success: string; danger: string;  // accenti semantici Bootstrap
    mutedText: string;     // --bs-secondary-color
    body: string;          // --bs-body-color
}

export interface GameHooks {
    t: (key: string, ...args: unknown[]) => string;
    /** Risolve un id del mapping asset in URL (AssetService.getUrl) — usato per gli sfx. */
    assetUrl: (id: string) => string;
    onClock: (text: string, tone: ClockTone, hourDeg: number, minDeg: number) => void;
    onFlash: () => void;
    onPrat: (data: PratData | null) => void;
    onCoach: (data: CoachData | null, showStart: boolean, startPulse: boolean) => void;
    onAct: (label: string, dim: boolean, ariaLabel: string, showDismount: boolean) => void;
    onServe: (data: ServeData | null) => void;
    onResult: (data: ResultData | null) => void;
    onIntro: (data: IntroData | null) => void;
    /** Schermata iniziale di micro-contesto (cos'è il gioco / l'obiettivo); null = chiusa. */
    onWelcome: (data: WelcomeData | null) => void;
    /** Tutorial già completato? (persistito dal componente via il servizio cookie del framework). */
    tutorialDone: () => boolean;
    /** Notifica che il tutorial è stato completato (il componente lo salva nei cookie). */
    onTutorialDone: () => void;
    /** Notifica lo stato di pausa utente (il componente apre/chiude la finestra "In pausa"). */
    onPause: (paused: boolean) => void;
    /** Zoom mappa salvato dalla sessione precedente (cookie), o null se mai impostato. */
    savedZoom: () => number | null;
    /** Notifica il nuovo livello di zoom scelto dall'utente (il componente lo salva nei cookie). */
    onZoom: (zoom: number) => void;
    /** Il device è risultato troppo lento: la grafica è stata alleggerita → avvisa l'utente (una volta). */
    onPerfNotice: () => void;
}

export interface GameController {
    resize(): void;
    setPalette(p: Palette): void;
    /** Riduce/azzera le animazioni del canvas (da ThemeService.prefersReducedMotion()). */
    setReduceMotion(v: boolean): void;
    /** Moltiplica lo zoom mappa (es. 1.1 = avvicina, 0.9 = allontana), con clamp ai limiti. */
    zoomBy(factor: number): void;
    doAction(): void;
    doDismount(): void;
    confirmStart(): void;
    choosePratica(index: number): void;
    dismissServe(): void;
    dismissWelcome(): void;
    restart(): void;
    keydown(e: KeyboardEvent): void;
    keyup(e: KeyboardEvent): void;
    setJoy(x: number, y: number): void;
    clearJoy(): void;
    toggleMute(): boolean;
    isMuted(): boolean;
    togglePause(): void;
    dropInputs(): void;
    dispose(): void;
}

// ─── tipi interni ────────────────────────────────────────────────────────────
interface Vec { x: number; y: number; }
interface GNode { ix: number; iy: number; }
type Dir = Vec;
interface Car { ix: number; iy: number; dir: Dir; pdir: Dir; tx: number; ty: number; prog: number; pending: Dir | null; color: string; ci: number; ti: number; x: number; y: number; turning: boolean; lane: number; spd: number; }
interface OfficeGeom { ix: number; iy: number; bx: number; by: number; dx: number; dy: number; }
interface Building { cx: number; cy: number; s: number; h: number; colIdx: number; lit: boolean; seed: number; typeIdx: number; }
interface Prop { kind: 'tree' | 'bed' | 'lamp'; x: number; y: number; seed: number; }
interface Player { x: number; y: number; riding: Car | null; }
interface FloatTxt { text: string; color: string; x: number; y: number; born: number; }
interface Ring { x: number; y: number; born: number; }
interface OfficeEvent { idx: number; m: number; shortcut?: boolean; closed?: boolean; }
interface Pratica { item: number; q: number[]; }
type Sprite =
    | { k: number; kind: 'car'; o: Car }
    | { k: number; kind: 'office'; o: OfficeGeom; id: number }
    | { k: number; kind: 'home' }
    | { k: number; kind: 'build'; b: Building }
    | { k: number; kind: 'prop'; p: Prop }
    | { k: number; kind: 'player' };

export function createBurocraziaGame(canvas: HTMLCanvasElement, stageEl: HTMLElement, hooks: GameHooks): GameController {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const t = hooks.t;

    // ───────── TUNING — manopole di bilanciamento (tutto ciò che si ritocca a mano sta QUI) ─────────
    // Struttura/vista (COLS·ROWS, zoom, orari) e i valori DERIVATI restano vicino al loro uso; qui solo
    // gli scalari di gameplay che si toccano per bilanciare. I `const` più sotto ne leggono i valori.
    const TUNING = {
        cell: 234,                 // passo griglia → spaziatura isolati (la larghezza strada NON dipende da qui)
        carSpeed: 150,             // velocità base auto (poi × fattore per tipo)
        carScale: 0.85,            // dimensione sprite auto
        carTypeSpd: { sedan: 0.86, citycar: 0.94, coupe: 1.05, minivan: 0.78, truck: 0.68 } as Record<string, number>,
        lanes: 2, laneOff: 15, laneGap: 26, carHalf: 12, sidewalkW: 10,   // geometria carreggiata → larghezza strada
        turnSmooth: 0.22,          // frazione di segmento usata per arrotondare le svolte (curva fluida agli incroci)
        roundaboutCount: 5,        // quanti incroci a 4 vie diventano mini-rotonde (0 = disattiva)
        roundaboutIsland: 30,      // raggio (world) dell'isola centrale della rotonda
        gapSame: 0.34,             // distanza di sicurezza front-to-back (frazione di segmento)
        intersectApproachPad: 36,  // zona di "contesa" incrocio (oltre ROAD_HALF)
        intersectHoldPad: 6,       // margine linea di stop (oltre ROAD_HALF + carHalf)
        lureMax: 0.7, lureSigma: 4.5, ringKeep: 1,                       // richiamo del traffico verso il giocatore
        carMin: 150, carGrow: 80, carCap: 250,                          // auto: base, crescita verso la chiusura, tetto
        paceRefCell: 156,          // CELL a cui TIME_RATE=0.4 era tarato (ritmo orologio ∝ 1/CELL)
        perfSlowMs: 30,            // tempo-frame (ms) oltre cui il device è "lento" (~33fps)
        perfSustainMs: 3000,       // durata della lentezza prima di passare in lite
        perfLiteScale: 0.5,        // quanto ridurre le auto in lite
    };

    // Accessibilità — rispetta prefers-reduced-motion: sul canvas niente lampeggi, niente
    // pulsazioni "elastiche" e camera che insegue di scatto invece che con inerzia. Il valore
    // NON lo leggiamo qui: lo spinge il componente via setReduceMotion() dal signal reattivo
    // ThemeService.prefersReducedMotion() (convenzione del framework per i componenti canvas).
    let reduceMotion = false;

    // Palette corrente: default scuro, sovrascritta da setPalette() col tema reale del sito.
    let pal: Palette = {
        void: '#080B12', ground: '#101A2A', sidewalk: '#3b4654', road: '#2b3340',
        surfaceOffice: '#5a6a80', surfaceDone: '#3a4658', light: false,
        buildings: ['#1b2636', '#212e41', '#26344a', '#2c3a52', '#1f2a3a', '#324162', '#23344b', '#3a3550', '#2e3a40', '#43352f'],
        warning: '#FFD23F', info: '#38E1C6', success: '#9CE37D', danger: '#FF6B6B', mutedText: '#9aa6b8', body: '#C9D3E1',
    };
    const BUILDING_COUNT = 10;
    const BUILDING_SCALE = 0.8;       // riduzione massima dei palazzi (sagoma meno torreggiante in iso)
    const BUILDING_FOOT_CAP = 25;     // footprint world max dopo la scala: il blocco verde ha semi-larghezza ~32, così resta SEMPRE un margine palazzo↔strada

    // Visibilità dei prop di scena (a11y) SENZA sacrificare il "realismo": mantiene tinta e croma
    // (OKLCH H+C) — l'albero resta verde, il lampione ambra — e ritocca SOLO la luminanza finché il
    // colore stacca dal terreno di una soglia GENTILE. Non il 4.5:1 da testo: quello spegnerebbe la
    // semantica del colore; serve solo evitare che un prop scuro si fonda nel terreno scuro (dark mode).
    // Cache per-tinta, svuotata al cambio palette → nessun costo OKLCH nel frame.
    const VIS_MIN = 1.5;
    const visCache = new Map<string, string>();
    function vis(hex: string): string {
        const hit = visCache.get(hex);
        if (hit !== undefined) return hit;
        let out = hex;
        try {
            if (ThemeService.calcContrastRatio(hex, pal.ground) < VIS_MIN) {
                const [L, C, H] = ThemeService.hexToOklch(hex);
                const dir = ThemeService.calcLuminance(pal.ground) < 0.5 ? 1 : -1;   // terreno scuro → schiarisci; chiaro → scurisci
                let best = hex, bestR = ThemeService.calcContrastRatio(hex, pal.ground);
                for (let d = 0.06; d <= 0.5; d += 0.06) {
                    const cand = ThemeService.oklchToHex(clamp(L + dir * d, 0, 1), C, H);
                    const r = ThemeService.calcContrastRatio(cand, pal.ground);
                    if (r > bestR) { bestR = r; best = cand; }
                    if (r >= VIS_MIN) { best = cand; break; }
                }
                out = best;
            }
        } catch { /* colore non-hex (rgb/var): lascialo com'è */ }
        visCache.set(hex, out);
        return out;
    }

    // ---- sprite: asset SVG pre-renderizzati UNA volta in canvas offscreen (cache), poi blittati ----
    // Geometria/anchor arrivano dal manifest generato. Finché un'immagine non è pronta (o se manca),
    // il disegno ricade sul vecchio vettoriale, così non c'è mai un buco a schermo.
    interface BakedSprite { canvas: HTMLCanvasElement; ax: number; ay: number; w: number; h: number; }
    let spriteDpr = Math.min(window.devicePixelRatio || 1, 2);
    /** Banca un'immagine caricata in un canvas offscreen alla densità corrente (anchor/dim dal manifest). */
    function bakeImg(img: HTMLImageElement, meta: BuroSpriteMeta): BakedSprite | null {
        const off = document.createElement('canvas');
        off.width = Math.max(1, Math.round(meta.w * spriteDpr));
        off.height = Math.max(1, Math.round(meta.h * spriteDpr));
        const octx = off.getContext('2d');
        if (!octx) return null;
        octx.setTransform(spriteDpr, 0, 0, spriteDpr, 0, 0);
        octx.drawImage(img, 0, 0, meta.w, meta.h);
        return { canvas: off, ax: meta.ax, ay: meta.ay, w: meta.w, h: meta.h };
    }
    const spriteCache = new Map<string, BakedSprite | null>();   // undefined=mai visto, null=in caricamento/assente
    function getSprite(id: string): BakedSprite | null {
        const hit = spriteCache.get(id);
        if (hit !== undefined) return hit;
        spriteCache.set(id, null);
        const meta = BURO_SPRITE_META[id];
        if (!meta) return null;
        const img = new Image();
        img.onload = (): void => { const b = bakeImg(img, meta); if (b) spriteCache.set(id, b); };
        img.onerror = (): void => { /* resta null → fallback vettoriale */ };
        img.src = hooks.assetUrl(id);
        return null;
    }
    // ---- auto: UNA forma per carrozzeria, COLORE applicato a RUNTIME ----
    // Il markup SVG ha il token __BODY__ sulla carrozzeria: si scarica UNA volta per (tipo,dir) e poi si banca
    // una variante per ogni colore (sostituzione token → data-URL → bake), tutto in cache. Così bastano
    // <tipi>×4 file e ogni colore è gratis. Async come gli altri sprite (intanto fa fallback vettoriale).
    const carText = new Map<string, string | null>();        // template SVG per "tipo.dir" (null=in fetch/assente)
    const carBake = new Map<string, BakedSprite | null>();   // sprite bancato per "tipo.dir.colore"
    function getCarSprite(type: string, dir: string, ci: number): BakedSprite | null {
        const bk = type + '.' + dir + '.' + ci;
        const hit = carBake.get(bk);
        if (hit !== undefined) return hit;
        const id = 'buro.car.' + type + '.' + dir, meta = BURO_SPRITE_META[id];
        if (!meta) { carBake.set(bk, null); return null; }
        const td = type + '.' + dir, txt = carText.get(td);
        if (txt === undefined) {   // mai richiesto: scarica il template una volta sola
            carText.set(td, null);
            fetch(hooks.assetUrl(id)).then(r => r.text()).then(t => carText.set(td, t)).catch(() => { /* resta null → fallback */ });
            return null;
        }
        if (txt === null) return null;   // template ancora in arrivo
        carBake.set(bk, null);           // testo pronto → tinta questo colore e bancalo
        const svg = txt.split('__BODY__').join(carColors[ci]);
        const img = new Image();
        img.onload = (): void => { const b = bakeImg(img, meta); if (b) carBake.set(bk, b); };
        img.onerror = (): void => { /* resta null → fallback vettoriale */ };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        return null;
    }
    /** Disegna uno sprite già bancato col suo anchor sul punto-schermo (sx,sy). True se disegnato. */
    function blitBaked(s: BakedSprite | null, sx: number, sy: number, scale = 1): boolean {
        if (!s) return false;
        const k = scale * (zoom / ZOOM_BASE);   // adatta gli sprite (px fissi, tarati a ZOOM_BASE) al livello di zoom corrente
        ctx.drawImage(s.canvas, sx - s.ax * k, sy - s.ay * k, s.w * k, s.h * k);
        return true;
    }
    /** `scale` < 1 rimpicciolisce attorno all'anchor (la base resta ferma): per i palazzi crea uno stacco
     *  dalla strada e abbassa la sagoma, così in vista isometrica non scavalcano la carreggiata. */
    function blit(id: string, sx: number, sy: number, scale = 1): boolean { return blitBaked(getSprite(id), sx, sy, scale); }
    const carDir = (c: Car): string => c.dir.x > 0 ? 'e' : c.dir.x < 0 ? 'w' : c.dir.y < 0 ? 'n' : 's';
    const treeSpriteId = (seed: number): string => BURO_TREES[seed % BURO_TREES.length];
    const buildingSpriteId = (b: Building): string => BURO_BUILDINGS[b.typeIdx] + (pal.light ? BURO_BUILDING_LIGHT : '');

    // ---- audio ----  ogni voce è un ID del mapping asset (src/assets/mapping.json),
    // risolto come le immagini via AssetService → niente file inline. Vuoto = muto: il
    // gioco gira lo stesso. Per attivare un suono: aggiungi il file in src/assets/files,
    // mappalo (es. "burocrazia.stamp": "burocrazia/stamp.mp3") e metti qui l'id.
    const SOUND_SRC: Record<string, string> = {
        board: 'buro.sfx.board',       // SALI: salita a piedi su un'auto
        jump: 'buro.sfx.jump',         // SALTA: da auto ad auto
        dismount: 'buro.sfx.dismount', // SCENDI
        stamp: 'buro.sfx.stamp',       // timbro ottenuto
        bounce: 'buro.sfx.bounce',     // rimbalzato indietro
        closed: 'buro.sfx.closed',     // sportello chiuso
        shortcut: 'buro.sfx.shortcut', // scorciatoia concessa
        win: 'buro.sfx.win',           // permesso ottenuto
        lose: 'buro.sfx.lose',         // tempo scaduto
        warn: 'buro.sfx.warn',         // scatta l'ultima ora
        ambient: 'buro.sfx.ambient',   // sottofondo città in loop (Mixkit Free License); gli altri SFX sono Kenney CC0
    };
    const Sound = (() => {
        let ac: AudioContext | null = null, gSfx: GainNode | null = null, gAmb: GainNode | null = null, amb: AudioBufferSourceNode | null = null, muted = false;
        // Pausa di gioco (ESC/pulsante): sospende l'INTERO contesto audio (ambiente incluso) e
        // impedisce a unlock() di riattivarlo finché dura la pausa (ESC richiama unlock()).
        let paused = false;
        const buf: Record<string, AudioBuffer> = {};
        async function dec(name: string, id: string): Promise<void> {
            if (!id || !ac) return;
            try { const r = await fetch(hooks.assetUrl(id)); const ab = await r.arrayBuffer(); buf[name] = await ac.decodeAudioData(ab); } catch { /* asset assente o non valido: resta in silenzio */ }
        }
        function startAmbient(): void { if (!ac || !gAmb || muted || amb || !buf['ambient']) return; amb = ac.createBufferSource(); amb.buffer = buf['ambient']; amb.loop = true; amb.connect(gAmb); amb.start(); }
        function unlock(): void {                                    // va chiamato dentro un gesto (tap): sblocca l'audio su mobile
            if (ac) { if (ac.state === 'suspended' && !paused) void ac.resume(); return; }   // in pausa NON riattivare
            const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
                || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AC) return;
            ac = new AC(); gSfx = ac.createGain(); gAmb = ac.createGain(); gSfx.gain.value = 0.9; gAmb.gain.value = 0.05;   // ambient quasi impercettibile: solo un velo di sottofondo
            gSfx.connect(ac.destination); gAmb.connect(ac.destination);
            Object.keys(SOUND_SRC).forEach(k => { void dec(k, SOUND_SRC[k]).then(() => { if (k === 'ambient') startAmbient(); }); });
        }
        function play(name: string): void { if (!ac || muted || !gSfx || !buf[name]) return; const s = ac.createBufferSource(); s.buffer = buf[name]; s.connect(gSfx); s.start(); }
        function toggle(): boolean { muted = !muted; if (gSfx) gSfx.gain.value = muted ? 0 : 0.9; if (gAmb) gAmb.gain.value = muted ? 0 : 0.05; if (!muted) startAmbient(); return muted; }
        // Pausa/ripresa di gioco: sospende o riprende tutto il grafo audio (ambiente + sfx). Idempotente.
        function setPaused(p: boolean): void { paused = p; if (!ac) return; if (p) { if (ac.state === 'running') void ac.suspend(); } else if (ac.state === 'suspended') void ac.resume(); }
        // Teardown all'uscita dalla pagina: ferma l'ambiente e CHIUDE il contesto audio. Senza questo
        // il loop continua dopo aver lasciato la pagina e ogni rientro creerebbe un nuovo AudioContext
        // (leak + limite del browser sul numero di contesti).
        function dispose(): void { paused = false; try { amb?.stop(); } catch { /* già fermo */ } amb = null; if (ac) { void ac.close().catch(() => { /* già chiuso */ }); ac = null; } gSfx = null; gAmb = null; }
        return { unlock, play, toggle, isMuted: (): boolean => muted, setPaused, dispose };
    })();

    // ---- canvas ----
    let W = 1000, H = 760;
    function setupCanvas(): void {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (dpr !== spriteDpr) { spriteDpr = dpr; spriteCache.clear(); carBake.clear(); }   // sprite (auto incluse) ri-bancati alla nuova densità
        const bw = Math.max(1, Math.round(stageEl.clientWidth)), bh = Math.max(1, Math.round(stageEl.clientHeight));
        W = bw; H = bh;
        canvas.style.width = bw + 'px'; canvas.style.height = bh + 'px';
        canvas.width = Math.round(bw * dpr); canvas.height = Math.round(bh * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
    const randInt = (n: number): number => Math.floor(Math.random() * n);

    // ISOLATI GRANDI (look "Google Maps"): la STRADA tiene la sua larghezza (geometria corsie qui sotto,
    // invariata), ma il PASSO della griglia (CELL) è molto più ampio → tra una strada e l'altra c'è molto
    // più verde/edifici e le carreggiate si leggono come linee distanziate, non come un puzzle di incroci.
    // Nota: CELL non cambia la larghezza su schermo delle strade (che dipende solo da ROAD_HALF·zoom),
    // quindi ingrandirlo dà SOLO più spazio attorno. In cambio le tratte sono più lunghe → vedi TIME_RATE.
    const COLS = 26, ROWS = 22, CELL = TUNING.cell, lastX = COLS - 1, lastY = ROWS - 1;
    const worldW = CELL * lastX, worldH = CELL * lastY;
    const gx = (i: number): number => i * CELL, gy = (j: number): number => j * CELL;
    const DIRS: Record<'E' | 'W' | 'N' | 'S', Dir> = { E: { x: 1, y: 0 }, W: { x: -1, y: 0 }, N: { x: 0, y: -1 }, S: { x: 0, y: 1 } };
    const DIR_LIST: Dir[] = Object.values(DIRS);
    const rev = (d: Dir): Dir => d === DIRS.E ? DIRS.W : d === DIRS.W ? DIRS.E : d === DIRS.N ? DIRS.S : DIRS.N;
    const kk = (a: number, b: number): string => a + ',' + b;
    const eKey = (a: GNode, b: GNode): string => { const A = kk(a.ix, a.iy), B = kk(b.ix, b.iy); return A < B ? A + '|' + B : B + '|' + A; };

    let edgeSet!: Set<string>, edgeArr!: [GNode, GNode][], buildings!: Building[], props!: Prop[];
    let roundabouts = new Set<string>();   // chiavi "ix,iy" dei nodi che sono mini-rotonde
    function generateCity(): void {
        const N = COLS * ROWS, par = [...Array(N).keys()];
        const find = (x: number): number => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
        const all: [GNode, GNode][] = [];
        for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
            if (i < COLS - 1) all.push([{ ix: i, iy: j }, { ix: i + 1, iy: j }]);
            if (j < ROWS - 1) all.push([{ ix: i, iy: j }, { ix: i, iy: j + 1 }]);
        }
        for (let i = all.length - 1; i > 0; i--) { const k = randInt(i + 1); [all[i], all[k]] = [all[k], all[i]]; }
        edgeSet = new Set(); edgeArr = []; const id = (n: GNode): number => n.iy * COLS + n.ix;
        for (const [a, b] of all) {
            const ra = find(id(a)), rb = find(id(b));
            if (ra !== rb) { par[ra] = rb; edgeSet.add(eKey(a, b)); edgeArr.push([a, b]); }
            else if (Math.random() < 0.5) { edgeSet.add(eKey(a, b)); edgeArr.push([a, b]); }
        }
        buildings = []; props = []; const skip = new Set<string>();
        OFFICES.forEach(o => [[o.ix - 1, o.iy - 1], [o.ix, o.iy - 1], [o.ix - 1, o.iy], [o.ix, o.iy]].forEach(c => skip.add(c[0] + ',' + c[1])));
        [[HOME.ix - 1, HOME.iy - 1], [HOME.ix, HOME.iy - 1], [HOME.ix - 1, HOME.iy], [HOME.ix, HOME.iy]].forEach(c => skip.add(c[0] + ',' + c[1]));
        const blockHalf = CELL / 2 - ROAD_HALF - 12;          // semilato "edificabile" della cella (lontano dall'asfalto)
        const treeAt = (cx: number, cy: number, spread: number): void => {   // un albero in un punto random off-road della cella
            let px = cx, py = cy, ok = false;
            for (let a = 0; a < 6 && !ok; a++) { px = cx + (Math.random() - 0.5) * spread; py = cy + (Math.random() - 0.5) * spread; ok = !onRoad(px, py); }
            if (!ok) { px = cx + (Math.random() - 0.5) * 22; py = cy + (Math.random() - 0.5) * 22; }
            const r = Math.random();
            props.push({ kind: r < 0.78 ? 'tree' : r < 0.92 ? 'bed' : 'lamp', x: px, y: py, seed: randInt(1 << 16) });
        };
        for (let i = 0; i < lastX; i++) for (let j = 0; j < lastY; j++) {
            if (skip.has(i + ',' + j)) continue;
            const cx = gx(i) + CELL / 2, cy = gy(j) + CELL / 2;
            if (Math.random() < 0.6) {
                // ISOLATO EDIFICATO: un grappolo di palazzi affiancati riempie il blocco grande (look "città"),
                // disposti su una griglia 2×2 jitterata nello spazio libero della cella — mai sull'asfalto (onRoad).
                const slots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
                for (let s = slots.length - 1; s > 0; s--) { const k = randInt(s + 1); [slots[s], slots[k]] = [slots[k], slots[s]]; }
                const want = 2 + randInt(3);                  // 2..4 palazzi per isolato
                const off = Math.min(22, blockHalf * 0.6);    // distanza dei palazzi dal centro cella
                let placed = 0;
                for (const [sx, sy] of slots) {
                    if (placed >= want) break;
                    const bx = cx + sx * off + (Math.random() - 0.5) * off * 0.6, by = cy + sy * off + (Math.random() - 0.5) * off * 0.6;
                    if (onRoad(bx, by)) continue;
                    const typeIdx = randInt(BURO_BUILDINGS.length);
                    const foot = BURO_SPRITE_META[BURO_BUILDINGS[typeIdx]].foot;
                    buildings.push({ cx: bx, cy: by, s: foot, h: Math.random() < 0.22 ? 11 + randInt(7) : 5 + randInt(6), colIdx: typeIdx % BUILDING_COUNT, lit: Math.random() < 0.32, seed: randInt(1 << 20), typeIdx });
                    placed++;
                }
                if (!placed) { const typeIdx = randInt(BURO_BUILDINGS.length); const foot = BURO_SPRITE_META[BURO_BUILDINGS[typeIdx]].foot; buildings.push({ cx, cy, s: foot, h: 5 + randInt(6), colIdx: typeIdx % BUILDING_COUNT, lit: Math.random() < 0.32, seed: randInt(1 << 20), typeIdx }); }
                for (let tt = randInt(3); tt > 0; tt--) treeAt(cx, cy, CELL * 0.62);   // qualche albero a contorno
            } else {
                // ISOLATO VERDE: parco/alberi a riempire il blocco grande (niente prop sull'asfalto).
                for (let n = 3 + randInt(4); n > 0; n--) treeAt(cx, cy, CELL * 0.62);
            }
        }
        const place = (ix: number, iy: number): { bx: number; by: number; dx: number; dy: number } => {
            const inB = (x: number, y: number): boolean => x >= 0 && y >= 0 && x <= lastX && y <= lastY;
            let pick: { d: Dir; p: Dir } | null = null;
            for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
                const nb = { ix: ix + d.x, iy: iy + d.y };
                if (!inB(nb.ix, nb.iy) || !edgeSet.has(eKey({ ix, iy }, nb))) continue;
                const ps = [{ x: -d.y, y: d.x }, { x: d.y, y: -d.x }].sort((p, q) => Math.hypot((ix + p.x) - COLS / 2, (iy + p.y) - ROWS / 2) - Math.hypot((ix + q.x) - COLS / 2, (iy + q.y) - ROWS / 2));
                for (const p of ps) { if (inB(ix + p.x, iy + p.y)) { pick = { d, p }; break; } }
                if (pick) break;
            }
            if (pick) { const dx = gx(ix) + pick.d.x * CELL / 2, dy = gy(iy) + pick.d.y * CELL / 2; return { dx, dy, bx: dx + pick.p.x * CELL / 2, by: dy + pick.p.y * CELL / 2 }; }
            let best: number[] | null = null, bd = Infinity;
            for (const [bi, bj] of [[ix - 1, iy - 1], [ix, iy - 1], [ix - 1, iy], [ix, iy]]) {
                if (bi < 0 || bj < 0 || bi >= lastX || bj >= lastY) continue;
                const dd = Math.hypot((bi + 0.5) - COLS / 2, (bj + 0.5) - ROWS / 2); if (dd < bd) { bd = dd; best = [bi, bj]; }
            }
            const b = best || [ix - 1, iy - 1]; return { bx: b[0] * CELL + CELL / 2, by: b[1] * CELL + CELL / 2, dx: gx(ix), dy: gy(iy) };
        };
        OFFICES.forEach(o => { const r = place(o.ix, o.iy); o.bx = r.bx; o.by = r.by; o.dx = r.dx; o.dy = r.dy; });
        { const r = place(HOME.ix, HOME.iy); HOME.bx = r.bx; HOME.by = r.by; HOME.dx = r.dx; HOME.dy = r.dy; }

        // Mini-rotonde: scegli alcuni incroci a 4 vie (interni, lontani da uffici/casa), distribuiti uniformemente.
        roundabouts = new Set();
        if (TUNING.roundaboutCount > 0) {
            const busy = new Set<string>([HOME.ix + ',' + HOME.iy, ...OFFICES.map(o => o.ix + ',' + o.iy)]);
            const fourWay: string[] = [];
            for (let i = 2; i < lastX - 1; i++) for (let j = 2; j < lastY - 1; j++) {
                if (busy.has(i + ',' + j)) continue;
                if (DIR_LIST.every(d => neighbor(i, j, d))) fourWay.push(i + ',' + j);
            }
            const step = Math.max(1, Math.floor(fourWay.length / TUNING.roundaboutCount));
            for (let k = 0; k < fourWay.length && roundabouts.size < TUNING.roundaboutCount; k += step) roundabouts.add(fourWay[k]);
        }
    }
    const neighbor = (ix: number, iy: number, d: Dir): GNode | null => {
        const nx = ix + d.x, ny = iy + d.y;
        if (nx < 0 || nx > lastX || ny < 0 || ny > lastY) return null;
        return edgeSet.has(eKey({ ix, iy }, { ix: nx, iy: ny })) ? { ix: nx, iy: ny } : null;
    };
    // Il punto-mondo (x,y) cade su una STRADA (asfalto)? Guarda la linea di griglia più vicina su ciascun
    // asse e, SOLO se lì esiste davvero un segmento stradale (edgeSet), verifica la distanza dal margine.
    // Usato in generazione per non piazzare prop (alberi…) in mezzo alla carreggiata.
    function onRoad(x: number, y: number): boolean {
        const i = Math.round(x / CELL);
        if (i >= 0 && i <= lastX && Math.abs(x - i * CELL) < PROP_ROAD_CLEAR) {
            const jj = clamp(Math.floor(y / CELL), 0, lastY - 1);
            if (edgeSet.has(eKey({ ix: i, iy: jj }, { ix: i, iy: jj + 1 }))) return true;
        }
        const j = Math.round(y / CELL);
        if (j >= 0 && j <= lastY && Math.abs(y - j * CELL) < PROP_ROAD_CLEAR) {
            const ii = clamp(Math.floor(x / CELL), 0, lastX - 1);
            if (edgeSet.has(eKey({ ix: ii, iy: j }, { ix: ii + 1, iy: j }))) return true;
        }
        return false;
    }

    const ZOOM_BASE = 0.9, ZOOM_MIN = 0.5, ZOOM_MAX = 1.5;   // 0.9 = zoom a cui sono tarati gli sprite
    let zoom = clamp(hooks.savedZoom() ?? 1.05, ZOOM_MIN, ZOOM_MAX);   // ripristina lo zoom salvato (cookie); default ravvicinato e giocabile
    const raw = (x: number, y: number): Vec => ({ x: (x - y), y: (x + y) * 0.5 });
    let camX = 0, camY = 0;
    const iso = (x: number, y: number, lift = 0): Vec => { const r = raw(x, y); return { x: r.x * zoom - camX, y: r.y * zoom - camY - lift }; };
    function centerOn(x: number, y: number): void { const r = raw(x, y); camX = r.x * zoom - W / 2; camY = r.y * zoom - H / 2; }
    function camFollow(x: number, y: number, dt: number): void { const r = raw(x, y), tx = r.x * zoom - W / 2, ty = r.y * zoom - H / 2, k = reduceMotion ? 1 : 1 - Math.exp(-dt * 11); camX += (tx - camX) * k; camY += (ty - camY) * k; }
    const onScreen = (p: Vec, m: number): boolean => p.x >= -m && p.x <= W + m && p.y >= -m && p.y <= H + m;
    // Lampeggio temporizzato → luce fissa (sempre acceso) quando si preferisce meno movimento;
    // wob() azzera le piccole oscillazioni sinusoidali (pulse/bob) nello stesso caso.
    const flash = (period: number): boolean => reduceMotion || Math.floor(performance.now() / period) % 2 === 0;
    const wob = (v: number): number => reduceMotion ? 0 : v;

    const CAR_SPEED = TUNING.carSpeed, WALK_SPEED = 47, LANE = 62, REACH = 156, MAX_BOARD = 154, JUMP_SCREEN = 112;   // distanze world +30%; JUMP_SCREEN (px schermo) ridotto per lo zoom-out
    // Velocità PER TIPO di carrozzeria (NON casuale): la velocità è così LEGGIBILE dalla forma — camion
    // lento, coupé veloce — e l'utente sa cosa aspettarsi (niente auto identiche con velocità a sorpresa).
    // Il MIX di tipi sulla stessa strada crea comunque il dislivello che fa "lavorare" distanza di sicurezza
    // (spaceCars) e precedenze agli incroci. Chiavi = BURO_CAR_TYPES; fattore × CAR_SPEED.
    const CAR_TYPE_SPD = TUNING.carTypeSpd;
    const ARROW_NEAR = 250;   // raggio (world) entro cui le auto mostrano la freccia di direzione: le opzioni di salto attorno a te
    // Strade a più corsie per senso di marcia: le auto si distribuiscono lateralmente invece di
    // accodarsi tutte sulla stessa linea → traffico più scorrevole, più auto a schermo, più spazio
    // per leggerle e saltarci sopra (anche questo è un aiuto all'accessibilità: meno "ingorghi").
    const LANES = TUNING.lanes, LANE_OFF = TUNING.laneOff, LANE_GAP = TUNING.laneGap, CAR_HALF = TUNING.carHalf;   // 2 corsie LARGHE per senso: auto ben distinte, niente sovrapposizione laterale
    // La STRADA si deriva da QUI: l'asfalto copre fino al bordo esterno della corsia più esterna,
    // così le auto stanno sempre sull'asfalto e la carreggiata è larga (città trafficata, edifici secondari).
    const ROAD_HALF = LANE_OFF + (LANES - 1) * LANE_GAP + CAR_HALF;   // semilarghezza asfalto in world
    const SIDEWALK_W = TUNING.sidewalkW;                             // marciapiede per lato (world)
    const PROP_ROAD_CLEAR = ROAD_HALF + 10;                          // alberi/aiuole/lampioni: vietati entro questo margine dall'asfalto → niente prop in mezzo alla strada
    // Distribuzione del traffico "a campana": la probabilità che un'auto punti verso di te DECADE
    // gaussianamente con la distanza (in passi). Vicino → quasi tutte convergono (flusso costante su
    // cui salire); lontano → la spinta svanisce e le auto vagano libere → la città resta popolata e
    // la densità sfuma con continuità (mondo coerente anche con lo zoom-out). Quelle entro RING_KEEP
    // si scansano dalla tua cella → orbitano a tiro di salto, non si impilano. L'auto cavalcata è esclusa.
    const LURE_MAX = TUNING.lureMax, LURE_SIGMA = TUNING.lureSigma, RING_KEEP = TUNING.ringKeep;
    const carColors = ['#F2B441', '#FF6B6B', '#B084F5', '#5BC0EB', '#9CE37D', '#F58CC1', '#FF9F5B'];
    const CAR_SCALE = TUNING.carScale;   // auto un filo più piccole: corsie più distinte sulla carreggiata larga
    function makeCar(s: number): Car {
        let tries = 0, ix = 0, iy = 0, opts: Dir[] = [];
        do { ix = randInt(COLS); iy = randInt(ROWS); opts = DIR_LIST.filter(d => neighbor(ix, iy, d)); tries++; } while (!opts.length && tries < 80);
        const dir = opts[randInt(opts.length)], tt = neighbor(ix, iy, dir)!;
        const ci = s % carColors.length, ti = randInt(BURO_CAR_TYPES.length);
        return { ix, iy, dir, pdir: dir, tx: tt.ix, ty: tt.iy, prog: Math.random() * 0.4, pending: null, color: carColors[ci], ci, ti, x: gx(ix), y: gy(iy), turning: false, lane: randInt(LANES), spd: CAR_TYPE_SPD[BURO_CAR_TYPES[ti]] ?? 0.9 };
    }
    function decide(ix: number, iy: number, cur: Dir, toward: GNode | null, away = false): Dir {
        const valid = DIR_LIST.filter(d => d !== rev(cur) && neighbor(ix, iy, d));
        if (!valid.length) return rev(cur);
        if (toward) {
            let best: Dir | null = null, bd = away ? -Infinity : Infinity;   // away: massimizza la distanza (si allontana) invece di minimizzarla
            for (const d of valid) { const n = neighbor(ix, iy, d)!, dist = Math.abs(n.ix - toward.ix) + Math.abs(n.iy - toward.iy); if (away ? dist > bd : dist < bd) { bd = dist; best = d; } }
            if (best && Math.random() < 0.8) return best;
        }
        if (valid.includes(cur) && Math.random() < 0.45) return cur;
        const turns = valid.filter(d => d !== cur); return turns.length ? turns[randInt(turns.length)] : cur;
    }
    // Offset di corsia: normale DESTRA al senso di marcia (-dir.y, +dir.x) → guida a destra.
    const perpOff = (d: Dir, off: number): Vec => ({ x: -d.y * off, y: d.x * off });
    const TURN_SMOOTH = TUNING.turnSmooth;   // metà curva su questo segmento, metà sul successivo
    // Rotonde: raggio dell'isola centrale e raggio dell'anello su cui scorrono le auto attorno ad essa.
    const RB_ISLAND = TUNING.roundaboutIsland, RB_RING = Math.min(ROAD_HALF - 2, RB_ISLAND + CAR_HALF + 6);
    // Spinge la posizione dell'auto FUORI dall'isola, lungo il raggio (cioè sul lato in cui già viaggia per
    // via dell'offset destro): così l'auto gira intorno all'isola tenendola a sinistra, senza salti (la
    // correzione è continua: al bordo dell'anello lo spostamento è nullo). Solo posizione, nessuna logica.
    function roundaboutClamp(c: Car): void {
        const check = (ix: number, iy: number): void => {
            if (!roundabouts.has(ix + ',' + iy)) return;
            const nx = gx(ix), ny = gy(iy), dx = c.x - nx, dy = c.y - ny, d = Math.hypot(dx, dy);
            if (d < RB_RING && d > 0.01) { const k = RB_RING / d; c.x = nx + dx * k; c.y = ny + dy * k; }
        };
        check(c.ix, c.iy); check(c.tx, c.ty);
    }
    // Raccordo della svolta: Bézier quadratica E→C→X attorno al nodo (nodeX,nodeY), dal verso d al verso d2.
    // I due capi giacciono sulle corsie dritte (offset perpendicolare); il controllo C è l'angolo interno
    // (somma dei due offset), così la curva passa raso all'incrocio invece di "saltare".
    function cornerPos(c: Car, nodeX: number, nodeY: number, d: Dir, d2: Dir, u: number, off: number): void {
        const s = TURN_SMOOTH * CELL, pa = perpOff(d, off), pb = perpOff(d2, off);
        const ex = nodeX - d.x * s + pa.x, ey = nodeY - d.y * s + pa.y;     // capo in entrata
        const xx = nodeX + d2.x * s + pb.x, xy = nodeY + d2.y * s + pb.y;   // capo in uscita
        const cx = nodeX + pa.x + pb.x, cy = nodeY + pa.y + pb.y;           // controllo = angolo interno
        const w = (1 - u) * (1 - u), m = 2 * (1 - u) * u, e = u * u;
        c.x = w * ex + m * cx + e * xx;
        c.y = w * ey + m * cy + e * xy;
    }
    function placeCar(c: Car): void {
        const ax = gx(c.ix), ay = gy(c.iy), bx = gx(c.tx), by = gy(c.ty), p = clamp(c.prog, 0, 1);
        const off = LANE_OFF + c.lane * LANE_GAP;   // corsie impilate verso l'esterno sul proprio lato di marcia
        // USCITA dalla curva: ultimo tratto prima del nodo, con svolta a 90° già decisa (pending) → arrotonda.
        if (c.pending && c.pending !== c.dir && c.pending !== rev(c.dir) && p > 1 - TURN_SMOOTH && neighbor(c.tx, c.ty, c.pending)) {
            cornerPos(c, bx, by, c.dir, c.pending, (p - (1 - TURN_SMOOTH)) / (2 * TURN_SMOOTH), off);   // u: 0 → 0.5
        }
        // ENTRATA nella curva: primo tratto dopo aver svoltato (pdir ≠ dir a 90°) → completa l'arco.
        else if (c.pdir !== c.dir && c.pdir !== rev(c.dir) && p < TURN_SMOOTH) {
            cornerPos(c, ax, ay, c.pdir, c.dir, 0.5 + p / (2 * TURN_SMOOTH), off);                      // u: 0.5 → 1
        }
        // Tratto dritto.
        else {
            const pp = perpOff(c.dir, off);
            c.x = ax + (bx - ax) * p + pp.x;
            c.y = ay + (by - ay) * p + pp.y;
        }
        // Mini-rotonde: se l'auto è vicino a un nodo-rotonda, scansa l'isola centrale.
        if (roundabouts.size) roundaboutClamp(c);
    }
    function updateCar(c: Car, dt: number): void {
        let ax = gx(c.ix), ay = gy(c.iy); const seg = Math.hypot(gx(c.tx) - ax, gy(c.ty) - ay) || 1;
        let toward: GNode | null = null, away = false;
        if (lure && player && player.riding !== c) {
            const d = Math.abs(c.ix - lure.ix) + Math.abs(c.iy - lure.iy);
            if (d <= RING_KEEP) { toward = lure; away = true; }              // troppo vicino → si scansa: orbita, non si impila
            else if (Math.random() < LURE_MAX * Math.exp(-(d * d) / (2 * LURE_SIGMA * LURE_SIGMA))) toward = lure;   // bias gaussiano: forte vicino, svanisce lontano
        }
        if (c.prog > 0.06 && !c.pending) c.pending = decide(c.tx, c.ty, c.dir, toward, away);
        c.prog += (CAR_SPEED * c.spd * dt) / seg;
        if (c.prog >= 1) {
            c.ix = c.tx; c.iy = c.ty; let nd = c.pending || decide(c.ix, c.iy, c.dir, toward, away);
            if (!neighbor(c.ix, c.iy, nd)) nd = decide(c.ix, c.iy, c.dir, toward, away);
            c.pdir = c.dir; c.dir = nd; const tt = (neighbor(c.ix, c.iy, nd) || neighbor(c.ix, c.iy, rev(nd)))!;
            c.tx = tt.ix; c.ty = tt.iy; c.prog -= 1; c.pending = null; ax = gx(c.ix); ay = gy(c.iy);
        }
        placeCar(c);
        c.turning = !!c.pending && c.pending !== c.dir;
    }
    // Distanza di sicurezza: con 2 corsie larghe le auto NON si sovrappongono lateralmente, quindi basta
    // tenerle distanziate front-to-back nella STESSA corsia (gap > lunghezza auto): scorrono affiancate.
    const GAP_SAME = TUNING.gapSame;
    function spaceCars(): void {
        const lanes = new Map<string, Car[]>();
        for (const c of cars) { const key = c.ix + ',' + c.iy + '>' + c.tx + ',' + c.ty + '#' + c.lane; const g = lanes.get(key); if (g) g.push(c); else lanes.set(key, [c]); }
        
        for (const c of cars) {
            if (c.prog > 1 - GAP_SAME && c.pending) {
                const nextKey = c.tx + ',' + c.ty + '>' + (c.tx + c.pending.x) + ',' + (c.ty + c.pending.y) + '#' + c.lane;
                const nextGroup = lanes.get(nextKey);
                if (nextGroup) {
                    let firstAhead: Car | null = null;
                    for (const nc of nextGroup) { if (!firstAhead || nc.prog < firstAhead.prog) firstAhead = nc; }
                    if (firstAhead) {
                        const dist = (1 - c.prog) + firstAhead.prog;
                        if (dist < GAP_SAME) { c.prog = Math.max(0, 1 - (GAP_SAME - firstAhead.prog)); placeCar(c); }
                    }
                }
            }
        }

        lanes.forEach(g => {
            if (g.length < 2) return;
            g.sort((a, b) => a.prog - b.prog);
            for (let i = g.length - 1; i > 0; i--) { const ahead = g[i], behind = g[i - 1]; if (behind.prog > ahead.prog - GAP_SAME) { behind.prog = Math.max(0, ahead.prog - GAP_SAME); placeCar(behind); } }
        });
    }
    // Precedenza all'INCROCIO: la distanza di sicurezza qui sopra è front-to-back nella stessa corsia,
    // quindi NON impedisce a due auto su strade PERPENDICOLARI di attraversarsi nel crocevia. Qui le auto
    // che puntano allo stesso nodo si contendono l'incrocio: passa la più "impegnata" (più vicina al
    // centro); chi arriva perpendicolare si ferma a una linea di stop finché l'incrocio non è libero.
    // Senza semaforo e senza deadlock: il leader (la più vicina) non cede mai → l'incrocio si svuota sempre.
    const carNodeDist = (c: Car): number => Math.hypot(gx(c.tx) - c.x, gy(c.ty) - c.y);
    const INTERSECT_APPROACH = ROAD_HALF + TUNING.intersectApproachPad;   // entro qui un'auto "contende" il nodo davanti a sé
    const INTERSECT_HOLD = ROAD_HALF + CAR_HALF + TUNING.intersectHoldPad; // linea di stop: ferma prima della carreggiata trasversale
    function resolveIntersections(): void {
        const grp = new Map<string, Car[]>();
        for (const c of cars) {
            if (carNodeDist(c) > INTERSECT_APPROACH) continue;
            const key = c.tx + ',' + c.ty; const g = grp.get(key); if (g) g.push(c); else grp.set(key, [c]);
        }
        grp.forEach(g => {
            if (g.length < 2) return;
            let leader = g[0]; for (const c of g) if (carNodeDist(c) < carNodeDist(leader)) leader = c;
            const leaderHoriz = leader.dir.x !== 0;
            for (const c of g) {
                if (c === leader || c === player.riding) continue;          // tu non cedi mai; il leader passa
                if ((c.dir.x !== 0) === leaderHoriz) continue;              // stessa giacitura → le corsie la separano, niente conflitto
                const segLen = Math.hypot(gx(c.tx) - gx(c.ix), gy(c.ty) - gy(c.iy)) || 1;
                const stopProg = 1 - INTERSECT_HOLD / segLen;
                if (c.prog > stopProg) { c.prog = stopProg; placeCar(c); }  // fermati alla linea di stop
            }
        });
    }
    function desiredCars(min: number): number { const tt = clamp((min - 540) / 540, 0, 1); return Math.round(TUNING.carMin + tt * TUNING.carGrow); }   // città ampia → più auto per popolarla; cresce verso la chiusura
    function setCarCount(n: number): void { n = Math.min(n, TUNING.carCap); while (cars.length < n) cars.push(makeCar(cars.length)); if (cars.length > n) cars.length = n; }

    function nearestNode(x: number, y: number): GNode { return { ix: clamp(Math.round(x / CELL), 0, lastX), iy: clamp(Math.round(y / CELL), 0, lastY) }; }
    function bfsField(goal: GNode): Map<string, number> {
        const dist = new Map<string, number>(); const q: GNode[] = [goal]; dist.set(kk(goal.ix, goal.iy), 0);
        while (q.length) {
            const c = q.shift()!; const dc = dist.get(kk(c.ix, c.iy))!;
            for (const d of DIR_LIST) { const nb = neighbor(c.ix, c.iy, d); if (nb && !dist.has(kk(nb.ix, nb.iy))) { dist.set(kk(nb.ix, nb.iy), dc + 1); q.push(nb); } }
        }
        return dist;
    }
    function nodeDist(ix: number, iy: number): number { const v = distGoal.get(kk(ix, iy)); return v == null ? Infinity : v; }
    function carAdvances(c: Car): boolean { return nodeDist(c.tx, c.ty) < nodeDist(c.ix, c.iy); }

    // ---- dati: coordinate fisse, testi via i18n (per indice) ----
    const OFFICES: OfficeGeom[] = ([
        { ix: 2, iy: 13 }, { ix: 8, iy: 14 }, { ix: 16, iy: 13 }, { ix: 16, iy: 8 }, { ix: 10, iy: 9 },
        { ix: 2, iy: 7 }, { ix: 8, iy: 2 }, { ix: 16, iy: 1 }, { ix: 11, iy: 12 },
    ]).map(o => ({ ...o, bx: 0, by: 0, dx: 0, dy: 0 }));
    const SPORTELLO = 8;
    const HOME = { ix: 9, iy: 7, bx: 0, by: 0, dx: 0, dy: 0 };
    const officeFull = (id: number): string => t(`buroOffice${id}Full`);
    const officeShort = (id: number): string => t(`buroOffice${id}Short`);
    const officeClerk = (id: number): string => t(`buroOffice${id}Clerk`);

    const EVENTS: OfficeEvent[] = [
        { idx: 0, m: 10 }, { idx: 1, m: 12 }, { idx: 2, m: 8 }, { idx: 3, m: 14 },
        { idx: 4, m: 10 }, { idx: 5, m: 2, shortcut: true }, { idx: 6, m: 12 }, { idx: 7, m: 4, closed: true },
    ];
    const ITEM_COUNT = 8;

    function queueWait(min: number): { lo: number; hi: number; label: string } {
        const h = min / 60;
        if (h < 10) return { lo: 10, hi: 20, label: t('buroQueueOpen') };
        if (h < 13.5) return { lo: 6, hi: 16, label: t('buroQueueMorning') };
        if (h < 15.5) return { lo: 12, hi: 24, label: t('buroQueueAfternoon') };
        return { lo: 18, hi: 34, label: t('buroQueueClosing') };
    }

    // Ritmo orologio DERIVATO dalla spaziatura (CELL): la velocità di guida su schermo è fissa, quindi
    // isolati più grandi = tratte più lunghe. TIME_RATE ∝ 1/CELL tiene COSTANTE il budget di minuti-gioco
    // per attraversare la città a qualunque CELL (0.4 era tarato a PACE_REF_CELL=156): cambi CELL e il
    // bilanciamento si riallinea da solo, senza ritoccare a mano una costante "magica".
    const PACE_REF_CELL = TUNING.paceRefCell;
    const START_MIN = 540, CLOSE_MIN = 990, TIME_RATE = 0.4 * PACE_REF_CELL / CELL;
    const LUNCH_START = 810, LUNCH_END = 870;

    // ---- stato ----
    let cars!: Car[], player!: Player, clockMin!: number, paused!: boolean, won!: boolean, lost!: boolean, winPending!: boolean;
    let queue!: number[], served!: Set<number>, atCounter!: boolean, stamps!: number, totalStamps = 9;
    let bounceFlag!: Record<number, boolean>, bounceCount!: number, closedCount!: number, item!: number;
    let highlight = new Set<string>(), recalc = 0, lure: GNode | null = null, routeNext = new Map<string, GNode>();
    let hops = 0, ridingMin = 0, footMin = 0, queueMin = 0, routeLog: number[] = [];
    let tut = 0, tutorialSeen = hooks.tutorialDone(), movedDist = 0, rodeOnce = false;   // tutorial già fatto? (cookie) → si salta
    let floats: FloatTxt[] = [], ring: Ring | null = null;
    let walkPhase = 0, walkAmt = 0, walkDir = { x: 1, y: 0 };
    let jumpAnim: { fx: number; fy: number; fromBase: number; toBase: number; born: number; dur: number } | null = null;
    let distGoal = new Map<string, number>(), distGoalKey = -1;   // campo BFS verso lo sportello: ricalcolato SOLO al cambio ufficio (non ogni frame)
    let perfScale = 1, lite = false;                              // qualità adattiva: su device lenti meno auto + niente effetti costosi
    let aimTarget: Car | null = null;
    let pendingOptions: Pratica[] = [];

    // flag dei pannelli (il motore è la fonte di verità: il componente renderizza da onServe/onIntro/onResult)
    let introOpen = false, serveOpen = false, overlayOpen = false, userPaused = false, welcomeOpen = false, welcomeSeen = false;

    // tracking per emettere i hook UI solo al cambio (no spam di signal a 60fps)
    let lastActLabel = '', lastActDim = false, lastDismount = false, lastClockText = '', lastClockTone: ClockTone = 'none';

    const MOVE_HINT = matchMedia('(pointer:fine)').matches ? t('buroMoveHintFine') : t('buroMoveHintCoarse');

    function setCoach(step: number): void {
        if (step >= 4) { hooks.onCoach(null, false, false); tutorialSeen = true; hooks.onTutorialDone(); return; }
        const map: Record<number, CoachData & { showStart: boolean; startPulse: boolean }> = {
            0: { label: t('buroTutorial') + ' ' + t('buroStep', 1, 3), text: MOVE_HINT, pulse: 'joy', showStart: false, startPulse: false },
            1: { label: t('buroTutorial') + ' ' + t('buroStep', 2, 3), text: t('buroCoach1'), pulse: 'act', showStart: false, startPulse: false },
            2: { label: t('buroTutorial') + ' ' + t('buroStep', 3, 3), text: t('buroCoach2'), pulse: 'dismount', showStart: false, startPulse: false },
            3: { label: t('buroReady'), text: t('buroCoach3'), pulse: null, showStart: true, startPulse: true },
        };
        const c = map[step];
        hooks.onCoach({ label: c.label, text: c.text, pulse: c.pulse }, c.showStart, c.startPulse);
    }

    function openIntro(): void {
        if (tut >= 4 || introOpen) return;
        const a = randInt(ITEM_COUNT); let b: number; do { b = randInt(ITEM_COUNT); } while (b === a);
        const opts: Pratica[] = [{ item: a, q: [0, 1, 2, 3, 4, 5, 6, 7, SPORTELLO] }, { item: b, q: [1, 3, 5, 6, SPORTELLO] }];
        if (Math.random() < 0.5) opts.reverse();
        pendingOptions = opts;
        introOpen = true;
        hooks.onIntro({
            question: t('buroIntroQuestion'),
            body: t('buroIntroBody'),
            options: opts.map(o => ({ label: t('buroPermessoPer', t(`buroItem${o.item}`)), stamps: t('buroIntroStamps', o.q.length) })),
        });
    }
    function choosePratica(index: number): void {
        const opt = pendingOptions[index]; if (!opt) return;
        item = opt.item; queue = opt.q.slice(); totalStamps = opt.q.length;
        served = new Set(); stamps = 0; bounceFlag = {}; bounceCount = 0; closedCount = 0; routeLog = [];
        introOpen = false; hooks.onIntro(null);
        startGame();
    }
    function startGame(): void {
        if (tut >= 4) return;
        player.riding = null; player.x = HOME.dx; player.y = HOME.dy; centerOn(player.x, player.y);
        const ps = iso(player.x, player.y, 22); ring = { x: ps.x, y: ps.y, born: performance.now() }; addFloat(t('buroFloatCasa'), pal.warning, ps.x, ps.y - 26);
        tut = 4; setCoach(4); updatePrat();
    }

    function reset(): void {
        generateCity();
        cars = []; setCarCount(Math.round(desiredCars(START_MIN) * perfScale)); distGoalKey = -1;
        player = { x: HOME.dx, y: HOME.dy, riding: null };
        clockMin = START_MIN; paused = false; won = false; lost = false; winPending = false;
        queue = [0, 1, 2, 3, 4, 5, 6, 7, SPORTELLO]; served = new Set(); atCounter = false; stamps = 0;
        bounceFlag = {}; bounceCount = 0; closedCount = 0; item = randInt(ITEM_COUNT); highlight = new Set(); recalc = 0; routeNext = new Map();
        hops = 0; ridingMin = 0; footMin = 0; queueMin = 0; routeLog = [];
        floats = []; ring = null; movedDist = 0; rodeOnce = false; tut = tutorialSeen ? 3 : 0;
        centerOn(player.x, player.y);
        introOpen = false; serveOpen = false; overlayOpen = false;
        welcomeOpen = !welcomeSeen;   // micro-contesto: una volta per sessione (non si ripete a ogni "nuova pratica")
        hooks.onServe(null); hooks.onResult(null); hooks.onIntro(null);
        hooks.onWelcome(welcomeOpen ? { title: t('burocrazia'), lines: [t('buroWelcome1'), t('buroWelcome2')], cta: t('buroWelcomeCta') } : null);
        updatePrat(); setCoach(tut); emitClock(true);
    }

    const hhmm = (m: number): string => { m = Math.round(m); const h = Math.floor(m / 60), mm = m % 60; return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };

    function updatePrat(): void {
        if (tut < 4) { hooks.onPrat(null); return; }
        const cur = queue[0];
        hooks.onPrat({ item: t(`buroItem${item}`), nextOffice: cur != null ? officeFull(cur) : null, stamps, total: totalStamps });
    }

    function addFloat(text: string, color: string, sx: number, sy: number): void { floats.push({ text, color, x: sx, y: sy, born: performance.now() }); }

    // ---- input ----
    const held = { N: false, S: false, E: false, W: false };
    let joyActive = false; const joyVec = { x: 0, y: 0 };

    function canBoard(c: Car): boolean {
        const u = c.dir, dx = player.x - c.x, dy = player.y - c.y;
        const along = dx * u.x + dy * u.y, perp = dx * (-u.y) + dy * u.x;
        return Math.abs(perp) < LANE && Math.abs(along) < REACH && (dx * dx + dy * dy) < MAX_BOARD * MAX_BOARD;
    }
    function pickBoardable(except: Car | null): Car | null {
        let ax = 0, ay = 0; const jm = Math.hypot(joyVec.x, joyVec.y);
        if (joyActive && jm > 0.2) { ax = joyVec.x; ay = joyVec.y; }
        else { const vx = (held.E ? 1 : 0) - (held.W ? 1 : 0), vy = (held.S ? 1 : 0) - (held.N ? 1 : 0); if (vx || vy) { ax = vx - vy; ay = (vx + vy) * 0.5; } }
        const am = Math.hypot(ax, ay), aiming = am > 0.0001; if (aiming) { ax /= am; ay /= am; }
        const pp = iso(player.x, player.y);
        const inRange = (c: Car, sd: number): boolean => except ? sd < JUMP_SCREEN : canBoard(c);
        if (aiming) {
            let best: Car | null = null, bs = -Infinity;
            for (const c of cars) {
                if (c === except) continue;
                const scc = iso(c.x, c.y), sx = scc.x - pp.x, sy = scc.y - pp.y, sd = Math.hypot(sx, sy);
                if (!inRange(c, sd)) continue;
                const sm = sd || 1, score = (sx / sm) * ax + (sy / sm) * ay - 0.002 * sd; if (score > bs) { bs = score; best = c; }
            }
            return best;
        }
        let adv: Car | null = null, advRank = Infinity, advNear = Infinity, near: Car | null = null, nearD = Infinity;
        for (const c of cars) {
            if (c === except) continue;
            const scc = iso(c.x, c.y), sd = Math.hypot(scc.x - pp.x, scc.y - pp.y);
            if (!inRange(c, sd)) continue;
            if (sd < nearD) { nearD = sd; near = c; }
            if (carAdvances(c)) { const rank = nodeDist(c.tx, c.ty); if (rank < advRank || (rank === advRank && sd < advNear)) { advRank = rank; advNear = sd; adv = c; } }
        }
        return adv || near;
    }
    function blocked(x: number, y: number): boolean {
        const pr = 5;
        // raggio = footprint EFFETTIVO (come a schermo: foot · scala-blit), non il foot grezzo: altrimenti
        // la collisione è più larga del palazzo disegnato e, coi grappoli, creerebbe muri invisibili in strada.
        for (const b of buildings) { const r = b.s * Math.min(BUILDING_SCALE, BUILDING_FOOT_CAP / b.s); if (Math.abs(x - b.cx) < r + pr && Math.abs(y - b.cy) < r + pr) return true; }
        for (const o of OFFICES) { if (Math.abs(x - o.bx) < 20 + pr && Math.abs(y - o.by) < 20 + pr) return true; }
        return false;
    }
    function startJump(fx: number, fy: number, fromBase: number, toBase: number): void { jumpAnim = { fx, fy, fromBase, toBase, born: performance.now(), dur: 0.34 }; }

    function doAction(): void {
        if (userPaused || paused || won || lost) return;
        const ox = player.x, oy = player.y;
        if (player.riding) {
            const tgt = aimTarget;
            if (tgt) {
                player.riding = tgt; player.x = tgt.x; player.y = tgt.y; hops++; startJump(ox, oy, 16, 16); Sound.play('jump');
                const ps = iso(player.x, player.y, 22); ring = { x: ps.x, y: ps.y, born: performance.now() }; addFloat(t('buroFloatJump'), pal.info, ps.x, ps.y - 26);
            } else { const ps = iso(player.x, player.y, 40); addFloat(t('buroFloatNoCarReach'), pal.mutedText, ps.x, ps.y - 10); }
        } else {
            const best = aimTarget;
            if (best) {
                player.riding = best; player.x = best.x; player.y = best.y; hops++; startJump(ox, oy, 0, 16); Sound.play('board');
                const ps = iso(player.x, player.y, 22); ring = { x: ps.x, y: ps.y, born: performance.now() }; addFloat(t('buroFloatBoard'), pal.info, ps.x, ps.y - 26);
            } else { const ps = iso(player.x, player.y, 22); addFloat(t('buroFloatNoCarRoad'), pal.danger, ps.x, ps.y - 26); }
        }
    }
    function doDismount(): void {
        if (userPaused || paused || won || lost || !player.riding) return;
        const ox = player.x, oy = player.y;
        player.x = player.riding.x; player.y = player.riding.y; player.riding = null; startJump(ox, oy, 16, 0); Sound.play('dismount');
        const ps = iso(player.x, player.y, 22); ring = { x: ps.x, y: ps.y, born: performance.now() }; addFloat(t('buroFloatFoot'), pal.mutedText, ps.x, ps.y - 26);
    }
    /** Pausa/riprendi a comando dell'utente (ESC o pulsante): congela tutto e avvisa il componente. */
    function togglePause(): void {
        if (won || lost || introOpen || serveOpen || overlayOpen || welcomeOpen) return;   // niente pausa su pannelli o partita finita
        userPaused = !userPaused;
        if (userPaused) dropInputs();   // niente movimento residuo alla ripresa
        Sound.setPaused(userPaused);    // in pausa tace anche l'ambiente sonoro; alla ripresa torna
        hooks.onPause(userPaused);
    }

    // ---- flow ----
    function serve(oid: number): void {
        if (player.riding) player.riding = null;
        paused = true; serveOpen = true;
        const lunch = clockMin >= LUNCH_START && clockMin < LUNCH_END ? LUNCH_END - clockMin : 0;
        const qw = queueWait(clockMin + lunch), wait = lunch + qw.lo + randInt(qw.hi - qw.lo + 1);
        let next = '', cost: number; const lines: ServeLine[] = [];
        if (lunch) lines.push({ text: t('buroLunch'), tone: 'amber' });
        if (served.has(oid)) {
            cost = wait; queue.shift();
            lines.push({ text: t('buroAlreadyStamped'), tone: 'normal' });
            addFloat(t('buroFloatPass'), pal.mutedText, W / 2, H / 2 - 60);
            next = queue.length === 0 ? t('buroPraticaDone') : t('buroNextGoto', officeFull(queue[0]));
            if (queue.length === 0) winPending = true;
        } else {
            let ev = EVENTS[randInt(EVENTS.length)];
            if (ev.closed && closedCount >= 2) { do { ev = EVENTS[randInt(EVENTS.length)]; } while (ev.closed); }
            cost = wait + ev.m;
            lines.push({ text: t('buroClerk', officeClerk(oid)), tone: 'normal' });
            lines.push({ text: t('buroQueueInfo', qw.label), tone: 'muted' });
            lines.push({ text: t(`buroEvent${ev.idx}`), tone: 'normal' });
            if (ev.closed) { closedCount++; next = t('buroClosedMsg'); addFloat(t('buroFloatClosed'), pal.warning, W / 2, H / 2 - 60); Sound.play('closed'); }
            else if (served.size > 0 && bounceCount < 2 && !bounceFlag[oid] && Math.random() < (oid === 7 ? 0.5 : 0.25)) {
                bounceFlag[oid] = true; bounceCount++;
                const doneList = Array.from(served), back = doneList[randInt(doneList.length)];
                queue.unshift(back);
                lines.push({ text: oid === 7 ? t('buroCommissionBounce') : t(`buroBounce${randInt(4)}`), tone: 'red' });
                addFloat(t('buroFloatBounced'), pal.danger, W / 2, H / 2 - 60); next = t('buroNextBackFirst', officeFull(queue[0])); Sound.play('bounce');
            } else {
                stamps++; served.add(oid); queue.shift(); routeLog.push(oid);
                addFloat(t('buroFloatStamp', stamps, totalStamps), pal.success, W / 2, H / 2 - 60); Sound.play('stamp');
                if (oid === SPORTELLO) lines.push({ text: t('buroFinalStamp'), tone: 'gold' });
                if (ev.shortcut && queue.length > 1) { const sk = queue.shift()!; lines.push({ text: t('buroShortcut', officeShort(sk)), tone: 'green' }); Sound.play('shortcut'); }
                next = queue.length === 0 ? t('buroPraticaDone') : t('buroNextGoto', officeFull(queue[0]));
                if (queue.length === 0) winPending = true;
            }
        }
        clockMin += cost; queueMin += cost; hooks.onFlash(); emitClock();
        hooks.onServe({ office: officeFull(oid), lines, cost: t('buroCost', Math.round(cost), hhmm(clockMin)), next });
    }
    function dismissServe(): void {
        if (!serveOpen) return;
        serveOpen = false; hooks.onServe(null); paused = false;
        if (winPending) { endGame(true); return; }
        if (clockMin >= CLOSE_MIN) { endGame(false); return; }
        updatePrat();
    }
    function dismissWelcome(): void {
        if (!welcomeOpen) return;
        welcomeOpen = false; welcomeSeen = true; hooks.onWelcome(null);   // poi prosegue col tutorial (prima volta) o con la scelta pratica
    }
    function endGame(win: boolean): void {
        won = win; lost = !win; paused = true; overlayOpen = true; Sound.play(win ? 'win' : 'lose');
        const dur = (m: number): string => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`; };
        const giro = routeLog.length ? routeLog.map(id => officeShort(id)).join(' → ') : '—';
        const flav = win
            ? t('buroWinFlavor', t(`buroItem${item}`), stamps, totalStamps)
            : t('buroLoseFlavor', hhmm(clockMin), stamps, totalStamps) + (footMin > ridingMin ? t('buroLoseWalked') : '');
        hooks.onResult({
            won: win,
            title: win ? t('buroWinTitle') : t('buroLoseTitle'),
            time: hhmm(clockMin),
            flavor: flav,
            recap: [
                { label: t('buroRecapCars'), value: String(hops) },
                { label: t('buroRecapRiding'), value: dur(ridingMin) },
                { label: t('buroRecapFoot'), value: dur(footMin) },
                { label: t('buroRecapQueue'), value: dur(queueMin) },
            ],
            giro,
        });
    }

    // ---- update ----
    function emitAct(): void {
        const riding = !!player.riding;
        // Segnale ridondante al colore (a11y/daltonismo): un ✓ davanti all'azione quando l'auto
        // mirata ti avvicina allo sportello — stesso "buono" che sul canvas è solo verde.
        const good = !!aimTarget && tut >= 4 && carAdvances(aimTarget);
        const label = (good ? '✓ ' : '') + (riding ? t('buroSalta') : t('buroSali'));
        const dim = riding && !aimTarget;
        if (label !== lastActLabel || dim !== lastActDim || riding !== lastDismount) {
            lastActLabel = label; lastActDim = dim; lastDismount = riding;
            hooks.onAct(label, dim, riding ? t('buroAriaSalta') : t('buroAriaSali'), riding);
        }
    }
    function emitClock(force = false): void {
        const text = hhmm(clockMin);
        const warn = clockMin >= CLOSE_MIN - 180 && clockMin < CLOSE_MIN - 60, crit = clockMin >= CLOSE_MIN - 60;
        const tone: ClockTone = crit ? 'crit' : warn ? 'warn' : 'none';
        if (force || text !== lastClockText || tone !== lastClockTone) {
            lastClockText = text; lastClockTone = tone;
            hooks.onClock(text, tone, (clockMin / 60 % 12) / 12 * 360, (clockMin % 60) / 60 * 360);
        }
    }

    function update(dt: number): void {
        if (userPaused) return;   // pausa utente: tutto fermo (auto, orologio, player)
        cars.forEach(c => updateCar(c, dt)); resolveIntersections(); spaceCars();
        if (paused || won || lost) { aimTarget = pickBoardable(player ? player.riding : null); emitAct(); return; }
        let moved = false, footStep = 0;
        if (player.riding) { player.x = player.riding.x; player.y = player.riding.y; moved = true; }
        else {
            let wx = 0, wy = 0, mag = 0; const jm = Math.hypot(joyVec.x, joyVec.y);
            if (joyActive && jm > 0.12) { const gxd = joyVec.x + 2 * joyVec.y, gyd = 2 * joyVec.y - joyVec.x, m = Math.hypot(gxd, gyd) || 1; wx = gxd / m; wy = gyd / m; mag = Math.min(1, jm); }
            else { const vx = (held.E ? 1 : 0) - (held.W ? 1 : 0), vy = (held.S ? 1 : 0) - (held.N ? 1 : 0); if (vx || vy) { const m = Math.hypot(vx, vy); wx = vx / m; wy = vy / m; mag = 1; } }
            if (mag > 0) {
                const step = WALK_SPEED * mag * dt, ox = player.x, oy = player.y;
                let nx = clamp(ox + wx * step, 0, worldW); if (blocked(nx, oy)) nx = ox;
                let ny = clamp(oy + wy * step, 0, worldH); if (blocked(nx, ny)) ny = oy;
                const dd = Math.hypot(nx - ox, ny - oy); if (dd > 0) { player.x = nx; player.y = ny; movedDist += dd; moved = true; footStep = dd; walkDir = { x: wx, y: wy }; }
            }
        }
        const walking = footStep > 0 && !player.riding;
        walkAmt = walking ? Math.min(1, walkAmt + dt * 7) : Math.max(0, walkAmt - dt * 8);
        if (walking) walkPhase += footStep * 0.45;
        if (tut >= 4) {
            const d = dt * TIME_RATE; clockMin += d;
            if (moved) { if (player.riding) ridingMin += d; else footMin += d; }
            setCarCount(Math.round(desiredCars(clockMin) * perfScale));
            if (clockMin >= CLOSE_MIN) { endGame(false); emitClock(); return; }
        }
        camFollow(player.x, player.y, dt);
        // Convergenza continua verso la tua cella (anche mentre cavalchi, così appena scendi/salti
        // ne hai una pronta) — l'auto su cui sei è esclusa in updateCar.
        lure = nearestNode(player.x, player.y);
        if (tut < 4) {
            if (player.riding) rodeOnce = true;
            if (tut === 0 && (movedDist > 60 || player.riding)) { tut = player.riding ? 2 : 1; setCoach(tut); }
            else if (tut === 1 && player.riding) { tut = 2; setCoach(2); }
            else if (tut === 2 && rodeOnce && !player.riding) { tut = 3; setCoach(3); }
        }
        const cur = queue[0];
        if (cur != null) { const o = OFFICES[cur]; const inR = Math.hypot(player.x - o.dx, player.y - o.dy) < 46 || Math.hypot(player.x - gx(o.ix), player.y - gy(o.iy)) < 40; if (inR && !atCounter && tut >= 4) { atCounter = true; serve(cur); } if (!inR) atCounter = false; }
        // BFS verso lo sportello: ricalcola SOLO quando cambia l'ufficio obiettivo (prima era ogni frame → grosso spreco)
        if (cur != null && tut >= 4) { if (cur !== distGoalKey) { distGoal = bfsField({ ix: OFFICES[cur].ix, iy: OFFICES[cur].iy }); distGoalKey = cur; } }
        else if (distGoalKey !== -1) { distGoal = new Map(); distGoalKey = -1; }
        recalc -= dt;
        if (recalc <= 0) {
            recalc = 0.3; highlight = new Set(); routeNext = new Map();
            if (cur != null && tut >= 4) {
                let n = player.riding ? { ix: player.riding.ix, iy: player.riding.iy } : nearestNode(player.x, player.y);
                for (let g = 0; g < 400; g++) {
                    const dn = distGoal.get(kk(n.ix, n.iy)); if (dn == null || dn === 0) break;
                    let nx: GNode | null = null;
                    for (const d of DIR_LIST) { const nb = neighbor(n.ix, n.iy, d); if (nb && distGoal.get(kk(nb.ix, nb.iy)) === dn - 1) { nx = nb; break; } }
                    if (!nx) break; highlight.add(eKey(n, nx)); routeNext.set(kk(n.ix, n.iy), nx); n = nx;
                }
            }
        }
        aimTarget = pickBoardable(player.riding);
        emitClock(); emitAct();
    }

    // ---- render ----
    function diamond(x: number, y: number, s: number, l: number): void { const a = iso(x - s, y, l), b = iso(x, y - s, l), c = iso(x + s, y, l), d = iso(x, y + s, l); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); }
    function isoLine(a: Vec, b: Vec, w: number, col: string, lift = 0): void { const p = iso(a.x, a.y, lift), q = iso(b.x, b.y, lift); if (!onScreen(p, 80) && !onScreen(q, 80)) return; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    function poly(pts: Vec[], col: string): void { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); ctx.fill(); }
    // Ombreggiatura per-faccia con overlay traslucido invece di scurire il colore: così
    // box/boxR accettano QUALSIASI stringa colore CSS (rgb/oklch/var del tema), non solo hex.
    function face(pts: Vec[], col: string, dark: number): void { poly(pts, col); if (dark > 0) poly(pts, `rgba(0,0,0,${dark})`); }
    function box(cx: number, cy: number, s: number, h: number, col: string): void { const t0 = iso(cx - s, cy - s, h), t1 = iso(cx + s, cy - s, h), t2 = iso(cx + s, cy + s, h), t3 = iso(cx - s, cy + s, h), b1 = iso(cx + s, cy - s, 0), b2 = iso(cx + s, cy + s, 0), b3 = iso(cx - s, cy + s, 0); face([t1, t2, b2, b1], col, 0.4); face([t2, t3, b3, b2], col, 0.55); poly([t0, t1, t2, t3], col); }
    function boxR(cx: number, cy: number, hx: number, hy: number, z0: number, z1: number, col: string): void { const t0 = iso(cx - hx, cy - hy, z1), t1 = iso(cx + hx, cy - hy, z1), t2 = iso(cx + hx, cy + hy, z1), t3 = iso(cx - hx, cy + hy, z1), a1 = iso(cx + hx, cy - hy, z0), a2 = iso(cx + hx, cy + hy, z0), a3 = iso(cx - hx, cy + hy, z0); face([t1, t2, a2, a1], col, 0.4); face([t2, t3, a3, a2], col, 0.55); poly([t0, t1, t2, t3], col); }
    function drawCar(c: Car): void {
        const horiz = c.dir.x !== 0, hx = horiz ? 23 : 12, hy = horiz ? 12 : 23, cx = c.x, cy = c.y, sf = zoom / ZOOM_BASE;
        boxR(cx, cy, hx, hy, 0, 9, c.color);
        const cbx = cx - c.dir.x * hx * 0.12, cby = cy - c.dir.y * hy * 0.12;
        const chx = horiz ? hx * 0.52 : hx * 0.78, chy = horiz ? hy * 0.78 : hy * 0.52;
        boxR(cbx, cby, chx, chy, 9, 17, '#223647');
        const px = horiz ? 0 : 1, py = horiz ? 1 : 0, across = horiz ? hy : hx;
        const fx = cx + c.dir.x * hx * 0.96, fy = cy + c.dir.y * hy * 0.96;
        ctx.fillStyle = '#fff3c4';
        [-0.55, 0.55].forEach(s => { const p = iso(fx + px * across * s, fy + py * across * s, 6); ctx.beginPath(); ctx.ellipse(p.x, p.y, 3 * sf, 1.6 * sf, 0, 0, 7); ctx.fill(); });
        // l'indicatore di svolta (linea gialla sul lato) è disegnato nel pass overlay del render
    }
    function buildingDetails(b: Building, bcol: string): void {
        const s = b.s, h = b.h, cx = b.cx, cy = b.cy;
        if (h < 8) return;
        const rows = h >= 12 ? 2 : 1, cols = 2;
        const lit = 'rgba(255,216,150,0.85)', dk = 'rgba(12,18,28,0.5)';
        const P = (fc: 'R' | 'F', u: number, v: number): Vec => fc === 'R' ? iso(cx + s, cy - s + u * 2 * s, v * h) : iso(cx - s + u * 2 * s, cy + s, v * h);
        const wu = 0.26, wv = rows > 1 ? 0.26 : 0.42;
        for (const fc of ['R', 'F'] as const) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const u0 = 0.18 + c * 0.40, v0 = 0.18 + r * (0.62 / rows);
            const on = ((b.seed >> (r * 3 + c + (fc === 'F' ? 5 : 0))) & 1) === 1;
            poly([P(fc, u0, v0 + wv), P(fc, u0 + wu, v0 + wv), P(fc, u0 + wu, v0), P(fc, u0, v0)], on ? lit : dk);
        }
        // volume tecnico sul tetto: stesso colore dell'edificio, leggermente scurito a overlay.
        if (h >= 12) { boxR(cx + s * 0.22, cy + s * 0.1, s * 0.22, s * 0.22, h, h + Math.min(9, s * 0.32), bcol); }
    }
    function drawProp(p: Prop): void {
        if (p.kind === 'tree') {
            const sd = p.seed, h = 8 + (sd & 3);
            boxR(p.x, p.y, 2.4, 2.4, 0, h, vis('#4a3526'));
            const tiers = [{ r: 11 + (sd & 3), z0: h - 1, z1: h + 12, lo: vis('#1c5230'), hi: vis('#2c763f') }, { r: 7 + ((sd >> 2) & 3), z0: h + 8, z1: h + 21 + ((sd >> 4) & 5), lo: vis('#236439'), hi: vis('#36864c') }];
            const K = 7;
            for (const ti of tiers) {
                const apex = iso(p.x, p.y, ti.z1), pts: Vec[] = [];
                for (let k = 0; k < K; k++) { const a = (k / K) * 6.283 + (sd & 7) * 0.1; const jag = (k % 2 === 0 ? 1 : 0.5) * (0.82 + ((sd >> (k % 12)) & 3) * 0.12), rr = ti.r * jag; pts.push(iso(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, ti.z0)); }
                for (let k = 0; k < K; k++) poly([apex, pts[k], pts[(k + 1) % K]], k % 2 === 0 ? ti.hi : ti.lo);
            }
        } else if (p.kind === 'lamp') {
            boxR(p.x, p.y, 1.6, 1.6, 0, 30, vis('#39424f'));
            const hp = iso(p.x, p.y, 33), sf = zoom / ZOOM_BASE;
            ctx.globalAlpha = 0.22; ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.ellipse(hp.x, hp.y, 11 * sf, 5.5 * sf, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffe7a6'; ctx.beginPath(); ctx.ellipse(hp.x, hp.y, 4 * sf, 2.2 * sf, 0, 0, 7); ctx.fill();
        } else {
            const sf = zoom / ZOOM_BASE;
            ctx.fillStyle = vis('#24502c'); diamond(p.x, p.y, 12, 0); ctx.fill();
            const fc = ['#E5736B', '#E7C04A', '#D98AD0', '#7FB3E5'];
            for (let k = 0; k < 4; k++) { const a = ((p.seed >> (k * 3)) & 7) / 8 * 6.283, rr = 5 + ((p.seed >> (k + 9)) & 3); const fp = iso(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 1); ctx.fillStyle = fc[k]; ctx.beginPath(); ctx.ellipse(fp.x, fp.y, 2.4 * sf, 1.4 * sf, 0, 0, 7); ctx.fill(); }
        }
    }
    function drawFloats(): void {
        const now = performance.now(); floats = floats.filter(f => now - f.born < 1300);
        const fs = Math.max(20, Math.round(W * 0.030)); ctx.textAlign = 'center'; ctx.font = `bold ${fs}px ui-sans-serif`; ctx.lineJoin = 'round';
        floats.forEach(f => { const k = (now - f.born) / 1300, y = f.y - k * 46; ctx.globalAlpha = Math.min(1, (1 - k) * 1.4); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(6,9,15,.85)'; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y); }); ctx.globalAlpha = 1;
    }
    function drawRing(): void { if (!ring) return; const now = performance.now(), k = (now - ring.born) / 430; if (k >= 1) { ring = null; return; } ctx.globalAlpha = 1 - k; ctx.strokeStyle = pal.info; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ring.x, ring.y, 9 + k * 28, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }

    const sprites: Sprite[] = [];
    function render(): void {
        ctx.fillStyle = pal.void; ctx.fillRect(0, 0, W, H);
        // Look mappa isometrica: isolati verdi, poi una banda marciapiede (spazio pedonale) e
        // l'asfalto scuro al centro del corridoio stradale. Verde un filo più stretto del mezzo-cella
        // per lasciare il corridoio (marciapiede+asfalto).
        ctx.fillStyle = pal.ground;
        for (let i = 0; i < lastX; i++) for (let j = 0; j < lastY; j++) { const c = iso(gx(i) + CELL / 2, gy(j) + CELL / 2, 0); if (onScreen(c, CELL)) { diamond(gx(i) + CELL / 2, gy(j) + CELL / 2, CELL / 2 - 44, 0); ctx.fill(); } }
        const RW = Math.max(24, 2 * ROAD_HALF * zoom);           // asfalto largo quanto serve a coprire TUTTE le corsie (le auto restano sull'asfalto)
        const BAND = RW + 2 * SIDEWALK_W * zoom;                 // + marciapiedi ai lati
        edgeArr.forEach(([a, b]) => isoLine({ x: gx(a.ix), y: gy(a.iy) }, { x: gx(b.ix), y: gy(b.iy) }, BAND, pal.sidewalk));
        edgeArr.forEach(([a, b]) => isoLine({ x: gx(a.ix), y: gy(a.iy) }, { x: gx(b.ix), y: gy(b.iy) }, RW, pal.road));
        // Isole delle mini-rotonde: cordolo + verde al centro del nodo (sotto auto e sprite).
        roundabouts.forEach(key => {
            const [ix, iy] = key.split(',').map(Number);
            const c = iso(gx(ix), gy(iy), 0); if (!onScreen(c, 80)) return;
            const rx = RB_ISLAND * zoom, ry = rx * 0.5;
            ctx.fillStyle = pal.sidewalk; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, 7); ctx.fill();
            ctx.fillStyle = vis('#24502c'); ctx.beginPath(); ctx.ellipse(c.x, c.y, rx * 0.68, ry * 0.68, 0, 0, 7); ctx.fill();
        });
        const MARK = 'rgba(255,255,255,0.85)';
        // Mezzeria: linea bianca SOTTILE e TRATTEGGIATA al centro della carreggiata, accorciata agli
        // estremi così non invade gli incroci. Tratteggio + sottigliezza evitano il groviglio di righe
        // nelle curve e nei crocevia (dove prima i segmenti continui si accavallavano). Sotto auto/sprite.
        const sf0 = zoom / ZOOM_BASE;
        ctx.save();
        ctx.strokeStyle = MARK; ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(1.4, RW * 0.028); ctx.setLineDash([13 * sf0, 12 * sf0]);
        edgeArr.forEach(([a, b]) => {
            const p = iso(gx(a.ix), gy(a.iy)), q = iso(gx(b.ix), gy(b.iy));
            if (!onScreen(p, 80) && !onScreen(q, 80)) return;
            let dx = q.x - p.x, dy = q.y - p.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
            const inset = Math.min(L * 0.5 - 1, RW * 0.62);   // ferma il tratteggio prima del quadrato dell'incrocio
            ctx.beginPath(); ctx.moveTo(p.x + dx * inset, p.y + dy * inset); ctx.lineTo(q.x - dx * inset, q.y - dy * inset); ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.restore();
        // Percorso/indicazioni in giallo SEMI-TRASPARENTE: guida l'occhio ma lascia leggere strada e mezzeria sotto.
        ctx.save();
        ctx.globalAlpha = 0.5;
        edgeArr.forEach(([a, b]) => { if (highlight.has(eKey(a, b))) isoLine({ x: gx(a.ix), y: gy(a.iy) }, { x: gx(b.ix), y: gy(b.iy) }, RW * 0.66, pal.warning); });
        const cur = queue[0];
        if (cur != null && tut >= 4) isoLine({ x: gx(OFFICES[cur].ix), y: gy(OFFICES[cur].iy) }, { x: OFFICES[cur].dx, y: OFFICES[cur].dy }, RW * 0.66, pal.warning);
        ctx.restore();
        if (cur != null && tut >= 4) {
            const o = OFFICES[cur];
            const r = iso(o.dx, o.dy, 0); if (onScreen(r, 60)) { const sf = zoom / ZOOM_BASE, pulse = (27 + wob(Math.sin(performance.now() / 250) * 4)) * sf; ctx.strokeStyle = pal.info; ctx.lineWidth = 3 * sf; ctx.beginPath(); ctx.ellipse(r.x, r.y, pulse, pulse * 0.5, 0, 0, 7); ctx.stroke(); }
        }

        // Ombre a terra: solo uffici (procedurali), lampioni e player. Palazzi/auto/alberi
        // sono sprite con l'ombra già cotta dentro — qui le ridisegneremmo doppie.
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        OFFICES.forEach(o => { const c = iso(o.bx, o.by, 0); if (onScreen(c, 60)) { diamond(o.bx, o.by, 18, 0); ctx.fill(); } });
        props.forEach(p => { if (p.kind !== 'lamp') return; const q = iso(p.x, p.y, 0); if (onScreen(q, 30)) { diamond(p.x, p.y, 3, 0); ctx.fill(); } });
        diamond(player.x, player.y, 11, 0); ctx.fill();

        const tgt = aimTarget, word = player.riding ? t('buroSalta') : t('buroSali');
        const good = !!tgt && tut >= 4 && carAdvances(tgt);
        const wordLabel = good ? '✓ ' + word : word;   // ✓ ridondante al verde (a11y/daltonismo)
        const stroke = good ? pal.success : (tut >= 4 ? pal.warning : pal.info);
        const fill = stroke;

        sprites.length = 0;
        OFFICES.forEach((o, id) => { const p = iso(o.bx, o.by, 0); if (onScreen(p, 80)) sprites.push({ k: o.bx + o.by, kind: 'office', o, id }); });
        { const hp = iso(HOME.bx, HOME.by, 0); if (onScreen(hp, 100)) sprites.push({ k: HOME.bx + HOME.by, kind: 'home' }); }
        cars.forEach(c => { const p = iso(c.x, c.y, 0); if (onScreen(p, 60)) sprites.push({ k: c.x + c.y, kind: 'car', o: c }); });
        buildings.forEach(b => { const p = iso(b.cx, b.cy, 0); if (onScreen(p, b.s + CELL)) sprites.push({ k: b.cx + b.cy, kind: 'build', b }); });
        props.forEach(p => { const q = iso(p.x, p.y, 0); if (onScreen(q, 40)) sprites.push({ k: p.x + p.y, kind: 'prop', p }); });
        sprites.push({ k: player.x + player.y + (player.riding ? 0.5 : 0), kind: 'player' });
        sprites.sort((a, b) => a.k - b.k);
        for (const sp of sprites) {
            if (sp.kind === 'car') {
                const c = sp.o, p = iso(c.x, c.y, 0);
                if (!blitBaked(getCarSprite(BURO_CAR_TYPES[c.ti], carDir(c), c.ci), p.x, p.y, CAR_SCALE)) drawCar(c);   // fallback finché lo sprite carica/tinge
            }
            else if (sp.kind === 'prop') {
                const p = sp.p;
                if (p.kind === 'tree') { const s = iso(p.x, p.y, 0); if (!blit(treeSpriteId(p.seed), s.x, s.y)) drawProp(p); }
                else drawProp(p);                                                  // lampioni/aiuole restano vettoriali
            }
            else if (sp.kind === 'build') { const b = sp.b, p = iso(b.cx, b.cy, 0); const sc = Math.min(BUILDING_SCALE, BUILDING_FOOT_CAP / b.s); if (!blit(buildingSpriteId(b), p.x, p.y, sc)) { const bcol = pal.buildings[b.colIdx]; box(b.cx, b.cy, b.s * sc, b.h * sc, bcol); buildingDetails(b, bcol); } }
            else if (sp.kind === 'home') {
                const hp = iso(HOME.bx, HOME.by, 0);
                const hsc = Math.min(BUILDING_SCALE, BUILDING_FOOT_CAP / (BURO_SPRITE_META[BURO_HOME]?.foot ?? 30));
                if (!blit(BURO_HOME, hp.x, hp.y, hsc)) {
                    const cx = HOME.bx, cy = HOME.by, s = 20, h = 22, rh = 15;
                    box(cx, cy, s, h, vis('#C2703B'));
                    const ap = iso(cx, cy, h + rh), t0 = iso(cx - s, cy - s, h), t1 = iso(cx + s, cy - s, h), t2 = iso(cx + s, cy + s, h), t3 = iso(cx - s, cy + s, h);
                    poly([ap, t0, t1], '#5F231A'); poly([ap, t1, t2], '#9B3A2A'); poly([ap, t2, t3], '#7E2F22'); poly([ap, t3, t0], '#5F231A');
                }
            }
            else if (sp.kind === 'office') { const o = sp.o, id = sp.id, isCur = id === cur, done = served.has(id); const col = isCur ? pal.info : done ? pal.surfaceDone : (id === SPORTELLO ? pal.warning : pal.surfaceOffice); const h = isCur ? 52 : 34; box(o.bx, o.by, 20, h, col); }
            else {
                let px = player.x, py = player.y, base = player.riding ? 16 : 0, airborne = false;
                if (jumpAnim) {
                    const k = (performance.now() - jumpAnim.born) / (jumpAnim.dur * 1000);
                    if (k >= 1) { jumpAnim = null; }
                    else { px = jumpAnim.fx + (player.x - jumpAnim.fx) * k; py = jumpAnim.fy + (player.y - jumpAnim.fy) * k; base = jumpAnim.fromBase + (jumpAnim.toBase - jumpAnim.fromBase) * k + Math.sin(k * Math.PI) * 26; airborne = true; }
                }
                const bob = (player.riding && !airborne) ? 0 : Math.abs(Math.sin(walkPhase)) * 1.5 * walkAmt;
                // ombra a terra: procedurale (resta sul suolo anche quando salti/cavalchi → lo sprite avatar non la cuoce)
                if (!player.riding || airborne) { const g = iso(px, py, 0), sf = zoom / ZOOM_BASE; ctx.fillStyle = 'rgba(0,0,0,.40)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, 11 * sf, 5.5 * sf, 0, 0, 7); ctx.fill(); }
                // sprite "impiegato": posa seduta se cavalca, altrimenti i due frame di camminata alternati sul passo
                const pid = (player.riding && !airborne) ? BURO_PLAYER.ride
                    : (walkAmt > 0.2 && Math.floor(walkPhase * 0.3) % 2 === 0) ? BURO_PLAYER.walkB : BURO_PLAYER.walkA;
                const gp = iso(px, py, base + bob);
                if (!blit(pid, gp.x, gp.y)) {                                       // fallback vettoriale finché lo sprite carica
                    const sw = Math.sin(walkPhase) * 3.4 * walkAmt;
                    if (player.riding || airborne) { boxR(px, py, 4, 4.5, base, base + 9, '#26405a'); }
                    else { boxR(px + walkDir.x * sw, py + walkDir.y * sw, 2.5, 2.7, base, base + 9, '#2a4660'); boxR(px - walkDir.x * sw, py - walkDir.y * sw, 2.5, 2.7, base, base + 9, '#22384e'); }
                    boxR(px, py, 5, 5, base + 9 + bob, base + 20 + bob, '#1f9e8c');
                    boxR(px, py, 3.4, 3.4, base + 20 + bob, base + 27 + bob, '#46d8c1');
                    boxR(px + 7, py + 3, 2.6, 2, base + 5 + bob, base + 12 + bob, '#caa23f');
                }
            }
        }

        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
        const labelStroke = 'rgba(6,9,15,.85)';   // alone scuro dietro alle scritte: leggibili su mappa chiara o scura
        OFFICES.forEach((o, id) => {
            const p = iso(o.bx, o.by, 0); if (!onScreen(p, 80)) return;
            const isCur = id === cur, done = served.has(id), h = isCur ? 52 : 34, top = iso(o.bx, o.by, h);
            const label = (done ? '✓ ' : '') + officeShort(id);
            const tcol = isCur ? pal.info : done ? pal.mutedText : (id === SPORTELLO ? pal.warning : pal.mutedText);
            ctx.font = isCur ? 'bold 13px ui-sans-serif' : '600 11px ui-sans-serif';
            ctx.lineWidth = 4; ctx.strokeStyle = labelStroke; ctx.strokeText(label, top.x, top.y - 8);
            ctx.fillStyle = tcol; ctx.fillText(label, top.x, top.y - 8);
        });
        { const hp = iso(HOME.bx, HOME.by, 0); if (onScreen(hp, 100)) { const ap = iso(HOME.bx, HOME.by, 37); ctx.font = 'bold 12px ui-sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = labelStroke; ctx.strokeText(t('buroLabelHome'), ap.x, ap.y - 5); ctx.fillStyle = pal.warning; ctx.fillText(t('buroLabelHome'), ap.x, ap.y - 5); } }

        if (tgt) {
            const tnow = performance.now() / 300;
            const from = iso(player.x, player.y, player.riding ? 22 : 16), to = iso(tgt.x, tgt.y, 14);
            const mx = (from.x + to.x) / 2, my = Math.min(from.y, to.y) - 38;
            ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.setLineDash([9, 8]); ctx.lineDashOffset = reduceMotion ? 0 : -tnow * 6;
            ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo(mx, my, to.x, to.y); ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
            const ang = Math.atan2(to.y - my, to.x - mx);
            ctx.save(); ctx.translate(to.x, to.y); ctx.rotate(ang);
            ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-13, -7); ctx.lineTo(-13, 7); ctx.closePath();
            if (good || tut < 4) { ctx.fillStyle = stroke; ctx.fill(); } else { ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke(); }
            ctx.restore();
            const lp = iso(tgt.x, tgt.y, 40);
            ctx.font = 'bold 13px ui-sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(6,9,15,.8)'; ctx.strokeText(wordLabel, lp.x, lp.y - 10);
            ctx.fillStyle = fill; ctx.fillText(wordLabel, lp.x, lp.y - 10);
        }
        if (player.riding && tut >= 4 && !carAdvances(player.riding)) {
            const hp = iso(player.x, player.y, 58), b = 3 + wob(Math.sin(performance.now() / 220) * 2);
            ctx.fillStyle = pal.warning; ctx.beginPath(); ctx.moveTo(hp.x - 8, hp.y - b); ctx.lineTo(hp.x + 8, hp.y - b); ctx.lineTo(hp.x, hp.y + 6 - b); ctx.closePath(); ctx.fill();
            ctx.font = 'bold 11px ui-sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(6,9,15,.8)'; ctx.strokeText(t('buroLabelOffRoute'), hp.x, hp.y - 14);
            ctx.fillStyle = pal.warning; ctx.fillText(t('buroLabelOffRoute'), hp.x, hp.y - 14);
        }

        // Preavviso di SVOLTA = la "freccia" (indicatore di direzione) dell'auto: una linea GIALLA
        // lampeggiante lungo TUTTO il lato verso cui sta per girare — si legge a colpo d'occhio, anche
        // dietro un palazzo. Solo auto su cui sei / candidata / vicine; auto dritte o lontane: niente.
        if (flash(280)) {
            const sf = zoom / ZOOM_BASE, NEAR2 = ARROW_NEAR * ARROW_NEAR;
            ctx.save(); ctx.lineCap = 'round';
            for (const c of cars) {
                let pd: Dir | null = null;
                if (c.pending && c.pending !== c.dir) pd = c.pending;
                else if (c.pdir !== c.dir && c.pdir !== rev(c.dir) && c.prog < TURN_SMOOTH) pd = rev(c.pdir);

                if (!pd) continue;
                if (c !== player.riding && c !== aimTarget) {
                    const dx = c.x - player.x, dy = c.y - player.y;
                    if (dx * dx + dy * dy > NEAR2) continue;            // solo auto a tiro di salto
                }
                if (!onScreen(iso(c.x, c.y, 0), 60)) continue;
                const horiz = c.dir.x !== 0, hx = horiz ? 23 : 12, hy = horiz ? 12 : 23;
                let e1: Vec, e2: Vec;
                if (horiz) { const sy = c.y + pd.y * hy; e1 = iso(c.x - hx, sy, 9); e2 = iso(c.x + hx, sy, 9); }
                else { const sx = c.x + pd.x * hx; e1 = iso(sx, c.y - hy, 9); e2 = iso(sx, c.y + hy, 9); }
                ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(6,9,15,.7)'; ctx.lineWidth = 7 * sf;     // contorno scuro per leggibilità
                ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
                ctx.shadowColor = (reduceMotion || lite) ? 'transparent' : '#FFC83A'; ctx.shadowBlur = (reduceMotion || lite) ? 0 : 11 * sf;
                ctx.strokeStyle = '#FFC83A'; ctx.lineWidth = 4.5 * sf;          // giallo "freccia" sul lato di svolta
                ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
            }
            ctx.restore();
        }

        // Bussola: se lo sportello corrente è fuori schermo, una freccia sul bordo punta verso di esso.
        if (cur != null && tut >= 4) {
            const o = OFFICES[cur], tp = iso(o.dx, o.dy, 0);
            if (tp.x < 40 || tp.x > W - 40 || tp.y < 104 || tp.y > H - 40) {
                const cx = W / 2, cy = H / 2 + 20;
                let dx = tp.x - cx, dy = tp.y - cy; const dd = Math.hypot(dx, dy) || 1; dx /= dd; dy /= dd;
                const halfW = W / 2 - 34, halfH = (H - 138) / 2;
                const tt = Math.min(halfW / Math.max(Math.abs(dx), 1e-3), halfH / Math.max(Math.abs(dy), 1e-3));
                const ax = cx + dx * tt, ay = cy + dy * tt;
                ctx.fillStyle = 'rgba(6,9,15,.5)'; ctx.beginPath(); ctx.arc(ax, ay, 16, 0, 7); ctx.fill();
                ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(dy, dx));
                ctx.fillStyle = pal.info; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
        }

        // Beacon del giocatore: marcatore bianco SEMPRE in cima sopra l'avatar, così non lo perdi mai
        // dietro i palazzi (bianco = distinto dalle frecce gialle delle auto).
        {
            const bob = wob(Math.sin(performance.now() / 320) * 2);
            const bp = iso(player.x, player.y, (player.riding ? 44 : 32) + bob);
            ctx.fillStyle = 'rgba(6,9,15,.55)'; ctx.beginPath(); ctx.ellipse(bp.x, bp.y - 5, 8, 4.5, 0, 0, 7); ctx.fill();
            ctx.fillStyle = '#eef4ff'; ctx.strokeStyle = 'rgba(6,9,15,.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(bp.x - 7, bp.y - 12); ctx.lineTo(bp.x + 7, bp.y - 12); ctx.lineTo(bp.x, bp.y - 1); ctx.closePath();
            ctx.fill(); ctx.stroke();
        }

        drawRing(); drawFloats();
    }

    // ---- loop ----
    let last = performance.now(); let rafId = 0; let disposed = false, prevCrit = false;
    // Qualità adattiva: misura il tempo-frame (EMA) e, se il device resta sotto ~33fps per qualche secondo
    // (dopo un warmup che ignora il caricamento/bake degli sprite), passa in "lite" UNA volta — meno auto +
    // niente effetti costosi (shadowBlur) — e avvisa l'utente. Gli spike isolati (cambio tab, GC) sono ignorati.
    // FUTURO: questo monitor di qualità adattiva è generico (qualsiasi pagina canvas lo vorrebbe) → andrebbe
    // promosso a utility del padre (Br1WebEngine) e tolto da qui quando disponibile.
    let frameEMA = 16, warmupMs = 0, slowMs = 0;
    function frame(now: number): void {
        if (disposed) return;
        const raw = now - last;
        // Auto-riparazione: se una race SSR/hydration ha lasciato il canvas non dimensionato
        // (stage cresciuto ma ResizeObserver non scattato), ridimensiona qui invece di disegnare nel nulla.
        if (stageEl.clientWidth !== W || stageEl.clientHeight !== H) setupCanvas();
        const dt = Math.min(0.05, raw / 1000); last = now; update(dt); render();
        const frameMs = raw > 120 ? frameEMA : raw;   // ignora spike isolati (tab nascosta/GC)
        frameEMA += (frameMs - frameEMA) * 0.08; warmupMs += frameMs;
        if (!lite && warmupMs > 2500) {                // valuta solo dopo il warmup di caricamento
            if (frameEMA > TUNING.perfSlowMs) slowMs += frameMs; else slowMs = Math.max(0, slowMs - frameMs * 2);
            if (slowMs > TUNING.perfSustainMs) { lite = true; perfScale = TUNING.perfLiteScale; setCarCount(Math.round(desiredCars(clockMin) * perfScale)); hooks.onPerfNotice(); }
        }
        const crit = clockMin >= CLOSE_MIN - 60;
        if (crit && !prevCrit && !won && !lost) Sound.play('warn');   // tocco sonoro all'ultima ora
        prevCrit = crit;
        rafId = requestAnimationFrame(frame);
    }

    // ---- input pubblico ----
    const MOVE: Record<string, string> = { KeyW: 'N', KeyS: 'S', KeyA: 'W', KeyD: 'E', ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' };
    const pressed = new Set<string>();
    function syncHeld(): void {
        held.N = pressed.has('KeyW') || pressed.has('ArrowUp');
        held.S = pressed.has('KeyS') || pressed.has('ArrowDown');
        held.W = pressed.has('KeyA') || pressed.has('ArrowLeft');
        held.E = pressed.has('KeyD') || pressed.has('ArrowRight');
    }
    function dropInputs(): void { pressed.clear(); syncHeld(); joyActive = false; joyVec.x = 0; joyVec.y = 0; }

    // avvio
    setupCanvas(); reset(); rafId = requestAnimationFrame(frame);

    return {
        resize: () => setupCanvas(),
        setPalette: (p: Palette) => { pal = p; visCache.clear(); },   // i colori "visibili" dei prop dipendono dal terreno → ricalcolo al cambio tema
        setReduceMotion: (v: boolean) => { reduceMotion = v; },
        zoomBy: (factor: number) => { zoom = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX); hooks.onZoom(zoom); },
        doAction: () => { Sound.unlock(); doAction(); },
        doDismount: () => { Sound.unlock(); doDismount(); },
        confirmStart: () => { Sound.unlock(); if (tut === 3) openIntro(); },
        choosePratica: (i: number) => { Sound.unlock(); choosePratica(i); },
        dismissServe,
        dismissWelcome: () => { Sound.unlock(); dismissWelcome(); },
        restart: () => reset(),
        keydown: (e: KeyboardEvent) => {
            if (e.code === 'Escape') { e.preventDefault(); Sound.unlock(); if (!userPaused) togglePause(); return; }   // ESC METTE in pausa; la ripresa la guida il dialogo (niente doppio-toggle)
            if (welcomeOpen || introOpen || serveOpen || overlayOpen || userPaused) return;
            Sound.unlock();   // l'audio si sblocca al primo gesto (regola mobile)
            if (e.code === 'Space') { e.preventDefault(); if (tut === 3) openIntro(); else doAction(); return; }   // NB: Tab NON è azione → resta libero per la navigazione da tastiera (a11y)
            if (e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); doDismount(); return; }
            if (MOVE[e.code]) { pressed.add(e.code); syncHeld(); e.preventDefault(); }
        },
        keyup: (e: KeyboardEvent) => { if (pressed.delete(e.code)) syncHeld(); },
        setJoy: (x: number, y: number) => { Sound.unlock(); joyActive = true; joyVec.x = x; joyVec.y = y; },
        clearJoy: () => { joyActive = false; joyVec.x = 0; joyVec.y = 0; },
        toggleMute: () => Sound.toggle(),
        isMuted: () => Sound.isMuted(),
        togglePause: () => { Sound.unlock(); togglePause(); },
        dropInputs,
        dispose: () => { disposed = true; if (rafId) cancelAnimationFrame(rafId); Sound.dispose(); },
    };
}
