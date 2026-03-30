import { InjectionToken, makeStateKey } from '@angular/core';

/** Sezione `Custom` di global-settings.json: valori liberi di progetto (feature flag, ID, soglie). */
export type AppCustom = Record<string, unknown>;

/** Chiave TransferState con cui l'SSR passa `Custom` al browser. */
export const CUSTOM_STATE_KEY = makeStateKey<AppCustom>('br1_custom');

/**
 * Sezione `Custom` esposta al frontend, browser incluso (serializzata via TransferState in SSR,
 * riletta in idratazione).
 *
 * ⚠️ Si popola SOLO se la rotta è renderizzata dal server. Il `TransferState` viene emesso
 * dall'SSR: su una rotta `renderMode: 'client'` (incluse le pagine `requiresAuth`) NON c'è, quindi
 * al caricamento diretto/refresh `inject(APP_CUSTOM)` torna `{}`. Se una pagina deve leggere
 * `Custom` lato client, tienila `renderMode: 'server'` (la logica browser resta in `afterNextRender`).
 *
 * ⚠️ `Custom` è committabile ed esposto al client: non metterci segreti (vivono in
 * `global-settings.local.json`; vi finiscono comunque via merge/`TransferState` se servono al client).
 * @example const trackingId = inject(APP_CUSTOM)['Analytics']?.['TrackingId'];
 */
export const APP_CUSTOM = new InjectionToken<AppCustom>('APP_CUSTOM', {
    providedIn: 'root',
    factory: () => ({}),
});
