import { Component, computed } from '@angular/core';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { ContentCardComponent } from '../../shared/components/content-card/content-card.component';
import { PageBaseComponent } from '../page-base.component';
import { HomeContent } from '../content.resolver';
import { PageType } from '../../site';

interface CardEntry {
    title: string;
    subtitle: string | null;
    imageId: string | null;
    pageType: PageType;
}

const GENERATOR_PAGE_TYPES: Partial<Record<string, PageType>> = {
    'incel': PageType.GeneratorIncel,
    'auto': PageType.GeneratorAuto,
    'antiveg': PageType.GeneratorAntiveg,
    'locali': PageType.GeneratorLocali,
    'mbeb': PageType.GeneratorMbeb,
};

const STORY_PAGE_TYPES: Partial<Record<string, PageType>> = {
    'poveri-maschi': PageType.StoryPoveriMaschi,
    'magrogamer09': PageType.StoryMagrogamer09,
    'sopravvivi-agli-usa': PageType.StorySurviveUsa,
};

const STATIC_GIOCHI: CardEntry[] = [
    {
        title: 'Duce o Non Duce?',
        subtitle: "Indovina se la persona è un duce o non duce. Da un'idea di Valerio Lundini.",
        imageId: 'game.ducenonduce',
        pageType: PageType.GameDuceNonDuce,
    },
    {
        title: 'Dragon Radar',
        subtitle: 'Il radar delle chiese, in stile sfere del drago: apri la mappa e vedi quelle intorno a te.',
        imageId: 'game.radar',
        pageType: PageType.GameRadar,
    },
];

@Component({
    selector: 'app-home',
    imports: [TranslatePipe, ContentCardComponent],
    templateUrl: './home.component.html',
})
export class HomeComponent extends PageBaseComponent<HomeContent> {

    readonly generatori = computed<CardEntry[]>(() => {
        const content = this.pageContent();
        if (!content) return [];
        return content.generators
            .filter(g => g.slug in GENERATOR_PAGE_TYPES)
            .map(g => ({
                title: g.name,
                subtitle: g.description ?? null,
                imageId: `generator.${g.slug}`,
                pageType: GENERATOR_PAGE_TYPES[g.slug]!,
            }));
    });

    readonly giochi = computed<CardEntry[]>(() => {
        const content = this.pageContent();
        const fromApi: CardEntry[] = content
            ? content.stories
                .filter(s => s.slug in STORY_PAGE_TYPES)
                .map(s => ({
                    title: s.title,
                    subtitle: s.description ?? null,
                    imageId: `story.${s.slug}`,
                    pageType: STORY_PAGE_TYPES[s.slug]!,
                }))
            : [];
        return [...STATIC_GIOCHI, ...fromApi];
    });
}
