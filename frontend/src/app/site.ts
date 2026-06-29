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
    GeneratorKebab,
    GeneratorMbeb,
    StoryPoveriMaschi,
    StoryMagrogamer09,
    StorySurviveUsa,
    GameDuceNonDuce,
    GameRadar,
    GameBurocrazia,
    Condivisi,
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER — crea una pagina generatore con path esplicito
// ═══════════════════════════════════════════════════════════════════════
function generatorPage(
    urlSegment: string,
    pageType: PageType,
): LeafPageInput {
    return {
        // Path relativo: il prefisso `generatori/` lo fornisce il parent.
        path: urlSegment,
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
        // Path relativo: il prefisso `avventura/` lo fornisce il parent.
        path: urlSegment,
        title: `avventura-${urlSegment}`,
        pageType,
        otherSEO: { ogImage: `story.${urlSegment}` },
        component: () => import('./pages/story-player/story-player.component')
            .then(m => m.StoryPlayerComponent),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// CATALOGHI — unico punto da estendere per aggiungere un generatore/una storia
// (slug + PageType): alimentano sia le route (sotto i parent) sia la navbar.
// ═══════════════════════════════════════════════════════════════════════
// Ordine di navbar/route. La home segue invece l'ordine del backend (Info.Order); qui lo si rispecchia
// per coerenza: incel, mbeb, nomi bar, kebabbari, anti-vegani, invettive automobilistiche.
const GENERATORS = [
    ['incel', PageType.GeneratorIncel],
    ['mbeb', PageType.GeneratorMbeb],
    ['locali', PageType.GeneratorLocali],
    ['kebab', PageType.GeneratorKebab],
    ['antiveg', PageType.GeneratorAntiveg],
    ['auto', PageType.GeneratorAuto],
] as const;

const STORIES = [
    ['poveri-maschi', PageType.StoryPoveriMaschi],
    ['magrogamer09', PageType.StoryMagrogamer09],
    ['sopravvivi-agli-usa', PageType.StorySurviveUsa],
] as const;


export const ContestoSito = buildSite({

    isWebApp: false,

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

        // ── Generatori (+ Condivisi) sotto /generatori ───────────────
        // Parent senza component: fa solo da prefisso di path (gli URL figli
        // restano /generatori/<slug> e /generatori/condivisi).
        {
            path: 'generatori',
            title: 'generatori',
            children: [
                ...GENERATORS.map(([slug, pageType]) => generatorPage(slug, pageType)),
                {
                    path: 'condivisi',
                    title: 'condivisi',
                    description: 'Le frasi più belle condivise dagli utenti: la raccolta pubblica dei generatori.',
                    pageType: PageType.Condivisi,
                    layout: { showPanel: false },
                    component: () => import('./pages/condivisi/condivisi.component')
                        .then(m => m.CondivisiComponent),
                },
            ],
        },

        // ── Avventure sotto /avventura ───────────────────────────────
        {
            path: 'avventura',
            title: 'avventura',
            children: STORIES.map(([slug, pageType]) => storyPage(slug, pageType)),
        },

        // ── Altri giochi (top-level) ─────────────────────────────────
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
    ],

    headerNav: (nav) => {
        nav.addGroup('generatori', (g) => {
            // I generatori veri e propri stanno in un sottogruppo annidato, così i Condivisi
            // (che raccolgono i loro output) vivono accanto a loro senza sembrare un generatore.
            g.addGroup('tuttiIGeneratori', (gg) => {
                GENERATORS.forEach(([, pageType]) => gg.addPage(pageType));
            });
            g.addPage(PageType.Condivisi);
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
