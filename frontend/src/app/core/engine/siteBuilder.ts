import { InjectionToken, isDevMode, type Type } from '@angular/core';
import type { PageType } from '../../site';
import type { PageBaseComponent } from './pages/page-base.component';
import { environment } from '../../../environments/environment';
import { hasCookiesConfigured } from './services/cookie/cookie-utils';
import { buildPolicySection, filterManagedLegalPages, resolveLegalPages, type LegalDefinition, type LegalPageSpec } from './legal/legal-pages';
import type { StructuredDataInput } from './services/structured-data';
import type { BreadcrumbItem, BreadcrumbContext } from './services/breadcrumb';
import type { NavLink } from './shell-nav';
import {
    ERROR_CHROME_DEFAULT, LEGAL_CHROME_DEFAULT, NAKED_CHROME,
    validateDesignSystemPreset, risolviAspetto,
    type DesignSystemFactory, type DesignSystemPreset, type PageRole, type SpecRuoloPagina, type Aspetto,
} from './design-system-presets';
import { resolveFonts, type ResolvedFonts, type CustomFontDef } from './font-system';

export type { PageRole, SmokeSettings } from './design-system-presets';

/** Pagine legali: tipi della sezione `legal` di `site.ts`. */
export type { LegalDefinition, LegalSlot, ExtraLegalPage, LegalPageSpec } from './legal/legal-pages';

// ======================================================
// MODELLI DI CONFIGURAZIONE
// ======================================================

export const SITE_CONFIG = new InjectionToken<SiteConfig>('SITE_CONFIG');

/**
 * Chrome GIÀ RISOLTA (da `resolveRuoloPagina`) per il ruolo della pagina attiva — output del design
 * system, mai scritta a mano. `AppComponent` la legge da `route.data[CHROME_DATA_KEY]`
 * (`normalizeSitePage` → `routing.ts`) per decidere come renderizzarsi ad ogni navigazione.
 */
export interface RouteChrome {
    /** Mostra la navbar. */
    showNav?: boolean;
    /** Mostra il pannello contenuti. */
    showPanel?: boolean;
    /** Mostra il footer. */
    showFooter?: boolean;
    /** Vista full-bleed senza pannello/container. */
    fitViewport?: boolean;
    /** Mostra l'effetto smoke su questa rotta. */
    showSmoke?: boolean;
    /** Mostra il breadcrumb su questa rotta. */
    showBreadcrumb?: boolean;
    /** Mostra l'icona di brand nella navbar su questa rotta. */
    showBrandIcon?: boolean;
}

/** Chiave in `route.data` riservata a `RouteChrome`. */
export const CHROME_DATA_KEY = 'engineChrome';

/** Esposizione di contatti/dati facoltativi nel JSON-LD pubblico (nodo brand). */
export interface JsonLdContactExposure {
    email?: boolean;
    telefono?: boolean;
    indirizzo?: boolean;
    partitaIva?: boolean;
    codiceFiscale?: boolean;
}

/** Configurazione generale del sito. */
export interface SiteConfig {
    /** Nome applicativo del sito. */
    appName: string;
    /** Personalizza il tag `<title>` (e og:title/twitter:title/og:image:alt). Solo da `SiteDefinition.formatBrowserTitle`. Default: `"${pageTitle} | ${appName}"`. */
    formatBrowserTitle?: (pageTitle: string, appName: string) => string;
    /** Il design system attivo con ogni default applicato (`risolviAspetto`): unica fonte per navbar,
     *  footer, pannello, colori, movimento e il resto dell'aspetto del sito. */
    aspetto: Aspetto;
    /** Font risolto (stack CSS, stack server, metriche, @font-face) via `resolveFonts()`: unica fonte per ogni consumer (AppearanceService, server.ts, ImgBuilderService...), nessuno legge il preset direttamente. */
    fonts: ResolvedFonts;
    /** Catalogo grezzo di ogni `CustomFontDef` del sito (`font.principale` + `font.aggiuntivi`, deduplicati per key), non risolto per ruolo: serve a risolvere QUALUNQUE font custom registrato, anche quelli mai scelti come attivo. */
    customFontsCatalog: readonly CustomFontDef[];
    /** Dati facoltativi di `identity` esposti nel JSON-LD del brand. */
    jsonld: JsonLdContactExposure;
    /** Versione canonica dell'applicazione (es. "1.2.0"). */
    version: string;
    /** Descrizione generale del sito per-lingua (chiavi = tag lingua). */
    description: Record<string, string>;
    /** Colore tema principale usato dalla UI — l'unico colore di identità che vive in
     *  `global-settings.json`. Tutto il resto della palette è una proposta del design system
     *  attivo (vedi sotto). */
    colorTema: string;
    /** Link di login in navbar: `Features.PublicLogin` (global-settings.json). */
    showLoginInHeader: boolean;
    /** Mostra il campanellino delle notifiche realtime. Default: false. */
    showNotifications: boolean;
    /** Abilita funzionalità PWA (Service Worker e installazione offline). Default: `false`. */
    isWebApp: boolean;
    /** Chrome del ruolo 'error', già risolta dal design system: `routing.ts` la applica alle rotte di errore (404/401...), che restano nell'Engine e non passano dalla DSL delle pagine. */
    errorChrome: SpecRuoloPagina;
    /** Pagina a cui reindirizzare l'utente se non autenticato (default /error/401). */
    loginPage?: PageType | null;
    /** Pagina home usata dal logo nella navbar. */
    homePage?: PageType | null;
    /** Pagine legali create dall'Engine (risolte dalla sezione `legal` di `site.ts`). */
    legalPages: readonly LegalPageSpec[];
    /** `PageType` della Cookie Policy, o `null` se il sito non usa cookie (nessuna Cookie Policy). */
    cookiePolicy: PageType | null;
    /** Cache in-process per l'endpoint `/sitemap.xml` delle pagine con `dynamicParams`. */
    dynamicSitemapCache: boolean;
    /** Override del calcolo breadcrumb per-PageType. */
    resolveBreadcrumb?: (pageType: PageType, ctx: BreadcrumbContext) => BreadcrumbItem[] | null;
    /** Percorso backend per un'immagine blob dinamica dato il GUID (og:image, icona di brand...).
     *  Default: convenzione `BlobController` (`blob/{guid}?webopt=true`) — un endpoint blob
     *  diverso nel progetto figlio sovrascrive solo questo hook. */
    resolveBlobImageUrl?: (guid: string) => string;
    /** Intervallo (ms) del polling `VersionCheckService` sul meta `app-version` di `index.html`.
     *  Default 10 minuti. Un sito con contenuto che cambia raramente può volerlo più diradato
     *  (meno richieste); non tocca `SwUpdate` (PWA), che resta guidato dal Service Worker. */
    versionCheckIntervalMs?: number;
    /** Override della UX all'aggiornamento rilevato (default: dialog bloccante + reload). `apply` incapsula già l'eventuale Service Worker: il figlio decide solo quando/se chiamarlo. */
    onVersionUpdateAvailable?: (apply: () => void) => void;
}

// ======================================================
// MODELLI DELLE PAGINE
// ======================================================

/** Proprietà comuni a tutte le tipologie di pagina. */
type BasePageInput = {
    /** Segmento di path relativo (stringa singola o record per-lingua). */
    path: string | Partial<Record<string, string>>;
    /** Titolo o chiave di traduzione associata alla pagina. */
    title: string;
    /** Inclusione della pagina nella build finale. Default: true */
    enabled?: boolean;
    /** Richiede autenticazione per l'accesso (forza `renderMode: 'client'`). */
    requiresAuth?: boolean;
    /** Dati arbitrari aggiuntivi associati alla pagina. */
    data?: Record<string, unknown>;
};

/** Discriminante esplicito delle varianti di pagina supportate dalla DSL. */
export type SitePageKind = 'parent' | 'leaf' | 'external';

/** Strategia di rendering dichiarativa associabile a una pagina interna. */
export type SiteRenderMode = 'client' | 'server';

/** Pagina contenitore per raggruppare altre pagine nell'albero. */
export type ParentPageInput = BasePageInput & {
    kind?: 'parent';
    /** Figli annidati della pagina contenitore. */
    children: SitePageInput[];
    pageType?: never;
    component?: never;
    externalUrl?: never;
    layout?: never;
    renderMode?: never;
};

/** Immagine di anteprima social: `id` = asset statico (mapping.json); `blobGuid` = immagine
 *  caricata nel backend, risolta a runtime. Entrambi valorizzati → vince `blobGuid`. */
export type OgImageRef = { id?: string; blobGuid?: string };

/** Pagina interna con componente lazy e rotta Angular. */
export type LeafPageInput = BasePageInput & {
    kind?: 'leaf';
    /** Tipo logico della pagina interna. */
    pageType: PageType;
    /** Loader lazy del componente Angular associato alla pagina. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: () => Promise<Type<PageBaseComponent<any>>>;
    children?: never;
    /** Cosa È questa pagina — non come appare. */
    layout?: {
        /** Ruolo della pagina (vedi `PageRole` in `design-system-presets.ts`) — governa nav/footer/
         *  pannello/fitViewport/smoke/breadcrumb/fade tramite il design system attivo, non la pagina
         *  stessa. Default: `'default'`. */
        role?: PageRole;
    };
    /** Strategia di rendering della pagina ('server' o 'client'). */
    renderMode?: SiteRenderMode;
    /** Descrizione della pagina per social sharing (og:description). */
    description?: string;
    /** Metadati SEO/social per la pagina. */
    otherSEO?: {
        /** Immagine di anteprima (vedi {@link OgImageRef}). `false` disabilita l'immagine,
         *  `undefined` genera una preview solo testuale. */
        ogImage?: OgImageRef | false;
        /** Tipo Open Graph (default 'website'). */
        ogType?: string;
        /** Dati strutturati (JSON-LD) per la pagina. */
        structuredData?: StructuredDataInput;
        /** Esclude la pagina dall'indicizzazione dei motori di ricerca. */
        noindex?: boolean;
    };
    /** Catalogo runtime di valori per i parametri di rotta `:param`. */
    dynamicParams?: (ctx: DynamicParamsContext) => Promise<SlugNode[]>;
    /** Carica il contenuto della pagina prima del rendering. */
    contentLoader?: ContentLoader;
    externalUrl?: never;
};

/** Pagina esterna con reindirizzamento o link fuori dal sito. */
export type ExternalPageInput = Omit<BasePageInput, 'path'> & {
    kind?: 'external';
    /** Tipo logico della pagina esterna. */
    pageType: PageType;
    /** URL di destinazione esterna. */
    externalUrl: string;
    path?: never;
    component?: never;
    children?: never;
    layout?: never;
    renderMode?: never;
    /** Un link esterno non passa da `routing.ts` (nessun `canActivate`): "richiedi login" non ha
     *  un effetto da applicare. Per nasconderlo a chi non è loggato usa `authOnly` su `addLink`. */
    requiresAuth?: never;
};

/** Un elemento dell'albero pagine, dichiarato nel file di area (`pages/*.pages.ts`), non in site.ts (che assembla più aree con uno spread). `kind` è opzionale: il builder lo ricava dalla forma dell'oggetto. */
export type SitePageInput = ParentPageInput | LeafPageInput | ExternalPageInput;

/** Versione normalizzata della pagina contenitore: da qui in poi `kind` è sempre presente. */
export type ParentPage = Omit<ParentPageInput, 'children' | 'kind'> & {
    kind: 'parent';
    children: SitePage[];
};

/** Versione normalizzata della pagina foglia: `otherSEO` appiattito al top-level, le levette di chrome raggruppate in `chrome` (viaggia fino a `route.data[CHROME_DATA_KEY]`); `pageFade` resta a parte, flat, input di PageBaseComponent. */
export type LeafPage = Omit<LeafPageInput, 'kind' | 'layout' | 'otherSEO'> & {
    kind: 'leaf';
    /** Levette di chrome raggruppate, lette dal root via `route.data[CHROME_DATA_KEY]`. */
    chrome: RouteChrome;
    pageFade?: boolean;
    ogImage?: OgImageRef | false;
    ogType?: string;
    structuredData?: StructuredDataInput;
    noindex?: boolean;
};

/** Versione interna normalizzata della pagina esterna. */
export type ExternalPage = Omit<ExternalPageInput, 'kind'> & {
    kind: 'external';
};

export type SitePage = ParentPage | LeafPage | ExternalPage;
export type InternalSitePage = ParentPage | LeafPage;

// Navigazione (header/footer): tipi e risoluzione vivono in `shell-nav.ts`, non qui — dato
// risolvibile a runtime, non struttura del sito. `getLegalFooterLinks` sotto ne resta un
// consumer (la fascia "small prints" DERIVA da `legalPages`, quella sì build-time) e importa
// `NavLink` da lì.

// ======================================================
// TYPE GUARDS
// ======================================================

export const isParentPage = (page: SitePage): page is ParentPage =>
    page.kind === 'parent';

export const isExternalPage = (page: SitePage): page is ExternalPage =>
    page.kind === 'external';

/** Complemento di `isExternalPage`: filtra le pagine valide per Angular Router. */
export const isInternalPage = (page: SitePage): page is InternalSitePage =>
    page.kind === 'parent' || page.kind === 'leaf';

/** Controllo strutturale (non su `kind`): permette a site.ts di restare privo del discriminante esplicito. */
const isParentPageInput = (page: SitePageInput): page is ParentPageInput =>
    'children' in page;

const isExternalPageInput = (page: SitePageInput): page is ExternalPageInput =>
    'externalUrl' in page;

const isLeafPageInput = (page: SitePageInput): page is LeafPageInput =>
    'component' in page;

/** Garantisce che un eventuale `kind` scritto a mano sia coerente con la forma reale dell'oggetto. */
const assertDeclaredKind = (
    page: SitePageInput,
    inferredKind: SitePageKind,
    context: string
): void => {
    if (page.kind && page.kind !== inferredKind) {
        throw new Error(
            `[SiteBuilder] Pagina non valida in ${context}: kind="${page.kind}" non coincide con il tipo dedotto "${inferredKind}".`
        );
    }
};

/** Normalizza una pagina dichiarata dall'utente aggiungendo il `kind` interno e ricorsivamente tutti i figli. Lancia se non specifica `children`, `component` o `externalUrl`. */
const normalizeSitePage = (
    page: SitePageInput,
    context: string,
    ruoli: RuoliDelSito
): SitePage => {
    if (isParentPageInput(page)) {
        assertDeclaredKind(page, 'parent', context);

        return {
            ...page,
            enabled: page.enabled ?? true,
            kind: 'parent',
            // `requiresAuth` sul contenitore vale per l'intero sottoalbero: senza propagarlo il router
            // metterebbe il guard sul padre, ma i figli resterebbero SSR, in sitemap e indicizzabili.
            children: page.children.map((child, index) =>
                normalizeSitePage(
                    page.requiresAuth && !isExternalPageInput(child) ? { ...child, requiresAuth: child.requiresAuth ?? true } : child,
                    `${context}.children[${index}]`, ruoli)
            )
        };
    }

    if (isExternalPageInput(page)) {
        assertDeclaredKind(page, 'external', context);

        return {
            ...page,
            enabled: page.enabled ?? true,
            kind: 'external'
        };
    }

    if (isLeafPageInput(page)) {
        assertDeclaredKind(page, 'leaf', context);

        const { layout, otherSEO, ...rest } = page;
        const role: PageRole = layout?.role ?? 'default';
        assertRuoloConosciuto(role, ruoli, context);
        const ruoloPagina = resolveRuoloPagina(role, ruoli);
        return {
            ...rest,
            enabled: page.enabled ?? true,
            kind: 'leaf',
            // Flag di layout per route.data, dal ruolo già risolto: fitViewport toglie anche il
            // footer; un campo assente lo decide la shell dal design system.
            chrome: {
                showNav: ruoloPagina.showNav,
                showPanel: ruoloPagina.showPanel,
                showFooter: ruoloPagina.fitViewport ? false : ruoloPagina.showFooter,
                fitViewport: ruoloPagina.fitViewport,
                showSmoke: ruoloPagina.showSmoke,
                showBreadcrumb: ruoloPagina.showBreadcrumb,
                showBrandIcon: ruoloPagina.showBrandIcon,
            } satisfies RouteChrome,
            pageFade: ruoloPagina.pageFade,
            ogImage: otherSEO?.ogImage,
            ogType: otherSEO?.ogType,
            structuredData: otherSEO?.structuredData,
            noindex: otherSEO?.noindex,
        };
    }

    throw new Error(
        `[SiteBuilder] Pagina non valida in ${context}: specificare una delle proprietà "children", "component" o "externalUrl".`
    );
};

/** Normalizza l'intero albero pagine dichiarato, secondo come il design system attivo interpreta il ruolo di ciascuna pagina. */
const normalizeSitePages = (pages: SitePageInput[], ruoli: RuoliDelSito): SitePage[] =>
    pages.map((page, index) => normalizeSitePage(page, `sitePages[${index}]`, ruoli));

/** Raccoglie i `PageType` dichiarati dal figlio nell'albero `pages`. */
const collectDeclaredPageTypes = (pages: SitePageInput[], acc: Set<PageType>): Set<PageType> => {
    for (const page of pages) {
        if (isParentPageInput(page)) {
            collectDeclaredPageTypes(page.children, acc);
        } else if (page.pageType != null) {
            acc.add(page.pageType);
        }
    }
    return acc;
};

// ======================================================
// BUILDER PUBBLICI
// ======================================================

/** Sottoinsieme della configurazione esposto alla factory di `defineSitePages`. */
export type SitePageContext = {
    readonly isWebApp: boolean;
    readonly showLoginInHeader: boolean;
};

/** Comportamento della shell: quale design system è attivo e le funzionalità che non sono estetica (notifiche). Navbar, footer e pannello li decide il design system. */
export interface SiteShellConfig {
    /**
     * Design system attivo — l'UNICA fonte di tono/superfici/`ruoloPagina`/palette (vedi
     * `DesignSystemPreset`, `design-system-presets.ts`). Sempre una factory importata, preset
     * pronto (`components/shared/design-systems/engine/`) o scritto da zero. Assente: i default
     * dell'Engine, gli stessi di `ariaDesignSystem` (tono dall'OS, pannello chiaro, font di sistema).
     */
    designSystem?: DesignSystemFactory;
    /** Mostra il campanellino delle notifiche realtime. Default: false. Disponibilità di una
     *  funzionalità, non estetica — resta una decisione di sito, non del design system. */
    showNotifications?: boolean;
}

/** Struttura e comportamento del sito passati a `buildSite`. */
export interface SiteDefinition {
    /** Pagina di login (target del redirect auth). Se esiste e se è linkata in navbar lo decide
     *  `Features.Login`/`PublicLogin` in global-settings.json, non questo slot. */
    loginPage?: PageType | null;
    /** Pagina home per brand/logo. */
    homePage?: PageType | null;
    /** Pagine legali: uno slot per pagina standard, valorizzato col `PageType` del progetto. */
    legal: LegalDefinition;
    /** Comportamento della shell. */
    shell?: SiteShellConfig;
    /** Abilita funzionalità PWA. Default: `false`. */
    isWebApp?: boolean;
    /** Cache in-process per l'endpoint `/sitemap.xml` delle pagine con `dynamicParams`. */
    dynamicSitemapCache?: boolean;
    /** Override per-`PageType` del calcolo breadcrumb. */
    resolveBreadcrumb?: (pageType: PageType, ctx: BreadcrumbContext) => BreadcrumbItem[] | null;
    /** Override del percorso backend per un'immagine blob dinamica (og:image). Vedi {@link SiteConfig.resolveBlobImageUrl}. */
    resolveBlobImageUrl?: (guid: string) => string;
    /** Override della strategia di formattazione del `<title>` del browser. Vedi {@link SiteConfig.formatBrowserTitle}. */
    formatBrowserTitle?: (pageTitle: string, appName: string) => string;
    /** Intervallo di polling di `VersionCheckService`. Vedi {@link SiteConfig.versionCheckIntervalMs}. */
    versionCheckIntervalMs?: number;
    /** Override della UX di aggiornamento versione. Vedi {@link SiteConfig.onVersionUpdateAvailable}. */
    onVersionUpdateAvailable?: (apply: () => void) => void;
    /** Esposizione dati di `identity` nel JSON-LD del brand. */
    jsonld?: JsonLdContactExposure;
    /** Factory dell'albero pagine. */
    pages: (ctx: SitePageContext) => SitePageInput[];
}

export type ServerRenderEntry = {
    /** Path completo normalizzato della pagina interna foglia. */
    path: string;
    /** Strategia di rendering finale da esporre al layer server. */
    renderMode: SiteRenderMode;
    /** Richiede login (`requiresAuth`). */
    requiresAuth: boolean;
    /** Esclusa dall'indicizzazione via `otherSEO.noindex`. */
    noindex: boolean;
};

/** Metadati di una singola pagina esposti da ContestoSito. */
export type PageInfo = {
    /** Chiave i18n o testo del titolo. */
    title: string;
    /** Path Angular interno o URL esterno. */
    path: string;
    /** Link verso una risorsa esterna. */
    isExternal: boolean;
    /** Descrizione SEO (chiave i18n o testo statico). */
    description?: string;
    /** Immagine di anteprima (vedi {@link OgImageRef}), o false per disabilitarla. */
    ogImage?: OgImageRef | false;
    /** Tipo Open Graph della pagina. */
    ogType?: string;
    /** Dati strutturati statici (JSON-LD). */
    structuredData?: StructuredDataInput;
    /** Esclusione dall'indicizzazione. */
    noindex?: boolean;
};

export interface BuiltSite {
    /** Configurazione finale del sito normalizzata. */
    config: SiteConfig;
    /** Pagine interne per Angular Router. */
    pages: InternalSitePage[];
    /** Link alle pagine legali configurate (`config.legalPages`) per lingua. */
    getLegalFooterLinks: (lang?: string) => NavLink[];
    /** Piano di rendering server-only per ogni lingua. */
    serverRenderEntries: ServerRenderEntry[];
    /** Risolve il path associato a un `PageType` nella lingua richiesta. */
    getPath: (type: PageType, lang?: string) => string | null;
    /** Restituisce i metadati completi associati a un PageType nella lingua richiesta. */
    getPageInfo: (type: PageType, lang?: string) => PageInfo | null;
    /** `loginPage` valorizzato in site.ts, anche se il login è spento (`Features`): per i controlli di build. */
    hasLoginPageSlot: boolean;
    /** Pagina legale gestita dall'Engine per un PageType (markdown, data), o null. */
    getLegalPage: (type: PageType) => LegalPageSpec | null;
    /** Voci della sitemap per ogni pagina e lingua. */
    getSitemapEntries: () => SitemapEntry[];
    /** Percorsi pubblici SSR per gli audit live. */
    getAuditPaths: () => string[];
    /** Pagine con `dynamicParams` dichiarato per la sitemap dinamica. */
    getDynamicPages: () => DynamicPageEntry[];
    /** Content loader dichiarato dalla pagina, o null. */
    getContentLoader: (type: PageType) => ContentLoader | null;
}

/** Voce arricchita per la generazione della sitemap. */
export type SitemapEntry = {
    path: string;
    description?: string;
    /** Lingua della variante URL. */
    lang: string;
    /** Identità stabile della pagina logica attraverso le lingue. */
    pageType: PageType;
    /** Data (YYYY-MM-DD) di ultima modifica dell'entità. */
    lastmod?: string | null;
    /** Chiave di raggruppamento hreflang aggiuntiva. */
    groupKey?: string;
};

// ======================================================
// ENGINE PRINCIPALE
// ======================================================

/** Risolve un testo per-lingua con fallback a cascata. */
export function pickLocaleText(map: Record<string, string> | undefined, lang: string): string {
    if (!map) return '';
    return map[lang] ?? map[environment.defaultLang] ?? Object.values(map)[0] ?? '';
}

/** Risolve il path (stringa singola o record per-lingua) sulla lingua richiesta. */
export function resolvePagePath(path: string | Partial<Record<string, string>>, lang: string, defaultLang: string): string {
    if (typeof path === 'string') return path;
    const resolved = path[lang] ?? path[defaultLang];
    if (resolved === undefined && isDevMode()) {
        console.warn(`[SiteBuilder] path per-lingua senza segmento per "${lang}" né fallback su "${defaultLang}": ${JSON.stringify(path)} — path vuoto, la pagina rischia di collassare sul genitore.`);
    }
    return resolved ?? '';
}

/** Verifica se il path contiene segmenti parametrici `:param`. */
function hasUnresolvedPathParam(path: string): boolean {
    return path.split('/').some(segment => segment.startsWith(':'));
}

/** Restituisce il prefisso di rotta per la lingua ('/en' o stringa vuota per default). */
export function resolveLangPrefix(lang: string, defaultLang: string): string {
    return lang === defaultLang ? '' : `/${lang}`;
}

/** Ricava il tag lingua dal primo segmento dell'URL o usa la lingua di default. */
export function detectLangFromPath(path: string, availableLanguages: readonly string[], defaultLang: string): string {
    const firstSegment = path.split('/').filter(Boolean)[0];
    return firstSegment && availableLanguages.includes(firstSegment) ? firstSegment : defaultLang;
}

/** Chiave di lookup in `pageMap`: PageType per lingua default, `type::lang` per altre lingue. */
function pageMapKey(type: PageType, lang: string, defaultLang: string): string {
    return lang === defaultLang ? type : `${type}::${lang}`;
}

/** Tiene solo `[a-zA-Z0-9.\-_]`: evita che stringhe arbitrarie finiscano in header HTTP o manifest PWA. */
function normalizeVersion(v?: string): string {
    return typeof v === 'string' ? v.trim().replace(/[^a-zA-Z0-9.\-_]/g, '') : '';
}

/** Risolve lo slot `loginPage` con `Features` di global-settings.json: login spento → slot come
 *  assente (il backend non ha gli endpoint); `PublicLogin` → link in navbar. */
function normalizeLoginPage(input: SiteDefinition['loginPage']): { page: PageType | null; showInHeader: boolean } {
    if (input == null || !environment.features?.login) return { page: null, showInHeader: false };
    return { page: input, showInHeader: environment.features.publicLogin };
}

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Risolve `shell.designSystem` eseguendo la sua factory — `undefined` se non impostato. Un design
 *  system è codice (`DesignSystemFactory`), non un dato: qui è dove viene chiamato. */
function resolveDesignSystemPreset(designSystem: DesignSystemFactory | undefined): DesignSystemPreset | undefined {
    return designSystem?.();
}

/** Quello che serve per interpretare i ruoli di pagina: le spec dichiarate e il design system risolto che le vincola. */
interface RuoliDelSito {
    ruoloPagina: Partial<Record<PageRole, SpecRuoloPagina>>;
    aspetto: Aspetto;
}

/** Per ogni campo di ruolo vincolato, se il design system risolto (default compresi) lo tiene acceso. */
const ACCESO_NEL_SITO: Record<Exclude<keyof SpecRuoloPagina, 'fitViewport'>, (a: Aspetto) => boolean> = {
    showNav: a => a.navbar.show,
    showFooter: a => a.footer.show,
    showPanel: a => a.pannello,
    showSmoke: a => a.smoke.enable,
    showBreadcrumb: a => a.breadcrumb.show,
    pageFade: a => a.transizioni,
    showBrandIcon: a => a.navbar.icona,
};

/** Un ruolo può solo spegnere: un campo che il design system risolto tiene spento resta spento anche se il ruolo lo accende. */
function spentoSeSpentoNelSito(chrome: SpecRuoloPagina, aspetto: Aspetto): SpecRuoloPagina {
    let result = chrome;
    for (const field of Object.keys(ACCESO_NEL_SITO) as (keyof typeof ACCESO_NEL_SITO)[]) {
        if (result[field] === true && !ACCESO_NEL_SITO[field](aspetto)) {
            if (result === chrome) result = { ...chrome };
            result[field] = false;
        }
    }
    return result;
}

/** I 4 ruoli di serie dell'Engine — sempre validi, a prescindere dal design system attivo. */
const RUOLI_DI_SERIE = new Set<PageRole>(['default', 'legal', 'error', 'naked']);

/** Spec di un ruolo fra le chiavi PROPRIE di `ruoloPagina`: `'toString'`/`'constructor'` non sono ruoli. */
function specDi(ruoli: RuoliDelSito, role: PageRole): SpecRuoloPagina | undefined {
    return Object.hasOwn(ruoli.ruoloPagina, role) ? ruoli.ruoloPagina[role] : undefined;
}

/** Un ruolo CUSTOM è valido solo se è una chiave di `ruoloPagina` del design system attivo — l'unico punto
 *  che lo scopre, al primo `buildSite()`, non a livello di tipo (vedi `PageRole`). */
function assertRuoloConosciuto(role: PageRole, ruoli: RuoliDelSito, context: string): void {
    if (RUOLI_DI_SERIE.has(role) || Object.hasOwn(ruoli.ruoloPagina, role)) return;
    const noti = [...RUOLI_DI_SERIE, ...Object.keys(ruoli.ruoloPagina)];
    throw new Error(
        `[SiteBuilder] ${context}: layout.role="${role}" non è un ruolo di serie né registrato con ` +
        `ruoloPagina: { "${role}": {...} } dal design system attivo — probabile typo. Ruoli noti: ${noti.join(', ')}.`
    );
}

/** Risolve il ruolo di una pagina nel bundle di comportamento dettato dal design system attivo.
 *  `'naked'` è fisso (`NAKED_CHROME`); `'error'`/`'legal'` hanno un default di Engine sovrascrivibile. */
function resolveRuoloPagina(role: PageRole, ruoli: RuoliDelSito): SpecRuoloPagina {
    if (role === 'naked') return NAKED_CHROME;
    const base = role === 'error' ? ERROR_CHROME_DEFAULT : role === 'legal' ? LEGAL_CHROME_DEFAULT : {};
    return spentoSeSpentoNelSito({ ...base, ...specDi(ruoli, role) }, ruoli.aspetto);
}

/** Assembla e normalizza la SiteConfig finale combinando environment e definition. Espone anche i
 *  ruoli del design system attivo: servono a `normalizeSitePages` per interpretare i ruoli di pagina,
 *  senza rieseguire `shell.designSystem`. */
function buildFinalConfig(definition: SiteDefinition): { config: SiteConfig; ruoli: RuoliDelSito } {
    const cfg = environment.config;
    if (cfg.colorTema != null && !HEX_COLOR_PATTERN.test(cfg.colorTema)) {
        throw new Error(
            `[SiteBuilder] site.colorTema="${cfg.colorTema}" non è un colore hex valido (atteso ` +
            `#RGB o #RRGGBB, es. "#131e55" — niente canale alpha) in global-settings.json.`
        );
    }
    const shell = definition.shell ?? {};
    const preset = resolveDesignSystemPreset(shell.designSystem);
    // Validato di nuovo: un DesignSystemFactory scritto a mano (non via extendDesignSystem) non è
    // validato altrove finché qualcuno lo seleziona.
    if (preset) validateDesignSystemPreset('shell.designSystem', preset);
    const aspetto = risolviAspetto(preset);
    const ruoli: RuoliDelSito = { ruoloPagina: preset?.ruoloPagina ?? {}, aspetto };
    const login = normalizeLoginPage(definition.loginPage);
    const legalPages = resolveLegalPages(definition.legal, hasCookiesConfigured(definition.isWebApp ?? false));
    const cookieSlot = definition.legal.cookie;
    const cookiePage = cookieSlot == null ? null : typeof cookieSlot === 'object' ? cookieSlot.page : cookieSlot;
    const config: SiteConfig = {
        appName: environment.appName,
        formatBrowserTitle: definition.formatBrowserTitle,
        versionCheckIntervalMs: definition.versionCheckIntervalMs,
        onVersionUpdateAvailable: definition.onVersionUpdateAvailable,
        version: normalizeVersion(environment.version) || '1.0.0',
        description: cfg.description ?? {},
        colorTema: cfg.colorTema ?? '#888888',
        aspetto,
        showLoginInHeader: login.showInHeader,
        showNotifications: shell.showNotifications ?? false,
        isWebApp: definition.isWebApp ?? false,
        fonts: resolveFonts(aspetto.font),
        // Il principale (se custom) PIÙ gli aggiuntivi custom, deduplicati per key: il principale
        // per primo, così se una key comparisse in entrambi vince la sua definizione.
        customFontsCatalog: (() => {
            const principale = aspetto.font.principale;
            const defaultCustom = principale != null && typeof principale !== 'string' ? [principale] : [];
            const addonCustoms = aspetto.font.aggiuntivi.filter((c): c is CustomFontDef => typeof c !== 'string');
            const byKey = new Map<string, CustomFontDef>();
            for (const font of [...defaultCustom, ...addonCustoms]) if (!byKey.has(font.key)) byKey.set(font.key, font);
            return [...byKey.values()];
        })(),
        jsonld: {
            email: definition.jsonld?.email ?? false,
            telefono: definition.jsonld?.telefono ?? false,
            indirizzo: definition.jsonld?.indirizzo ?? false,
            partitaIva: definition.jsonld?.partitaIva ?? true,
            codiceFiscale: definition.jsonld?.codiceFiscale ?? false,
        },
        dynamicSitemapCache: definition.dynamicSitemapCache ?? true,
        resolveBreadcrumb: definition.resolveBreadcrumb,
        resolveBlobImageUrl: definition.resolveBlobImageUrl,
        errorChrome: resolveRuoloPagina('error', ruoli),
        loginPage: login.page,
        homePage: definition.homePage ?? null,
        legalPages,
        cookiePolicy: legalPages.find(spec => spec.page === cookiePage)?.page ?? null,
    };
    return { config, ruoli };
}

/**
 * Percorre l'albero pagine e popola mappe di lookup, configurazione SSR e sitemap per la lingua data.
 * @throws Se rileva PageType duplicati o path interni duplicati.
 */
function processPages(
    pages: SitePage[],
    pageMap: Map<string, PageInfo>,
    serverRenderEntries: ServerRenderEntry[],
    dynamicPages: Map<PageType, DynamicPageEntry>,
    contentLoaders: Map<PageType, ContentLoader>,
    auditPaths: string[],
    loginPageType: PageType | null,
    lang: string,
    defaultLang: string,
): SitemapEntry[] {
    const seenInternalPaths = new Set<string>();

    const walk = (nodes: SitePage[], parent: string): SitemapEntry[] =>
        nodes.flatMap((page) => {
            if (!page.enabled) return [];

            if (isExternalPage(page)) {
                const key = pageMapKey(page.pageType, lang, defaultLang);
                if (pageMap.has(key)) {
                    throw new Error(`[SiteBuilder] PageType duplicato rilevato: "${String(page.pageType)}" (lingua "${lang}"). Ogni pagina deve avere un pageType unico.`);
                }
                pageMap.set(key, { title: page.title, path: page.externalUrl, isExternal: true });
                return [];
            }

            const resolvedSegment = resolvePagePath(page.path, lang, defaultLang);
            const fullPath = `/${[parent, resolvedSegment].filter(Boolean).join('/')}`.replace(/\/+/g, '/');

            if (isParentPage(page)) return walk(page.children, fullPath);

            if (seenInternalPaths.has(fullPath)) {
                throw new Error(`[SiteBuilder] Path interno duplicato rilevato: "${fullPath}".`);
            }
            const key = pageMapKey(page.pageType, lang, defaultLang);
            if (pageMap.has(key)) {
                throw new Error(`[SiteBuilder] PageType duplicato rilevato: "${String(page.pageType)}" (lingua "${lang}"). Ogni pagina deve avere un pageType unico.`);
            }
            seenInternalPaths.add(fullPath);
            const noindex = page.pageType === loginPageType ? (page.noindex ?? true) : !!page.noindex;
            pageMap.set(key, {
                title: page.title,
                path: fullPath,
                isExternal: false,
                description: page.description,
                ogImage: page.ogImage,
                ogType: page.ogType ?? 'website',
                structuredData: page.structuredData,
                noindex,
            });
            if (page.contentLoader) contentLoaders.set(page.pageType, page.contentLoader);

            const renderMode = page.requiresAuth ? 'client' : (page.renderMode ?? 'server');
            serverRenderEntries.push({ path: fullPath, renderMode, requiresAuth: !!page.requiresAuth, noindex });

            const isLiveAuditEndpoint = !page.requiresAuth && renderMode === 'server' && !hasUnresolvedPathParam(fullPath) && lang === defaultLang;
            if (isLiveAuditEndpoint) {
                auditPaths.push(fullPath);
            }

            if (page.requiresAuth || noindex) return [];
            if (hasUnresolvedPathParam(fullPath)) {
                if (page.dynamicParams) {
                    const existing = dynamicPages.get(page.pageType);
                    if (existing) {
                        existing.pathByLang[lang] = fullPath;
                    } else {
                        dynamicPages.set(page.pageType, {
                            pageType: page.pageType,
                            description: page.description,
                            pathByLang: { [lang]: fullPath },
                            dynamicParams: page.dynamicParams,
                        });
                    }
                } else if (isDevMode()) {
                    console.warn(`[SiteBuilder] "${fullPath}" è una rotta parametrica: esclusa da sitemap/llms.txt statici (il catalogo concreto arriva da un'API a runtime, non enumerabile a build time). Aggiungi \`dynamicParams\` alla pagina per includerla in sitemap.xml e llms.txt dinamici.`);
                }
                return [];
            }
            return [{ path: fullPath, description: page.description, lang, pageType: page.pageType }];
        });

    return walk(pages, resolveLangPrefix(lang, defaultLang));
}

/** Lancia errore se lo slot punta a un PageType non registrato o disabilitato. */
function assertSlotResolved(slotName: string, type: PageType, pageMap: Map<string, PageInfo>): void {
    if (!pageMap.has(type)) {
        throw new Error(
            `[SiteBuilder] Slot "${slotName}" punta a "${String(type)}", non registrato: ` +
            `dichiaralo in "pages" (e verifica che non sia "enabled: false"), oppure rimuovi lo slot.`
        );
    }
}

/** Valida che tutti gli slot di ruolo pagina puntino a pagine registrate. */
function validatePageRefs(config: SiteConfig, legalPages: readonly LegalPageSpec[], pageMap: Map<string, PageInfo>): void {
    if (config.loginPage) assertSlotResolved('loginPage', config.loginPage, pageMap);
    if (config.homePage) assertSlotResolved('homePage', config.homePage, pageMap);
    for (const spec of legalPages) {
        assertSlotResolved(`legal["${spec.markdown ?? spec.folder}"]`, spec.page, pageMap);
    }
}

/** Nodo dell'albero di parametri dinamici per rotte parametriche. */
export interface SlugNode {
    /** Valore concreto del segmento di rotta. */
    slug: string;
    /** Nodi per i parametri successivi della rotta. */
    children?: SlugNode[];
    /** Data di ultima modifica (YYYY-MM-DD) per la sitemap. */
    lastModified?: string;
}

/** Contesto passato a `LeafPageInput.dynamicParams`. */
export interface DynamicParamsContext {
    fetchBackendJson: <T>(path: string) => Promise<T>;
}

/** Contesto passato a `LeafPageInput.contentLoader`. */
export interface ContentLoaderContext {
    lang: string;
    params: Record<string, string>;
}

/** Esito di `LeafPageInput.contentLoader`. */
export interface ContentLoaderResult {
    content: unknown;
    info?: Partial<PageInfo>;
    structuredData?: StructuredDataInput | null;
}

export type ContentLoader = (ctx: ContentLoaderContext) => Promise<ContentLoaderResult>;

/** Pagina con parametri dinamici per la sitemap. */
export interface DynamicPageEntry {
    pageType: PageType;
    description?: string;
    pathByLang: Record<string, string>;
    dynamicParams: (ctx: DynamicParamsContext) => Promise<SlugNode[]>;
}

/** Risultato di `flattenDynamicParams` per un percorso radice-foglia. */
export interface FlattenedDynamicParams {
    params: Record<string, string>;
    lastModified?: string;
}

const MAX_FLATTENED_ENTRIES = 50_000;

/** Espande l'albero di SlugNode in combinazioni concrete di parametri rotta. */
export function flattenDynamicParams(path: string, nodes: SlugNode[]): FlattenedDynamicParams[] {
    const paramNames = path.split('/').filter(segment => segment.startsWith(':')).map(segment => segment.slice(1));
    if (paramNames.length === 0) return [];

    const results: FlattenedDynamicParams[] = [];
    let truncated = false;
    const walk = (level: SlugNode[], depth: number, acc: Record<string, string>): void => {
        for (const node of level) {
            if (results.length >= MAX_FLATTENED_ENTRIES) { truncated = true; return; }
            const next = { ...acc, [paramNames[depth]]: node.slug };
            const isLastParam = depth === paramNames.length - 1;
            if (isLastParam) {
                if (node.children?.length && isDevMode()) {
                    console.warn(`[SiteBuilder] dynamicParams per "${path}": il nodo "${node.slug}" ha children oltre l'ultimo parametro della rotta (ne servono ${paramNames.length}) — ignorati.`);
                }
                results.push({ params: next, lastModified: node.lastModified });
            } else if (node.children?.length) {
                walk(node.children, depth + 1, next);
            } else if (isDevMode()) {
                console.warn(`[SiteBuilder] dynamicParams per "${path}": il nodo "${node.slug}" si ferma al livello ${depth + 1} ma la rotta ha ${paramNames.length} parametri — combinazione incompleta, scartata.`);
            }
        }
    };
    walk(nodes, 0, {});
    if (truncated) {
        console.warn(`[SiteBuilder] dynamicParams per "${path}": espansione troncata a ${MAX_FLATTENED_ENTRIES} combinazioni (limite di sicurezza) — il provider sta restituendo più elementi di quanti questa funzione ne accumuli.`);
    }
    return results;
}

/** Sostituisce nel path i segmenti `:param` coi valori di `params`. */
export function applyPathParams(path: string, params: Record<string, string> | undefined, devContext: string): string {
    if (!params) return path;
    return path
        .split('/')
        .map(segment => {
            if (!segment.startsWith(':')) return segment;
            const key = segment.slice(1);
            const value = params[key];
            if (value === undefined) {
                if (isDevMode()) {
                    console.warn(`[SiteBuilder] ${devContext}: manca il valore per il parametro ":${key}" nel path "${path}" — il link resta rotto.`);
                }
                return segment;
            }
            return encodeURIComponent(value);
        })
        .join('/');
}

/** Risolve `legalPages` (non filtrata dall'override) in `NavLink[]` per la fascia "small prints". Una voce che non risolve in `pageMap` resta semplicemente assente, come `resolveNavItems` in shell-nav.ts. */
function resolveLegalFooterLinks(
    legalPages: readonly LegalPageSpec[],
    pageMap: Map<string, PageInfo>,
    lang: string,
    defaultLang: string,
): NavLink[] {
    return legalPages
        .map((spec): NavLink | null => {
            const entry = pageMap.get(pageMapKey(spec.page, lang, defaultLang));
            return entry ? { label: entry.title, path: entry.path, isExternal: entry.isExternal } : null;
        })
        .filter((item): item is NavLink => item !== null);
}

/** Spegne (`enabled: false`) la pagina con quel PageType, ovunque sia nell'albero. */
function disablePage(pages: SitePage[], type: PageType): void {
    for (const page of pages) {
        if (page.pageType === type) page.enabled = false;
        if (isParentPage(page)) disablePage(page.children, type);
    }
}

/** Costruisce e valida il ContestoSito dalla SiteDefinition.
 *  @throws Se ci sono duplicati, slot non risolti o la Cookie Policy manca a un sito con cookie. */
export function buildSite(definition: SiteDefinition): BuiltSite {

    const { config: finalConfig, ruoli } = buildFinalConfig(definition);

    const ctx: SitePageContext = {
        isWebApp: finalConfig.isWebApp,
        showLoginInHeader: finalConfig.showLoginInHeader,
    };
    const declaredPages = definition.pages(ctx);

    const declaredPageTypes = collectDeclaredPageTypes(declaredPages, new Set<PageType>());
    const allLegalPages = finalConfig.legalPages;
    const managedLegalPages = filterManagedLegalPages(allLegalPages, declaredPageTypes);

    const policySection = buildPolicySection(managedLegalPages);
    const sitePages = normalizeSitePages(policySection ? [...declaredPages, policySection] : declaredPages, ruoli);
    // Login spento (Features.Login): la pagina puntata da `loginPage` resta dichiarata ma non viene
    // creata, come una pagina con `enabled: false`.
    if (definition.loginPage != null && !environment.features?.login) {
        disablePage(sitePages, definition.loginPage);
    }

    const pageMap = new Map<string, PageInfo>();
    const serverRenderEntries: ServerRenderEntry[] = [];
    const dynamicPages = new Map<PageType, DynamicPageEntry>();
    const contentLoaders = new Map<PageType, ContentLoader>();
    const auditPaths: string[] = [];
    const defaultLang = environment.defaultLang;
    let sitemap: SitemapEntry[] = [];

    for (const lang of environment.availableLanguages) {
        sitemap = sitemap.concat(
            processPages(sitePages, pageMap, serverRenderEntries, dynamicPages, contentLoaders, auditPaths, finalConfig.loginPage ?? null, lang, defaultLang)
        );
    }

    validatePageRefs(finalConfig, allLegalPages, pageMap);

    const legalFooterLinksByLang = new Map<string, NavLink[]>();
    for (const lang of environment.availableLanguages) {
        legalFooterLinksByLang.set(lang, resolveLegalFooterLinks(allLegalPages, pageMap, lang, defaultLang));
    }

    return {
        config: finalConfig,
        pages: sitePages.filter(isInternalPage),
        getLegalFooterLinks: (lang = defaultLang) => legalFooterLinksByLang.get(lang) ?? legalFooterLinksByLang.get(defaultLang) ?? [],
        serverRenderEntries,
        getPath: (type: PageType, lang = defaultLang) => pageMap.get(pageMapKey(type, lang, defaultLang))?.path ?? null,
        getPageInfo: (type: PageType, lang = defaultLang) => pageMap.get(pageMapKey(type, lang, defaultLang)) ?? null,
        hasLoginPageSlot: definition.loginPage != null,
        getLegalPage: (type: PageType) => managedLegalPages.find(spec => spec.page === type) ?? null,
        getSitemapEntries: () => sitemap,
        getAuditPaths: () => auditPaths,
        getDynamicPages: () => Array.from(dynamicPages.values()),
        getContentLoader: (type: PageType) => contentLoaders.get(type) ?? null,
    };
}
