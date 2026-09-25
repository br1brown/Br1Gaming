import { inject, InjectionToken } from '@angular/core';
import { HttpClient, HttpContext, HttpContextToken, HttpHeaders, HttpParams, httpResource } from '@angular/common/http';
import type { HttpResourceRef } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from './translate.service';
import { TokenService } from './token.service';
import { NotificationConnection } from './notification-connection';

/** RFC 9457 (Problem Details for HTTP APIs): formato usato da molti framework backend (ASP.NET Core, Spring, NestJS). */
export interface ProblemDetails {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    instance?: string;
    errors?: string[] | Record<string, string[]>;
}

/** Marca una richiesta come "gestita dal client API", letto da `apiErrorInterceptor`: null = non gestita (httpResource/asset), true = notifica automatica, false = silent (il chiamante gestisce l'errore). Vive qui (non nell'interceptor) per una dipendenza a senso unico. */
export const API_NOTIFY = new HttpContextToken<boolean | null>(() => null);

/** Estrae in modo sicuro i ProblemDetails (RFC 9457) dal body di una risposta d'errore. */
export function extractProblemDetails(body: unknown): ProblemDetails | null {
    if (!body) return null;

    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            return null;
        }
    }

    if (typeof body === 'object' && body !== null) {
        return body as ProblemDetails;
    }

    return null;
}

/** Status che dicono "adesso no, riprova" e non "questa richiesta è sbagliata": 0 = nessuna risposta,
 *  502/504 = backend irraggiungibile dietro il proxy SSR, 503 = il backend si dichiara non disponibile. */
export function isAvailabilityError(status: number): boolean {
    return status === 0 || status === 502 || status === 503 || status === 504;
}

/** Errore applicativo normalizzato: i wrapper (`api_get`, `api_post`...) ri-lanciano sempre `HttpErrorResponse` come `ApiError` (status + eventuali `ProblemDetails`), senza dipendere dai dettagli di trasporto Angular. `status === 0` = errore di rete/server irraggiungibile. */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly problem: ProblemDetails | null
    ) {
        super(problem?.detail ?? problem?.title ?? `HTTP ${status}`);
        this.name = 'ApiError';
    }
}

/** Rifiuto immediato di una chiamata SSR senza `BACKEND_ORIGIN` configurato: nessuna richiesta è
 *  partita, non è un problema di disponibilità — i resolver lo trattano come contenuto vuoto, mai come pagina d'errore. */
export class SsrBackendUnconfiguredError extends ApiError {
    constructor() {
        super(0, null);
        this.name = 'SsrBackendUnconfiguredError';
    }
}

/** Opzioni per le singole chiamate API. */
export interface ApiCallOptions {
    /** `true`: l'interceptor salta la notifica automatica e propaga solo l'`ApiError`, per un chiamante con una UI d'errore propria (es. il login). Default `false`. */
    silent?: boolean;
}

// URL assoluto del backend (usato solo lato server)
export const SSR_BACKEND_ORIGIN = new InjectionToken<string>('SSR_BACKEND_ORIGIN');
// Prefisso API (es. /api/v1)
export const SSR_API_PREFIX = new InjectionToken<string>('SSR_API_PREFIX');
// Chiave segreta (usata solo lato server)
export const SSR_API_KEY = new InjectionToken<string>('SSR_API_KEY');

export abstract class BaseApiService {
    // Dipendenze iniettate tramite la funzione inject() (Pattern Angular 14+).
    // NB: nessuna NotificationService qui — il client API è puro: fa la chiamata e propaga
    // un ApiError tipizzato. La notifica automatica è dell'apiErrorInterceptor.
    protected readonly http = inject(HttpClient);
    protected readonly translate = inject(TranslateService);
    protected readonly tokenService = inject(TokenService);
    // Holder inerte: leggerlo NON apre lo stream SSE (lo popola il NotificationStreamService quando
    // il campanellino è attivo). Così l'header X-Connection-Id parte solo se le notifiche servono.
    private readonly connection = inject(NotificationConnection);

    /** Contesto HTTP che marca la richiesta come "gestita": l'interceptor normalizza l'errore e notifica, salvo `silent`. */
    private apiContext(opts?: ApiCallOptions): HttpContext {
        return new HttpContext().set(API_NOTIFY, !opts?.silent);
    }

    // Configurazioni opzionali per SSR
    private readonly ssrOrigin = inject(SSR_BACKEND_ORIGIN, { optional: true });
    protected readonly apiProxyPrefix = inject(SSR_API_PREFIX, { optional: true }) ?? '/api';
    private readonly ssrApiKey = inject(SSR_API_KEY, { optional: true });

    /** True in SSR senza `BACKEND_ORIGIN` (es. estrazione rotte in CI): falliamo subito, così i `.catch()` dei resolver restituiscono dati vuoti senza bloccare il build. */
    private get ssrBackendUnconfigured(): boolean {
        // ssrOrigin è null in browser, stringa (anche '') in SSR.
        // La stringa vuota significa che BACKEND_ORIGIN non era settato al momento del boot.
        return this.ssrOrigin !== null && this.ssrOrigin !== undefined && !this.ssrOrigin;
    }

    protected resolveUrl(url: string): string {
        const base = this.ssrOrigin ?? this.apiProxyPrefix;
        return BaseApiService.joinUrl(base, url);
    }

    /** Utility statica per concatenare path evitando doppi slash o slash mancanti. */
    private static joinUrl(base: string, path: string): string {
        return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
    }

    /** Esegue un controllo di base sulla raggiungibilità del servizio. */
    getHealth(): Promise<void> {
        return this.api_get<void>('health');
    }

    // ─── METODI HTTP WRAPPER ─────────────────────────────────────────────
    // Forniscono un'interfaccia basata su Promise e automatizzano header ed errori.

    /** Esegue una richiesta GET. */
    protected api_get<T>(url: string, params?: HttpParams, opts?: ApiCallOptions): Promise<T> {
        if (this.ssrBackendUnconfigured) return Promise.reject(new SsrBackendUnconfiguredError());
        return firstValueFrom(
            this.http.get<T>(this.resolveUrl(url), {
                headers: this.build_api_Headers(),
                params,
                context: this.apiContext(opts),
            })
        );
    }

    /** GET dati binari (immagini, PDF...): `responseType: 'blob'` non è compatibile con la firma generica di `api_get<T>`, quindi un metodo dedicato — ma stessa pipeline resolveUrl/header/interceptor. */
    protected api_get_blob(url: string, params?: HttpParams, opts?: ApiCallOptions): Promise<Blob> {
        if (this.ssrBackendUnconfigured) return Promise.reject(new SsrBackendUnconfiguredError());
        return firstValueFrom(
            this.http.get(this.resolveUrl(url), {
                headers: this.build_api_Headers(),
                params,
                responseType: 'blob',
                context: this.apiContext(opts),
            })
        );
    }

    /** Esegue una richiesta POST inviando un body JSON. */
    protected api_post<T>(url: string, body: unknown, opts?: ApiCallOptions): Promise<T> {
        if (this.ssrBackendUnconfigured) return Promise.reject(new SsrBackendUnconfiguredError());
        return firstValueFrom(
            this.http.post<T>(this.resolveUrl(url), body, {
                headers: this.build_api_Headers(),
                context: this.apiContext(opts),
            })
        );
    }

    /** POST con `FormData` (upload multipart). Non imposta `Content-Type` a mano: Angular/browser lo fa da sé col boundary corretto, impostarlo a mano lo spezzerebbe. */
    protected api_post_form<T>(url: string, formData: FormData, opts?: ApiCallOptions): Promise<T> {
        if (this.ssrBackendUnconfigured) return Promise.reject(new SsrBackendUnconfiguredError());
        return firstValueFrom(
            this.http.post<T>(this.resolveUrl(url), formData, {
                headers: this.build_api_Headers(),
                context: this.apiContext(opts),
            })
        );
    }

    /** Versione reattiva di `api_get` (solo GET): `HttpResourceRef<T | undefined>` con `.value()`/`.isLoading` aggiornati a ogni segnale letto nella factory. Per componenti sempre attivi (header, footer); per chiamate una-tantum `api_get`, per mutazioni `api_post`. Guardato da `ssrBackendUnconfigured` sotto: non rimuovere il guard, un eager `inject()` che lo bypassa fa scadere l'estrazione route in CI. */
    protected api_resource<T>(url: string, params?: HttpParams): HttpResourceRef<T | undefined> {
        // `undefined` (invece di un url relativo rotto) dice a httpResource "nessuna richiesta":
        // si assesta subito su idle, stesso fail-fast silenzioso degli altri api_* — vedi ssrBackendUnconfigured.
        return httpResource<T>(() => this.ssrBackendUnconfigured ? undefined : ({
            url: this.resolveUrl(url),
            headers: this.build_api_Headers(),
            ...(params ? { params } : {}),
        }));
    }

    // ─── INFRASTRUTTURA E SICUREZZA ───────────────────────────────────────

    protected build_api_Headers(aggiunte?: { [key: string]: string }): HttpHeaders {
        let headers = new HttpHeaders()
            .set('Accept-Language', this.translate.currentLang());

        // Sicurezza: La X-Api-Key viene inclusa solo se siamo in ambiente SSR.
        // Nel browser, l'API Key è gestita dal Reverse Proxy/BFF per non esporla nel codice sorgente.
        if (this.ssrApiKey) {
            headers = headers.set('X-Api-Key', this.ssrApiKey);
        }

        // Aggiunge il Bearer Token se l'utente ha effettuato l'accesso.
        if (this.tokenService.isLoggedIn()) {
            headers = headers.set('Authorization', `Bearer ${this.tokenService.token()}`);
        }

        // X-Connection-Id: presente solo se lo stream notifiche è connesso (campanellino attivo).
        // Permette agli endpoint di notificare "questa scheda" senza che il connectionId entri nelle
        // loro firme. Assente in SSR e quando le notifiche non sono attive → il backend riceve null.
        const connectionId = this.connection.id();
        if (connectionId) {
            headers = headers.set('X-Connection-Id', connectionId);
        }

        // Merge di eventuali header aggiuntivi passati come argomento.
        if (aggiunte) {
            for (const key in aggiunte) {
                headers = headers.set(key, aggiunte[key]);
            }
        }

        return headers;
    }
}
