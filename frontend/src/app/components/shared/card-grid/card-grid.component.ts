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

/**
 * Griglia di card con ripiegamento responsivo: mostra le prime N card e, se ce ne sono altre, un
 * pulsante "Mostra tutti / Mostra meno". Le soglie sono per breakpoint (default 2 su mobile, 4 da
 * desktop): la differenza è puramente responsive, quindi non si taglia l'array (darebbe un solo
 * numero) — si rendono tutte le card e si nascondono le eccedenti con le utility Bootstrap.
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

    /** L'utente ha premuto "Mostra tutti": la lista resta espansa per il resto della visita. */
    protected readonly espanso = signal(false);

    /** Serve il pulsante: almeno un breakpoint nasconde qualcosa (mobile è la soglia più bassa). */
    readonly espandibile = computed<boolean>(() => this.items().length > this.collapseMobile());
    /** Il ripiegamento riguarda solo il mobile (da desktop ci stanno tutte): pulsante nascosto ≥ md. */
    readonly soloMobile = computed<boolean>(() => this.items().length <= this.collapseDesktop());
}
