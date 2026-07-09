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
    Generatori,
    GeneratorIncel,
    GeneratorStartup,
    GeneratorAuto,
    GeneratorAntiveg,
    GeneratorLocali,
    GeneratorKebab,
    GeneratorMbeb,
    GeneratorOroscopo,
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
    // OG dedicata: di default coincide con l'immagine web (`generator.<slug>`), ma un generatore può
    // puntare a una versione già croppata 1200x630 per l'anteprima social (es. `generator.<slug>.og`).
    ogImage: string = `generator.${urlSegment}`,
): LeafPageInput {
    return {
        // Path relativo: il prefisso `generatori/` lo fornisce il parent.
        path: urlSegment,
        title: `generatore-${urlSegment}`,
        pageType,
        layout: { showPanel: false },
        otherSEO: { ogImage },
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
    // OG dedicata opaca: default = immagine web (`story.<slug>`); una storia con card trasparente
    // punta a una sorgente OG opaca (`story.<slug>.og`) per non rovinare l'anteprima social.
    ogImage: string = `story.${urlSegment}`,
): LeafPageInput {
    return {
        // Path relativo: il prefisso `avventura/` lo fornisce il parent.
        path: urlSegment,
        title: `avventura-${urlSegment}`,
        pageType,
        otherSEO: { ogImage },
        component: () => import('./pages/story-player/story-player.component')
            .then(m => m.StoryPlayerComponent),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// CATALOGHI — unico punto da estendere per aggiungere un generatore/una storia
// (slug + PageType): alimentano sia le route (sotto i parent) sia la navbar.
// ═══════════════════════════════════════════════════════════════════════
// Ordine di navbar/route. La home segue invece l'ordine del backend (Info.Order); qui lo si rispecchia
// per coerenza, raggruppati per tema: personaggi (incel, startupparo, mbeb, oroscopo),
// nomi di attività (nomi bar, kebabbari), invettive (automobilistiche, anti-vegani).
const GENERATORS = [
    // 3° elemento = id OG dedicato (immagine OPACA, "forma OG"): serve quando la card è trasparente,
    // così l'anteprima social resta opaca e non esce lavata/nera. incel/mbeb/startup: ritaglio su fondo
    // brand; auto: la foto originale opaca (la card userà poi il ritaglio trasparente).
    ['incel', PageType.GeneratorIncel, 'generator.incel.og'],
    ['startup', PageType.GeneratorStartup, 'generator.startup.og'],
    ['mbeb', PageType.GeneratorMbeb, 'generator.mbeb.og'],
    ['oroscopo', PageType.GeneratorOroscopo, 'generator.oroscopo.og'],
    ['locali', PageType.GeneratorLocali, 'generator.locali.og'],
    ['kebab', PageType.GeneratorKebab, 'generator.kebab.og'],
    ['auto', PageType.GeneratorAuto, 'generator.auto.og'],
    ['antiveg', PageType.GeneratorAntiveg, 'generator.antiveg.og'],
] as const;

const STORIES = [
    // 3° elemento = id OG dedicato opaco (card trasparente → OG resta opaca).
    ['poveri-maschi', PageType.StoryPoveriMaschi, 'story.poveri-maschi.og'],
    ['magrogamer09', PageType.StoryMagrogamer09, 'story.magrogamer09.og'],
    ['sopravvivi-agli-usa', PageType.StorySurviveUsa, 'story.sopravvivi-agli-usa.og'],
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
                // Index del gruppo: `/generatori` rende l'elenco di tutti i generatori (la stessa lista
                // della home, come pagina a sé). Path vuoto → l'URL resta `/generatori`.
                {
                    path: '',
                    title: 'generatori',
                    description: 'Tutti i generatori di testo demenziali di Br1: incel, startup, kebabbari e altri.',
                    pageType: PageType.Generatori,
                    layout: { showPanel: false },
                    component: () => import('./pages/generatori/generatori.component')
                        .then(m => m.GeneratoriComponent),
                },
                ...GENERATORS.map(([slug, pageType, ogImage]) => generatorPage(slug, pageType, ogImage)),
                {
                    path: 'condivisi',
                    title: 'condivisi',
                    description: 'Le frasi più belle piaciute agli utenti: la raccolta pubblica dei generatori.',
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
            children: STORIES.map(([slug, pageType, ogImage]) => storyPage(slug, pageType, ogImage)),
        },

        // ── Altri giochi (top-level) ─────────────────────────────────
        {
            path: `ducenonduce`,
            title: `ducenonduce`,
            description: 'Indovina se la persona è un duce o non duce',
            pageType: PageType.GameDuceNonDuce,
            layout: { fitViewport: true },
            // Eccezione: qui la card NON diventa trasparente (è normale sia con Valerio Lundini),
            // quindi niente OG separata — l'immagine della card fa già da anteprima social.
            otherSEO: { ogImage: 'game.ducenonduce' },
            component: () => import('./pages/duce-non-duce/duce-non-duce.component')
                .then(m => m.DuceNonDuceComponent),
        },

        {
            path: `radar`,
            title: `radar`,
            description: 'Il radar delle chiese intorno a te',
            pageType: PageType.GameRadar,
            // OG opaca dedicata (la card può diventare trasparente senza rovinare l'anteprima social).
            otherSEO: { ogImage: 'game.radar.og' },
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
            // OG opaca dedicata (la card può diventare trasparente senza rovinare l'anteprima social).
            otherSEO: { ogImage: 'game.burocrazia.og' },
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
