import { Component, ElementRef, inject, isDevMode, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { injectCurrentUrl } from '../../routing';
import { ThemeService } from '../../services/theme.service';
import { TranslateService } from '../../services/translate.service';
import { LocalizationService } from '../../services/localization.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavDropdownComponent } from '../nav-dropdown/nav-dropdown.component';
import { ContestoSito } from '../../../../site';
import { isNavGroup } from '../../siteBuilder';
import { AssetDirective } from '../../directives/asset.directive';
import { UserNavComponent } from '../../../../components/shared/user-nav/user-nav.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

@Component({
    selector: 'app-navbar',
    imports: [TranslatePipe, AssetDirective, NavLinkComponent, NavDropdownComponent, RouterLink, UserNavComponent, NotificationBellComponent],
    templateUrl: './navbar.component.html',
    styleUrl: './navbar.component.scss',
    host: {
        class: 'd-block',
        '(document:click)': 'onDocumentClick($event)',
    }
})
/**
 * Barra di navigazione principale del sito, configurata interamente da `site.ts`.
 *
 * Responsabilità:
 * - Renderizza il brand, le voci di menu (flat o dropdown), il selettore lingua e
 *   l'area login/logout (delegata a `UserNavComponent`).
 * - Gestisce l'apertura/chiusura del menu mobile e dei dropdown nidificati.
 * - Chiude tutto alla navigazione (RouterEvent) e ai click fuori dal componente
 *   (`@HostListener document:click`).
 *
 * Configurazione: tutto viene letto da `ContestoSito` (alias di `site.ts`).
 * Non modificare questo file — personalizza `site.ts` e `user-nav.component.ts`.
 */
export class NavbarComponent {
    readonly theme = inject(ThemeService);
    readonly translate = inject(TranslateService);
    private readonly localization = inject(LocalizationService);
    private readonly router = inject(Router);
    private readonly elRef = inject(ElementRef);

    readonly appName = ContestoSito.config.appName;
    // Path della home dallo slot `homePage`; `null` se non valorizzato → il brand non è un link.
    readonly homePath: string | null = ContestoSito.config.homePage != null
        ? ContestoSito.getPath(ContestoSito.config.homePage)
        : null;
    readonly menuItems = ContestoSito.menuNav;
    readonly fixTop = ContestoSito.config.fixedTopHeader;
    readonly showBrandIconInHeader = ContestoSito.config.showBrandIconInHeader;
    /** Mostra il campanellino delle notifiche realtime (shell.showNotifications, default false). */
    readonly showNotifications = ContestoSito.config.showNotifications;
    // Set di lingue dalla config (coerente coi cataloghi i18n presenti → setLanguage funziona
    // sempre); il NOME mostrato è quello nativo derivato via Intl (LocalizationService).
    readonly languages = this.translate.availableLangs;
    /** True se il sito ha un'area auth in navbar: basta una `loginPage` configurata. Non dipende da
     *  `showLoginInHeader` — quel flag nasconde il *link di login* ai visitatori, ma il logout (da
     *  loggato) resta, quindi l'area può comunque renderizzare qualcosa. Governa la comparsa del
     *  toggler mobile quando non ci sono altre voci di menu. */
    readonly hasAuthPage = ContestoSito.config.loginPage != null;
    readonly menuOpen = signal(false);
    protected readonly openDropdownIndex = signal(-1);
    protected readonly langOpen = signal(false);
    private readonly currentUrl = injectCurrentUrl();

    constructor() {
        if (isDevMode() && this.menuItems.length > 6) {
            console.warn(
                `[Navbar] ${this.menuItems.length} voci di primo livello nel menu (max consigliato: 6). ` +
                `Su desktop rischiano di andare a capo; su mobile richiedono scroll. ` +
                `Raggruppa le voci in dropdown per ridurre il numero di item orizzontali.`
            );
        }
        this.router.events
            .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
            .subscribe(() => this.closeNavigation());
    }

    toggleMenu(): void {
        this.menuOpen.update(open => !open);
        if (!this.menuOpen()) {
            this.closeAllDropdowns();
        }
    }

    isRouteActive(path: string | null): boolean {
        if (path === null) return false;
        this.currentUrl(); // signal dependency → re-render on every navigation
        return this.router.isActive(path, { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' });
    }

    /** Type-guard riusato nel template per ramificare voce-gruppo (dropdown) / voce-link. */
    readonly isGroup = isNavGroup;

    isNavDropdownOpen(i: number): boolean {
        return this.openDropdownIndex() === i;
    }

    onNavDropdownToggle(i: number): void {
        this.langOpen.set(false);
        this.openDropdownIndex.update(cur => cur === i ? -1 : i);
    }

    toggleLang(): void {
        this.openDropdownIndex.set(-1);
        this.langOpen.update(v => !v);
    }

    onNavigationLinkClick(): void {
        this.closeNavigation();
    }

    onDocumentClick(event: MouseEvent): void {
        if (!this.elRef.nativeElement.contains(event.target)) {
            this.closeAllDropdowns();
        }
    }

    setLanguage(lang: string): void {
        void this.translate.setLanguage(lang);
        this.closeNavigation();
    }

    getFlagClass(_lang: string): string {
        return 'fa-solid fa-globe';
    }

    /** Nome nativo della lingua dal codice (via Intl), con fallback al codice in MAIUSCOLO. */
    langName(code: string): string {
        return this.localization.nameOf()(code);
    }

    private closeNavigation(): void {
        this.menuOpen.set(false);
        this.closeAllDropdowns();
    }

    private closeAllDropdowns(): void {
        this.openDropdownIndex.set(-1);
        this.langOpen.set(false);
    }
}
