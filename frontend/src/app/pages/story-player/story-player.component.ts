import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
    readonly facade = inject(StoryPlayerFacade);
    readonly assets = inject(AssetService);

    async ngOnInit(): Promise<void> {
        const slug = this.route.snapshot.paramMap.get('slug') ?? '';
        await this.facade.init(slug);
    }

    choose(choiceId: string): void {
        this.facade.choose(choiceId);
    }

    restart(): void {
        this.facade.restart();
        window.scrollTo(0, 0);
    }
}
