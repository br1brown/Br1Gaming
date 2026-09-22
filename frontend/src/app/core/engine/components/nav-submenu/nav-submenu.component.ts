import { Component, ElementRef, PLATFORM_ID, computed, inject, input, output, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { injectCurrentUrl } from '../../routing';
import { isDesktopViewport, supportsHover } from '../../breakpoints';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavLink, isNavGroup, navLinkKey } from '../../shell-nav';

/** Margine dal bordo inferiore del viewport quando si calcola il tetto d'altezza del flyout. */
const SUBMENU_VIEWPORT_MARGIN = 16;
/** Sotto questa soglia non ha senso comprimere oltre: meglio uno scroll leggibile (poche righe
 *  visibili + indicazione che continua) che un pannello schiacciato a un dito di altezza. */
const SUBMENU_MIN_HEIGHT = 160;

/** Gruppo di navigazione dal secondo livello in giù, reso ricorsivamente nel dropdown della navbar.
 *  Desktop: pannello flyout su hover/focus, verso destra o ribaltato se sforerebbe il viewport.
 *  Mobile: accordion indentato al tap. Il singolo link va a `<app-nav-link>`; un figlio gruppo si
 *  rende con un altro `<app-nav-submenu>`. */
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

    /** True se una qualsiasi foglia interna del sottoalbero è la rotta corrente. */
    private hasActiveDescendant(children: NavLink[]): boolean {
        return children.some(child =>
            isNavGroup(child)
                ? this.hasActiveDescendant(child.children)
                : !child.isExternal && this.router.isActive(child.path, {
                    paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored',
                }));
    }

    /** Apertura/chiusura dell'accordion mobile. Su desktop con hover reale il pannello è già
     *  guidato da :hover/:focus-within (CSS) — qui sarebbe un no-op visibile identico. Su un
     *  touchscreen che riporta >= md di larghezza (tablet, laptop touch) non c'è hover reale:
     *  senza questo fallback il tap non apriva nulla e il gruppo restava irraggiungibile. */
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

    /**
     * All'apertura del flyout desktop sceglie il lato (destra di default, sinistra se non c'è
     * spazio) e il tetto d'altezza: un gruppo con tanti figli scrolla al proprio interno invece
     * di sforare il viewport. Il tetto è lo spazio libero REALE sotto l'ancora, non un vh fisso.
     */
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
