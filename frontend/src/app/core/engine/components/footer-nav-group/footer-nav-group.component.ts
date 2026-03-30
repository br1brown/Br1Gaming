import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavLink, isNavGroup } from '../../siteBuilder';

/**
 * FOOTER NAV GROUP COMPONENT
 *
 * Gruppo del footer reso ricorsivamente: intestazione + lista dei figli, dove ogni
 * figlio-gruppo è a sua volta un <app-footer-nav-group> con `level` incrementato
 * (indentazione crescente). Il singolo link è delegato a <app-nav-link>. Liste
 * statiche, nessuna interazione: la gerarchia è resa solo a livello visivo.
 */
@Component({
    selector: 'app-footer-nav-group',
    standalone: true,
    imports: [TranslatePipe, NavLinkComponent, FooterNavGroupComponent],
    templateUrl: './footer-nav-group.component.html',
})
export class FooterNavGroupComponent {
    readonly group = input.required<NavLink & { children: NavLink[] }>();
    /** Livello di annidamento: 0 = colonna top-level del footer; aumenta l'indentazione. */
    readonly level = input(0);

    /** Type-guard riusato nel template per ramificare figlio-gruppo / figlio-link. */
    readonly isGroup = isNavGroup;
}
