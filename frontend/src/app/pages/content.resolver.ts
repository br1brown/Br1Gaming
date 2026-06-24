import { inject, Injectable, InjectionToken } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ResolveFn } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContestoSito, PageType } from '../site';
import { TranslateService } from '../core/engine/services/translate.service';
import { ApiService } from '../core/services/api.service';
import { PageInfo } from '../core/engine/siteBuilder';
import { GeneratorInfo } from '../core/dto/generator.dto';
import { StorySummary } from '../core/dto/story.dto';

export type LegalFileReader = (slug: string, lang: string) => Promise<string | null>;

export interface HomeContent {
    generators: GeneratorInfo[];
    stories: StorySummary[];
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
}

/**
 * Servizio centralizzato per il caricamento dei contenuti di pagina.
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

    async loadResolved(pageType: PageType, lang?: string): Promise<ResolvedPage> {

        const language = lang ?? this.translate.currentLang();

        let content: unknown = null;
        let info = ContestoSito.getPageInfo(pageType);

        try {
            // Le pagine legali sono risolte in modo generico: l'Engine sa quale .md
            // servire dallo slug dello slot valorizzato in site.ts (legalPages).
            // Le altre pagine hanno un case esplicito che chiama il wrapper tipizzato
            // di ApiService — niente slug scritti a mano qui dentro.
            const legalSlug = ContestoSito.getLegalSlug(pageType);
            if (legalSlug) {
                content = await this.tryLoadPolicy(legalSlug, language);
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
                    // ── Generatori ───────────────────────────────────────────────
                    case PageType.GeneratorIncel: {
                        const gen = await this.apiService.getIncel().catch(() => null);
                        content = gen;
                        if (gen && info) info = { ...info, title: gen.name, description: gen.description };
                        break;
                    }
                    case PageType.GeneratorAuto: {
                        const gen = await this.apiService.getAuto().catch(() => null);
                        content = gen;
                        if (gen && info) info = { ...info, title: gen.name, description: gen.description };
                        break;
                    }
                    case PageType.GeneratorAntiveg: {
                        const gen = await this.apiService.getAntiveg().catch(() => null);
                        content = gen;
                        if (gen && info) info = { ...info, title: gen.name, description: gen.description };
                        break;
                    }
                    case PageType.GeneratorLocali: {
                        const gen = await this.apiService.getLocali().catch(() => null);
                        content = gen;
                        if (gen && info) info = { ...info, title: gen.name, description: gen.description };
                        break;
                    }
                    case PageType.GeneratorMbeb: {
                        const gen = await this.apiService.getMbeb().catch(() => null);
                        content = gen;
                        if (gen && info) info = { ...info, title: gen.name, description: gen.description };
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

        return { content, info: info };
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
