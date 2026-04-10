// Lettura condivisa della x-api-key per i proxy del dev server Angular
// (proxy.local.conf.cjs e proxy.docker.conf.cjs): un solo posto implementa
// la catena di candidati, identica a quella di server-env.ts.
const { readFileSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

// Primo Security.ApiKeys[0] trovato lungo la catena di candidati del file dato.
// Catena: GLOBAL_SETTINGS_PATH (Docker, solo per il file base), cwd e cartella
// del proxy (dev locale: cwd/__dirname = frontend/, il file è in ../).
function apiKeyFrom(filename, withEnvPath) {
    const candidates = [
        withEnvPath ? process.env.GLOBAL_SETTINGS_PATH : null,
        resolve(process.cwd(), filename),
        join(__dirname, filename),
        join(__dirname, '..', filename),
    ].filter(Boolean);

    for (const p of candidates) {
        try {
            if (existsSync(p)) {
                const key = JSON.parse(readFileSync(p, 'utf-8'))?.Security?.ApiKeys?.[0];
                if (key) return key;
            }
        } catch { /* file illeggibile: prova il prossimo candidato */ }
    }
    return null;
}

// .local.json (segreti, dev) ha la precedenza su global-settings.json; 'frontend' è
// l'ultimo fallback coerente col default del backend. In Docker il .local non esiste
// (i segreti sono già fusi nel global-settings.json montato): la catena lo salta da sola.
function readApiKey() {
    return apiKeyFrom('global-settings.local.json', false)
        ?? apiKeyFrom('global-settings.json', true)
        ?? 'frontend';
}

module.exports = { readApiKey };
