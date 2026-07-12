import type { LeafPageInput, SitePageInput } from '../core/engine/siteBuilder';

// ═══════════════════════════════════════════════════════════════════════
// Area "app": tutte le pagine di prodotto (home, generatori, avventure, giochi).
// Un file per area, assemblato in site.ts con uno spread. Gli ID (prefisso "app.")
// sono l'identità stabile di ogni pagina — leggibili in query string/log.
// ═══════════════════════════════════════════════════════════════════════
export const AppPages = {
    Home: 'app.home',
    Generatori: 'app.generatori',
    GeneratorIncel: 'app.generatore.incel',
    GeneratorStartup: 'app.generatore.startup',
    GeneratorAuto: 'app.generatore.auto',
    GeneratorAntiveg: 'app.generatore.antiveg',
    GeneratorLocali: 'app.generatore.locali',
    GeneratorKebab: 'app.generatore.kebab',
    GeneratorMbeb: 'app.generatore.mbeb',
    GeneratorOroscopo: 'app.generatore.oroscopo',
    StoryPoveriMaschi: 'app.avventura.poveri-maschi',
    StoryMagrogamer09: 'app.avventura.magrogamer09',
    StorySurviveUsa: 'app.avventura.sopravvivi-agli-usa',
    GameDuceNonDuce: 'app.gioco.ducenonduce',
    GameRadar: 'app.gioco.radar',
    GameBurocrazia: 'app.gioco.burocrazia',
    Piaciuti: 'app.piaciuti',
} as const;

/** Identità delle pagine di quest'area (sottoinsieme di PageType). Usato dai catalogo/helper sotto. */
type AppPageId = (typeof AppPages)[keyof typeof AppPages];

// ═══════════════════════════════════════════════════════════════════════
// HELPER — crea una pagina generatore con path esplicito
// ═══════════════════════════════════════════════════════════════════════
function generatorPage(
    urlSegment: string,
    pageType: AppPageId,
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
        component: () => import('./generator-detail/generator-detail.component')
            .then(m => m.GeneratorDetailComponent),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER — crea una pagina avventura con path esplicito
// ═══════════════════════════════════════════════════════════════════════
function storyPage(
    urlSegment: string,
    pageType: AppPageId,
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
        component: () => import('./story-player/story-player.component')
            .then(m => m.StoryPlayerComponent),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// CATALOGHI — unico punto da estendere per aggiungere un generatore/una storia
// (slug + PageType): alimentano sia le route (sotto i parent) sia la navbar (site.ts).
// ═══════════════════════════════════════════════════════════════════════
// Ordine di navbar/route. La home segue invece l'ordine del backend (Info.Order); qui lo si rispecchia
// per coerenza, raggruppati per tema: personaggi (incel, startupparo, mbeb, oroscopo),
// nomi di attività (nomi bar, kebabbari), invettive (automobilistiche, anti-vegani).
export const GENERATORS = [
    // 3° elemento = id OG dedicato (immagine OPACA, "forma OG"): serve quando la card è trasparente,
    // così l'anteprima social resta opaca e non esce lavata/nera. incel/mbeb/startup: ritaglio su fondo
    // brand; auto: la foto originale opaca (la card userà poi il ritaglio trasparente).
    ['incel', AppPages.GeneratorIncel, 'generator.incel.og'],
    ['startup', AppPages.GeneratorStartup, 'generator.startup.og'],
    ['mbeb', AppPages.GeneratorMbeb, 'generator.mbeb.og'],
    ['oroscopo', AppPages.GeneratorOroscopo, 'generator.oroscopo.og'],
    ['locali', AppPages.GeneratorLocali, 'generator.locali.og'],
    ['kebab', AppPages.GeneratorKebab, 'generator.kebab.og'],
    ['auto', AppPages.GeneratorAuto, 'generator.auto.og'],
    ['antiveg', AppPages.GeneratorAntiveg, 'generator.antiveg.og'],
] as const;

export const STORIES = [
    // 3° elemento = id OG dedicato opaco (card trasparente → OG resta opaca).
    ['poveri-maschi', AppPages.StoryPoveriMaschi, 'story.poveri-maschi.og'],
    ['magrogamer09', AppPages.StoryMagrogamer09, 'story.magrogamer09.og'],
    ['sopravvivi-agli-usa', AppPages.StorySurviveUsa, 'story.sopravvivi-agli-usa.og'],
] as const;

/** Dichiarazioni pagina di quest'area, assemblate in site.ts → pages(). */
export const appPagesDecl: SitePageInput[] = [
    {
        path: '',
        title: 'homeNav',
        pageType: AppPages.Home,
        // La home espone già Generatori/Storie/Giochi come sezioni: la navbar sarebbe ridondante.
        layout: { showPanel: false, showNav: false },
        description: 'Generatori casuali, avventure interattive e tanto altro da Br1.',
        component: () => import('./home/home.component').then(m => m.HomeComponent),
    },

    // ── Generatori (+ Piaciuti) sotto /generatori ────────────────
    // Parent senza component: fa solo da prefisso di path (gli URL figli
    // restano /generatori/<slug> e /generatori/piaciuti).
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
                pageType: AppPages.Generatori,
                layout: { showPanel: false },
                component: () => import('./generatori/generatori.component')
                    .then(m => m.GeneratoriComponent),
            },
            ...GENERATORS.map(([slug, pageType, ogImage]) => generatorPage(slug, pageType, ogImage)),
            {
                path: 'piaciuti',
                title: 'condivisi',
                description: 'Le frasi più belle piaciute agli utenti: la raccolta pubblica dei generatori.',
                pageType: AppPages.Piaciuti,
                layout: { showPanel: false },
                component: () => import('./piaciuti/piaciuti.component')
                    .then(m => m.PiaciutiComponent),
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
        pageType: AppPages.GameDuceNonDuce,
        layout: { fitViewport: true },
        // Eccezione: qui la card NON diventa trasparente (è normale sia con Valerio Lundini),
        // quindi niente OG separata — l'immagine della card fa già da anteprima social.
        otherSEO: { ogImage: 'game.ducenonduce' },
        component: () => import('./duce-non-duce/duce-non-duce.component')
            .then(m => m.DuceNonDuceComponent),
    },

    {
        path: `radar`,
        title: `radar`,
        description: 'Il radar delle chiese intorno a te',
        pageType: AppPages.GameRadar,
        // OG opaca dedicata (la card può diventare trasparente senza rovinare l'anteprima social).
        otherSEO: { ogImage: 'game.radar.og' },
        layout: { fitViewport: true },
        component: () => import('./radar/radar.component')
            .then(m => m.RadarComponent),
    },

    {
        path: `burocrazia`,
        title: `burocrazia`,
        description: 'Attraversa la città a colpi di passaggi in auto e chiudi la pratica prima che chiudano gli sportelli.',
        pageType: AppPages.GameBurocrazia,
        layout: { fitViewport: true },
        // OG opaca dedicata (la card può diventare trasparente senza rovinare l'anteprima social).
        otherSEO: { ogImage: 'game.burocrazia.og' },
        component: () => import('./burocrazia/burocrazia.component')
            .then(m => m.BurocraziaComponent),
    },
];
