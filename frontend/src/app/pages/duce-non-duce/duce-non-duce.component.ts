import { afterNextRender, Component, OnDestroy, signal, computed, inject } from '@angular/core';
import { AssetDirective } from '../../core/engine/directives/asset.directive';
import { CookieConsentService } from '../../core/engine/services/cookie-consent.service';
import { PageBaseComponent } from '../page-base.component';
import { FitViewportDirective } from '../../core/engine/directives/fit-viewport.directive';

const IMAGES = [
    'duce1',
    'duce2',
    'duce3',
    'duce33',
    'nonduce1',
    'nonduce2',
    'nonduce3',
    'nonduce4',
    'nonduce5',
    'nonduce6',
    'nonduce7',
    'nonduce8',
    'nonduce9',
    'nonduce10',
    'nonduce11',
    'nonduce12',
    'nonduce13',
    'nonduce14',
    'nonduce15',
] as const;

type ImageId = typeof IMAGES[number];

interface RecordEntry { score: number; time: number; }

@Component({
    selector: 'app-duce-non-duce',
    standalone: true,
    imports: [AssetDirective, FitViewportDirective],
    templateUrl: './duce-non-duce.component.html',
    styleUrl: './duce-non-duce.component.css'
})
export class DuceNonDuceComponent extends PageBaseComponent<void> implements OnDestroy {
    private readonly cookies = inject(CookieConsentService);

    readonly gameActive = signal(false);
    readonly score = signal(0);
    readonly time = signal(0);
    readonly record = signal<RecordEntry | null>(null);
    readonly currentImage = signal<ImageId | null>(null);
    readonly currentImageAssetId = computed(() => {
        const img = this.currentImage();
        return img ? `ducenonduce-${img}` : null;
    });
    readonly formattedTime = computed(() => this.formatTime(this.time()));
    readonly formattedRecordTime = computed(() => {
        const r = this.record();
        return r ? this.formatTime(r.time) : null;
    });

    private readonly imageCache = new Set<number>();
    private timerId: ReturnType<typeof setInterval> | null = null;

    constructor() {
        super();
        afterNextRender(() => {
            const saved = this.cookies.getCookie('duceNonDuceRecord');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (typeof parsed === 'number') {
                        // retrocompatibilità: vecchio formato era solo il punteggio
                        this.record.set({ score: parsed, time: 0 });
                    } else {
                        this.record.set(parsed as RecordEntry);
                    }
                } catch {
                    this.record.set(null);
                }
            }
        });
    }

    ngOnDestroy(): void {
        this.stopTimer();
    }

    startGame(): void {
        this.gameActive.set(true);
        this.score.set(0);
        this.imageCache.clear();
        this.nextImage();
        this.startTimer();
    }

    answer(isDuce: boolean): void {
        const img = this.currentImage();
        if (!img) return;

        if (isDuce === img.toUpperCase().startsWith('DUCE')) {
            this.score.update(s => s + 1);
            this.saveRecord();
            this.nextImage();
        } else {
            this.stopTimer();
            this.gameActive.set(false);
            this.notify.error(
                "L'Imperator non sarebbe contento",
                `Hai totalizzato ${this.score()} punti in ${this.formattedTime()}`
            );
        }
    }

    resetRecord(): void {
        this.record.set(null);
        this.cookies.removeCookie('duceNonDuceRecord');
    }

    private nextImage(): void {
        const idx = this.pickIndex();
        this.currentImage.set(IMAGES[idx]);
    }

    private pickIndex(): number {
        const idx = Math.floor(Math.random() * IMAGES.length);
        if (this.imageCache.has(idx)) return this.pickIndex();
        this.imageCache.add(idx);
        if (this.imageCache.size >= IMAGES.length) this.imageCache.clear();
        return idx;
    }

    private startTimer(): void {
        this.stopTimer();
        this.time.set(0);
        this.timerId = setInterval(() => this.time.update(t => t + 1), 1000);
    }

    private stopTimer(): void {
        if (this.timerId !== null) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    private saveRecord(): void {
        const current = this.record();
        const newScore = this.score();
        const newTime = this.time();
        const isBetter = !current || newScore > current.score || (newScore === current.score && newTime < current.time);
        if (isBetter) {
            const entry: RecordEntry = { score: newScore, time: newTime };
            this.record.set(entry);
            const maxAge = 60 * 60 * 24 * 365;
            this.cookies.setCookie('duceNonDuceRecord', JSON.stringify(entry), maxAge);
        }
    }

    private formatTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    }
}
