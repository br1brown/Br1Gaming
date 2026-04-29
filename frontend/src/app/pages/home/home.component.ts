import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
    styleUrl: './home.component.css'
})
export class HomeComponent extends PageBaseComponent implements OnInit {
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
                const url = this.assets.getUrl(`story.${s.slug}`);
                try {
                    throw new Error("immettere immagini");
                    const response = await fetch(url, { method: 'HEAD' });
                    if (response.ok) {
                        urls[s.slug] = url;
                    }
                } catch {
                    // L'immagine e' opzionale: se manca, la card resta senza cover.
                }
            }));
            this.coverUrls.set(urls);
        } catch {
            this.notify.handleApiError(500, null);
        } finally {
            this.loading.set(false);
        }
    }
}
