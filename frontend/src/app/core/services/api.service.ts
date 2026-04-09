import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';
import { LoginResult } from '../dto/api.dto';

/** Endpoint backend. Aggiungere qui ogni nuovo path per evitare stringhe duplicate. */
const apiBase = environment.apiUrl.replace(/\/$/, '');
const API = {
    login: `${apiBase}/api/auth/login`,
} as const;

/**
 * Client HTTP centralizzato. Ogni endpoint del backend ha un metodo pubblico dedicato.
 * La gestione errori e' automatica: NotificationService mostra l'errore all'utente.
 *
 * Per aggiungere un nuovo endpoint:
 *   1. Aggiungere il path in API (costante in cima al file)
 *   2. Aggiungere il metodo pubblico (es. getProducts())
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly http = inject(HttpClient);
    private readonly notify = inject(NotificationService);

    // ─── Endpoint pubblici ──────────────────────────────────────────────

    /** Effettua il login inviando la password al backend (form URL-encoded). */
    login(password: string): Promise<LoginResult> {
        const body = new URLSearchParams({ pwd: password }).toString();
        const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
        return firstValueFrom(
            this.http.post<LoginResult>(API.login, body, { headers })
                .pipe(catchError(err => this.handleError(err)))
        );
    }

    // ─── Gestione errori ────────────────────────────────────────────────

    /** Notifica l'utente e ri-lancia l'errore per eventuali handler a monte. */
    private handleError(error: HttpErrorResponse): Observable<never> {
        this.notify.handleApiError(error.status, error.error);
        return throwError(() => error);
    }
}
