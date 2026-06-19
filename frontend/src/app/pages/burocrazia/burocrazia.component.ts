import { Component, computed, effect, ElementRef, inject, OnDestroy, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PageBaseComponent } from '../page-base.component';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { ThemeService } from '../../core/engine/services/theme.service';
import { CookieConsentService } from '../../core/engine/services/cookie-consent.service';
import {
    ClockTone, CoachData, GameController, IntroData, Palette, PratData, ResultData, ServeData, WelcomeData,
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
        // Componente canvas/imperativo: l'hydration SSR su una vista che disegna a mano causa
        // mismatch (canvas "morto" da SSR sovrapposto a quello vero) → schermo nero su F5 mentre
        // via link funziona. ngSkipHydration lo rende fresco sul client, come la navigazione via link.
        'ngSkipHydration': 'true',
        '(window:keydown)': 'onKeyDown($event)',
        '(window:keyup)': 'onKeyUp($event)',
        '(window:blur)': 'onBlur()',
        '(document:visibilitychange)': 'onVisibility()',
    },
})
export class BurocraziaComponent extends PageBaseComponent<void> implements OnDestroy {
    private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('cv');
    private readonly stageRef = viewChild<ElementRef<HTMLDivElement>>('stage');

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
    readonly welcome = signal<WelcomeData | null>(null);
    readonly knobTransform = signal('translate(0,0)');
    readonly muted = signal(false);
    readonly paused = signal(false);

    // joystick flottante: visibile mentre si guida, posizionato sotto il pollice (coord. stage)
    readonly joyVisible = signal(false);
    readonly joyX = signal(0);
    readonly joyY = signal(0);

    // pips dei timbri: array 1..total, riempiti fino a `stamps` (progresso pinnato sull'HUD)
    readonly pips = computed<number[]>(() => {
        const p = this.prat();
        return p ? Array.from({ length: p.total }, (_, i) => i + 1) : [];
    });

    private readonly theme = inject(ThemeService);
    private readonly cookies = inject(CookieConsentService);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    private game?: GameController;
    private gameCanvas?: HTMLCanvasElement;   // canvas su cui il gioco è agganciato: se cambia, si riaggancia
    private resizeObs?: ResizeObserver;
    private flashTimer?: ReturnType<typeof setTimeout>;

    // joystick flottante
    private joyId: number | null = null;
    private joyOriginX = 0;
    private joyOriginY = 0;
    private readonly JOY_R = 46;

    constructor() {
        super();
        // La mappa segue il tema del sito (light/dark) e i colori semantici Bootstrap:
        // ricalcola la palette al cambio tono. Guard: il game esiste solo dopo il render.
        effect(() => { this.theme.themeTone(); this.applyPalette(); });

        // Accessibilità: rispetta la preferenza "meno movimento" del sistema. Il segnale è
        // reattivo (ThemeService), così attivando/disattivando la preferenza il canvas si adegua
        // senza reload — stesso schema dell'effetto palette qui sopra.
        effect(() => { this.game?.setReduceMotion(this.theme.prefersReducedMotion()); });

        // (Ri)crea il gioco quando il canvas "vivo" cambia. Su F5 (SSR+hydration) il canvas a cui era
        // legato il gioco viene SOSTITUITO dopo la creazione → il gioco disegnava su un canvas staccato
        // (schermo nero su F5, mentre via link funzionava). L'effect lo riaggancia al canvas reale.
        // Solo browser: in SSR esce prima di leggere i viewChild (niente canvas/rAF lato server).
        effect(() => {
            if (!this.isBrowser) return;
            const canvas = this.canvasRef()?.nativeElement;
            const stage = this.stageRef()?.nativeElement;
            if (!canvas || !stage || this.gameCanvas === canvas) return;
            this.gameCanvas = canvas;
            this.initGame(canvas, stage);
        });
    }

    /** Crea (o ricrea) il motore sul canvas dato, ricollegando palette e ResizeObserver. */
    private initGame(canvas: HTMLCanvasElement, stage: HTMLDivElement): void {
        this.resizeObs?.disconnect();
        this.game?.dispose();
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
            onWelcome: d => this.welcome.set(d),
            tutorialDone: () => this.cookies.getCookie('burocraziaTutorialDone') ?? false,
            onTutorialDone: () => this.cookies.setCookie('burocraziaTutorialDone', true),
            onPause: p => { this.paused.set(p); if (p) void this.openPauseDialog(); },
            savedZoom: () => this.cookies.getCookie('burocraziaZoom'),
            onZoom: z => this.persistZoom(z),
            // Avviso "grafica alleggerita": toastOnce → la dedup "una volta per sessione" la fa il servizio.
            // (Il flag `lite` nel motore resta perché governa la qualità di rendering, non solo l'avviso.)
            onPerfNotice: () => this.notify.toastOnce('buro-lite', this.translate.translate('buroPerfNotice'), 'warning', { durationMs: 6000 }),
        });
        this.applyPalette();
        this.game.setReduceMotion(this.theme.prefersReducedMotion());   // stato iniziale (l'effect copre i cambi successivi)
        this.resizeObs = new ResizeObserver(() => this.game?.resize());
        this.resizeObs.observe(stage);
    }

    ngOnDestroy(): void {
        clearTimeout(this.flashTimer);
        clearTimeout(this.zoomSaveTimer);
        this.resizeObs?.disconnect();
        this.game?.dispose();
    }

    /** Salva lo zoom scelto nei cookie (debounce: la rotella emette molti eventi ravvicinati). */
    private zoomSaveTimer?: ReturnType<typeof setTimeout>;
    private persistZoom(z: number): void {
        clearTimeout(this.zoomSaveTimer);
        this.zoomSaveTimer = setTimeout(() => this.cookies.setCookie('burocraziaZoom', Math.round(z * 100) / 100, 60 * 60 * 24 * 365), 400);
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
            // Marciapiede (spazio pedonale) che fiancheggia l'asfalto: concrete chiaro, tono-aware.
            sidewalk: v('--bs-tertiary-bg', dark ? '#3b4654' : '#cfd4dc'),
            // Asfalto volutamente scuro (non --bs-border-color, troppo chiaro): è ciò che fa risaltare
            // la segnaletica BIANCA (mezzeria + strisce) — look realistico tipo mappa isometrica.
            road: dark ? '#2b3340' : '#7e858f',
            surfaceOffice: v('--bs-tertiary-bg', dark ? '#5a6a80' : '#dee2e6'),
            surfaceDone: v('--bs-secondary-bg', dark ? '#3a4658' : '#e9ecef'),
            light: !dark,
            buildings: dark ? BUILDINGS_DARK : BUILDINGS_LIGHT,
            warning: v('--bs-warning', '#ffc107'),
            info: v('--bs-primary', dark ? '#46d8c1' : '#29805c'),   // accento "corrente/obiettivo" sul brand del tema
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
    onBlur(): void { this.game?.dropInputs(); this.resetJoy(); }
    onVisibility(): void { if (document.hidden) { this.game?.dropInputs(); this.resetJoy(); } }

    // ── pulsanti azione (pointerdown = reazione immediata, da gioco) ────────
    doAction(e: Event): void { e.preventDefault(); this.game?.doAction(); this.haptic(); }
    doDismount(e: Event): void { e.preventDefault(); this.game?.doDismount(); this.haptic(); }
    /** Micro-feedback tattile su mobile (no-op dove non supportato). */
    private haptic(): void { try { navigator.vibrate?.(10); } catch { /* non supportato */ } }
    // ── zoom mappa (regolabile dall'utente) ─────────────────────────────────
    onWheel(e: WheelEvent): void { e.preventDefault(); this.game?.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }
    zoomIn(e: Event): void { e.preventDefault(); this.game?.zoomBy(1.18); this.haptic(); }
    zoomOut(e: Event): void { e.preventDefault(); this.game?.zoomBy(1 / 1.18); this.haptic(); }
    confirmStart(): void { this.game?.confirmStart(); }
    choose(index: number): void { this.game?.choosePratica(index); }
    dismissServe(): void { this.game?.dismissServe(); }
    dismissWelcome(): void { this.game?.dismissWelcome(); }
    restart(): void { this.game?.restart(); }
    toggleMute(): void { const m = this.game?.toggleMute() ?? false; this.muted.set(m); }
    togglePause(): void { this.game?.togglePause(); }
    /** Pausa = notifica standard (SweetAlert) bloccante a UN solo bottone (niente "Annulla");
     *  alla chiusura (Riprendi / ESC / clic fuori) riprende il gioco. */
    private async openPauseDialog(): Promise<void> {
        await this.notify.alert(this.translate.translate('buroPaused'), '', { icon: 'info', confirmText: this.translate.translate('buroResume') });
        if (this.paused()) this.game?.togglePause();   // riprendi se non già ripreso (es. via tasto pausa nascosto)
    }

    // ── joystick flottante: nasce dove il pollice tocca la zona-movimento (sinistra) ─
    // La leva compare sotto il dito (coord. relative allo stage), così non c'è una
    // posizione fissa da "cercare". Pointer-capture sull'elemento zona così il dito che
    // muove non interferisce con l'altro pollice sui tasti azione (multitouch).
    onMoveDown(e: PointerEvent): void {
        if (this.joyId !== null) return;            // già in sterzata con un altro dito
        e.preventDefault();
        this.joyId = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        this.joyOriginX = e.clientX; this.joyOriginY = e.clientY;
        const stage = this.stageRef()?.nativeElement; if (!stage) return;
        const r = stage.getBoundingClientRect();
        this.joyX.set(e.clientX - r.left); this.joyY.set(e.clientY - r.top);
        this.knobTransform.set('translate(0,0)');
        this.joyVisible.set(true);
        this.game?.setJoy(0, 0);
    }
    onMoveMove(e: PointerEvent): void {
        if (this.joyId !== e.pointerId) return;
        let dx = e.clientX - this.joyOriginX, dy = e.clientY - this.joyOriginY;
        const d = Math.hypot(dx, dy);
        if (d > this.JOY_R) { dx = dx / d * this.JOY_R; dy = dy / d * this.JOY_R; }
        this.knobTransform.set(`translate(${dx}px,${dy}px)`);
        this.game?.setJoy(dx / this.JOY_R, dy / this.JOY_R);
    }
    onMoveEnd(e: PointerEvent): void {
        if (this.joyId !== e.pointerId) return;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* già rilasciato */ }
        this.resetJoy();
    }
    /** Riporta il joystick allo stato di riposo (rilascio, blur, tab nascosta). */
    private resetJoy(): void {
        this.joyId = null;
        this.joyVisible.set(false);
        this.knobTransform.set('translate(0,0)');
        this.game?.clearJoy();
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
