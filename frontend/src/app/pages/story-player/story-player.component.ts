import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PageMetaService } from '../../core/services/page-meta.service';
import { ContestoSito } from '../../site';
import { PageType } from '../../site';
import { StoryPlayerFacade } from '../../core/services/story-player.facade';
import { AssetService } from '../../core/services/asset.service';
import { StoryInfo } from '../../core/dto/story.dto';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { PageBaseComponent } from '../page-base.component';

@Component({
    selector: 'app-story-player',
    imports: [TranslatePipe, MarkdownPipe],
    templateUrl: './story-player.component.html',
    styleUrl: './story-player.component.css'
})
export class StoryPlayerComponent extends PageBaseComponent implements OnInit {
    private readonly router = inject(Router);
    private readonly pageMeta = inject(PageMetaService);
    private readonly document = inject(DOCUMENT);
    readonly facade = inject(StoryPlayerFacade);
    readonly assets = inject(AssetService);

    readonly storyInfo = computed(() => this.pageContent() as StoryInfo | null);

    constructor() {
        super();

        effect(() => {
            this.translate.currentLang();
            const title = this.facade.title() || this.storyInfo()?.title || '';
            this.updatePageMeta(title);
        });
    }

    async ngOnInit(): Promise<void> {
        // Il play della storia usa POST e localStorage: ha senso solo nel browser.
        // L'SSR si occupa solo del rendering del meta SEO tramite il resolver statico.
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            await this.initStory();
        } catch (error) {
            if (error instanceof HttpErrorResponse && error.status === 404) {
                await this.router.navigateByUrl('/error/404');
            }
        }
    }

    // ── Dispatch per storia ───────────────────────────────────────────

    private initStory(): Promise<void> {
        switch (this.pageType()) {
            case PageType.StoryPoveriMaschi: return this.facade.initPoveriMaschi();
            case PageType.StoryMagrogamer09: return this.facade.initMagrogamer09();
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

    getSceneImageUrl(sceneId: string): string | null {
        const storySlug = this.facade.snapshot()?.storySlug;
        return null;
        if (!storySlug) {
            return null;
        }

        return this.assets.getUrl(`story.${storySlug}.${sceneId}`);
    }

    private updatePageMeta(storyTitle: string): void {
        if (!storyTitle) return;
        const title = `${this.translate.translate('avventuraPlayer', storyTitle)} | ${ContestoSito.config.appName}`;
        const description = this.storyInfo()?.description ?? ContestoSito.config.description;
        this.pageMeta.setTitle(title, description);
    }
}
