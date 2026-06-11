import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PageType } from '../../site';
import { StoryPlayerFacade } from '../../core/services/story-player.facade';
import { ApiError } from '../../core/engine/services/base-api.service';
import { StoryInfo } from '../../core/dto/story.dto';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { MarkdownPipe } from '../../core/engine/pipes/markdown.pipe';
import { AssetDirective } from '../../core/engine/directives/asset.directive';
import { PageBaseComponent } from '../page-base.component';

@Component({
    selector: 'app-story-player',
    imports: [TranslatePipe, MarkdownPipe, AssetDirective],
    templateUrl: './story-player.component.html',
    host: { class: 'd-block' },
})
export class StoryPlayerComponent extends PageBaseComponent<StoryInfo> {
    private readonly router = inject(Router);
    private readonly document = inject(DOCUMENT);
    readonly facade = inject(StoryPlayerFacade);

    readonly storyInfo = computed(() => this.pageContent());
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

    // ── Dispatch per storia ───────────────────────────────────────────

    private initStory(): Promise<void> {
        switch (this.pageType()) {
            case PageType.StoryPoveriMaschi: return this.facade.initPoveriMaschi();
            case PageType.StoryMagrogamer09: return this.facade.initMagrogamer09();
            case PageType.StorySurviveUsa: return this.facade.initSurviveUsa();
            default: throw new Error(`PageType non è una storia: ${this.pageType()}`);
        }
    }

    choose(choiceId: string): void {
        this.facade.choose(choiceId);
    }

    restart(): void {
        this.facade.restart();
        this.document.defaultView?.scrollTo(0, 0);
    }

}
