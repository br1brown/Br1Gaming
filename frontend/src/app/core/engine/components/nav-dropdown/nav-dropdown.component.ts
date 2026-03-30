import { Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { injectCurrentUrl } from '../../../../app.routes';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavSubmenuComponent } from '../nav-submenu/nav-submenu.component';
import { NavLink, isNavGroup } from '../../siteBuilder';

@Component({
    selector: 'app-nav-dropdown',
    standalone: true,
    imports: [TranslatePipe, NavLinkComponent, NavSubmenuComponent],
    templateUrl: './nav-dropdown.component.html',
})
export class NavDropdownComponent {
    private readonly router = inject(Router);
    private readonly currentUrl = injectCurrentUrl();

    readonly item = input.required<NavLink & { children: NavLink[] }>();
    readonly open = input(false);

    readonly toggle = output<void>();
    readonly linkClick = output<void>();

    /** Type-guard riusato nel template per ramificare figlio-gruppo / figlio-link. */
    readonly isGroup = isNavGroup;

    readonly isActive = computed(() => {
        this.currentUrl(); // dipendenza signal: re-eval ad ogni navigazione
        return this.hasActiveDescendant(this.item().children);
    });

    /** True se una qualsiasi foglia interna del sottoalbero (anche annidata) è la rotta corrente. */
    private hasActiveDescendant(children: NavLink[]): boolean {
        return children.some(child =>
            isNavGroup(child)
                ? this.hasActiveDescendant(child.children)
                : !child.isExternal && this.router.isActive(child.path, {
                    paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored',
                }));
    }
}
