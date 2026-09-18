import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FooterNavGroupComponent } from '../footer-nav-group/footer-nav-group.component';
import { FooterLinkRowComponent } from '../footer-link-row/footer-link-row.component';
import { FooterEntry, footerLeafKey } from '../../shell-nav';

/**
 * FOOTER NAV COMPONENT
 *
 * Render della griglia di link/gruppi risolti da `ShellNavService.footer()`.
 *  - Gruppi (`addGroup`): resi in una propria colonna tramite `FooterNavGroupComponent` — un gruppo
 *    può contenere link, pagine, campi Identity (`addField`), testo libero (`addText`) e social
 *    (`addSocialLink`), vedi `footer-nav-group.component.ts`.
 *  - Link sciolti (`addPage`/`addLink` top-level): raggruppati assieme in una riga compatta
 *    (`FooterLinkRowComponent`) per non consumare un'intera colonna. Solo link qui: `addField`/
 *    `addText`/`addSocialLink` esistono solo dentro un `addGroup` (vedi `FooterGroupBuilder`).
 */
@Component({
    selector: 'app-footer-nav',
    standalone: true,
    imports: [TranslatePipe, FooterNavGroupComponent, FooterLinkRowComponent],
    templateUrl: './footer-nav.component.html',
})
export class FooterNavComponent {
    readonly links = input.required<FooterEntry[]>();
    /** Chiave `track` per il template — vedi doc su `footerLeafKey` in shell-nav.ts. */
    readonly footerLeafKey = footerLeafKey;

    /** Voci di primo livello che sono gruppi (`addGroup`): una colonna ciascuna. */
    readonly groups = computed(() => this.links().filter((item): item is Extract<FooterEntry, { kind: 'group' }> => item.kind === 'group'));

    /** Voci di primo livello sciolte (`addPage`/`addLink`, fuori da un gruppo): riga compatta unica. */
    readonly standaloneLinks = computed(() => this.links().filter((item): item is Extract<FooterEntry, { kind: 'link' }> => item.kind === 'link'));
}
