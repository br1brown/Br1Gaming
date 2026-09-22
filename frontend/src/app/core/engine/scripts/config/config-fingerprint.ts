import { createHash } from 'node:crypto';
import type { GlobalSettings } from '../../global-settings.types';

/** Impronta stabile delle sole sezioni di global-settings.json che finiscono in environment.ts
 *  (project/Localization/site) — scritta in `configFingerprint` da generate-statics.ts, ricalcolata
 *  al boot da server.ts per accorgersi di un `ng serve` senza rigenerare gli statici dopo una
 *  modifica. Ristretta a queste tre sezioni apposta: un global-settings.local.json che tocca solo
 *  segreti (es. ApiConfig.Keys) non deve far scattare falsi positivi lato server. */
export function fingerprintIdentitySections(settings: Pick<GlobalSettings, 'project' | 'Localization' | 'site'>): string {
    const { project, Localization, site } = settings;
    const stable = JSON.stringify({ project, Localization, site });
    return createHash('sha1').update(stable).digest('hex').slice(0, 12);
}
