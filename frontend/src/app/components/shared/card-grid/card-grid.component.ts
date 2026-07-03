import { Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { ContentCardComponent } from '../content-card/content-card.component';
import { PageType } from '../../../site';

/** Una voce della griglia: titolo, sottotitolo, immagine e pagina di destinazione. */
export interface CardEntry {
    title: string;
    subtitle: string | null;
    imageId: string | null;
    pageType: PageType;
}

/** Minuscolo + senza accenti: rende la ricerca tollerante a maiuscole e diacritici ("città" ≈ "citta"). */
function fold(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Griglia di card con ripiegamento responsivo: mostra le prime N card e, se ce ne sono altre, un
 * pulsante "Mostra tutti / Mostra meno". Le soglie sono per breakpoint (default 2 su mobile, 4 da
 * desktop): la differenza è puramente responsive, quindi non si taglia l'array (darebbe un solo
 * numero) — si rendono tutte le card e si nascondono le eccedenti con le utility Bootstrap.
 *
 * Oltre `searchThreshold` card (default 10) compare una barra di ricerca unica che filtra per nome
 * o descrizione: con una lista corta cercare non serve, quindi la barra resta nascosta. Mentre si
 * cerca il ripiegamento è sospeso (si vedono tutti i risultati, non solo i primi N).
 */
@Component({
    selector: 'app-card-grid',
    standalone: true,
    imports: [TranslatePipe, ContentCardComponent],
    templateUrl: './card-grid.component.html',
})
export class CardGridComponent {
    /** Le card da mostrare, già pronte (l'ordine dell'array è l'ordine di render). */
    readonly items = input.required<CardEntry[]>();
    /** Quante card mostra la vista ripiegata su mobile (< md). */
    readonly collapseMobile = input(2);
    /** Quante card mostra la vista ripiegata da desktop (≥ md). */
    readonly collapseDesktop = input(4);
    /** Classi di colonna di ogni card. Default: 2 per riga da desktop. Le sezioni a mezza pagina
     *  (storie/giochi affiancati) passano 'col-12' per impilare le card in colonna singola. */
    readonly itemColClass = input('col-12 col-md-6');
    /** Sopra questo numero di card compare la barra di ricerca (liste corte non ne hanno bisogno). */
    readonly searchThreshold = input(10);

    /** L'utente ha premuto "Mostra tutti": la lista resta espansa per il resto della visita. */
    protected readonly espanso = signal(false);
    /** Testo digitato nella barra di ricerca. */
    protected readonly query = signal('');

    /** La lista è abbastanza lunga da giustificare la ricerca. */
    readonly searchable = computed<boolean>(() => this.items().length > this.searchThreshold());
    /** Query normalizzata (minuscole, senza accenti); vuota = nessun filtro attivo. */
    private readonly normalizedQuery = computed<string>(() => fold(this.query().trim()));
    /** true mentre si sta cercando: sospende il ripiegamento (mostra tutti i risultati). */
    readonly searching = computed<boolean>(() => this.searchable() && this.normalizedQuery().length > 0);

    /** Le card effettivamente rese: tutte, o solo quelle che matchano nome/descrizione se si cerca. */
    readonly visibleItems = computed<CardEntry[]>(() => {
        const q = this.normalizedQuery();
        if (!this.searchable() || !q) return this.items();
        return this.items().filter(it =>
            fold(it.title).includes(q) || (it.subtitle ? fold(it.subtitle).includes(q) : false));
    });

    /** Ripiegamento attivo (nasconde le eccedenti): solo a lista intera, mai durante una ricerca. */
    readonly collapsed = computed<boolean>(() => !this.espanso() && !this.searching());
    /** Serve il pulsante: almeno un breakpoint nasconde qualcosa (mobile è la soglia più bassa). */
    readonly espandibile = computed<boolean>(() => !this.searching() && this.visibleItems().length > this.collapseMobile());
    /** Il ripiegamento riguarda solo il mobile (da desktop ci stanno tutte): pulsante nascosto ≥ md. */
    readonly soloMobile = computed<boolean>(() => this.visibleItems().length <= this.collapseDesktop());
}
