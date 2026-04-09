import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { PageBaseComponent } from '../page-base.component';
import { ContestoSito } from '../../site';
import { GeneratorInfo } from '../../core/dto/generator.dto';
import { StorySummary } from '../../core/dto/story.dto';
import { GeneratorsApiService } from '../../core/services/generators-api.service';
import { StoriesApiService } from '../../core/services/stories-api.service';

@Component({
    selector: 'app-home',
    imports: [TranslatePipe, RouterLink],
    templateUrl: './home.component.html',
})
export class HomeComponent extends PageBaseComponent implements OnInit {
    private readonly generatorsApi = inject(GeneratorsApiService);
    private readonly storiesApi = inject(StoriesApiService);

    readonly appName = ContestoSito.config.appName;
    readonly appDescription = ContestoSito.config.description;
    readonly generators = signal<GeneratorInfo[]>([]);
    readonly stories = signal<StorySummary[]>([]);
    readonly loading = signal(false);

    async ngOnInit(): Promise<void> {
        this.loading.set(true);
        try {
            const [gens, strs] = await Promise.all([
                firstValueFrom(this.generatorsApi.getGenerators()),
                firstValueFrom(this.storiesApi.getStories())
            ]);
            this.generators.set(gens);
            this.stories.set(strs);
        } catch {
            this.notify.handleApiError(500, null);
        } finally {
            this.loading.set(false);
        }
    }
}
