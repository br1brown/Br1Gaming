import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { API_NOTIFY, ApiError, extractProblemDetails } from '../services/base-api.service';

/**
 * Chiavi i18n specifiche per alcuni status "noti" (l'auth/risorsa ha messaggi propri,
 * più chiari del generico `errore<NNN>`). Per gli altri status la NotificationService
 * usa i suoi fallback. Prima questa mappa viveva dentro BaseApiService.handleError.
 */
function overrideKeysFor(status: number): { titleKey?: string; descKey?: string } | undefined {
    switch (status) {
        case 401: return { titleKey: 'risorsa401Titolo', descKey: 'risorsa401Descrizione' };
        case 403: return { titleKey: 'risorsa403Titolo', descKey: 'risorsa403Descrizione' };
        case 404: return { titleKey: 'risorsa404Titolo', descKey: 'risorsa404Descrizione' };
        default: return undefined;
    }
}

/** Concern trasversale: la notifica automatica degli errori HTTP non vive nel client API, che resta
 *  puro. Per le sole richieste marcate "gestite" ({@link API_NOTIFY}) normalizza l'`HttpErrorResponse`
 *  grezzo in un `ApiError` tipizzato e, se non `silent`, avvisa via NotificationService. Le pagine
 *  con UI d'errore propria (login) passano `{ silent: true }`; le richieste non gestite passano intatte. */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
    const mode = req.context.get(API_NOTIFY);
    if (mode === null) return next(req);

    const notify = inject(NotificationService);
    return next(req).pipe(
        catchError((error: unknown) => {
            if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

            const problem = extractProblemDetails(error.error);
            if (mode) {
                /* try/catch: degrado grazioso se la NotificationService non riesce a mostrare
                   l'errore (es. SweetAlert2 non ancora caricato) — non blocca il flusso. */
                try {
                    notify.handleApiError(error.status, problem, overrideKeysFor(error.status));
                } catch {
                    console.error('[API Error]', error.status, error.message);
                }
            }
            return throwError(() => new ApiError(error.status, problem));
        }),
    );
};
