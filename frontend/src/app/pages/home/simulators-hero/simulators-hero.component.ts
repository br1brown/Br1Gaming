import { Component } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { AssetDirective } from '../../../core/engine/directives/asset.directive';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { PageType } from '../../../site';

/** Una "cabina": i due simulatori pesi massimi. Lista statica (sono sempre questi due); titolo e
 *  tagline riprendono le descrizioni reali dei giochi, non testo inventato per la home. */
interface SimulatorTile {
    slug: string;
    titleKey: string;
    taglineKey: string;
    ctaKey: string;
    imageId: string;
    pageType: PageType;
}

const SIMULATORS: SimulatorTile[] = [
    {
        slug: 'burocrazia',
        titleKey: 'heroBurocraziaTitolo',
        taglineKey: 'heroBurocraziaTagline',
        ctaKey: 'heroAvvia',
        imageId: 'game.burocrazia',
        pageType: PageType.GameBurocrazia,
    },
    {
        slug: 'umarell',
        titleKey: 'heroUmarellTitolo',
        taglineKey: 'heroUmarellTagline',
        ctaKey: 'heroAvvia',
        imageId: 'game.umarell',
        pageType: PageType.GameUmarell,
    },
];

/**
 * Sezione "I Pesi Massimi": i due simulatori (Burocrazia, Umarell) come due cabine/schermi pronti
 * all'avvio — il blocco dominante della home. Il bundle di gioco (canvas, sprite) resta lazy: qui
 * c'è solo il launcher (link + immagine di copertina), il componente vero si carica al click sulla
 * sua rotta (`component: () => import(...)` in app.pages.ts) — nessun import pesante qui.
 */
@Component({
    selector: 'app-simulators-hero',
    standalone: true,
    imports: [TranslatePipe, AssetDirective, PageDirective],
    templateUrl: './simulators-hero.component.html',
    styleUrl: './simulators-hero.component.css',
})
export class SimulatorsHeroComponent {
    protected readonly tiles = SIMULATORS;
}
