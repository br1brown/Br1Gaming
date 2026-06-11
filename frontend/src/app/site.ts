import { buildSite, LeafPageInput } from './core/engine/siteBuilder';

export type {
    SiteConfig,
    SitePageInput,
    SmokeSettings
} from './core/engine/siteBuilder';

// ═══════════════════════════════════════════════════════════════════════
// ENUM PageType — identita' di ogni pagina
// ═══════════════════════════════════════════════════════════════════════
export enum PageType {
    //IMPORTANTI
    PrivacyPolicy,
    CookiePolicy,
    TermsOfService,
    LegalNotice,
    //PERSONALIZZABILI
    Home,
    GeneratorIncel,
    GeneratorAuto,
    GeneratorAntiveg,
    GeneratorLocali,
    GeneratorMbeb,
    StoryPoveriMaschi,
    StoryMagrogamer09,
    StorySurviveUsa,
    GameDuceNonDuce,
    GameRadar,
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
        pageType,
        layout: { showPanel: false },
        otherSEO: { ogImage: `generator.${urlSegment}` },
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
        pageType,
        otherSEO: { ogImage: `story.${urlSegment}` },
        component: () => import('./pages/story-player/story-player.component')
            .then(m => m.StoryPlayerComponent),
    };
}


export const ContestoSito = buildSite({

    // Pagina del brand/logo nel navbar.
    homePage: PageType.Home,

    legalPages: {
        cookie: PageType.CookiePolicy,
    },

    pages: () => [
        {
            path: '',
            title: 'homeNav',
            pageType: PageType.Home,
            layout: { showPanel: false },
            description: 'Generatori casuali, avventure interattive e tanto altro da Br1.',
            component: () => import('./pages/home/home.component').then(m => m.HomeComponent),
        },

        // ── Generatori ──────────────────────────────────────────────
        generatorPage('incel', PageType.GeneratorIncel),
        generatorPage('auto', PageType.GeneratorAuto),
        generatorPage('antiveg', PageType.GeneratorAntiveg),
        generatorPage('locali', PageType.GeneratorLocali),
        generatorPage('mbeb', PageType.GeneratorMbeb),

        // ── Giochi ──────────────────────────────────────────────────
        storyPage('poveri-maschi', PageType.StoryPoveriMaschi),
        storyPage('magrogamer09', PageType.StoryMagrogamer09),
        storyPage('sopravvivi-agli-usa', PageType.StorySurviveUsa),

        {
            path: `ducenonduce`,
            title: `DUCE NON DUCE?`,
            description: 'Indovina se la persona è un duce o non duce',
            pageType: PageType.GameDuceNonDuce,
            layout: { showPanel: false, showFooter: false },
            otherSEO: { ogImage: 'game.ducenonduce' },
            component: () => import('./pages/duce-non-duce/duce-non-duce.component')
                .then(m => m.DuceNonDuceComponent),
        },

        {
            path: `radar`,
            title: `Dragon Radar`,
            description: 'Il radar delle chiese intorno a te',
            pageType: PageType.GameRadar,
            otherSEO: { ogImage: 'game.radar' },
            layout: { showPanel: false, showFooter: false },
            component: () => import('./pages/radar/radar.component')
                .then(m => m.RadarComponent),
        },
    ],

    headerNav: (nav) => {
        nav.addGroup('generatori', (g) => {
            g.addPage(PageType.GeneratorIncel);
            g.addPage(PageType.GeneratorAuto);
            g.addPage(PageType.GeneratorAntiveg);
            g.addPage(PageType.GeneratorLocali);
            g.addPage(PageType.GeneratorMbeb);
        });
        nav.addGroup('giochi', (g) => {
            g.addPage(PageType.StoryPoveriMaschi);
            g.addPage(PageType.StoryMagrogamer09);
            g.addPage(PageType.StorySurviveUsa);
            g.addPage(PageType.GameDuceNonDuce);
            g.addPage(PageType.GameRadar);
        });
    },

    footerNav: (f) => {
        f.addLink("githubDesc", 'https://github.com/br1brown/Br1Gaming');
        f.addPage(PageType.CookiePolicy);
    },
});
