import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FooterNavGroupComponent } from '../footer-nav-group/footer-nav-group.component';
import { FooterLinkRowComponent } from '../footer-link-row/footer-link-row.component';
import { NavLink, isNavGroup, navLinkKey } from '../../shell-nav';

/**
 * FOOTER NAV COMPONENT
 *
 * Render della griglia di link risolti da `ShellNavService.footer()`, con DUE resa diverse per lo
 * stesso identico input (`addPage`/`addLink`/`addGroup`, la stessa sintassi della navbar):
 *   - un `addGroup` (categoria reale di navigazione) → colonna a sé, header + lista, come sempre.
 *   - un `addPage`/`addLink` sciolto in cima (fuori da un gruppo) → niente colonna a sé (sprecherebbe
 *     lo spazio di un'intera colonna per un solo link, e nel conteggio dei "chunk" di primo livello
 *     peserebbe come un gruppo intero pur non essendolo). Raccolti invece in un'unica
 *     riga compatta (`app-footer-link-row`, stesso componente della fascia legale, riga separata:
 *     sono insiemi concettualmente diversi).
 *
 * Applicato in autonomia dal componente, non da chi scrive `site.ts`: la sintassi del builder
 * (`addPage`/`addLink`/`addGroup`) resta identica a quella dell'header, è solo la resa a
 * dividersi in base a cosa produce ciascuna chiamata — un gruppo o un link sciolto.
 *
 * Il render del singolo link è delegato a <app-nav-link> (via `app-footer-nav-group` o
 * `app-footer-link-row`), che gestisce esterno / rotta-corrente / interno + a11y.
 *
 * Estratto dal footer per evitare che un refactor del layout esterno
 * porti via la composizione.
 */
@Component({
    selector: 'app-footer-nav',
    standalone: true,
    imports: [TranslatePipe, FooterNavGroupComponent, FooterLinkRowComponent],
    templateUrl: './footer-nav.component.html',
})
export class FooterNavComponent {
    readonly links = input.required<NavLink[]>();
    /** Chiave `track` per il template — vedi doc su `navLinkKey` in shell-nav.ts. */
    readonly navLinkKey = navLinkKey;

    /** Voci di primo livello che sono gruppi reali (`addGroup`): una colonna ciascuna. */
    readonly groups = computed(() => this.links().filter(isNavGroup));

    /** Voci di primo livello sciolte (`addPage`/`addLink`, fuori da un gruppo): riga compatta unica. */
    readonly standaloneLinks = computed(() => this.links().filter(item => !isNavGroup(item)));
}
