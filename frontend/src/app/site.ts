import { buildSite, LeafPageInput } from './siteBuilder';

export type {
    SiteConfig,
    SiteConfigInput,
    SitePageInput,
    SmokeSettings,
    SmokeSettingsInput
} from './siteBuilder';

// ═══════════════════════════════════════════════════════════════════════
// ENUM PageType — identita' di ogni pagina
// ═══════════════════════════════════════════════════════════════════════
export enum PageType {
    Home,
    CookiePolicy,
    GitHub,
    GeneratorIncel,
    GeneratorAuto,
    GeneratorAntiveg,
    GeneratorLocali,
    GeneratorMbeb,
    StoryPoveriMaschi,
    StoryMagrogamer09,
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER — crea una pagina generatore con path esplicito
// ═══════════════════════════════════════════════════════════════════════
function generatorPage(
    urlSegment: string,
    pageType: PageType,
): LeafPageInput {
    return {
        path: `generatori/${urlSegment}`,
        title: `generatore-${urlSegment}`,
        renderMode: 'server',
        enabled: true,
        pageType,
        showPanel: false,
        component: () => import('./pages/generator-detail/generator-detail.component')
            .then(m => m.GeneratorDetailComponent),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER — crea una pagina avventura con path esplicito
// ═══════════════════════════════════════════════════════════════════════
function storyPage(
    urlSegment: string,
    pageType: PageType,
): LeafPageInput {
    return {
        path: `avventura/${urlSegment}`,
        title: `avventura-${urlSegment}`,
        renderMode: 'server',
        enabled: true,
        pageType,
        showPanel: true,
        component: () => import('./pages/story-player/story-player.component')
            .then(m => m.StoryPlayerComponent),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAZIONE MASTER DEL SITO
// ═══════════════════════════════════════════════════════════════════════
export const ContestoSito = buildSite(site => {

    site.setSiteConfiguration({
        appName: 'Br1-Gaming',
        defaultLang: 'it',
        description: 'Generatori ignoranti, avventure interattive, universo Br1.',
        colorTema: '#e7ffe3',
        version: '2.0.0',
        showHeader: true,
        showFooter: true,
    });

    site.defineSitePages([
        {
            path: '',
            title: 'home',
            enabled: true,
            pageType: PageType.Home,
            showPanel: false,
            description: 'Generatori casuali, avventure interattive e tanto altro da Br1.',
            component: () => import('./pages/home/home.component').then(m => m.HomeComponent),
        },
        {
            externalUrl: 'https://github.com/br1brown/Br1Gaming',
            title: 'Codice Sorgente',
            enabled: true,
            pageType: PageType.GitHub,
        },

        // ── Generatori ──────────────────────────────────────────────
        generatorPage('incel',   PageType.GeneratorIncel),
        generatorPage('auto',    PageType.GeneratorAuto),
        generatorPage('antiveg', PageType.GeneratorAntiveg),
        generatorPage('locali',  PageType.GeneratorLocali),
        generatorPage('mbeb',    PageType.GeneratorMbeb),

        // ── Avventure ────────────────────────────────────────────────
        storyPage('poveri-maschi', PageType.StoryPoveriMaschi),
        storyPage('magrogamer09',  PageType.StoryMagrogamer09),

        {
            path: 'cookie-policy',
            title: 'cookiePolicy',
            enabled: true,
            pageType: PageType.CookiePolicy,
            renderMode: 'server',
            showPanel: true,
            description: 'cookiePolicyDesc',
            component: () => import('./pages/policy/policy.component').then(m => m.PolicyComponent),
        },
    ]);

    site.configureFooterNavigation(footer => {
        footer.addPage(PageType.GitHub);
        footer.addPage(PageType.CookiePolicy);
    });
});
