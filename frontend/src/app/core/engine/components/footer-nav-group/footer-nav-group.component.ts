import { Component, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { SocialLinkComponent } from '../social-link/social-link.component';
import { OpeningHoursComponent } from '../opening-hours/opening-hours.component';
import { FooterGroupChild, footerLeafKey } from '../../shell-nav';

/**
 * FOOTER NAV GROUP COMPONENT
 *
 * Gruppo del footer reso ricorsivamente: intestazione + lista dei figli. Un figlio può essere un
 * link/pagina (`<app-nav-link>`), un sottogruppo (`<app-footer-nav-group>` con `level` incrementato,
 * indentazione crescente), un valore mappato da `Identity` o testo libero (badge/codice/testo — lo
 * stesso vocabolario visivo di `app-identity-render`, non uno stile a sé per i gruppi custom), gli
 * orari (`<app-opening-hours>`), un social esplicito (`<app-social-link>`) o un componente proprio
 * del progetto (`addCustom`, reso via `NgComponentOutlet`). Liste statiche, nessuna interazione: la
 * gerarchia è resa solo a livello visivo.
 */
@Component({
    selector: 'app-footer-nav-group',
    standalone: true,
    imports: [TranslatePipe, NavLinkComponent, SocialLinkComponent, OpeningHoursComponent, FooterNavGroupComponent, NgComponentOutlet],
    templateUrl: './footer-nav-group.component.html',
})
export class FooterNavGroupComponent {
    readonly group = input.required<Extract<FooterGroupChild, { kind: 'group' }>>();
    /** Livello di annidamento: 0 = colonna top-level del footer; aumenta l'indentazione. */
    readonly level = input(0);

    /** Chiave `track` per il template — vedi doc su `footerLeafKey` in shell-nav.ts. */
    readonly footerLeafKey = footerLeafKey;
}
