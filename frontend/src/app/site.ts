import { buildSite } from './core/engine/siteBuilder';
import { AppPages, appPagesDecl } from './pages/app.pages';
import { LegalPages, legalPagesDecl } from './pages/policy/legal.pages';
import { br1gamingDesignSystem } from './components/shared/design-systems/br1gaming.design-system';

export type {
    SiteConfig,
    SitePageInput,
    SmokeSettings
} from './core/engine/siteBuilder';

// PageType: identità stabile di ogni pagina, assemblato dai file di area sotto pages/ (uno per area,
// ID prefissati — es. "app.", "legal."). Area nuova = nuovo file + uno spread qui sotto. I riferimenti
// nel codice (`PageType.GameBurocrazia`, `PageType.CookiePolicy`, …) restano identici: cambia solo che ora
// il valore è una stringa d'identità invece di un intero enum.
export const PageType = {
    ...LegalPages,
    ...AppPages,
} as const;
export type PageType = (typeof PageType)[keyof typeof PageType];

// Struttura del sito: slot globali e pagine. Identita' minima (nome, versione, lingue, colore
// tema) vive in global-settings.json; tutta l'estetica (smoke incluso) è il design system attivo.
// Riferimento completo dei campi: frontend/README.md §"Opzioni Avanzate di site.ts".
export const ContestoSito = buildSite({

    homePage: PageType.Home,

    // Pagine legali del progetto (rotte /policy/* auto-generate). ID, voci e date di
    // aggiornamento vivono in pages/policy/legal.pages.ts.
    legalPages: legalPagesDecl,
    cookiePolicy: PageType.CookiePolicy,

    shell: {
        designSystem: br1gamingDesignSystem,
    },

    // Le dichiarazioni pagina vivono nel file di area (pages/app.pages.ts): qui solo lo spread.
    pages: () => [...appPagesDecl],

});
