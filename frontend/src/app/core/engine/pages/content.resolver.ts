import { EnvironmentInjector, inject, Injectable, InjectionToken, makeStateKey, runInInjectionContext, TransferState, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContestoSito, PageType } from '../../../site';
import { TranslateService } from '../services/translate.service';
import { isPlatformServer } from '@angular/common';
import { ApiError, isAvailabilityError, SsrBackendUnconfiguredError } from '../services/base-api.service';
import { PageInfo } from '../siteBuilder';
import type { StructuredDataInput } from '../services/structured-data';
import { activeLegalPartials, type LegalContent, type LegalPageSpec } from '../legal/legal-pages';
import { environment } from '../../../../environments/environment';

/** `file` relativo ad `assets/legal` (es. `privacy/intro/it.md`, `recesso.it.md`). */
export type LegalFileReader = (file: string) => Promise<string | null>;

/** Fornita da app.config.server.ts quando il build servito ha `assets/legal` su disco: allora il disco
 *  fa fede (file assente = null, nessun HTTP). Null nel browser e in `ng serve`: tryLoadPolicy usa l'HTTP. */
export const LEGAL_FILE_READER = new InjectionToken<LegalFileReader | null>(
    'LegalFileReader', { providedIn: 'root', factory: () => null }
);

/** Contenuto + metadati SEO restituiti dal resolver: il component base li legge via `pageContent()`, già tipizzato su T. */
export interface ResolvedPage<T = unknown> {
    content: T | null;
    info: PageInfo | null;
    /** JSON-LD dinamico da un `contentLoader` di pagina; ha precedenza sullo `structuredData` statico di `site.ts`, omesso → resta quello statico. */
    structuredData?: StructuredDataInput | null;
}

/** Carica i contenuti di pagina senza conoscere i PageType: le legali qui (`getLegalPage`/`tryLoadPolicy`),
 *  le altre dal proprio `contentLoader`. Contratto Engine: non rinominare ContentResolver/ResolvedPage/
 *  contentLoaderResolver. */
@Injectable({ providedIn: 'root' })
export class ContentResolver {
    private readonly http = inject(HttpClient);
    private readonly translate = inject(TranslateService);
    private readonly legalfileReader = inject(LEGAL_FILE_READER);
    private readonly transferState = inject(TransferState);
    // Garantisce un injection context valido dentro il `contentLoader` della pagina, chiamato dopo un
    // await (contentLoaderResolver), che di suo non ne ha uno attivo per un eventuale inject() nell'hook.
    private readonly injector = inject(EnvironmentInjector);

    /** `params`: i valori dei `:segmenti` della rotta corrente, passati tali e quali al `contentLoader`. */
    async loadResolved(pageType: PageType, lang?: string, params: Record<string, string> = {}): Promise<ResolvedPage> {

        const language = lang ?? this.translate.currentLang();

        let content: unknown = null;
        let structuredData: StructuredDataInput | null = null;
        let info = ContestoSito.getPageInfo(pageType, language);

        try {
            // Le pagine legali sono risolte in modo generico dalla loro ricetta (sezione `legal` di
            // site.ts), senza un case per ogni PageType legale. Le altre pagine restano esplicite.
            const legalPage = ContestoSito.getLegalPage(pageType);
            if (legalPage) {
                content = await this.loadLegal(legalPage, language);
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
            // 404 e problemi di disponibilità risalgono a contentLoaderResolver, che li trasforma in
            // un redirect verso una pagina d'errore vera. Ogni altro errore l'ha già notificato
            // l'apiErrorInterceptor: torniamo null content e il router completa comunque.
            if (error instanceof ApiError && !(error instanceof SsrBackendUnconfiguredError)
                && (error.status === 404 || isAvailabilityError(error.status))) throw error;
            content = null;
        }

        return { content, info, structuredData };
    }

    /** Pagina con `markdown`: il suo file e basta. Pagina composta: `intro`, le parti contestuali attive (o
     *  la loro variante `off/`, se c'è) e l'eventuale `outro` dalla cartella. Senza testo principale, null. */
    private async loadLegal(page: LegalPageSpec, lang: string): Promise<LegalContent | null> {
        if (page.markdown != null) {
            const text = await this.tryLoadPolicy(`${page.markdown}.${lang}.md`);
            return text === null ? null : { intro: text, sections: [], outro: null };
        }
        // Solo le parti che il build ha trovato nella cartella (`environment.legalFiles`): una facoltativa
        // assente non genera richieste. Una parte aggiunta dopo l'ultimo `generate:statics` non si vede.
        const folder = page.folder!;
        const available = new Set(environment.legalFiles[folder] ?? []);
        const read = (name: string) => available.has(name)
            ? this.tryLoadPolicy(`${folder}/${name}/${lang}.md`)
            : Promise.resolve(null);
        const active = activeLegalPartials(environment.features, ContestoSito.config.cookiePolicy != null);
        const [intro, outro, ...sections] = await Promise.all([
            read('intro'),
            read('outro'),
            ...(page.recipe.partials ?? []).map(name => read(active[name] ? name : `${name}/off`)),
        ]);
        if (intro === null) return null;
        return { intro, outro, sections: sections.filter((s): s is string => s !== null) };
    }

    private async tryLoadPolicy(file: string): Promise<string | null> {
        // Il testo letto in SSR viaggia nella pagina (TransferState): all'idratazione il browser lo
        // riusa invece di riscaricarlo. Consumato una volta: i caricamenti successivi vanno in rete.
        const key = makeStateKey<string | null>(`legal:${file}`);
        if (this.transferState.hasKey(key)) {
            const cached = this.transferState.get(key, null);
            this.transferState.remove(key);
            return cached;
        }
        // SSR del build servito: solo disco. Un testo facoltativo assente (outro, variante `off/`) non
        // diventa una richiesta HTTP del server verso il proprio dominio.
        if (this.legalfileReader) {
            const text = await this.legalfileReader(file);
            this.transferState.set(key, text);
            return text;
        }
        return firstValueFrom(
            this.http.get(`/assets/legal/${file}`, { responseType: 'text' })
                .pipe(catchError(() => of(null)))
        );
    }
}

/** `inject()` va preso sincrono prima di ogni await, quindi il redirect usa `.catch()` sulla promise
 *  già creata, non async/await. Il redirect deve essere un `RedirectCommand`: un `UrlTree` nudo qui
 *  sarebbe trattato come dato risolto (soft-404), non come redirect. */
export const contentLoaderResolver = (pageType: PageType, lang: string): ResolveFn<ResolvedPage | RedirectCommand> =>
    (route, state) => {
        const contentResolver = inject(ContentResolver);
        const router = inject(Router);
        const onServer = isPlatformServer(inject(PLATFORM_ID));
        const params = Object.fromEntries(route.paramMap.keys.map(key => [key, route.paramMap.get(key)!]));
        return contentResolver.loadResolved(pageType, lang, params)
            .catch(error => {
                if (error instanceof ApiError && error.status === 404) return new RedirectCommand(router.parseUrl('/error/404'));
                // URL da ritentare in query string, non nello state di navigazione: in SSR il redirect
                // è un 302 e lo state non esiste, e un reload della pagina d'errore lo perderebbe comunque.
                if (error instanceof ApiError && !(error instanceof SsrBackendUnconfiguredError) && isAvailabilityError(error.status)) {
                    const tree = router.createUrlTree([availabilityErrorPath(error.status, onServer)], { queryParams: { [RETRY_QUERY_PARAM]: state.url } });
                    return new RedirectCommand(tree);
                }
                throw error;
            });
    };

export { isAvailabilityError };
/** Rotta d'errore per uno status di {@link isAvailabilityError}: lo 0 è `error/offline` nel browser,
 *  ma sul server (che non ha un "sei offline") diventa `/error/502`. Gli altri: `error/<status>`. */
export function availabilityErrorPath(status: number, onServer: boolean): string {
    if (status === 0) return onServer ? '/error/502' : OFFLINE_ERROR_PATH;
    return `/error/${status}`;
}

/** Rotta della pagina "sei offline / server non raggiungibile" (`error/:errorCode` con codice `offline`, ErrorComponent). */
export const OFFLINE_ERROR_PATH = '/error/offline';
/** Query param, su una pagina di {@link availabilityErrorPath}, con l'URL interno da ritentare. */
export const RETRY_QUERY_PARAM = 'retry';
