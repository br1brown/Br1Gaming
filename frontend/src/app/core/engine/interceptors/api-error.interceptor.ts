import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { TokenService } from '../services/token.service';
import { API_NOTIFY, ApiError, extractProblemDetails, isAvailabilityError } from '../services/base-api.service';

/** Chiavi i18n per gli status con un messaggio proprio più chiaro del generico `errore<NNN>`. */
function overrideKeysFor(status: number): { titleKey?: string; descKey?: string } | undefined {
    switch (status) {
        case 0: return { titleKey: 'erroreIrraggiungibileTitolo', descKey: 'erroreIrraggiungibileDescrizione' };
        // Il sito risponde, il backend no (proxy SSR: 502 irraggiungibile, 504 timeout; 503 dal backend):
        // per l'utente è un caso solo, "servizio non disponibile", non "gateway non valido".
        case 502: case 503: case 504: return { titleKey: 'erroreServizioTitolo', descKey: 'erroreServizioDescrizione' };
        case 401: return { titleKey: 'risorsa401Titolo', descKey: 'risorsa401Descrizione' };
        case 403: return { titleKey: 'risorsa403Titolo', descKey: 'risorsa403Descrizione' };
        case 404: return { titleKey: 'risorsa404Titolo', descKey: 'risorsa404Descrizione' };
        default: return undefined;
    }
}

/** Per le richieste marcate "gestite" ({@link API_NOTIFY}) normalizza l'errore in `ApiError` e, se
 *  non `silent`, avvisa via NotificationService; le richieste non marcate passano intatte. */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
    const mode = req.context.get(API_NOTIFY);
    if (mode === null) return next(req);

    const notify = inject(NotificationService);
    const token = inject(TokenService);
    const router = inject(Router);
    return next(req).pipe(
        catchError((error: unknown) => {
            if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

            // Il server ha respinto il nostro token (revocato dopo DELETE /me/data o un logout con
            // effetto sul server, scaduto): tenerlo lascerebbe navbar e guard convinti di una sessione
            // che non c'è più, con una modale a ogni chiamata. Via subito, in ogni scheda.
            if (error.status === 401 && req.headers.has('Authorization')) token.clear();

            const problem = extractProblemDetails(error.error);
            // Niente modale quando sarebbe un doppione: offline (lo dice già OfflineBannerComponent)
            // o un problema di disponibilità durante una navigazione (la pagina "Riprova" lo dice già).
            const offline = error.status === 0 && typeof navigator !== 'undefined' && navigator.onLine === false;
            const pageWillSayIt = isAvailabilityError(error.status) && router.currentNavigation() !== null;
            if (mode && !offline && !pageWillSayIt) {
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
