import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { LeafPageInput, SitePageInput, ContentLoader, ContentLoaderResult, PageInfo } from '../core/engine/siteBuilder';
import { ApiService } from '../core/services/api.service';
import { GeneratorInfo, GenerateResponse, GeneratorPageContent } from '../core/dto/generator.dto';
import type { StorySummary } from '../core/dto/story.dto';

/** Titolo della pagina dalla frase generata, recuperata con `?g=`. Qui si normalizza solo il
 *  whitespace: il troncamento e l'eventuale ellissi sono delegati al livello a valle
 *  (setPageMeta / og-preview), che è l'unico punto dove si decide come tagliare. */
function titleFromGeneration(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/** ContentLoader condiviso da tutte le pagine generatore: carica le info del generatore e,
 *  se l'URL porta `?g=`, la generazione condivisa da recuperare — round-trip in parallelo, non in
 *  fila. La frase recuperata diventa anche il titolo SEO. `inject()` va preso PRIMA di ogni await:
 *  qui, sincrono, nel corpo esterno — non dentro l'IIFE async sotto. */
function generatorContentLoader(loadGenerator: (api: ApiService) => Promise<GeneratorInfo>): ContentLoader {
    return (ctx) => {
        const api = inject(ApiService);
        const router = inject(Router);
        return (async (): Promise<ContentLoaderResult> => {
            const tree = router.getCurrentNavigation()?.finalUrl ?? router.parseUrl(router.url);
            const g = tree.queryParamMap.get('g');
            const [gen, entry] = await Promise.all([
                loadGenerator(api).catch(() => null),
                g ? api.getGeneration(g).catch(() => null) : Promise.resolve(null),
            ]);
            if (!gen) return { content: null };
            let result: GenerateResponse | null = null;
            let recovered = false;
            let info: Partial<PageInfo> = { title: gen.name, description: gen.description };
            if (entry?.text) {
                // sig vuota: una generazione recuperata è già nei condivisi, non si ri-condivide.
                result = { text: entry.text, markdown: entry.markdown, score: entry.score, sig: '' };
                recovered = true;
                info = { ...info, title: titleFromGeneration(entry.text) };
            }
            return { content: { generator: gen, result, recovered } satisfies GeneratorPageContent, info };
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
        // showSmoke:true — lo smoke decorativo è voluto SOLO qui; la home non ha pannello, quindi
        // senza questo flag (default storico = pannello && !full-bleed) non lo mostrerebbe.
        layout: { showPanel: false, showNav: false, showSmoke: true },
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
