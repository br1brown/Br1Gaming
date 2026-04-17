import { buildSite } from './siteBuilder';
import type { LeafPageInput } from './siteBuilder';

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
    description: string
): Omit<LeafPageInput, 'title'> & { title: string } {
    return {
        path: `generatori/${urlSegment}`,
        title: `generatore-${urlSegment}`,
        renderMode: 'server',
        enabled: true,
        pageType,
        showPanel: true,
        description,
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
    description: string
): Omit<LeafPageInput, 'title'> & { title: string } {
    return {
        path: `avventura/${urlSegment}`,
        title: `avventura-${urlSegment}`,
        renderMode: 'server',
        enabled: true,
        pageType,
        showPanel: true,
        description,
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
        description: 'Br1 e i suoi giochini',
        colorTema: '#cff7cb',
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
        generatorPage('incel', PageType.GeneratorIncel, 'Genera il tuo incel di fiducia'),
        generatorPage('auto', PageType.GeneratorAuto, 'Genera storie di automobilisti'),
        generatorPage('antiveg', PageType.GeneratorAntiveg, 'Genera il profilo dell\'antivegano'),
        generatorPage('locali', PageType.GeneratorLocali, 'Trova il nome del tuo locale tutto italiano'),
        generatorPage('mbeb', PageType.GeneratorMbeb, 'Genera il tuo mbeb'),

        // ── Avventure ────────────────────────────────────────────────
        storyPage('poveri-maschi', PageType.StoryPoveriMaschi, 'Scopri se i poveri maschi hanno davvero ragione o torto'),
        storyPage('magrogamer09', PageType.StoryMagrogamer09, 'Segui le avventure del leggendario Magrogamer09'),

        {
            path: 'cookie-policy',
            title: 'cookiePolicy',
            enabled: true,
            pageType: PageType.CookiePolicy,
            showPanel: true,
            description: 'Informativa sui cookie di Br1-Gaming.',
            component: () => import('./pages/policy/policy.component').then(m => m.PolicyComponent),
        },
    ]);

    site.configureFooterNavigation(footer => {
        footer.addPage(PageType.GitHub);
        footer.addPage(PageType.CookiePolicy);
    });
});
