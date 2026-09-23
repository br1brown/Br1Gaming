import { buildSite } from './core/engine/siteBuilder';
import { AppPages, appPagesDecl } from './pages/app.pages';
import { demoDesignSystem } from './components/shared/design-systems/demo.design-system';

export type {
    SiteConfig,
    SitePageInput,
    SmokeSettings
} from './core/engine/siteBuilder';

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
export const ContestoSito = buildSite({

    // Redirect degli utenti non autenticati (omessa → /error/401); noindex di default. Se il login
    // esiste e se è linkato in navbar lo decide Features.Login/PublicLogin (global-settings.json):
    // la demo ha il login pubblico.
    loginPage: PageType.Login,

    // Pagina del brand/logo nel navbar.
    homePage: PageType.Home,

    isWebApp: true, // default: false — la demo mostra anche il lato PWA (Service Worker, install offline)

    // Pagine legali (rotte /policy/* create dall'Engine): lo slot dice cos'è la pagina, il PageType
    // la identifica nel sito. Privacy obbligatoria; Cookie Policy obbligatoria con cookie o PWA (qui
    // c'è: la demo è una PWA); slot assente = pagina non creata.
    legal: {
        privacy: { page: PageType.PrivacyPolicy, updated: new Date('2026-09-22') },
        cookie: { page: PageType.CookiePolicy, updated: new Date('2026-09-22') },
        termsOfService: { page: PageType.TermsOfService, updated: new Date('2026-09-22') },
        legalNotice: { page: PageType.LegalNotice, updated: new Date('2026-09-22') },
        // Contenuti non accessibili noti: `nonAccessibili: [{ descrizioneKey, motivo, alternativaKey? }]`, testi in addon.*.json.
        accessibility: { page: PageType.AccessibilityStatement, updated: new Date('2026-09-23') },
    },

    // Comportamento di navbar/footer/header/pannello: il design system attivo decide tutto (navbar
    // fissa/mostrata, breadcrumb, tono, pannello...) — vedi demo.design-system.ts (estende Carta).
    // Oltre al design system, `shell` ha solo showNotifications (qui al suo default, false).
    shell: {
        designSystem: demoDesignSystem,
    },


    // Le dichiarazioni pagina vivono nei file di area (pages/*.pages.ts): qui solo gli spread.
    pages: () => [
        ...appPagesDecl,
    ],

});
