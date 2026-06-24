/**
 * Sincronizza i file statici con la configurazione centrale del sito.
 *
 * Aggiorna:
 * - src/index.html           → lang, title, theme-color, meta PWA
 * - src/environments/environment.ts → identità/estetica del progetto iniettate nel bundle
 * - public/manifest.webmanifest → nome, descrizione, colori
 * - public/sitemap.xml       → tutte le pagine indicizzabili
 * - public/robots.txt        → user-agent, disallow, sitemap URL
 * - public/llms.txt          → indice del sito per i crawler AI (convenzione llms.txt)
 * - public/security.txt      → contatto di sicurezza RFC 9116 (servito su /.well-known/)
 * - public/theme-init.js     → script anti-flash del tema, referenziato da index.html
 *
 * Solo index.html ed environment.ts sono generati MA versionati (seed: type-check e build
 * passano anche prima della prima esecuzione). Tutto ciò che finisce in public/ (manifest,
 * robots, sitemap, llms, security.txt, theme-init, icons) è solo output di build, gitignored
 * (public/ è ignorata per intero): lo rigenera il pre-hook prebuild.
 *
 * Eseguire con:
 *   npm run generate:statics
 *
 * Variabile d'ambiente:
 *   FRONTEND_BASE_URL — URL base del sito (default: https://example.com con warning)
 *
 * Esclusioni sitemap e robots automatiche (gestite dal siteBuilder):
 *   - Pagine disabilitate (enabled: false)
 *   - Pagine esterne (externalUrl)
 *   - Pagine protette da autenticazione (requiresAuth: true)
 */

// Necessario: carica il JIT compiler di Angular così i decoratori @Injectable
// funzionano quando Node.js importa site.ts e il suo grafo di dipendenze.
import '@angular/compiler';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { ContestoSito } from '../../../site';
import { ThemeService } from '../services/theme.service';
import { SitemapEntry } from '../siteBuilder';

const ROOT = join(__dirname, '../../../../../');

// Config di progetto a build-time. Sorgente: global-settings.json (sezioni project /
// Localization / site). Nel build dell'immagine Docker il file (nella root del repo) NON è
// nel build context (./frontend), quindi deploy.sh passa il suo contenuto minificato come
// build ARG BR1_PROJECT_JSON (solo config di progetto, NIENTE segreti). Su host/CI il file
// c'è e si legge direttamente (guardato). FRONTEND_BASE_URL resta un ARG a parte (deploy).
function readProjectSettings(): Record<string, unknown> {
    const inline = process.env['BR1_PROJECT_JSON'];
    if (inline) {
        try { return JSON.parse(inline) as Record<string, unknown>; } catch { /* fallback al file */ }
    }
    const candidates = [
        process.env['GLOBAL_SETTINGS_PATH'],
        join(ROOT, '../global-settings.json'), // host/CI: root del repo
        join(ROOT, 'global-settings.json'),
    ].filter((p): p is string => Boolean(p));

    for (const p of candidates) {
        try {
            if (existsSync(p)) {
                return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>;
            }
        } catch { /* file illeggibile: prova il prossimo candidato */ }
    }
    return {};
}

const _settings = readProjectSettings();
const _fileLoc = (_settings['Localization'] as Record<string, unknown>) ?? {};
const _fileProject = (_settings['project'] as Record<string, unknown>) ?? {};
// Config di sito: solo identità/estetica finisce in environment.ts. I flag di
// COMPORTAMENTO (showNav/showFooter/fixedTopHeader/showBrandIconInHeader/
// showLoginInHeader/showNotifications/forcedLightPanel/isWebApp/onlyPlainImage) sono migrati in site.ts,
// quindi vengono filtrati via qui anche se un vecchio JSON li contiene ancora.
const SITE_CONFIG = (_settings['site'] as Record<string, unknown>) ?? {};
const SITE_AESTHETIC_KEYS = ['description', 'colorTema', 'smoke'];

// Identità dell'app — fonte unica: project.name / project.version.
const APP_NAME = (_fileProject['name'] as string | undefined) || 'App';
const APP_VERSION = (_fileProject['version'] as string | undefined) || '1.0.0';
const COLOR_TEMA = (SITE_CONFIG['colorTema'] as string | undefined) ?? '#888888';

// PWA on/off — fonte unica: ContestoSito.config.isWebApp (site.ts). Guida la generazione
// dei TRIGGER di installabilità: il manifest e, in index.html, <link rel="manifest"> più i
// meta mobile-web-app-capable / apple-mobile-web-app-*. Quando è false il sito non deve
// essere installabile (nessun prompt "Aggiungi a schermata Home"), quindi questi elementi
// non vengono scritti. La de-registrazione runtime del Service Worker è già gestita da
// cookie-consent.service.ts; qui agiamo solo sul lato generazione statici.
const IS_WEBAPP = ContestoSito.config.isWebApp;

const _normLang = (tag: unknown): string | null => {
    if (typeof tag !== 'string' || !tag.trim()) return null;
    try { return new Intl.Locale(tag.trim()).language ?? null; } catch { return null; }
};

const _defaultRaw   = _fileLoc['DefaultLanguage'];
const _supportedRaw = _fileLoc['SupportedLanguages'] as string[] | undefined;

const DEFAULT_LANG    = _normLang(_defaultRaw) ?? 'it';
const AVAILABLE_LANGS = (_supportedRaw ?? [DEFAULT_LANG])
    .map(_normLang)
    .filter((l): l is string => l !== null)
    .filter((v, i, a) => a.indexOf(v) === i); // deduplication

// description: mappa per-lingua { it, en, ... } (accetta anche una stringa singola,
// normalizzata sulla lingua default). environment.ts riceve la mappa; i file statici
// usano la lingua default (in SSR i meta sono riscritti per richiesta).
const _rawDesc = SITE_CONFIG['description'];
const DESCRIPTION_MAP: Record<string, string> =
    typeof _rawDesc === 'string'
        ? { [DEFAULT_LANG]: _rawDesc }
        : (_rawDesc && typeof _rawDesc === 'object'
            ? Object.fromEntries(
                Object.entries(_rawDesc as Record<string, unknown>)
                    .filter((e): e is [string, string] => typeof e[1] === 'string'))
            : {});
const DESCRIPTION = DESCRIPTION_MAP[DEFAULT_LANG] ?? Object.values(DESCRIPTION_MAP)[0] ?? '';

// Solo identità/estetica finisce in environment.ts (description normalizzata a mappa).
const SITE_CONFIG_OUT = {
    ...Object.fromEntries(
        Object.entries(SITE_CONFIG).filter(([k]) => SITE_AESTHETIC_KEYS.includes(k) && k !== 'description')
    ),
    description: DESCRIPTION_MAP,
};

const INDEX = join(ROOT, 'src', 'index.html');
const MANIFEST = join(ROOT, 'public', 'manifest.webmanifest');
const SITEMAP = join(ROOT, 'public', 'sitemap.xml');
const ROBOTS = join(ROOT, 'public', 'robots.txt');
const LLMS = join(ROOT, 'public', 'llms.txt');
const SECURITY = join(ROOT, 'public', 'security.txt');
const THEME_INIT = join(ROOT, 'public', 'theme-init.js');

// Rimuove lo slash finale per evitare doppi slash negli URL generati
const BASE_URL = (process.env['FRONTEND_BASE_URL'] || 'https://example.com').replace(/\/$/, '');

/**
 * Data di ultima modifica (YYYY-MM-DD) per `og:updated_time` e `<lastmod>` della sitemap.
 * Fonte: `project.lastModified` in global-settings.json (formato `GG/MM/AAAA`), da bumpare
 * a mano quando i contenuti cambiano. Fallback alla data del build se assente o non valida.
 */
function getLastModifiedDate(): string {
    const raw = _fileProject['lastModified'];
    if (typeof raw === 'string') {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
        if (m) {
            const [, dd, mm, yyyy] = m;
            const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
            // Round-trip: scarta date impossibili (es. 30/02) che Date farebbe slittare.
            const valid = !isNaN(d.getTime())
                && d.getUTCMonth() + 1 === Number(mm)
                && d.getUTCDate() === Number(dd);
            if (valid) return `${yyyy}-${mm}-${dd}`;
        }
        console.warn(`[statics] project.lastModified="${raw}" non valido (atteso GG/MM/AAAA) — uso la data odierna`);
    }
    return new Date().toISOString().slice(0, 10);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toOpenGraphLocale(lang: string): string {
    try {
        const locale = new Intl.Locale(lang).maximize();
        return locale.region ? `${locale.language}_${locale.region}` : locale.language;
    } catch {
        const [base] = lang.split('-');
        return `${base}_${base.toUpperCase()}`;
    }
}

function replaceMeta(
    html: string,
    attr: 'name' | 'property',
    key: string,
    content: string
): string {
    const escapedKey = escapeRegex(key);
    // Tolera qualsiasi ordine degli attributi nel tag meta
    const pattern = new RegExp(`<meta\\s[^>]*${attr}="${escapedKey}"[^>]*>`, 'i');
    const replacement = `<meta ${attr}="${key}" content="${content}">`;

    if (!pattern.test(html)) {
        throw new Error(`[statics] Impossibile trovare meta[${attr}="${key}"] in index.html.`);
    }

    return html.replace(pattern, replacement);
}

function replaceTag(html: string, pattern: RegExp, replacement: string, label: string): string {
    if (!pattern.test(html)) {
        throw new Error(`[statics] Impossibile trovare ${label} in index.html.`);
    }

    return html.replace(pattern, replacement);
}

// ── Calcolo priority e changefreq per sitemap ─────────────────────────────

function getPriority(path: string): string {
    const depth = path === '/' ? 0 : path.split('/').filter(Boolean).length;
    return Math.max(0.3, 1.0 - depth * 0.2).toFixed(1);
}

function getChangefreq(path: string): string {
    const depth = path === '/' ? 0 : path.split('/').filter(Boolean).length;
    if (depth === 0) return 'weekly';
    if (depth === 1) return 'monthly';
    return 'yearly';
}

// ── Aggiornamento index.html ──────────────────────────────────────────────

function updateIndexHtml(): void {
    const appName = escapeHtml(APP_NAME);
    const description = escapeHtml(DESCRIPTION);
    const lang = escapeHtml(DEFAULT_LANG);
    const ogLocale = escapeHtml(toOpenGraphLocale(DEFAULT_LANG));
    // 'default' è sicuro per qualsiasi tema: apple-mobile-web-app-status-bar-style
    // non supporta media queries e non può adattarsi all'OS preference a runtime.
    const iosStatusBar = 'default';

    let html = readFileSync(INDEX, 'utf8');

    // Regex flessibile: matcha <html> con qualsiasi combinazione di attributi, riscrive solo lang.
    html = replaceTag(html, /<html\b[^>]*>/, `<html lang="${lang}">`, '<html lang>');
    html = replaceTag(html, /<title>[^<]*<\/title>/, `<title>${appName}</title>`, '<title>');

    const defaultImageUrl = `${BASE_URL}/icons/icon-512x512.png`;
    const updatedTime = getLastModifiedDate();

    // <meta name="theme-color"> è omesso: viene iniettato dinamicamente per-request
    // dall'app-initializer SSR (app.config.server.ts), con varianti light/dark via media attribute.
    const allMeta: ['name' | 'property', string, string][] = [
        ['name', 'app-version', APP_VERSION],
        ['property', 'og:updated_time', updatedTime],
        ['name', 'description', description],
        // I meta apple-mobile-web-app-* NON stanno qui: sono trigger PWA e vivono nel
        // blocco PWA condizionato da IS_WEBAPP (vedi più sotto), così spariscono quando
        // il sito non è installabile invece di restare sempre presenti.
        ['name', 'application-name', appName],
        ['name', 'twitter:title', appName],
        ['name', 'twitter:description', description],
        ['name', 'twitter:image', defaultImageUrl],
        ['property', 'og:title', appName],
        ['property', 'og:description', description],
        ['property', 'og:site_name', appName],
        ['property', 'og:locale', ogLocale],
        ['property', 'og:url', BASE_URL],
        ['property', 'og:image', defaultImageUrl],
    ];

    // Genera il file TS con identità, lingue e config di sito per il frontend (invece di
    // esporre JSON nel meta tag). Fonte unica: global-settings.json (project / Localization / site).
    const generatedTsPath = join(ROOT, 'src', 'environments', 'environment.ts');
    const generatedTsContent = `// FILE GENERATO AUTOMATICAMENTE DA scripts/generate-statics.ts
// Non modificare manualmente. Sorgente di verità: global-settings.json (sezioni project / Localization / site)

export interface AppSiteConfig {
    description?: Record<string, string>;
    colorTema?: string;
    smoke?: {
        enable?: boolean;
        color?: string;
        opacity?: number;
        maximumVelocity?: number;
        particleRadius?: number;
        density?: number;
    };
}

export interface AppEnvironment {
    appName: string;
    version: string;
    defaultLang: string;
    availableLanguages: string[];
    config: AppSiteConfig;
}

export const environment: AppEnvironment = {
    appName: ${JSON.stringify(APP_NAME)},
    version: ${JSON.stringify(APP_VERSION)},
    defaultLang: '${DEFAULT_LANG}',
    availableLanguages: ${JSON.stringify(AVAILABLE_LANGS)},
    config: ${JSON.stringify(SITE_CONFIG_OUT, null, 8).replace(/\n/g, '\n    ')}
};
`;
    writeFileSync(generatedTsPath, generatedTsContent, 'utf8');
    console.log('[statics] src/environments/environment.ts aggiornato');

    for (const [attr, key, value] of allMeta) {
        html = replaceMeta(html, attr, key, value);
    }

    html = replaceTag(
        html,
        /<link rel="icon" type="image\/png" href="[^"]*">/,
        '<link rel="icon" type="image/png" href="icons/icon-192x192.png">',
        '<link rel="icon">'
    );

    // theme-init.js DEVE essere referenziato con path ASSOLUTO: lo <script> sta prima
    // di <base href>, quindi un path relativo risolverebbe contro la rotta corrente
    // (es. /sezione/theme-init.js → 404) sulle pagine annidate. Forzato qui così è
    // deterministico e sopravvive a un'eventuale reintroduzione del path relativo.
    html = replaceTag(
        html,
        /<script\s+src="\/?theme-init\.js"><\/script>/,
        '<script src="/theme-init.js"></script>',
        '<script theme-init>'
    );

    // ── Blocco PWA deterministico ────────────────────────────────────────────
    // I trigger di installabilità (manifest + meta) vivono in un blocco delimitato da
    // marker, rigenerato per intero da qui: con IS_WEBAPP vengono iniettati, altrimenti
    // rimossi del tutto. Così l'installabilità non dipende mai da tag hardcoded nel seed.
    // Solo marker nudi (PWA:START/END) nell'HTML servito: nessun path di build né nome di
    // flag di config nel sorgente pubblico. Quando IS_WEBAPP è false il blocco resta vuoto
    // (niente manifest né meta di installabilità), senza commenti che ne spieghino il perché.
    const pwaBlock = IS_WEBAPP
        ? '\n    ' + [
            '<meta name="mobile-web-app-capable" content="yes">',
            `<meta name="apple-mobile-web-app-status-bar-style" content="${iosStatusBar}">`,
            `<meta name="apple-mobile-web-app-title" content="${appName}">`,
            '<link rel="apple-touch-icon" href="icons/icon-512x512.png">',
            '<link rel="manifest" href="manifest.webmanifest">',
        ].join('\n    ') + '\n    '
        : '';

    html = replaceTag(
        html,
        /<!-- PWA:START[\s\S]*?PWA:END -->/,
        `<!-- PWA:START -->${pwaBlock}<!-- PWA:END -->`,
        'blocco PWA'
    );

    writeFileSync(INDEX, html, 'utf8');
    console.log(`[statics] index.html aggiornato`);
}

// ── Aggiornamento manifest.webmanifest ────────────────────────────────────

function updateManifest(): void {
    // PWA disattivata: nessun manifest installabile. Se un manifest era stato generato da
    // un build precedente (toggle isWebApp da true a false) lo rimuoviamo, così il sito non
    // resta installabile via un file residuo. public/ è gitignored: il manifest vive solo
    // come artefatto di build, mai nel repo — niente da versionare in questo ramo.
    if (!IS_WEBAPP) {
        if (existsSync(MANIFEST)) {
            rmSync(MANIFEST);
            console.log('[statics] manifest.webmanifest rimosso (isWebApp:false → sito non installabile)');
        } else {
            console.log('[statics] manifest.webmanifest non generato (isWebApp:false)');
        }
        return;
    }

    const palette = ThemeService.computePalette(COLOR_TEMA);

    const manifest: Record<string, unknown> = {
        name: APP_NAME,
        short_name: APP_NAME,
        description: DESCRIPTION,
        lang: DEFAULT_LANG,
        theme_color: palette.colorPrimary,
        background_color: palette.naturalTone === 'light' ? palette.colorBaseLt : palette.colorBaseDk,
        display: "standalone",
        scope: "./",
        start_url: "./",
        icons: [
            {
                src: "icons/icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any"
            },
            {
                src: "icons/icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable"
            }
        ],
        version: APP_VERSION
    };

    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 4)}\n`, 'utf8');
    console.log(`[statics] manifest.webmanifest aggiornato`);
}

// ── Generazione sitemap.xml ───────────────────────────────────────────────

function buildSitemapXml(entries: SitemapEntry[]): string {
    // Google usa <lastmod> solo se e' accurato e verificabile: usare la data
    // dell'ultimo commit e' piu' affidabile della data di build, che cambierebbe
    // anche senza modifiche reali ai contenuti.
    const lastmod = getLastModifiedDate();
    const urls = entries
        .map(({ path }) => [
            '  <url>',
            `    <loc>${BASE_URL}${path}</loc>`,
            `    <lastmod>${lastmod}</lastmod>`,
            `    <changefreq>${getChangefreq(path)}</changefreq>`,
            `    <priority>${getPriority(path)}</priority>`,
            '  </url>',
        ].join('\n'))
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function updateSitemap(): void {
    const entries = ContestoSito.getSitemapEntries();

    if (entries.length === 0) {
        console.warn('[statics] Nessuna pagina per sitemap trovata.');
        return;
    }

    writeFileSync(SITEMAP, buildSitemapXml(entries), 'utf8');
    console.log(`[statics] sitemap.xml aggiornata (${entries.length} pagine)`);

    if (BASE_URL === 'https://example.com') {
        console.warn('[statics] ATTENZIONE: FRONTEND_BASE_URL non configurato. ' +
            'Impostare FRONTEND_BASE_URL=https://tuodominio.it prima del build di produzione.');
    }
}

// ── Generazione robots.txt ────────────────────────────────────────────────

function updateRobots(): void {
    // Le pagine protette (`requiresAuth`) NON vengono più elencate come `Disallow`: un
    // `robots.txt` è pubblico, quindi enumerarle ne rivelerebbe i path. La non-indicizzazione
    // è ottenuta in modo più solido a runtime dal server SSR con `X-Robots-Tag: noindex` su
    // quelle rotte (vedi server.ts), che vale anche per i crawler che ignorano robots.txt.
    // La disattivazione globale dell'indicizzazione (staging) è gestita dal server via
    // SEO_NOINDEX, che serve un robots.txt dinamico `Disallow: /` sovrascrivendo questo file.
    const lines = ['User-agent: *', 'Allow: /', '', `Sitemap: ${BASE_URL}/sitemap.xml`];

    writeFileSync(ROBOTS, lines.join('\n') + '\n', 'utf8');
    console.log(`[statics] robots.txt aggiornato`);
}

// ── Generazione llms.txt (indice per crawler AI) ──────────────────────────

function updateLlms(): void {
    const entries = ContestoSito.getSitemapEntries();

    const lines = [
        `# ${APP_NAME}`,
        '',
        `> ${DESCRIPTION}`,
        '',
        '## Pagine',
        ...entries.map(({ path }) => `- ${BASE_URL}${path}`),
    ];

    writeFileSync(LLMS, lines.join('\n') + '\n', 'utf8');
    console.log(`[statics] llms.txt aggiornato (${entries.length} pagine)`);
}

// ── Generazione security.txt (RFC 9116) ───────────────────────────────────

function updateSecurityTxt(): void {
    // Expires obbligatorio per RFC 9116: rigenerato a ogni build (+1 anno), così non
    // scade mai finché il sito viene ribuildato. Contact punta al sito stesso, che è un
    // URI valido per la segnalazione; personalizzabile sovrascrivendo questo file.
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const lines = [
        '# security.txt — RFC 9116',
        `Contact: ${BASE_URL}`,
        `Expires: ${expires}`,
        `Preferred-Languages: ${AVAILABLE_LANGS.join(', ')}`,
        `Canonical: ${BASE_URL}/.well-known/security.txt`,
    ];

    writeFileSync(SECURITY, lines.join('\n') + '\n', 'utf8');
    console.log(`[statics] security.txt aggiornato`);
}

// ── Generazione theme-init.js (anti-flash tema, pre-idratazione) ───────────

function updateThemeInit(): void {
    // Script anti-flash: imposta data-bs-theme / data-theme-tone su <html> prima che
    // Bootstrap carichi qualsiasi stile. Referenziato da <script src="theme-init.js"> in
    // index.html, eseguito sincrono (no defer/async) nel <head> così non c'è un ciclo di
    // rendering col tono sbagliato. È uno script esterno, non inline: coperto da
    // script-src 'self' nella CSP, quindi non serve né hash né nonce. È un asset statico
    // servito da express.static: va materializzato qui perché public/ è gitignored,
    // altrimenti mancherebbe su un checkout/build pulito (404 + MIME error a ogni full load).
    const script = `(function () {
    var t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var el = document.documentElement;
    el.setAttribute('data-bs-theme', t);
    el.setAttribute('data-theme-tone', t);
}());
`;

    writeFileSync(THEME_INIT, script, 'utf8');
    console.log('[statics] theme-init.js aggiornato');
}

// ── Entry point ───────────────────────────────────────────────────────────

function main(): void {
    const publicDir = join(ROOT, 'public');
    if (!existsSync(publicDir)) {
        mkdirSync(publicDir, { recursive: true });
    }

    updateIndexHtml();
    updateManifest();
    updateSitemap();
    updateRobots();
    updateLlms();
    updateSecurityTxt();
    updateThemeInit();
}

main();
