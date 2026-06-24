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
    GameBurocrazia,
    Galleria,
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

    // PWA disattivata per questo sito: niente Service Worker. Non c'è nulla di realmente
    // offline (servirebbe censire gli endpoint in config, non previsto dal codice attuale) e
    // l'unico effetto del SW era costringere gli utenti ad aggiornare la cache a ogni deploy.
    // Il default del padre resta `true`: è solo questo figlio a fare opt-out.
    isWebApp: false,

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
            // La home espone già Generatori/Storie/Giochi come sezioni: la navbar sarebbe ridondante.
            layout: { showPanel: false, showNav: false },
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
            title: `ducenonduce`,
            description: 'Indovina se la persona è un duce o non duce',
            pageType: PageType.GameDuceNonDuce,
            layout: { fitViewport: true },
            otherSEO: { ogImage: 'game.ducenonduce' },
            component: () => import('./pages/duce-non-duce/duce-non-duce.component')
                .then(m => m.DuceNonDuceComponent),
        },

        {
            path: `radar`,
            title: `radar`,
            description: 'Il radar delle chiese intorno a te',
            pageType: PageType.GameRadar,
            otherSEO: { ogImage: 'game.radar' },
            layout: { fitViewport: true },
            component: () => import('./pages/radar/radar.component')
                .then(m => m.RadarComponent),
        },

        {
            path: `burocrazia`,
            title: `burocrazia`,
            description: 'Attraversa la città a colpi di passaggi in auto e chiudi la pratica prima che chiudano gli sportelli.',
            pageType: PageType.GameBurocrazia,
            layout: { fitViewport: true },
            otherSEO: { ogImage: 'game.burocrazia' },
            component: () => import('./pages/burocrazia/burocrazia.component')
                .then(m => m.BurocraziaComponent),
        },

        // ── Galleria pubblica delle generazioni salvate ──────────────
        // Path figlio dei generatori (`generatori/galleria`): ne raccoglie gli output, quindi
        // sta sotto di loro anche nell'URL, non accanto ai giochi. Resta comunque una pagina a sé
        // (stesso rango delle altre): il sotto-path è solo gerarchia logica, non un embed.
        {
            path: `generatori/galleria`,
            title: `galleria`,
            description: 'Le frasi più belle salvate dagli utenti: la galleria pubblica dei generatori.',
            pageType: PageType.Galleria,
            layout: { showPanel: false },
            component: () => import('./pages/galleria/galleria.component')
                .then(m => m.GalleriaComponent),
        },
    ],

    headerNav: (nav) => {
        nav.addGroup('generatori', (g) => {
            // I generatori veri e propri stanno in un sottogruppo annidato, così la Galleria
            // (che raccoglie i loro output) vive accanto a loro senza sembrare un generatore.
            g.addGroup('tuttiIGeneratori', (gg) => {
                gg.addPage(PageType.GeneratorIncel);
                gg.addPage(PageType.GeneratorAuto);
                gg.addPage(PageType.GeneratorAntiveg);
                gg.addPage(PageType.GeneratorLocali);
                gg.addPage(PageType.GeneratorMbeb);
            });
            g.addPage(PageType.Galleria);
        });
        nav.addGroup('giochi', (g) => {
            // Le storie (avventure a bivi) in un sottogruppo annidato; gli altri giochi restano fuori.
            g.addGroup('storie', (gg) => {
                gg.addPage(PageType.StoryPoveriMaschi);
                gg.addPage(PageType.StoryMagrogamer09);
                gg.addPage(PageType.StorySurviveUsa);
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
