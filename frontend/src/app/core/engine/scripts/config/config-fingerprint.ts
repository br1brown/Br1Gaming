import { createHash } from 'node:crypto';
import type { GlobalSettings } from '../../global-settings.types';

/**
 * Impronta stabile delle sole sezioni di global-settings.json che finiscono in environment.ts
 * (project / Localization / site) — condivisa da:
 * - scripts/build/generate-statics.ts, che la scrive nel campo `configFingerprint` di environment.ts;
 * - server/server.ts, che la ricalcola al boot dal file vero e la confronta con quella
 *   embeddata nel bundle, per accorgersi se qualcuno ha lanciato `ng serve` senza rigenerare
 *   gli statici dopo una modifica a global-settings.json (vedi commento in server.ts).
 *
 * Ristretta a queste tre sezioni apposta: un global-settings.local.json che tocca solo segreti
 * (la convenzione documentata, es. ApiKeys) non deve far scattare falsi positivi lato server
 * (che legge il file fuso con .local, a differenza di generate-statics.ts).
 */
export function fingerprintIdentitySections(settings: Pick<GlobalSettings, 'project' | 'Localization' | 'site'>): string {
    const { project, Localization, site } = settings;
    const stable = JSON.stringify({ project, Localization, site });
    return createHash('sha1').update(stable).digest('hex').slice(0, 12);
}
