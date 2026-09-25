import { Component, ElementRef, PLATFORM_ID, computed, effect, inject, input, output } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { injectCurrentUrl } from '../../routing';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavSubmenuComponent } from '../nav-submenu/nav-submenu.component';
import { NavLink, isNavGroup, navLinkKey } from '../../shell-nav';

/** Margine dal bordo inferiore del viewport quando si calcola il tetto d'altezza del dropdown. */
const DROPDOWN_VIEWPORT_MARGIN = 16;
/** Sotto questa soglia non ha senso comprimere oltre: meglio uno scroll leggibile (poche righe
 *  visibili + indicazione che continua) che un pannello schiacciato a un dito di altezza. */
const DROPDOWN_MIN_HEIGHT = 160;

/** Id progressivi dei pannelli, per `aria-controls` (stesso ordine in SSR e nel browser). */
let nextDropdownId = 0;

@Component({
    selector: 'app-nav-dropdown',
    standalone: true,
    imports: [TranslatePipe, NavLinkComponent, NavSubmenuComponent],
    templateUrl: './nav-dropdown.component.html',
})
export class NavDropdownComponent {
    private readonly router = inject(Router);
    private readonly currentUrl = injectCurrentUrl();
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly item = input.required<NavLink & { children: NavLink[] }>();
    /** Id del pannello, collegato al toggle con `aria-controls`. */
    protected readonly menuId = `nav-dropdown-${nextDropdownId++}`;
    readonly open = input(false);

    readonly toggle = output<void>();
    readonly linkClick = output<void>();

    /** Type-guard riusato nel template per ramificare figlio-gruppo / figlio-link. */
    readonly isGroup = isNavGroup;
    /** Chiave `track` per il template — vedi doc su `navLinkKey` in shell-nav.ts. */
    readonly navLinkKey = navLinkKey;

    readonly isActive = computed(() => {
        this.currentUrl(); // dipendenza signal: re-eval ad ogni navigazione
        return this.hasActiveDescendant(this.item().children);
    });

    constructor() {
        effect(() => {
            if (this.open()) this.updateMaxHeight();
        });
    }

    /** True se una qualsiasi foglia interna del sottoalbero (anche annidata) è la rotta corrente. */
    private hasActiveDescendant(children: NavLink[]): boolean {
        return children.some(child =>
            isNavGroup(child)
                ? this.hasActiveDescendant(child.children)
                : !child.isExternal && this.router.isActive(child.path, {
                    paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored',
                }));
    }

    /** All'apertura del dropdown di 1° livello calcola il tetto d'altezza (scrolla al proprio
     *  interno invece di sforare il fondo pagina), da `rect.bottom` — non `rect.top` come nel
     *  submenu: il dropdown di 1° livello apre sotto il pulsante, non a fianco dell'ancora. */
    private updateMaxHeight(): void {
        if (!this.isBrowser) return;
        const root = this.host.nativeElement.querySelector<HTMLElement>(':scope > .dropdown');
        const panel = root?.querySelector<HTMLElement>(':scope > .dropdown-menu');
        if (!root || !panel) return;
        const rect = root.getBoundingClientRect();
        const available = window.innerHeight - rect.bottom - DROPDOWN_VIEWPORT_MARGIN;
        panel.style.setProperty('--dropdown-max-height', `${Math.max(available, DROPDOWN_MIN_HEIGHT)}px`);
    }
}
