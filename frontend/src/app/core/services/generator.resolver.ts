import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { GeneratorInfo } from '../dto/generator.dto';
import { ApiService } from './api.service';
import { PageType } from '../../site';

function fetchByPageType(api: ApiService, pageType: PageType): Promise<GeneratorInfo> {
    switch (pageType) {
        case PageType.GeneratorIncel:   return api.getIncel();
        case PageType.GeneratorAuto:    return api.getAuto();
        case PageType.GeneratorAntiveg: return api.getAntiveg();
        case PageType.GeneratorLocali:  return api.getLocali();
        case PageType.GeneratorMbeb:    return api.getMbeb();
        default: throw new Error(`[generatorResolver] PageType non è un generatore: ${pageType}`);
    }
}

/**
 * Factory che restituisce un ResolveFn tipizzato per il PageType specificato.
 * I dati sono disponibili sincroni in route.snapshot.data['generator'].
 * In SSR saltiamo il caricamento per evitare hanging del server node in dev mode.
 */
export function generatorResolver(pageType: PageType): ResolveFn<GeneratorInfo | null> {
    return (route, state) => {
        const api = inject(ApiService);
        const router = inject(Router);

        return fetchByPageType(api, pageType).catch(error => {
            const status = error instanceof HttpErrorResponse ? error.status : 500;
            // Nel browser navighiamo verso l'errore, ma non blocchiamo il server SSR
            if (typeof window !== 'undefined') {
                void router.navigateByUrl(`/error/${status}`);
            }
            return null;
        });
    };
}
