import { ErrorHandler, Injectable, PLATFORM_ID, inject, isDevMode } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BaseApiService } from './base-api.service';

/** `ErrorHandler` globale. Estende `BaseApiService` invece di passare da un `ApiService` di
 *  progetto, per restare nell'Engine. App zoneless: `ErrorHandler` da solo
 *  intercetta solo gli errori nell'esecuzione che Angular traccia (template/`effect`/HttpClient) —
 *  un `setTimeout` nudo o un listener DOM a mano gli sfuggirebbe (verificato), da cui i listener
 *  `window` `error`/`unhandledrejection` sotto, in aggiunta e senza doppioni con quelli. */
@Injectable({ providedIn: 'root' })
export class ClientErrorReportingService extends BaseApiService implements ErrorHandler {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    constructor() {
        super();
        if (!this.isBrowser) return; // SSR: niente `window`, e un errore lì è già nei log del processo server.

        window.addEventListener('error', event => this.report(event.error ?? event.message));
        window.addEventListener('unhandledrejection', event => this.report(event.reason));
    }

    /** Chiamato da Angular per gli errori che già traccia (template, `effect`, HttpClient). */
    handleError(error: unknown): void {
        this.report(error);
    }

    /** Punto unico: log in console (mai silenziato, come il default di Angular) + segnalazione al
     *  backend, usato sia da `handleError` sia dai listener `window` nel costruttore. */
    private report(error: unknown): void {
        console.error(error);

        if (!this.isBrowser || isDevMode()) return;

        const err = error instanceof Error ? error : undefined;
        const message = err?.message ?? String(error);

        // Ignora gli "Script error" anonimi (CORS) dovuti a script di terze parti (es. Ads, Analytics)
        // per non spammare il webhook di errori non azionabili e senza stacktrace.
        if (message === 'Script error.') return;

        const body = {
            message,
            exceptionType: err?.name,
            path: location.pathname,
            stackTrace: err?.stack,
        };

        // Fire-and-forget, silent: un errore nel segnalare un errore non deve mai propagarne un
        // altro (rientrerebbe qui stesso) né mostrare un toast per una chiamata di telemetria.
        void this.api_post('diagnostics/ui-fault', body, { silent: true }).catch(() => { });
    }
}
