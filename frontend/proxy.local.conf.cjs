// Proxy del dev server Angular (sviluppo locale, backend su localhost:5000).
// La x-api-key viene letta da global-settings.json + override global-settings.local.json
// (i segreti) — stessa sorgente di verità e stesso deep-merge del backend e del Node SSR,
// così non resta hardcodata e disallineata. In dev locale la chiave vive in .local.json.
const { readFileSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

// Primo Security.ApiKeys[0] trovato lungo la catena di candidati del file dato.
// Stessa catena di server-env.ts: GLOBAL_SETTINGS_PATH (Docker, solo per il file base),
// cwd e cartella del file (dev locale: cwd/__dirname = frontend/, il file è in ../).
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
// l'ultimo fallback coerente col default del backend.
function readApiKey() {
    return apiKeyFrom('global-settings.local.json', false)
        ?? apiKeyFrom('global-settings.json', true)
        ?? 'frontend';
}

module.exports = {
    '/api': {
        target: 'http://localhost:5000',
        secure: false,
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
        headers: { 'x-api-key': readApiKey() },
    },
};
