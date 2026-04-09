import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StoriesApiService } from './stories-api.service';
import { StorySnapshotDto, StoryTimelineItem } from '../dto/story.dto';

@Injectable({ providedIn: 'root' })
export class StoryPlayerFacade {
    private readonly api = inject(StoriesApiService);

    readonly snapshot = signal<StorySnapshotDto | null>(null);
    readonly timeline = signal<StoryTimelineItem[]>([]);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    private currentSlug = '';

    private sceneKey(slug: string): string {
        return `br1games.story.${slug}.sceneId`;
    }

    private statsKey(slug: string): string {
        return `br1games.story.${slug}.stats`;
    }

    private loadSavedStats(slug: string): Record<string, number> | null {
        const raw = localStorage.getItem(this.statsKey(slug));
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }

    async init(slug: string): Promise<void> {
        this.currentSlug = slug;
        this.snapshot.set(null);
        this.timeline.set([]);
        this.loading.set(true);
        this.error.set(null);

        try {
            const savedSceneId = localStorage.getItem(this.sceneKey(slug));
            const savedStats = this.loadSavedStats(slug);

            if (savedSceneId && savedStats) {
                try {
                    const snap = await firstValueFrom(this.api.resumeStory(slug, savedSceneId, savedStats));
                    this.applySnapshot(snap);
                    return;
                } catch {
                    // Saved state no longer valid (story updated?), restart
                    localStorage.removeItem(this.sceneKey(slug));
                    localStorage.removeItem(this.statsKey(slug));
                }
            }

            const snap = await firstValueFrom(this.api.startStory(slug));
            this.applySnapshot(snap);
        } catch {
            this.error.set('Errore nel caricamento della storia.');
        } finally {
            this.loading.set(false);
        }
    }

    async choose(choiceId: string): Promise<void> {
        const current = this.snapshot();
        if (!current) return;

        const chosenChoice = current.choices.find(c => c.id === choiceId);

        this.loading.set(true);
        this.error.set(null);

        try {
            const next = await firstValueFrom(
                this.api.choose(this.currentSlug, current.sceneId, choiceId, current.stats)
            );

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

            this.timeline.update(items => [...items, ...newItems]);
            this.applySnapshot(next);
        } catch {
            this.error.set('Errore nella scelta.');
        } finally {
            this.loading.set(false);
        }
    }

    async restart(): Promise<void> {
        localStorage.removeItem(this.sceneKey(this.currentSlug));
        localStorage.removeItem(this.statsKey(this.currentSlug));
        this.loading.set(true);
        this.error.set(null);
        this.timeline.set([]);

        try {
            const snap = await firstValueFrom(this.api.startStory(this.currentSlug));
            this.applySnapshot(snap);
        } catch {
            this.error.set('Errore nel riavvio.');
        } finally {
            this.loading.set(false);
        }
    }

    private applySnapshot(snap: StorySnapshotDto): void {
        this.snapshot.set(snap);
        localStorage.setItem(this.sceneKey(this.currentSlug), snap.sceneId);
        localStorage.setItem(this.statsKey(this.currentSlug), JSON.stringify(snap.stats ?? {}));

        if (this.timeline().length === 0) {
            if (snap.isEnding) {
                this.timeline.set([{ type: 'ending', sceneId: snap.sceneId, text: snap.sceneText, title: snap.endingTitle }]);
            } else {
                this.timeline.set([{ type: 'scene', sceneId: snap.sceneId, text: snap.sceneText }]);
            }
        }
    }
}
