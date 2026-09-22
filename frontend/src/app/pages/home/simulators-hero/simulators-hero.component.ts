import { Component } from '@angular/core';
import { TranslatePipe } from '../../../core/engine/pipes/translate.pipe';
import { AssetDirective } from '../../../core/engine/directives/asset.directive';
import { PageDirective } from '../../../core/engine/directives/page.directive';
import { PageType } from '../../../site';

/**
 * Una "cabina": i due simulatori pesi massimi PIÙ l'accesso ai Generatori nella stessa riga — tre
 * launcher pari peso, non due grandi e uno strizzato sotto. `imageId` assente (caso Generatori:
 * non è un "gioco", non ha una cover) → niente `<img>`, il tile usa `.sim-tile--flat` (icona, non
 * fotografia) invece di lasciare `[appAsset]` senza sorgente.
 */
interface SimulatorTile {
    slug: string;
    titleKey: string;
    taglineKey: string;
    ctaKey: string;
    imageId?: string;
    /** Solo per i tile senza immagine (Font Awesome, es. "fa-solid fa-dice"). */
    icon?: string;
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
    {
        slug: 'generatori',
        titleKey: 'generatori',
        taglineKey: 'heroGeneratoriTagline',
        ctaKey: 'heroApri',
        icon: 'fa-solid fa-dice',
        pageType: PageType.Generatori,
    },
];

/**
 * Sezione "I Pesi Massimi": i due simulatori (Burocrazia, Umarell) più l'accesso ai Generatori,
 * tre cabine/schermi pronti all'avvio nella stessa riga — il blocco dominante della home. Il bundle
 * di gioco (canvas, sprite) resta lazy: qui c'è solo il launcher (link + immagine di copertina o
 * icona), il componente vero si carica al click sulla sua rotta (`component: () => import(...)` in
 * app.pages.ts) — nessun import pesante qui.
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
