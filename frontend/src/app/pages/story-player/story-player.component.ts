import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { PageType } from '../../site';
import { StoryPlayerFacade } from '../../core/services/story-player.facade';
import { ApiError } from '../../core/engine/services/base-api.service';
import { StoryInfo } from '../../core/dto/story.dto';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { AssetDirective } from '../../core/engine/directives/asset.directive';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';

@Component({
    selector: 'app-story-player',
    imports: [
        TranslatePipe,
        MarkdownPipe,
        AssetDirective,
        NgTemplateOutlet,
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

    async restart(): Promise<void> {
        // Azione distruttiva: conferma prima di cancellare la timeline salvata.
        // Usa la modale dell'engine (NotificationService → SweetAlert2, già a tema chiaro/scuro),
        // non il confirm() nativo del browser: coerenza visiva con il resto dell'app.
        const confirmed = await this.notify.confirm(
            this.translate.translate('riavvia'),
            this.translate.translate('riavvia_conferma'),
            { icon: 'warning' }
        );
        if (!confirmed) return;
        this.facade.restart();
        this.document.defaultView?.scrollTo(0, 0);
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

    // Immagine del finale assente o non caricabile (asset id senza file, rete): nascondi l'elemento
    // così la card resta pulita col solo testo, senza l'icona di immagine rotta.
    hideBrokenImage(event: Event): void {
        (event.target as HTMLElement | null)?.style.setProperty('display', 'none');
    }

}
