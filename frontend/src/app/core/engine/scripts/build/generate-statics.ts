/** Sincronizza i file statici (index.html, environment.ts, manifest, robots.txt, theme-init.js) con
 *  global-settings.json/site.ts. Eseguire con `npm run generate:statics` (già nei pre-hook build/dev). */

// Necessario: carica il JIT compiler di Angular così i decoratori @Injectable
// funzionano quando Node.js importa site.ts e il suo grafo di dipendenze.
import '@angular/compiler';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { ContestoSito } from '../../../../site';
import { AppearanceService } from '../../services/appearance.service';
import { MUTEZZA_SECONDARIO_FATTORE, SEPARAZIONE_SUPERFICI_FATTORE } from '../../design-system-presets';
import { fingerprintIdentitySections } from '../config/config-fingerprint';
import { deepMergeSettings } from '../config/settings-merge';
import { getLastModifiedDate } from '../config/last-modified';
import type { GlobalSettings } from '../../global-settings.types';

const ROOT = join(__dirname, '../../../../../../');

// Config di progetto a build-time (global-settings.json). Nel build Docker il file non è nel
// build context, quindi deploy.sh lo passa minificato come ARG BR1_PROJECT_JSON. Tipizzato con
// GlobalSettings: un typo di chiave è errore a tsc.
function readProjectSettings(): GlobalSettings {
    // BR1_PROJECT_JSON: SOLO il file base, mai fuso con .local.json — confine di sicurezza voluto,
    // i segreti di .local.json non devono finire in un build ARG.
    const inline = process.env['BR1_PROJECT_JSON'];
    if (inline) {
        try { return JSON.parse(inline) as GlobalSettings; } catch { /* fallback al file */ }
    }

    const candidates = [
        process.env['GLOBAL_SETTINGS_PATH'],
        join(ROOT, '../global-settings.json'), // host/CI: root del repo
        join(ROOT, 'global-settings.json'),
    ].filter((p): p is string => Boolean(p));

    let base: GlobalSettings | null = null;
    for (const p of candidates) {
        try {
            if (existsSync(p)) {
                base = JSON.parse(readFileSync(p, 'utf-8')) as GlobalSettings;
                break;
            }
        } catch { /* file illeggibile: prova il prossimo candidato */ }
    }
    if (!base) return {};

    // Fusa con global-settings.local.json se presente (stessa deepMergeSettings di server-env.ts al
    // boot): senza, un progetto con identità/tema in .local.json vedrebbe l'avviso "environment.ts
    // disallineato" anche subito dopo un generate:statics pulito.
    const localCandidates = [
        join(ROOT, '../global-settings.local.json'),
        join(ROOT, 'global-settings.local.json'),
    ];
    for (const p of localCandidates) {
        try {
            if (existsSync(p)) {
                const local = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>;
                return deepMergeSettings(base as unknown as Record<string, unknown>, local) as GlobalSettings;
            }
        } catch { /* file illeggibile: ignora l'override, resta il solo base */ }
    }
    return base;
}

const _settings = readProjectSettings();
// Scritta in environment.ts più sotto; letta di nuovo al boot da server.ts per accorgersi se
// qualcuno lancia `ng serve` senza rigenerare gli statici dopo una modifica a global-settings.json.
const CONFIG_FINGERPRINT = fingerprintIdentitySections(_settings);
const _fileLoc = _settings.Localization ?? {};
const _fileProject = _settings.project ?? {};
// Solo identità MINIMA finisce in environment.ts: aspetto/comportamento è migrato in site.ts
// (struttura o DesignSystemPreset), filtrato via qui anche se un vecchio JSON lo contiene ancora.
const SITE_CONFIG = _settings.site ?? {};
const SITE_AESTHETIC_KEYS = ['description', 'colorTema'];

// Identità dell'app — fonte unica: project.name / project.version.
const APP_NAME = _fileProject.name || 'App';
const APP_VERSION = _fileProject.version || '1.0.0';
const COLOR_TEMA = SITE_CONFIG.colorTema ?? '#888888';
// Gli override colore sono una proposta del design system attivo (site.ts), letta da
// ContestoSito.config senza rischio di staleness (site.ts non passa da environment.ts, a
// differenza di COLOR_TEMA/SITE_CONFIG sopra). Stesso set di campi di AppearanceService._overrides
// (client)/app.config.server.ts/og-preview.ts: le quattro fonti devono restare sincronizzate.
const COLOR_OVERRIDES = {
    secondary: ContestoSito.config.colorSecondary,
    background: ContestoSito.config.colorBackground,
    text: ContestoSito.config.colorText,
    info: ContestoSito.config.colorInfo,
    customPalette: ContestoSito.config.customPalette,
    backgroundVividness: ContestoSito.config.backgroundVividness,
    mutezzaSecondarioFattore: MUTEZZA_SECONDARIO_FATTORE[ContestoSito.config.mutezzaSecondario],
    separazioneSuperficiFattore: SEPARAZIONE_SUPERFICI_FATTORE[ContestoSito.config.separazioneSuperfici],
};
// Tono forzato — GIÀ risolto da siteBuilder.ts (shell.forceThemeTone in site.ts, diretto o via un
// shell.designSystem che lo preveda).
const FORCE_THEME_TONE: 'light' | 'dark' | undefined = ContestoSito.config.forceThemeTone;

// PWA on/off: guida i TRIGGER di installabilità (manifest, <link rel="manifest">, meta
// mobile-web-app-*). La de-registrazione runtime del SW è gestita da cookie-consent.service.ts;
// qui solo il lato generazione statici.
const IS_WEBAPP = ContestoSito.config.isWebApp;

const _normLang = (tag: unknown): string | null => {
    if (typeof tag !== 'string' || !tag.trim()) return null;
    try { return new Intl.Locale(tag.trim()).language ?? null; } catch { return null; }
};

// Lingue di build dai codici dichiarati in global-settings.json (Localization): le leggono i
// consumatori sincroni a module-load (routing per-lingua, fallback di pickLocaleText, shell
// statica). Gli stessi codici alimentano la cultura runtime derivata via Intl (LocalizationService);
// l'SSR riscrive comunque lang/meta per richiesta.
const _defaultRaw   = _fileLoc.DefaultLanguage;
const _supportedRaw = _fileLoc.SupportedLanguages;

const DEFAULT_LANG = _normLang(_defaultRaw) ?? 'it';
// `?? [DEFAULT_LANG]` da solo copre solo null/undefined: uno `SupportedLanguages: []` esplicito (mai
// validato a runtime, lo schema JSON lo vieta solo sulla carta) lo attraverserebbe intatto, producendo
// AVAILABLE_LANGS=[] → routing.ts/siteBuilder.ts costruiscono zero rotte/sitemap dal build in poi,
// senza errore. Stesso guard di scripts/test/i18n-check.sh: fallback su array vuoto O dopo la
// normalizzazione (tag tutti malformati filtrati via) se il risultato resta vuoto.
const _normalizedSupported = (_supportedRaw && _supportedRaw.length > 0 ? _supportedRaw : [DEFAULT_LANG])
    .map(_normLang)
    .filter((l): l is string => l !== null)
    .filter((v, i, a) => a.indexOf(v) === i); // deduplication
const AVAILABLE_LANGS = _normalizedSupported.length > 0 ? _normalizedSupported : [DEFAULT_LANG];

// description: mappa per-lingua { it, en, ... } (accetta anche una stringa singola,
// normalizzata sulla lingua default). environment.ts riceve la mappa; i file statici
// usano la lingua default (in SSR i meta sono riscritti per richiesta).
const _rawDesc = SITE_CONFIG.description;
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
// L'identità legale/social del brand e il tipo entità sono dato runtime, serviti
// dall'Engine (GET /identity), e alimentano da lì footer, pagine legali e JSON-LD.
const SITE_CONFIG_OUT = {
    ...Object.fromEntries(
        Object.entries(SITE_CONFIG).filter(([k]) => SITE_AESTHETIC_KEYS.includes(k) && k !== 'description')
    ),
    description: DESCRIPTION_MAP,
};

const INDEX = join(ROOT, 'src', 'index.html');
const MANIFEST = join(ROOT, 'public', 'manifest.webmanifest');
const ROBOTS = join(ROOT, 'public', 'robots.txt');

const THEME_INIT = join(ROOT, 'public', 'theme-init.js');

// Rimuove lo slash finale per evitare doppi slash negli URL generati
const BASE_URL = (process.env['FRONTEND_BASE_URL'] || 'https://example.com').replace(/\/$/, '');

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

/** Stessa lista di translate.service.ts (RTL_LANGUAGES) — duplicata qui perché questo è uno
 *  script Node standalone, non un contesto Angular: importare il service trascinerebbe l'intero
 *  DI framework per una costante statica. */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'dv', 'ckb']);
// Unica fonte per <html dir> e manifest.webmanifest["dir"]: stessa lingua, stesso verso.
const DIR = RTL_LANGUAGES.has(DEFAULT_LANG) ? 'rtl' : 'ltr';

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
    html = replaceTag(html, /<html\b[^>]*>/, `<html lang="${lang}" dir="${DIR}">`, '<html lang>');
    html = replaceTag(html, /<title>[^<]*<\/title>/, `<title>${appName}</title>`, '<title>');

    const defaultImageUrl = `${BASE_URL}/icons/icon-512x512.png`;
    const updatedTime = getLastModifiedDate(_fileProject);

    // <meta name="theme-color"> è omesso: viene iniettato dinamicamente per-request
    // dall'app-initializer SSR (app.config.server.ts), con varianti light/dark via media attribute.
    const allMeta: ['name' | 'property', string, string][] = [
        ['name', 'app-version', APP_VERSION],
        ['property', 'og:updated_time', updatedTime],
        ['name', 'description', description],
        // I meta apple-mobile-web-app-* sono trigger PWA e vivono nel blocco PWA
        // condizionato da IS_WEBAPP (vedi più sotto), così spariscono quando il sito
        // non è installabile invece di restare sempre presenti.
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

    // Genera il file TS con identità, lingue e config di sito per il frontend (invece di esporre
    // JSON nel meta tag). Sorgente: global-settings.json (project / Localization / site). Le lingue
    // qui sono il seed di build (shell, fallback pickLocaleText, pagina cookie); la cultura runtime
    // (nomi nativi, giorni, formati) la deriva il frontend via Intl.
    const generatedTsPath = join(ROOT, 'src', 'environments', 'environment.ts');
    const generatedTsContent = `// FILE GENERATO AUTOMATICAMENTE DA scripts/build/generate-statics.ts
// Non modificare manualmente. Sorgente di verità: global-settings.json (sezioni project / Localization / site)

export interface AppSiteConfig {
    description?: Record<string, string>;
    colorTema?: string;
}

export interface AppEnvironment {
    appName: string;
    version: string;
    defaultLang: string;
    availableLanguages: string[];
    config: AppSiteConfig;
    /** Impronta di project/Localization/site al momento della generazione (vedi
     *  core/engine/scripts/config/config-fingerprint.ts). server.ts la confronta con quella
     *  ricalcolata al boot per accorgersi se global-settings.json è cambiato da allora
     *  senza rilanciare generate:statics (es. \`ng serve\` lanciato senza i pre-hook npm). */
    configFingerprint: string;
}

export const environment: AppEnvironment = {
    appName: ${JSON.stringify(APP_NAME)},
    version: ${JSON.stringify(APP_VERSION)},
    defaultLang: '${DEFAULT_LANG}',
    availableLanguages: ${JSON.stringify(AVAILABLE_LANGS)},
    config: ${JSON.stringify(SITE_CONFIG_OUT, null, 8).replace(/\n/g, '\n    ')},
    configFingerprint: ${JSON.stringify(CONFIG_FINGERPRINT)}
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

    // Apple Touch Icon: SEMPRE presente, indipendentemente da IS_WEBAPP. "Aggiungi a Home"
    // su iOS/Safari funziona anche senza manifest/Service Worker — un sito non-PWA con questo
    // link ottiene comunque un'icona vera in home invece del placeholder (screenshot della
    // pagina) che Safari userebbe altrimenti.
    html = replaceTag(
        html,
        /<link rel="apple-touch-icon"[^>]*>/,
        '<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon-180x180.png">',
        '<link rel="apple-touch-icon">'
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
    // Trigger di installabilità in un blocco delimitato da marker, rigenerato per intero: con
    // IS_WEBAPP iniettati, altrimenti rimossi. Solo marker nudi (PWA:START/END) nell'HTML servito,
    // nessun path di build o nome di flag di config nel sorgente pubblico.
    const pwaBlock = IS_WEBAPP
        ? '\n    ' + [
            '<meta name="mobile-web-app-capable" content="yes">',
            `<meta name="apple-mobile-web-app-status-bar-style" content="${iosStatusBar}">`,
            `<meta name="apple-mobile-web-app-title" content="${appName}">`,
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
    // PWA disattivata: rimuove un eventuale manifest residuo di un build precedente (toggle
    // isWebApp true→false), così il sito non resta installabile via un file vecchio.
    if (!IS_WEBAPP) {
        if (existsSync(MANIFEST)) {
            rmSync(MANIFEST);
            console.log('[statics] manifest.webmanifest rimosso (isWebApp:false → sito non installabile)');
        } else {
            console.log('[statics] manifest.webmanifest non generato (isWebApp:false)');
        }
        return;
    }

    const palette = AppearanceService.computePalette(COLOR_TEMA, COLOR_OVERRIDES);

    const manifest: Record<string, unknown> = {
        name: APP_NAME,
        short_name: APP_NAME,
        // Relativo come scope/start_url, mai un "/" assoluto hardcoded (ogni progetto figlio ha il
        // proprio dominio). Dichiarato esplicito anche se oggi coincide con start_url (spec: id
        // assente vi ricade): un domani start_url con un query param non cambierebbe l'identità installata.
        id: "./",
        description: DESCRIPTION,
        lang: DEFAULT_LANG,
        dir: DIR,
        theme_color: palette.colorPrimary,
        background_color: (FORCE_THEME_TONE ?? palette.naturalTone) === 'light' ? palette.colorBaseLt : palette.colorBaseDk,
        display: "standalone",
        scope: "./",
        start_url: "./",
        // `any` e `maskable` sono DUE file/entry separate (mai un solo "purpose": "any maskable"
        // combinato): un'icona maskable ha già il suo padding di sicurezza, quindi usata anche
        // come `any` apparirebbe più piccola del dovuto fuori da un contesto di masking adattivo.
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
                purpose: "any"
            },
            {
                src: "icons/icon-512x512-maskable.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable"
            }
        ],
        version: APP_VERSION
    };

    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 4)}\n`, 'utf8');
    console.log(`[statics] manifest.webmanifest aggiornato`);
}

// ── Generazione robots.txt ────────────────────────────────────────────────

function updateRobots(): void {
    // Le pagine protette (`requiresAuth`) non sono elencate come `Disallow`: un robots.txt è
    // pubblico, enumerarle ne rivelerebbe i path. La non-indicizzazione è affidata a runtime al
    // server SSR con `X-Robots-Tag: noindex`, che vale anche per i crawler che ignorano
    // robots.txt. SEO_NOINDEX (staging) serve un robots.txt dinamico `Disallow: /` a runtime.
    const lines = ['User-agent: *', 'Allow: /', '', `Sitemap: ${BASE_URL}/sitemap.xml`];

    writeFileSync(ROBOTS, lines.join('\n') + '\n', 'utf8');
    console.log(`[statics] robots.txt aggiornato`);
}



// ── Generazione theme-init.js (anti-flash tema, pre-idratazione) ───────────

function updateThemeInit(): void {
    // Script anti-flash: imposta data-bs-theme/data-theme-tone su <html> prima che Bootstrap carichi
    // qualsiasi stile, eseguito sincrono nel <head>. Esterno (non inline): coperto da script-src
    // 'self' in CSP, niente hash/nonce. public/ è gitignored: va materializzato qui o mancherebbe
    // su un checkout pulito. Tono forzato = valore baked-in, niente matchMedia da ascoltare.
    const script = FORCE_THEME_TONE
        ? `(function () {
    var el = document.documentElement;
    el.setAttribute('data-bs-theme', '${FORCE_THEME_TONE}');
    el.setAttribute('data-theme-tone', '${FORCE_THEME_TONE}');
}());
`
        : `(function () {
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
    updateRobots();

    updateThemeInit();
}

main();
