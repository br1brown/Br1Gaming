import { Injectable } from '@angular/core';
// <DEMO_BLOCK_START>
import { HttpParams } from '@angular/common/http';
// <DEMO_BLOCK_END>
import { LoginRequest, LoginResult } from '../dto/auth.dto';
import { BaseApiService } from '../engine/services/base-api.service';

/** Endpoint backend. Aggiungere il path qui, poi il metodo pubblico sotto. */
const API = {
// <DEMO_BLOCK_START>
    social: 'social',
// <DEMO_BLOCK_END>
    login: 'auth/login',
    blob: (slug: string) => `blob/${encodeURIComponent(slug)}`,
    blobUpload: 'blob/up',
} as const;

/**
 * Client HTTP: un metodo pubblico per ogni endpoint. Errori gestiti dall'apiErrorInterceptor;
 * `{ silent: true }` li lascia al chiamante (UI d'errore propria). Ricetta: AGENTS.md §"Aggiungere un endpoint al client".
 * ⚙️ Contratto Engine: `PageBaseComponent` la inietta come `this.api` — non rinominare la classe.
 */
@Injectable({ providedIn: 'root' })
export class ApiService extends BaseApiService {

    // <DEMO_BLOCK_START>
    /**
     * Recupera i link ai social. `nomi`: filtro opzionale — genera query a chiavi ripetute
     * (`?nomi=facebook&nomi=instagram`).
     */
    getSocial(nomi?: string[]): Promise<Record<string, string>> {
        let params = new HttpParams();
        if (nomi?.length) {
            nomi.forEach(n => params = params.append('nomi', n));
        }
        return this.api_get<Record<string, string>>(API.social, params);
    }
    // <DEMO_BLOCK_END>

    /**
     * Recupera un file dal volume uploads come oggetto `Blob` (immagini, documenti, ecc.).
     * Utile quando il file deve essere elaborato in memoria (es. anteprima locale, download forzato).
     * Per visualizzare un'immagine direttamente in un `<img>`, preferisci `getBlobUrl()`.
     */
    getBlob(slug: string): Promise<Blob> {
        return this.api_get_blob(API.blob(slug));
    }

    /**
     * URL relativo del blob (`/api/blob/{slug}`) per l'uso diretto in template, senza scaricarlo in
     * memoria. Sempre relativo, anche in SSR: il browser lo raggiunge via proxy, non l'URL interno.
     * `webopt`: versione web-ottimizzata (di default = resize immagini max 1920px→WebP; altri tipi invariati).
     */
    getBlobUrl(slug: string, webopt = true): string {
        const base = `${this.apiProxyPrefix}/${API.blob(slug)}`;
        return webopt ? `${base}?webopt=true` : base;
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

    /**
     * Carica più file e restituisce i rispettivi slug, nello stesso ordine di `files`. In
     * sequenza (l'endpoint accetta un `IFormFile` alla volta, non esiste una POST multipla):
     * se una richiesta fallisce si ferma lì e propaga l'errore — gli slug dei file già caricati
     * con successo prima del fallimento non sono nella risposta né vengono ripuliti dal server
     * (rollback esplicito a carico del chiamante, se serve, via `api_delete` su `blob/{slug}` —
     * oggi non esposto: il backend non ha ancora una DELETE su questo endpoint).
     */
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

}
