import { buildSite } from './core/engine/siteBuilder';
import { AppPages, appPagesDecl } from './pages/app.pages';
import { LegalPages, legalPagesDecl } from './pages/policy/legal.pages';

export type {
    SiteConfig,
    SitePageInput,
    SmokeSettings
} from './core/engine/siteBuilder';

// PageType: identità stabile di ogni pagina, assemblato dai file di area sotto pages/ (uno per area,
// ID prefissati — es. "app.", "legal."). Area nuova = nuovo file + uno spread qui sotto.
// Perché PageType e non il path: frontend/README.md §"Pagine & rotte" (ricetta: AGENTS.md §"Aggiungere una pagina").
export const PageType = {
    ...LegalPages,
    ...AppPages,
} as const;
export type PageType = (typeof PageType)[keyof typeof PageType];

// Struttura del sito: slot globali, pagine e menu. Identita' ed estetica (nome,
// versione, lingue, tema, smoke) NON stanno qui: vivono in global-settings.json.
// Riferimento completo dei campi: frontend/README.md §"Opzioni Avanzate di site.ts".
export const ContestoSito = buildSite({

    // Redirect degli utenti non autenticati (omessa → /error/401); noindex di default.
    // La demo espone il login in navbar; `loginPage: PageType.Login` nudo lo terrebbe fuori.
    loginPage: { page: PageType.Login, showInHeader: true },

    // Pagina del brand/logo nel navbar.
    homePage: PageType.Home,

    // Pagine legali del progetto (rotte /policy/* auto-generate). ID, voci e date di
    // aggiornamento vivono in pages/policy/legal.pages.ts.
    legalPages: legalPagesDecl,
    cookiePolicy: PageType.CookiePolicy,

    // Comportamento di navbar/footer/header/pannello: solo gli scostamenti dal default (ogni
    // flag omesso resta al proprio default, vedi SiteShellConfig in siteBuilder.ts).
    shell: {
        fixedTopHeader: true, // default: false — qui la navbar resta fissa in alto allo scroll
    },

    isWebApp: true, // default: false — la demo mostra anche il lato PWA (Service Worker, install offline)

    // Le dichiarazioni pagina vivono nei file di area (pages/*.pages.ts): qui solo gli spread.
    pages: () => [
        ...appPagesDecl,
    ],

    // Menu header/footer: NON qui — è dato, non struttura del sito, risolto a runtime.
    // Vive in `nav.ts`, vedi `ShellNavResolver` in `core/engine/shell-nav.ts`.
});
