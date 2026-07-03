import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { CardGridComponent, CardEntry } from '../card-grid/card-grid.component';
import { ApiService } from '../../../core/services/api.service';
import { PageType } from '../../../site';

/**
 * slug della storia → PageType della sua pagina. Come per i generatori: dall'elenco del backend si
 * tengono solo le storie con una pagina propria, collegandole alla rotta. Esportata per non ripetere
 * la mappa in chi rende l'elenco.
 */
export const STORY_PAGE_TYPES: Partial<Record<string, PageType>> = {
    'poveri-maschi': PageType.StoryPoveriMaschi,
    'magrogamer09': PageType.StoryMagrogamer09,
    'sopravvivi-agli-usa': PageType.StorySurviveUsa,
};

/**
 * Sezione "Storie": titolo + griglia di card delle avventure. Speculare a `generators-section`:
 * recupera da sé l'elenco (resource reattiva, attiva anche in SSR) e fa il mapping slug→card/rotta.
 */
@Component({
    selector: 'app-stories-section',
    imports: [TranslatePipe, CardGridComponent],
    templateUrl: './stories-section.component.html',
})
export class StoriesSectionComponent {
    private readonly api = inject(ApiService);

    /** Classi di colonna passate alla griglia (le sezioni a mezza pagina passano 'col-12'). */
    readonly itemColClass = input('col-12 col-md-6');

    /** Slot per lo scheletro mostrato durante il caricamento. */
    protected readonly skeletonSlots = [0, 1, 2];

    /** Catalogo storie: la sezione se lo carica da sé (reattivo + SSR). */
    private readonly resource = this.api.storiesResource();
    /** true finché l'elenco è in caricamento. */
    readonly loading = this.resource.isLoading;

    /** Solo le storie con una pagina propria, mappate a card pronte per la griglia. */
    readonly cards = computed<CardEntry[]>(() =>
        (this.resource.value() ?? [])
            .filter(s => s.slug in STORY_PAGE_TYPES)
            .map(s => ({
                title: s.title,
                subtitle: s.description ?? null,
                imageId: `story.${s.slug}`,
                pageType: STORY_PAGE_TYPES[s.slug]!,
            }))
    );
}
