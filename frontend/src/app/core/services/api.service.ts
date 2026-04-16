import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';
import { TranslateService } from './translate.service';
import { TokenService } from './auth.service';
import { LoginResult } from '../dto/api.dto';
import { StorySummary, StorySnapshotDto } from '../dto/story.dto';
import { GeneratorInfo, GenerateRequest, GenerateResponse } from '../dto/generator.dto';

/**
 * Prefisso base di tutte le chiamate al backend.
 * Deve corrispondere a [Route("api")] nel BaseController.
 */
const apiBase = environment.apiUrl
    ? `${environment.apiUrl.replace(/\/$/, '')}/api`
    : '/api';

/** Endpoint backend. Aggiungere il path qui, poi il metodo pubblico sotto. */
const API = {
    login: `${apiBase}/auth/login`,
    stories: `${apiBase}/stories`,
    generators: `${apiBase}/generators`,
    generatorIncel: `${apiBase}/generators/incel`,
    generatorAuto: `${apiBase}/generators/auto`,
    generatorAntiveg: `${apiBase}/generators/antiveg`,
    generatorLocali: `${apiBase}/generators/locali`,
    generatorMbeb: `${apiBase}/generators/mbeb`,
    storyPoveriMaschi: `${apiBase}/stories/poveri-maschi`,
    storyMagrogamer09: `${apiBase}/stories/magrogamer09`,
} as const;

/**
 * Client HTTP centralizzato. Ogni endpoint del backend ha un metodo pubblico dedicato.
 * La gestione errori e' automatica: NotificationService mostra l'errore all'utente.
 *
 * Per aggiungere un endpoint:
 *   1. Aggiungere il path in API (sopra)
 *   2. Aggiungere il metodo pubblico usando this.get<T>() o this.post<T>()
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly http = inject(HttpClient);
    private readonly notify = inject(NotificationService);
    private readonly translate = inject(TranslateService);
    private readonly tokenService = inject(TokenService);

    // ─── Auth ───────────────────────────────────────────────────────────

    /** Effettua il login inviando la password al backend. */
    login(password: string): Promise<LoginResult> {
        return this.post<LoginResult>(API.login, { pwd: password });
    }

    // ─── Storie ──────────────────────────────────────────────

    getStories(): Promise<StorySummary[]> {
        return this.get<StorySummary[]>(API.stories);
    }

    playPoveriMaschi(sceneId?: string, choiceId?: string, stats?: Record<string, number>): Promise<StorySnapshotDto> {
        return this.post<StorySnapshotDto>(`${API.storyPoveriMaschi}/play`, { sceneId, choiceId, stats });
    }

    playMagrogamer09(sceneId?: string, choiceId?: string, stats?: Record<string, number>): Promise<StorySnapshotDto> {
        return this.post<StorySnapshotDto>(`${API.storyMagrogamer09}/play`, { sceneId, choiceId, stats });
    }

    // ─── Generators ─────────────────────────────────────────────────────

    getGenerators(): Promise<GeneratorInfo[]> {
        return this.get<GeneratorInfo[]>(API.generators);
    }

    getIncel(): Promise<GeneratorInfo> { return this.get<GeneratorInfo>(API.generatorIncel); }
    getAuto(): Promise<GeneratorInfo> { return this.get<GeneratorInfo>(API.generatorAuto); }
    getAntiveg(): Promise<GeneratorInfo> { return this.get<GeneratorInfo>(API.generatorAntiveg); }
    getLocali(): Promise<GeneratorInfo> { return this.get<GeneratorInfo>(API.generatorLocali); }
    getMbeb(): Promise<GeneratorInfo> { return this.get<GeneratorInfo>(API.generatorMbeb); }

    generateIncel(req: GenerateRequest): Promise<GenerateResponse> { return this.post<GenerateResponse>(`${API.generatorIncel}/generate`, req); }
    generateAuto(req: GenerateRequest): Promise<GenerateResponse> { return this.post<GenerateResponse>(`${API.generatorAuto}/generate`, req); }
    generateAntiveg(req: GenerateRequest): Promise<GenerateResponse> { return this.post<GenerateResponse>(`${API.generatorAntiveg}/generate`, req); }
    generateLocali(req: GenerateRequest): Promise<GenerateResponse> { return this.post<GenerateResponse>(`${API.generatorLocali}/generate`, req); }
    generateMbeb(req: GenerateRequest): Promise<GenerateResponse> { return this.post<GenerateResponse>(`${API.generatorMbeb}/generate`, req); }

    // ─── Metodi HTTP interni ─────────────────────────────────────────────
    // Centralizzano headers, firstValueFrom e gestione errori.
    // I metodi pubblici sopra li chiamano senza ripetere la struttura.

    private get<T>(url: string, params?: HttpParams): Promise<T> {
        return firstValueFrom(
            this.http.get<T>(url, { headers: this.buildHeaders(), params })
                .pipe(catchError(err => this.handleError(err)))
        );
    }

    private post<T>(url: string, body: unknown): Promise<T> {
        return firstValueFrom(
            this.http.post<T>(url, body, { headers: this.buildHeaders() })
                .pipe(catchError(err => this.handleError(err)))
        );
    }

    // ─── Infrastruttura ──────────────────────────────────────────────────

    private buildHeaders(): HttpHeaders {
        let headers = new HttpHeaders()
            .set('X-Api-Key', environment.apiKey)
            .set('Accept-Language', this.translate.currentLang());

        const token = this.tokenService.token();
        if (token) headers = headers.set('Authorization', `Bearer ${token}`);

        return headers;
    }

    // ─── Gestione errori ────────────────────────────────────────────────

    /** Notifica l'utente e ri-lancia l'errore per eventuali handler a monte. */
    private handleError(error: HttpErrorResponse): Observable<never> {
        this.notify.handleApiError(error.status, error.error);
        return throwError(() => error);
    }
}
