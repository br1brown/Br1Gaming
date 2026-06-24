import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { PageType } from '../../site';
import { StoryPlayerFacade } from '../../core/services/story-player.facade';
import { ApiError } from '../../core/engine/services/base-api.service';
import { ImgBuilderService } from '../../core/engine/services/img-builder.service';
import { StoryInfo } from '../../core/dto/story.dto';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { AssetDirective } from '../../core/engine/directives/asset.directive';
import { PageBaseComponent } from '../page-base.component';
import { CopyActionComponent } from '../../components/shared/action/copy-action/copy-action.component';
import { ShareActionComponent } from '../../components/shared/action/share-action/share-action.component';
import { SpeechActionComponent } from '../../components/shared/action/speech-action/speech-action.component';

@Component({
    selector: 'app-story-player',
    imports: [
        TranslatePipe,
        MarkdownPipe,
        AssetDirective,
        NgTemplateOutlet,
        CopyActionComponent,
        ShareActionComponent,
        SpeechActionComponent,
    ],
    templateUrl: './story-player.component.html',
    styles: [`
        details > summary { cursor: pointer; list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        details[open] .story-history-caret { transform: rotate(90deg); }
        .story-scene { animation: scenePop .35s ease-out; }
        @keyframes scenePop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    `],
})
export class StoryPlayerComponent extends PageBaseComponent<StoryInfo> {
    private readonly router = inject(Router);
    private readonly document = inject(DOCUMENT);
    private readonly imgBuilder = inject(ImgBuilderService);
    readonly facade = inject(StoryPlayerFacade);

    readonly storyInfo = computed(() => this.pageContent());

    // La timeline si divide all'ULTIMA scelta: tutto ciò che viene prima va nella cronologia
    // collassabile ("Cosa è successo finora"), dall'ultima scelta in poi (scelta → conseguenza →
    // scena/finale corrente) resta in evidenza. Così la pagina non cresce all'infinito e, anche
    // alla ripresa, si atterra subito sul punto attuale invece che in cima a tutta la storia.
    private readonly splitIndex = computed(() => {
        const tl = this.facade.timeline();
        for (let i = tl.length - 1; i >= 0; i--) if (tl[i].type === 'choice') return i;
        return 0;
    });
    readonly pastTimeline = computed(() => this.facade.timeline().slice(0, this.splitIndex()));
    readonly currentTimeline = computed(() => this.facade.timeline().slice(this.splitIndex()));
    /** Numero di scelte fatte finora (indicatore di avanzamento). */
    readonly choicesMade = computed(() => this.facade.timeline().filter(i => i.type === 'choice').length);
    readonly coverAssetId = computed(() => {
        const slug = this.facade.snapshot()?.storySlug;
        return slug ? `story.${slug}` : null;
    });
    readonly coverVisible = signal(true);

    constructor() {
        super();
        afterNextRender(() => {
            void this.initStory().catch(error => {
                if (error instanceof ApiError && error.status === 404) {
                    void this.router.navigateByUrl('/error/404');
                }
            });
        });
    }

    // ── Dispatch per storia (wrapper tipizzati: niente slug a mano) ───

    private initStory(): Promise<void> {
        switch (this.pageType()) {
            case PageType.StoryPoveriMaschi: return this.facade.initPoveriMaschi();
            case PageType.StoryMagrogamer09: return this.facade.initMagrogamer09();
            case PageType.StorySurviveUsa: return this.facade.initSurviveUsa();
            default: throw new Error(`PageType non è una storia: ${this.pageType()}`);
        }
    }

    async choose(choiceId: string): Promise<void> {
        await this.facade.choose(choiceId);
        this.scrollToLatest();
    }

    restart(): void {
        const win = this.document.defaultView;
        // Azione distruttiva: conferma prima di cancellare la timeline salvata.
        if (win && !win.confirm(this.translate.translate('riavvia_conferma'))) return;
        this.facade.restart();
        win?.scrollTo(0, 0);
    }

    // Dopo una scelta porta in vista l'ultimo blocco aggiunto (la scelta → conseguenza → nuova scena),
    // così su mobile non resta fuori schermo sotto la piega.
    private scrollToLatest(): void {
        const win = this.document.defaultView;
        win?.requestAnimationFrame(() => {
            const steps = this.document.querySelectorAll('[data-step]');
            (steps[steps.length - 1] as HTMLElement | undefined)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // ── Azioni sul finale (riuso dei componenti dei generatori) ──────────

    private endingPlain(): string {
        const snap = this.facade.snapshot();
        if (!snap?.isEnding) return '';
        const title = snap.endingTitle ? `${snap.endingTitle}\n\n` : '';
        // Il testo del finale è Markdown: lo riduco a testo piano per voce/immagine/clipboard.
        const body = snap.sceneText
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/[*_`#>]/g, '')
            .trim();
        return title + body;
    }

    private endingFooter(): string {
        return `\n\nDa «${this.facade.title()}»\n${this.document.URL}`;
    }

    /** Testo del finale letto ad alta voce. */
    readonly speakEnding = (): string => this.endingPlain();

    /** Testo del finale da copiare (con firma). */
    readonly copyEnding = (): string => this.endingPlain() + this.endingFooter();

    /** Immagine del finale da condividere. */
    readonly buildEndingShareCanvas = async (): Promise<HTMLCanvasElement> => {
        const canvas = await this.imgBuilder.buildCanvas(this.endingPlain() + this.endingFooter(), { maxWidth: 1200 });
        if (!canvas) throw new Error('Errore nella generazione dell\'immagine');
        return canvas;
    };

    /** Titolo per la Web Share API. */
    readonly shareTitle = computed(() => `${this.facade.title()}: ${this.document.URL}`);

    /** Nome del file immagine condiviso. */
    readonly shareFilename = computed(() => `${this.facade.snapshot()?.storySlug ?? 'storia'}.png`);

}
