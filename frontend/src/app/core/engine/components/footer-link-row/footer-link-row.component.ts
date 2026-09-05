import { Component, input } from '@angular/core';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavLink, navLinkKey } from '../../shell-nav';

/**
 * FOOTER LINK ROW COMPONENT
 *
 * Riga compatta orizzontale di link, senza titolo — non un'altra colonna della griglia di
 * navigazione (`footer-nav`/`footer-nav-group`). Due consumer distinti, stesso componente:
 *   - la fascia legale (`config.legalPages`, via `FooterComponent`);
 *   - i link/pagine dichiarati sciolti in cima al resolver footer (fuori da un `addGroup`, via
 *     `FooterNavComponent`) — vedi lì il perché non ricevono più una colonna a testa.
 *
 *
 * `links` arriva già risolto (nessuna logica qui, solo layout) — chi consuma decide la sorgente.
 */
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
