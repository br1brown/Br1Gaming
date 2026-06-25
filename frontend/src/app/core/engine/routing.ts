import { CanActivateFn, NavigationEnd, Route, Router, Routes } from '@angular/router';
import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ContestoSito } from '../../site';
import { AuthService } from '../services/auth.service';
import { contentLoaderResolver } from '../../pages/content.resolver';
import { InternalSitePage, isInternalPage, isParentPage, ShellFlags, SHELL_DATA_KEY } from './siteBuilder';
import { NotificationService } from './services/notification.service';
import { TranslateService } from './services/translate.service';

/**
 * Signal che riemette `project(router)` ad ogni `NavigationEnd`, partendo da `initial`.
 * Centralizza il pattern `toSignal(router.events → NavigationEnd)` usato in più punti (shell di
 * `app.component`, URL corrente). Va chiamata in un injection context (inietta `Router`).
 */
export function onNavigationEnd<T>(project: (router: Router) => T, initial: T): Signal<T> {
    const router = inject(Router);
    return toSignal(
        router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => project(router))),
        { initialValue: initial }
    );
}

export function injectCurrentUrl(): Signal<string> {
    const router = inject(Router);
    return onNavigationEnd(() => router.url, router.url);
}

/**
 * Guard di autenticazione: protegge le rotte che hanno il flag `requiresAuth`.
 */
const authGuard: CanActivateFn = (route) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const notification = inject(NotificationService);
    const translate = inject(TranslateService);

    if (authService.isLoggedIn()) {
        return true;
    }

    // Utente non autenticato: lo mandiamo alla pagina di login passando il motivo come query
    // param (`reason=auth`), così la pagina mostra un avviso inline invece di una modale.
    // Conserviamo anche il pageType di partenza per tornarci automaticamente dopo il login.
    const redirectPage = ContestoSito.config.loginPage;
    if (redirectPage != null) {
        const path = ContestoSito.getPath(redirectPage);
        if (path) {
            // Redirigiamo alla pagina di login indicata, passando il vecchio pageType
            return router.createUrlTree([path], {
                queryParams: { returnPageType: route.data['pageType'], reason: 'auth' }
            });
        }
    }

    // Se redirectPage è nullo: non abbiamo una pagina di login dove mandare l'utente,
    // quindi restiamo sulla pagina corrente e segnaliamo l'accesso negato con una modale.
    notification.error(
        translate.translate('errore401Titolo'),
        translate.translate('errore401Descrizione')
    );
    return false;
};

/**
 * DEFINIZIONE DELLE ROTTE ANGULAR
 * Le rotte vengono generate partendo dalla configurazione dichiarativa in site.ts.
 */
export const routes: Routes = [
    // Contesto.pages contiene solo pagine interne; qui filtriamo quelle abilitate.
    ...buildRoutes(ContestoSito.pages),
    ...buildErrorRoutes()
];

/**
 * Trasforma ricorsivamente l'albero di pagine interne in Routes di Angular.
 */
function buildRoutes(pages: InternalSitePage[]): Routes {
    return pages
        .filter(page => page.enabled)
        .map(page => toAngularRoute(page));
}

/**
 * Converte un singolo nodo della DSL (Parent o Leaf) in una Route di Angular.
 */
function toAngularRoute(page: InternalSitePage): Route {
    const route: Route = {
        path: page.path,
        // Applica la guard solo se richiesto esplicitamente nella configurazione.
        canActivate: page.requiresAuth ? [authGuard] : [],
        data: {
            ...page.data,
            pageType: page.pageType
        }
    };

    if (isParentPage(page)) {
        // Se e' un Parent, non carichiamo un componente ma i suoi figli.
        route.children = buildRoutes(page.children.filter(isInternalPage));
    } else {
        // Se e' una LeafPage, carichiamo il componente in modo lazy.
        route.loadComponent = page.component;
        route.data = {
            ...route.data,
            // Piatti → diventano input del componente via withComponentInputBinding (insieme ai
            // `data` liberi del figlio già in ...route.data).
            pageType: page.pageType,
            // Fade-in: subordinato al globale come showNav/footer — off globale vince, la pagina può solo spegnere.
            pageFade: ContestoSito.config.pageFade && (page.pageFade ?? true),
            // Raggruppate → lette SOLO dalla shell (root, fuori dall'outlet) via snapshot. L'oggetto
            // arriva già pronto da normalizeSitePage; i default (?? true/false) li applica app.component.
            // (description/ogImage NON vanno qui: l'OG passa dal resolver via PageInfo → page-base.)
            [SHELL_DATA_KEY]: page.shell,
        };

        route.resolve = { contentByResolve: contentLoaderResolver(page.pageType) };

    }

    return route;
}

/**
 * Rotte di gestione errori (404, ecc.).
 */
function buildErrorRoutes(): Routes {
    const routes: Routes = [];
    const authPage = ContestoSito.config.loginPage;
    const authPath = authPage != null ? ContestoSito.getPath(authPage) : null;

    if (authPath) {
        routes.push({
            path: 'error/401',
            redirectTo: authPath,
            pathMatch: 'full'
        });
    }

    routes.push(
        {
            path: 'error/:errorCode',
            title: 'erroreGenerico',
            loadComponent: () => import('../../pages/error/error.component').then(m => m.ErrorComponent),
            data: { [SHELL_DATA_KEY]: { showPanel: false } satisfies ShellFlags }
        },
        {
            path: 'error',
            redirectTo: 'error/500',
            pathMatch: 'full'
        },
        {
            // Qualsiasi rotta non trovata: rende DIRETTAMENTE la pagina errore (404), niente `redirectTo`.
            // Un redirect su una rotta SSR `RenderMode.Client` viene emesso come 3xx + `Location`, ma il
            // server riscrive lo status a 404 (SEO): il browser, vedendo un 404 e non un 3xx, ignora il
            // `Location` → pagina bianca al full-load di un URL sconosciuto. Rendere il componente (errorCode
            // default 404) fa servire la shell e idratare la pagina, esattamente come `error/:errorCode`.
            path: '**',
            title: 'erroreGenerico',
            loadComponent: () => import('../../pages/error/error.component').then(m => m.ErrorComponent),
            data: { [SHELL_DATA_KEY]: { showPanel: false } satisfies ShellFlags }
        }
    );

    return routes;
}
