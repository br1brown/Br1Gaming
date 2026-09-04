import { CanActivateFn, NavigationEnd, Route, Router, RouterStateSnapshot, Routes } from '@angular/router';
import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ContestoSito } from '../../site';
import { environment } from '../../../environments/environment';
import { contentLoaderResolver } from './pages/content.resolver';
import { InternalSitePage, isInternalPage, isParentPage, resolvePagePath, ShellFlags, SHELL_DATA_KEY } from './siteBuilder';
import { authGuard, languageSyncGuard } from './route-guards';

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

/** Merge dei param di rotta lungo tutta la catena attiva (root → foglia) di uno snapshot del
 *  router: una rotta annidata porta il proprio `:param` solo sul segmento che lo dichiara. Usata
 *  ovunque serva risolvere un `PageType` parametrico verso un link/URL concreto (navbar, meta
 *  hreflang) — vedi `applyPathParams` in siteBuilder.ts. */
export function mergeRouteParams(state: RouterStateSnapshot): Record<string, string> {
    let node = state.root;
    let params: Record<string, string> = { ...node.params };
    while (node.firstChild) {
        node = node.firstChild;
        params = { ...params, ...node.params };
    }
    return params;
}

// authGuard e languageSyncGuard vivono in route-guards.ts (file a parte): qui restano solo la
// costruzione dell'albero delle route e i guard vengono solo attaccati alle route giuste.

/**
 * ROUTES FINALI, esportate e usate da provideRouter() in app.config.ts.
 * Un ciclo per ogni lingua disponibile (environment.availableLanguages, generato a build-time da
 * generate-statics.ts a partire da Localization.SupportedLanguages) — NON una lista fissa di 2:
 * con una sola lingua, il ciclo gira una volta sola e produce esattamente le route di un sito
 * mono-lingua, senza prefisso, come oggi in Br1Gaming e negli altri figli.
 */
export const routes: Routes = [
    ...environment.availableLanguages.flatMap((lang): Routes =>
        lang === environment.defaultLang
            // Lingua default: le route stanno alla RADICE, senza prefisso (es. `/pagina`).
            ? buildRoutes(ContestoSito.pages, lang)
            // Lingua aggiuntiva: le stesse route, ma avvolte sotto un nodo padre `{path: lang}` —
            // è così che Angular Router prefissa un intero sottoalbero (es. `/en/pagina`). Le route
            // di Angular sono relative al genitore, quindi "prefissare" vuol dire annidare, non
            // concatenare stringhe (diverso da come fa `processPages` in siteBuilder.ts, che lavora
            // su path assoluti/flat e lì la concatenazione stringhe è la scelta giusta).
            : [{ path: lang, children: buildRoutes(ContestoSito.pages, lang) }]
    ),
    ...buildErrorRoutes(), // 404/401/ecc — SEMPRE alla radice, mai duplicate per lingua (vedi sotto).
];

/** Cammina l'albero pagine di site.ts e produce le Route Angular corrispondenti, per UNA lingua. */
function buildRoutes(pages: InternalSitePage[], lang: string): Routes {
    return pages
        .filter(page => page.enabled) // pagine disabilitate (enabled: false): fuori ovunque, anche dalle route.
        .map(page => toAngularRoute(page, lang));
}

/** Converte UN nodo della DSL (pagina Parent o Leaf) in UNA Route Angular, per la lingua data. */
function toAngularRoute(page: InternalSitePage, lang: string): Route {
    // languageSyncGuard SEMPRE, su ogni route: allinea TranslateService alla lingua della route
    // prima che guard/resolver a valle (authGuard, i resolver di dominio) leggano currentLang().
    // Vedi il commento su languageSyncGuard in route-guards.ts per il perché.
    const canActivate: CanActivateFn[] = [languageSyncGuard];
    // authGuard solo se la pagina lo richiede esplicitamente in site.ts (requiresAuth: true).
    if (page.requiresAuth) canActivate.push(authGuard);

    const route: Route = {
        // Segmento dichiarato in site.ts, risolto sulla lingua corrente — letterale o per-lingua
        // (vedi resolvePagePath in siteBuilder.ts). STESSA risoluzione di processPages() lì: le
        // due devono produrre lo stesso path per la stessa pagina+lingua, o i link interni
        // smetterebbero di corrispondere alla rotta Angular vera qui.
        path: resolvePagePath(page.path, lang, environment.defaultLang),
        canActivate,
        data: {
            ...page.data,       // data liberi del figlio (site.ts) — diventano @Input() via withComponentInputBinding.
            pageType: page.pageType, // identità stabile della pagina — letto da guard/resolver/PageBaseComponent.
            lang,                // LA riga chiave di tutta la migrazione: da qui PageBaseComponent sincronizza TranslateService.
        }
    };

    if (isParentPage(page)) {
        // Pagina-contenitore (menu annidato, es. /policy/*): nessun componente proprio, solo figli.
        route.children = buildRoutes(page.children.filter(isInternalPage), lang);
    } else {
        // Pagina foglia (LeafPage): carica il componente lazy dichiarato in site.ts.
        route.loadComponent = page.component;
        route.data = {
            ...route.data,
            pageType: page.pageType,
            lang, // ripetuto: qui route.data viene RISCRITTO per intero, non è un duplicato accidentale.
            // pageFade: gate globale (config.pageFade) + override per-pagina (page.pageFade) — off
            // globale vince sempre, la pagina può solo spegnere, mai riaccendere da sola.
            pageFade: ContestoSito.config.pageFade && (page.pageFade ?? true),
            // SHELL_DATA_KEY: i flag di layout (showNav/showFooter/fitViewport...) letti SOLO dalla
            // shell (app.component, fuori dal <router-outlet>) via snapshot — mai spacchettati qui.
            [SHELL_DATA_KEY]: page.shell,
        };

        // lang passato ESPLICITAMENTE in chiusura, non letto da translate.currentLang(): il resolver
        // gira PRIMA che il componente esista, quindi prima che PageBaseComponent possa aver
        // sincronizzato la lingua — currentLang() qui risolverebbe ancora alla pagina precedente.
        route.resolve = { contentByResolve: contentLoaderResolver(page.pageType, lang) };
    }

    return route;
}

/** Route di gestione errori (404/401/ecc) — uniche, non moltiplicate per lingua: vedi ErrorComponent
 *  (deriva la lingua dal path a runtime, non da route.data) per il perché. */
function buildErrorRoutes(): Routes {
    const routes: Routes = [];
    const authPage = ContestoSito.config.loginPage;
    // Path del login SEMPRE in lingua default qui: è un redirect statico (route.redirectTo), calcolato
    // una volta a module-load — non ha un `route.data.lang` da leggere, a differenza di authGuard
    // (che invece gira a runtime e quindi PUÒ leggere la lingua della richiesta). Caso limite accettato:
    // /error/401 raggiunto direttamente (non via authGuard) è raro e non SEO-rilevante (noindex).
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
            // :errorCode letto da ErrorComponent via route param → @Input(). Niente `title` nativa
            // qui: come ogni altra pagina del sito, ErrorComponent imposta document.title da sé
            // (tradotto) — una `title` statica finirebbe su schermo verbatim, mai tradotta.
            path: 'error/:errorCode',
            loadComponent: () => import('../../pages/error/error.component').then(m => m.ErrorComponent),
            data: { [SHELL_DATA_KEY]: { showPanel: false } satisfies ShellFlags }
        },
        {
            path: 'error',
            redirectTo: 'error/500', // /error senza codice = 500 di default.
            pathMatch: 'full'
        },
        {
            // Wildcard — qualsiasi path non altrimenti matchato, incluso uno sbagliato sotto /en/.
            // Rende DIRETTAMENTE il componente (niente redirectTo): un redirect su una rotta SSR
            // RenderMode.Client uscirebbe come 3xx+Location, ma il server lo riscrive a 404 (SEO) —
            // il browser vedrebbe 404 invece di 3xx e ignorerebbe il Location, pagina bianca.
            path: '**',
            loadComponent: () => import('../../pages/error/error.component').then(m => m.ErrorComponent),
            data: { [SHELL_DATA_KEY]: { showPanel: false } satisfies ShellFlags }
        }
    );

    return routes;
}
