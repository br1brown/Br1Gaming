/**
 * Deep-merge usato per fondere global-settings.json con l'override opzionale
 * global-settings.local.json. 
 * Condiviso tra build-time (`generate-statics.ts`) e runtime (`server-env.ts`) 
 * per garantire una semantica unificata.
 *
 * Semantica: oggetti fusi ricorsivamente, array e scalari sostituiti dal valore di override.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function deepMergeSettings(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...base };
    for (const k of Object.keys(over)) {
        out[k] = isPlainObject(out[k]) && isPlainObject(over[k])
            ? deepMergeSettings(out[k] as Record<string, unknown>, over[k] as Record<string, unknown>)
            : over[k];
    }
    return out;
}
