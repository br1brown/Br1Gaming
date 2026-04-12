import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PageMetaService } from '../../core/services/page-meta.service';
import { ContestoSito } from '../../site';
import { StoryPlayerFacade } from '../../core/services/story-player.facade';
import { AssetService } from '../../core/services/asset.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { PageBaseComponent } from '../page-base.component';

@Component({
    selector: 'app-story-player',
    imports: [AsyncPipe, TranslatePipe, MarkdownPipe],
    templateUrl: './story-player.component.html',
})
export class StoryPlayerComponent extends PageBaseComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly pageMeta = inject(PageMetaService);
    readonly facade = inject(StoryPlayerFacade);
    readonly assets = inject(AssetService);
    private readonly defaultPageDescription = this.route.snapshot.data['pageDescription'] as string | null | undefined;

    constructor() {
        super();

        effect(() => {
            this.translate.currentLang();
            this.updatePageMeta(this.facade.title());
        });
    }

    async ngOnInit(): Promise<void> {
        const slug = this.route.snapshot.paramMap.get('slug') ?? '';
        try {
            await this.facade.init(slug);
        } catch (error) {
            if (error instanceof HttpErrorResponse && error.status === 404) {
                await this.router.navigateByUrl('/error/404');
            }
        }
    }

    choose(choiceId: string): void {
        this.facade.choose(choiceId);
    }

    restart(): void {
        this.facade.restart();
        window.scrollTo(0, 0);
    }

    private updatePageMeta(storyTitle: string): void {
        const raw = storyTitle
            ? this.translate.translate('avventuraPlayer', storyTitle)
            : this.translate.translate('avventure');
        const title = `${raw} | ${ContestoSito.config.appName}`;
        const description = this.defaultPageDescription ?? ContestoSito.config.description;

        this.pageMeta.setTitle(title, description);
    }
}
