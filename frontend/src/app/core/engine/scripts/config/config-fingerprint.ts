import { createHash } from 'node:crypto';
import type { GlobalSettings } from '../../global-settings.types';

/** Impronta delle sezioni di global-settings.json che finiscono in environment.ts (project/Localization/
 *  site/Features): server.ts la ricalcola al boot per accorgersi di statici non rigenerati. Solo queste
 *  sezioni, così un .local che tocca solo segreti non dà falsi positivi. */
export function fingerprintIdentitySections(settings: Pick<GlobalSettings, 'project' | 'Localization' | 'site' | 'Features'>): string {
    const { project, Localization, site, Features } = settings;
    const stable = JSON.stringify({ project, Localization, site, Features });
    return createHash('sha1').update(stable).digest('hex').slice(0, 12);
}
