/**
 * Deep-merge usato per fondere global-settings.json con l'override opzionale
 * global-settings.local.json — condiviso da:
 * - scripts/build/generate-statics.ts, che lo usa a build-time per calcolare project/Localization/site
 *   (compreso il configFingerprint scritto in environment.ts, vedi config-fingerprint.ts);
 * - server/server-env.ts, che lo usa al boot per la configurazione runtime.
 *
 * Prima della build-time non lo usava (leggeva solo il file base): un progetto che avesse messo
 * identità/tema dentro .local.json (contro la convenzione — lì vivono solo i segreti — ma non
 * impedito tecnicamente) vedeva scattare l'avviso "environment.ts disallineato" a ogni riavvio,
 * pure appena dopo un generate:statics pulito, perché build e runtime leggevano fonti diverse.
 * Condividere la STESSA funzione (non solo la stessa logica riscritta due volte) è ciò che
 * garantisce che build-time e runtime restino sempre d'accordo su cosa significa "fondere".
 *
 * Semantica: oggetti fusi ricorsivamente, array e scalari sostituiti (quella di br1-config.sh).
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
