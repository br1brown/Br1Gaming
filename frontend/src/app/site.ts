import { buildSite } from './core/engine/siteBuilder';
import { AppPages, appPagesDecl } from './pages/app.pages';
import { LegalPages, legalPagesDecl } from './pages/policy/legal.pages';
import { demoDesignSystem } from './components/shared/design-systems/demo.design-system';

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

// Struttura del sito: slot globali e pagine. Identita' minima (nome, versione, lingue, colore
// tema) vive in global-settings.json; tutta l'estetica (smoke incluso) è il design system attivo.
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

    // Comportamento di navbar/footer/header/pannello: il design system attivo decide tutto (navbar
    // fissa/mostrata, breadcrumb, tono, pannello...) — vedi demo.design-system.ts (estende Carta).
    // Il solo flag di sito vero e proprio rimasto in `shell` è showNotifications (qui al suo
    // default, vedi SiteShellConfig in siteBuilder.ts).
    shell: {
        designSystem: demoDesignSystem,
    },

    isWebApp: true, // default: false — la demo mostra anche il lato PWA (Service Worker, install offline)

    // Le dichiarazioni pagina vivono nei file di area (pages/*.pages.ts): qui solo gli spread.
    pages: () => [
        ...appPagesDecl,
    ],

});
