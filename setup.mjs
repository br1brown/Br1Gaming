#!/usr/bin/env node
/**
 * setup.mjs — Inizializza un nuovo progetto a partire dal template Br1WebEngine.
 *
 * Uso:
 *   node setup.mjs "Nome Progetto"
 *   node setup.mjs          ← chiede il nome in modo interattivo
 *
 * Cosa fa:
 *   1. Imposta project.name in global-settings.json (file committabile: identità del progetto)
 *   2. Crea global-settings.local.json (gitignored) con pubblicazione (porte/deploy) e i
 *      SEGRETI generati (SecretKey JWT + API key)
 *   3. Rinomina gli identificatori npm/SW generici "app" → slug del prodotto
 *      (frontend/package.json, frontend/ngsw-config.json)
 *   4. Rinomina App.sln → NomeProgetto.sln
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// ── Utilità ────────────────────────────────────────────────────────────────

function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, answer => {
        rl.close();
        resolve(answer.trim());
    }));
}

/**
 * "Mercatino App" → "mercatino-app"
 * "MyCoolSite"    → "mycoolsite"
 */
function toSlug(s) {
    return s.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * "mercatino app" → "MercatinoApp"
 * "my-cool-site"  → "MyCoolSite"
 */
function toPascal(s) {
    return s.trim()
        .split(/[\s\-_]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
}

function editFile(filePath, transform) {
    if (!existsSync(filePath)) {
        console.warn(`  ⚠  non trovato: ${filePath}`);
        return false;
    }
    const before = readFileSync(filePath, 'utf-8');
    const after = transform(before);
    if (before === after) {
        console.log(`  =  già aggiornato: ${filePath}`);
        return false;
    }
    writeFileSync(filePath, after, 'utf-8');
    console.log(`  ✓  aggiornato: ${filePath}`);
    return true;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n──────────────────────────────────────────');
    console.log(' Setup progetto da template Br1WebEngine');
    console.log('──────────────────────────────────────────\n');

    const rawName = process.argv.slice(2).join(' ').trim() || await ask('Nome del progetto (es. MercatinoApp): ');

    if (!rawName) {
        console.error('Errore: nome non fornito.');
        process.exit(1);
    }

    const displayName = rawName.trim();        // "Mercatino App"  → mostrato all'utente
    const pascalName  = toPascal(rawName);     // "MercatinoApp"   → per il file .sln
    const slugName    = toSlug(rawName);       // "mercatino-app"  → COMPOSE_PROJECT_NAME

    console.log(`\n  Nome visualizzato : ${displayName}`);
    console.log(`  Nome file .sln    : ${pascalName}.sln`);
    console.log(`  COMPOSE_PROJECT_NAME: ${slugName}`);
    console.log('');

    // ── 1. Nome del progetto in global-settings.json (file committabile) ──
    // L'identità (nome, versione, lingue, config di sito) vive qui ed è versionabile dal figlio.
    editFile(
        join(ROOT, 'global-settings.json'),
        // Primo "name" del file = project.name.
        src => src.replace(/("name"\s*:\s*)"[^"]*"/, `$1${JSON.stringify(displayName)}`)
    );

    // ── 2. global-settings.local.json: pubblicazione + segreti generati (gitignored) ──
    // Porte, dominio, CORS e le chiavi (SecretKey JWT, ApiKeys) vivono SOLO qui, fuori dal repo.
    const localPath = join(ROOT, 'global-settings.local.json');
    if (existsSync(localPath)) {
        console.log('  =  global-settings.local.json già presente — non sovrascritto');
    } else {
        const local = {
            $schema: './global-settings.schema.json',
            frontend: { hostname: '', port: 3000 },
            backend: { public: false, publicPort: null },
            Security: {
                ApiKeys: [randomBytes(32).toString('base64')],
                CorsOrigins: [],
                BehindProxy: false,
                Token: { SecretKey: randomBytes(48).toString('base64') },
            },
        };
        writeFileSync(localPath, JSON.stringify(local, null, 2) + '\n', 'utf-8');
        console.log('  ✓  creato global-settings.local.json (porte/deploy + SecretKey JWT e API key generate)');
    }

    // ── 3. Nomi npm "app" → slug del prodotto ────────────────────────────
    // Identificatori npm/SW generici: rinominati così non resta "app" in giro.
    // Non tocco i path di build interni (dist/app, DIST_PATH): non sono il nome del prodotto.
    editFile(
        join(ROOT, 'frontend/package.json'),
        src => src.replace(/("name"\s*:\s*)"app"/, `$1"${slugName}"`)
    );
    editFile(
        join(ROOT, 'frontend/ngsw-config.json'),
        src => src.replace(/("name"\s*:\s*)"app"/, `$1"${slugName}"`)
    );

    // ── 4. Rinomina App.sln ──────────────────────────────────────────────
    const slnOld = join(ROOT, 'App.sln');
    const slnNew = join(ROOT, `${pascalName}.sln`);

    if (!existsSync(slnOld) && existsSync(slnNew)) {
        console.log(`  =  .sln già rinominato: ${pascalName}.sln`);
    } else if (!existsSync(slnOld)) {
        console.warn(`  ⚠  non trovato: App.sln`);
    } else if (existsSync(slnNew)) {
        console.warn(`  ⚠  esiste già ${pascalName}.sln — App.sln non rinominato`);
    } else {
        renameSync(slnOld, slnNew);
        console.log(`  ✓  rinominato: App.sln → ${pascalName}.sln`);
    }

    // ── Promemoria per il resto ──────────────────────────────────────────
    console.log(`
──────────────────────────────────────────
 ✅  Completato!

 Identità e config del progetto in global-settings.json (committabile). Da personalizzare lì:
   • project.version → versione iniziale (se diversa da 1.0.0)
   • Localization    → lingue del sito
   • site.description / site.colorTema → descrizione e colore del brand

 Pubblicazione e segreti in global-settings.local.json (gitignored, già con SecretKey + API key):
   • frontend.hostname    → dominio del sito (es. miodominio.it)
   • frontend.port        → porta esposta dal container (se diversa da 3000)
   • Security.CorsOrigins → ["https://miodominio.it"] se si usa un hostname
   • Security.BehindProxy → true se dietro un reverse proxy
──────────────────────────────────────────
`);
}

main().catch(err => {
    console.error('\nErrore durante il setup:', err.message);
    process.exit(1);
});
