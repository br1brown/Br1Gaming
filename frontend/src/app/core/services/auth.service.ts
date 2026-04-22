import { computed, inject, Injectable, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiService } from './api.service';

/**
 * Conserva il token JWT: unica sorgente di verità sulla sessione attiva.
 * Scritto da AuthService dopo login/logout, letto da ApiService per l'header Bearer.
 * Separato per evitare la dipendenza circolare AuthService ↔ ApiService.
 */
@Injectable({ providedIn: 'root' })
export class TokenService implements OnDestroy {
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly _token = signal<string | null>(null);
    private expirationTimer: ReturnType<typeof setTimeout> | null = null;

    readonly token = this._token.asReadonly();
    readonly isLoggedIn = computed(() => this._token() !== null);

    store(token: string): boolean {
        const expiration = this.getExpirationTime(token);
        if (expiration === null || expiration <= Date.now()) {
            this.clear();
            return false;
        }
        this._token.set(token);
        if (this.isBrowser) sessionStorage.setItem('bearerToken', token);
        this.scheduleExpiration(expiration);
        return true;
    }

    clear(): void {
        this._token.set(null);
        if (this.expirationTimer !== null) {
            clearTimeout(this.expirationTimer);
            this.expirationTimer = null;
        }
        if (this.isBrowser) sessionStorage.removeItem('bearerToken');
    }

    restore(): void {
        if (!this.isBrowser) return;
        const token = sessionStorage.getItem('bearerToken');
        if (token) this.store(token);
    }

    ngOnDestroy(): void {
        this.clear();
    }

    private scheduleExpiration(expiration: number): void {
        if (!this.isBrowser) return;
        if (this.expirationTimer !== null) clearTimeout(this.expirationTimer);

        const delay = expiration - Date.now();
        if (delay <= 0) { this.clear(); return; }

        const nextDelay = Math.min(delay, 2147483647);
        this.expirationTimer = setTimeout(() => {
            if (expiration <= Date.now()) { this.clear(); return; }
            this.scheduleExpiration(expiration);
        }, nextDelay);
    }

    private getExpirationTime(token: string): number | null {
        const payloadSegment = token.split('.')[1];
        if (!payloadSegment) return null;
        try {
            const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized.padEnd(
                normalized.length + ((4 - (normalized.length % 4)) % 4), '='
            );
            const payload = JSON.parse(atob(padded)) as { exp?: unknown };
            return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
        } catch {
            return null;
        }
    }
}

/**
 * Gestisce login, logout e stato della sessione utente.
 *
 * Flusso: password → POST /auth/login → token JWT → TokenService (sessionStorage).
 * Nel template base il backend lascia il login come placeholder e non emette token
 * finché non viene implementata la verifica reale delle credenziali.
 *
 * Per proteggere una pagina: requiresAuth: true nella route in app.routes.ts.
 * Sessione: sessionStorage (sopravvive al refresh, si cancella chiudendo la tab).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly api = inject(ApiService);
    private readonly tokenService = inject(TokenService);

    readonly isLoggedIn = this.tokenService.isLoggedIn;
    readonly token = this.tokenService.token;

    async login(password: string): Promise<{ valid: boolean; error?: string }> {
        const result = await this.api.login(password);
        if (result.valid && result.token) {
            if (this.tokenService.store(result.token)) return { valid: true };
            return { valid: false, error: 'Token non valido o scaduto.' };
        }
        return { valid: result.valid, error: result.error };
    }

    logout(): void {
        this.tokenService.clear();
    }

    restoreSession(): void {
        this.tokenService.restore();
    }
}
