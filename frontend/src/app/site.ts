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
    GitHub,
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

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAZIONE MASTER DEL SITO
// ═══════════════════════════════════════════════════════════════════════
//
// Definisce la STRUTTURA e il COMPORTAMENTO del sito. Identità ed estetica
// (nome, versione, lingue, descrizione, tema, smoke) NON stanno qui: vivono in
// global-settings.json e arrivano al frontend via environment.ts.
//
export const ContestoSito = buildSite({

    // Pagina del brand/logo nel navbar.
    homePage: PageType.Home,

    // Pagine legali: il progetto usa solo la Cookie Policy (obbligatoria perché il sito
    // usa cookie). Gli altri slot omessi = pagine non create. L'Engine costruisce /policy/*.
    legalPages: {
        cookie: PageType.CookiePolicy,
    },

    // Comportamento della shell (default sensati per ogni flag omesso).
    shell: {
        showNav: true,
        showFooter: true,
        fixedTopHeader: false,
        showBrandIconInHeader: true,
        showLoginInHeader: false,
        forcedLightPanel: true,
    },

    isWebApp: true,         // PWA: Service Worker, aggiornamenti, install offline
    onlyPlainImage: false,  // anteprime social con scritte/favicon sovrapposte

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
            layout: { showPanel: false },
            otherSEO: { ogImage: 'game.ducenonduce' },
            component: () => import('./pages/duce-non-duce/duce-non-duce.component')
                .then(m => m.DuceNonDuceComponent),
        },

        {
            path: `radar`,
            title: `Dragon Radar`,
            description: 'Trova le 7 chiese sacre nascoste intorno a te',
            pageType: PageType.GameRadar,
            otherSEO: { ogImage: 'game.radar' },
            layout: { showPanel: false, showFooter: false },
            // 'server' (non 'client'): l'SSR rende la shell e popola il TransferState con
            // Custom (token Mapbox). La logica GPS/bussola/mappa resta client (afterNextRender).
            renderMode: 'server',
            component: () => import('./pages/radar/radar.component')
                .then(m => m.RadarComponent),
        },
    ],

    footerNav: (f) => {
        f.addLink("githubDesc", 'https://github.com/br1brown/Br1Gaming');
        f.addPage(PageType.CookiePolicy);
    },
});
