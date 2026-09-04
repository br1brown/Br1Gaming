import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { ApiService } from '../../../core/services/api.service';
import { PageType } from '../../../site';

/** slug della storia → PageType della sua pagina: dall'elenco che arriva dal backend si tengono
 *  solo le storie con una pagina propria. */
const STORY_PAGE_TYPES: Partial<Record<string, PageType>> = {
    'poveri-maschi': PageType.StoryPoveriMaschi,
    'magrogamer09': PageType.StoryMagrogamer09,
    'sopravvivi-agli-usa': PageType.StorySurviveUsa,
};

interface StoryTeaser {
    slug: string;
    title: string;
    description: string | null;
    pageType: PageType;
}

/**
 * Sezione "Storie": titolo e descrizione VERI, presi dal catalogo del backend — solo il
 * trattamento grafico è diverso (bento card invece di riga di lista), non il contenuto. Nessuna
 * trama reinventata: se la card non basta a capire di cosa parla la storia, il problema è la
 * descrizione nel catalogo, non un testo scritto qui sopra per finta.
 */
@Component({
    selector: 'app-dilemma-section',
    standalone: true,
    imports: [TranslatePipe, PageDirective],
    templateUrl: './dilemma-section.component.html',
    styleUrl: './dilemma-section.component.css',
})
export class DilemmaSectionComponent {
    private readonly api = inject(ApiService);

    protected readonly skeletonSlots = [0, 1, 2];

    private readonly resource = this.api.storiesResource();
    readonly loading = this.resource.isLoading;

    /** Solo le storie con una pagina propria, con titolo/descrizione così come arrivano dal backend. */
    readonly stories = computed<StoryTeaser[]>(() =>
        (this.resource.value() ?? [])
            .filter(s => s.slug in STORY_PAGE_TYPES)
            .map(s => ({
                slug: s.slug,
                title: s.title,
                description: s.description ?? null,
                pageType: STORY_PAGE_TYPES[s.slug]!,
            })));
}
