import { Injectable } from '@angular/core';
import { BaseApiService } from '../engine/services/base-api.service';
import { StorySummary, StorySnapshotDto } from '../dto/story.dto';
import { GeneratorInfo, GenerateRequest, GenerateResponse } from '../dto/generator.dto';
import { LoginResult, LoginRequest } from '../dto/auth.dto';
import { Profile } from '../engine/dto/profile.dto';

/** Endpoint backend. Aggiungere il path qui, poi il metodo pubblico sotto. */
const API = {
    profile: 'profile',
    login: 'auth/login',
    blob: (slug: string) => `blob/${encodeURIComponent(slug)}`,
    blobUpload: 'blob/up',
    stories: 'stories',
    generators: 'generators',
    generatorIncel: 'generators/incel',
    generatorAuto: 'generators/auto',
    generatorAntiveg: 'generators/antiveg',
    generatorLocali: 'generators/locali',
    generatorMbeb: 'generators/mbeb',
    storyPoveriMaschi: 'stories/poveri-maschi',
    storyMagrogamer09: 'stories/magrogamer09',
    storySurviveUsa: 'stories/sopravvivi-agli-usa',
} as const;

/**
 * Client HTTP centralizzato. Ogni endpoint del backend ha un metodo pubblico dedicato.
 * La gestione errori e' automatica per default: l'apiErrorInterceptor notifica l'utente via
 * NotificationService e ri-lancia un ApiError tipizzato per chi vuole gestire lo stato localmente.
 * Passando { silent: true } la notifica automatica viene saltata e l'errore (ApiError) resta solo
 * da gestire al chiamante: usarlo per i flussi con UI d'errore propria (es. il form di login).
 *
 * Per aggiungere un endpoint:
 *   1. Aggiungere il path nella costante API (sopra)
 *   2. Aggiungere il metodo pubblico:
 *      - chiamate una-tantum  → this.api_get<T>() / this.api_post<T>()
 *      - componenti reattivi  → this.api_resource<T>()  (si aggiorna ai cambi di signal)
 *   3. Se il dato carica una pagina, aggiungere un case in ContentResolver.loadResolved()
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
     * Delega a api_get_blob della base: stessa risoluzione URL (SSR-aware), header e gestione errori.
     */
    getBlob(slug: string): Promise<Blob> {
        return this.api_get_blob(API.blob(slug));
    }

    /**
     * Restituisce l'URL relativo del blob per usarlo direttamente in template
     * (`<img [src]="url">`, `<a [href]="url">`, ecc.) senza scaricare il file in memoria.
     *
     * Restituisce sempre un path relativo (`/api/blob/{slug}`) anche in SSR:
     * il browser deve poterlo raggiungere tramite il proxy del frontend,
     * non attraverso l'URL interno del backend.
     *
     * @param slug  Identificativo del file restituito dall'upload.
     * @param webopt  Se `true` richiede al backend la versione ottimizzata per il web del file.
     *                Flag generico, non legato alle immagini: oggi l'unica ottimizzazione
     *                implementata è il resize delle immagini (max 1920 px lato lungo, conversione
     *                in WebP), quindi i tipi non ancora gestiti vengono restituiti invariati.
     *                È il punto di aggancio per future riduzioni lato API di altri contenuti.
     */
    getBlobUrl(slug: string, webopt = true): string {
        const base = `${this.apiProxyPrefix}/${API.blob(slug)}`;
        return webopt ? `${base}?webopt=true` : base;
    }

    /**
     * Carica un file nel volume uploads del backend e restituisce lo slug univoco
     * con cui recuperarlo in seguito tramite `getBlob()` o `getBlobUrl()`.
     *
     * Richiede che l'utente sia autenticato (JWT valido): il backend applica
     * `[Authorize(Policy = "RequireLogin")]` sull'endpoint POST.
     *
     * @param file  Il file da caricare (da `<input type="file">` o drag-and-drop).
     * @returns  `{ slug }` — lo slug del file appena salvato.
     */
    uploadBlob(file: File): Promise<{ slug: string }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.api_post_form<{ slug: string }>(API.blobUpload, formData);
    }

    /**
     * Effettua il login inviando le credenziali al backend.
     * `silent: true`: niente notifica automatica — l'esito (anche l'errore) è gestito
     * inline dal form di login tramite AuthService.
     */
    login(username: string, password: string): Promise<LoginResult> {
        const request: LoginRequest = { username, pwd: password };
        return this.api_post<LoginResult>(API.login, request, { silent: true });
    }

    // ─── Storie ──────────────────────────────────────────────

    getStories(): Promise<StorySummary[]> {
        return this.api_get<StorySummary[]>(API.stories);
    }

    getStoryPoveriMaschi(): Promise<StorySummary> { return this.api_get<StorySummary>(API.storyPoveriMaschi); }
    getStoryMagrogamer09(): Promise<StorySummary> { return this.api_get<StorySummary>(API.storyMagrogamer09); }

    // `silent: true`: lo StoryPlayerFacade ha la propria UI d'errore (signal `error` + redirect
    // a /error/404 sullo story-not-found), quindi niente notifica automatica dall'interceptor.
    playPoveriMaschi(sceneId?: string, choiceId?: string, stats?: Record<string, number>): Promise<StorySnapshotDto> {
        return this.api_post<StorySnapshotDto>(`${API.storyPoveriMaschi}/play`, { sceneId, choiceId, stats }, { silent: true });
    }

    playMagrogamer09(sceneId?: string, choiceId?: string, stats?: Record<string, number>): Promise<StorySnapshotDto> {
        return this.api_post<StorySnapshotDto>(`${API.storyMagrogamer09}/play`, { sceneId, choiceId, stats }, { silent: true });
    }

    getStorySurviveUsa(): Promise<StorySummary> { return this.api_get<StorySummary>(API.storySurviveUsa); }

    playSurviveUsa(sceneId?: string, choiceId?: string, stats?: Record<string, number>): Promise<StorySnapshotDto> {
        return this.api_post<StorySnapshotDto>(`${API.storySurviveUsa}/play`, { sceneId, choiceId, stats }, { silent: true });
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
