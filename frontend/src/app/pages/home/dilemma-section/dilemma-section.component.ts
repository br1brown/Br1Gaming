import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { ApiService } from '../../../core/services/api.service';
import { PageType } from '../../../site';

interface StoryTeaser {
    slug: string;
    title: string;
    description: string | null;
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

    /** Per il link nel template: un solo PageType per tutte le storie (/avventura/:slug), lo slug
     *  viaggia a parte via `[appPageParams]`. */
    protected readonly storyPageType = PageType.Storia;

    /** Titolo/descrizione così come arrivano dal backend, nessuna storia esclusa: un solo PageType
     *  per tutte (/avventura/:slug), ogni storia del backend ha già una pagina. */
    readonly stories = computed<StoryTeaser[]>(() =>
        (this.resource.value() ?? [])
            .map(s => ({
                slug: s.slug,
                title: s.title,
                description: s.description ?? null,
            })));
}
