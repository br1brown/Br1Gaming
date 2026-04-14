import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { apiPrefix } from '../api-prefix';
import { LoginResult } from '../dto/api.dto';
import { StorySummary, StorySnapshotDto } from '../dto/story.dto';
import { GeneratorInfo, GenerateRequest, GenerateResponse } from '../dto/generator.dto';

/** Endpoint backend. Aggiungere qui ogni nuovo path per evitare stringhe duplicate. */
const API = {
    login: `${apiPrefix}/login`,
    stories: `${apiPrefix}/stories`,
    generators:       `${apiPrefix}/generators`,
    generatorIncel:   `${apiPrefix}/generators/incel`,
    generatorAuto:    `${apiPrefix}/generators/auto`,
    generatorAntiveg: `${apiPrefix}/generators/antiveg`,
    generatorLocali:  `${apiPrefix}/generators/locali`,
    generatorMbeb:    `${apiPrefix}/generators/mbeb`,
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

    // ─── Auth ───────────────────────────────────────────────────────────

    /** Effettua il login inviando la password al backend (form URL-encoded). */
    login(password: string): Promise<LoginResult> {
        const body = new URLSearchParams({ pwd: password }).toString();
        const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
        return firstValueFrom(
            this.http.post<LoginResult>(API.login, body, { headers })
                .pipe(catchError(err => this.handleError(err)))
        );
    }

    // ─── Stories ────────────────────────────────────────────────────────

    getStories(): Observable<StorySummary[]> {
        return this.http.get<StorySummary[]>(API.stories);
    }

    startStory(slug: string): Observable<StorySnapshotDto> {
        return this.http.post<StorySnapshotDto>(`${API.stories}/${slug}/start`, {});
    }

    resumeStory(slug: string, sceneId: string, stats: Record<string, number>): Observable<StorySnapshotDto> {
        return this.http.post<StorySnapshotDto>(`${API.stories}/${slug}/resume`, { sceneId, stats });
    }

    choose(slug: string, currentSceneId: string, choiceId: string, stats: Record<string, number>): Observable<StorySnapshotDto> {
        return this.http.post<StorySnapshotDto>(`${API.stories}/${slug}/choose`, { currentSceneId, choiceId, stats });
    }

    // ─── Generators ─────────────────────────────────────────────────────

    getGenerators(): Observable<GeneratorInfo[]> {
        return this.http.get<GeneratorInfo[]>(API.generators);
    }

    getIncel():   Observable<GeneratorInfo> { return this.http.get<GeneratorInfo>(API.generatorIncel); }
    getAuto():    Observable<GeneratorInfo> { return this.http.get<GeneratorInfo>(API.generatorAuto); }
    getAntiveg(): Observable<GeneratorInfo> { return this.http.get<GeneratorInfo>(API.generatorAntiveg); }
    getLocali():  Observable<GeneratorInfo> { return this.http.get<GeneratorInfo>(API.generatorLocali); }
    getMbeb():    Observable<GeneratorInfo> { return this.http.get<GeneratorInfo>(API.generatorMbeb); }

    generateIncel(req: GenerateRequest):   Observable<GenerateResponse> { return this.http.post<GenerateResponse>(`${API.generatorIncel}/generate`, req); }
    generateAuto(req: GenerateRequest):    Observable<GenerateResponse> { return this.http.post<GenerateResponse>(`${API.generatorAuto}/generate`, req); }
    generateAntiveg(req: GenerateRequest): Observable<GenerateResponse> { return this.http.post<GenerateResponse>(`${API.generatorAntiveg}/generate`, req); }
    generateLocali(req: GenerateRequest):  Observable<GenerateResponse> { return this.http.post<GenerateResponse>(`${API.generatorLocali}/generate`, req); }
    generateMbeb(req: GenerateRequest):    Observable<GenerateResponse> { return this.http.post<GenerateResponse>(`${API.generatorMbeb}/generate`, req); }

    // ─── Gestione errori ────────────────────────────────────────────────

    /** Notifica l'utente e ri-lancia l'errore per eventuali handler a monte. */
    private handleError(error: HttpErrorResponse): Observable<never> {
        this.notify.handleApiError(error.status, error.error);
        return throwError(() => error);
    }
}
