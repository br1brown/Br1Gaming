import { InjectionToken, isDevMode, type Type } from '@angular/core';
import type { PageType } from '../../site';
import type { PageBaseComponent } from './pages/page-base.component';
import { environment } from '../../../environments/environment';
import { hasCookiesConfigured } from './services/cookie/cookie-utils';
import { buildPolicySection, filterManagedLegalPages, legalSlugFor } from './legal/legal-pages';
import type { StructuredDataInput } from './services/structured-data';
import type { BreadcrumbItem, BreadcrumbContext } from './services/breadcrumb';
import type { NavLink } from './shell-nav';
import {
    ERROR_CHROME_DEFAULT, LEGAL_CHROME_DEFAULT, NAKED_CHROME,
    VIVIDEZZA_NEUTRA, VIVIDEZZA_TENUE, VIVIDEZZA_PIENA, SMOKE_INTENSITY,
    validateDesignSystemPreset,
    type DesignSystemFactory, type DesignSystemPreset, type PageRole, type SpecRuoloPagina, type SmokeSettings,
    type Movimento, type Elevazione, type ContentWidth, type BreadcrumbStile, type MutezzaSecondario,
    type HoverIntensity, type SeparazioneSuperfici, type FooterIdentita, type BackToTopSoglia,
    type CookieReopenStile, type BadgeNotifiche, type PulsazioneAttiva,
} from './design-system-presets';
import { resolveFonts, type ResolvedFonts, type CustomFontDef, type FontChoice } from './font-system';

export type { PageRole, SmokeSettings } from './design-system-presets';

/** Default per le 5 pagine legali standard. */
export { STANDARD_LEGAL_PAGES } from './legal/legal-pages';

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

/** Definizione di una pagina legale (rotta `policy/*` e markdown associato). */
export interface LegalPageSpec {
    pageType: PageType;
    /** Segmento sotto `policy/`. */
    path: string;
    /** Chiave i18n del titolo. */
    titleKey: string;
    /** Chiave i18n della descrizione. */
    descriptionKey: string;
    /** Basename del Markdown in `assets/legal`. */
    markdownSlug: string;
}

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
    /** Se l'immagine di anteprima social (og:image auto-generata) mostra SOLO l'immagine di
     *  sfondo, senza titolo/sottotitolo/favicon sovrapposti. SOLO da `DesignSystemPreset.
     *  ogImagePlain`, default `false` (con scritte) se il design system attivo non lo propone —
     *  decisione dell'intero sito, non della singola pagina: la stessa immagine di anteprima
     *  serve OGNI pagina (un badge uguale per tutte). */
    ogImagePlain?: boolean;
    /** Personalizzazione facoltativa di testo/font della sola immagine OG — SOLO da
     *  `DesignSystemPreset.ogTextTransform`, assente se il design system attivo non la propone
     *  (comportamento pre-esistente, invariato: l'immagine OG mostra `title`/`subtitle` così come
     *  sono, nel `defaultFont` del sito). Letta da `server/routes/og-preview.ts`, mai altrove. */
    ogTextTransform?: DesignSystemPreset['ogTextTransform'];
    /** `defaultFont` del preset attivo, GREZZO (non risolto) — SOLO da `DesignSystemPreset.
     *  defaultFont`, assente se il design system attivo non lo propone. Serve a chi ha bisogno
     *  della scelta originale, non del suo stack CSS già risolto (`fonts` sotto): oggi solo
     *  `custom-font-detect.ts`/`ogTextTransform` (il font "corrente" da mostrare al design system
     *  prima di un'eventuale personalizzazione). Consumer ordinari restano su `fonts`. */
    defaultFont?: FontChoice;
    /** Font risolto (stack CSS web, stack server, chiave metriche, sorgenti @font-face, var CSS dei
     *  custom) — SOLO da `DesignSystemPreset.defaultFont`/`addonFonts`, via `resolveFonts()`/
     *  `systemUiFonts()` (`font-system.ts`): un `SystemFont` o un font custom sono lo STESSO
     *  meccanismo, mai due cataloghi scollegati. Font puro di sistema (`systemUiFonts()`, nessun
     *  self-hosting) se il design system attivo non propone `defaultFont`. Unica fonte per ogni
     *  consumer (`AppearanceService`, `server.ts`, `ImgBuilderService`, `PreviewBuilder`, metriche
     *  OG) — nessuno legge il preset o il catalogo direttamente. */
    fonts: ResolvedFonts;
    /** Catalogo GREZZO di OGNI `CustomFontDef` di questo sito (chiave, famiglia, facce) — quello di
     *  `defaultFont` (se custom) PIÙ quelli di `addonFonts`, deduplicati per `key` — non risolto per
     *  ruolo come `fonts` sopra: serve a `server/routes/system-font.ts`/`custom-font-detect.ts`/
     *  `server-font-metrics.ts` per risolvere QUALUNQUE font custom registrato per `key`, anche
     *  quelli mai scelti come font attivo (le voci "secondarie" restano comunque servibili/
     *  raggiungibili da SCSS di progetto). Le eventuali voci `SystemFont` (di `defaultFont` o
     *  `addonFonts`) NON sono qui: risolvono già da sole via `isSystemFont()`, senza bisogno di
     *  questo catalogo. */
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
    /** Override opzionale del colore secondario — SOLO da `DesignSystemPreset.colorSecondary`, `undefined` se il design system attivo non lo propone. */
    colorSecondary?: string;
    /** Override opzionale del colore di sfondo — SOLO da `DesignSystemPreset.colorBackground`, `undefined` se il design system attivo non lo propone. */
    colorBackground?: string;
    /** Override opzionale del colore del testo — SOLO da `DesignSystemPreset.colorText`, `undefined` se il design system attivo non lo propone. */
    colorText?: string;
    /** Override opzionale del colore informativo — SOLO da `DesignSystemPreset.colorInfo`, `undefined` se il design system attivo non lo propone. */
    colorInfo?: string;
    /** Colori con nome proprio proposti dal design system attivo (`DesignSystemPreset.customPalette`),
     *  oltre ai quattro slot fissi sopra — `{}` se il design system attivo non ne definisce. */
    customPalette: Record<string, string>;
    /** Quanto le superfici derivate (pannello, navbar/footer, hover, bordi) somigliano al colore
     *  che le governa invece di restare quasi neutre — SOLO da `DesignSystemPreset.backgroundVividness`
     *  (vedi lì, e `AppearanceService.PaletteOverrides`), `undefined` se il design system attivo non lo propone. */
    backgroundVividness?: number;
    /** Indica se il footer deve essere visibile. Default: `true`. SOLO dal design system attivo. */
    showFooter: boolean;
    /** Indica se l'header deve essere visibile. Default: `true`. SOLO dal design system attivo. */
    showNav: boolean;
    /** Indica se il pannello contenuti (`.content-panel`) può essere visibile. Default: `true`.
     *  SOLO dal design system attivo. */
    showPanel: boolean;
    /** Mostra il breadcrumb sulle pagine interne. Default: `false`. SOLO dal design system attivo. */
    showBreadcrumb: boolean;
    /** Mostra l'icona di brand nella navbar. Default: `true`. SOLO dal design system attivo — quale
     *  icona resta invece `ShellNavResolver.brandIcon` (shell-nav.ts), un dato di contenuto. */
    showBrandIcon: boolean;
    /** Angoli arrotondati sull'immagine ingrandita nel lightbox. Default: `true`. SOLO dal design
     *  system attivo — vedi `DesignSystemPreset.lightboxBordiArrotondati`. */
    lightboxBordiArrotondati: boolean;
    /** Fissa la navbar in alto allo scroll. SOLO dal design system attivo. */
    fixedTopHeader?: boolean;
    /** Mostra il pulsante di login nella navbar. */
    showLoginInHeader: boolean;
    /** Mostra il campanellino delle notifiche realtime. Default: false. */
    showNotifications: boolean;
    /** Abilita funzionalità PWA (Service Worker e installazione offline). Default: `false`. */
    isWebApp: boolean;
    /** Configurazione dell'effetto smoke. Puramente decorativo: SOLO dal design system attivo
     *  (`DesignSystemPreset.smoke`), non vive più in `global-settings.json`. */
    smoke: SmokeSettings;
    /** `true` se `shell.designSystem` è impostato in site.ts. Esposto solo per debug/introspezione. */
    designSystem: boolean;
    /**
     * Forza l'intero sito su un tono, ignorando `prefers-color-scheme`: utile per un design a
     * palette fissa (es. sempre scuro) dove un tema derivato dall'OS romperebbe il contrasto
     * studiato dal grafico. SOLO da `DesignSystemPreset.forceThemeTone` — nessuno scostamento a
     * livello di sito. Default: assente — segue l'OS come sempre (`AppearanceService.themeTone`, sia in
     * SSR sia runtime).
     * Diverso da `panelSurface` (sotto): quello forza SOLO il pannello contenuti su un tono
     * indipendente dall'OS che governa il resto; questo fissa l'intero sito. Compongono, non si
     * escludono — un pannello con tono diverso dal resto del sito, anche già fissato, è una
     * composizione valida (Radix Themes/Chakra/Ant Design/Carbon la documentano tutte come pattern
     * intenzionale, non un conflitto). Cambia solo il DEFAULT di `panelSurface`: `'auto'` (segue
     * l'ambiente, già coerente) quando questo campo è impostato, `'light'` altrimenti — un valore
     * esplicito del design system vince sempre su entrambi i default.
     */
    forceThemeTone?: 'light' | 'dark';
    /**
     * Tono del pannello contenuti, indipendente dall'OS che governa navbar/footer/sfondo.
     * `'auto'` = segue l'ambiente come il resto del sito. Default: `'light'` (comportamento
     * storico del template) — o `'auto'` se `forceThemeTone` è impostato, vedi sopra.
     */
    panelSurface: 'light' | 'dark' | 'auto';
    /**
     * Sfondo/testo di navbar e footer. `'brand'` (default) = superficie immersiva derivata dal
     * brand, sempre diversa dallo sfondo pagina. `'body'` = navbar/footer condividono lo sfondo
     * pagina, nessuna cesura visibile — vedi `DesignSystemPreset.navSurface` per il dettaglio.
     * SOLO dal design system attivo (es. `muro`) — nessuno scostamento a livello di sito.
     */
    navSurface: 'brand' | 'body';
    /** Fade-in d'ingresso pagina (`.page-fade` via `PageBaseComponent`). Default: `true`. SOLO dal design system attivo. */
    pageFade: boolean;
    /** Velocità dei gesti d'apertura/transizione. Default `'svelto'`. SOLO dal design system attivo — vedi `DesignSystemPreset.movimento`. */
    movimento: Movimento;
    /** Ombra + raggio d'angolo dei pannelli elevati. Default `'sospesa'`. SOLO dal design system attivo — vedi `DesignSystemPreset.elevazione`. */
    elevazione: Elevazione;
    /** Larghezza della colonna del pannello contenuti. Default `'ampio'`. SOLO dal design system attivo — vedi `DesignSystemPreset.contentWidth`. */
    contentWidth: ContentWidth;
    /** Separatore del breadcrumb. Default `'traccia'`. SOLO dal design system attivo — vedi `DesignSystemPreset.breadcrumbStile`. */
    breadcrumbStile: BreadcrumbStile;
    /** Saturazione del secondary auto-calcolato. Default `'standard'`. SOLO dal design system attivo — vedi `DesignSystemPreset.mutezzaSecondario`. */
    mutezzaSecondario: MutezzaSecondario;
    /** Intensità hover/active dei bottoni pieni. Default `'standard'`. SOLO dal design system attivo — vedi `DesignSystemPreset.hoverIntensity`. */
    hoverIntensity: HoverIntensity;
    /** Separazione fra le superfici di contenuto. Default `'classica'`. SOLO dal design system attivo — vedi `DesignSystemPreset.separazioneSuperfici`. */
    separazioneSuperfici: SeparazioneSuperfici;
    /** Presentazione del blocco identità nel footer. Default `'esteso'`. SOLO dal design system attivo — vedi `DesignSystemPreset.footerIdentita`. */
    footerIdentita: FooterIdentita;
    /** Soglia di scroll per il FAB "torna su". Default `'standard'`. SOLO dal design system attivo — vedi `DesignSystemPreset.backToTopSoglia`. */
    backToTopSoglia: BackToTopSoglia;
    /** Stile/posizione del FAB di riapertura cookie banner. Default `'discreto'`. SOLO dal design system attivo — vedi `DesignSystemPreset.cookieReopenStile`. */
    cookieReopenStile: CookieReopenStile;
    /** Stile del badge di notifiche non lette. Default `'numero'`. SOLO dal design system attivo — vedi `DesignSystemPreset.badgeNotifiche`. */
    badgeNotifiche: BadgeNotifiche;
    /** Intensità dell'alone pulsante di un toggle attivo. Default `'lieve'`. SOLO dal design system attivo — vedi `DesignSystemPreset.pulsazioneAttiva`. */
    pulsazioneAttiva: PulsazioneAttiva;
    /**
     * Chrome (nav/footer/pannello) del ruolo `'error'` (vedi `PageRole`/`ERROR_CHROME_DEFAULT` in
     * `design-system-presets.ts`), già risolta dal design system attivo — `routing.ts` la applica
     * di peso alle rotte di errore (404/401/ecc), che restano nell'Engine e non passano dalla DSL
     * delle pagine (`LeafPageInput.layout.role`), quindi non hanno altro modo di riceverla.
     */
    errorChrome: SpecRuoloPagina;
    /** Pagina a cui reindirizzare l'utente se non autenticato (default /error/401). */
    loginPage?: PageType | null;
    /** Pagina home usata dal logo nella navbar. */
    homePage?: PageType | null;
    /** Pagine legali dichiarate dal sito. */
    legalPages: readonly LegalPageSpec[];
    /** `PageType` della Cookie Policy fra le voci di `legalPages`. */
    cookiePolicy: PageType | null;
    /** Cache in-process per l'endpoint `/sitemap.xml` delle pagine con `dynamicParams`. */
    dynamicSitemapCache: boolean;
    /** Override del calcolo breadcrumb per-PageType. */
    resolveBreadcrumb?: (pageType: PageType, ctx: BreadcrumbContext) => BreadcrumbItem[] | null;
    /** Percorso backend per un'immagine blob dinamica dato il GUID (og:image, icona di brand...).
     *  Default: convenzione `BlobController` (`blob/{guid}?webopt=true`) — un endpoint blob
     *  diverso nel progetto figlio sovrascrive solo questo hook. */
    resolveBlobImageUrl?: (guid: string) => string;
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

/**
 * Un elemento dell'albero pagine — dichiarato nel file di area (`pages/*.pages.ts`),
 * non in `site.ts`: `site.ts` assembla gli array di più aree con uno spread
 * (`pages: () => [...appPagesDecl, ...]`), non dichiara pagine direttamente.
 *
 * L'utente non è obbligato a esplicitare `kind`: il builder lo ricava
 * automaticamente dalla forma dell'oggetto.
 */
export type SitePageInput = ParentPageInput | LeafPageInput | ExternalPageInput;

/**
 * Versione interna normalizzata della pagina contenitore.
 *
 * Da questo punto in poi `kind` è sempre presente e affidabile,
 * così il resto del motore può continuare a usare una union discriminata.
 */
export type ParentPage = Omit<ParentPageInput, 'children' | 'kind'> & {
    kind: 'parent';
    children: SitePage[];
};

/**
 * Versione interna normalizzata della pagina foglia.
 *
 * `otherSEO` è appiattito al top-level; le levette di chrome sono RAGGRUPPATE nell'oggetto
 * `chrome` (RouteChrome), che viaggia coerente fino a `route.data[CHROME_DATA_KEY]` senza essere
 * appiattito e poi riraggruppato. `pageFade` resta a parte: passa flat in `route.data` e diventa
 * input di PageBaseComponent.
 */
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

/**
 * Un elemento dell'albero pagine interno è una discriminated union e può essere:
 * - un nodo contenitore
 * - una pagina interna
 * - una pagina esterna
 */
export type SitePage = ParentPage | LeafPage | ExternalPage;
export type InternalSitePage = ParentPage | LeafPage;

// Navigazione (header/footer): tipi e risoluzione vivono in `shell-nav.ts`, non qui — dato
// risolvibile a runtime, non struttura del sito. `getLegalFooterLinks` sotto ne resta un
// consumer (la fascia "small prints" DERIVA da `legalPages`, quella sì build-time) e importa
// `NavLink` da lì.

// ======================================================
// TYPE GUARDS
// ======================================================

/**
 * Verifica se una pagina è un nodo contenitore.
 *
 * La logica di discriminazione viene tenuta confinata qui,
 * così il resto del codice non deve spargere controlli strutturali.
 *
 * @param page - La pagina da verificare
 * @returns true se la pagina è un nodo contenitore
 */
export const isParentPage = (page: SitePage): page is ParentPage =>
    page.kind === 'parent';

/**
 * Verifica se una pagina è una pagina esterna.
 *
 * Il discriminante `kind` rende il controllo esplicito e stabile,
 * senza dover inferire il tipo dalla presenza di altre proprietà.
 *
 * @param page - La pagina da verificare
 * @returns true se la pagina è una pagina esterna
 */
export const isExternalPage = (page: SitePage): page is ExternalPage =>
    page.kind === 'external';

/**
 * Verifica se una pagina è interna al sito.
 *
 * È semplicemente il complemento di `isExternalPage`.
 * Questo type guard è utile soprattutto nel return finale,
 * per filtrare solo le pagine valide per Angular Router.
 *
 * @param page - La pagina da verificare
 * @returns true se la pagina è interna (parent o leaf)
 */
export const isInternalPage = (page: SitePage): page is InternalSitePage =>
    page.kind === 'parent' || page.kind === 'leaf';

/**
 * Verifica se l'input dichiarato rappresenta una pagina contenitore.
 *
 * Qui usiamo un controllo strutturale per permettere a `site.ts`
 * di restare privo del discriminante esplicito.
 */
const isParentPageInput = (page: SitePageInput): page is ParentPageInput =>
    'children' in page;

/**
 * Verifica se l'input dichiarato rappresenta una pagina esterna.
 */
const isExternalPageInput = (page: SitePageInput): page is ExternalPageInput =>
    'externalUrl' in page;

/**
 * Verifica se l'input dichiarato rappresenta una pagina foglia interna.
 */
const isLeafPageInput = (page: SitePageInput): page is LeafPageInput =>
    'component' in page;

/**
 * Garantisce che un eventuale `kind` scritto manualmente sia coerente
 * con la forma reale dell'oggetto.
 *
 * @param page - La pagina da validare
 * @param inferredKind - Il tipo di pagina dedotto dalla struttura
 * @param context - Contesto per il messaggio di errore (es. "sitePages[0]")
 * @throws Se il `kind` esplicito non coincide con il tipo dedotto
 */
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

/**
 * Normalizza una pagina dichiarata dall'utente aggiungendo il `kind`
 * interno e ricorsivamente tutti i figli.
 *
 * @param page - La pagina grezza da normalizzare
 * @param context - Contesto per il messaggio di errore (es. "sitePages[0]")
 * @returns La pagina normalizzata con `kind` esplicito e figli processati
 * @throws Se la pagina non specifica `children`, `component` o `externalUrl`
 */
const normalizeSitePage = (
    page: SitePageInput,
    context: string,
    preset: DesignSystemPreset | undefined
): SitePage => {
    if (isParentPageInput(page)) {
        assertDeclaredKind(page, 'parent', context);

        return {
            ...page,
            enabled: page.enabled ?? true,
            kind: 'parent',
            children: page.children.map((child, index) =>
                normalizeSitePage(child, `${context}.children[${index}]`, preset)
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
        assertRuoloConosciuto(role, preset, context);
        const ruoloPagina = resolveRuoloPagina(role, preset);
        const naked = role === 'naked';
        return {
            ...rest,
            enabled: page.enabled ?? true,
            kind: 'leaf',
            // Flag di layout per route.data, decisi solo dal ruolo: 'naked' (fisso) >
            // fitViewport del ruolo (niente footer) > resto del ruolo (ruoloPagina).
            chrome: {
                showNav: naked ? false : ruoloPagina.showNav,
                showPanel: naked ? false : ruoloPagina.showPanel,
                showFooter: (naked || ruoloPagina.fitViewport) ? false : ruoloPagina.showFooter,
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

/** Normalizza l'intero albero pagine dichiarato, secondo come il design system attivo (`preset`,
 *  `undefined` se nessuno) interpreta il ruolo di ciascuna pagina. */
const normalizeSitePages = (pages: SitePageInput[], preset: DesignSystemPreset | undefined): SitePage[] =>
    pages.map((page, index) => normalizeSitePage(page, `sitePages[${index}]`, preset));

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

/** Comportamento della shell — oggi solo ciò che NON è estetico (design system attivo,
 *  notifiche): navbar/footer/pannello/header sono decisioni del design system attivo, non più
 *  scostabili qui. QUALE icona di brand in navbar non è nemmeno lei qui: è dato risolvibile a
 *  runtime (può dipendere da un'API, cambiare per pagina...), non struttura fissa del sito — vedi
 *  `ShellNavResolver.brandIcon` in `shell-nav.ts`, risolto insieme a header/footer. SE comparire è
 *  invece la solita decisione del design system (`DesignSystemPreset.showBrandIcon`), come
 *  nav/footer/pannello. */
export interface SiteShellConfig {
    /**
     * Design system attivo — l'UNICA fonte di tono/superfici/`ruoloPagina`/palette (vedi
     * `DesignSystemPreset`, `design-system-presets.ts`). Sempre una factory importata, preset
     * condiviso (`components/shared/design-systems/engine/`) o scritto da zero. Assente: `adaptive`.
     */
    designSystem?: DesignSystemFactory;
    /** Mostra il campanellino delle notifiche realtime. Default: false. Disponibilità di una
     *  funzionalità, non estetica — resta una decisione di sito, non del design system. */
    showNotifications?: boolean;
}

/** Configurazione della pagina di login e della sua visibilità in navbar. */
export interface LoginPageConfig {
    /** La pagina di login target del redirect auth. */
    page: PageType;
    /** Espone il link di login in navbar. Default `false`. */
    showInHeader?: boolean;
}

/** Struttura e comportamento del sito passati a `buildSite`. */
export interface SiteDefinition {
    /** Pagina di login (target redirect e navbar opzionale). */
    loginPage?: PageType | LoginPageConfig | null;
    /** Pagina home per brand/logo. */
    homePage?: PageType | null;
    /** Pagine legali del sito. */
    legalPages?: readonly LegalPageSpec[];
    /** `PageType` della Cookie Policy fra le voci di `legalPages`. */
    cookiePolicy?: PageType | null;
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
    /** Restituisce lo slug del relativo Markdown per una pagina legale, o null. */
    getLegalSlug: (type: PageType) => string | null;
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

/** Default dell'effetto smoke, mergeati con quanto propone il design system attivo —
 *  `SMOKE_INTENSITY.pulviscolo` è anche il default di `intensita` quando `enable: true` non la
 *  specifica (vedi `resolveSmoke` sotto). */
const DEFAULT_SMOKE: SmokeSettings = {
    enable: false, color: '#ffffff', opacity: 0.5,
    ...SMOKE_INTENSITY.pulviscolo,
};

/** Risolve `DesignSystemPreset.smoke` (`SmokePreset`, `intensita` inclusa) in `SmokeSettings`
 *  grezzo per `SmokeEffectComponent` — `enable`/`color`/`opacity` passano diretti,
 *  `intensita` si traduce nei 3 numeri di `SMOKE_INTENSITY` (default `'pulviscolo'` se assente). */
function resolveSmoke(preset: DesignSystemPreset | undefined): SmokeSettings {
    const smoke = preset?.smoke;
    return {
        enable: smoke?.enable ?? DEFAULT_SMOKE.enable,
        color: smoke?.color ?? DEFAULT_SMOKE.color,
        opacity: smoke?.opacity ?? DEFAULT_SMOKE.opacity,
        ...SMOKE_INTENSITY[smoke?.intensita ?? 'pulviscolo'],
    };
}

/** Tiene solo `[a-zA-Z0-9.\-_]`: evita che stringhe arbitrarie finiscano in header HTTP o manifest PWA. */
function normalizeVersion(v?: string): string {
    return typeof v === 'string' ? v.trim().replace(/[^a-zA-Z0-9.\-_]/g, '') : '';
}

/** Risolve lo slot `loginPage` in coppia (PageType, showInHeader). */
function normalizeLoginPage(input: SiteDefinition['loginPage']): { page: PageType | null; showInHeader: boolean } {
    if (input == null) return { page: null, showInHeader: false };
    if (typeof input === 'object') return { page: input.page, showInHeader: input.showInHeader ?? false };
    return { page: input, showInHeader: false };
}

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Risolve `shell.designSystem` eseguendo la sua factory — `undefined` se non impostato. Un design
 *  system è codice (`DesignSystemFactory`), non un dato: qui è dove viene chiamato. */
function resolveDesignSystemPreset(designSystem: DesignSystemFactory | undefined): DesignSystemPreset | undefined {
    return designSystem?.();
}

/** `backgroundVividness` numerico dietro `DesignSystemPreset.superfici`. */
function superficiVividness(superfici: DesignSystemPreset['superfici']): number {
    switch (superfici) {
        case 'fusione': return VIVIDEZZA_PIENA;
        case 'tenue': case 'tenue-flotting': return VIVIDEZZA_TENUE;
        default: return VIVIDEZZA_NEUTRA; // undefined, 'foglio', 'distinte'
    }
}

/** `showPanel` globale implicito in `DesignSystemPreset.superfici` — acceso di default (assente,
 *  `'foglio'`, `'tenue-flotting'`), spento per le varianti dedicate e per `'fusione'` (sempre: un
 *  foglio di tono diverso vanificherebbe la fusione, uno identico sarebbe indistinguibile dal resto
 *  — nessuna variante "flotting" per `'fusione'`). */
function superficiShowsPanel(superfici: DesignSystemPreset['superfici']): boolean {
    switch (superfici) {
        case 'distinte': case 'tenue': case 'fusione': return false;
        default: return true; // undefined, 'foglio', 'tenue-flotting'
    }
}

/** I 5 campi di `SpecRuoloPagina` con un interruttore MASTER sul campo omonimo di
 *  `DesignSystemPreset`, più `showPanel` con master su `superfici` (derivato, vedi
 *  `superficiShowsPanel` sopra) — vedi il commento di `SpecRuoloPagina` in
 *  `design-system-presets.ts` per il perché e per il confronto con `smoke.enable`. */
const MASTER_LOCKABLE_FIELDS = ['showNav', 'showFooter', 'showPanel', 'showBreadcrumb', 'pageFade', 'showBrandIcon'] as const;

/** Se il master (campo omonimo di `DesignSystemPreset`, o `superficiShowsPanel(preset?.superfici)`
 *  per `showPanel`) è ESPLICITAMENTE `false`, nessun ruolo può riportarlo a `true` — spegnerlo
 *  resta invece sempre permesso. */
function lockToMasterOff(chrome: SpecRuoloPagina, preset: DesignSystemPreset | undefined): SpecRuoloPagina {
    let result = chrome;
    for (const field of MASTER_LOCKABLE_FIELDS) {
        const masterValue = field === 'showPanel' ? superficiShowsPanel(preset?.superfici) : preset?.[field];
        if (masterValue === false && result[field] === true) {
            if (result === chrome) result = { ...chrome };
            result[field] = false;
        }
    }
    return result;
}

/** I 4 ruoli di serie dell'Engine — sempre validi, a prescindere dal design system attivo. */
const RUOLI_DI_SERIE = new Set<PageRole>(['default', 'legal', 'error', 'naked']);

/** Un ruolo CUSTOM è valido solo se compare fra le chiavi di `preset.ruoloPagina` — l'unico punto
 *  che lo scopre, al primo `buildSite()`, non a livello di tipo (vedi `PageRole`). */
function assertRuoloConosciuto(role: PageRole, preset: DesignSystemPreset | undefined, context: string): void {
    if (RUOLI_DI_SERIE.has(role)) return;
    if (preset?.ruoloPagina && role in preset.ruoloPagina) return;
    const noti = [...RUOLI_DI_SERIE, ...Object.keys(preset?.ruoloPagina ?? {})];
    throw new Error(
        `[SiteBuilder] ${context}: layout.role="${role}" non è un ruolo di serie né registrato con ` +
        `ruoloPagina: { "${role}": {...} } dal design system attivo — probabile typo. Ruoli noti: ${noti.join(', ')}.`
    );
}

/** Risolve il ruolo di una pagina nel bundle di comportamento dettato dal design system attivo.
 *  `'naked'` è fisso (`NAKED_CHROME`); `'error'`/`'legal'` hanno un default di Engine sovrascrivibile. */
function resolveRuoloPagina(role: PageRole, preset: DesignSystemPreset | undefined): SpecRuoloPagina {
    if (role === 'naked') return NAKED_CHROME;
    if (role === 'error') return lockToMasterOff({ ...ERROR_CHROME_DEFAULT, ...preset?.ruoloPagina?.error }, preset);
    if (role === 'legal') return lockToMasterOff({ ...LEGAL_CHROME_DEFAULT, ...preset?.ruoloPagina?.legal }, preset);
    return lockToMasterOff(preset?.ruoloPagina?.[role] ?? {}, preset);
}

/** Assembla e normalizza la SiteConfig finale combinando environment e definition. Espone anche il
 *  preset risolto (`undefined` se nessuno): serve a `normalizeSitePages` per interpretare i ruoli
 *  di pagina — evita di rifare due volte il lookup di `shell.designSystem`. */
function buildFinalConfig(definition: SiteDefinition): { config: SiteConfig; preset: DesignSystemPreset | undefined } {
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
    const forceThemeTone = preset?.forceThemeTone;
    const login = normalizeLoginPage(definition.loginPage);
    const config: SiteConfig = {
        appName: environment.appName,
        version: normalizeVersion(environment.version) || '1.0.0',
        description: cfg.description ?? {},
        colorTema: cfg.colorTema ?? '#888888',
        colorSecondary: preset?.colorSecondary,
        colorBackground: preset?.colorBackground,
        colorText: preset?.colorText,
        colorInfo: preset?.colorInfo,
        customPalette: preset?.customPalette ?? {},
        backgroundVividness: superficiVividness(preset?.superfici),
        designSystem: shell.designSystem != null,
        forceThemeTone,
        showFooter: preset?.showFooter ?? true,
        showNav: preset?.showNav ?? true,
        showPanel: superficiShowsPanel(preset?.superfici),
        showBreadcrumb: preset?.showBreadcrumb ?? false,
        showBrandIcon: preset?.showBrandIcon ?? true,
        lightboxBordiArrotondati: preset?.lightboxBordiArrotondati ?? true,
        fixedTopHeader: preset?.fixedTopHeader ?? false,
        showLoginInHeader: login.showInHeader,
        showNotifications: shell.showNotifications ?? false,
        isWebApp: definition.isWebApp ?? false,
        ogImagePlain: preset?.ogImagePlain,
        ogTextTransform: preset?.ogTextTransform,
        defaultFont: preset?.defaultFont,
        fonts: resolveFonts({
            defaultFont: preset?.defaultFont,
            addonFonts: preset?.addonFonts,
        }),
        // defaultFont (se custom) PIÙ le voci custom di addonFonts, deduplicate per key — vedi
        // il commento su customFontsCatalog sopra. defaultFont per primo: se una key comparisse
        // (di proposito o per errore) in entrambi i campi, vince la sua definizione come font attivo.
        customFontsCatalog: (() => {
            const defaultCustom = preset?.defaultFont != null && typeof preset.defaultFont !== 'string' ? [preset.defaultFont] : [];
            const addonCustoms = (preset?.addonFonts ?? []).filter((c): c is CustomFontDef => typeof c !== 'string');
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
        // Default sensibile al contesto: 'light' (storico) quando il sito segue l'OS, 'auto' quando
        // è già fissato su un tono (forceThemeTone) — un sito uniforme di default, non una card
        // chiara che spunta senza che nessuno l'abbia chiesta. Un valore esplicito del design
        // system vince sempre: un pannello con tono diverso dal resto del sito è una composizione
        // valida (Radix/Chakra/Ant Design/Carbon la documentano tutti), non un conflitto.
        panelSurface: preset?.panelSurface ?? (forceThemeTone ? 'auto' : 'light'),
        navSurface: preset?.navSurface ?? 'brand',
        pageFade: preset?.pageFade ?? true,
        movimento: preset?.movimento ?? 'svelto',
        elevazione: preset?.elevazione ?? 'sospesa',
        contentWidth: preset?.contentWidth ?? 'ampio',
        breadcrumbStile: preset?.breadcrumbStile ?? 'traccia',
        mutezzaSecondario: preset?.mutezzaSecondario ?? 'standard',
        hoverIntensity: preset?.hoverIntensity ?? 'standard',
        separazioneSuperfici: preset?.separazioneSuperfici ?? 'classica',
        footerIdentita: preset?.footerIdentita ?? 'esteso',
        backToTopSoglia: preset?.backToTopSoglia ?? 'standard',
        cookieReopenStile: preset?.cookieReopenStile ?? 'discreto',
        badgeNotifiche: preset?.badgeNotifiche ?? 'numero',
        pulsazioneAttiva: preset?.pulsazioneAttiva ?? 'lieve',
        smoke: resolveSmoke(preset),
        errorChrome: resolveRuoloPagina('error', preset),
        loginPage: login.page,
        homePage: definition.homePage ?? null,
        legalPages: definition.legalPages ?? [],
        cookiePolicy: definition.cookiePolicy ?? null,
    };
    return { config, preset };
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
    if (config.cookiePolicy) assertSlotResolved('cookiePolicy', config.cookiePolicy, pageMap);
    for (const spec of legalPages) {
        assertSlotResolved(`legalPages["${spec.path}"]`, spec.pageType, pageMap);
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

/**
 * Risolve `legalPages` (NON filtrata dall'override: una pagina overridden resta comunque nel
 * footer) in `NavLink[]` per la fascia "small prints", nello stesso ordine della lista. Una voce
 * che non risolve in `pageMap` (mai configurata, o rimossa insieme alla pagina che referenziava)
 * è semplicemente assente dal risultato — stessa logica "silente" di `resolveNavItems`
 * (shell-nav.ts) per un `addPage` non risolto.
 */
function resolveLegalFooterLinks(
    legalPages: readonly LegalPageSpec[],
    pageMap: Map<string, PageInfo>,
    lang: string,
    defaultLang: string,
): NavLink[] {
    return legalPages
        .map((spec): NavLink | null => {
            const entry = pageMap.get(pageMapKey(spec.pageType, lang, defaultLang));
            return entry ? { label: entry.title, path: entry.path, isExternal: entry.isExternal } : null;
        })
        .filter((item): item is NavLink => item !== null);
}

/**
 * Costruisce e valida il ContestoSito completo a partire dalla SiteDefinition.
 * @throws Se ci sono duplicati, slot non risolti o policy mancanti per i cookie configurati.
 */
export function buildSite(definition: SiteDefinition): BuiltSite {

    const { config: finalConfig, preset } = buildFinalConfig(definition);
    const cookiesEnabled = hasCookiesConfigured(finalConfig.isWebApp);

    const ctx: SitePageContext = {
        isWebApp: finalConfig.isWebApp,
        showLoginInHeader: finalConfig.showLoginInHeader,
    };
    const declaredPages = definition.pages(ctx);

    const declaredPageTypes = collectDeclaredPageTypes(declaredPages, new Set<PageType>());
    const allLegalPages = finalConfig.legalPages;
    const managedLegalPages = filterManagedLegalPages(allLegalPages, declaredPageTypes);

    const policySection = buildPolicySection(managedLegalPages);
    const sitePages = normalizeSitePages(policySection ? [...declaredPages, policySection] : declaredPages, preset);

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

    if (cookiesEnabled && finalConfig.cookiePolicy == null) {
        throw new Error(
            '[SiteBuilder] Il sito usa cookie (PWA o cookie di progetto) ma ' +
            '`cookiePolicy` non è valorizzato in site.ts. La pagina Cookie Policy è ' +
            'obbligatoria: valorizza `cookiePolicy` con il PageType della relativa voce in `legalPages`.'
        );
    }

    const footerLegalPages = cookiesEnabled
        ? allLegalPages
        : allLegalPages.filter(spec => spec.pageType !== finalConfig.cookiePolicy);

    const legalFooterLinksByLang = new Map<string, NavLink[]>();
    for (const lang of environment.availableLanguages) {
        legalFooterLinksByLang.set(lang, resolveLegalFooterLinks(footerLegalPages, pageMap, lang, defaultLang));
    }

    return {
        config: finalConfig,
        pages: sitePages.filter(isInternalPage),
        getLegalFooterLinks: (lang = defaultLang) => legalFooterLinksByLang.get(lang) ?? legalFooterLinksByLang.get(defaultLang) ?? [],
        serverRenderEntries,
        getPath: (type: PageType, lang = defaultLang) => pageMap.get(pageMapKey(type, lang, defaultLang))?.path ?? null,
        getPageInfo: (type: PageType, lang = defaultLang) => pageMap.get(pageMapKey(type, lang, defaultLang)) ?? null,
        getLegalSlug: (type: PageType) => legalSlugFor(managedLegalPages, type),
        getSitemapEntries: () => sitemap,
        getAuditPaths: () => auditPaths,
        getDynamicPages: () => Array.from(dynamicPages.values()),
        getContentLoader: (type: PageType) => contentLoaders.get(type) ?? null,
    };
}
