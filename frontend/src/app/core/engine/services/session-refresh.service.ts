import { Injectable } from '@angular/core';
import { ApiError, BaseApiService } from './base-api.service';

/** Esito del rinnovo: `ok` sessione prolungata, `limit` tetto di durata raggiunto (serve un nuovo login), `error` il resto (rete, server). */
export type SessionRefreshOutcome = 'ok' | 'limit' | 'error';

/** Rinnovo della sessione (`POST /session/refresh`): il «Resta connesso» dell'avviso di scadenza. Un token nuovo con gli stessi dati, una nuova scadenza,
 *  mai oltre `ExpirationSeconds × 9,5` dal login. Il token nuovo sostituisce il vecchio in `TokenService`, e chi ne ascolta la scadenza si ripianifica da solo. */
@Injectable({ providedIn: 'root' })
export class SessionRefreshService extends BaseApiService {
    async refresh(): Promise<SessionRefreshOutcome> {
        try {
            const { token } = await this.api_post<{ token: string }>('session/refresh', {}, { silent: true });
            return this.tokenService.store(token) ? 'ok' : 'error';
        } catch (err) {
            return err instanceof ApiError && err.status === 403 ? 'limit' : 'error';
        }
    }
}
