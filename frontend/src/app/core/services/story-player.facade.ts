import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { StorySnapshotDto, StoryTimelineItem } from '../dto/story.dto';

/** Firma unica: sceneId e choiceId opzionali decidono start / resume / choose. */
type PlayFn = (sceneId?: string, choiceId?: string, stats?: Record<string, number>) => Promise<StorySnapshotDto>;

@Injectable({ providedIn: 'root' })
export class StoryPlayerFacade {
    private readonly api = inject(ApiService);

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
            this.saveTimeline(this.currentSlug, updatedTimeline);
            this.applySnapshot(next);
        } catch {
            this.error.set('Errore nella scelta.');
        } finally {
            this.loading.set(false);
        }
    }

    async restart(): Promise<void> {
        this.storageRemove(this.sceneKey(this.currentSlug));
        this.storageRemove(this.statsKey(this.currentSlug));
        this.storageRemove(this.timelineKey(this.currentSlug));
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
            const savedSceneId = this.storageGet(this.sceneKey(slug));
            const savedStats = this.loadSavedStats(slug);

            if (savedSceneId && savedStats) {
                try {
                    // Resume: sceneId presente, nessun choiceId
                    const snap = await this.playFn(savedSceneId, undefined, savedStats);
                    const savedTimeline = this.loadSavedTimeline(slug);
                    if (savedTimeline && savedTimeline.length > 0) {
                        this.timeline.set(savedTimeline);
                    }
                    this.applySnapshot(snap);
                    return;
                } catch {
                    this.storageRemove(this.sceneKey(slug));
                    this.storageRemove(this.statsKey(slug));
                    this.storageRemove(this.timelineKey(slug));
                }
            }

            // Start: nessun parametro → stats vuote → prima esecuzione
            const snap = await this.playFn();
            this.applySnapshot(snap);
        } catch (error) {
            if (error instanceof HttpErrorResponse && error.status === 404) {
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
        this.storageSet(this.sceneKey(this.currentSlug), snap.sceneId);
        this.storageSet(this.statsKey(this.currentSlug), JSON.stringify(snap.stats ?? {}));

        if (this.timeline().length === 0) {
            if (snap.isEnding) {
                this.timeline.set([{ type: 'ending', sceneId: snap.sceneId, text: snap.sceneText, title: snap.endingTitle }]);
            } else {
                this.timeline.set([{ type: 'scene', sceneId: snap.sceneId, text: snap.sceneText }]);
            }
        }
    }

    // ── LocalStorage ─────────────────────────────────────────────────

    private sceneKey(slug: string): string { return `br1games.story.${slug}.sceneId`; }
    private statsKey(slug: string): string { return `br1games.story.${slug}.stats`; }
    private timelineKey(slug: string): string { return `br1games.story.${slug}.timeline`; }

    private storageGet(key: string): string | null {
        if (typeof localStorage === 'undefined') return null;
        try { return localStorage.getItem(key); } catch { return null; }
    }

    private storageSet(key: string, value: string): void {
        if (typeof localStorage === 'undefined') return;
        try { localStorage.setItem(key, value); } catch { /* quota o privacy mode */ }
    }

    private storageRemove(key: string): void {
        if (typeof localStorage === 'undefined') return;
        try { localStorage.removeItem(key); } catch { /* noop */ }
    }

    private loadSavedStats(slug: string): Record<string, number> | null {
        const raw = this.storageGet(this.statsKey(slug));
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }

    private loadSavedTimeline(slug: string): StoryTimelineItem[] | null {
        const raw = this.storageGet(this.timelineKey(slug));
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }

    private saveTimeline(slug: string, items: StoryTimelineItem[]): void {
        this.storageSet(this.timelineKey(slug), JSON.stringify(items));
    }
}
