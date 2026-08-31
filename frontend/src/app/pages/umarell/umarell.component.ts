import { afterNextRender, Component, computed, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { CookieConsentService } from '../../core/engine/services/cookie-consent.service';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';

/** Chiavi degli SFX in `mapping.json` (id `umarell.sfx.*`): richiesti i file reali sotto
 *  `assets/files/umarell/sfx/` (vedi NOTE.txt in quella cartella) — finché mancano, `playAudio`
 *  fallisce silenziosamente (stesso pattern di `duce-non-duce` / `burocrazia`). Dieci critiche
 *  diverse pescate a caso a ogni colpo riuscito, più il verso di "occasione persa". */
const SFX_IDS = {
    ferro: 'umarell.sfx.ferro',
    livella: 'umarell.sfx.livella',
    gettata: 'umarell.sfx.gettata',
    cemento: 'umarell.sfx.cemento',
    impalcatura: 'umarell.sfx.impalcatura',
    orario: 'umarell.sfx.orario',
    sicurezza: 'umarell.sfx.sicurezza',
    rumore: 'umarell.sfx.rumore',
    polvere: 'umarell.sfx.polvere',
    sindacato: 'umarell.sfx.sindacato',
    fail: 'umarell.sfx.fail',
} as const;

type SfxKey = keyof typeof SFX_IDS;

/** Frasi da criticare pescate a caso a ogni colpo riuscito (tutte tranne "fail"). */
const QUOTES: SfxKey[] = [
    'ferro', 'livella', 'gettata', 'cemento', 'impalcatura',
    'orario', 'sicurezza', 'rumore', 'polvere', 'sindacato',
];

/** Tempo di percorrenza della corsia (spawn → fine), in ms: fisso, condiviso con l'animazione
 *  CSS (`.umarell-note`, bindata su questa stessa costante) così JS e animazione restano sincroni. */
const TRAVEL_MS = 2400;

/** Quanto prima della fine reale dell'audio (critica o fallimento) compare già la nota successiva,
 *  mentre la battuta sta ancora suonando: dà il senso di urgenza tipico di un rhythm game (l'audio
 *  sta per finire, meglio prepararsi) invece di un buco morto fra una battuta e l'altra. Basato
 *  sulla durata reale di ogni singola battuta (`audio.duration`) — aggiungere nuove battute non
 *  richiede ricalibrare nulla. */
const NOTE_LEAD_MS = 1000;

/** Ritardo di fallback se la durata dell'audio non è ancora nota (metadata non caricati, o asset
 *  mancante): via di mezzo ragionevole, né istantanea né troppo lunga. */
const FALLBACK_NOTE_DELAY_MS = 2000;

/** Zona di critica sulla corsia (percentuale), stessa geometria della fascia gialla in CSS. */
const SWEET_CENTER = 82.5;
const GOOD_MIN = 70;
const GOOD_MAX = 95;
const PERFECT_HALF = 3.5;

/** Mattoni guadagnati per colpo: la critica perfetta ne vale il doppio di una buona. */
const BRICKS_PER_PERFECT = 2;
const BRICKS_PER_GOOD = 1;

/** Griglia del muro nella scena (stesse coordinate dell'SVG in umarell.component.html): 5
 *  colonne × 6 righe, riempite dal basso verso l'alto, sinistra→destra per riga. Un edificio
 *  completo = 30 mattoni: raggiunto il tetto il turno finisce da solo (schermata di riepilogo),
 *  niente più ciclo infinito — coerente col numero di battute vocali disponibili (una decina), che
 *  altrimenti si sentirebbero ripetere troppe volte in una sessione. Mattoni "appiccicati" (nessuna
 *  fuga fra loro, il passo della griglia è il lato del mattone): dimensione raddoppiata rispetto
 *  alla texture nativa così ogni colpo si vede subito sul muro. */
const WALL_COLS = 5;
const WALL_ROWS = 6;
const WALL_X = 32;
const WALL_BOTTOM_Y = 39;
/** Passo della griglia = lato del mattone: nessuna fuga, i mattoni sono "appiccicati" fra loro. */
const PITCH = 4;
const TOTAL_BRICKS = WALL_COLS * WALL_ROWS;

interface Note {
    readonly id: number;
    readonly spawnMs: number;
}

interface BrickCell {
    readonly x: number;
    readonly y: number;
}

/** Riepilogo mostrato a edificio completato. */
interface TurnResult {
    readonly peakCombo: number;
    readonly errors: number;
    readonly seconds: number;
}

/** Record personali persistiti (cookie `umarellRecord`, JSON come `duceNonDuceRecord`): i mattoni
 *  non hanno più senso come record dato che sono sempre 30 a edificio completato (vedi
 *  `TOTAL_BRICKS`) — quello che varia da un turno all'altro è quanto sei stato bravo a ottenerli. */
interface RecordStats {
    combo: number | null;
    errors: number | null;
    seconds: number | null;
}

/** Griglia di posizioni (fissa, calcolata una volta): ordine di posa bottom-up, riga per riga. */
const WALL_GRID: BrickCell[] = (() => {
    const cells: BrickCell[] = [];
    for (let r = 0; r < WALL_ROWS; r++) {
        for (let c = 0; c < WALL_COLS; c++) {
            cells.push({ x: WALL_X + c * PITCH, y: WALL_BOTTOM_Y - r * PITCH });
        }
    }
    return cells;
})();

@Component({
    selector: 'app-umarell',
    standalone: true,
    templateUrl: './umarell.component.html',
    styleUrl: './umarell.component.css',
})
export class UmarellComponent extends PageBaseComponent<void> implements OnDestroy {
    private readonly cookies = inject(CookieConsentService);

    /** Costante esposta al template per bindare la durata dell'animazione CSS delle note. */
    protected readonly travelMs = TRAVEL_MS;
    /** Costante esposta al template per la schermata di riepilogo ("hai posato tutti e N i mattoni"). */
    protected readonly totalBricks = TOTAL_BRICKS;

    readonly gameStarted = signal(false);
    /** I punti SONO i mattoni posati: cresce a ogni colpo a tempo, il muro nella scena lo mostra;
     *  non supera mai `totalBricks` — al tetto il turno finisce (vedi `completeBuilding`). */
    readonly bricks = signal(0);
    readonly combo = signal(0);
    /** Combo più alta raggiunta nel turno corrente: mostrata nel riepilogo di fine edificio. */
    readonly peakCombo = signal(0);
    /** Errori commessi nel turno corrente (nota scaduta o colpo fuori zona). */
    readonly errors = signal(0);
    readonly feedback = signal<string | null>(null);
    /** Record personali (combo massima, errori minimi, tempo migliore): aggiornati indipendentemente
     *  l'uno dall'altro a ogni edificio completato, non "tutti insieme sullo stesso turno". */
    readonly recordCombo = signal<number | null>(null);
    readonly recordErrors = signal<number | null>(null);
    readonly recordSeconds = signal<number | null>(null);
    readonly notes = signal<Note[]>([]);
    /** Non-null solo dopo un edificio completato (30/30): innesca la schermata di riepilogo al
     *  posto della normale schermata iniziale. */
    readonly turnResult = signal<TurnResult | null>(null);

    /** Celle da disegnare nella scena, nell'ordine di posa. */
    readonly visibleBricks = computed<BrickCell[]>(() => WALL_GRID.slice(0, this.bricks()));

    /** Precaricato lato browser in afterNextRender (Audio non esiste in SSR). */
    private readonly audioPool: Partial<Record<SfxKey, HTMLAudioElement>> = {};

    private nextNoteId = 0;
    private beatTimer: ReturnType<typeof setTimeout> | null = null;
    private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
    /** Istante di inizio turno (`performance.now()`), per calcolare il tempo impiegato a riepilogo. */
    private turnStartMs = 0;

    constructor() {
        super();
        afterNextRender(() => {
            for (const key of Object.keys(SFX_IDS) as SfxKey[]) {
                const audio = new Audio(this.asset.getUrl(SFX_IDS[key]));
                audio.preload = 'auto';
                this.audioPool[key] = audio;
            }
            const saved = this.cookies.get('umarellRecord');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved) as Partial<RecordStats>;
                    if (typeof parsed.combo === 'number') this.recordCombo.set(parsed.combo);
                    if (typeof parsed.errors === 'number') this.recordErrors.set(parsed.errors);
                    if (typeof parsed.seconds === 'number') this.recordSeconds.set(parsed.seconds);
                } catch {
                    /* cookie nel vecchio formato (solo mattoni, un numero) o corrotto: ignorato. */
                }
            }
        });
    }

    ngOnDestroy(): void {
        this.clearTimers();
    }

    startGame(): void {
        this.gameStarted.set(true);
        this.bricks.set(0);
        this.combo.set(0);
        this.peakCombo.set(0);
        this.errors.set(0);
        this.turnResult.set(null);
        this.notes.set([]);
        this.turnStartMs = performance.now();
        this.spawnNote();
    }

    /** Chiude il turno volontariamente (nessun record: quelli si guadagnano solo completando
     *  l'edificio) e torna alla schermata iniziale — il muro resta in vista finché non si ricomincia. */
    endTurn(): void {
        this.clearTimers();
        this.gameStarted.set(false);
        this.notes.set([]);
    }

    @HostListener('window:keydown.space', ['$event'])
    onSpace(event: Event): void {
        if (!this.gameStarted()) return;
        event.preventDefault();
        this.attemptHit();
    }

    /** Colpo tentato: da SPAZIO o dal tap sulla corsia (mobile). Premere col binario vuoto (nessuna
     *  nota ancora spawnata) resta innocuo; premere mentre una nota è in corsa ma fuori dalla zona
     *  gialla conta invece come un errore a tutti gli effetti — la nota sparisce subito (non finisce
     *  la sua corsa) ed è come lasciarla scadere. */
    attemptHit(): void {
        if (!this.gameStarted()) return;
        if (this.notes().length === 0) return;

        const now = performance.now();
        let best: Note | null = null;
        let bestDiff = Infinity;
        for (const note of this.notes()) {
            const progress = this.noteProgress(note, now);
            if (progress < GOOD_MIN || progress > GOOD_MAX) continue;
            const diff = Math.abs(progress - SWEET_CENTER);
            if (diff < bestDiff) { bestDiff = diff; best = note; }
        }
        if (!best) {
            this.notes.set([]);
            this.registerMiss();
            return;
        }

        this.notes.update(ns => ns.filter(n => n.id !== best!.id));
        const newCombo = this.combo() + 1;
        this.combo.set(newCombo);
        this.peakCombo.update(p => Math.max(p, newCombo));
        const perfect = bestDiff <= PERFECT_HALF;
        const gained = perfect ? BRICKS_PER_PERFECT : BRICKS_PER_GOOD;
        const newBricks = Math.min(TOTAL_BRICKS, this.bricks() + gained);
        this.bricks.set(newBricks);
        this.showFeedback(perfect ? `CRITICA PERFETTA! +${gained} mattoni` : `BEL COLPO! +${gained} mattone`);

        const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        if (newBricks >= TOTAL_BRICKS) {
            this.playAudio(quote);
            this.completeBuilding();
            return;
        }
        this.playThenScheduleNext(quote);
    }

    /** Fine naturale dell'animazione CSS di una nota (bindato da `(animationend)` nel template):
     *  se è ancora in lista non è stata colpita in tempo → combo persa. */
    onNoteExpired(id: number): void {
        const stillThere = this.notes().some(n => n.id === id);
        if (!stillThere) return;
        this.notes.update(ns => ns.filter(n => n.id !== id));
        this.registerMiss();
    }

    private noteProgress(note: Note, now: number): number {
        return (now - note.spawnMs) / TRAVEL_MS * 100;
    }

    /** Errore registrato (nota scaduta o colpo fuori zona): azzera la combo, conta l'errore, mostra
     *  il feedback e fa partire il farfugliamento — condiviso dai due percorsi di fallimento. */
    private registerMiss(): void {
        this.combo.set(0);
        this.errors.update(e => e + 1);
        this.showFeedback('COMMENTO FUORI TEMPO!');
        this.playThenScheduleNext('fail');
    }

    /** Tetto dei mattoni raggiunto: il turno finisce da solo, niente nota successiva. Mostra il
     *  riepilogo (combo massima, errori, tempo impiegato) e aggiorna i record se battuti. */
    private completeBuilding(): void {
        this.clearTimers();
        this.gameStarted.set(false);
        this.notes.set([]);
        const result: TurnResult = {
            peakCombo: this.peakCombo(),
            errors: this.errors(),
            seconds: Math.round((performance.now() - this.turnStartMs) / 1000),
        };
        this.turnResult.set(result);
        this.updateRecords(result);
    }

    /** Formatta i secondi del riepilogo come m:ss. */
    protected formatDuration(totalSeconds: number): string {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    private spawnNote(): void {
        this.notes.update(ns => [...ns, { id: this.nextNoteId++, spawnMs: performance.now() }]);
    }

    /** Fa partire l'audio e pianifica già la nota successiva a `NOTE_LEAD_MS` dalla sua fine reale
     *  (nota `audio.duration`, non l'evento `ended`): la nota compare mentre la battuta sta ancora
     *  suonando, l'ultimo secondo di audio e l'inizio della corsa si sovrappongono apposta. */
    private playThenScheduleNext(key: SfxKey): void {
        const sound = this.audioPool[key];
        const durationMs = sound && Number.isFinite(sound.duration) && sound.duration > 0
            ? sound.duration * 1000
            : 0;
        const leadMs = durationMs > 0 ? Math.max(0, durationMs - NOTE_LEAD_MS) : FALLBACK_NOTE_DELAY_MS;
        this.playAudio(key);
        this.beatTimer = setTimeout(() => {
            if (this.gameStarted()) this.spawnNote();
        }, leadMs);
    }

    private showFeedback(message: string): void {
        this.feedback.set(message);
        if (this.feedbackTimer !== null) clearTimeout(this.feedbackTimer);
        this.feedbackTimer = setTimeout(() => this.feedback.set(null), 1500);
    }

    private playAudio(key: SfxKey): void {
        const sound = this.audioPool[key];
        if (!sound) return;
        sound.currentTime = 0;
        void sound.play().catch(() => { /* asset audio assente o autoplay bloccato: silenzioso */ });
    }

    /** Aggiorna ogni record indipendentemente dagli altri (combo più alta, meno errori, meno
     *  tempo) e, se qualcosa è cambiato, persiste tutti e tre insieme in un solo cookie JSON. */
    private updateRecords(result: TurnResult): void {
        let changed = false;
        if (this.recordCombo() === null || result.peakCombo > this.recordCombo()!) {
            this.recordCombo.set(result.peakCombo);
            changed = true;
        }
        if (this.recordErrors() === null || result.errors < this.recordErrors()!) {
            this.recordErrors.set(result.errors);
            changed = true;
        }
        if (this.recordSeconds() === null || result.seconds < this.recordSeconds()!) {
            this.recordSeconds.set(result.seconds);
            changed = true;
        }
        if (!changed) return;
        const payload: RecordStats = {
            combo: this.recordCombo(),
            errors: this.recordErrors(),
            seconds: this.recordSeconds(),
        };
        this.cookies.set('umarellRecord', JSON.stringify(payload), 60 * 60 * 24 * 365);
    }

    resetRecords(): void {
        this.recordCombo.set(null);
        this.recordErrors.set(null);
        this.recordSeconds.set(null);
        this.cookies.remove('umarellRecord');
    }

    private clearTimers(): void {
        if (this.beatTimer !== null) { clearTimeout(this.beatTimer); this.beatTimer = null; }
        if (this.feedbackTimer !== null) { clearTimeout(this.feedbackTimer); this.feedbackTimer = null; }
    }
}
