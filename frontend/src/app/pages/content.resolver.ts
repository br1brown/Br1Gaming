import { inject, Injectable, REQUEST } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ResolveFn } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContestoSito, PageType } from '../site';
import { TranslateService } from '../core/services/translate.service';

/**
 * Servizio centralizzato per il caricamento dei contenuti di pagina.
 *
 * Punto unico di estensione: per aggiungere contenuto a una nuova pagina
 * basta aggiungere un case in fileSlug() — nessun altro file da toccare.
 *
 * In SSR la fetch viene risolta come URL assoluta usando l'origin della request
 * corrente (token REQUEST), cosi' la chiamata loopback raggiunge lo stesso
 * processo Express che serve gli asset statici. Nel browser resta un path
 * relativo, intercettato dal service worker / cache standard.
 */
@Injectable({ providedIn: 'root' })
export class ContentResolver {
    private readonly http = inject(HttpClient);
    private readonly translate = inject(TranslateService);
    private readonly request = inject(REQUEST, { optional: true });

    async loadResolved(pageType: PageType, lang?: string): Promise<any> {

        let language = lang ?? this.translate.currentLang();
        if (!language)
            language = ContestoSito.config.defaultLang;

        switch (pageType) {
            case PageType.PrivacyPolicy:
                return this.tryLoadPolicy('privacy', language);
            case PageType.CookiePolicy:
                return this.tryLoadPolicy('cookie', language);
            case PageType.TermsOfService:
                return this.tryLoadPolicy('TOS', language);
            case PageType.LegalNotice:
                return this.tryLoadPolicy('legal', language);
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
