import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ApiError } from '../engine/services/base-api.service';
import { CookieConsentService } from '../engine/services/cookie-consent.service';
import { StorySnapshotDto, StoryTimelineItem } from '../dto/story.dto';

/** Firma unica: sceneId e choiceId opzionali decidono start / resume / choose. */
type PlayFn = (sceneId?: string, choiceId?: string, stats?: Record<string, number>) => Promise<StorySnapshotDto>;

@Injectable({ providedIn: 'root' })
export class StoryPlayerFacade {
    private readonly api = inject(ApiService);
    private readonly cookies = inject(CookieConsentService);

    readonly snapshot = signal<StorySnapshotDto | null>(null);
    readonly timeline = signal<StoryTimelineItem[]>([]);
    readonly title = signal<string>('');
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    private playFn!: PlayFn;
    private currentSlug = '';

    // ── Named init per storia ─────────────────────────────────────────

    initPoveriMaschi(): Promise<void> {
        return this.initWithPlay('poveri-maschi', (s, c, st) => this.api.playPoveriMaschi(s, c, st));
    }

    initMagrogamer09(): Promise<void> {
        return this.initWithPlay('magrogamer09', (s, c, st) => this.api.playMagrogamer09(s, c, st));
    }

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
            const next = await this.playFn(current.sceneId, choiceId, current.stats);

            const newItems: StoryTimelineItem[] = [];

            if (chosenChoice) {
                newItems.push({ type: 'choice', text: chosenChoice.text });
            }
            if (next.consequences) {
                newItems.push({ type: 'consequence', text: next.consequences });
            }
            if (next.isEnding) {
                newItems.push({ type: 'ending', sceneId: next.sceneId, text: next.sceneText, title: next.endingTitle });
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
            const snap = await this.playFn();
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
                    const snap = await this.playFn(savedSceneId, undefined, savedStats);
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
            const snap = await this.playFn();
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

    // ── Stato interno ─────────────────────────────────────────────────

    private applySnapshot(snap: StorySnapshotDto): void {
        this.snapshot.set(snap);
        if (snap.storyTitle) this.title.set(snap.storyTitle);
        const state = this.getStoryState(this.currentSlug);
        this.saveStoryState(this.currentSlug, snap.sceneId, snap.stats ?? {}, state.timeline);

        if (this.timeline().length === 0) {
            if (snap.isEnding) {
                this.timeline.set([{ type: 'ending', sceneId: snap.sceneId, text: snap.sceneText, title: snap.endingTitle }]);
            } else {
                this.timeline.set([{ type: 'scene', sceneId: snap.sceneId, text: snap.sceneText }]);
            }
        }
    }

    // ── Cookie (tramite CookieConsentService) ────────────────────────

    private getStoryState(slug: string): { sceneId: string | null; stats: Record<string, number> | null; timeline: StoryTimelineItem[] | null } {
        const raw = this.cookies.getCookie('storyPlayerState');
        if (!raw) return { sceneId: null, stats: null, timeline: null };
        try {
            const all = JSON.parse(raw) as Record<string, any>;
            const story = all[slug] || {};
            return {
                sceneId: story.sceneId ?? null,
                stats: story.stats ?? null,
                timeline: story.timeline ?? null,
            };
        } catch {
            return { sceneId: null, stats: null, timeline: null };
        }
    }

    private saveStoryState(slug: string, sceneId: string | null, stats: Record<string, number> | null, timeline: StoryTimelineItem[] | null): void {
        const raw = this.cookies.getCookie('storyPlayerState');
        let all: Record<string, any> = {};
        if (raw) {
            try { all = JSON.parse(raw); } catch { }
        }
        all[slug] = { sceneId, stats, timeline };
        const maxAge = 60 * 60 * 24 * 365;
        this.cookies.setCookie('storyPlayerState', JSON.stringify(all), maxAge);
    }

    private clearStoryState(slug: string): void {
        const raw = this.cookies.getCookie('storyPlayerState');
        if (!raw) return;
        try {
            const all = JSON.parse(raw) as Record<string, any>;
            delete all[slug];
            if (Object.keys(all).length === 0) {
                this.cookies.removeCookie('storyPlayerState');
            } else {
                const maxAge = 60 * 60 * 24 * 365;
                this.cookies.setCookie('storyPlayerState', JSON.stringify(all), maxAge);
            }
        } catch { }
    }

    private loadSavedStats(slug: string): Record<string, number> | null {
        return this.getStoryState(slug).stats;
    }

    private loadSavedTimeline(slug: string): StoryTimelineItem[] | null {
        return this.getStoryState(slug).timeline;
    }

    private saveTimeline(slug: string, items: StoryTimelineItem[]): void {
        const state = this.getStoryState(slug);
        this.saveStoryState(slug, state.sceneId, state.stats, items);
    }
}
