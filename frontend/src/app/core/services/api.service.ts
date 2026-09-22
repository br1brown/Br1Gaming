import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import type { HttpResourceRef } from '@angular/common/http';
import { BaseApiService } from '../engine/services/base-api.service';
import { StorySummary, StorySnapshotDto } from '../dto/story.dto';
import { GeneratorInfo, GenerateResponse, ShareEntry, ShareSaveResult } from '../dto/generator.dto';
import { LoginResult, LoginRequest } from '../dto/auth.dto';
import { TranslateResult } from '../dto/translator.dto';
import { LombrosoVerdict } from '../dto/lombroso.dto';

/** Endpoint backend. Aggiungere il path qui, poi il metodo pubblico sotto. */
const API = {
    login: 'auth/login',
    blob: (slug: string) => `blob/${encodeURIComponent(slug)}`,
    blobUpload: 'blob/up',
    stories: 'stories',
    story: (slug: string) => `stories/${encodeURIComponent(slug)}`,
    storyPlay: (slug: string) => `stories/${encodeURIComponent(slug)}/play`,
    generators: 'generators',
    generator: (slug: string) => `generators/${encodeURIComponent(slug)}`,
    generate: (slug: string) => `generators/${encodeURIComponent(slug)}/generate`,
    saveGeneration: (slug: string) => `generators/${encodeURIComponent(slug)}/save`,
    generation: (id: string) => `g/${encodeURIComponent(id)}`,
    shares: 'shares',
    sharesCounts: 'shares/counts',
    translate: 'translate',
    lombrosoVerdict: 'lombroso/verdict',
} as const;

/**
 * Client HTTP: un metodo pubblico per ogni endpoint. Errori gestiti dall'apiErrorInterceptor;
 * `{ silent: true }` li lascia al chiamante (UI d'errore propria).
 * ⚙️ Contratto Engine: `PageBaseComponent` la inietta come `this.api` — non rinominare la classe.
 */
@Injectable({ providedIn: 'root' })
export class ApiService extends BaseApiService {

    /**
     * Recupera un file dal volume uploads come oggetto `Blob` (immagini, documenti, ecc.).
     * Utile quando il file deve essere elaborato in memoria (es. anteprima locale, download forzato).
     * Per visualizzare un'immagine direttamente in un `<img>`, preferisci `getBlobUrl()`.
     */
    getBlob(slug: string): Promise<Blob> {
        return this.api_get_blob(API.blob(slug));
    }

    /** URL relativo del blob (`/api/blob/{slug}`) per l'uso diretto in template, senza scaricarlo
     *  in memoria — sempre relativo, anche in SSR: il browser lo raggiunge via proxy, non l'URL
     *  interno. `webopt` (default true) = resize→WebP; `size` è una delle `ALLOWED_WIDTHS`
     *  (ignorato se `webopt` è false), assente o fuori whitelist ricade sulla dimensione
     *  intermedia lato server. */
    getBlobUrl(slug: string, webopt = true, size?: number): string {
        const base = `${this.apiProxyPrefix}/${API.blob(slug)}`;
        if (!webopt) return base;
        return size != null ? `${base}?webopt=true&size=${size}` : `${base}?webopt=true`;
    }

    /**
     * Carica un file negli uploads e ne restituisce lo slug (poi `getBlob`/`getBlobUrl`).
     * Richiede login (JWT): l'endpoint POST è `[Authorize(Policy = "RequireLogin")]`.
     */
    uploadBlob(file: File): Promise<{ slug: string }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.api_post_form<{ slug: string }>(API.blobUpload, formData);
    }

    /** Carica più file in sequenza (l'endpoint accetta un IFormFile alla volta) e ritorna gli slug nello stesso ordine. Se una richiesta fallisce si ferma lì: gli slug già caricati non vengono ripuliti dal server. */
    async uploadBlobs(files: File[]): Promise<string[]> {
        const slugs: string[] = [];
        for (const file of files) {
            const { slug } = await this.uploadBlob(file);
            slugs.push(slug);
        }
        return slugs;
    }

    /**
     * Login: invia le credenziali. `silent: true` → niente notifica automatica, l'esito (anche
     * l'errore) lo gestisce inline il form di login via AuthService.
     */
    login(username: string, password: string): Promise<LoginResult> {
        const request: LoginRequest = { username, pwd: password };
        return this.api_post<LoginResult>(API.login, request, { silent: true });
    }

    // ─── Storie ──────────────────────────────────────────────
    // Un solo componente/rotta per tutte le storie (/avventura/:slug): niente wrapper per storia,
    // lo slug arriva dalla rotta (dynamicParams lo enumera dal catalogo) e viaggia fin qui.

    /** Catalogo delle storie disponibili. */
    getStories(): Promise<StorySummary[]> {
        return this.api_get<StorySummary[]>(API.stories);
    }

    /**
     * Versione reattiva del catalogo storie, per i componenti che si auto-caricano l'elenco
     * (es. la sezione "Storie"). Si ricarica da sé ai cambi dei segnali letti dagli header
     * (lingua) ed è ottimizzata per SSR. Per un fetch una-tantum resta `getStories()`.
     */
    storiesResource(): HttpResourceRef<StorySummary[] | undefined> {
        return this.api_resource<StorySummary[]>(API.stories);
    }

    /** Info della storia (slug sconosciuto → 404 dal backend). */
    getStory(slug: string): Promise<StorySummary> {
        return this.api_get<StorySummary>(API.story(slug));
    }

    /**
     * Passo di gioco: nessun parametro = start, solo sceneId = resume, sceneId + choiceId = scelta.
     * `silent: true`: lo StoryPlayerFacade ha la propria UI d'errore (signal `error` + redirect
     * a /error/404 sullo story-not-found), quindi niente notifica automatica dall'interceptor.
     */
    playStory(slug: string, sceneId?: string, choiceId?: string, stats?: Record<string, number>): Promise<StorySnapshotDto> {
        return this.api_post<StorySnapshotDto>(API.storyPlay(slug), { sceneId, choiceId, stats }, { silent: true });
    }

    // ─── Generatori ─────────────────────────────────────────────────────
    // Stesso giro delle storie: wrapper tipizzati sopra le private con lo slug.

    /** Catalogo dei generatori disponibili. */
    getGenerators(): Promise<GeneratorInfo[]> {
        return this.api_get<GeneratorInfo[]>(API.generators);
    }

    /**
     * Versione reattiva del catalogo generatori, per i componenti che si auto-caricano l'elenco
     * (es. la sezione "Generatori", in home e nella pagina dedicata). Si ricarica da sé ai cambi
     * dei segnali letti dagli header (lingua) ed è ottimizzata per SSR. Fetch una-tantum: `getGenerators()`.
     */
    generatorsResource(): HttpResourceRef<GeneratorInfo[] | undefined> {
        return this.api_resource<GeneratorInfo[]>(API.generators);
    }

    /** Info del generatore (slug sconosciuto → 404 dal backend). Include la variante (es. i 12
     *  segni dell'oroscopo) quando il generatore ne ha una. */
    getGenerator(slug: string): Promise<GeneratorInfo> {
        return this.api_get<GeneratorInfo>(API.generator(slug));
    }

    /**
     * Genera un nuovo testo per il generatore indicato. `inputs` è il "dizionario d'ingresso"
     * (es. `{ segno: 'ariete' }` per l'oroscopo), assente per i generatori senza variante — viaggia
     * come query param, il backend lo usa per pilotare la generazione.
     */
    generate(slug: string, inputs?: Record<string, string>): Promise<GenerateResponse> {
        const entries = Object.entries(inputs ?? {});
        const qs = entries.length
            ? '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
            : '';
        return this.api_post<GenerateResponse>(`${API.generate(slug)}${qs}`, {});
    }

    // ─── Piaciuti (raccolta pubblica) ─────────────────────────────────────
    // Lo slug arriva dalla GeneratorInfo già caricata (un valore, non una stringa scritta a mano):
    // la condivisione rimanda al backend Markdown, punteggio e firma HMAC ottenuti dalla generazione.

    /** Condivide una generazione e restituisce l'id pubblico con cui recuperarla/ricondividerla. */
    saveGeneration(slug: string, payload: Pick<GenerateResponse, 'markdown' | 'score' | 'sig'>): Promise<ShareSaveResult> {
        return this.api_post<ShareSaveResult>(API.saveGeneration(slug), payload);
    }

    /**
     * Recupera una generazione condivisa per id. `silent: true`: il chiamante (recupero `?g=` o pagina
     * condivisi) gestisce da sé l'assenza, senza la modale d'errore automatica dell'interceptor.
     */
    getGeneration(id: string): Promise<ShareEntry> {
        return this.api_get<ShareEntry>(API.generation(id), undefined, { silent: true });
    }

    /**
     * Le generazioni condivise più recenti (lista pubblica dei condivisi).
     * Con <paramref name="slug"/> restringe al solo generatore indicato (condivisi per generatore).
     */
    getShares(limit = 50, slug?: string): Promise<ShareEntry[]> {
        let params = new HttpParams().set('limit', limit);
        if (slug) params = params.set('slug', slug);
        return this.api_get<ShareEntry[]>(API.shares, params);
    }

    /** Conteggio delle generazioni condivise per generatore (slug → totale), per la panoramica. */
    getSharesCounts(): Promise<Record<string, number>> {
        return this.api_get<Record<string, number>>(API.sharesCounts);
    }

    /** Traduce un testo italiano nel "finto spagnolo" (logica lato backend). Errori silenziosi: il chiamante degrada.
     *  Nome `tradurre` (non `translate`): `translate` è già il TranslateService ereditato da BaseApiService. */
    tradurre(text: string): Promise<string> {
        return this.api_post<TranslateResult>(API.translate, { text }, { silent: true }).then(r => r.text);
    }

    /**
     * Verdetto Lombroso per l'hash del frame scattato — il "colore" campionato dai pixel, mai la foto
     * (che non lascia il browser). Il backend possiede i 36 archetipi e li ricombina con la grammatica
     * dei generatori (nomi, città, date...): stesso hash → stesso archetipo, corredo variabile.
     * `silent: true`: LombrosoComponent gestisce l'errore da sé (stato 'error' dedicato).
     */
    lombrosoVerdict(hash: number): Promise<LombrosoVerdict> {
        return this.api_get<LombrosoVerdict>(API.lombrosoVerdict, new HttpParams().set('hash', hash), { silent: true });
    }
}
