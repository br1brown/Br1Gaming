import { Component, input } from '@angular/core';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavLink } from '../../siteBuilder';

/**
 * FOOTER LINK ROW COMPONENT
 *
 * Riga compatta orizzontale di link, senza titolo — non un'altra colonna della griglia di
 * navigazione (`footer-nav`/`footer-nav-group`). Due consumer distinti, stesso componente:
 *   - la fascia legale (`config.legalPages`, via `FooterComponent`);
 *   - i link/pagine dichiarati sciolti in cima a `footerNav` (fuori da un `addGroup`, via
 *     `FooterNavComponent`) — vedi lì il perché non ricevono più una colonna a testa.
 *
 * Motivazione (Fitts/Hick/Miller, non il pattern di un design system specifico — verificato che
 * nessuno risolve bene il caso "poche voci sciolte", vedi note in `footer-nav.component.ts`):
 *   - Miller: un insieme di voci dello stesso "tipo" concettuale è un chunk solo, non uno per
 *     voce — a differenza di una colonna a testa, che ne farebbe N chunk separati.
 *   - Hick: isolate e rimpicciolite, non competono in peso visivo con le colonne di navigazione
 *     vera (categorie reali, quando ci sono).
 *   - Fitts: gap coerente e ravvicinato fra le voci, invece di una colonna larga quanto le altre
 *     per un solo link — meno spazio vuoto attraversato per arrivare al target successivo.
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
}
