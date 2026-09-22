import { InjectionToken, makeStateKey } from '@angular/core';

/** Sezione `Custom` di global-settings.json: valori liberi di progetto (feature flag, ID, soglie). */
export type AppCustom = Record<string, unknown>;

/** Chiave TransferState con cui l'SSR passa `Custom` al browser. */
export const CUSTOM_STATE_KEY = makeStateKey<AppCustom>('br1_custom');

/**
 * Sezione `Custom` esposta al frontend (serializzata via TransferState in SSR, riletta in
 * idratazione). Si popola SOLO se la rotta è renderizzata dal server: su `renderMode: 'client'`
 * (incluse le pagine `requiresAuth`) `inject(APP_CUSTOM)` torna `{}` — tieni `renderMode: 'server'`
 * se una pagina deve leggerla lato client. Committabile ed esposto al client: niente segreti qui.
 * @example const trackingId = inject(APP_CUSTOM)['Analytics']?.['TrackingId'];
 */
export const APP_CUSTOM = new InjectionToken<AppCustom>('APP_CUSTOM', {
    providedIn: 'root',
    factory: () => ({}),
});
