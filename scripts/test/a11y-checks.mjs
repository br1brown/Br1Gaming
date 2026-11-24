#!/usr/bin/env node
'use strict';

// Controlli che Pa11y non fa, in tema chiaro e scuro: axe WCAG A/AA, focus da tastiera ≥ 3:1, dialoghi (nome, X, Escape, focus di ritorno).
// Uso: node a11y-checks.mjs BASE_URL [PATH ...]   (senza PATH: pagine da /health)
// Exit code: 0 ok · 1 violazioni · 2 dipendenze o pagine non disponibili (saltato)

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = join(SCRIPT_DIR, '..', '..', 'frontend');
const requireFromFrontend = createRequire(join(FRONTEND_DIR, 'package.json'));

const tty = process.stdout.isTTY;
const paint = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const log = {
    info: (m) => console.log(`  ${paint('1', '[info]')} ${m}`),
    ok: (m) => console.log(`  ${paint('32', 'OK')} ${m}`),
    warn: (m) => console.log(`  ${paint('33', 'WARN')} ${m}`),
    fail: (m) => console.log(`  ${paint('31', 'ERR')} ${m}`),
};

const FOCUS_MIN_RATIO = 3;          // WCAG 1.4.11
const TAP_MIN_PX = 24;              // WCAG 2.5.8 (AA): sotto è un errore
const TAP_ENGINE_PX = 44;           // il minimo che l'Engine dà ai suoi controlli: sotto è un avviso
const MAX_TABS = Number(process.env.A11Y_MAX_TABS) || 150;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadFrontendModule(pkg) {
    try {
        const mod = await import(pathToFileURL(requireFromFrontend.resolve(pkg)).href);
        return mod.default ?? mod;
    } catch {
        return null;
    }
}

function discoverPaths(baseUrl) {
    const r = spawnSync(process.execPath, [join(SCRIPT_DIR, 'discover-audit-paths.cjs'), baseUrl, '2'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null;
}

// ─── Nel browser ─────────────────────────────────────────────────────────────

/** Il contrasto fra il colore dell'indicatore di focus dell'elemento attivo e lo sfondo dietro di lui, o `null` se non c'è un elemento. */
function measureFocus() {
    const parse = (c) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c) || /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(c);
        if (!m) return null;
        const srgb = c.startsWith('color(');
        return { rgb: [m[1], m[2], m[3]].map((v) => (srgb ? Math.round(+v * 255) : +v)), a: m[4] === undefined ? 1 : +m[4] };
    };
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const bgAt = (el) => { while (el) { const c = parse(getComputedStyle(el).backgroundColor); if (c && c.a > 0.5) return c.rgb; el = el.parentElement; } return [255, 255, 255]; };
    const blend = (c, bg) => c.rgb.map((v, i) => Math.round(v * c.a + bg[i] * (1 - c.a)));

    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const cs = getComputedStyle(a);
    const around = bgAt(a.parentElement || a);
    const candidates = [];
    const outline = parse(cs.outlineColor);
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 && outline) candidates.push(blend(outline, around));
    // Un'ombra di almeno 2px sull'elemento o, per i campi avvolti (un editor), su un suo antenato vicino.
    for (let el = a, depth = 0; el && depth < 3; el = el.parentElement, depth++) {
        const s = /(rgba?\([^)]*\)|color\([^)]*\))\s+\S+\s+\S+\s+\S+\s+(\S+)/.exec(getComputedStyle(el).boxShadow);
        const c = s && parseFloat(s[2]) >= 2 ? parse(s[1]) : null;
        if (c) candidates.push(blend(c, around));
        // Il riquadro che avvolge il campo (un editor) e al focus cambia il bordo: conta il suo bordo contro il fondo dietro di lui.
        const wrap = getComputedStyle(el);
        if (el !== a && el.matches(':focus-within') && parseFloat(wrap.borderTopWidth) >= 1) {
            const bc = parse(wrap.borderTopColor);
            if (bc) candidates.push(blend(bc, bgAt(el.parentElement || el)));
        }
    }
    // Un campo di testo ha già il suo bordo: vale se contrasta.
    if (a.matches('input, textarea, select')) {
        const bc = parse(cs.borderColor);
        if (bc && parseFloat(cs.borderTopWidth) >= 1) candidates.push(blend(bc, around));
    }
    const best = candidates.length ? Math.max(...candidates.map((c) => ratio(c, around))) : 0;   // (il bordo di un riquadro è già fuso col suo fondo)
    const label = `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''} "${(a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 24)}"`;
    return { label, best, type: a.getAttribute('type') };
}

/** Il dialogo aperto adesso (Bootstrap `.modal.show` o un `role=dialog` che non sia un popup SweetAlert), con nome, X e misure. */
function inspectDialog() {
    const dlg = document.querySelector('.modal.show, [role="dialog"][aria-modal="true"]:not(.swal2-popup)');
    if (!dlg) return null;
    const nameOf = (el) => el.getAttribute('aria-label')
        || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ')
        || '';
    const closers = [...dlg.querySelectorAll('button, [role="button"]')].filter((b) => /chiud|close|annulla|cancel/i.test(`${b.getAttribute('aria-label') || ''} ${b.className}`));
    const x = closers.find((b) => b.classList.contains('btn-close')) || closers.find((b) => /chiud|close/i.test(b.getAttribute('aria-label') || '')) || null;
    const r = x?.getBoundingClientRect();
    return { name: nameOf(dlg), hasX: !!x, xName: x ? (x.getAttribute('aria-label') || x.textContent || '').trim() : '', xSize: r ? Math.round(Math.min(r.width, r.height)) : 0 };
}

// ─── Giro principale ─────────────────────────────────────────────────────────

async function main() {
    const [baseUrlArg, ...pathArgs] = process.argv.slice(2);
    if (!baseUrlArg) { console.error('Uso: a11y-checks.mjs BASE_URL [PATH ...]'); process.exit(2); }
    const baseUrl = baseUrlArg.replace(/\/+$/, '');

    const puppeteer = await loadFrontendModule('puppeteer');
    let axeSource;
    try { axeSource = readFileSync(requireFromFrontend.resolve('axe-core/axe.min.js'), 'utf8'); } catch { axeSource = null; }
    if (!puppeteer || !axeSource) { log.warn('puppeteer o axe-core non trovati in frontend/node_modules (npm ci non eseguito?) — controllo saltato'); process.exit(2); }

    const paths = pathArgs.length ? pathArgs : discoverPaths(baseUrl);
    if (!paths?.length) { log.warn('Nessun path da controllare (server non raggiungibile?) — controllo saltato'); process.exit(2); }

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    let failures = 0;
    const fail = (m) => { failures++; log.fail(m); };
    console.log('');
    console.log(paint('1', '══ Accessibilità: temi, focus da tastiera e dialoghi ══'));
    log.info(`${paths.length} pagine, tema chiaro e scuro`);

    try {
        for (const scheme of ['light', 'dark']) {
            for (const raw of paths) {
                const path = '/' + raw.replace(/^\/+/, '');
                const page = await browser.newPage();
                try {
                    await page.setViewport({ width: 1280, height: 900 });
                    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
                    await page.setBypassCSP(true);
                    const response = await page.goto(baseUrl + path, { waitUntil: 'networkidle2', timeout: 30000 });
                    // Una pagina che non c'è non ha niente da controllare e passerebbe «a posto» con zero elementi: è un errore, non un successo.
                    if (!response || response.status() >= 400) { fail(`${scheme.padEnd(5)} ${path}: HTTP ${response?.status() ?? 'nessuna risposta'}`); continue; }
                    await page.waitForFunction(() => document.getAnimations().length === 0, { timeout: 5000, polling: 100 }).catch(() => {});
                    // Il banner dei cookie, se c'è, si chiude: è un'altra pagina da controllare, ma non deve coprire la prima.
                    await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => /rifiuta|reject/i.test(b.textContent || ''))?.click(); });
                    await sleep(400);
                    const tag = `${scheme.padEnd(5)} ${path}`;

                    // 1. axe
                    await page.evaluate(axeSource);
                    const axeResult = await page.evaluate(() => globalThis.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'], resultTypes: ['violations'] }));
                    if (axeResult.violations.length) {
                        fail(`axe ${tag}: ${axeResult.violations.map((v) => `${v.id} (${v.nodes.length})`).join(', ')}`);
                        for (const v of axeResult.violations.slice(0, 3)) log.info(`   ${v.id}: ${v.nodes[0].target.join(' ')} — ${v.help}`);
                    } else log.ok(`axe ${tag}`);

                    // 2. focus
                    const seen = new Set(); const low = [];
                    await page.evaluate(() => { (document.activeElement)?.blur?.(); window.scrollTo(0, 0); });
                    for (let i = 0; i < MAX_TABS; i++) {
                        await page.keyboard.press('Tab');
                        const m = await page.evaluate(measureFocus);
                        if (!m) break;
                        if (seen.has(m.label)) continue;
                        seen.add(m.label);
                        if (m.type === 'range') continue;      // il cursore è disegnato dal browser: non misurabile da qui
                        if (m.best < FOCUS_MIN_RATIO) low.push(`${m.label} ${m.best.toFixed(2)}:1`);
                    }
                    if (low.length) { fail(`focus ${tag}: ${low.length} elementi sotto ${FOCUS_MIN_RATIO}:1 — ${low.slice(0, 4).join('; ')}`); }
                    else log.ok(`focus ${tag}: ${seen.size} elementi, indicatore ≥ ${FOCUS_MIN_RATIO}:1`);

                    // 3. dialoghi (solo una volta per pagina: nel tema chiaro; il tema scuro lo copre axe)
                    if (scheme === 'light') {
                        const triggers = await page.$$('[aria-haspopup="dialog"]');
                        for (let t = 0; t < Math.min(triggers.length, 6); t++) {
                            const trigger = (await page.$$('[aria-haspopup="dialog"]'))[t];
                            if (!trigger || !(await trigger.isIntersectingViewport().catch(() => false)) && !(await trigger.boundingBox())) continue;
                            const triggerLabel = await trigger.evaluate((el) => (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24));
                            await trigger.evaluate((el) => el.scrollIntoView({ block: 'center' }));
                            await trigger.click().catch(() => {});
                            await sleep(900);
                            const d = await page.evaluate(inspectDialog);
                            const dtag = `dialogo "${triggerLabel}" ${path}`;
                            if (!d) { log.warn(`${dtag}: non si è aperto`); continue; }
                            const problems = [];
                            if (!d.name) problems.push('senza nome accessibile');
                            if (!d.hasX) problems.push('senza X di chiusura');
                            else {
                                if (!d.xName) problems.push('X senza nome');
                                if (d.xSize < TAP_MIN_PX) problems.push(`X di ${d.xSize}px (minimo ${TAP_MIN_PX}px)`);
                                else if (d.xSize < TAP_ENGINE_PX) log.warn(`${dtag}: X di ${d.xSize}px (l'Engine dà ${TAP_ENGINE_PX}px ai suoi controlli)`);
                            }
                            await page.evaluate(axeSource);
                            const dax = await page.evaluate(() => globalThis.axe.run(document.querySelector('.modal.show, [role="dialog"][aria-modal="true"]:not(.swal2-popup)'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'], resultTypes: ['violations'] }));
                            if (dax.violations.length) problems.push(`axe: ${dax.violations.map((v) => v.id).join(', ')}`);
                            await page.keyboard.press('Escape');
                            await sleep(800);
                            const closed = await page.evaluate(() => !document.querySelector('.modal.show'));
                            if (!closed) problems.push('non si chiude con Escape');
                            else {
                                const back = await trigger.evaluate((el) => el === document.activeElement).catch(() => false);
                                if (!back) problems.push('il focus non torna al pulsante che l\'ha aperto');
                            }
                            if (problems.length) fail(`${dtag}: ${problems.join('; ')}`); else log.ok(dtag);
                        }
                    }
                } finally {
                    await page.close();
                }
            }
        }
    } finally {
        await browser.close();
    }

    console.log('');
    if (failures) { log.fail(`${failures} controlli falliti`); process.exit(1); }
    log.ok('Accessibilità: temi, focus e dialoghi a posto');
}

main().catch((err) => { log.fail(err.stack || String(err)); process.exit(1); });
