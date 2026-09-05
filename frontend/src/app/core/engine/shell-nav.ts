import { isDevMode } from '@angular/core';
import type { PageType } from '../../site';
import { applyPathParams } from './siteBuilder';

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
    | { kind: 'page'; type: PageType; label?: string; authOnly?: boolean; params?: Record<string, string>; queryParams?: Record<string, string> }
    | { kind: 'link'; label: string; path: string; authOnly?: boolean; params?: Record<string, string>; queryParams?: Record<string, string> }
    | { kind: 'group'; label: string; children: RawNavItem[]; authOnly?: boolean };

const isRawGroup = (
    item: RawNavItem
): item is { kind: 'group'; label: string; children: RawNavItem[]; authOnly?: boolean } =>
    item.kind === 'group';

/** Strumenti per popolare una sezione di navigazione (header/footer): addPage / addLink / addGroup. */
export function createNavSectionBuilder(target: RawNavItem[]): NavSectionBuilder {
    return {
        addPage: (pageType, options) => { target.push({ kind: 'page', type: pageType, label: options?.label, authOnly: options?.authOnly, params: options?.params, queryParams: options?.queryParams }); },
        addLink: (label, path, options) => { target.push({ kind: 'link', label, path, authOnly: options?.authOnly, params: options?.params, queryParams: options?.queryParams }); },
        addGroup: (label, configure, options) => {
            const children: RawNavItem[] = [];
            configure(createNavSectionBuilder(children));
            target.push({ kind: 'group', label, children, authOnly: options?.authOnly });
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
                return { label: item.label ?? entry.title, path, isExternal: entry.isExternal, queryParams: item.queryParams, authOnly: item.authOnly };
            }
            if (isRawGroup(item)) {
                const children = resolveNavItems(item.children, lookupPage, lang);
                // '#group:...' è un sentinel: la navbar lo tratta come dropdown, non ci naviga.
                return children.length > 0
                    ? { label: item.label, path: `#group:${item.label}`, isExternal: false, children, authOnly: item.authOnly }
                    : null;
            }
            // addLink è per URL esterni: avvisa (dev) se il path non lo è — per una pagina interna,
            // anche con etichetta custom, usa addPage.
            const path = applyPathParams(item.path, item.params, `addLink("${item.label}")`);
            const isExternal = path.startsWith('http://') || path.startsWith('https://');
            if (!isExternal && isDevMode()) {
                console.warn(`[ShellNav] addLink("${item.label}", "${item.path}") non è un URL esterno: usa addPage per una pagina interna del sito.`);
            }
            return { label: item.label, path, isExternal, queryParams: item.queryParams, authOnly: item.authOnly };
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

/** Contesto passato a un `ShellNavResolver`: lingua per cui risolvere la navigazione, più `getPath`
 *  per risolvere un `PageType` in path grezzo (senza sostituzione `:xxx`) quando serve fuori dal
 *  builder — per una voce di navigazione vera e propria usa `addPage` (che risolve params e titolo
 *  in un solo passaggio), non questo. */
export interface ShellNavContext {
    lang: string;
    getPath: (type: PageType, lang: string) => string | null;
}

/**
 * Sorgente delle voci di navigazione di header/footer: sincrona (`void`) per una dichiarazione
 * statica, o asincrona (`Promise<void>`) per un resolver che dipende da un'API — stesso builder
 * `addPage`/`addLink`/`addGroup` in entrambi i casi, cambia solo se la callback aspetta qualcosa
 * prima di chiamarlo. Vedi `services/shell-nav.service.ts`.
 */
export interface ShellNavResolver {
    header?: (nav: NavSectionBuilder, ctx: ShellNavContext) => void | Promise<void>;
    footer?: (nav: NavSectionBuilder, ctx: ShellNavContext) => void | Promise<void>;
}
