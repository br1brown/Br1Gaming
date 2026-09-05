import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { LeafPageInput, SitePageInput, ContentLoader, ContentLoaderResult, PageInfo } from '../core/engine/siteBuilder';
import { ApiService } from '../core/services/api.service';
import { ApiError } from '../core/engine/services/base-api.service';
import { GeneratorInfo, GenerateResponse, GeneratorPageContent, PiaciutiPageContent, ShareEntry } from '../core/dto/generator.dto';
import type { StorySummary } from '../core/dto/story.dto';

/** Titolo della pagina dalla frase generata (frase condivisa, `/generatori/<slug>/:id`). Qui si
 *  normalizza solo il whitespace: il troncamento e l'eventuale ellissi sono delegati al livello a
 *  valle (setPageMeta / og-preview), che è l'unico punto dove si decide come tagliare. */
function titleFromGeneration(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/** ContentLoader del playground di un generatore (`/generatori/<slug>`): solo le info del
 *  generatore, la generazione la produce il client ("Ancora!"). La frase condivisa/recuperata
 *  vive nella rotta gemella `/generatori/<slug>/:id`, vedi `generatorSharedContentLoader`. */
function generatorContentLoader(loadGenerator: (api: ApiService) => Promise<GeneratorInfo>): ContentLoader {
    return (ctx) => {
        const api = inject(ApiService);
        return (async (): Promise<ContentLoaderResult> => {
            const gen = await loadGenerator(api).catch(() => null);
            if (!gen) return { content: null };
            const info: Partial<PageInfo> = { title: gen.name, description: gen.description };
            return { content: { generator: gen, result: null, recovered: false } satisfies GeneratorPageContent, info };
        })();
    };
}

/** ContentLoader della pagina "frase condivisa" di un generatore (`/generatori/<slug>/:id`):
 *  `ctx.slug` è l'id content-addressed della generazione salvata (vedi Shares/IShareStore nel
 *  backend). Id sconosciuto → 404 vero (redirect a /error/404 via contentLoaderResolver), non una
 *  pagina vuota. Sempre `noindex`: la singola frase è contenuto sottile/potenzialmente duplicato —
 *  la raccolta pubblica (/generatori/piaciuti) resta invece indicizzata, vedi PiaciutiComponent. */
function generatorSharedContentLoader(loadGenerator: (api: ApiService) => Promise<GeneratorInfo>): ContentLoader {
    return (ctx) => {
        const api = inject(ApiService);
        return (async (): Promise<ContentLoaderResult> => {
            if (!ctx.slug) return { content: null };
            const [gen, entry] = await Promise.all([
                loadGenerator(api).catch(() => null),
                api.getGeneration(ctx.slug).catch(() => null),
            ]);
            if (!gen || !entry) throw new ApiError(404, null);
            // sig vuota: una generazione recuperata è già nei condivisi, non si ri-condivide.
            const result: GenerateResponse = { text: entry.text, markdown: entry.markdown, score: entry.score, sig: '' };
            const info: Partial<PageInfo> = { title: titleFromGeneration(entry.text), description: gen.description, noindex: true };
            return { content: { generator: gen, result, recovered: true } satisfies GeneratorPageContent, info };
        })();
    };
}

/** ContentLoader condiviso dalle pagine storia: titolo/descrizione SEO dal contenuto caricato. */
function storyContentLoader(loadStory: (api: ApiService) => Promise<StorySummary | null>): ContentLoader {
    return (ctx) => {
        const api = inject(ApiService);
        return (async (): Promise<ContentLoaderResult> => {
            const story = await loadStory(api).catch(() => null);
            if (!story) return { content: null };
            return { content: story, info: { title: story.title, description: story.description } };
        })();
    };
}

/** ContentLoader della pagina Piaciuti (panoramica o filtrata via `?gen=<slug>`): sempre
 *  indicizzata (a differenza della singola frase condivisa sopra), quindi risolta in SSR come
 *  qualunque altra pagina — niente più caricamento client-only. `?gen=` non passa da
 *  `ContentLoaderContext` (solo lingua/slug di rotta): letto qui dal Router, stesso pattern già
 *  visto per `?g=` prima di questa rotta dedicata. Riusata anche per il ricaricato client al
 *  cambio filtro, vedi piaciuti.component.ts. */
function piaciutiContentLoader(): ContentLoader {
    return (ctx) => {
        const api = inject(ApiService);
        const router = inject(Router);
        return (async (): Promise<ContentLoaderResult> => {
            const tree = router.getCurrentNavigation()?.finalUrl ?? router.parseUrl(router.url);
            const filterSlug = tree.queryParamMap.get('gen');
            const [shares, generators, counts] = await Promise.all([
                api.getShares(200, filterSlug ?? undefined).catch((): ShareEntry[] => []),
                api.getGenerators().catch((): GeneratorInfo[] => []),
                // I conteggi servono solo alla panoramica (link "Vedi tutte"); in modalità filtrata si saltano.
                filterSlug ? Promise.resolve<Record<string, number>>({}) : api.getSharesCounts().catch((): Record<string, number> => ({})),
            ]);
            const content: PiaciutiPageContent = { shares, generators, counts, filterSlug };
            return { content };
        })();
    };
}

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
    // Frase condivisa di un generatore (/generatori/<slug>/:id — vedi generatorSharedContentLoader):
    // stessa identità dei generatori sopra ma pagina/route a sé, noindex, mai in nav.
    GeneratorIncelShared: 'app.generatore.incel.condiviso',
    GeneratorStartupShared: 'app.generatore.startup.condiviso',
    GeneratorAutoShared: 'app.generatore.auto.condiviso',
    GeneratorAntivegShared: 'app.generatore.antiveg.condiviso',
    GeneratorLocaliShared: 'app.generatore.locali.condiviso',
    GeneratorKebabShared: 'app.generatore.kebab.condiviso',
    GeneratorMbebShared: 'app.generatore.mbeb.condiviso',
    GeneratorOroscopoShared: 'app.generatore.oroscopo.condiviso',
    StoryPoveriMaschi: 'app.avventura.poveri-maschi',
    StoryMagrogamer09: 'app.avventura.magrogamer09',
    StorySurviveUsa: 'app.avventura.sopravvivi-agli-usa',
    GameDuceNonDuce: 'app.gioco.ducenonduce',
    GameBurocrazia: 'app.gioco.burocrazia',
    GameUmarell: 'app.gioco.umarell',
    Piaciuti: 'app.piaciuti',
    // Utility: strumenti che non sono giochi (il radar chiese, spostato qui, e il traduttore).
    UtilityRadar: 'app.utility.radar',
    UtilityTranslator: 'app.utility.translator',
} as const;

/** Identità delle pagine di quest'area (sottoinsieme di PageType). Usato dai catalogo/helper sotto. */
type AppPageId = (typeof AppPages)[keyof typeof AppPages];

// ═══════════════════════════════════════════════════════════════════════
// Wrapper tipizzati per il contentLoader dei generatori/storie, chiave = PageType
// (stesso schema del vecchio generatorLoader/switch del ContentResolver).
// ═══════════════════════════════════════════════════════════════════════
const generatorLoaders: Partial<Record<AppPageId, (api: ApiService) => Promise<GeneratorInfo>>> = {
    [AppPages.GeneratorIncel]: api => api.getIncel(),
    [AppPages.GeneratorStartup]: api => api.getStartup(),
    [AppPages.GeneratorAuto]: api => api.getAuto(),
    [AppPages.GeneratorAntiveg]: api => api.getAntiveg(),
    [AppPages.GeneratorLocali]: api => api.getLocali(),
    [AppPages.GeneratorKebab]: api => api.getKebab(),
    [AppPages.GeneratorMbeb]: api => api.getMbeb(),
    [AppPages.GeneratorOroscopo]: api => api.getOroscopo(),
};

const storyLoaders: Partial<Record<AppPageId, (api: ApiService) => Promise<StorySummary | null>>> = {
    [AppPages.StoryPoveriMaschi]: api => api.getStoryPoveriMaschi(),
    [AppPages.StoryMagrogamer09]: api => api.getStoryMagrogamer09(),
    [AppPages.StorySurviveUsa]: api => api.getStorySurviveUsa(),
};

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
    const loadGenerator = generatorLoaders[pageType];
    return {
        // Path relativo: il prefisso `generatori/` lo fornisce il parent.
        path: urlSegment,
        title: `generatore-${urlSegment}`,
        pageType,
        layout: { showPanel: false },
        otherSEO: { ogImage },
        component: () => import('./generator-detail/generator-detail.component')
            .then(m => m.GeneratorDetailComponent),
        contentLoader: loadGenerator ? generatorContentLoader(loadGenerator) : undefined,
    };
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER — crea la pagina "frase condivisa" gemella di un generatore (stesso componente, contenuto
// via :id invece che generato al volo). Stesso urlSegment/loadGenerator di generatorPage: le due
// vivono fianco a fianco in appPagesDecl (path statico + path parametrico, non annidate).
// ═══════════════════════════════════════════════════════════════════════
function generatorSharedPage(
    urlSegment: string,
    sharedPageType: AppPageId,
    basePageType: AppPageId,
    ogImage: string = `generator.${urlSegment}`,
): LeafPageInput {
    const loadGenerator = generatorLoaders[basePageType];
    return {
        // ":slug" (non ":id"): il resolver dell'engine legge sempre route.paramMap.get('slug'),
        // qualunque cosa rappresenti semanticamente (qui l'id content-addressed della condivisione).
        path: `${urlSegment}/:slug`,
        title: `generatore-${urlSegment}`,
        pageType: sharedPageType,
        layout: { showPanel: false },
        otherSEO: { ogImage },
        component: () => import('./generator-detail/generator-detail.component')
            .then(m => m.GeneratorDetailComponent),
        contentLoader: loadGenerator ? generatorSharedContentLoader(loadGenerator) : undefined,
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
    const loadStory = storyLoaders[pageType];
    return {
        // Path relativo: il prefisso `avventura/` lo fornisce il parent.
        path: urlSegment,
        title: `avventura-${urlSegment}`,
        pageType,
        // Lo smoke è voluto SOLO sulla home: qui le storie hanno pannello e col default storico
        // lo mostrerebbero, quindi lo spegniamo esplicitamente.
        layout: { showSmoke: false },
        otherSEO: { ogImage },
        component: () => import('./story-player/story-player.component')
            .then(m => m.StoryPlayerComponent),
        contentLoader: loadStory ? storyContentLoader(loadStory) : undefined,
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
    // 4° elemento = PageType della pagina gemella "frase condivisa" (/generatori/<slug>/:id).
    ['incel', AppPages.GeneratorIncel, 'generator.incel.og', AppPages.GeneratorIncelShared],
    ['startup', AppPages.GeneratorStartup, 'generator.startup.og', AppPages.GeneratorStartupShared],
    ['mbeb', AppPages.GeneratorMbeb, 'generator.mbeb.og', AppPages.GeneratorMbebShared],
    ['oroscopo', AppPages.GeneratorOroscopo, 'generator.oroscopo.og', AppPages.GeneratorOroscopoShared],
    ['locali', AppPages.GeneratorLocali, 'generator.locali.og', AppPages.GeneratorLocaliShared],
    ['kebab', AppPages.GeneratorKebab, 'generator.kebab.og', AppPages.GeneratorKebabShared],
    ['auto', AppPages.GeneratorAuto, 'generator.auto.og', AppPages.GeneratorAutoShared],
    ['antiveg', AppPages.GeneratorAntiveg, 'generator.antiveg.og', AppPages.GeneratorAntivegShared],
] as const;

/** Slug del generatore → PageType della sua pagina playground (non quella "condivisa"). Usata dai
 *  componenti che devono tornare/linkare al generatore partendo solo dallo slug (Piaciuti,
 *  GeneratorDetailComponent.goToGenerator): un solo posto, non una mappa duplicata per componente. */
export const GENERATOR_SLUG_TO_PAGE_TYPE: Partial<Record<string, AppPageId>> = Object.fromEntries(
    GENERATORS.map(([slug, pageType]) => [slug, pageType])
);

export const STORIES = [
    // 3° elemento = id OG dedicato opaco (card trasparente → OG resta opaca).
    ['poveri-maschi', AppPages.StoryPoveriMaschi, 'story.poveri-maschi.og'],
    ['magrogamer09', AppPages.StoryMagrogamer09, 'story.magrogamer09.og'],
    ['sopravvivi-agli-usa', AppPages.StorySurviveUsa, 'story.sopravvivi-agli-usa.og'],
] as const;

/** Slug della storia → PageType della sua pagina: un solo posto, non una mappa duplicata per
 *  componente (dilemma-section, in origine). Dallo stesso elenco che alimenta le route. */
export const STORY_SLUG_TO_PAGE_TYPE: Partial<Record<string, AppPageId>> = Object.fromEntries(
    STORIES.map(([slug, pageType]) => [slug, pageType])
);

/** Dichiarazioni pagina di quest'area, assemblate in site.ts → pages(). */
export const appPagesDecl: SitePageInput[] = [
    {
        path: '',
        title: 'homeNav',
        pageType: AppPages.Home,
        // La home espone già Generatori/Storie/Giochi come sezioni: la navbar sarebbe ridondante.
        // showSmoke:true — lo smoke decorativo è voluto SOLO qui; la home non ha pannello, quindi
        // senza questo flag (default storico = pannello && !full-bleed) non lo mostrerebbe.
        layout: { showPanel: false, showNav: false, showSmoke: true },
        description: 'Generatori casuali, avventure interattive e tanto altro da Br1.',
        component: () => import('./home/home.component').then(m => m.HomeComponent),
    },

    // ── Generatori (+ Piaciuti) sotto /generatori ────────────────
    // Parent senza component: fa solo da prefisso di path (gli URL figli
    // restano /generatori/<slug>, /generatori/<slug>/:id e /generatori/piaciuti).
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
            // Frasi condivise (/generatori/<slug>/:id): pagine gemelle, path statico + parametrico
            // fianco a fianco, non annidate (stesso schema di social-feed/social-feed/:slug del motore).
            ...GENERATORS.map(([slug, pageType, ogImage, sharedPageType]) =>
                generatorSharedPage(slug, sharedPageType, pageType, ogImage)),
            {
                path: 'piaciuti',
                title: 'condivisi',
                description: 'Le frasi più belle piaciute agli utenti: la raccolta pubblica dei generatori.',
                pageType: AppPages.Piaciuti,
                layout: { showPanel: false },
                component: () => import('./piaciuti/piaciuti.component')
                    .then(m => m.PiaciutiComponent),
                contentLoader: piaciutiContentLoader(),
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

    {
        path: `umarell`,
        title: `umarell`,
        description: 'Contempla il cantiere con le mani dietro la schiena e intervieni al momento giusto.',
        pageType: AppPages.GameUmarell,
        layout: { fitViewport: true },
        otherSEO: { ogImage: 'game.umarell.og' },
        component: () => import('./umarell/umarell.component')
            .then(m => m.UmarellComponent),
    },

    // ── Utility sotto /utility ───────────────────────────────────
    // Parent senza component: fa solo da prefisso di path (URL figli /utility/radar,
    // /utility/translator). Il radar chiese vive qui, non più tra i giochi.
    {
        path: 'utility',
        title: 'utility',
        children: [
            {
                path: 'radar',
                title: 'radar',
                description: 'Il radar delle chiese intorno a te',
                pageType: AppPages.UtilityRadar,
                // OG opaca dedicata (la card può diventare trasparente senza rovinare l'anteprima social).
                otherSEO: { ogImage: 'game.radar.og' },
                layout: { fitViewport: true },
                component: () => import('./radar/radar.component')
                    .then(m => m.RadarComponent),
            },
            {
                path: 'translator',
                title: 'translator',
                description: 'Traduttore italiano spagnolo, ma giuro che traduce le cose vere, giuste e perfette',
                pageType: AppPages.UtilityTranslator,
                layout: { showPanel: false },
                component: () => import('./translator/translator.component')
                    .then(m => m.TranslatorComponent),
            },
        ],
    },
];
