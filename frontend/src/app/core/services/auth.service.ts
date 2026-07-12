import { computed, inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { LoginRequest } from '../dto/auth.dto';
import { SessionInfo } from '../dto/session.dto';
import { ApiError } from '../engine/services/base-api.service';
import { TranslateService } from '../engine/services/translate.service';
import { TokenService } from '../engine/services/token.service';

/** Facciata dell'autenticazione: coordina le chiamate API e lo stato nel TokenService. */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly api = inject(ApiService);
    private readonly tokenService = inject(TokenService);
    private readonly translate = inject(TranslateService);

    // Proxy verso le proprietà reattive del TokenService
    readonly isLoggedIn = this.tokenService.isLoggedIn;
    readonly token = this.tokenService.token;

    /**
     * Dettagli di sessione decodificati dal token, tipizzati col contratto del progetto.
     * `null` se non loggati. Reattivo: si aggiorna a login/logout.
     */
    readonly session = computed(() => this.tokenService.session<SessionInfo>());

    /**
     * Login: la chiamata è `silent`, l'errore torna come `ApiError` e `mapLoginError` lo traduce per
     * il form in base allo stato HTTP. Successo → salva il token e ritorna { valid: true }.
     */
    async login(request: LoginRequest): Promise<{ valid: boolean; error?: string }> {
        try {
            const result = await this.api.login(request.username, request.pwd);

            // Se lo storage del token fallisce (es. token già scaduto dal server)
            if (result.valid && result.token && this.tokenService.store(result.token)) {
                return { valid: true };
            }
            return { valid: false, error: this.translate.translate('loginErroreGenerico') };
        } catch (err) {
            return { valid: false, error: this.mapLoginError(err) };
        }
    }

    /** Traduce un ApiError di login nel messaggio da mostrare inline nel form. */
    private mapLoginError(err: unknown): string {
        if (err instanceof ApiError) {
            switch (err.status) {
                case 401:
                    return this.translate.translate('loginErroreGenerico');
                case 429:
                    return this.translate.translate('errore429Descrizione');
                case 503:
                case 404:
                case 0:
                    return this.translate.translate('loginServizioNonDisponibile');
            }
        }
        return this.translate.translate('erroreImprevisto');
    }

    /** Termina la sessione dell'utente. */
    logout(): void {
        // TODO (revoca lato server): il JWT è stateless — azzerarlo sul client non lo invalida sul
        // backend (valido fino a exp). Per revoca immediata servirebbe una denylist server-side.
        // await this.api.logout();

        this.tokenService.clear();
    }

    /** Carica il token salvato precedentemente in sessionStorage. */
    restoreSession(): void {
        this.tokenService.restore();
    }
}
