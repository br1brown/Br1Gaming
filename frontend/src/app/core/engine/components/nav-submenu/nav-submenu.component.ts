import { Component, ElementRef, PLATFORM_ID, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { injectCurrentUrl } from '../../routing';
import { isDesktopViewport, supportsHover } from '../../breakpoints';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavLink, isNavGroup, navLinkKey } from '../../shell-nav';
import { NavMenuState } from '../../nav-menu-state';

/** Margine dal bordo inferiore del viewport quando si calcola il tetto d'altezza del flyout. */
const SUBMENU_VIEWPORT_MARGIN = 16;
/** Sotto questa soglia non ha senso comprimere oltre: meglio uno scroll leggibile (poche righe
 *  visibili + indicazione che continua) che un pannello schiacciato a un dito di altezza. */
const SUBMENU_MIN_HEIGHT = 160;

/** Id progressivi dei pannelli, per `aria-controls` (stesso ordine in SSR e nel browser). */
let nextSubmenuId = 0;

/** Gruppo di navigazione dal secondo livello in giù. Desktop: flyout su hover/focus (destra, o
 *  ribaltato se sforerebbe il viewport). Mobile: accordion indentato al tap. */
@Component({
    selector: 'app-nav-submenu',
    standalone: true,
    imports: [TranslatePipe, NavLinkComponent, NavSubmenuComponent],
    templateUrl: './nav-submenu.component.html',
})
export class NavSubmenuComponent {
    private readonly router = inject(Router);
    private readonly currentUrl = injectCurrentUrl();
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly item = input.required<NavLink & { children: NavLink[] }>();

    readonly linkClick = output<void>();

    /** Id del pannello, collegato al toggle con `aria-controls`. */
    protected readonly menuId = `nav-submenu-${nextSubmenuId++}`;

    /** Stato di apertura usato su mobile (su desktop il flyout apre via CSS hover/focus). */
    readonly expanded = signal(false);
    /** true quando il flyout desktop va aperto verso sinistra per restare dentro il viewport. */
    readonly flipLeft = signal(false);

    /** Type-guard riusato nel template per ramificare figlio-gruppo / figlio-link. */
    readonly isGroup = isNavGroup;
    /** Chiave `track` per il template — vedi doc su `navLinkKey` in shell-nav.ts. */
    readonly navLinkKey = navLinkKey;

    readonly isActive = computed(() => {
        this.currentUrl(); // dipendenza signal: re-eval ad ogni navigazione
        return this.hasActiveDescendant(this.item().children);
    });

    constructor() {
        // Quando la navbar chiude tutto (Escape, click fuori, navigazione) si richiude anche questo
        // accordion: aperto "di nascosto", al prossimo giro sarebbe già espanso.
        const menuState = inject(NavMenuState, { optional: true });
        if (menuState) {
            effect(() => {
                menuState.collapseAll();
                untracked(() => this.expanded.set(false));
            });
        }
    }

    /** True se una qualsiasi foglia interna del sottoalbero è la rotta corrente. */
    private hasActiveDescendant(children: NavLink[]): boolean {
        return children.some(child =>
            isNavGroup(child)
                ? this.hasActiveDescendant(child.children)
                : !child.isExternal && this.router.isActive(child.path, {
                    paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored',
                }));
    }

    /** Apertura/chiusura dell'accordion mobile: no-op su desktop con hover reale (già guidato da CSS),
     *  necessario invece su un touchscreen >= md (tablet, laptop touch) dove l'hover non esiste. */
    toggle(): void {
        if (!this.isBrowser || (isDesktopViewport() && supportsHover())) return;
        const nowOpen = !this.expanded();
        this.expanded.set(nowOpen);
        if (nowOpen && isDesktopViewport()) this.updateFlip();
    }

    onLinkClick(): void {
        this.expanded.set(false);
        this.linkClick.emit();
    }

    /** Sceglie il lato del flyout desktop (destra, sinistra se manca spazio) e il tetto d'altezza
     *  dallo spazio libero REALE sotto l'ancora, non un vh fisso. */
    updateFlip(): void {
        if (!this.isBrowser) return;
        const root = this.host.nativeElement.querySelector<HTMLElement>(':scope > .dropdown-submenu');
        const panel = root?.querySelector<HTMLElement>(':scope > .submenu-panel');
        if (!root || !panel) return;
        const rect = root.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.right;
        this.flipLeft.set(spaceRight < (panel.offsetWidth || 220));

        const available = window.innerHeight - rect.top - SUBMENU_VIEWPORT_MARGIN;
        panel.style.setProperty('--submenu-max-height', `${Math.max(available, SUBMENU_MIN_HEIGHT)}px`);
    }
}
