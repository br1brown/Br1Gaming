#!/usr/bin/env node
/**
 * setup.mjs — Inizializza un nuovo progetto a partire dal template Br1WebEngine.
 *
 * Uso:
 *   node setup.mjs "Nome Progetto"
 *   node setup.mjs          ← chiede il nome in modo interattivo
 *
 * Cosa fa SEMPRE (battesimo):
 *   1. Imposta project.name in global-settings.json (file committabile: identità del progetto)
 *   2. Crea global-settings.local.json (gitignored) con pubblicazione (porte/deploy) e
 *      API key e SecretKey JWT generate. Il login nasce spento comunque: lo
 *      accende Features.Login/PublicLogin in global-settings.json, scelta esplicita.
 *   3. Rinomina gli identificatori npm/SW generici "app" → slug del prodotto
 *      (frontend/package.json, frontend/ngsw-config.json)
 *   4. Rinomina App.sln → NomeProgetto.sln
 *
 * Poi CHIEDE conferma [s/N] per la "cerimonia" da template a progetto (DISTRUTTIVA):
 *   5. Rimuove la demo (frontend + backend): pagina Social + galleria social
 *      (store/SiteService/social.json), home → placeholder, addon i18n filtrato alle sole
 *      chiavi ancora in uso, BaseController minimo, data/identity.json azzerato a scheletro
 *      (salvo titolare ed email, chiesti qui: la Privacy Policy li vuole),
 *      site.ts/nav.ts riscritti. L'identità del sito resta servita dall'Engine (GET /identity).
 *      "Che faccio" (vetrina delle funzionalità Engine) NON viene cancellata: resta una rotta
 *      viva (fuori menu, /che-faccio) da consultare mentre costruisci il tuo sito — il pezzo
 *      che dipendeva dal Social (DEMO_BLOCK in che-faccio.component.ts/.html) viene rimosso.
 *   6. Elimina il README.md vetrina del template.
 *   7. Elimina .github/CODE_OF_CONDUCT.md e .github/CONTRIBUTING.md (governance da
 *      repo open source: fork, PR pubbliche, issue tracker pubblico — morti in un
 *      figlio privato) e sfoltisce .github/SECURITY.md dell'header di reporting
 *      vulnerabilità (email dell'autore del template), tenendo features+checklist.
 *   8. Esegue i controlli statici disponibili (lint/tsc/i18n/cicli) come gate.
 *   9. Fa un commit locale "init <Nome>".
 *
 * Lo script RESTA nel repo dopo la cerimonia: cancellarlo produrrebbe un conflitto modify/delete a
 * ogni merge dal template che lo tocca. Un secondo lancio riconosce l'eject fatto (README.md
 * assente) e non fa nulla.
 */

import { readFileSync, writeFileSync, existsSync, renameSync, rmSync } from 'fs';
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
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
        console.log(`  =  invariato: ${filePath}`);
        return false;
    }
    writeFileSync(filePath, after, 'utf-8');
    console.log(`  ✓  aggiornato: ${filePath}`);
    return true;
}

function writeNew(filePath, content) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✓  riscritto: ${filePath}`);
}

function removeChunk(src, chunk, label) {
    if (!src.includes(chunk)) {
        console.warn(`  ⚠  blocco non trovato (${label}): salto`);
        return src;
    }
    return src.replace(chunk, '');
}

/** Rimuove ogni `<!-- <DEMO_BLOCK_START> -->…<!-- <DEMO_BLOCK_END> -->` (o l'equivalente a
 *  commento `//`) da un file: stesso marcatore, letto da C#/TS/HTML — vedi Program.cs. */
function stripDemoBlocks(filePath, style, label) {
    const regex = style === 'html'
        ? /<!-- <DEMO_BLOCK_START> -->[\s\S]*?<!-- <DEMO_BLOCK_END> -->\r?\n?/g
        : /\/\/ <DEMO_BLOCK_START>[\s\S]*?\/\/ <DEMO_BLOCK_END>\r?\n?/g;
    editFile(filePath, src => {
        if (!regex.test(src)) {
            console.warn(`  ⚠  blocco DEMO_BLOCK non trovato in ${label}: salto`);
        }
        return src.replace(regex, '');
    });
}

// Chiavi addon.*.json ancora usate dopo l'eject: solo "che faccio" (tenuta viva, fuori menu) +
// login-form (pezzo pronto ma non ricablato di default, resta sul disco). Tutto il resto — home
// demo, Social, footer/nav della demo, impostazioni — sparisce con le pagine che lo usavano.
// Aggiorna questa lista se che-faccio.component.html/ts cambia le chiavi che usa.
const CHE_FACCIO_ADDON_KEYS = [
    'cheFaccioNav',
    'sectionActions', 'sectionGenerators', 'sectionQr', 'sectionNotify', 'sectionSystem',
    'markdownLabTitle', 'markdownLabDesc', 'markdownInputLabel', 'markdownPlaceholder',
    'markdownAutoPreview', 'markdownShortcutHint', 'markdownPreviewTitle', 'markdownHtmlOutputTitle',
    'copyHtml', 'actionDemoText', 'presetBase', 'presetTable',
    'themeAccessibilityTitle', 'accessibilityDesc', 'i18nTitle', 'i18nDesc', 'labelLang',
    'apiStatusTitle', 'internalsApiDesc',
    'uploadDemoTitle', 'uploadDemoDesc',
    'assetResolverTitle', 'assetResolverDesc', 'assetResolverInputLabel', 'assetPreviewAlt',
    'imageTextPlaceholder', 'imageSize', 'imgBuilderTitle', 'imgBuilderDesc', 'imgContextMenuHint',
    'modalDemoTitle', 'modalDemoDesc', 'modalAlertBtn', 'modalConfirmBtn', 'modalFormBtn',
    'modalAlertBody', 'modalConfirmTitle', 'modalConfirmBody',
    'modalChooseBtn', 'modalChooseTitle', 'modalChooseBody', 'modalChooseSave', 'modalChooseDiscard',
    'modalChooseSaved', 'modalChooseDiscarded',
    'modalPromiseBtn', 'modalPromiseSaving', 'modalPromiseSuccess',
    'modalFormTitle', 'speechPlaying', 'modalFormNameLabel', 'modalFormSubmit', 'modalResultSubmitted',
    'usageCodeLabel', 'resetAction',
    'qrCodeTitle', 'qrCodeDesc', 'qrType', 'qrTypeText', 'qrTypeWhatsapp', 'qrTypeEmail', 'qrTypeWifi',
    'qrTypeSepa', 'qrContent', 'qrContentPlaceholder', 'qrPhone', 'qrWhatsappText',
    'qrEmailRecipient', 'qrEmailSubject', 'qrEmailBody', 'qrSsid', 'qrWifiPassword', 'qrWifiEncryption',
    'qrWifiEncWpa', 'qrWifiEncWep', 'qrWifiEncNone', 'qrIban', 'qrBeneficiaryName', 'qrAmount',
    'qrRemittance', 'qrGenerate', 'qrCodeAlt', 'qrCodeEmpty', 'originalSize',
    'actionComponentsTitle', 'actionComponentsDesc', 'actionDemoInputLabel',
    'demoActionsGroup', 'demoContactsGroup', 'demoNavGroup',
    // login-form (components/shared/login-form/): "pezzo pronto" non cancellato dall'eject
    // (si ricablega attivando il login, vedi PageType in MINIMAL_SITE_TS) — la sua unica chiave.
    'loginUsernameObbligatorio',
];

/** Filtra addon.it.json/addon.en.json alla whitelist sopra: i VALORI restano quelli reali del
 *  catalogo (mai copiati qui), solo le chiavi non più referenziate da nessun file superstite
 *  spariscono (home demo, Social, footer/nav demo, impostazioni). */
function pruneAddonI18n(fe) {
    for (const lang of ['it', 'en']) {
        editFile(join(fe, `assets/i18n/addon.${lang}.json`), src => {
            const full = JSON.parse(src);
            const kept = {};
            for (const key of CHE_FACCIO_ADDON_KEYS) {
                if (key in full) kept[key] = full[key];
            }
            return JSON.stringify(kept, null, 2) + '\n';
        });
    }
}

// ── Contenuti minimi del "progetto vuoto" (scritti dall'eject) ───────────────

const MINIMAL_SITE_TS = `import { inject } from '@angular/core';
import { buildSite } from './core/engine/siteBuilder';
import { extendDesignSystem, emptyDesignSystem } from './core/engine/design-system-presets';
import { ApiService } from './core/services/api.service';
// "export type { X } from" sotto RI-esporta X ma non lo mette in scope in QUESTO file: per
// usarlo nella firma di withApi (sotto) serve anche l'import esplicito.
import type { ContentLoader, ContentLoaderContext, ContentLoaderResult } from './core/engine/siteBuilder';

export type {
    SiteConfig,
    SitePageInput,
    SmokeSettings,
    ContentLoader,
    ContentLoaderContext,
    ContentLoaderResult
} from './core/engine/siteBuilder';

/** Helper opzionale per le rotte: inietta l'ApiService e tipizza il contentLoader. */
export function withApi(loaderFn: (ctx: ContentLoaderContext, api: ApiService) => Promise<ContentLoaderResult>): ContentLoader {
    return (ctx) => loaderFn(ctx, inject(ApiService));
}

// ═══════════════════════════════════════════════════════════════════════
// PageType — identità di ogni pagina
// ═══════════════════════════════════════════════════════════════════════
// Ogni pagina DEVE avere un valore qui. Aggiungine uno e usalo in
// pages / nav.ts: rotte, menu e sitemap si aggiornano da soli.
// A poche pagine un oggetto piatto come questo basta; se il progetto cresce,
// dividilo in più file (uno per area tematica, sotto pages/) e assemblalo
// qui con lo spread (es. ...AppPages esportato da pages/app.pages.ts).
export const PageType = {
    Home: 'home',
    // Vetrina Engine tenuta viva dall'eject (fuori menu: nessun addPage in nav.ts).
    // Cancellala pure insieme a pages/che-faccio/ quando non ti serve più da consultare.
    CheFaccio: 'che-faccio',
    PrivacyPolicy: 'legal.privacy',
} as const;
export type PageType = (typeof PageType)[keyof typeof PageType];

// Struttura del sito: pagine e slot. Identità ed estetica stanno in global-settings.json.
//
// LOGIN spento (Features in global-settings.json). Per accenderlo: Features.Login (riservato) o
// PublicLogin (in navbar), poi PageType.Login + la sua pagina in pages e loginPage: PageType.Login.
//
// PAGINE LEGALI (\`legal\`): uno slot per pagina, valorizzato con un PageType qui sopra. Privacy
// obbligatoria; \`cookie\` obbligatorio con cookie o PWA; termsOfService/legalNotice/accessibility a scelta.
//
// Aspetto di navbar/footer/pannello: design system attivo. \`emptyDesignSystem\` è il più neutro,
// estendilo con \`extendDesignSystem\`.
const designSystem = extendDesignSystem(emptyDesignSystem, {
    navbar: { fissa: true }, // default: false — qui la navbar resta fissa in alto allo scroll
    // Ruolo custom \`senzaNavbar\`: si registra scrivendo la sua chiave qui, nessuna dichiarazione
    // a parte — usalo su una pagina con \`layout: { role: 'senzaNavbar' }\`.
    ruoloPagina: {
        senzaNavbar: { showNav: false },
    },
});

export const ContestoSito = buildSite({
    homePage: PageType.Home,
    legal: {
        privacy: PageType.PrivacyPolicy,
    },

    shell: {
        designSystem,
    },

    pages: () => [
        {
            path: '',
            title: '',
            pageType: PageType.Home,
            component: () => import('./pages/home/home.component').then(m => m.HomeComponent),
            // Skeleton pulito: la home parte senza navbar (ruolo 'senzaNavbar', sopra). Togli questo
            // layout (o cambia ruolo) quando vuoi la shell anche qui.
            layout: { role: 'senzaNavbar' },
        },
        {
            // Path PER-LINGUA a scopo dimostrativo (BasePageInput.path come oggetto, non solo
            // prefissato): lo switch lingua e la sitemap seguono da soli. Volutamente fuori da
            // nav.ts: si raggiunge solo digitando l'URL, non compare in nessun menu.
            path: { it: 'che-faccio', en: 'what-i-do' },
            title: 'cheFaccioNav',
            pageType: PageType.CheFaccio,
            otherSEO: { noindex: true },
            component: () => import('./pages/che-faccio/che-faccio.component').then(m => m.CheFaccioComponent),
        },
    ],
    // Menu di header/footer: dato risolto a runtime in nav.ts —
    // popolalo con addPage / addLink / addGroup quando aggiungi pagine.
});
`;

const MINIMAL_NAV_TS = `import type { ShellNavResolver } from './core/engine/shell-nav';

// Menu di header/footer, risolti a runtime (anche async, es. per utente loggato): addPage/addLink/addGroup.
// footer assente di proposito: vale quello di serie dell'Engine (dati societari, P.IVA, contatti, social).
export const navResolver: ShellNavResolver = {
    header: (_h) => {
    },
};
`;

const MINIMAL_HOME_TS = `import { Component } from '@angular/core';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { StyleGuideComponent } from '../../core/engine/components/style-guide/style-guide.component';

/** Home del progetto — punto di partenza vuoto. Riempila col tuo contenuto. */
@Component({
    selector: 'app-home',
    imports: [StyleGuideComponent],
    templateUrl: './home.component.html',
})
export class HomeComponent extends PageBaseComponent<void> {}
`;

const MINIMAL_HOME_HTML = `<!-- La home del tuo progetto: parti da qui. -->

<!-- Catalogo visivo dei componenti UI di base (colori, tipografia, bottoni, badge, alert, form):
     componente dell'Engine, non demo — resta qui apposta, anche dopo l'eject. Rimuovilo se non ti
     serve, si aggiorna comunque dal template finché non lo tocchi. -->
<app-style-guide />
`;

const MINIMAL_BASECONTROLLER_CS = `using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Controller pubblico del progetto (API key). Eredita sicurezza e logger da
/// <see cref="EngineApiController"/>. Punto di partenza vuoto: aggiungi qui i tuoi endpoint.
/// </summary>
/// <remarks>
/// L'identità del sito (footer, pagine legali, SEO) è servita dall'Engine su GET /identity:
/// non si scrive qui, basta riempire data/identity.json.
/// </remarks>
[Route("")]
public class BaseController : EngineApiController
{
    /// <summary>Inizializza il controller col logger ereditato dall'Engine.</summary>
    public BaseController(ILogger<BaseController> logger) : base(logger) { }
}
`;

// identity.json azzerato a scheletro, salvo titolare ed email chiesti alla cerimonia: la Privacy Policy
// composta dall'Engine li vuole, e senza il build si ferma. Il resto il figlio lo riempie o lo lascia vuoto
// (footer e JSON-LD nascondono i campi assenti). Lo schema (engine, in Engine/Models/Identity/) dà
// validazione e autocomplete su questo file.
const minimalIdentityJson = (titolare, email) => `{
    "$schema": "../Engine/Models/Identity/identity.schema.json",
    "personal": false,
    "ragioneSociale": ${JSON.stringify(titolare)},
    "partitaIva": "",
    "codiceFiscale": "",
    "sedeLegale": { "via": "", "civico": "", "cap": "", "citta": "", "provincia": "", "nazione": "" },
    "contatti": { "telefono": "", "email": ${JSON.stringify(email)}, "pec": "" },
    "datiSocietari": { "registroImprese": "", "numeroRea": "", "codiceSdi": "" },
    "social": [],
    "currency": "EUR",
    "metadatiAggiuntivi": {}
}
`;

// ── Eject: da template a progetto ────────────────────────────────────────────

function ejectDemo(titolare, email) {
    console.log('\n  Rimozione demo (template → progetto)...');
    const fe = join(ROOT, 'frontend/src');
    const be = join(ROOT, 'backend');

    // Riscrittura dei file "di partenza" (dominio del figlio).
    writeNew(join(fe, 'app/site.ts'), MINIMAL_SITE_TS);
    writeNew(join(fe, 'app/nav.ts'), MINIMAL_NAV_TS);
    writeNew(join(fe, 'app/pages/home/home.component.ts'), MINIMAL_HOME_TS);
    writeNew(join(fe, 'app/pages/home/home.component.html'), MINIMAL_HOME_HTML);
    // addon i18n: non azzerato a {} come gli altri file demo-only, perché "che faccio" (tenuta
    // viva sotto) usa un centinaio di quelle chiavi — filtrato alla sola whitelist ancora in uso,
    // i valori restano quelli reali del catalogo (mai duplicati qui: se cheFaccio cambia testo,
    // l'eject lo eredita automaticamente).
    pruneAddonI18n(fe);
    writeNew(join(be, 'Controllers/BaseController.cs'), MINIMAL_BASECONTROLLER_CS);

    // L'identità è servita dall'Engine (GET /identity): qui resta solo il dato, azzerato a scheletro.
    // La galleria social era una demo (store + SiteService + social.json) → brucia per intero.
    writeNew(join(be, 'data/identity.json'), minimalIdentityJson(titolare, email));
    rmSync(join(be, 'Services/SiteService.cs'), { force: true });
    rmSync(join(be, 'Store/IContentStore.cs'), { force: true });
    rmSync(join(be, 'Store/FileContentStore.cs'), { force: true });
    rmSync(join(be, 'data/social.json'), { force: true });
    console.log('  ✓  bruciati: SiteService, IContentStore/FileContentStore, data/social.json');
    console.log('  ✓  azzerato a scheletro, con titolare ed email: backend/data/identity.json');

    // Program.cs: via le registrazioni dello store/SiteService demo.
    stripDemoBlocks(join(be, 'Program.cs'), 'cs', 'Program.cs');

    // Niente più un case da ripulire in content.resolver.ts (Engine, non si tocca): la demo
    // Social porta la propria logica in app.pages.ts (contentLoader/dynamicParams), cancellato
    // sotto in blocco con l'intera pagina — non resta nulla da disattivare a mano nel resolver.

    // api.service: via getSocial + path + import HttpParams (usato solo lì).
    stripDemoBlocks(join(fe, 'app/core/services/api.service.ts'), 'ts', 'api.service.ts');

    // Cancella le pagine demo (Social) e l'area che le dichiarava: il nuovo site.ts minimale
    // non importa più da app.pages.ts, che senza questa rimozione resterebbe sul disco con un
    // import morto verso ./social/social.component (cancellato sotto) — compilato comunque
    // (tsconfig non ha un `include` che lo escluda), build rotta.
    rmSync(join(fe, 'app/pages/app.pages.ts'), { force: true });
    rmSync(join(fe, 'app/pages/social'), { recursive: true, force: true });
    console.log('  ✓  rimosse: frontend/src/app/pages/{app.pages.ts, social}');

    // "Che faccio" NON si cancella: resta una rotta viva (site.ts sopra la instrada fuori menu)
    // per consultare dal vivo la vetrina delle funzionalità Engine mentre costruisci il sito —
    // cancellala a mano quando non ti serve più. L'unico pezzo che non sopravviverebbe
    // all'eject è la card che chiamava il Social (DEMO_BLOCK, via stripDemoBlocks sotto);
    // il resto (markdown, QR, action components, upload, asset resolver...) non dipende da nulla
    // che questo script rimuove.
    stripDemoBlocks(join(fe, 'app/pages/che-faccio/che-faccio.component.ts'), 'ts', 'che-faccio.component.ts');
    stripDemoBlocks(join(fe, 'app/pages/che-faccio/che-faccio.component.html'), 'html', 'che-faccio.component.html');
    // Il playground "Asset Resolver" punta di default all'asset demo 4K, cancellato sotto insieme
    // al resto della demo: senza questo ripuntamento mostrerebbe un'immagine rotta al primo giro.
    editFile(join(fe, 'app/pages/che-faccio/che-faccio.component.ts'), src =>
        src.replace("assetId = 'img4k';", "assetId = 'favIcon';")
    );

    // Asset demo 4K (usato dal playground di resize nella home demo): via il file e la voce
    // dal mapping. Nel progetto resta solo la favicon; la home placeholder non lo referenzia.
    // Robusto: legge il nome reale del file da mapping.json (chiave img4k), così non è hardcoded.
    const mappingPath = join(fe, 'assets/mapping.json');
    if (existsSync(mappingPath)) {
        try {
            const mapping = JSON.parse(readFileSync(mappingPath, 'utf-8'));
            if (mapping.img4k) {
                rmSync(join(fe, 'assets/files', mapping.img4k), { force: true });
                delete mapping.img4k;
                writeFileSync(mappingPath, JSON.stringify(mapping, null, 4) + '\n', 'utf-8');
                console.log('  ✓  rimosso asset demo 4K (file + voce mapping; resta la favicon)');
            }
        } catch {
            console.warn('  ⚠  mapping.json non leggibile: salto la rimozione dell\'asset 4K');
        }
    }
}

/**
 * Controlli statici disponibili come gate pre-commit. Ritorna true se si può committare.
 * Senza node_modules i controlli che richiedono i tool vengono saltati (non bloccano).
 */
function runChecks() {
    if (!existsSync(join(ROOT, 'frontend/node_modules'))) {
        console.warn('  ⚠  frontend/node_modules assente: salto i controlli statici (lancia `npm install` e ri-verifica).');
        return true;
    }
    const checks = [
        ['lint', 'bash scripts/test/lint-check.sh'],
        ['tsc', 'bash scripts/test/tsc-check.sh'],
        ['i18n', 'bash scripts/test/i18n-check.sh'],
        ['cicli', 'bash scripts/test/circular-deps-check.sh'],
    ];
    let ok = true;
    for (const [name, cmd] of checks) {
        console.log(`\n  ▶ ${name}`);
        try {
            execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
        } catch (e) {
            if (e && e.status === 2) { console.warn(`  ⚠  ${name}: saltato (tool non disponibile)`); continue; }
            console.error(`  ✗  ${name}: FALLITO`);
            ok = false;
        }
    }
    return ok;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n──────────────────────────────────────────');
    console.log(' Setup progetto da template Br1WebEngine');
    console.log('──────────────────────────────────────────\n');

    // Eject già fatto (il README vetrina è l'unico file che la cerimonia toglie e nessun merge riporta):
    // niente da rifare, e soprattutto niente cerimonia distruttiva ripetuta.
    if (!existsSync(join(ROOT, 'README.md'))) {
        console.log('  =  Progetto già inizializzato (cerimonia fatta): niente da fare.\n');
        return;
    }

    // Il driver `merge=ours` di .gitattributes (file interamente del figlio) non è built-in in git:
    // senza questa config i file protetti andrebbero in conflitto a ogni merge dal template.
    try {
        execSync('git config merge.ours.driver true', { cwd: ROOT, stdio: 'ignore' });
        console.log('  ✓  git config merge.ours.driver true (i file merge=ours restano del progetto ai merge dal template)');
    } catch { /* repo non ancora inizializzato o git assente: lo dice QUICKSTART */ }

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
        // Primo "name" del file = project.name. Features tutto spento: il figlio accende a mano ciò che
        // usa (il backend non parte se una funzione accesa non ha la sua configurazione).
        src => src
            .replace(/("name"\s*:\s*)"[^"]*"/, `$1${JSON.stringify(displayName)}`)
            .replace(/("Features"\s*:\s*)\{[^}]*\}/, '$1{ "Login": false, "PublicLogin": false, "Mail": false, "ErrorReporting": false, "Forms": false }')
    );

    // ── 2. global-settings.local.json: pubblicazione + chiavi generate (gitignored) ──
    // Tutte le chiavi si generano SEMPRE: la SecretKey è il requisito del login, non l'interruttore
    // (Features, spento di default).
    const localPath = join(ROOT, 'global-settings.local.json');
    if (existsSync(localPath)) {
        console.log('  =  global-settings.local.json già presente — non sovrascritto');
    } else {
        const local = {
            $schema: './global-settings.schema.json',
            frontend: { hostname: '', port: 3000 },
            backend: { public: false, publicPort: null },
            Security: {
                ApiConfig: {
                    Keys: [randomBytes(32).toString('base64')],
                },
                CorsOrigins: [],
                BehindProxy: false,
                Token: { SecretKey: randomBytes(48).toString('base64') },
            },
        };
        writeFileSync(localPath, JSON.stringify(local, null, 2) + '\n', 'utf-8');
        console.log('  ✓  creato global-settings.local.json (porte/deploy + chiavi generate; login spento finché non lo accendi in Features)');
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

    // ── 5. Cerimonia "da template a progetto" (DISTRUTTIVA, su conferma) ──
    console.log('\n──────────────────────────────────────────');
    console.log(' Cerimonia: da TEMPLATE a PROGETTO');
    console.log('──────────────────────────────────────────');
    console.log(' Rimuove la demo (Social + galleria social + home svuotata + addon + backend minimo,');
    console.log(' identity.json azzerato),');
    console.log(' elimina il README vetrina, esegue i controlli');
    console.log(` e fa un commit locale "init ${displayName}".`);
    const answer = (await ask('\n  Procedo? [s/N]: ')).toLowerCase();

    if (answer !== 's' && answer !== 'si' && answer !== 'sì') {
        console.log('\n  Cerimonia saltata: resta il template completo (demo inclusa).');
        console.log('  Puoi rilanciare `node setup.mjs` quando sei pronto.\n');
        return;
    }

    // Titolare del trattamento: la Privacy Policy di serie lo mostra, e senza nome e recapito il build si ferma.
    console.log('\n  La Privacy Policy vuole il titolare del trattamento (finisce in backend/data/identity.json).');
    const titolare = (await ask('  Ragione sociale, o nome e cognome: ')).trim();
    const email = (await ask('  Email di contatto del titolare: ')).trim();
    if (!titolare || !email) {
        console.warn('  ⚠  Titolare o email vuoti: il build si fermerà finché non li scrivi in backend/data/identity.json.');
    }
    ejectDemo(titolare, email);

    // README vetrina: il template stesso dice "nel figlio si elimina solo questo README".
    rmSync(join(ROOT, 'README.md'), { force: true });
    console.log('  ✓  rimosso: README.md (vetrina del template)');

    // Governance da repo open source (fork, PR pubbliche, issue tracker pubblico):
    // non ha senso in un figlio privato.
    for (const f of ['CODE_OF_CONDUCT.md', 'CONTRIBUTING.md']) {
        rmSync(join(ROOT, '.github', f), { force: true });
        console.log(`  ✓  rimosso: .github/${f} (governance del template)`);
    }

    // SECURITY.md: l'header di reporting (email dell'autore del template) è
    // template-only; features di sicurezza + checklist deploy restano, utili al figlio.
    editFile(join(ROOT, '.github', 'SECURITY.md'), src => {
        const heading = '## Funzionalità di sicurezza incluse nel template';
        const i = src.indexOf(heading);
        return i === -1 ? src : `# Security Policy\n\n${src.slice(i)}`;
    });

    // Gate: i controlli devono passare prima del commit.
    console.log('\n  Controlli pre-commit...');
    if (!runChecks()) {
        console.error('\n  ✗  Controlli falliti: NIENTE commit. Correggi gli errori e committa a mano.');
        process.exit(1);
    }

    // ── Commit "init" ────────────────────────────────────────────────────
    // setup.mjs resta tracciato: è Scaffold e al merge dal template si aggiorna come il resto.
    try {
        execSync('git add -A', { cwd: ROOT, stdio: 'inherit' });
        execSync(`git commit -m ${JSON.stringify(`init ${displayName}`)}`, { cwd: ROOT, stdio: 'inherit' });
        console.log(`\n  ✅  Progetto inizializzato — commit "init ${displayName}" creato. Buon lavoro!\n`);
    } catch {
        console.warn('\n  ⚠  Commit non riuscito (git assente o niente da committare): committa a mano.\n');
    }
}

main().catch(err => {
    console.error('\nErrore durante il setup:', err.message);
    process.exit(1);
});
