#!/usr/bin/env node
'use strict';

// Motore condiviso di audit live: Pa11y (WCAG 2.1 AA) e Lighthouse (performance/SEO).
// Uso: node live-audit.mjs BASE_URL [PATH ...]

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, appendFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = join(SCRIPT_DIR, '..', '..', 'frontend');

const isTTY = process.stdout.isTTY;
const paint = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const BOLD = (s) => paint('1', s);
const log = {
    info: (msg) => console.log(`  ${BOLD('[info]')} ${msg}`),
    ok: (msg) => console.log(`  ${paint('32', 'OK')} ${msg}`),
    warn: (msg) => console.log(`  ${paint('33', 'WARN')} ${msg}`),
    fail: (msg) => console.error(`  ${paint('31', 'ERR')} ${msg}`),
};

// ─── risoluzione esplicita dei pacchetti di frontend/node_modules ─────────────────────
const requireFromFrontend = createRequire(join(FRONTEND_DIR, 'package.json'));

async function loadFrontendModule(pkg) {
    let resolved;
    try {
        resolved = requireFromFrontend.resolve(pkg);
    } catch {
        return null;
    }
    const mod = await import(pathToFileURL(resolved).href);
    return mod.default ?? mod;
}

// ─── Scoperta path ───────────────────────────────────────────────────────────
function discoverPaths(baseUrl, maxDynamic) {
    const result = spawnSync(
        process.execPath,
        [join(SCRIPT_DIR, 'discover-audit-paths.cjs'), baseUrl, String(maxDynamic)],
        { encoding: 'utf8' }
    );
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) return null;
    return result.stdout.split('\n').filter((line) => line.length > 0);
}

// ─── Pa11y: pool a concorrenza limitata sul browser condiviso ────────────────
async function runPool(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    async function pull() {
        while (next < items.length) {
            const i = next++;
            results[i] = await worker(items[i]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, pull));
    return results;
}

async function runA11ySweep(browser, baseUrl, paths, pa11yOptions) {
    const pa11y = await loadFrontendModule('pa11y');
    const cliReporter = await loadFrontendModule('pa11y/lib/reporters/cli');
    if (!pa11y || !cliReporter) return null;

    const timeout = Number(process.env.A11Y_TIMEOUT) || 30000;
    const concurrency = Math.max(1, Number(process.env.A11Y_CONCURRENCY) || 2);

    console.log('');
    console.log(BOLD('══ Accessibilità (Pa11y — WCAG 2.1 AA) ══'));
    log.info(`Concorrenza: ${concurrency} pagine in parallelo (A11Y_CONCURRENCY per cambiarla)`);

    async function auditPage(raw) {
        const path = '/' + raw.replace(/^\/+/, '');
        const url = baseUrl + path;
        const out = [`  Controllo ${paint('1', url)} ...`];
        let failed = false;
        let reason = null;
        let detail;
        try {
            const result = await pa11y(url, { ...pa11yOptions, browser, timeout });
            if (result.issues.length === 0) {
                out.push(`  ${paint('32', 'OK')} Nessuna violazione WCAG 2.1 AA — ${path}`);
                detail = { ok: true };
            } else {
                out.push(cliReporter.results(result));
                out.push(`  ${paint('31', 'ERR')} Violazioni WCAG 2.1 AA — ${path}`);
                failed = true;
                reason = `${result.issues.length} violazione/i WCAG 2.1 AA`;
                detail = { ok: false, violations: result.issues.map((i) => `${i.message} — ${i.selector}`) };
            }
        } catch (err) {
            out.push(`  ${paint('31', 'ERR')} pa11y non ha completato (${err.message}) — ${path}: NON misurato, tratto come fallimento`);
            failed = true;
            reason = `non misurato: ${err.message}`;
            detail = { ok: false, notMeasured: true, reason: err.message };
        }
        return { out, failed, path, reason, detail };
    }

    const results = await runPool(paths, concurrency, auditPage);
    let failures = 0;
    const failedItems = [];
    const perPage = new Map();
    for (const { out, failed, path, reason, detail } of results) {
        console.log(out.join('\n'));
        console.log('');
        perPage.set(path, detail);
        if (failed) {
            failures++;
            failedItems.push({ path, reason });
        }
    }
    return { failures, total: paths.length, failedItems, perPage };
}

// ─── Lighthouse: seriale con retry sui runtimeError transitori ────────────────
const TRANSIENT_RUNTIME_ERRORS = new Set([
    'NO_NAVSTART', 'NO_FCP', 'NO_LCP', 'PAGE_HUNG', 'TARGET_CRASHED',
    'PROTOCOL_TIMEOUT', 'NO_SPEEDLINE_FRAMES', 'NO_SCREENSHOTS',
]);

function isNoindexPath(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https:') ? https : http;
        let done = false;
        const finish = (val) => { if (!done) { done = true; resolve(val); } };
        const req = client.get(url, (res) => {
            const robots = String(res.headers['x-robots-tag'] || '').toLowerCase();
            finish(robots.includes('noindex'));
            res.resume();
        });
        req.setTimeout(10000, () => { req.destroy(); finish(false); });
        req.on('error', () => finish(false));
    });
}

async function runLighthouseSweep(browser, baseUrl, paths, thresholds) {
    const lighthouse = await loadFrontendModule('lighthouse');
    if (!lighthouse) return null;

    const timeout = Number(process.env.LH_TIMEOUT) || 60000;
    const maxAttempts = 2;

    console.log('');
    console.log(BOLD('══ Performance/best-practices/SEO (Lighthouse) ══'));
    log.info('Seriale per pagina — throttling method "provided", non falsato dalla concorrenza');

    let failures = 0;
    const failedItems = [];
    const perPage = new Map();
    for (const raw of paths) {
        const path = '/' + raw.replace(/^\/+/, '');
        const url = baseUrl + path;
        console.log(`  Controllo ${paint('1', url)} ...`);

        const isNoindex = await isNoindexPath(url);
        // Valutazione categorie: 'seo' viene esclusa dal gating su pagine noindex
        const onlyCategories = ['performance', 'best-practices', 'seo'];

        let attempt = 1;
        let pageResult = 1; // 0 = ok, 1 = fallimento finale
        let pageReason = null;
        let pageDetail;
        while (attempt <= maxAttempts) {
            const page = await browser.newPage();
            let lhr = null;
            try {
                const runnerResult = await lighthouse(url, {
                    throttlingMethod: 'provided',
                    onlyCategories,
                    maxWaitForLoad: timeout,
                }, undefined, page);
                lhr = runnerResult?.lhr ?? null;
            } catch {
                lhr = null;
            } finally {
                await page.close();
            }

            if (!lhr) {
                if (attempt < maxAttempts) {
                    log.warn(`Lighthouse non ha completato — ${path}: ritento (tentativo ${attempt + 1}/${maxAttempts})`);
                    attempt++;
                    continue;
                }
                log.fail(`Lighthouse non ha completato — ${path}: NON misurato, tratto come fallimento`);
                pageResult = 1;
                pageReason = 'non misurato: Lighthouse non ha completato';
                pageDetail = { notMeasuredReason: 'Lighthouse non ha completato' };
                break;
            }

            if (lhr.runtimeError && lhr.runtimeError.code !== 'NO_ERROR') {
                console.error(`    SKIP ${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
                if (TRANSIENT_RUNTIME_ERRORS.has(lhr.runtimeError.code) && attempt < maxAttempts) {
                    log.warn(`Errore Lighthouse transitorio — ${path}: ritento (tentativo ${attempt + 1}/${maxAttempts})`);
                    attempt++;
                    continue;
                }
                log.fail(`Server non raggiungibile / pagina in errore — ${path}: NON misurato, tratto come fallimento`);
                pageResult = 1;
                pageReason = `non misurato: ${lhr.runtimeError.code}`;
                pageDetail = { notMeasuredReason: lhr.runtimeError.code };
                break;
            }

            let pageFailures = 0;
            const failingCategories = [];
            const categoryDetails = [];
            for (const [key, min] of Object.entries(thresholds)) {
                const cat = lhr.categories[key];
                if (!cat) continue;
                const score = Math.round((cat.score ?? 0) * 100);
                const skip = key === 'seo' && isNoindex;
                const pass = skip || score >= min;
                const status = skip ? 'skip' : (pass ? 'ok' : 'fail');
                const tag = skip ? 'SKIP' : (pass ? 'OK  ' : 'FAIL');
                const line = `    ${tag} ${key}: ${score} (min ${min})`;
                if (status === 'fail') console.error(line); else console.log(line);
                categoryDetails.push({ key, score, min, status });
                if (status === 'fail') {
                    pageFailures++;
                    failingCategories.push(`${key}: ${score}<${min}`);
                }
            }
            pageResult = pageFailures > 0 ? 1 : 0;
            pageDetail = { categories: categoryDetails, ok: pageResult === 0 };
            if (pageResult > 0) {
                log.fail(`Budget Lighthouse fallito — ${path}`);
                pageReason = failingCategories.join(', ');
            }
            break;
        }

        perPage.set(path, pageDetail);
        if (pageResult === 0) {
            log.ok(`Budget Lighthouse rispettato — ${path}`);
        } else {
            failures++;
            failedItems.push({ path, reason: pageReason });
        }
        console.log('');
    }

    return { failures, total: paths.length, failedItems, perPage };
}

// ─── Riepilogo per rotta ─────────────────────────────────────────────────────
function buildRouteBlock(url, a11y, lighthouse) {
    const lines = [`Controllato ${url}`];

    if (lighthouse === undefined) {
        lines.push('  —    Lighthouse: pagina fuori campione (LIGHTHOUSE_DYNAMIC_MAX)');
    } else if (lighthouse.notMeasuredReason) {
        lines.push(`  WARN Lighthouse non misurato (${lighthouse.notMeasuredReason})`);
    } else {
        for (const c of lighthouse.categories) {
            const tag = c.status === 'skip' ? 'SKIP' : c.status === 'ok' ? 'OK  ' : 'FAIL';
            lines.push(`  ${tag} ${c.key}: ${c.score} (min ${c.min})`);
        }
        lines.push(`  ${lighthouse.ok ? 'OK' : 'ERR'} Budget Lighthouse ${lighthouse.ok ? 'rispettato' : 'fallito'}`);
    }

    if (a11y === undefined) {
        lines.push('  —    Pa11y: pagina fuori campione (A11Y_DYNAMIC_MAX)');
    } else if (a11y.notMeasured) {
        lines.push(`  ERR  Pa11y non misurato (${a11y.reason})`);
    } else if (a11y.ok) {
        lines.push('  OK   Nessuna violazione WCAG 2.1 AA');
    } else {
        lines.push(`  ERR  ${a11y.violations.length} violazione/i WCAG 2.1 AA:`);
        for (const v of a11y.violations) lines.push(`         - ${v}`);
    }

    return lines.join('\n');
}

// ─── Generazione markdown per GitHub Step Summary ────────────────────────────
function lighthouseCell(category, categories) {
    const c = categories?.find((x) => x.key === category);
    if (!c) return '—';
    const icon = c.status === 'skip' ? '⏭️' : c.status === 'ok' ? '✅' : '❌';
    return `${icon} ${c.score}`;
}

function pa11yCell(a11y) {
    if (a11y === undefined) return '—';
    if (a11y.notMeasured) return '❌ n/m';
    if (a11y.ok) return '✅';
    return `❌ ${a11y.violations.length}`;
}

function buildStepSummaryMarkdown(baseUrl, allRoutePaths, a11yPerPage, lighthousePerPage, thresholds, verdict) {
    const categoryKeys = Object.keys(thresholds); // es. performance, best-practices, seo
    const legendThresholds = categoryKeys.map((k) => `${k} ≥ ${thresholds[k]}`).join(' · ');

    const header = `| Rotta | ${categoryKeys.map((k) => k[0].toUpperCase() + k.slice(1)).join(' | ')} | Pa11y |`;
    const separator = `|---|${categoryKeys.map(() => '---').join('|')}|---|`;

    const rows = [];
    const detailsBlocks = [];
    for (const path of allRoutePaths) {
        const a11y = a11yPerPage.get(path);
        const lighthouse = lighthousePerPage.get(path);
        const lhCells = lighthouse?.notMeasuredReason
            ? categoryKeys.map(() => '❌ n/m')
            : categoryKeys.map((k) => lighthouseCell(k, lighthouse?.categories));
        rows.push(`| \`${path}\` | ${lhCells.join(' | ')} | ${pa11yCell(a11y)} |`);

        const lhFailed = lighthouse && (lighthouse.notMeasuredReason || !lighthouse.ok);
        const a11yFailed = a11y && (a11y.notMeasured || !a11y.ok);
        if (lhFailed || a11yFailed) {
            const detailLines = [];
            if (lhFailed) {
                detailLines.push(lighthouse.notMeasuredReason
                    ? `**Lighthouse** — non misurato (${lighthouse.notMeasuredReason})`
                    : `**Lighthouse** — budget fallito: ${lighthouse.categories.filter((c) => c.status === 'fail').map((c) => `${c.key} ${c.score}<${c.min}`).join(', ')}`);
            }
            if (a11yFailed) {
                detailLines.push(a11y.notMeasured
                    ? `**Pa11y** — non misurato (${a11y.reason})`
                    : `**Pa11y** — ${a11y.violations.length} violazione/i WCAG 2.1 AA:\n${a11y.violations.map((v) => `  - ${v}`).join('\n')}`);
            }
            detailsBlocks.push(`<details><summary>❌ <code>${path}</code></summary>\n\n${detailLines.join('\n\n')}\n\n</details>`);
        }
    }

    return [
        `## Audit live — Pa11y + Lighthouse`,
        '',
        verdict,
        '',
        `Base URL: \`${baseUrl}\``,
        '',
        `> **Legenda:** ✅ ok · ❌ sotto soglia o violazione · ⏭️ SKIP (non conta ai fini del budget — es. SEO su pagina \`noindex\`, non indicizzabile per costruzione) · — pagina fuori dal campione di quello strumento (\`A11Y_DYNAMIC_MAX\`/\`LIGHTHOUSE_DYNAMIC_MAX\`)`,
        `>`,
        `> Soglie minime (\`lighthouse.json\`): ${legendThresholds}`,
        '',
        header,
        separator,
        ...rows,
        '',
        ...(detailsBlocks.length > 0 ? detailsBlocks : []),
    ].join('\n');
}

// ─── main ──────────────────────────────────────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Uso: live-audit.mjs BASE_URL [PATH ...]');
        process.exit(1);
    }

    const baseUrl = args[0].replace(/\/+$/, '');
    const explicitPaths = args.slice(1);

    const puppeteer = await loadFrontendModule('puppeteer');
    const pa11yProbe = await loadFrontendModule('pa11y');
    const lighthouseProbe = await loadFrontendModule('lighthouse');
    if (!puppeteer || !pa11yProbe || !lighthouseProbe) {
        log.warn('puppeteer/pa11y/lighthouse non trovati in frontend/node_modules (npm ci non eseguito?) — controllo saltato');
        process.exit(2);
    }

    let a11yPaths, lighthousePaths;
    if (explicitPaths.length > 0) {
        a11yPaths = explicitPaths;
        lighthousePaths = explicitPaths;
    } else {
        const a11yMax = Number(process.env.A11Y_DYNAMIC_MAX) || 100;
        const lighthouseMax = Number(process.env.LIGHTHOUSE_DYNAMIC_MAX) || 5;
        a11yPaths = discoverPaths(baseUrl, a11yMax);
        lighthousePaths = discoverPaths(baseUrl, lighthouseMax);
        if (a11yPaths === null || lighthousePaths === null) {
            log.fail('Scoperta path fallita — server non raggiungibile o endpoint /health o /sitemap.xml non validi');
            process.exit(2);
        }
        if (a11yPaths.length === 0 && lighthousePaths.length === 0) {
            log.warn('Nessun path da auditare — controllo saltato');
            process.exit(2);
        }
        log.info(`Path auto-scoperti — Pa11y: ${a11yPaths.length}, Lighthouse: ${lighthousePaths.length} (A11Y_DYNAMIC_MAX/LIGHTHOUSE_DYNAMIC_MAX per cambiare il campione)`);
    }

    const pa11yConfigPath = join(SCRIPT_DIR, 'pa11y.json');
    const { chromeLaunchConfig, ...pa11yOptions } = JSON.parse(readFileSync(pa11yConfigPath, 'utf8'));
    const thresholds = JSON.parse(readFileSync(join(SCRIPT_DIR, 'lighthouse.json'), 'utf8'));

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: chromeLaunchConfig?.args ?? [],
    });

    const emptyResult = { failures: 0, total: 0, failedItems: [], perPage: new Map() };
    let a11yResult, lighthouseResult;
    try {
        a11yResult = a11yPaths.length > 0 ? await runA11ySweep(browser, baseUrl, a11yPaths, pa11yOptions) : emptyResult;
        lighthouseResult = lighthousePaths.length > 0 ? await runLighthouseSweep(browser, baseUrl, lighthousePaths, thresholds) : emptyResult;
    } finally {
        await browser.close();
    }

    const a11yFailed = a11yResult.failures > 0;
    const lighthouseFailed = lighthouseResult.failures > 0;

    // Unione ordinata delle rotte analizzate da entrambe le fasi
    const allRoutePaths = [...new Set([...a11yResult.perPage.keys(), ...lighthouseResult.perPage.keys()])];

    const summaryLines = [];
    summaryLines.push(`Rotte totali analizzate: ${allRoutePaths.length} (Pa11y: ${a11yResult.total}, Lighthouse: ${lighthouseResult.total})`);
    summaryLines.push('');
    for (const path of allRoutePaths) {
        summaryLines.push(buildRouteBlock(baseUrl + path, a11yResult.perPage.get(path), lighthouseResult.perPage.get(path)));
        summaryLines.push('');
    }
    const summaryText = summaryLines.join('\n').trimEnd();

    console.log('');
    console.log(BOLD('══ Riepilogo per rotta ══'));
    console.log(summaryText);

    console.log('');
    console.log(BOLD('══ Esito ══'));
    if (a11yFailed) log.fail(`Pa11y: ${a11yResult.failures}/${a11yResult.total} pagina/e con violazioni WCAG 2.1 AA o non misurate`);
    else log.ok(`Pa11y: ${a11yResult.total} pagina/e, nessuna violazione WCAG 2.1 AA`);
    if (lighthouseFailed) log.fail(`Lighthouse: ${lighthouseResult.failures}/${lighthouseResult.total} pagina/e sotto il budget o non misurate`);
    else log.ok(`Lighthouse: ${lighthouseResult.total} pagina/e, tutti i budget rispettati`);

    // Scrittura riepilogo su GitHub Step Summary se attivo
    if (process.env.GITHUB_STEP_SUMMARY) {
        const verdict = a11yFailed || lighthouseFailed
            ? `❌ Uno o più controlli falliti — **${allRoutePaths.length}** rotte analizzate (Pa11y: ${a11yResult.total} · Lighthouse: ${lighthouseResult.total})`
            : `✅ Tutti i controlli superati — **${allRoutePaths.length}** rotte analizzate (Pa11y: ${a11yResult.total} · Lighthouse: ${lighthouseResult.total})`;
        const md = buildStepSummaryMarkdown(baseUrl, allRoutePaths, a11yResult.perPage, lighthouseResult.perPage, thresholds, verdict);
        try {
            appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
        } catch (err) {
            log.warn(`Scrittura su GITHUB_STEP_SUMMARY fallita: ${err.message}`);
        }
    }

    process.exit(a11yFailed || lighthouseFailed ? 1 : 0);
}

main().catch((err) => {
    log.fail(`live-audit.mjs non ha completato: ${err.stack || err.message}`);
    process.exit(1);
});
