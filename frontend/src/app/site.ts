import { buildSite } from './core/engine/siteBuilder';
import { AppPages, appPagesDecl, GENERATORS, STORIES } from './pages/app.pages';
import { LegalPages, legalSlots } from './pages/policy/legal.pages';

export type {
    SiteConfig,
    SitePageInput,
    SmokeSettings
} from './core/engine/siteBuilder';

// PageType: identità stabile di ogni pagina, assemblato dai file di area sotto pages/ (uno per area,
// ID prefissati — es. "app.", "legal."). Area nuova = nuovo file + uno spread qui sotto. I riferimenti
// nel codice (`PageType.GameRadar`, `PageType.CookiePolicy`, …) restano identici: cambia solo che ora
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

    // Slot legali: solo la Cookie Policy (vedi pages/policy/legal.pages.ts per la scelta di prodotto).
    legalPages: legalSlots,

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
            g.addPage(PageType.GameRadar);
            g.addPage(PageType.GameBurocrazia);
        });
    },

    footerNav: (f) => {
        f.addLink("githubDesc", 'https://github.com/br1brown/Br1Gaming');
        f.addPage(PageType.CookiePolicy);
    },
});
