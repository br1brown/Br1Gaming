import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { ContentCardComponent } from '../../components/shared/content-card/content-card.component';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { PageBaseComponent } from '../page-base.component';
import { HomeContent } from '../content.resolver';
import { PageType } from '../../site';
import { SITE_CONFIG } from '../../core/engine/siteBuilder';

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

// I giochi "non-storia": stanno fuori dal gruppo Storie, come nel menu.
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
    {
        title: 'Burocrazia',
        subtitle: 'Attraversa la città a colpi di passaggi in auto e chiudi la pratica prima che chiudano gli sportelli.',
        imageId: 'game.burocrazia',
        pageType: PageType.GameBurocrazia,
    },
];

@Component({
    selector: 'app-home',
    imports: [TranslatePipe, ContentCardComponent, PageDirective],
    templateUrl: './home.component.html',
})
export class HomeComponent extends PageBaseComponent<HomeContent> {
    /** Per i link interni nel template (es. CTA verso la Galleria). */
    protected readonly PageType = PageType;
    /** Nome del sito dalla config (niente stringhe hardcoded nell'hero). */
    protected readonly appName = inject(SITE_CONFIG).appName;
    /** Slot per lo scheletro del @placeholder (idratazione incrementale delle sezioni sotto la piega). */
    protected readonly skeletonSlots = [0, 1, 2];

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

    readonly storie = computed<CardEntry[]>(() => {
        const content = this.pageContent();
        if (!content) return [];
        return content.stories
            .filter(s => s.slug in STORY_PAGE_TYPES)
            .map(s => ({
                title: s.title,
                subtitle: s.description ?? null,
                imageId: `story.${s.slug}`,
                pageType: STORY_PAGE_TYPES[s.slug]!,
            }));
    });

    readonly giochi: CardEntry[] = STATIC_GIOCHI;
}
