import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { CardGridComponent, CardEntry } from '../card-grid/card-grid.component';
import { PageType } from '../../../site';

/**
 * Le "utility": strumenti che non sono né generatori né giochi (il radar delle chiese, il
 * traduttore ITA→ESP). Lista statica come la sezione Giochi — non arriva nulla dal backend.
 */
const STATIC_UTILITY: CardEntry[] = [
    {
        title: 'Chiese Radar',
        subtitle: 'Il radar delle chiese: apri la mappa e vedi quelle intorno a te.',
        imageId: 'game.radar',
        pageType: PageType.UtilityRadar,
    },
    {
        title: 'Translator ITA → ESP',
        subtitle: 'Traduttore italiano spagnolo, ma giuro che traduce le cose vere, giuste e perfette',
        imageId: null,
        pageType: PageType.UtilityTranslator,
    },
];

/**
 * Sezione "Utility": titolo + griglia di card. Speculare a `games-section` (lista statica,
 * nessun input di dati), riusabile in home e ovunque serva mostrare l'elenco delle utility.
 */
@Component({
    selector: 'app-utility-section',
    imports: [TranslatePipe, CardGridComponent],
    templateUrl: './utility-section.component.html',
})
export class UtilitySectionComponent {
    /** Classi di colonna passate alla griglia (le sezioni a mezza pagina passano 'col-12'). */
    readonly itemColClass = input('col-12 col-md-6');

    /** Le card delle utility, in ordine di render. */
    protected readonly cards = STATIC_UTILITY;
}
