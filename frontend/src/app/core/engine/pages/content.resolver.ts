import { EnvironmentInjector, inject, Injectable, InjectionToken, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContestoSito, PageType } from '../../../site';
import { TranslateService } from '../services/translate.service';
import { ApiError } from '../services/base-api.service';
import { PageInfo } from '../siteBuilder';
import type { StructuredDataInput } from '../services/structured-data';

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
     * Dati strutturati ricchi (JSON-LD) derivati dal contenuto, impostati da un `contentLoader` di
     * pagina (es. autore/data di un Article). Hanno la precedenza sul `structuredData` statico di
     * `site.ts`. Omesso → si usa quello statico (o nessuno).
     */
    structuredData?: StructuredDataInput | null;
}

/**
 * Carica i contenuti di pagina: generico, zero PageType conosciuti. Le pagine legali sono gestite
 * qui (via `getLegalSlug`/`tryLoadPolicy`); ogni altra pagina porta la propria logica nel
 * `contentLoader` della sua definizione (`SitePageInput.contentLoader`, stesso schema di `dynamicParams`).
 * ⚙️ Contratto Engine: non rinominare gli export ContentResolver/ResolvedPage/contentLoaderResolver.
 */
@Injectable({ providedIn: 'root' })
export class ContentResolver {
    private readonly http = inject(HttpClient);
    private readonly translate = inject(TranslateService);
    private readonly legalfileReader = inject(LEGAL_FILE_READER);
    // Garantisce un injection context valido dentro il `contentLoader` della pagina, chiamato sia
    // dopo un await (contentLoaderResolver) sia da un resource() (page-base.component.ts) — nessuno
    // dei due garantisce di suo un context attivo per un eventuale inject() nell'hook.
    private readonly injector = inject(EnvironmentInjector);

    /**
     * `params` sono i valori di tutti i `:segmenti` della rotta corrente (es. `/prodotti/:slug`,
     * o multi-segmento) — vuoto sulle pagine senza segmenti parametrici. Arriva dal resolver del
     * router e dal ricaricato client allo stesso modo, e passa tale e quale al `contentLoader`.
     */
    async loadResolved(pageType: PageType, lang?: string, params: Record<string, string> = {}): Promise<ResolvedPage> {

        const language = lang ?? this.translate.currentLang();

        let content: unknown = null;
        let structuredData: StructuredDataInput | null = null;
        let info = ContestoSito.getPageInfo(pageType, language);

        try {
            // Le pagine legali sono risolte in modo generico: l'Engine sa quale .md
            // servire dallo slug dello slot valorizzato in site.ts (legalPages),
            // senza un case per ogni PageType legale. Le altre pagine restano esplicite.
            const legalSlug = ContestoSito.getLegalSlug(pageType);
            if (legalSlug) {
                content = await this.tryLoadPolicy(legalSlug, language);
            } else {
                const loader = ContestoSito.getContentLoader(pageType);
                if (loader) {
                    const result = await runInInjectionContext(this.injector, () => loader({ lang: language, params }));
                    content = result.content;
                    structuredData = result.structuredData ?? null;
                    if (result.info && info) info = { ...info, ...result.info };
                }
            }
        } catch (error) {
            // Uno slug/id inesistente (404 dal backend) risale a contentLoaderResolver (sotto),
            // che lo trasforma in un redirect verso /error/404 — un 404 vero, non una pagina vuota
            // appesa in silenzio. Ogni altro errore: l'apiErrorInterceptor ha già avvisato l'utente
            // via Swal, restituiamo null content e il router completa comunque.
            if (error instanceof ApiError && error.status === 404) throw error;
            content = null;
        }

        return { content, info, structuredData };
    }

    private async tryLoadPolicy(slug: string, lang: string): Promise<string | null> {
        // SSR: legge da disco (dist/browser/assets/legal). Se manca — tipico in
        // `ng serve`, dove quella cartella non esiste — ricade sull'HTTP come il browser.
        if (this.legalfileReader) {
            const fromDisk = await this.legalfileReader(slug, lang);
            if (fromDisk !== null) return fromDisk;
        }
        return firstValueFrom(
            this.http.get(`/assets/legal/${slug}.${lang}.md`, { responseType: 'text' })
                .pipe(catchError(() => of(null)))
        );
    }
}

/* Factory ResolveFn per core/engine/routing.ts. `lang` è passato esplicitamente in chiusura (nota
 * in routing.ts sul perché non si legge da TranslateService.currentLang() qui). Tutti i `:segmenti`
 * della rotta (come `route.paramMap`) passano attraverso al `contentLoader`, se gli servono.
 *
 * `inject()` va preso QUI, sincrono (prima di ogni await) — l'unico punto con injection context
 * garantito per un ResolveFn; per questo il redirect sul 404 usa `.catch()` sulla promise già
 * creata, non async/await (un `inject()` dopo un await fallirebbe fuori contesto).
 *
 * ATTENZIONE: un `ResolveFn` redirige SOLO con `RedirectCommand` — un `UrlTree` nudo (es.
 * `router.parseUrl(...)`) viene trattato come DATO risolto, non come redirect (diverso da
 * `CanActivateFn`). Un `UrlTree` nudo qui produrrebbe un soft-404: la pagina resterebbe sulla
 * rotta richiesta con `content: null`, invece di redirigere davvero a `/error/404`. */
export const contentLoaderResolver = (pageType: PageType, lang: string): ResolveFn<ResolvedPage | RedirectCommand> =>
    (route) => {
        const contentResolver = inject(ContentResolver);
        const router = inject(Router);
        const params = Object.fromEntries(route.paramMap.keys.map(key => [key, route.paramMap.get(key)!]));
        return contentResolver.loadResolved(pageType, lang, params)
            .catch(error => {
                if (error instanceof ApiError && error.status === 404) return new RedirectCommand(router.parseUrl('/error/404'));
                throw error;
            });
    };
