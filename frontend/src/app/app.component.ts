import { Component, computed, effect, inject, makeStateKey, PLATFORM_ID, TransferState } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, skip } from 'rxjs';

import { ContestoSito } from './site';
import { RouteChrome, CHROME_DATA_KEY } from './core/engine/siteBuilder';
import { CONTENT_WIDTH_CLASSES } from './core/engine/design-system-presets';
import { onNavigationEnd } from './core/engine/routing';
import { AppearanceService } from './core/engine/services/appearance.service';
import { FooterComponent } from './core/engine/components/footer/footer.component';
import { NavbarComponent } from './core/engine/components/navbar/navbar.component';
import { SmokeEffectComponent } from './core/engine/components/smoke-effect/smoke-effect.component';
import { BackToTopComponent } from './core/engine/components/back-to-top/back-to-top.component';
import { CookieBannerComponent } from './core/engine/components/cookie-banner/cookie-banner.component';
import { OfflineBannerComponent } from './core/engine/components/offline-banner/offline-banner.component';
import { NavProgressComponent } from './core/engine/components/nav-progress/nav-progress.component';
import { BreadcrumbComponent } from './core/engine/components/breadcrumb/breadcrumb.component';
import { PageMetaService } from './core/engine/services/page-meta.service';
import { VersionCheckService } from './core/engine/services/version-check.service';
import { WebVitalsService } from './core/engine/services/web-vitals.service';
import { TranslatePipe } from './core/engine/pipes/translate.pipe';

/** Chiave TransferState della chrome risolta: l'SSR la serializza, il client la rilegge come valore iniziale del signal, così il primo render combacia con l'HTML SSR senza flash navbar/pannello. */
const ROUTE_CHROME_STATE_KEY = makeStateKey<RouteChrome>(CHROME_DATA_KEY);

const aspetto = ContestoSito.config.aspetto;

/** Shell principale dell'app: non decide quali pagine esistono, consuma le route già trasformate e reagisce alla chrome della pagina attiva (decisa dal design system e dal ruolo della pagina, vedi `RouteChrome`). */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NavbarComponent, FooterComponent, SmokeEffectComponent, BackToTopComponent, CookieBannerComponent, OfflineBannerComponent, NavProgressComponent, BreadcrumbComponent, TranslatePipe],
    templateUrl: './app.component.html',
    // L'altezza minima a tutto schermo è gestita nativamente su `app-root` in base.scss con
    // `min-height: 100dvh` (altezza dinamica reale su mobile, evita i problemi del 100vh fisso).
    host: { class: 'd-flex flex-column' }
})
export class AppComponent {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly transferState = inject(TransferState);
    readonly theme = inject(AppearanceService);
    readonly pageMeta = inject(PageMetaService);

    readonly smoke = aspetto.smoke;

    /** Classi Bootstrap della colonna del breadcrumb e del pannello, da `DesignSystemPreset.larghezza`
     *  (default `'ampio'`). Senza pannello la pagina usa tutta la riga (`col-12`). */
    readonly contentWidthClass = CONTENT_WIDTH_CLASSES[aspetto.larghezza];

    /** Chrome risolta della rotta attiva. `initialValue` = chrome serializzata dall'SSR: il primo render client usa gli stessi flag dell'HTML SSR, niente sfarfallio prima del primo NavigationEnd. */
    private readonly routeChrome = onNavigationEnd(
        router => (PageMetaService.getLeaf(router.routerState.snapshot).data[CHROME_DATA_KEY] ?? {}) as RouteChrome,
        this.transferState.get(ROUTE_CHROME_STATE_KEY, {} as RouteChrome)
    );

    // Ogni parte della chrome: accesa solo se il design system risolto la tiene accesa, e il ruolo
    // della pagina attiva può solo spegnerla (`false`); ruolo che non la nomina → segue il design system.
    readonly showPanel = computed(() => aspetto.pannello && (this.routeChrome().showPanel ?? true));

    // Vista full-bleed del ruolo della pagina attiva (SpecRuoloPagina.fitViewport, deciso dal design
    // system attivo): lo shell rende il <main> senza container/padding e senza pannello, e
    // .fit-viewport (base.scss) fa riempire l'altezza al contenuto. Quando attivo prevale su
    // showPanel.
    readonly fitViewport = computed(() => this.routeChrome().fitViewport ?? false);

    readonly showNavbar = computed(() => aspetto.navbar.show && (this.routeChrome().showNav ?? true));

    readonly showFooter = computed(() => aspetto.footer.show && (this.routeChrome().showFooter ?? true));

    // Passato a NavbarComponent — QUALE icona resta ShellNavService.brandIcon (dato, non chrome),
    // risolto da NavbarComponent stessa.
    readonly showBrandIcon = computed(() => aspetto.navbar.icona && (this.routeChrome().showBrandIcon ?? true));

    readonly showBreadcrumb = computed(() => aspetto.breadcrumb.show && (this.routeChrome().showBreadcrumb ?? true));

    // Stesso gate su `smoke.enable`; un ruolo che non nomina `showSmoke` ha lo smoke dove c'è il
    // pannello e la vista non è full-bleed.
    // Nota: prefers-reduced-motion è delegata internamente allo SmokeEffectComponent per non rompere l'idratazione.
    readonly showSmoke = computed(() =>
        this.smoke.enable &&
        (this.routeChrome().showSmoke ?? (this.showPanel() && !this.fitViewport()))
    );

    constructor() {
        // SSR: serializza i flag risolti in TransferState così il client li ha già al primo render.
        // L'effect riscrive ad ogni cambio rotta; in SSR l'ultimo valore prima della serializzazione
        // è quello della pagina richiesta. Solo server: nel browser sarebbe inutile.
        if (isPlatformServer(this.platformId)) {
            effect(() => this.transferState.set(ROUTE_CHROME_STATE_KEY, this.routeChrome()));
        }

        inject(VersionCheckService).init();
        inject(WebVitalsService).init();

        // Riapre temporaneamente in stampa i tag <details> chiusi (es. Cookie Policy) 
        // per renderne visibile l'intero contenuto.
        if (isPlatformBrowser(this.platformId)) {
            let reopenedByPrint: HTMLDetailsElement[] = [];
            window.matchMedia('print').addEventListener('change', ({ matches }) => {
                if (matches) {
                    reopenedByPrint = Array.from(document.querySelectorAll('details:not([open])'));
                    reopenedByPrint.forEach(d => { d.open = true; });
                } else {
                    reopenedByPrint.forEach(d => { d.open = false; });
                    reopenedByPrint = [];
                }
            });

            // Ripristina il focus su #main-content al cambio pagina (A11y), saltando il load iniziale.
            inject(Router).events.pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                skip(1),
                takeUntilDestroyed()
            ).subscribe(() => {
                document.getElementById('main-content')?.focus();
            });
        }
    }
}
