import { inject, Injectable, InjectionToken } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ResolveFn, Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContestoSito, PageType } from '../site';
import { TranslateService } from '../core/engine/services/translate.service';
import { ApiService } from '../core/services/api.service';
import { PageInfo } from '../core/engine/siteBuilder';
import { GeneratorInfo, GenerateResponse, GeneratorPageContent } from '../core/dto/generator.dto';
import { StorySummary } from '../core/dto/story.dto';
import type { StructuredDataInput } from '../core/engine/services/structured-data';

export type LegalFileReader = (slug: string, lang: string) => Promise<string | null>;

export interface HomeContent {
    generators: GeneratorInfo[];
    stories: StorySummary[];
}

/**
 * Titolo della pagina dalla frase generata, recuperata con `?g=`. Qui si normalizza solo il
 * whitespace: il troncamento e l'eventuale ellissi sono delegati al livello a valle
 * (setPageMeta / og-preview), che è l'unico punto dove si decide come tagliare.
 */
function titleFromGeneration(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/** In SSR viene fornita da app.config.server.ts per leggere i file .md da disco.
 *  Nel browser rimane null e tryLoadPolicy usa la fetch HTTP normale. */
export const LEGAL_FILE_READER = new InjectionToken<LegalFileReader | null>(
    'LegalFileReader', { providedIn: 'root', factory: () => null }
);

/**
 * Dati restituiti dal resolver: contenuto della pagina + metadati SEO.
 * Il component base li riceve, aggiorna i meta tag via effect() e
 * espone pageContent() già tipizzato tramite il generic T.
 */
export interface ResolvedPage<T = unknown> {
    content: T | null;
    info: PageInfo | null;
    /**
     * Dati strutturati ricchi (JSON-LD) derivati dal contenuto, impostati da un caso del resolver
     * (es. autore/data di un Article). Hanno la precedenza sul `structuredData` statico di `site.ts`.
     * Omesso → si usa quello statico (o nessuno).
     */
    structuredData?: StructuredDataInput | null;
}

/**
 * Servizio centralizzato per il caricamento dei contenuti di pagina.
 *
 * ⚙️ Contratto fisso: l'Engine importa `ContentResolver`, `ResolvedPage` e `contentLoaderResolver`
 * (routing.ts + PageBaseComponent). Aggiungi `case` a loadResolved(); non rinominare/rimuovere gli export.
 *
 * Per aggiungere il contenuto di una nuova pagina:
 *   1. Aggiungere il metodo in ApiService (o usare tryLoadPolicy per file statici)
 *   2. Aggiungere un case nello switch di loadResolved()
 *
 * Il try-catch esterno protegge il router: se l'API fallisce, l'apiErrorInterceptor
 * ha già mostrato il dialog all'utente e il resolver restituisce content = null
 * invece di rigettare (che cancellerebbe la navigazione).
 *
 * In SSR i file .md delle policy vengono letti direttamente da disco tramite
 * LEGAL_FILE_READER (fornito da app.config.server.ts), eliminando la chiamata
 * HTTP loopback. Nel browser resta una semplice fetch relativa.
 *
 * I placeholder {{cookieList}} e {{ragioneSociale}} ecc. sono gestiti
 * interamente da PolicyComponent — il resolver restituisce Markdown grezzo.
 */
@Injectable({ providedIn: 'root' })
export class ContentResolver {
    private readonly http = inject(HttpClient);
    private readonly translate = inject(TranslateService);
    private readonly apiService = inject(ApiService);
    private readonly fileReader = inject(LEGAL_FILE_READER);
    private readonly router = inject(Router);

    async loadResolved(pageType: PageType, lang?: string): Promise<ResolvedPage> {

        const language = lang ?? this.translate.currentLang();

        let content: unknown = null;
        // Dati strutturati dinamici: un caso può valorizzarli dal contenuto caricato (es.
        // { kind: 'article', author: art.author, publishedOn: art.date }). Se resta null si usa
        // lo structuredData statico di site.ts (otherSEO.structuredData), o nessuno.
        // eslint-disable-next-line prefer-const -- punto d'estensione: i casi del resolver lo riassegnano
        let structuredData: StructuredDataInput | null = null;
        let info = ContestoSito.getPageInfo(pageType);

        try {
            // Le pagine legali sono risolte in modo generico: l'Engine sa quale .md
            // servire dallo slug dello slot valorizzato in site.ts (legalPages).
            // Le altre pagine hanno un case esplicito che chiama il wrapper tipizzato
            // di ApiService — niente slug scritti a mano qui dentro.
            const legalSlug = ContestoSito.getLegalSlug(pageType);
            const loadGenerator = this.generatorLoader(pageType);
            if (legalSlug) {
                content = await this.tryLoadPolicy(legalSlug, language);
            } else if (loadGenerator) {
                // Generatori: info del generatore e (se `?g=`) la generazione recuperata in
                // parallelo — due round-trip al massimo, non in fila. Il `result` arriva SOLO dal
                // recupero `?g=` (SSR + niente doppio fetch lato component); la generazione nuova
                // la fa il client. La frase recuperata diventa anche il titolo SEO (vedi sotto).
                const g = this.currentG();
                const [gen, entry] = await Promise.all([
                    loadGenerator().catch(() => null),
                    g ? this.apiService.getGeneration(g).catch(() => null) : Promise.resolve(null),
                ]);
                if (gen) {
                    if (info) info = { ...info, title: gen.name, description: gen.description };
                    let result: GenerateResponse | null = null;
                    let recovered = false;
                    if (entry?.text) {
                        // sig vuota: una generazione recuperata è già nei condivisi, non si ri-condivide.
                        result = { text: entry.text, markdown: entry.markdown, score: entry.score, sig: '' };
                        recovered = true;
                        if (info) info = { ...info, title: titleFromGeneration(entry.text) };
                    }
                    content = { generator: gen, result, recovered } satisfies GeneratorPageContent;
                }
            } else {
                switch (pageType) {
                    case PageType.Home: {
                        const [generators, stories] = await Promise.all([
                            this.apiService.getGenerators().catch((): GeneratorInfo[] => []),
                            this.apiService.getStories().catch((): StorySummary[] => []),
                        ]);
                        content = { generators, stories };
                        break;
                    }

                    // ── Storie ───────────────────────────────────────────────────
                    case PageType.StoryPoveriMaschi: {
                        const story = await this.apiService.getStoryPoveriMaschi().catch(() => null);
                        content = story;
                        if (story && info) info = { ...info, title: story.title, description: story.description };
                        break;
                    }
                    case PageType.StoryMagrogamer09: {
                        const story = await this.apiService.getStoryMagrogamer09().catch(() => null);
                        content = story;
                        if (story && info) info = { ...info, title: story.title, description: story.description };
                        break;
                    }
                    case PageType.StorySurviveUsa: {
                        const story = await this.apiService.getStorySurviveUsa().catch(() => null);
                        content = story;
                        if (story && info) info = { ...info, title: story.title, description: story.description };
                        break;
                    }
                }
            }
        } catch {
            // L'apiErrorInterceptor ha già notificato l'utente via Swal.
            // Restituiamo null content affinché il resolver si risolva sempre
            // e il router completi la navigazione invece di cancellarla.
            content = null;
        }

        return { content, info, structuredData };
    }

    /** Wrapper tipizzato per le info del generatore associato al pageType, o null se non è un generatore. */
    private generatorLoader(pageType: PageType): (() => Promise<GeneratorInfo>) | null {
        switch (pageType) {
            case PageType.GeneratorIncel: return () => this.apiService.getIncel();
            case PageType.GeneratorAuto: return () => this.apiService.getAuto();
            case PageType.GeneratorAntiveg: return () => this.apiService.getAntiveg();
            case PageType.GeneratorLocali: return () => this.apiService.getLocali();
            case PageType.GeneratorMbeb: return () => this.apiService.getMbeb();
            default: return null;
        }
    }

    /**
     * Query param `?g=` della pagina corrente. Lo legge dal Router (non da un argomento) così
     * funziona sia durante la navigazione (finalUrl) sia nei reload del resolver scatenati dalla
     * base al cambio lingua (dove l'URL attivo non cambia). SSR-safe.
     */
    private currentG(): string | null {
        const tree = this.router.getCurrentNavigation()?.finalUrl ?? this.router.parseUrl(this.router.url);
        return tree.queryParamMap.get('g');
    }

    private async tryLoadPolicy(slug: string, lang: string): Promise<string | null> {
        // SSR: legge da disco (dist/browser/assets/legal). Se manca — tipico in
        // `ng serve`, dove quella cartella non esiste — ricade sull'HTTP come il browser.
        if (this.fileReader) {
            const fromDisk = await this.fileReader(slug, lang);
            if (fromDisk !== null) return fromDisk;
        }
        return firstValueFrom(
            this.http.get(`/assets/legal/${slug}.${lang}.md`, { responseType: 'text' })
                .pipe(catchError(() => of(null)))
        );
    }
}

/* Factory ResolveFn per core/engine/routing.ts */
export const contentLoaderResolver = (pageType: PageType): ResolveFn<ResolvedPage> =>
    () => inject(ContentResolver).loadResolved(pageType);
