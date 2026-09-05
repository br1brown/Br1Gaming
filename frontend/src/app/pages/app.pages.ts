import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { SitePageInput, ContentLoader, ContentLoaderResult, PageInfo } from '../core/engine/siteBuilder';
import { ApiService } from '../core/services/api.service';
import { ApiError } from '../core/engine/services/base-api.service';
import { GeneratorInfo, GenerateResponse, GeneratorPageContent, PiaciutiPageContent, ShareEntry } from '../core/dto/generator.dto';

/** Titolo della pagina dalla frase generata (frase condivisa, `/generatori/<slug>/:id`). Qui si
 *  normalizza solo il whitespace: il troncamento e l'eventuale ellissi sono delegati al livello a
 *  valle (setPageMeta / og-preview), che è l'unico punto dove si decide come tagliare. */
function titleFromGeneration(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/** ContentLoader del playground di un generatore (`/generatori/:slug`): un solo componente/rotta
 *  per tutti i generatori — `ctx.params['slug']` arriva dal catalogo (`dynamicParams` sotto), slug
 *  sconosciuto → 404 vero. La generazione la produce il client ("Ancora!"); la frase condivisa/
 *  recuperata vive nella rotta gemella `/generatori/:slug/:id`, vedi `generatorSharedContentLoader`. */
function generatorContentLoader(): ContentLoader {
    return (ctx) => {
        const api = inject(ApiService);
        return (async (): Promise<ContentLoaderResult> => {
            const slug = ctx.params['slug'];
            if (!slug) return { content: null };
            const gen = await api.getGenerator(slug).catch(() => null);
            if (!gen) throw new ApiError(404, null);
            const info: Partial<PageInfo> = { title: gen.name, description: gen.description, ogImage: `generator.${slug}.og` };
            return { content: { generator: gen, result: null, recovered: false } satisfies GeneratorPageContent, info };
        })();
    };
}

/** ContentLoader della pagina "frase condivisa" di un generatore (`/generatori/:slug/:id`): `:id` è
 *  l'id content-addressed della generazione salvata (vedi Shares/IShareStore nel backend). Slug o id
 *  sconosciuto → 404 vero (redirect a /error/404 via contentLoaderResolver), non una pagina vuota.
 *  Deliberatamente FUORI da dynamicParams: non va nella sitemap, coerente col noindex sotto — la
 *  singola frase è contenuto sottile/potenzialmente duplicato, la raccolta pubblica
 *  (/generatori/piaciuti) resta invece indicizzata, vedi PiaciutiComponent. */
function generatorSharedContentLoader(): ContentLoader {
    return (ctx) => {
        const api = inject(ApiService);
        return (async (): Promise<ContentLoaderResult> => {
            const slug = ctx.params['slug'];
            const id = ctx.params['id'];
            if (!slug || !id) return { content: null };
            const [gen, entry] = await Promise.all([
                api.getGenerator(slug).catch(() => null),
                api.getGeneration(id).catch(() => null),
            ]);
            if (!gen || !entry) throw new ApiError(404, null);
            // sig vuota: una generazione recuperata è già nei condivisi, non si ri-condivide.
            const result: GenerateResponse = { text: entry.text, markdown: entry.markdown, score: entry.score, sig: '' };
            const info: Partial<PageInfo> = {
                title: titleFromGeneration(entry.text), description: gen.description,
                ogImage: `generator.${slug}.og`, noindex: true,
            };
            return { content: { generator: gen, result, recovered: true } satisfies GeneratorPageContent, info };
        })();
    };
}

/** ContentLoader dell'unica pagina storia (`/avventura/:slug`): titolo/descrizione SEO dal
 *  contenuto caricato, slug sconosciuto → 404 vero. */
function storyContentLoader(): ContentLoader {
    return (ctx) => {
        const api = inject(ApiService);
        return (async (): Promise<ContentLoaderResult> => {
            const slug = ctx.params['slug'];
            if (!slug) return { content: null };
            const story = await api.getStory(slug).catch(() => null);
            if (!story) throw new ApiError(404, null);
            const info: Partial<PageInfo> = { title: story.title, description: story.description, ogImage: `story.${slug}.og` };
            return { content: story, info };
        })();
    };
}

/** ContentLoader della pagina Piaciuti (panoramica o filtrata via `?gen=<slug>`): sempre
 *  indicizzata (a differenza della singola frase condivisa sopra), quindi risolta in SSR come
 *  qualunque altra pagina — niente più caricamento client-only. `?gen=` non passa da
 *  `ContentLoaderContext.params` (solo i `:segmenti` della rotta, questa non ne ha): letto qui dal
 *  Router. Riusata anche per il ricaricato client al cambio filtro, vedi piaciuti.component.ts. */
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
    // Un solo PageType per TUTTI i generatori (playground, /generatori/:slug): il catalogo arriva
    // dal backend via dynamicParams, un generatore nuovo compare da solo, senza toccare qui.
    Generatore: 'app.generatore',
    // Frase condivisa (/generatori/:slug/:id — vedi generatorSharedContentLoader): stessa identità
    // per tutti i generatori, pagina/route a sé (noindex, mai in dynamicParams/nav).
    GeneratoreCondiviso: 'app.generatore.condiviso',
    // Un solo PageType per tutte le storie (/avventura/:slug), stesso motivo.
    Storia: 'app.avventura.storia',
    GameDuceNonDuce: 'app.gioco.ducenonduce',
    GameBurocrazia: 'app.gioco.burocrazia',
    GameUmarell: 'app.gioco.umarell',
    Piaciuti: 'app.piaciuti',
    // Utility: strumenti che non sono giochi (il radar chiese, spostato qui, e il traduttore).
    UtilityRadar: 'app.utility.radar',
    UtilityTranslator: 'app.utility.translator',
} as const;

// Ordine di comparsa in nav/home. La home segue invece l'ordine del backend (Info.Order); qui lo si
// rispecchia per coerenza, raggruppati per tema: personaggi (incel, startupparo, mbeb, oroscopo),
// nomi di attività (nomi bar, kebabbari), invettive (automobilistiche, anti-vegani). Sola lista di
// slug: il catalogo VERO (nome/descrizione) arriva dal backend, questo serve solo a chi (nav.ts)
// deve elencare le voci senza già avere il catalogo sottomano.
export const GENERATOR_SLUGS = ['incel', 'startup', 'mbeb', 'oroscopo', 'locali', 'kebab', 'auto', 'antiveg'] as const;
export const STORY_SLUGS = ['poveri-maschi', 'magrogamer09', 'sopravvivi-agli-usa'] as const;

/** Dichiarazioni pagina di quest'area, assemblate in site.ts → pages(). */
export const appPagesDecl: SitePageInput[] = [
    {
        path: '',
        title: 'homeNav',
        pageType: AppPages.Home,
        // La home espone già Generatori/Storie/Giochi come sezioni: la navbar sarebbe ridondante.
        // showSmoke:true — lo smoke decorativo è voluto SOLO qui; senza pannello (default del sito,
        // vedi site.ts shell.showPanel) smoke di suo non si mostrerebbe (default: pannello && !full-bleed).
        layout: { showNav: false, showSmoke: true },
        description: 'Generatori casuali, avventure interattive e tanto altro da Br1.',
        component: () => import('./home/home.component').then(m => m.HomeComponent),
    },

    // ── Generatori (+ Piaciuti) sotto /generatori ────────────────
    // Parent senza component: fa solo da prefisso di path (gli URL figli restano /generatori/:slug,
    // /generatori/:slug/:id e /generatori/piaciuti).
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
                component: () => import('./generatori/generatori.component')
                    .then(m => m.GeneratoriComponent),
            },
            // "piaciuti" PRIMA di ":slug": Angular Router prova le rotte nell'ordine dell'array, e
            // ":slug" (un segmento, combacia con qualunque stringa) intercetterebbe "piaciuti" se
            // venisse prima — un letterale deve sempre precedere un parametrico che lo eclisserebbe.
            {
                path: 'piaciuti',
                title: 'condivisi',
                description: 'Le frasi più belle piaciute agli utenti: la raccolta pubblica dei generatori.',
                pageType: AppPages.Piaciuti,
                component: () => import('./piaciuti/piaciuti.component')
                    .then(m => m.PiaciutiComponent),
                contentLoader: piaciutiContentLoader(),
            },
            {
                path: ':slug',
                title: 'generatore',
                pageType: AppPages.Generatore,
                component: () => import('./generator-detail/generator-detail.component')
                    .then(m => m.GeneratorDetailComponent),
                // Catalogo dal backend: un generatore nuovo compare in sitemap/route da solo.
                dynamicParams: async (ctx) => {
                    const all = await ctx.fetchBackendJson<{ slug: string }[]>('/generators');
                    return all.map(g => ({ slug: g.slug }));
                },
                contentLoader: generatorContentLoader(),
            },
            {
                // Path gemello (non annidato) del playground sopra — stesso schema di
                // social-feed/social-feed/:slug del motore demo. Niente dynamicParams: fuori sitemap,
                // coerente col noindex del contentLoader (vedi generatorSharedContentLoader).
                path: ':slug/:id',
                title: 'generatore',
                pageType: AppPages.GeneratoreCondiviso,
                component: () => import('./generator-detail/generator-detail.component')
                    .then(m => m.GeneratorDetailComponent),
                contentLoader: generatorSharedContentLoader(),
            },
        ],
    },

    // ── Avventure sotto /avventura ───────────────────────────────
    {
        path: 'avventura',
        title: 'avventura',
        children: [
            {
                path: ':slug',
                title: 'avventura',
                pageType: AppPages.Storia,
                // Unica pagina che riaccende il pannello (spento globalmente, vedi site.ts
                // shell.showPanel). Lo smoke è voluto SOLO sulla home: qui, col pannello riacceso,
                // il default lo mostrerebbe, quindi lo spegniamo esplicitamente.
                layout: { showPanel: true, showSmoke: false },
                component: () => import('./story-player/story-player.component')
                    .then(m => m.StoryPlayerComponent),
                dynamicParams: async (ctx) => {
                    const all = await ctx.fetchBackendJson<{ slug: string }[]>('/stories');
                    return all.map(s => ({ slug: s.slug }));
                },
                contentLoader: storyContentLoader(),
            },
        ],
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
                component: () => import('./translator/translator.component')
                    .then(m => m.TranslatorComponent),
            },
        ],
    },
];
