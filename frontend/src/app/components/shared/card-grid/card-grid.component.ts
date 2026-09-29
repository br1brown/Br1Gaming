import { Component, computed, input, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../core/engine/components/empty-state/empty-state.component';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { ContentCardComponent } from '../content-card/content-card.component';
import { PageType } from '../../../site';

/** Una voce della griglia: titolo, sottotitolo, immagine e pagina di destinazione. */
export interface CardEntry {
    title: string;
    subtitle: string | null;
    imageId: string | null;
    pageType: PageType;
    /** Valori per gli eventuali segmenti `:xxx` del path (pagine parametriche, es. i generatori). */
    params?: Record<string, string>;
}

/** Minuscolo + senza accenti: rende la ricerca tollerante a maiuscole e diacritici ("città" ≈ "citta"). */
function fold(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Griglia di card: le mostra tutte (la pagina che la ospita è già dedicata all'elenco, quindi
 * niente ripiegamento né "Mostra tutti").
 *
 * Oltre `searchThreshold` card (default 10) compare una barra di ricerca unica che filtra per nome
 * o descrizione: con una lista corta cercare non serve, quindi la barra resta nascosta.
 */
@Component({
    selector: 'app-card-grid',
    standalone: true,
    imports: [EmptyStateComponent, TranslatePipe, ContentCardComponent],
    templateUrl: './card-grid.component.html',
})
export class CardGridComponent {
    /** Le card da mostrare, già pronte (l'ordine dell'array è l'ordine di render). */
    readonly items = input.required<CardEntry[]>();
    /** Classi di colonna di ogni card. Default: 2 per riga da desktop. Le sezioni a mezza pagina
     *  (storie/giochi affiancati) passano 'col-12' per impilare le card in colonna singola. */
    readonly itemColClass = input('col-12 col-md-6');
    /** Sopra questo numero di card compare la barra di ricerca (liste corte non ne hanno bisogno). */
    readonly searchThreshold = input(10);

    /** Testo digitato nella barra di ricerca. */
    protected readonly query = signal('');

    /** La lista è abbastanza lunga da giustificare la ricerca. */
    readonly searchable = computed<boolean>(() => this.items().length > this.searchThreshold());
    /** Query normalizzata (minuscole, senza accenti); vuota = nessun filtro attivo. */
    private readonly normalizedQuery = computed<string>(() => fold(this.query().trim()));

    /** Le card effettivamente rese: tutte, o solo quelle che matchano nome/descrizione se si cerca. */
    readonly visibleItems = computed<CardEntry[]>(() => {
        const q = this.normalizedQuery();
        if (!this.searchable() || !q) return this.items();
        return this.items().filter(it =>
            fold(it.title).includes(q) || (it.subtitle ? fold(it.subtitle).includes(q) : false));
    });
}
