import { buildSite } from './core/engine/siteBuilder';
import { AppPages, appPagesDecl } from './pages/app.pages';
import { LegalPages, legalSlots } from './pages/policy/legal.pages';

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

    // Slot legali dell'Engine → PageType del progetto (rotte /policy/* auto-generate).
    // ID e date di aggiornamento vivono in pages/policy/legal.pages.ts.
    legalPages: legalSlots,

    // Comportamento di navbar/footer/header/pannello (default applicati per ogni flag omesso).
    shell: {
        showNav: true,
        showFooter: true,
        fixedTopHeader: true,
        showBrandIconInHeader: true,
        forcedLightPanel: true,
        pageFade: true,
    },

    isWebApp: true,        // funzionalità PWA (Service Worker, aggiornamenti, install offline)
    onlyPlainImage: false, // anteprime social con sola immagine, senza scritte/favicon

    // Le dichiarazioni pagina vivono nei file di area (pages/*.pages.ts): qui solo gli spread.
    pages: () => [
        ...appPagesDecl,
    ],

    // Menu header/footer: builder con addPage / addLink / addGroup (gruppi annidabili;
    // limiti di profondità e resa per dispositivo: frontend/README.md §"Navigazione Multilivello").
    headerNav: (h) => {
        h.addPage(PageType.Impostazioni);
        h.addGroup('menuPolicy', g => {
            g.addPage(PageType.PrivacyPolicy);
            g.addPage(PageType.CookiePolicy);
            g.addPage(PageType.AccessibilityStatement);
            g.addGroup('menuLegale', sg => {
                sg.addPage(PageType.TermsOfService);
                sg.addPage(PageType.LegalNotice);
            });
        });
        h.addPage(PageType.Social);
    },

    footerNav: (f) => {
        f.addLink('githubDesc', 'https://github.com/br1brown/Br1WebEngine');
        f.addGroup('menuPolicy', g => {
            g.addPage(PageType.PrivacyPolicy);
            g.addPage(PageType.CookiePolicy);
            g.addPage(PageType.AccessibilityStatement);
            g.addGroup('menuLegale', sg => {
                sg.addPage(PageType.TermsOfService);
                sg.addPage(PageType.LegalNotice);
            });
        });
    },
});
