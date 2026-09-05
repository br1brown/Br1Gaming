import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { AssetDirective } from '../../../core/engine/directives/asset.directive';
import { ApiService } from '../../../core/services/api.service';
import { PageType } from '../../../site';

interface StoryTeaser {
    slug: string;
    title: string;
    description: string | null;
    /** Stesso contratto slug→id dei generatori (`generator.<slug>`): nessuna mappa da tenere
     *  aggiornata, una storia nuova prende l'immagine da sola se il file esiste in mapping.json. */
    imageId: string;
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
    imports: [TranslatePipe, PageDirective, AssetDirective],
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

    /** Slug delle storie la cui immagine di copertina è mancante/rotta: la card ripiega sul
     *  trattamento testuale invece di lasciare un riquadro vuoto (stesso spirito di
     *  ContentCardComponent.onImageError per i generatori, qui per-item). */
    protected readonly brokenImages = signal(new Set<string>());

    protected onImageError(slug: string): void {
        this.brokenImages.update(set => new Set(set).add(slug));
    }

    /** Titolo/descrizione così come arrivano dal backend, nessuna storia esclusa: un solo PageType
     *  per tutte (/avventura/:slug), ogni storia del backend ha già una pagina. */
    readonly stories = computed<StoryTeaser[]>(() =>
        (this.resource.value() ?? [])
            .map(s => ({
                slug: s.slug,
                title: s.title,
                description: s.description ?? null,
                imageId: `story.${s.slug}`,
            })));
}
