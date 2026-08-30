import { buildSite } from './core/engine/siteBuilder';
import { AppPages, appPagesDecl, GENERATORS, STORIES } from './pages/app.pages';
import { LegalPages, legalPagesDecl } from './pages/policy/legal.pages';

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

// Struttura del sito: slot globali, pagine e menu. Identita' ed estetica (nome,
// versione, lingue, tema, smoke) NON stanno qui: vivono in global-settings.json.
// Riferimento completo dei campi: frontend/README.md §"Opzioni Avanzate di site.ts".
export const ContestoSito = buildSite({

    isWebApp: false,

    homePage: PageType.Home,

    // Pagine legali del progetto (rotte /policy/* auto-generate). ID, voci e date di
    // aggiornamento vivono in pages/policy/legal.pages.ts.
    legalPages: legalPagesDecl,
    cookiePolicy: PageType.CookiePolicy,

    // Le dichiarazioni pagina vivono nel file di area (pages/app.pages.ts): qui solo lo spread.
    pages: () => [...appPagesDecl],

    headerNav: (nav) => {
        nav.addGroup('generatori', (g) => {
            // I generatori veri e propri stanno in un sottogruppo annidato, così i Piaciuti
            // (che raccolgono i loro output) vivono accanto a loro senza sembrare un generatore.
            g.addGroup('tuttiIGeneratori', (gg) => {
                GENERATORS.forEach(([, pageType]) => gg.addPage(pageType));
            });
            g.addPage(PageType.Piaciuti);
        });
        nav.addGroup('giochi', (g) => {
            // Le storie (avventure a bivi) in un sottogruppo annidato; gli altri giochi restano fuori.
            g.addGroup('storie', (gg) => {
                STORIES.forEach(([, pageType]) => gg.addPage(pageType));
            });
            g.addPage(PageType.GameDuceNonDuce);
            g.addPage(PageType.GameBurocrazia);
        });
        // Utility: strumenti che non sono giochi (radar chiese + traduttore ITA→ESP).
        nav.addGroup('utility', (g) => {
            g.addPage(PageType.UtilityRadar);
            g.addPage(PageType.UtilityTranslator);
        });
    },

    // Le pagine legali NON si dichiarano qui: `footer.component` le rende da sole, in una fascia
    // dedicata ("small prints") derivata da `legalPages` sopra — vedi `FooterLinkRowComponent`.
    // `footerNav` resta per la navigazione libera del progetto.
    footerNav: (f) => {
        f.addLink("githubDesc", 'https://github.com/br1brown/Br1Gaming');
        f.addPage(PageType.CookiePolicy);
    },
});
