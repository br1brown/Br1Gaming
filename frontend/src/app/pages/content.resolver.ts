import { inject, Injectable, REQUEST } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ResolveFn } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContestoSito, PageType } from '../site';
import { TranslateService } from '../core/services/translate.service';
import { ApiService } from '../core/services/api.service';

/**
 * Servizio centralizzato per il caricamento dei contenuti di pagina.
 *
 * Punto unico di estensione: per aggiungere contenuto a una nuova pagina
 * basta aggiungere un case in loadResolved() — nessun altro file da toccare.
 *
 * In SSR ApiService usa SSR_BACKEND_ORIGIN per le chiamate assolute al backend.
 * Per i file statici (policy .md) usa REQUEST per costruire l'URL loopback.
 */
@Injectable({ providedIn: 'root' })
export class ContentResolver {
    private readonly http = inject(HttpClient);
    private readonly translate = inject(TranslateService);
    private readonly request = inject(REQUEST, { optional: true });
    private readonly api = inject(ApiService);

    async loadResolved(pageType: PageType, lang?: string): Promise<any> {

        let language = lang ?? this.translate.currentLang();
        if (!language)
            language = ContestoSito.config.defaultLang;

        switch (pageType) {
            case PageType.CookiePolicy:
                return this.tryLoadPolicy('cookie', language);

            // ── Generatori: metadati dal backend ────────────────────────
            case PageType.GeneratorIncel:    return this.api.getIncel().catch(() => null);
            case PageType.GeneratorAuto:     return this.api.getAuto().catch(() => null);
            case PageType.GeneratorAntiveg:  return this.api.getAntiveg().catch(() => null);
            case PageType.GeneratorLocali:   return this.api.getLocali().catch(() => null);
            case PageType.GeneratorMbeb:     return this.api.getMbeb().catch(() => null);

            // ── Storie: metadati dal backend ─────────────────────────────
            case PageType.StoryPoveriMaschi: return this.api.getStoryPoveriMaschi().catch(() => null);
            case PageType.StoryMagrogamer09: return this.api.getStoryMagrogamer09().catch(() => null);

            default:
                return null;
        }
    }

    private async tryLoadPolicy(slug: string, lang: string): Promise<string | null> {
        const path = `/assets/legal/${slug}.${lang}.md`;
        const url = this.request ? new URL(path, this.request.url).toString() : path;

        return await firstValueFrom(
            this.http.get(url, { responseType: 'text' }).pipe(catchError(() => of(null)))
        );
    }
}

/* Factory ResolveFn per app.routes.ts */
export const contentLoaderResolver = (pageType: PageType): ResolveFn<string> =>
    () => inject(ContentResolver).loadResolved(pageType);
