import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FooterNavGroupComponent } from '../footer-nav-group/footer-nav-group.component';
import { FooterLinkRowComponent } from '../footer-link-row/footer-link-row.component';
import { NavLink, isNavGroup, navLinkKey } from '../../shell-nav';

/**
 * FOOTER NAV COMPONENT
 *
 * Render della griglia di link risolti da `ShellNavService.footer()`.
 *  - Gruppi (`addGroup`): resi in una propria colonna tramite `FooterNavGroupComponent`.
 *  - Link sciolti (`addPage`/`addLink` top-level): raggruppati assieme in una riga compatta 
 *    (`FooterLinkRowComponent`) per non consumare un'intera colonna.
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
