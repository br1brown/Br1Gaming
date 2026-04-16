import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { PageBaseComponent } from '../page-base.component';
import { ContestoSito } from '../../site';
import { GeneratorInfo } from '../../core/dto/generator.dto';
import { StorySummary } from '../../core/dto/story.dto';
import { ApiService } from '../../core/services/api.service';
import { AssetService } from '../../core/services/asset.service';

@Component({
    selector: 'app-home',
    imports: [TranslatePipe, RouterLink],
    templateUrl: './home.component.html',
})
export class HomeComponent extends PageBaseComponent implements OnInit {
    private readonly api = inject(ApiService);
    private readonly assets = inject(AssetService);

    readonly appName = ContestoSito.config.appName;
    readonly appDescription = ContestoSito.config.description;
    readonly generators = signal<GeneratorInfo[]>([]);
    readonly stories = signal<StorySummary[]>([]);
    readonly coverUrls = signal<Record<string, string>>({});
    readonly loading = signal(false);

    async ngOnInit(): Promise<void> {
        this.loading.set(true);
        try {
            const [gens, strs] = await Promise.all([
                this.api.getGenerators(),
                this.api.getStories()
            ]);
            this.generators.set(gens);
            this.stories.set(strs);

            const urls: Record<string, string> = {};
            await Promise.all(strs.map(async s => {
                urls[s.slug] = await firstValueFrom(this.assets.getUrl(`story.${s.slug}`));
            }));
            this.coverUrls.set(urls);
        } catch {
            this.notify.handleApiError(500, null);
        } finally {
            this.loading.set(false);
        }
    }
}
