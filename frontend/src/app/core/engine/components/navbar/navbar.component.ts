import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, input, isDevMode, PLATFORM_ID, signal, untracked, viewChild, viewChildren } from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { injectCurrentUrl, mergeRouteParams } from '../../routing';
import { isDesktopViewport, viewportAtLeastQuery } from '../../breakpoints';
import { TranslateService } from '../../services/translate.service';
import { LocalizationService } from '../../services/localization.service';
import { PageMetaService } from '../../services/page-meta.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { NavLinkComponent } from '../nav-link/nav-link.component';
import { NavDropdownComponent } from '../nav-dropdown/nav-dropdown.component';
import { ContestoSito } from '../../../../site';
import { applyPathParams } from '../../siteBuilder';
import { filterNavByAuth, isNavGroup, navLinkKey, NavLink } from '../../shell-nav';
import { ShellNavService } from '../../services/shell-nav.service';
import { AssetDirective } from '../../directives/asset.directive';
import { UserNavComponent } from '../../../../components/shared/user-nav/user-nav.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { TokenService } from '../../services/token.service';
import { injectDismiss } from '../../dismiss';
import { NavMenuState } from '../../nav-menu-state';

/** Oltre questa soglia: warning dev (console) + calcolo overflow "Altro" attivo. Sotto, tutte le
 *  voci restano sempre in riga senza costo (nessun ResizeObserver montato) — è la soglia stessa
 *  già raccomandata nel warning, non un limite indipendente. */
const MAX_RECOMMENDED_TOP_LEVEL_ITEMS = 6;

/** Quota massima dell'altezza visibile occupabile da una navbar `fissa` agganciata: oltre (zoom,
 *  testo ingrandito, voci a capo) torna nel flusso invece di coprire lettura e navigazione. */
const MAX_STICKY_VIEWPORT_SHARE = 0.2;

@Component({
    selector: 'app-navbar',
    imports: [TranslatePipe, AssetDirective, NavLinkComponent, NavDropdownComponent, RouterLink, UserNavComponent, NotificationBellComponent, NgTemplateOutlet],
    templateUrl: './navbar.component.html',
    styleUrl: './navbar.component.scss',
    providers: [NavMenuState],
    host: {
        class: 'd-block',
        '[class.navbar-host--sticky]': 'stuck()',
        '[class.navbar-host--menu-open]': 'menuOpen()',
    }
})
/** Barra di navigazione principale, configurata interamente da `site.ts` (via `ContestoSito`). Non modificare questo file: personalizza site.ts e user-nav.component.ts (dominio a contratto fisso). */
export class NavbarComponent {
    readonly translate = inject(TranslateService);
    private readonly localization = inject(LocalizationService);
    private readonly pageMeta = inject(PageMetaService);
    private readonly router = inject(Router);
    private readonly elRef = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly tokenService = inject(TokenService);
    private readonly shellNav = inject(ShellNavService);
    private readonly menuState = inject(NavMenuState);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    /** Chiave `track` per il template — vedi doc su `navLinkKey` in shell-nav.ts. */
    protected readonly navLinkKey = navLinkKey;

    readonly appName = ContestoSito.config.appName;
    // Path della home dallo slot `homePage`, nella lingua corrente; `null` se non valorizzato →
    // il brand non è un link. Reattivo: il link resta coerente con la lingua dopo uno switch.
    readonly homePath = computed<string | null>(() => ContestoSito.config.homePage != null
        ? ContestoSito.getPath(ContestoSito.config.homePage, this.translate.currentLang())
        : null);
    /** Menu senza filtro auth, per le decisioni strutturali che devono restare stabili a prescindere
     *  dal login (overflow "Altro", warning, `altroDropdownIndex`) — il render usa `menuItems`. */
    private readonly rawMenuItems = computed(() => this.shellNav.header());
    /** Menu reso: filtra le voci `authOnly` sul login corrente. In SSR l'utente è sempre sloggato,
     *  quindi anche i bot vedono solo le voci pubbliche. */
    readonly menuItems = computed(() => filterNavByAuth(this.rawMenuItems(), this.tokenService.isLoggedIn()));
    readonly fixTop = ContestoSito.config.aspetto.navbar.fissa;
    /** Se comparire — calcolato da `AppComponent` (`aspetto.navbar.icona && (RouteChrome.showBrandIcon ?? true)`):
     *  il ruolo della rotta può solo spegnerla. QUALE icona resta un'altra fonte (sotto). */
    readonly showBrandIcon = input<boolean>(true);
    /** Valore per `[appAsset]`, o `null` se `showBrandIcon()` è spento: chiave mapping.json o GUID
     *  blob (`ShellNavResolver.brandIcon`, assente → `favIcon`). */
    readonly brandIconAsset = computed<string | null>(() => this.showBrandIcon() ? this.shellNav.brandIcon() : null);
    /** Mostra il campanellino delle notifiche realtime (shell.showNotifications, default false). */
    readonly showNotifications = ContestoSito.config.showNotifications;
    // Set di lingue dalla config (coerente coi cataloghi i18n presenti → setLanguage funziona
    // sempre); il NOME mostrato è quello nativo derivato via Intl (LocalizationService).
    readonly languages = this.translate.availableLangs;
    /** True se il sito ha un'area auth in navbar (`loginPage` configurata): governa il toggler mobile
     *  quando non ci sono altre voci di menu. Indipendente da `showLoginInHeader` (nasconde solo il link). */
    readonly hasAuthPage = ContestoSito.config.loginPage != null;
    readonly menuOpen = signal(false);
    protected readonly openDropdownIndex = signal(-1);
    protected readonly langOpen = signal(false);
    private readonly currentUrl = injectCurrentUrl();
    private readonly navEl = viewChild<ElementRef<HTMLElement>>('navEl');
    private readonly togglerEl = viewChild<ElementRef<HTMLElement>>('togglerEl');
    private readonly menuEl = viewChild<ElementRef<HTMLElement>>('menuEl');
    /** Fratelli dello shell resi `inert` mentre il menu mobile è aperto (per ripristinare solo quelli). */
    private inertSiblings: HTMLElement[] = [];
    /** Altezza reale della navbar (custom property `--nav-height`): dove parte il pannello mobile aperto e scroll-padding della pagina con la barra agganciata. 56px = stima sicura pre-misura, poi segue l'elemento vero. */
    readonly navHeight = signal(56);
    /** Altezza visibile della finestra in px CSS: lo zoom del browser la riduce. Infinita in SSR e
     *  prima della misura, così il primo render di una navbar `fissa` è già agganciato. */
    private readonly viewportHeight = signal(Number.POSITIVE_INFINITY);
    /** Navbar agganciata in cima (sticky): `navbar.fissa` del design system, finché la barra resta
     *  entro MAX_STICKY_VIEWPORT_SHARE dell'altezza visibile. Sticky e non fixed: la barra resta nel
     *  flusso, quindi nessuna pagina (ruolo, fitViewport, zoom) deve compensarne l'altezza. */
    readonly stuck = computed(() => this.fixTop && this.navHeight() <= this.viewportHeight() * MAX_STICKY_VIEWPORT_SHARE);

    // ── Overflow "Altro" (desktop) ── Bootstrap forza flex-wrap:nowrap su .navbar-expand-md: le voci
    // in eccesso uscirebbero dalla viewport senza scroll, da qui il calcolo in TS di quante entrano.
    private readonly containerFluidEl = viewChild<ElementRef<HTMLElement>>('containerFluidEl');
    private readonly brandEl = viewChild<ElementRef<HTMLElement>>('brandEl');
    private readonly navListEl = viewChild<ElementRef<HTMLElement>>('navListEl');
    private readonly navItemEls = viewChildren<ElementRef<HTMLElement>>('navItemEl');
    private readonly userNavWrapperEl = viewChild<ElementRef<HTMLElement>>('userNavWrapperEl');
    private readonly langWrapEl = viewChild<ElementRef<HTMLElement>>('langWrapEl');
    /** Esiste solo quando overflowMenuItems() non è vuoto (vedi template): usato per misurare
     *  la larghezza vera del toggle "Altro" una volta che esiste, invece della sola stima
     *  fissa iniziale (vedi ALTRO_WIDTH_ESTIMATE_FALLBACK in recomputeOverflow). */
    private readonly altroToggleEl = viewChild<ElementRef<HTMLElement>>('altroToggleEl');
    /** Quante voci di primo livello entrano in riga; le altre finiscono in "Altro".
     *  Parte da "tutte visibili" (coerente col comportamento pre-misura, prima dell'idratazione)
     *  e viene corretta da recomputeOverflow() appena il layout reale è misurabile. */
    readonly visibleCount = signal(this.menuItems().length);
    readonly overflowMenuItems = computed(() => this.menuItems().slice(this.visibleCount()));
    /** Gruppo sintetico passato a <app-nav-dropdown>: stessa struttura di un gruppo dichiarato
     *  in site.ts (addGroup), così il rendering (incluso l'annidamento di eventuali sotto-gruppi
     *  finiti in overflow) è quello già esistente, nessuna duplicazione di template. */
    readonly altroGroup = computed<NavLink & { children: NavLink[] }>(() => ({
        label: 'altroNav',
        path: '',
        isExternal: false,
        children: this.overflowMenuItems(),
    }));
    /** Indice sentinella per isNavDropdownOpen/onNavDropdownToggle: basato su rawMenuItems.length,
     *  così non collide mai con un indice reale del menu filtrato né con -1. */
    readonly altroDropdownIndex = this.rawMenuItems().length;

    constructor() {
        if (isDevMode() && this.rawMenuItems().length > MAX_RECOMMENDED_TOP_LEVEL_ITEMS) {
            console.warn(
                `[Navbar] ${this.rawMenuItems().length} voci di primo livello nel menu ` +
                `(max consigliato: ${MAX_RECOMMENDED_TOP_LEVEL_ITEMS}). ` +
                `Quelle che non entrano in riga finiscono nel dropdown "Altro"; su mobile restano ` +
                `tutte nel pannello, ma richiedono scroll. Raggruppa le voci in dropdown per ridurre ` +
                `il numero di item orizzontali.`
            );
        }
        this.router.events
            .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
            .subscribe(() => this.closeNavigation());

        // Chiusura condivisa (dismiss.ts): prima i dropdown (lingua compresa), poi il menu mobile.
        // Escape chiude solo il più interno aperto e ridà il focus al suo trigger; il click fuori
        // dalla navbar chiude i dropdown (il menu mobile copre la pagina: fuori non c'è niente).
        injectDismiss({
            open: computed(() => this.openDropdownIndex() !== -1 || this.langOpen()),
            close: () => this.closeAllDropdowns(),
            returnFocus: () => this.elRef.nativeElement.querySelector('.dropdown.show > .nav-dropdown-toggle') as HTMLElement | null,
        });
        injectDismiss({
            open: this.menuOpen,
            close: () => this.closeNavigation(),
            returnFocus: () => this.togglerEl()?.nativeElement,
            outsideClick: false,
        });

        // Menu mobile aperto = pannello a tutto schermo sopra la pagina: il resto dello shell diventa
        // `inert` (fuori da Tab e screen reader, WCAG 2.4.3) e il focus entra nella prima voce —
        // altrimenti da tastiera si finirebbe sul contenuto nascosto dietro il pannello.
        effect(() => {
            const open = this.menuOpen();
            if (!this.isBrowser) return;
            untracked(() => {
                this.setBackgroundInert(open);
                if (open) {
                    requestAnimationFrame(() => this.menuEl()?.nativeElement
                        .querySelector<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
                        ?.focus());
                }
            });
        });
        this.destroyRef.onDestroy(() => this.setBackgroundInert(false));

        // Navbar agganciata: la sua altezza reale diventa lo scroll-padding della pagina (--navOffset,
        // _base.scss), così focus da tastiera e ancore non finiscono coperti dalla barra. Sganciata
        // (zoom, finestra bassa) non copre niente, e lo scroll-padding torna a zero.
        if (this.fixTop && this.isBrowser) {
            const rootStyle = document.documentElement.style;
            effect(() => this.stuck()
                ? rootStyle.setProperty('--navOffset', `${this.navHeight()}px`)
                : rootStyle.removeProperty('--navOffset'));
            this.destroyRef.onDestroy(() => rootStyle.removeProperty('--navOffset'));
            afterNextRender(() => {
                const measure = (): void => this.viewportHeight.set(window.innerHeight);
                measure();
                window.addEventListener('resize', measure, { passive: true });   // lo zoom del browser è un resize
                this.destroyRef.onDestroy(() => window.removeEventListener('resize', measure));
            });
        }
        // Da md in su il pannello mobile non esiste più (voci in riga): se era aperto quando la
        // finestra si allarga, si chiude — altrimenti la pagina resterebbe inert senza un menu visibile.
        afterNextRender(() => {
            const desktop = viewportAtLeastQuery('md');
            const onChange = (e: MediaQueryListEvent): void => { if (e.matches) this.menuOpen.set(false); };
            desktop.addEventListener('change', onChange);
            this.destroyRef.onDestroy(() => desktop.removeEventListener('change', onChange));
        });

        // Sempre osservata (non solo se fixTop): serve anche a dove parte il pannello mobile
        // aperto, indipendente dal fatto che la navbar sia agganciata o in flusso normale.
        afterNextRender(() => this.observeNavHeight());

        // Overflow "Altro" SEMPRE attivo, indipendente dal numero di voci: il conteggio non
        // garantisce nulla sulla larghezza reale (un'etichetta lunga può non entrare anche con
        // poche voci). MAX_RECOMMENDED_TOP_LEVEL_ITEMS resta solo un avviso, non una condizione di layout.
        afterNextRender(() => this.setupOverflowObserver());
        // Un font custom può ancora scaricarsi alla prima misura (larghezze del font di fallback):
        // document.fonts.ready corregge il calcolo dopo il download.
        if (this.isBrowser && typeof document !== 'undefined' && document.fonts) {
            void document.fonts.ready.then(() => this.recomputeOverflow());
        }
        // Le voci in overflow sono position:absolute: il loro cambio di larghezza non fa scattare da
        // solo il ResizeObserver, da qui il ricalcolo esplicito (`menuItems()` tracciato perché un
        // resolver async può leggere transitoriamente vuoto dopo l'idratazione).
        effect(() => {
            this.translate.currentLang();
            this.tokenService.isLoggedIn();
            this.menuItems();
            queueMicrotask(() => this.recomputeOverflow());
        });
    }

    private observeNavHeight(): void {
        const el = this.navEl()?.nativeElement;
        if (!el) return;
        this.navHeight.set(el.offsetHeight);
        // Anche a menu aperto: il pannello mobile è position:fixed, fuori dal flusso di <nav>, e non
        // ne gonfia l'altezza. La riga superiore invece può cambiarla (l'etichetta "Menu" sparisce,
        // una riga che andava a capo rientra) e il pannello deve partire dal suo bordo reale.
        const observer = new ResizeObserver(([entry]) => this.navHeight.set(entry.target.clientHeight));
        observer.observe(el);
        this.destroyRef.onDestroy(() => observer.disconnect());
    }

    private setupOverflowObserver(): void {
        this.recomputeOverflow();
        const container = this.containerFluidEl()?.nativeElement;
        const list = this.navListEl()?.nativeElement;
        if (!container || !list) return;
        const observer = new ResizeObserver(() => this.recomputeOverflow());
        observer.observe(container);
        observer.observe(list);
        // Anche brand/userNav/selettore lingua: la loro larghezza entra nel budget `available` sotto,
        // ma un loro cambio (es. l'area login che appare/scompare) non tocca necessariamente le
        // dimensioni di container/navListEl sopra — senza osservarli a parte resterebbero sbagliati.
        for (const el of [this.brandEl()?.nativeElement, this.userNavWrapperEl()?.nativeElement, this.langWrapEl()?.nativeElement]) {
            if (el) observer.observe(el);
        }
        this.destroyRef.onDestroy(() => observer.disconnect());
    }

    /** Ricalcola quante voci di primo livello entrano in riga, dalla larghezza reale disponibile.
     *  Sotto md il pannello collassabile impila già tutto verticalmente: nessun overflow da gestire,
     *  si mostra sempre l'insieme completo. */
    private recomputeOverflow(): void {
        const currentItems = this.menuItems();
        // isDesktopViewport() è solo-browser per contratto (breakpoints.ts) — guardia necessaria
        // perché l'effect() che chiama questo metodo (sotto) gira anche in SSR.
        if (!this.isBrowser || !isDesktopViewport()) {
            this.visibleCount.set(currentItems.length);
            return;
        }

        const container = this.containerFluidEl()?.nativeElement;
        const items = this.navItemEls();
        if (!container || items.length !== currentItems.length) return;

        const brand = this.brandEl()?.nativeElement;
        const userNav = this.userNavWrapperEl()?.nativeElement;
        const langWrap = this.langWrapEl()?.nativeElement;
        // Letto dal CSS (.navbar-collapse { gap: var(--space-3) }), non duplicato qui: se il token
        // cambia, il calcolo resta allineato. 16px solo se non misurabile.
        const collapse = this.navListEl()?.nativeElement.parentElement;
        const GAP = (collapse && parseFloat(getComputedStyle(collapse).columnGap)) || 16;
        // clientWidth comprende il padding: con la linea del contenuto (.shell-line) è il rientro
        // dal bordo, fino a centinaia di px su uno schermo largo, e non è spazio per le voci.
        const style = getComputedStyle(container);
        const available = container.clientWidth
            - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
            - (brand?.offsetWidth ?? 0)
            - (userNav?.offsetWidth ?? 0)
            - (langWrap?.offsetWidth ?? 0)
            - GAP * 3; // brand↔collapse, ul↔user-nav, user-nav↔lingua

        const widths = items.map(ref => ref.nativeElement.offsetWidth);
        const fitCount = (budget: number): number => {
            let used = 0;
            let count = 0;
            for (const w of widths) {
                const next = used + (count > 0 ? GAP : 0) + w;
                if (next > budget) break;
                used = next;
                count++;
            }
            return count;
        };

        let count = fitCount(available);
        if (count < widths.length) {
            // Non entrano tutte: si riserva anche lo spazio del toggle "Altro" e si ricalcola. Se
            // "Altro" esiste già se ne misura la larghezza vera; altrimenti una stima generosa —
            // nel peggiore dei casi una voce in più nel dropdown al primo giro, mai contenuto tagliato.
            const ALTRO_WIDTH_ESTIMATE_FALLBACK = 96;
            const altroWidth = this.altroToggleEl()?.nativeElement.offsetWidth || ALTRO_WIDTH_ESTIMATE_FALLBACK;
            count = fitCount(available - GAP - altroWidth);
        }
        if (count !== this.visibleCount()) {
            this.visibleCount.set(count);
        }
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

    setLanguage(lang: string): void {
        void this.applyLanguageSwitch(lang);
    }

    /** Cambio lingua: prima lo stato (attende i cataloghi della nuova lingua), poi la navigazione al path equivalente, con i param della route sostituiti (altrimenti `:slug` finirebbe letterale nell'URL, 404). */
    private async applyLanguageSwitch(lang: string): Promise<void> {
        await this.translate.setLanguage(lang);
        const currentType = this.pageMeta.currentPageType();
        const homeType = ContestoSito.config.homePage;
        const template = (currentType != null ? ContestoSito.getPath(currentType, lang) : null)
            ?? (homeType != null ? ContestoSito.getPath(homeType, lang) : null)
            ?? '/';
        const params = mergeRouteParams(this.router.routerState.snapshot);
        const target = applyPathParams(template, params, 'NavbarComponent.applyLanguageSwitch');
        void this.router.navigate([target]);
        this.closeNavigation();
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
        this.menuState.requestCollapse();
    }

    /** `inert` sui fratelli dello shell (header escluso): contenuto, footer, FAB, banner. */
    private setBackgroundInert(inert: boolean): void {
        if (!inert) {
            this.inertSiblings.forEach(el => el.removeAttribute('inert'));
            this.inertSiblings = [];
            return;
        }
        const host = this.elRef.nativeElement as HTMLElement;
        const root = host.closest('app-root') ?? host.ownerDocument.body;
        this.inertSiblings = Array.from(root.children)
            .filter((el): el is HTMLElement => el instanceof HTMLElement && !el.contains(host) && !el.hasAttribute('inert'));
        this.inertSiblings.forEach(el => el.setAttribute('inert', ''));
    }
}
