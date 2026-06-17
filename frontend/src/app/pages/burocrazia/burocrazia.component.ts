import { afterNextRender, Component, effect, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { PageBaseComponent } from '../page-base.component';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { ThemeService } from '../../core/engine/services/theme.service';
import {
    ClockTone, CoachData, GameController, IntroData, Palette, PratData, ResultData, ServeData,
    createBurocraziaGame,
} from './burocrazia.engine';

// Tinte "artistiche" degli edifici per tono: il resto della palette arriva dalle CSS var
// di Bootstrap/tema, queste danno alla città il colpo d'occhio chiaro o scuro.
const BUILDINGS_DARK = ['#1b2636', '#212e41', '#26344a', '#2c3a52', '#1f2a3a', '#324162', '#23344b', '#3a3550', '#2e3a40', '#43352f'];
const BUILDINGS_LIGHT = ['#d7deea', '#cdd6e6', '#e0e6ef', '#c4cfe0', '#d2dbe8', '#bcc8dd', '#dde3ee', '#cbd0e0', '#d4dad3', '#e3dcd2'];

/**
 * BUROCRAZIA — gioco canvas isometrico a schermo pieno.
 *
 * Il guscio Angular tiene la UI dichiarativa (orologio, obiettivo, coach, pulsanti,
 * pannelli modali) come signal + template Bootstrap; la simulazione su canvas vive in
 * `burocrazia.engine.ts` (TS puro) e comunica lo stato qui tramite hook → signal.
 *
 * Mobile-friendly: la rotta è `layout: { fitViewport: true }` in site.ts (stessa scelta di
 * duce-non-duce / radar) → riempie lo spazio sotto la navbar senza scroll di pagina; lo stage
 * prende l'altezza residua (root con `flex-grow-1` dentro l'host full-bleed) e il canvas la
 * insegue via ResizeObserver. NIENTE classi `d-*` sull'host: batterebbero il `display:flex`
 * della regola .fit-viewport (vedi base.css).
 *
 * I pannelli (scelta pratica, sportello, esito) sono overlay Angular @if: nessun
 * alert/confirm/dialog nativo del browser, nessuna manipolazione diretta del DOM.
 */
@Component({
    selector: 'app-burocrazia',
    standalone: true,
    imports: [TranslatePipe],
    templateUrl: './burocrazia.component.html',
    styleUrl: './burocrazia.component.css',
    host: {
        '(window:keydown)': 'onKeyDown($event)',
        '(window:keyup)': 'onKeyUp($event)',
        '(window:blur)': 'onBlur()',
        '(document:visibilitychange)': 'onVisibility()',
    },
})
export class BurocraziaComponent extends PageBaseComponent<void> implements OnDestroy {
    private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
    private readonly stageRef = viewChild.required<ElementRef<HTMLDivElement>>('stage');
    private readonly joyRef = viewChild.required<ElementRef<HTMLDivElement>>('joy');

    // ── stato UI guidato dai hook del motore ───────────────────────────────
    readonly clockText = signal('09:00');
    readonly clockTone = signal<ClockTone>('none');
    readonly clockFlash = signal(false);
    readonly hourDeg = signal(0);
    readonly minDeg = signal(0);
    readonly prat = signal<PratData | null>(null);
    readonly coach = signal<CoachData | null>(null);
    readonly showStart = signal(false);
    readonly startPulse = signal(false);
    readonly actLabel = signal('SALI');
    readonly actDim = signal(false);
    readonly actAria = signal('');
    readonly showDismount = signal(false);
    readonly serve = signal<ServeData | null>(null);
    readonly result = signal<ResultData | null>(null);
    readonly intro = signal<IntroData | null>(null);
    readonly knobTransform = signal('translate(0,0)');
    readonly muted = signal(false);

    private readonly theme = inject(ThemeService);

    private game?: GameController;
    private resizeObs?: ResizeObserver;
    private flashTimer?: ReturnType<typeof setTimeout>;

    // joystick
    private joyId: number | null = null;
    private readonly JOY_R = 42;

    constructor() {
        super();
        // La mappa segue il tema del sito (light/dark) e i colori semantici Bootstrap:
        // ricalcola la palette al cambio tono. Guard: il game esiste solo dopo il render.
        effect(() => { this.theme.themeTone(); this.applyPalette(); });

        // afterNextRender gira solo nel browser: canvas, rAF e ResizeObserver mai in SSR.
        afterNextRender(() => {
            const canvas = this.canvasRef().nativeElement;
            const stage = this.stageRef().nativeElement;
            this.game = createBurocraziaGame(canvas, stage, {
                t: (k, ...a) => this.translate.t(k, ...a),
                assetUrl: id => this.asset.getUrl(id),
                onClock: (text, tone, hourDeg, minDeg) => { this.clockText.set(text); this.clockTone.set(tone); this.hourDeg.set(hourDeg); this.minDeg.set(minDeg); },
                onFlash: () => { this.clockFlash.set(true); clearTimeout(this.flashTimer); this.flashTimer = setTimeout(() => this.clockFlash.set(false), 520); },
                onPrat: d => this.prat.set(d),
                onCoach: (d, showStart, startPulse) => { this.coach.set(d); this.showStart.set(showStart); this.startPulse.set(startPulse); },
                onAct: (label, dim, aria, showDismount) => { this.actLabel.set(label); this.actDim.set(dim); this.actAria.set(aria); this.showDismount.set(showDismount); },
                onServe: d => this.serve.set(d),
                onResult: d => this.result.set(d),
                onIntro: d => this.intro.set(d),
            });
            this.applyPalette();   // tono iniziale (l'effect potrebbe essere già scattato prima del game)
            this.resizeObs = new ResizeObserver(() => this.game?.resize());
            this.resizeObs.observe(stage);
        });
    }

    ngOnDestroy(): void {
        clearTimeout(this.flashTimer);
        this.resizeObs?.disconnect();
        this.game?.dispose();
    }

    /** Costruisce la palette del canvas leggendo le CSS var del tema corrente. */
    private applyPalette(): void {
        if (!this.game) return;
        const cs = getComputedStyle(document.documentElement);
        const v = (name: string, fallback: string): string => { const x = cs.getPropertyValue(name).trim(); return x || fallback; };
        const dark = this.theme.themeTone() === 'dark';
        const palette: Palette = {
            void: v('--bs-body-bg', dark ? '#080B12' : '#ffffff'),
            ground: v('--bs-secondary-bg', dark ? '#101A2A' : '#e9ecef'),
            road: v('--bs-border-color', dark ? '#2A3445' : '#ced4da'),
            surfaceOffice: v('--bs-tertiary-bg', dark ? '#5a6a80' : '#dee2e6'),
            surfaceDone: v('--bs-secondary-bg', dark ? '#3a4658' : '#e9ecef'),
            buildings: dark ? BUILDINGS_DARK : BUILDINGS_LIGHT,
            warning: v('--bs-warning', '#ffc107'),
            info: v('--bs-info', '#0dcaf0'),
            success: v('--bs-success', '#198754'),
            danger: v('--bs-danger', '#dc3545'),
            mutedText: v('--bs-secondary-color', dark ? '#9aa6b8' : '#6c757d'),
            body: v('--bs-body-color', dark ? '#C9D3E1' : '#212529'),
        };
        this.game.setPalette(palette);
    }

    // ── input inoltrato al motore ──────────────────────────────────────────
    onKeyDown(e: KeyboardEvent): void { this.game?.keydown(e); }
    onKeyUp(e: KeyboardEvent): void { this.game?.keyup(e); }
    onBlur(): void { this.game?.dropInputs(); this.knobTransform.set('translate(0,0)'); }
    onVisibility(): void { if (document.hidden) { this.game?.dropInputs(); this.knobTransform.set('translate(0,0)'); } }

    // ── pulsanti azione ────────────────────────────────────────────────────
    doAction(e: Event): void { e.preventDefault(); this.game?.doAction(); }
    doDismount(e: Event): void { e.preventDefault(); this.game?.doDismount(); }
    confirmStart(): void { this.game?.confirmStart(); }
    choose(index: number): void { this.game?.choosePratica(index); }
    dismissServe(): void { this.game?.dismissServe(); }
    restart(): void { this.game?.restart(); }
    toggleMute(): void { const m = this.game?.toggleMute() ?? false; this.muted.set(m); }

    // ── joystick (la matematica vive qui perché serve il rect dell'elemento) ─
    onJoyDown(e: PointerEvent): void {
        e.preventDefault();
        this.joyId = e.pointerId;
        this.joyRef().nativeElement.setPointerCapture(e.pointerId);
        this.onJoyMove(e);
    }
    onJoyMove(e: PointerEvent): void {
        if (this.joyId !== e.pointerId) return;
        const r = this.joyRef().nativeElement.getBoundingClientRect();
        let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        if (d > this.JOY_R) { dx = dx / d * this.JOY_R; dy = dy / d * this.JOY_R; }
        this.knobTransform.set(`translate(${dx}px,${dy}px)`);
        this.game?.setJoy(dx / this.JOY_R, dy / this.JOY_R);
    }
    onJoyEnd(e: PointerEvent): void {
        if (this.joyId !== e.pointerId) return;
        this.joyId = null;
        this.knobTransform.set('translate(0,0)');
        this.game?.clearJoy();
        try { this.joyRef().nativeElement.releasePointerCapture(e.pointerId); } catch { /* già rilasciato */ }
    }

    /** Mappa il "tone" delle righe sportello su una classe di testo Bootstrap (tema-aware). */
    toneClass(tone: ServeData['lines'][number]['tone']): string {
        switch (tone) {
            case 'amber': case 'gold': return 'text-warning';
            case 'red': return 'text-danger';
            case 'green': return 'text-success';
            case 'muted': return 'text-secondary';
            default: return '';
        }
    }
}
