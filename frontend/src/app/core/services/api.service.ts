import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Profile } from '../dto/profile.dto';
import { LoginResult } from '../dto/api.dto';
import { StorySummary, StorySnapshotDto } from '../dto/story.dto';
import { GeneratorInfo, GenerateRequest, GenerateResponse } from '../dto/generator.dto';
import { BaseApiService } from './base-api.service';

/** Endpoint backend. Aggiungere il path qui, poi il metodo pubblico sotto. */
const API = {
    profile: 'profile',
    login: 'auth/login',
    blob: (slug: string) => `blob/${encodeURIComponent(slug)}`,
    stories: 'stories',
    generators: 'generators',
    generatorIncel: 'generators/incel',
    generatorAuto: 'generators/auto',
    generatorAntiveg: 'generators/antiveg',
    generatorLocali: 'generators/locali',
    generatorMbeb: 'generators/mbeb',
    storyPoveriMaschi: 'stories/poveri-maschi',
    storyMagrogamer09: 'stories/magrogamer09',
} as const;

/**
 * Client HTTP centralizzato. Ogni endpoint del backend ha un metodo pubblico dedicato.
 * La gestione errori e' automatica: NotificationService mostra l'errore all'utente.
 *
 * Per aggiungere un endpoint:
 *   - Aggiungere il path in API (sopra)
 *   - Aggiungere il metodo pubblico usando this.api_get<T>() o this.api_post<T>()
 */
@Injectable({ providedIn: 'root' })
export class ApiService extends BaseApiService {

    /** Recupera i dati profilo legale e i contatti pubblici. */
    getProfile(): Promise<Profile> {
        return this.api_get<Profile>(API.profile);
    }

    /**
     * Versione reattiva di getProfile() basata su httpResource.
     * Si aggiorna automaticamente al cambio lingua (via Accept-Language nell'header).
     * Usare nei componenti persistenti come il footer.
     */
    getProfileResource() {
        return this.api_resource<Profile>(API.profile);
    }

    /**
     * Recupera un file dal volume uploads come Blob (immagini, documenti, ecc.).
     * Usa HttpClient direttamente: responseType 'blob' non e' compatibile con get<T>().
     */
    getBlob(slug: string): Promise<Blob> {
        return firstValueFrom(
            this.http.get(API.blob(slug), { headers: this.build_api_Headers(), responseType: 'blob' })
                .pipe(catchError(err => this.handleError(err)))
        );
    }

    // ─── Auth ───────────────────────────────────────────────────────────

    /** Effettua il login inviando la password al backend. */
    login(password: string): Promise<LoginResult> {
        return this.api_post<LoginResult>(API.login, { pwd: password });
    }

    // ─── Storie ──────────────────────────────────────────────

    getStories(): Promise<StorySummary[]> {
        return this.api_get<StorySummary[]>(API.stories);
    }

    playPoveriMaschi(sceneId?: string, choiceId?: string, stats?: Record<string, number>): Promise<StorySnapshotDto> {
        return this.api_post<StorySnapshotDto>(`${API.storyPoveriMaschi}/play`, { sceneId, choiceId, stats });
    }

    playMagrogamer09(sceneId?: string, choiceId?: string, stats?: Record<string, number>): Promise<StorySnapshotDto> {
        return this.api_post<StorySnapshotDto>(`${API.storyMagrogamer09}/play`, { sceneId, choiceId, stats });
    }

    // ─── Generators ─────────────────────────────────────────────────────

    getGenerators(): Promise<GeneratorInfo[]> {
        return this.api_get<GeneratorInfo[]>(API.generators);
    }

    getIncel(): Promise<GeneratorInfo> { return this.api_get<GeneratorInfo>(API.generatorIncel); }
    getAuto(): Promise<GeneratorInfo> { return this.api_get<GeneratorInfo>(API.generatorAuto); }
    getAntiveg(): Promise<GeneratorInfo> { return this.api_get<GeneratorInfo>(API.generatorAntiveg); }
    getLocali(): Promise<GeneratorInfo> { return this.api_get<GeneratorInfo>(API.generatorLocali); }
    getMbeb(): Promise<GeneratorInfo> { return this.api_get<GeneratorInfo>(API.generatorMbeb); }

    generateIncel(req: GenerateRequest): Promise<GenerateResponse> { return this.api_post<GenerateResponse>(`${API.generatorIncel}/generate`, req); }
    generateAuto(req: GenerateRequest): Promise<GenerateResponse> { return this.api_post<GenerateResponse>(`${API.generatorAuto}/generate`, req); }
    generateAntiveg(req: GenerateRequest): Promise<GenerateResponse> { return this.api_post<GenerateResponse>(`${API.generatorAntiveg}/generate`, req); }
    generateLocali(req: GenerateRequest): Promise<GenerateResponse> { return this.api_post<GenerateResponse>(`${API.generatorLocali}/generate`, req); }
    generateMbeb(req: GenerateRequest): Promise<GenerateResponse> { return this.api_post<GenerateResponse>(`${API.generatorMbeb}/generate`, req); }
}
