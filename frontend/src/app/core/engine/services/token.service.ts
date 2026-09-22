import { computed, inject, Injectable, isDevMode, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Conserva il token JWT: unica sorgente di verità sulla sessione attiva. Modulo foglia a sé (nessun import verso api/auth/base-api), separato da AuthService per non chiudere il ciclo api → base-api → auth → api. */
@Injectable({ providedIn: 'root' })
export class TokenService implements OnDestroy {
    // Identifica se il codice sta girando nel browser o sul server (SSR)
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    // Signal reattivo per lo stato del token
    private readonly _token = signal<string | null>(null);

    // Riferimento al timer per il logout automatico alla scadenza del token
    private expirationTimer: ReturnType<typeof setTimeout> | null = null;

    // Esposizione pubblica dei dati in sola lettura
    readonly token = this._token.asReadonly();
    readonly isLoggedIn = computed(() => this._token() !== null);

    /** Rilegge il payload di sessione dal claim "session" del JWT, tipizzato dal progetto (`tokenService.session<SessionInfo>()`, rispecchia il record C#). Reattivo: legge il signal del token. */
    session<T>(): T | null {
        const token = this._token();
        if (!token) return null;
        const raw = this.decodePayload(token)?.['session'];
        if (typeof raw !== 'string') return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }

    /**
     * Salva il token, ne verifica la validità e avvia il timer di scadenza.
     * @param token Stringa JWT ricevuta dal backend.
     */
    store(token: string): boolean {
        const expiration = this.getExpirationTime(token);

        // Se il token è malformato o già scaduto, annulla l'operazione
        if (expiration === null || expiration <= Date.now()) {
            this.clear();
            return false;
        }

        this._token.set(token);

        // sessionStorage: il login resta al refresh, sparisce alla chiusura tab. Unico accesso
        // diretto al Web Storage fuori da CookieConsentService (allowlist ESLint): eccezione
        // deliberata, accoppiarlo al consenso reintrodurrebbe il ciclo api→base-api→auth→api —
        // comunque censito in ENGINE_COOKIE_MAP, compare in policy ed è escluso dalla pulizia.
        if (this.isBrowser) sessionStorage.setItem('bearerToken', token);

        this.scheduleExpiration(expiration);
        return true;
    }

    /** Rimuove il token, pulisce i timer e svuota il SessionStorage. */
    clear(): void {
        this._token.set(null);
        if (this.expirationTimer !== null) {
            clearTimeout(this.expirationTimer);
            this.expirationTimer = null;
        }
        if (this.isBrowser) sessionStorage.removeItem('bearerToken');
    }

    /** Tenta di ripristinare una sessione esistente (es. dopo F5). */
    restore(): void {
        if (!this.isBrowser) return;
        const token = sessionStorage.getItem('bearerToken');
        if (token) this.store(token);
    }

    /** Lifecycle hook: assicura che i timer vengano distrutti se il servizio muore. */
    ngOnDestroy(): void {
        this.clear();
    }

    /**
     * Pianifica il logout automatico.
     * Gestisce anche il limite massimo di setTimeout di JS (circa 24 giorni).
     */
    private scheduleExpiration(expiration: number): void {
        if (!this.isBrowser) return; // I timer di scadenza non servono in SSR
        if (this.expirationTimer !== null) clearTimeout(this.expirationTimer);

        const delay = expiration - Date.now();
        if (delay <= 0) { this.clear(); return; }

        // Il delay massimo supportato da setTimeout è un intero a 32 bit
        const nextDelay = Math.min(delay, 2147483647);
        this.expirationTimer = setTimeout(() => {
            if (expiration <= Date.now()) {
                this.clear();
                return;
            }
            // Se il token scade tra molto tempo, ri-schedula ricorsivamente
            this.scheduleExpiration(expiration);

        }, nextDelay);
    }

    /**
     * Decodifica il payload del JWT (Base64) per estrarre il campo 'exp'.
     * @returns Timestamp di scadenza in millisecondi o null.
     */
    private getExpirationTime(token: string): number | null {
        const payload = this.decodePayload(token) as { exp?: unknown } | null;
        // Il campo 'exp' nei JWT è solitamente in secondi, lo convertiamo in ms
        return payload && typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    }

    /**
     * Decodifica il payload (parte centrale) di un JWT da Base64URL a oggetto.
     * @returns L'oggetto del payload, o null se il token è malformato.
     */
    private decodePayload(token: string): Record<string, unknown> | null {
        const payloadSegment = token.split('.')[1];
        if (!payloadSegment) return null;
        try {
            // Normalizzazione Base64URL in Base64 standard + padding
            const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized.padEnd(
                normalized.length + ((4 - (normalized.length % 4)) % 4), '='
            );
            // atob decodifica la stringa Base64
            return JSON.parse(atob(padded)) as Record<string, unknown>;
        } catch (err) {
            // Token corrotto: fail closed. In dev logghiamo per diagnosi.
            if (isDevMode()) console.warn('[auth] decoding del token JWT fallito', err);
            return null;
        }
    }
}
