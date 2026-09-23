/** Funzioni opzionali di global-settings.json (§ Features): lettura unica per build e server SSR. */

export const FEATURE_KEYS = ['Login', 'PublicLogin', 'Mail', 'ErrorReporting', 'Forms'] as const;
type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Forma scritta in environment.ts (`environment.features`). */
export interface ResolvedFeatures {
    login: boolean;
    publicLogin: boolean;
    mail: boolean;
    errorReporting: boolean;
    forms: boolean;
}

function resolve(flags: Partial<Record<FeatureKey, boolean>>): ResolvedFeatures {
    return {
        // PublicLogin vince: acceso, il login c'è anche con Login spento o assente.
        login: flags.Login === true || flags.PublicLogin === true,
        publicLogin: flags.PublicLogin === true,
        mail: flags.Mail === true,
        errorReporting: flags.ErrorReporting === true,
        forms: flags.Forms === true,
    };
}

/** Build: `Features` esattamente come da schema (nome, chiavi note, soli booleani), altrimenti
 *  errore. Il backend .NET è più tollerante (ignora maiuscole/minuscole, accetta "true" come
 *  stringa): una forma che il frontend leggerebbe diversamente non deve arrivare a compilazione. */
export function readFeaturesStrict(settings: Record<string, unknown>): ResolvedFeatures {
    const errors: string[] = [];
    for (const key of Object.keys(settings)) {
        if (key !== 'Features' && key.toLowerCase() === 'features') errors.push(`chiave "${key}": si scrive "Features"`);
    }
    const section = settings['Features'];
    if (section === undefined) {
        if (errors.length) throw new Error(`[features] global-settings.json: ${errors.join('; ')}`);
        return resolve({});
    }
    if (typeof section !== 'object' || section === null || Array.isArray(section)) {
        throw new Error('[features] global-settings.json: "Features" deve essere un oggetto di booleani.');
    }
    for (const [key, value] of Object.entries(section)) {
        if (!(FEATURE_KEYS as readonly string[]).includes(key)) errors.push(`Features.${key} non esiste (chiavi: ${FEATURE_KEYS.join(', ')})`);
        else if (typeof value !== 'boolean') errors.push(`Features.${key} deve essere true o false, non ${JSON.stringify(value)}`);
    }
    if (errors.length) throw new Error(`[features] global-settings.json: ${errors.join('; ')}`);
    return resolve(section as Partial<Record<FeatureKey, boolean>>);
}

/** Server SSR: legge `Features` come lo legge il backend .NET dallo stesso file montato (chiavi senza
 *  distinzione di maiuscole, "true"/"false" anche come stringhe), per confrontarlo con quanto compilato. */
export function readFeaturesLikeBackend(settings: Record<string, unknown>): ResolvedFeatures {
    const sectionKey = Object.keys(settings).find(k => k.toLowerCase() === 'features');
    const section = sectionKey ? settings[sectionKey] : undefined;
    const flags: Partial<Record<FeatureKey, boolean>> = {};
    if (section && typeof section === 'object' && !Array.isArray(section)) {
        for (const [key, value] of Object.entries(section)) {
            const name = FEATURE_KEYS.find(k => k.toLowerCase() === key.toLowerCase());
            if (name) flags[name] = value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
        }
    }
    return resolve(flags);
}
