import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { CardGridComponent, CardEntry } from '../card-grid/card-grid.component';
import { PageType } from '../../../site';

/**
 * I giochi "non-storia": stanno fuori dal gruppo Storie, come nel menu. In home Burocrazia va per
 * prima (ordine indipendente da quello delle route/navbar). Lista statica: nessun dato dal backend.
 */
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

/**
 * Sezione "Giochi": titolo + griglia di card dei mini-giochi. Speculare alle altre due sezioni, ma
 * su lista statica (i giochi non arrivano dal backend), quindi senza input di dati.
 */
@Component({
    selector: 'app-games-section',
    imports: [TranslatePipe, CardGridComponent],
    templateUrl: './games-section.component.html',
})
export class GamesSectionComponent {
    /** Classi di colonna passate alla griglia (le sezioni a mezza pagina passano 'col-12'). */
    readonly itemColClass = input('col-12 col-md-6');

    /** Le card dei giochi, in ordine di render. */
    protected readonly cards = STATIC_GIOCHI;
}
