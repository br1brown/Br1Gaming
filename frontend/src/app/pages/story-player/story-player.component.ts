import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { Component, effect, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PageMetaService } from '../../core/services/page-meta.service';
import { ContestoSito } from '../../site';
import { PageType } from '../../app.routes';
import { StoryPlayerFacade } from '../../core/services/story-player.facade';
import { AssetService } from '../../core/services/asset.service';
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

    constructor() {
        super();

        effect(() => {
            this.translate.currentLang();
            this.updatePageMeta(this.facade.title());
        });
    }

    async ngOnInit(): Promise<void> {
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
        switch (this.PageType) {
            case PageType.StoryPoveriMaschi: return this.facade.initPoveriMaschi();
            case PageType.StoryMagrogamer09: return this.facade.initMagrogamer09();
            default: throw new Error(`PageType non è una storia: ${this.PageType}`);
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
        const raw = storyTitle
            ? this.translate.translate('avventuraPlayer', storyTitle)
            : this.translate.translate('avventure');
        const title = `${raw} | ${ContestoSito.config.appName}`;
        this.pageMeta.setTitle(title, ContestoSito.config.description);
    }
}
