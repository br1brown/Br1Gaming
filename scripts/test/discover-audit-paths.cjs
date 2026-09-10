#!/usr/bin/env node
'use strict';

// Unisce le pagine SSR statiche da /health con le pagine dinamiche da /internal/dynamic-audit-paths
// (già filtrate alla sola lingua di default dal server, raggruppate per pageType), campionando
// ogni gruppo INDIPENDENTEMENTE: un pageType con mille entità (es. un blog) non deve "rubare"
// campione a uno con cinque entità (es. la demo social-feed) solo perché ne genera di più — sono
// due componenti diversi, ciascuno con un proprio profilo di accessibilità/performance da
// verificare a campione. Vedi routes/dynamic-sitemap.ts per la definizione dell'endpoint.
// Uso: node discover-audit-paths.cjs BASE_URL MAX_DYNAMIC_PER_COMPONENTE

const http = require('http');
const https = require('https');

const [baseUrlArg, maxDynamicArg] = process.argv.slice(2);
if (!baseUrlArg) {
    console.error('Uso: discover-audit-paths.cjs BASE_URL MAX_DYNAMIC_PER_COMPONENTE');
    process.exit(2);
}

let baseUrl;
try {
    baseUrl = new URL(baseUrlArg);
} catch {
    console.error(`[audit-paths] BASE_URL non valido: "${baseUrlArg}" (serve URL assoluto, es. http://localhost:3000)`);
    process.exit(2);
}
const maxDynamic = Math.max(0, Number(maxDynamicArg) || 0);
const client = baseUrl.protocol === 'https:' ? https : http;

function getJson(path) {
    return new Promise((resolve, reject) => {
        const request = client.get(new URL(path, baseUrl), response => {
            let raw = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { raw += chunk; });
            response.on('end', () => {
                if ((response.statusCode ?? 500) >= 400) return reject(new Error(`${path} -> HTTP ${response.statusCode}`));
                try { resolve(JSON.parse(raw)); } catch (err) { reject(new Error(`${path} -> JSON non valido: ${err.message}`)); }
            });
        });
        request.setTimeout(30_000, () => request.destroy(new Error(`${path} -> timeout`)));
        request.on('error', reject);
    });
}

// Distribuisce il campione nell'ordine stabile del gruppo: non finisce per controllare soltanto
// le prime entità (es. sempre "facebook, instagram, ..." e mai le ultime dell'elenco).
function sampleEvenly(paths, limit) {
    if (limit === 0 || paths.length <= limit) return paths;
    return Array.from({ length: limit }, (_, index) => paths[Math.floor(index * paths.length / limit)]);
}

(async () => {
    const [health, dynamicGroups] = await Promise.all([
        getJson('/health'),
        getJson('/internal/dynamic-audit-paths'),
    ]);
    if (!Array.isArray(health.auditPaths)) throw new Error('/health non contiene auditPaths');

    const staticPaths = health.auditPaths;
    const staticSet = new Set(staticPaths);

    const selectedDynamic = [];
    const groupSummary = [];
    for (const [pageType, groupPaths] of Object.entries(dynamicGroups)) {
        // Filtra le pagine già incluse in staticPaths per evitare duplicati.
        const candidates = groupPaths.filter(path => !staticSet.has(path));
        const selected = sampleEvenly(candidates, maxDynamic);
        selectedDynamic.push(...selected);
        groupSummary.push(`${pageType}: ${selected.length}/${candidates.length}`);
    }

    const paths = [...new Set([...staticPaths, ...selectedDynamic])];

    console.error(`[audit-paths] statiche/SSR: ${staticPaths.length}; componenti dinamici: ${Object.keys(dynamicGroups).length} (${groupSummary.join(', ') || 'nessuno'}); totale: ${paths.length}`);
    paths.forEach(path => console.log(path));
})().catch(error => {
    console.error(`[audit-paths] ${error.message}`);
    process.exit(1);
});
