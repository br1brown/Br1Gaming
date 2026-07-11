import { inject, Injectable, InjectionToken } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ResolveFn } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContestoSito, PageType } from '../site';
import { TranslateService } from '../core/engine/services/translate.service';
import { ApiService } from '../core/services/api.service';
import { PageInfo } from '../core/engine/siteBuilder';
import type { StructuredDataInput } from '../core/engine/services/structured-data';

export type LegalFileReader = (slug: string, lang: string) => Promise<string | null>;

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
 * Carica i contenuti di pagina: un `case` per pagina in `loadResolved` (via ApiService, o
 * `tryLoadPolicy` per i .md legali). Ricetta: frontend/README.md §"Developer Journey".
 * ⚙️ Contratto Engine: non rinominare gli export ContentResolver/ResolvedPage/contentLoaderResolver.
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
        // Dati strutturati dinamici: un caso può valorizzarli dal contenuto caricato (es.
        // { kind: 'article', author: art.author, publishedOn: art.date }). Se resta null si usa
        // lo structuredData statico di site.ts (otherSEO.structuredData), o nessuno.
        // eslint-disable-next-line prefer-const -- punto d'estensione: i casi del resolver lo riassegnano
        let structuredData: StructuredDataInput | null = null;
        const info = ContestoSito.getPageInfo(pageType);

        try {
            // Le pagine legali sono risolte in modo generico: l'Engine sa quale .md
            // servire dallo slug dello slot valorizzato in site.ts (legalPages),
            // senza un case per ogni PageType legale. Le altre pagine restano esplicite.
            const legalSlug = ContestoSito.getLegalSlug(pageType);
            if (legalSlug) {
                content = await this.tryLoadPolicy(legalSlug, language);
            } else {
                switch (pageType) {
                    case PageType.Social:
                        content = await this.apiService.getSocial();
                        break;
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
