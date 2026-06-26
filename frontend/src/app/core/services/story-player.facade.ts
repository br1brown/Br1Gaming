import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ApiError } from '../engine/services/base-api.service';
import { CookieConsentService } from '../engine/services/cookie-consent.service';
import { StorySnapshotDto, StoryTimelineItem } from '../dto/story.dto';

/** Punto di ripristino di una storia salvato nel cookie `storyPlayerState`. */
interface SavedStoryState {
    sceneId: string | null;
    stats: Record<string, number> | null;
}

/** Firma unica del passo di gioco: sceneId e choiceId opzionali decidono start / resume / choose. */
type PlayFn = (sceneId?: string, choiceId?: string, stats?: Record<string, number>) => Promise<StorySnapshotDto>;

@Injectable({ providedIn: 'root' })
export class StoryPlayerFacade {
    private readonly api = inject(ApiService);
    private readonly cookies = inject(CookieConsentService);

    /** maxAge cookie: 1 anno. */
    private static readonly MAX_AGE = 60 * 60 * 24 * 365;
    /** Chiave Web Storage delle timeline (parte voluminosa del salvataggio, fuori dai 4KB del cookie).
     *  Censita in COOKIE_MAP con `storage:'local'` + `valueType:'json'` → in policy, gated dal
     *  consenso e pulita alla revoca. Letta/scritta SOLO via l'API unificata del CookieConsentService
     *  (set/get/remove), mai localStorage diretto (lo vieta anche la regola ESLint no-restricted-globals). */
    private static readonly TIMELINE_KEY = 'storyPlayerTimeline';

    readonly snapshot = signal<StorySnapshotDto | null>(null);
    readonly timeline = signal<StoryTimelineItem[]>([]);
    readonly title = signal<string>('');
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    private playFn!: PlayFn;
    private currentSlug = '';

    // ── Init nominati per storia (typo-proof: niente slug nei consumer) ──

    /** Avvia (o riprende) "Siamo Maschi". */
    initPoveriMaschi(): Promise<void> {
        return this.initWithPlay('poveri-maschi', (s, c, st) => this.api.playPoveriMaschi(s, c, st));
    }

    /** Avvia (o riprende) "Magrogamer09". */
    initMagrogamer09(): Promise<void> {
        return this.initWithPlay('magrogamer09', (s, c, st) => this.api.playMagrogamer09(s, c, st));
    }

    /** Avvia (o riprende) "Sopravviveresti agli USA?". */
    initSurviveUsa(): Promise<void> {
        return this.initWithPlay('sopravvivi-agli-usa', (s, c, st) => this.api.playSurviveUsa(s, c, st));
    }

    // ── Operazioni di gioco ───────────────────────────────────────────

    async choose(choiceId: string): Promise<void> {
        const current = this.snapshot();
        if (!current) return;

        const chosenChoice = current.choices.find(c => c.id === choiceId);

        this.loading.set(true);
        this.error.set(null);

        try {
            const next = await this.play(current.sceneId, choiceId, current.stats);

            const newItems: StoryTimelineItem[] = [];

            if (chosenChoice) {
                newItems.push({ type: 'choice', text: chosenChoice.text });
            }
            if (next.consequences) {
                newItems.push({ type: 'consequence', text: next.consequences });
            }
            if (next.isEnding) {
                newItems.push({ type: 'ending', sceneId: next.sceneId, text: next.sceneText, title: next.endingTitle, imageId: next.endingImageId });
            } else {
                newItems.push({ type: 'scene', sceneId: next.sceneId, text: next.sceneText });
            }

            const updatedTimeline = [...this.timeline(), ...newItems];
            this.timeline.set(updatedTimeline);
            const state = this.getStoryState(this.currentSlug);
            this.saveStoryState(this.currentSlug, state.sceneId, state.stats, updatedTimeline);
            this.applySnapshot(next);
        } catch {
            this.error.set('Errore nella scelta.');
        } finally {
            this.loading.set(false);
        }
    }

    async restart(): Promise<void> {
        this.clearStoryState(this.currentSlug);
        this.loading.set(true);
        this.error.set(null);
        this.timeline.set([]);

        try {
            const snap = await this.play();
            this.applySnapshot(snap);
        } catch {
            this.error.set('Errore nel riavvio.');
        } finally {
            this.loading.set(false);
        }
    }

    // ── Implementazione init ──────────────────────────────────────────

    private async initWithPlay(slug: string, play: PlayFn): Promise<void> {
        this.currentSlug = slug;
        this.playFn = play;

        this.snapshot.set(null);
        this.timeline.set([]);
        this.loading.set(true);
        this.error.set(null);

        try {
            const state = this.getStoryState(slug);
            const savedSceneId = state.sceneId;
            const savedStats = state.stats;

            if (savedSceneId && savedStats) {
                try {
                    // Resume: sceneId presente, nessun choiceId
                    const snap = await this.play(savedSceneId, undefined, savedStats);
                    const savedTimeline = state.timeline;
                    if (savedTimeline && savedTimeline.length > 0) {
                        this.timeline.set(savedTimeline);
                    }
                    this.applySnapshot(snap);
                    return;
                } catch {
                    this.clearStoryState(slug);
                }
            }

            // Start: nessun parametro → stats vuote → prima esecuzione
            const snap = await this.play();
            this.applySnapshot(snap);
        } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
                throw error;
            }
            this.error.set('Errore nel caricamento della storia.');
        } finally {
            this.loading.set(false);
        }
    }

    // Passo di gioco sulla storia corrente, delegato alla PlayFn scelta dall'init nominato.
    private play(sceneId?: string, choiceId?: string, stats?: Record<string, number>): Promise<StorySnapshotDto> {
        return this.playFn(sceneId, choiceId, stats);
    }

    // ── Stato interno ─────────────────────────────────────────────────

    private applySnapshot(snap: StorySnapshotDto): void {
        this.snapshot.set(snap);
        if (snap.storyTitle) this.title.set(snap.storyTitle);
        const state = this.getStoryState(this.currentSlug);
        this.saveStoryState(this.currentSlug, snap.sceneId, snap.stats ?? {}, state.timeline);

        if (this.timeline().length === 0) {
            if (snap.isEnding) {
                this.timeline.set([{ type: 'ending', sceneId: snap.sceneId, text: snap.sceneText, title: snap.endingTitle, imageId: snap.endingImageId }]);
            } else {
                this.timeline.set([{ type: 'scene', sceneId: snap.sceneId, text: snap.sceneText }]);
            }
        }
    }

    // ── Persistenza stato storia ─────────────────────────────────────
    //
    // Il punto di ripristino (sceneId + stats) è piccolo e va nel cookie
    // `storyPlayerState` (gated GDPR dal CookieConsentService, categoria Technical).
    // La `timeline` (storico scene) cresce con la partita e supererebbe il limite
    // ~4KB del cookie facendo fallire la scrittura in SILENZIO → resume che rolla
    // indietro. Per questo la timeline va in localStorage, sotto lo STESSO gate
    // tecnico (`technicalAccepted`) e con guardia SSR.

    /** Forma del punto di ripristino di una storia dentro il cookie `storyPlayerState`. */
    private static readonly EMPTY_STATE = { sceneId: null, stats: null } as SavedStoryState;

    private getStoryState(slug: string): { sceneId: string | null; stats: Record<string, number> | null; timeline: StoryTimelineItem[] | null } {
        const raw = this.cookies.getCookie('storyPlayerState');
        let sceneId: string | null = null;
        let stats: Record<string, number> | null = null;
        if (raw) {
            try {
                const story = (JSON.parse(raw) as Record<string, SavedStoryState>)[slug] || StoryPlayerFacade.EMPTY_STATE;
                sceneId = story.sceneId ?? null;
                stats = story.stats ?? null;
            } catch { /* cookie corrotto: stato assente */ }
        }
        return { sceneId, stats, timeline: this.readTimeline(slug) };
    }

    private saveStoryState(slug: string, sceneId: string | null, stats: Record<string, number> | null, timeline: StoryTimelineItem[] | null): void {
        // Parte piccola e critica nel cookie (gated dal service).
        const raw = this.cookies.getCookie('storyPlayerState');
        let all: Record<string, SavedStoryState> = {};
        if (raw) {
            try { all = JSON.parse(raw); } catch { }
        }
        all[slug] = { sceneId, stats };
        this.cookies.setCookie('storyPlayerState', JSON.stringify(all), StoryPlayerFacade.MAX_AGE);
        // Parte pesante in localStorage, stesso gate tecnico.
        this.writeTimeline(slug, timeline);
    }

    private clearStoryState(slug: string): void {
        const raw = this.cookies.getCookie('storyPlayerState');
        if (raw) {
            try {
                const all = JSON.parse(raw) as Record<string, SavedStoryState>;
                delete all[slug];
                if (Object.keys(all).length === 0) {
                    this.cookies.removeCookie('storyPlayerState');
                } else {
                    this.cookies.setCookie('storyPlayerState', JSON.stringify(all), StoryPlayerFacade.MAX_AGE);
                }
            } catch { }
        }
        this.writeTimeline(slug, null);
    }

    // ── Timeline via API unificata del consenso (gated GDPR + in policy, SSR-safe) ──
    // Niente più localStorage diretto: lettura/scrittura passano da CookieConsentService.get/set/
    // remove, che instradano sul Web Storage (storage:'local' in COOKIE_MAP), gate-ano sul consenso
    // tecnico e serializzano via valueType:'json'. Quota/Safari privato: degradano in silenzio dentro.

    private readTimeline(slug: string): StoryTimelineItem[] | null {
        const all = this.cookies.get(StoryPlayerFacade.TIMELINE_KEY) as Record<string, StoryTimelineItem[]> | null;
        return all?.[slug] ?? null;
    }

    private writeTimeline(slug: string, timeline: StoryTimelineItem[] | null): void {
        // Il gate del consenso vive dentro set(): senza consenso tecnico è un no-op (privacy by default).
        const all = (this.cookies.get(StoryPlayerFacade.TIMELINE_KEY) as Record<string, StoryTimelineItem[]> | null) ?? {};
        if (timeline && timeline.length > 0) {
            all[slug] = timeline;
        } else {
            delete all[slug];
        }
        if (Object.keys(all).length === 0) {
            this.cookies.remove(StoryPlayerFacade.TIMELINE_KEY);
        } else {
            this.cookies.set(StoryPlayerFacade.TIMELINE_KEY, all);
        }
    }
}
