import { isDevMode, type Type } from '@angular/core';
import type { PageType } from '../../site';
import { applyPathParams } from './siteBuilder';
import type { Identity } from './dto/identity.dto';
import { FooterField, FooterFieldDeps, FooterEntry, FooterGroupChild, FooterItemKind, resolveFooterField } from './footer-content';
import { hasText } from './identity-format';

// Re-esportati: chi consuma la navigazione importa i tipi del footer da qui (stesso modulo di
// `NavLink`/`NavSectionBuilder`), non separatamente da `footer-content.ts`.
export { FooterField };
export type { FooterEntry, FooterGroupChild, FooterFieldDeps, FooterItemKind };

/**
 * Voci di navigazione della shell (header/footer): dato, non struttura del sito. A differenza di
 * `site.ts`/`siteBuilder.ts` (PageType/rotte, per forza build-time — Angular vuole `routes`
 * statico al bootstrap), quali destinazioni mostrare, in che ordine, con che etichetta, è
 * risolvibile a runtime — vedi `services/shell-nav.service.ts`, che consuma questi tipi.
 */

export type NavLink = {
    /** Etichetta visibile del link. */
    label: string;
    /** Path o URL finale del link — con eventuali segmenti `:xxx` già sostituiti (vedi
     *  `NavItemOptions.params`), ma senza query string appesa: quest'ultima va definita separatamente in
     *  `queryParams` (routerLink non la interpreterebbe se concatenata direttamente nella stringa). */
    path: string;
    /** true se il link punta a una risorsa esterna al sito (externalUrl o link diretto http/https). */
    isExternal: boolean;
    /** Query params del link, se impostati via `NavItemOptions.queryParams` — bindati a parte
     *  (`[queryParams]`) dal componente che rende il link, mai concatenati in `path`. */
    queryParams?: Record<string, string>;
    /** Eventuali link figli se l'elemento rappresenta un gruppo. */
    children?: NavLink[];
    /** `true` se la voce (o l'intero gruppo) va mostrata solo a utente loggato — vedi
     *  `NavItemOptions.authOnly` su `addPage`/`addLink`/`addGroup`. Filtrato a runtime da
     *  `filterNavByAuth`, non qui: la struttura resta identica per bot e utenti sloggati. */
    authOnly?: boolean;
    /** Classe(i) CSS aggiuntive sulla voce (o sull'intero gruppo, se su `addGroup`) — vedi
     *  `NavItemOptions.itemClass`. Si aggiunge allo stile di default del contenitore
     *  (`cssClass` su `app-nav-link`), non lo sostituisce. */
    itemClass?: string;
};

/** Verifica se un `NavLink` è un gruppo (ha figli): usato da navbar, dropdown, submenu e footer per il render ricorsivo. */
export const isNavGroup = (item: NavLink): item is NavLink & { children: NavLink[] } =>
    Array.isArray(item.children) && item.children.length > 0;

/** Chiave stabile per il `track` degli `@for` che rendono `NavLink[]` (navbar, dropdown, submenu,
 *  footer): `path` da solo non basta quando due voci condividono lo stesso `PageType`/path — con
 *  `queryParams` diversi (es. due filtri sulla stessa pagina) o con la stessa destinazione ma
 *  un'etichetta diversa (es. un collegamento rapido duplicato altrove nel menu). Angular
 *  segnalerebbe chiavi duplicate (NG0955) e la reconciliation del DOM potrebbe riusare il nodo
 *  sbagliato. */
export function navLinkKey(item: NavLink): string {
    const qp = item.queryParams ? `?${new URLSearchParams(item.queryParams).toString()}` : '';
    return `${item.path}${qp}#${item.label}`;
}

/**
 * Filtra ricorsivamente un albero `NavLink` in base allo stato di login: le voci (o interi
 * gruppi) con `authOnly: true` spariscono se `loggedIn` è `false`. Un gruppo rimasto senza
 * figli dopo il filtro sparisce a sua volta — stessa regola già applicata in fase di risoluzione
 * per i gruppi vuoti (`resolveNavItems`), qui ripetuta perché il login è runtime.
 *
 * Solo `true`/`false`: la shell non conosce ruoli, solo "loggato / non loggato"
 * (`TokenService.isLoggedIn()`). Chi ha bisogno di granularità per-ruolo la gestisce a monte,
 * nel proprio resolver (`ShellNavResolver`).
 *
 * Usato da `navbar.component.ts` e `footer.component.ts` (Engine).
 */
export function filterNavByAuth(items: NavLink[], loggedIn: boolean): NavLink[] {
    return items.reduce<NavLink[]>((visible, item) => {
        if (item.authOnly && !loggedIn) return visible;
        if (isNavGroup(item)) {
            const children = filterNavByAuth(item.children, loggedIn);
            if (children.length === 0) return visible;
            visible.push({ ...item, children });
        } else {
            visible.push(item);
        }
        return visible;
    }, []);
}

/**
 * Opzioni comuni alle tre azioni del builder di navigazione (`addPage`/`addLink`/`addGroup`).
 */
export interface NavItemOptions {
    /**
     * Se `true`, la voce — o l'intero gruppo, se su `addGroup` — compare in navbar/footer solo
     * per utenti loggati (`TokenService.isLoggedIn()`), sparendo del tutto per visitatori e bot:
     * niente più link fantasma verso pagine `requiresAuth` per chi non può comunque accedervi.
     * Il filtro è runtime (`filterNavByAuth`), non alla risoluzione: la struttura resta identica,
     * cambia solo cosa viene mostrato al render. Default `false` (sempre visibile).
     *
     * Volutamente binario — loggato/non loggato, non un sistema di ruoli: la granularità
     * per-ruolo è complessità di dominio (un progetto che ne ha bisogno filtra nel proprio
     * `ShellNavResolver`), non generica abbastanza da meritare un seam qui.
     */
    authOnly?: boolean;
    /**
     * Valori per i segmenti `:xxx` del path risolto (`addPage`) o passato (`addLink`), es.
     * `{ slug: 'incel' }` su `/generatori/:slug` produce `/generatori/incel` — serve a collegare
     * in menu una voce concreta di una rotta parametrica senza ricostruire il path a mano
     * (`getPath(pageType)` da solo risolverebbe al template letterale). Un segmento senza valore
     * resta invariato (warning in dev); chiavi senza un segmento da riempire sono ignorate.
     */
    params?: Record<string, string>;
    /** Query params del link, es. `{ gen: 'incel' }` → `?gen=incel`. Tenuti separati dal path
     *  risolto (mai concatenati a mano): il componente che rende il link li passa a `[queryParams]`,
     *  l'unico modo con cui `routerLink` li interpreta davvero come query e non come segmento path. */
    queryParams?: Record<string, string>;
    /** Etichetta custom per una voce `addPage`, al posto del titolo della pagina — es. il nome di
     *  un prodotto per un'istanza concreta di una rotta parametrica. Ignorata da `addLink`/`addGroup`. */
    label?: string;
    /** Classe(i) CSS aggiuntive sulla voce (o sull'intero gruppo, su `addGroup`) — si somma allo
     *  stile di default del contenitore, non lo sostituisce. Stesso ruolo di `itemClass` su
     *  `addField`/`addText`/`addSocialLink` nel footer. */
    itemClass?: string;
}

/**
 * Builder usato all'interno delle sezioni di navigazione.
 *
 * Espone tre azioni:
 * - `addPage(...)`  -> aggiunge un riferimento a una pagina tramite PageType
 * - `addLink(...)`  -> aggiunge un link a un URL esterno
 * - `addGroup(...)` -> crea un gruppo annidato con una callback
 */
export interface NavSectionBuilder {
    /**
     * Aggiunge un riferimento a una pagina del sito tramite `PageType`.
     * @param pageType Tipo pagina da risolvere in fase finale.
     * @param options Opzioni della voce (es. `authOnly`, `label` per un'etichetta diversa dal titolo della pagina).
     */
    addPage: (pageType: PageType, options?: NavItemOptions) => void;
    /**
     * Aggiunge un link a una risorsa esterna al sito. Per una pagina interna (con o senza
     * etichetta custom) usa `addPage` — non questo.
     * @param labelTranslationKey Chiave di traduzione o etichetta del link.
     * @param destinationPath URL di destinazione (http/https).
     * @param options Opzioni della voce (es. `authOnly`).
     */
    addLink: (labelTranslationKey: string, destinationPath: string, options?: NavItemOptions) => void;
    /**
     * Crea un gruppo annidato nella navigazione.
     * @param groupLabelTranslationKey Chiave di traduzione o etichetta del gruppo.
     * @param configureGroupItems Callback che definisce gli elementi del gruppo.
     * @param options Opzioni del gruppo (es. `authOnly`: nasconde l'intero gruppo se sloggato).
     */
    addGroup: (
        groupLabelTranslationKey: string,
        configureGroupItems: (groupItemsBuilder: NavSectionBuilder) => void,
        options?: NavItemOptions
    ) => void;
}

/**
 * Rappresentazione intermedia "grezza" della navigazione, accumulata da `NavSectionBuilder`
 * prima della risoluzione finale in `NavLink[]` — un riferimento a `PageType` non porta ancora
 * path/etichetta (dipendono dalla lingua), un link diretto sì.
 */
export type RawNavItem =
    | { kind: 'page'; type: PageType; label?: string; authOnly?: boolean; params?: Record<string, string>; queryParams?: Record<string, string>; itemClass?: string }
    | { kind: 'link'; label: string; path: string; authOnly?: boolean; params?: Record<string, string>; queryParams?: Record<string, string>; itemClass?: string }
    | { kind: 'group'; label: string; children: RawNavItem[]; authOnly?: boolean; itemClass?: string };

const isRawGroup = (
    item: RawNavItem
): item is { kind: 'group'; label: string; children: RawNavItem[]; authOnly?: boolean } =>
    item.kind === 'group';

/** Strumenti per popolare una sezione di navigazione (header/footer): addPage / addLink / addGroup. */
export function createNavSectionBuilder(target: RawNavItem[]): NavSectionBuilder {
    return {
        addPage: (pageType, options) => { target.push({ kind: 'page', type: pageType, label: options?.label, authOnly: options?.authOnly, params: options?.params, queryParams: options?.queryParams, itemClass: options?.itemClass }); },
        addLink: (label, path, options) => { target.push({ kind: 'link', label, path, authOnly: options?.authOnly, params: options?.params, queryParams: options?.queryParams, itemClass: options?.itemClass }); },
        addGroup: (label, configure, options) => {
            const children: RawNavItem[] = [];
            configure(createNavSectionBuilder(children));
            target.push({ kind: 'group', label, children, authOnly: options?.authOnly, itemClass: options?.itemClass });
        },
    };
}

/** Risolve un `PageType` in path/titolo/isExternal per una lingua — iniettata da chi chiama
 *  `resolveNavItems` (tipicamente `ContestoSito.getPageInfo`), per non legare questo modulo
 *  a `siteBuilder.ts`/`ContestoSito` più di quanto serva. */
export type PageInfoLookup = (type: PageType, lang: string) => { title: string; path: string; isExternal: boolean } | null;

/**
 * Risolve gli item grezzi di navigazione in `NavLink` finali per una data lingua: i riferimenti
 * `PageType` passano da `lookupPage`; i gruppi vuoti e i riferimenti non risolti vengono scartati.
 */
export function resolveNavItems(items: RawNavItem[], lookupPage: PageInfoLookup, lang: string): NavLink[] {
    return items
        .map((item): NavLink | null => {
            if (item.kind === 'page') {
                const entry = lookupPage(item.type, lang);
                if (!entry && isDevMode()) {
                    console.warn(`[ShellNav] addPage("${String(item.type)}") non risolve a nessuna pagina registrata (disabilitata o mai dichiarata in pages): voce di navigazione esclusa.`);
                }
                if (!entry) return null;
                const path = applyPathParams(entry.path, item.params, `addPage("${String(item.type)}")`);
                return { label: item.label ?? entry.title, path, isExternal: entry.isExternal, queryParams: item.queryParams, authOnly: item.authOnly, itemClass: item.itemClass };
            }
            if (isRawGroup(item)) {
                const children = resolveNavItems(item.children, lookupPage, lang);
                // '#group:...' è un sentinel: la navbar lo tratta come dropdown, non ci naviga.
                return children.length > 0
                    ? { label: item.label, path: `#group:${item.label}`, isExternal: false, children, authOnly: item.authOnly, itemClass: item.itemClass }
                    : null;
            }
            // addLink è per URL esterni: avvisa (dev) se il path non lo è — per una pagina interna,
            // anche con etichetta custom, usa addPage.
            const path = applyPathParams(item.path, item.params, `addLink("${item.label}")`);
            const isExternal = path.startsWith('http://') || path.startsWith('https://');
            if (!isExternal && isDevMode()) {
                console.warn(`[ShellNav] addLink("${item.label}", "${item.path}") non è un URL esterno: usa addPage per una pagina interna del sito.`);
            }
            return { label: item.label, path, isExternal, queryParams: item.queryParams, authOnly: item.authOnly, itemClass: item.itemClass };
        })
        .filter((item): item is NavLink => item !== null);
}

/**
 * Limiti di profondità della navigazione (header e footer condividono la stessa struttura).
 * Livello 1 = voci di primo livello; ogni discesa in `children` aggiunge un livello.
 */
const NAV_DEPTH_WARN = 4; // da questo livello in poi: avviso di usabilità (dev). 3 livelli (voce → dropdown → sottomenu) è la profondità dimostrata dal template ed è ok.
const NAV_DEPTH_MAX = 5;  // livelli oltre questo: errore bloccante

/**
 * Valida la profondità di una sezione di navigazione risolta: lancia se si annida oltre
 * `NAV_DEPTH_MAX` livelli, avvisa (solo in dev) se si raggiunge `NAV_DEPTH_WARN`.
 *
 * @throws Se un gruppo genera figli oltre il quinto livello di profondità.
 */
export function validateNavDepth(items: NavLink[], section: 'header' | 'footer'): void {
    // Profondità massima effettivamente raggiunta, per decidere l'avviso una sola volta.
    let maxDepth = 0;

    const walk = (nodes: NavLink[], depth: number): void => {
        if (depth > maxDepth) maxDepth = depth;
        for (const node of nodes) {
            if (isNavGroup(node)) {
                // I figli di questo gruppo stanno a depth+1: oltre il quinto livello è bloccante.
                if (depth + 1 > NAV_DEPTH_MAX) {
                    throw new Error(
                        `[ShellNav] Navigazione ${section}: superato il limite di ${NAV_DEPTH_MAX} livelli di ` +
                        `profondità sul gruppo "${node.label}". Annidare oltre il quinto livello non è consentito: ` +
                        `riduci la gerarchia.`
                    );
                }
                walk(node.children, depth + 1);
            }
        }
    };

    walk(items, 1);

    if (isDevMode() && maxDepth >= NAV_DEPTH_WARN) {
        console.warn(
            `[ShellNav] Navigazione ${section}: profondità ${maxDepth} livelli (max consigliato: ${NAV_DEPTH_WARN - 1}). ` +
            `Aumentare la profondità della navigazione peggiora usabilità, accessibilità, facilità di navigazione e ` +
            `comprensione della struttura informativa. Valuta di appiattire la gerarchia.`
        );
    }
}

/** Contesto passato a un `ShellNavResolver`: lingua per cui risolvere la navigazione, `getPath`
 *  per risolvere un `PageType` in path grezzo (senza sostituzione `:xxx`) quando serve fuori dal
 *  builder — per una voce di navigazione vera e propria usa `addPage` (che risolve params e titolo
 *  in un solo passaggio), non questo — e `identity`, l'`Identity` del sito già risolta dall'engine
 *  (stesso fetch condiviso di `IdentityService`, `null` se il sito non la configura): serve al
 *  resolver del footer per costruire a mano un `addSocialLink`/`addText` a partire da un dato reale
 *  (es. filtrare `identity.social` su un solo profilo) senza doverla andare a recuperare da sé. */
export interface ShellNavContext {
    lang: string;
    getPath: (type: PageType, lang: string) => string | null;
    identity: Identity | null;
}

/**
 * Sorgente delle voci di navigazione di header/footer: sincrona (`void`) per una dichiarazione
 * statica, o asincrona (`Promise<void>`) per un resolver che dipende da un'API — stesso builder
 * `addPage`/`addLink`/`addGroup` in entrambi i casi, cambia solo se la callback aspetta qualcosa
 * prima di chiamarlo. Vedi `services/shell-nav.service.ts`.
 */
export interface ShellNavResolver {
    header?: (nav: NavSectionBuilder, ctx: ShellNavContext) => void | Promise<void>;
    /** Il builder del footer è un superset di quello dell'header: oltre a `addPage`/`addLink`/
     *  `addGroup`, ogni gruppo (`FooterGroupBuilder`) accetta anche `addField` (un campo di
     *  `Identity` mappato dall'engine, auto-nascosto se vuoto), `addText` (chiave/valore libero) e
     *  `addSocialLink` — vedi `footer-content.ts` e la sezione footer più sotto in questo file. */
    footer?: (nav: FooterSectionBuilder, ctx: ShellNavContext) => void | Promise<void>;
    /** QUALE icona del brand mostrare in navbar, risolvibile a runtime come `header`/`footer`:
     *  assente → `favIcon` di default, una stringa è una chiave di `mapping.json` o il GUID di un
     *  blob (stessa risoluzione "mapping poi blob" di `cdn-asset.ts`). SE comparire non è più qui:
     *  è `DesignSystemPreset.showBrandIcon`/`SpecRuoloPagina.showBrandIcon` (design-system-presets.ts)
     *  — stessa decisione estetica di nav/footer/pannello, non un dato di contenuto. */
    brandIcon?: (ctx: ShellNavContext) => string | Promise<string>;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// FOOTER: builder e risoluzione dei gruppi con contenuto misto (link + campi Identity + testo libero)
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// Il footer riusa `addPage`/`addLink`/`addGroup` (stesso builder dell'header, stessa risoluzione dei
// `PageType`), ma i figli di un gruppo possono anche essere `addField` (un `FooterField` mappato su
// `Identity`), `addText` (chiave/valore libero, per ciò che l'engine non può conoscere) e
// `addSocialLink` (URL esplicito, mai dedotto automaticamente da `identity.social` — un elenco social
// è una scelta del progetto, non un dato che l'engine può "indovinare" di voler mostrare per intero).
// Deliberatamente NON disponibili in cima al footer (solo dentro un gruppo): ogni esempio discusso li
// usa per dare contenuto a una colonna, mai sciolti come i link liberi — tenerli solo lì evita una
// terza modalità di rendering per la fascia dei link sciolti (`FooterLinkRowComponent`).

/** Builder disponibile SOLO dentro un `addGroup` del footer: oltre a link/pagine/sottogruppi, i
 *  contenuti mappati dall'identità o dichiarati a mano. */
export interface FooterGroupBuilder {
    addPage: NavSectionBuilder['addPage'];
    addLink: NavSectionBuilder['addLink'];
    /** Sottogruppo annidato, stesso builder ricorsivamente (stesso limite di profondità di
     *  `validateFooterDepth` più sotto). */
    addGroup: (label: string, configure: (group: FooterGroupBuilder) => void, options?: NavItemOptions) => void;
    /** Campo di `Identity` mappato dall'engine: label, valore e formato risolti da `FooterField`
     *  (`footer-content.ts`), nascosto in automatico se il sito non lo valorizza. `itemClass`
     *  aggiunge classi allo stile di default (testo/codice/badge) senza sostituirlo. */
    addField: (field: FooterField, options?: { itemClass?: string }) => void;
    /** Chiave/valore libero: `label` segue la stessa convenzione di `addLink` (chiave di traduzione
     *  o etichetta letterale — non trovata → resta invariata, solo un avviso in dev), `value` non è
     *  mai tradotto (è un dato, non testo d'interfaccia). Per un valore stesso localizzato per
     *  lingua, componilo con `pickLocaleText` prima di passarlo qui.
     *  `skipEmptyValue` (default `true`): come `addField`, nasconde la voce se `value` è vuoto/solo
     *  spazi — utile quando `value` viene da un dato che il progetto stesso può non avere. Portalo a
     *  `false` per mostrarla comunque (es. un'etichetta voluta anche senza valore). */
    addText: (label: string, value: string, options?: { itemClass?: string; kind?: FooterItemKind; skipEmptyValue?: boolean }) => void;
    /** Social esplicito: `url` letterale o preso da `ctx.identity.social` (es. filtrato a un solo
     *  profilo) — l'icona è dedotta dall'URL, stessa logica di `app-social-link` nel blocco identità. */
    addSocialLink: (url: string, label?: string, options?: { itemClass?: string; authOnly?: boolean }) => void;
    /** Via di fuga: un componente Angular proprio del progetto per un rendering che gli altri
     *  metodi non coprono (stesso ruolo di `kind: 'raw'` in `structured-data.ts`) — es. un social
     *  con un widget dedicato invece del solo link+icona di `addSocialLink`. `inputs` viene passato
     *  tale e quale a `NgComponentOutlet`. `key` serve solo a distinguere due foglie con lo stesso
     *  `component` nello stesso gruppo (altrimenti il fallback sul nome della classe collide, come
     *  già succede con `navLinkKey` per due voci identiche — vedi `footerLeafKey`). */
    addCustom: (component: Type<unknown>, options?: { inputs?: Record<string, unknown>; itemClass?: string; authOnly?: boolean; key?: string }) => void;
}

/** Builder di primo livello del footer: solo `addPage`/`addLink`/`addGroup` (i contenuti mappati
 *  vivono dentro i gruppi, vedi `FooterGroupBuilder`). */
export interface FooterSectionBuilder {
    addPage: NavSectionBuilder['addPage'];
    addLink: NavSectionBuilder['addLink'];
    addGroup: (label: string, configure: (group: FooterGroupBuilder) => void, options?: NavItemOptions) => void;
    /** Disattiva la fascia "small print" automatica in fondo al footer (le pagine legali di
     *  `config.legalPages`, oggi renderizzate incondizionatamente da `footer.component.html`).
     *  Serve solo a chi piazza le pagine legali a mano in un gruppo custom (`addPage(spec.pageType)`
     *  su `ContestoSito.config.legalPages`, la stessa fonte della fascia automatica) — senza
     *  chiamarla la fascia resta quella di sempre, invariata per chi non tocca nulla. */
    hideLegalStrip: () => void;
}

type RawFooterLeaf =
    | Extract<RawNavItem, { kind: 'page' }>
    | Extract<RawNavItem, { kind: 'link' }>
    | { kind: 'field'; field: FooterField; itemClass?: string }
    | { kind: 'text'; label: string; value: string; itemKind?: FooterItemKind; itemClass?: string; skipEmptyValue?: boolean }
    | { kind: 'social'; url: string; label?: string; itemClass?: string; authOnly?: boolean }
    | { kind: 'custom'; component: Type<unknown>; inputs?: Record<string, unknown>; itemClass?: string; authOnly?: boolean; key?: string }
    | { kind: 'group'; label: string; children: RawFooterLeaf[]; authOnly?: boolean; itemClass?: string };

export type RawFooterEntry =
    | Extract<RawNavItem, { kind: 'page' }>
    | Extract<RawNavItem, { kind: 'link' }>
    | { kind: 'group'; label: string; children: RawFooterLeaf[]; authOnly?: boolean; itemClass?: string };

/** Stato accumulato dal `FooterSectionBuilder` durante la callback del resolver: gli item (come
 *  `RawNavItem[]` per l'header) più `hideLegalStrip`, che non è un item ma una decisione a parte
 *  su una fascia del footer che il builder non modella come contenuto. */
export interface FooterBuildState {
    entries: RawFooterEntry[];
    hideLegalStrip: boolean;
}

function createFooterGroupBuilder(target: RawFooterLeaf[]): FooterGroupBuilder {
    return {
        addPage: (type, options) => { target.push({ kind: 'page', type, label: options?.label, authOnly: options?.authOnly, params: options?.params, queryParams: options?.queryParams, itemClass: options?.itemClass }); },
        addLink: (label, path, options) => { target.push({ kind: 'link', label, path, authOnly: options?.authOnly, params: options?.params, queryParams: options?.queryParams, itemClass: options?.itemClass }); },
        addGroup: (label, configure, options) => {
            const children: RawFooterLeaf[] = [];
            configure(createFooterGroupBuilder(children));
            target.push({ kind: 'group', label, children, authOnly: options?.authOnly, itemClass: options?.itemClass });
        },
        addField: (field, options) => { target.push({ kind: 'field', field, itemClass: options?.itemClass }); },
        addText: (label, value, options) => { target.push({ kind: 'text', label, value, itemKind: options?.kind, itemClass: options?.itemClass, skipEmptyValue: options?.skipEmptyValue }); },
        addSocialLink: (url, label, options) => { target.push({ kind: 'social', url, label, itemClass: options?.itemClass, authOnly: options?.authOnly }); },
        addCustom: (component, options) => { target.push({ kind: 'custom', component, inputs: options?.inputs, itemClass: options?.itemClass, authOnly: options?.authOnly, key: options?.key }); },
    };
}

/** Strumenti per popolare il footer: stesso `addPage`/`addLink` dell'header, `addGroup` annidato con
 *  `FooterGroupBuilder` (link + campi Identity + testo libero + social, vedi sopra), più
 *  `hideLegalStrip` — scrive tutto in `state`, letto da `resolveFooterItems`/`ShellNavService` a
 *  callback completata. */
export function createFooterSectionBuilder(state: FooterBuildState): FooterSectionBuilder {
    const target = state.entries;
    return {
        addPage: (type, options) => { target.push({ kind: 'page', type, label: options?.label, authOnly: options?.authOnly, params: options?.params, queryParams: options?.queryParams, itemClass: options?.itemClass }); },
        addLink: (label, path, options) => { target.push({ kind: 'link', label, path, authOnly: options?.authOnly, params: options?.params, queryParams: options?.queryParams, itemClass: options?.itemClass }); },
        addGroup: (label, configure, options) => {
            const children: RawFooterLeaf[] = [];
            configure(createFooterGroupBuilder(children));
            target.push({ kind: 'group', label, children, authOnly: options?.authOnly, itemClass: options?.itemClass });
        },
        hideLegalStrip: () => { state.hideLegalStrip = true; },
    };
}

/** Risolve un item grezzo in zero, una o più foglie finali: zero se non risolve (pagina disabilitata,
 *  campo Identity assente, gruppo rimasto vuoto), più di una solo per `addField(FooterField.
 *  PartitaIvaCodiceFiscale)` quando i due valori differiscono (vedi `resolveFooterField`) — tutti
 *  gli altri casi restano a una foglia, il tipo di ritorno è array per trattarli con lo stesso `flatMap`. */
function resolveFooterLeaf(item: RawFooterLeaf, lookupPage: PageInfoLookup, identity: Identity | null, deps: FooterFieldDeps, lang: string): FooterGroupChild[] {
    switch (item.kind) {
        case 'field':
            // Nessuna identità configurata per il sito → il campo non esiste, non un valore vuoto: sparisce.
            return identity ? resolveFooterField(item.field, identity, deps, item.itemClass) : [];
        case 'text': {
            const skipEmpty = item.skipEmptyValue ?? true;
            if (skipEmpty && !hasText(item.value)) return [];
            return [{ kind: 'value', label: item.label, value: item.value, itemKind: item.itemKind ?? 'text', itemClass: item.itemClass }];
        }
        case 'social':
            return hasText(item.url) ? [{ kind: 'social', url: item.url.trim(), label: item.label, itemClass: item.itemClass }] : [];
        case 'custom':
            return [{ kind: 'custom', component: item.component, inputs: item.inputs, itemClass: item.itemClass, authOnly: item.authOnly, key: item.key }];
        case 'group': {
            const children = item.children.flatMap(child => resolveFooterLeaf(child, lookupPage, identity, deps, lang));
            // Un gruppo censito in nav.ts ma rimasto senza figli (campi tutti vuoti per questo sito,
            // pagine disabilitate) sparisce anche lui: mai una colonna con solo il titolo e niente sotto.
            return children.length > 0 ? [{ kind: 'group', label: item.label, authOnly: item.authOnly, itemClass: item.itemClass, children }] : [];
        }
        case 'page': {
            const entry = lookupPage(item.type, lang);
            if (!entry) {
                if (isDevMode()) console.warn(`[ShellNav] addPage("${String(item.type)}") non risolve a nessuna pagina registrata: voce di footer esclusa.`);
                return [];
            }
            const path = applyPathParams(entry.path, item.params, `addPage("${String(item.type)}")`);
            return [{ kind: 'link', label: item.label ?? entry.title, path, isExternal: entry.isExternal, queryParams: item.queryParams, authOnly: item.authOnly, itemClass: item.itemClass }];
        }
        case 'link': {
            const path = applyPathParams(item.path, item.params, `addLink("${item.label}")`);
            const isExternal = path.startsWith('http://') || path.startsWith('https://');
            if (!isExternal && isDevMode()) {
                console.warn(`[ShellNav] addLink("${item.label}", "${item.path}") non è un URL esterno: usa addPage per una pagina interna del sito.`);
            }
            return [{ kind: 'link', label: item.label, path, isExternal, queryParams: item.queryParams, authOnly: item.authOnly, itemClass: item.itemClass }];
        }
    }
}

/** Risolve gli item grezzi del footer in `FooterEntry[]` per una data lingua/identità: stessa logica
 *  di `resolveNavItems` (pagine non risolte e gruppi vuoti scartati), estesa ai campi Identity e al
 *  testo libero — un `addField` il cui valore è assente per questo sito è "non risolto" esattamente
 *  come un `addPage` verso una pagina disabilitata. */
export function resolveFooterItems(items: RawFooterEntry[], lookupPage: PageInfoLookup, identity: Identity | null, deps: FooterFieldDeps, lang: string): FooterEntry[] {
    // Cast sicuro: `RawFooterEntry` contiene solo i kind 'page'/'link'/'group', quindi
    // `resolveFooterLeaf` (che accetta l'unione più ampia `RawFooterLeaf`) su questo input non
    // imbocca mai i rami 'field'/'text'/'social' — il risultato è già `FooterEntry[]`.
    return items.flatMap(item => resolveFooterLeaf(item, lookupPage, identity, deps, lang) as FooterEntry[]);
}

/** Chiave stabile per il `track` degli `@for` che rendono `FooterEntry[]`/`FooterGroupChild[]` —
 *  stesso ruolo di `navLinkKey`, ma sulla forma più ricca del footer (un gruppo non ha `path`, un
 *  campo/testo non ha nemmeno `label` garantita univoca da sola). */
export function footerLeafKey(entry: FooterGroupChild): string {
    switch (entry.kind) {
        case 'link': return navLinkKey(entry);
        case 'group': return `group:${entry.label}`;
        case 'value': return `value:${entry.label}:${entry.value}`;
        case 'hours': return `hours:${entry.label}`;
        case 'social': return `social:${entry.url}`;
        case 'custom': return `custom:${entry.key ?? entry.component.name}`;
    }
}

/** Filtra ricorsivamente il footer risolto in base al login — stessa regola di `filterNavByAuth`
 *  (una voce/gruppo `authOnly` sparisce se sloggato, un gruppo rimasto vuoto dopo il filtro sparisce
 *  anche lui), estesa a `FooterGroupChild` così un `addField`/`addText` dentro un gruppo `authOnly`
 *  segue la stessa sorte del gruppo che lo contiene. I campi Identity in sé non hanno `authOnly`
 *  (sono dati pubblici del sito, non contenuto riservato) e non vengono mai filtrati qui. */
export function filterFooterByAuth(entries: FooterEntry[], loggedIn: boolean): FooterEntry[] {
    return filterFooterChildrenByAuth(entries, loggedIn) as FooterEntry[];
}

function filterFooterChildrenByAuth(children: FooterGroupChild[], loggedIn: boolean): FooterGroupChild[] {
    return children.reduce<FooterGroupChild[]>((visible, child) => {
        if ('authOnly' in child && child.authOnly && !loggedIn) return visible;
        if (child.kind === 'group') {
            const filteredChildren = filterFooterChildrenByAuth(child.children, loggedIn);
            if (filteredChildren.length === 0) return visible;
            visible.push({ ...child, children: filteredChildren });
        } else {
            visible.push(child);
        }
        return visible;
    }, []);
}

/** Soglie di larghezza/densità del footer, dalle linee guida UXPin su footer design (4-6 colonne,
 *  ~40-50 link prima di valutare un accordion/una sitemap dedicata): solo un promemoria dev-mode
 *  (Hick's Law — più scelte visibili insieme, più lento scansionarle), mai bloccante. La libertà di
 *  quante colonne mettere resta del progetto; questo avvisa soltanto quando probabilmente conviene
 *  raggruppare di più. */
const FOOTER_GROUPS_WARN = 6;
const FOOTER_ITEMS_WARN = 50;

export function validateFooterBreadth(entries: FooterEntry[]): void {
    if (!isDevMode()) return;
    const groups = entries.filter((entry): entry is Extract<FooterEntry, { kind: 'group' }> => entry.kind === 'group');
    if (groups.length > FOOTER_GROUPS_WARN) {
        console.warn(`[ShellNav] Footer: ${groups.length} colonne dichiarate (consigliate 4-6, vedi linee guida UXPin sul footer design). Troppe colonne affollano la scansione visiva — valuta di raggrupparle ulteriormente.`);
    }
    const totalItems = countFooterLeaves(entries);
    if (totalItems > FOOTER_ITEMS_WARN) {
        console.warn(`[ShellNav] Footer: ${totalItems} elementi totali nel footer (consigliato restare sotto ~50). Valuta una sitemap dedicata o un accordion per la parte meno consultata.`);
    }
}

function countFooterLeaves(children: readonly FooterGroupChild[]): number {
    return children.reduce((total, child) => total + (child.kind === 'group' ? countFooterLeaves(child.children) : 1), 0);
}

/** Stesso limite di profondità di `validateNavDepth` (`NAV_DEPTH_WARN`/`NAV_DEPTH_MAX`), applicato
 *  all'albero del footer: duplicato apposta invece di generalizzare `validateNavDepth`, per non
 *  costringere l'header (che non conosce `FooterGroupChild`) a dipendere dai tipi del footer. */
export function validateFooterDepth(entries: FooterEntry[]): void {
    let maxDepth = 0;
    const walk = (nodes: readonly FooterGroupChild[], depth: number): void => {
        if (depth > maxDepth) maxDepth = depth;
        for (const node of nodes) {
            if (node.kind === 'group') {
                if (depth + 1 > NAV_DEPTH_MAX) {
                    throw new Error(`[ShellNav] Navigazione footer: superato il limite di ${NAV_DEPTH_MAX} livelli di profondità sul gruppo "${node.label}". Annidare oltre il quinto livello non è consentito: riduci la gerarchia.`);
                }
                walk(node.children, depth + 1);
            }
        }
    };
    walk(entries, 1);
    if (isDevMode() && maxDepth >= NAV_DEPTH_WARN) {
        console.warn(`[ShellNav] Navigazione footer: profondità ${maxDepth} livelli (max consigliato: ${NAV_DEPTH_WARN - 1}). Aumentare la profondità della navigazione peggiora usabilità, accessibilità, facilità di navigazione e comprensione della struttura informativa. Valuta di appiattire la gerarchia.`);
    }
}
