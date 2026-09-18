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
import { BreadcrumbComponent } from './core/engine/components/breadcrumb/breadcrumb.component';
import { PageMetaService } from './core/engine/services/page-meta.service';
import { VersionCheckService } from './core/engine/services/version-check.service';
import { WebVitalsService } from './core/engine/services/web-vitals.service';
import { TranslatePipe } from './core/engine/pipes/translate.pipe';

/**
 * Chiave TransferState della chrome risolta. L'SSR serializza la chrome della rotta RISOLTA; il
 * client la rilegge come valore iniziale del signal, così il primo render combacia con l'HTML SSR
 * (no flash navbar/pannello) SENZA dipendere dal timing della prima navigazione del router.
 * Riusa la stessa stringa della chiave in `route.data`: è la stessa cosa logica, due canali diversi.
 */
const ROUTE_CHROME_STATE_KEY = makeStateKey<RouteChrome>(CHROME_DATA_KEY);

/**
 * Shell principale dell'app (nel senso architetturale di "app shell": il contenitore radice che
 * avvolge `<router-outlet>`): non decide quali pagine esistono, consuma le route già trasformate e
 * reagisce alla chrome risolta della pagina attiva (showPanel, showNav, showFooter) — al 100%
 * decisa dal design system attivo, vedi `RouteChrome` in `siteBuilder.ts`.
 */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NavbarComponent, FooterComponent, SmokeEffectComponent, BackToTopComponent, CookieBannerComponent, BreadcrumbComponent, TranslatePipe],
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

    readonly smoke = ContestoSito.config.smoke;

    /** Classi Bootstrap della colonna contenuti (breadcrumb-row/pannello), decise dal design
     *  system attivo — `DesignSystemPreset.contentWidth` (default `'ampio'`, il comportamento
     *  storico). Vedi `CONTENT_WIDTH_CLASSES` in `design-system-presets.ts`. */
    readonly contentWidthClass = CONTENT_WIDTH_CLASSES[ContestoSito.config.contentWidth];

    /**
     * Chrome risolta della rotta attiva (`route.data[CHROME_DATA_KEY]`, scritto da routing.ts).
     * `initialValue` = chrome serializzata dall'SSR (TransferState): il primo render client usa gli
     * stessi flag dell'HTML SSR → niente sfarfallio prima del primo NavigationEnd. Poi si aggiorna a
     * ogni navigazione; senza SSR → `{}` → default.
     */
    private readonly routeChrome = onNavigationEnd(
        router => (PageMetaService.getLeaf(router.routerState.snapshot).data[CHROME_DATA_KEY] ?? {}) as RouteChrome,
        this.transferState.get(ROUTE_CHROME_STATE_KEY, {} as RouteChrome)
    );

    // Il ruolo vince SEMPRE sul default globale del design system, in entrambe le direzioni — non
    // solo per "spegnere". Un ruolo esplicito (`ruoloPagina.<ruolo>.showPanel`) sovrascrive anche un
    // default globale opposto (implicito in `DesignSystemPreset.superfici`, mai un campo showPanel a
    // parte — vedi `siteBuilder.ts`): sono lo stesso autore (il design system), non ha senso che il
    // globale blocchi il ruolo. Ruolo non mappato → default globale.
    readonly showPanel = computed(() => this.routeChrome().showPanel ?? ContestoSito.config.showPanel);

    // Vista full-bleed del ruolo della pagina attiva (SpecRuoloPagina.fitViewport, deciso dal design
    // system attivo): lo shell rende il <main> senza container/padding e senza pannello, e
    // .fit-viewport (base.scss) fa riempire l'altezza al contenuto. Quando attivo prevale su
    // showPanel.
    readonly fitViewport = computed(() => this.routeChrome().fitViewport ?? false);

    // Stesso principio di showPanel sopra: il ruolo vince sempre, in entrambe le direzioni.
    readonly showNavbar = computed(() => this.routeChrome().showNav ?? ContestoSito.config.showNav);

    readonly showFooter = computed(() => this.routeChrome().showFooter ?? ContestoSito.config.showFooter);

    // Stesso principio di showPanel sopra: il ruolo vince sempre. Passato a NavbarComponent — QUALE
    // icona resta ShellNavService.brandIcon (dato, non chrome), risolto da NavbarComponent stessa.
    readonly showBrandIcon = computed(() => this.routeChrome().showBrandIcon ?? ContestoSito.config.showBrandIcon);

    // Stesso principio: il ruolo vince sempre. In sua assenza, `null` (default globale acceso) fa
    // scattare l'euristica intelligente del breadcrumb (vedi BreadcrumbComponent); `false` (default
    // globale spento) lo nasconde senza euristica.
    readonly breadcrumbOverride = computed(() =>
        this.routeChrome().showBreadcrumb ?? (ContestoSito.config.showBreadcrumb ? null : false));

    // `smoke.enable` (globale, design system) fa da gate primario, senza eccezioni per ruolo.
    // Il `ruoloPagina.showSmoke` del ruolo attivo vince sul default intelligente (pannello sì,
    // full-bleed no), permettendo eccezioni (es. forzare lo smoke su un ruolo full-bleed).
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
