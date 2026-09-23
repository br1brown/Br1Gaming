import { buildSite } from './core/engine/siteBuilder';
import { AppPages, appPagesDecl } from './pages/app.pages';
import { br1gamingDesignSystem } from './components/shared/design-systems/br1gaming.design-system';

export type {
    SiteConfig,
    SitePageInput,
    SmokeSettings
} from './core/engine/siteBuilder';

// PageType: identità stabile di ogni pagina. Le pagine legali standard sono slot letti
// direttamente dall'Engine (vedi `legal` sotto in buildSite): non serve più un modulo/area a
// parte da spargere qui con lo spread, come prima di questo aggiornamento dell'Engine.
export const PageType = {
    PrivacyPolicy: 'legal.privacy',
    CookiePolicy: 'legal.cookie',
    TermsOfService: 'legal.tos',
    LegalNotice: 'legal.notice',
    AccessibilityStatement: 'legal.accessibility',
    ...AppPages,
} as const;
export type PageType = (typeof PageType)[keyof typeof PageType];

// Struttura del sito: slot globali e pagine. Identita' minima (nome, versione, lingue, colore
// tema) vive in global-settings.json; tutta l'estetica (smoke incluso) è il design system attivo.
// Riferimento completo dei campi: frontend/README.md §"Opzioni Avanzate di site.ts".
export const ContestoSito = buildSite({

    // Nessun login/area riservata su questo sito: niente admin, niente editor di contenuti.
    homePage: PageType.Home,

    // Pagine legali (rotte /policy/* create dall'Engine): il Markdown esiste in assets/legal/<cartella>/.
    // Live solo Cookie e Privacy, per lo stesso motivo di prima di questo aggiornamento dell'Engine:
    // Br1Gaming non ha un'identità societaria registrata, quindi ToS/Note Legali/Accessibility restano
    // commentate, non cancellate — pronte se in futuro cambia lo status del progetto. Cookie serve
    // comunque (cookie tecnici di salvataggio partite + Mapbox come Analytics di terze parti, vedi
    // cookie-registry.ts); Privacy per lo stesso motivo (dati trattati anche senza un'entità registrata
    // dietro). ToS rivendicherebbe la proprietà dei contenuti per un'entità che non esiste; Note Legali
    // è l'identificazione di un prestatore di servizi commerciale (D.Lgs 70/2003) che qui non si
    // applica; Accessibility riguarda PA/e-commerce/soglie di fatturato, fuori scope per un progetto
    // personale.
    legal: {
        privacy: { page: PageType.PrivacyPolicy, updated: new Date('2026-09-24') },
        cookie: { page: PageType.CookiePolicy, updated: new Date('2026-08-20') },
        // termsOfService: { page: PageType.TermsOfService },
        // legalNotice: { page: PageType.LegalNotice },
        // accessibility: { page: PageType.AccessibilityStatement },
    },

    shell: {
        designSystem: br1gamingDesignSystem,
    },

    // Le dichiarazioni pagina vivono nel file di area (pages/app.pages.ts): qui solo lo spread.
    pages: () => [...appPagesDecl],

});
