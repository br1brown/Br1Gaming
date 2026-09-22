import { Component, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { SocialLinkComponent } from '../social-link/social-link.component';
import { OpeningHoursComponent } from '../opening-hours/opening-hours.component';
import { FooterGroupChild, footerLeafKey } from '../../shell-nav';

/** Gruppo del footer reso ricorsivamente: intestazione + lista dei figli — link/pagina, sottogruppo
 *  (`level` incrementato, indentazione crescente), valore `Identity`/testo libero (stesso
 *  vocabolario visivo di `app-identity-render`), orari, social esplicito, o un componente proprio
 *  del progetto (`addCustom`, via `NgComponentOutlet`). Liste statiche, nessuna interazione. */
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
