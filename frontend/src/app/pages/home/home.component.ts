import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { CardGridComponent, CardEntry } from '../../components/shared/card-grid/card-grid.component';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { HomeContent } from '../content.resolver';
import { PageType } from '../../site';
import { SITE_CONFIG } from '../../core/engine/siteBuilder';

const GENERATOR_PAGE_TYPES: Partial<Record<string, PageType>> = {
    'incel': PageType.GeneratorIncel,
    'startup': PageType.GeneratorStartup,
    'auto': PageType.GeneratorAuto,
    'antiveg': PageType.GeneratorAntiveg,
    'locali': PageType.GeneratorLocali,
    'kebab': PageType.GeneratorKebab,
    'mbeb': PageType.GeneratorMbeb,
};

const STORY_PAGE_TYPES: Partial<Record<string, PageType>> = {
    'poveri-maschi': PageType.StoryPoveriMaschi,
    'magrogamer09': PageType.StoryMagrogamer09,
    'sopravvivi-agli-usa': PageType.StorySurviveUsa,
};

// I giochi "non-storia": stanno fuori dal gruppo Storie, come nel menu. In home Burocrazia va per prima
// (ordine indipendente da quello delle route/navbar).
const STATIC_GIOCHI: CardEntry[] = [
    {
        title: 'Burocrazia',
        subtitle: 'Attraversa la città a colpi di passaggi in auto e chiudi la pratica prima che chiudano gli sportelli.',
        imageId: 'game.burocrazia',
        pageType: PageType.GameBurocrazia,
    },
    {
        title: 'Duce o Non Duce?',
        subtitle: "Indovina se la persona è un duce o non duce. Da un'idea di Valerio Lundini.",
        imageId: 'game.ducenonduce',
        pageType: PageType.GameDuceNonDuce,
    },
    {
        title: 'Chiese Radar',
        subtitle: 'Il radar delle chiese: apri la mappa e vedi quelle intorno a te.',
        imageId: 'game.radar',
        pageType: PageType.GameRadar,
    },
];

@Component({
    selector: 'app-home',
    imports: [TranslatePipe, CardGridComponent, PageDirective],
    templateUrl: './home.component.html',
})
export class HomeComponent extends PageBaseComponent<HomeContent> {
    /** Per i link interni nel template (es. CTA verso i Condivisi). */
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
