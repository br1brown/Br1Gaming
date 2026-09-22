import { Component, input } from '@angular/core';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavLink, navLinkKey } from '../../shell-nav';

/** Riga compatta orizzontale di link, senza titolo — non un'altra colonna della griglia
 *  (`footer-nav`/`footer-nav-group`). Due consumer distinti, stesso componente: la fascia legale
 *  (via `FooterComponent`) e i link sciolti fuori da un `addGroup` (via `FooterNavComponent`).
 *  `links` arriva già risolto: nessuna logica qui, solo layout. */
@Component({
    selector: 'app-footer-link-row',
    standalone: true,
    imports: [NavLinkComponent],
    templateUrl: './footer-link-row.component.html',
})
export class FooterLinkRowComponent {
    readonly links = input.required<NavLink[]>();
    /** Chiave `track` per il template — vedi doc su `navLinkKey` in shell-nav.ts. */
    readonly navLinkKey = navLinkKey;
}
