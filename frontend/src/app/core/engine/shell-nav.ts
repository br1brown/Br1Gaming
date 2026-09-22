import { isDevMode, type Type } from '@angular/core';
import type { PageType } from '../../site';
import { ContestoSito } from '../../site';
import { applyPathParams } from './siteBuilder';
import type { Identity } from './dto/identity.dto';
import { FooterField, FooterFieldDeps, FooterEntry, FooterGroupChild, FooterItemKind, resolveFooterField } from './footer-content';
import { hasText } from './identity-format';

// Re-esportati: chi consuma la navigazione importa i tipi del footer da qui (stesso modulo di
// `NavLink`/`NavSectionBuilder`), non separatamente da `footer-content.ts`.
export { FooterField };
export type { FooterEntry, FooterGroupChild, FooterFieldDeps, FooterItemKind };

/** Voci di navigazione della shell: dato risolvibile a runtime (non struttura del sito come le rotte). Vedi `services/shell-nav.service.ts`. */
export type NavLink = {
    label: string;
    /** Path o URL finale, con eventuali segmenti `:xxx` già sostituiti; senza query string (va in `queryParams` a parte). */
    path: string;
    isExternal: boolean;
    /** Bindato a parte (`[queryParams]`) dal componente, mai concatenato in `path`. */
    queryParams?: Record<string, string>;
    children?: NavLink[];
    /** Mostrata solo a utente loggato, filtrato a runtime da `filterNavByAuth`. */
    authOnly?: boolean;
    /** Si aggiunge allo stile di default del contenitore, non lo sostituisce. */
    itemClass?: string;
};

/** Verifica se un `NavLink` è un gruppo (ha figli): usato da navbar, dropdown, submenu e footer per il render ricorsivo. */
export const isNavGroup = (item: NavLink): item is NavLink & { children: NavLink[] } =>
    Array.isArray(item.children) && item.children.length > 0;

/** Chiave stabile per il `track` degli `@for` che rendono `NavLink[]`: `path` da solo non basta quando due voci condividono lo stesso path con `queryParams` o etichetta diversi (Angular segnalerebbe NG0955, chiavi duplicate). */
export function navLinkKey(item: NavLink): string {
    const qp = item.queryParams ? `?${new URLSearchParams(item.queryParams).toString()}` : '';
    return `${item.path}${qp}#${item.label}`;
}

/** Filtra ricorsivamente un albero `NavLink` per login: voci/gruppi con `authOnly: true` spariscono se `loggedIn` è false, un gruppo rimasto senza figli sparisce a sua volta. Solo true/false (non ruoli): la granularità per-ruolo va nel proprio `ShellNavResolver`. */
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
    /** Se true, la voce (o l'intero gruppo su `addGroup`) compare solo per utenti loggati, filtrato a runtime (`filterNavByAuth`). Binario, non un sistema di ruoli. Default false. */
    authOnly?: boolean;
    /** Valori per i segmenti `:xxx` del path (es. `{ slug: 'incel' }` su `/generatori/:xxx`). Un segmento senza valore resta invariato (warning in dev). */
    params?: Record<string, string>;
    /** Bindati a `[queryParams]` dal componente che rende il link, mai concatenati al path risolto. */
    queryParams?: Record<string, string>;
    /** Etichetta custom per `addPage`, al posto del titolo della pagina. Ignorata da `addLink`/`addGroup`. */
    label?: string;
    /** Si somma allo stile di default del contenitore, non lo sostituisce. */
    itemClass?: string;
}

/** Builder di sezioni di navigazione: `addPage` (PageType), `addLink` (URL esterno), `addGroup` (gruppo annidato). */
export interface NavSectionBuilder {
    addPage: (pageType: PageType, options?: NavItemOptions) => void;
    /** Per una pagina interna usa sempre `addPage`, non questo. */
    addLink: (labelTranslationKey: string, destinationPath: string, options?: NavItemOptions) => void;
    addGroup: (
        groupLabelTranslationKey: string,
        configureGroupItems: (groupItemsBuilder: NavSectionBuilder) => void,
        options?: NavItemOptions
    ) => void;
}

/** Rappresentazione intermedia "grezza" prima della risoluzione in `NavLink[]`: un riferimento a `PageType` non porta ancora path/etichetta (dipendono dalla lingua), un link diretto sì. */
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

/** Valida la profondità di una sezione risolta: lancia oltre `NAV_DEPTH_MAX` livelli, avvisa (solo dev) da `NAV_DEPTH_WARN`. */
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

/** Contesto passato a un `ShellNavResolver`. `getPath` risolve un `PageType` fuori dal builder (per una voce vera usa `addPage`). `identity` è già risolta dall'engine, null se non configurata. */
export interface ShellNavContext {
    lang: string;
    getPath: (type: PageType, lang: string) => string | null;
    identity: Identity | null;
}

/** Sorgente delle voci di header/footer: sincrona o async (se dipende da un'API). Vedi services/shell-nav.service.ts. */
export interface ShellNavResolver {
    header?: (nav: NavSectionBuilder, ctx: ShellNavContext) => void | Promise<void>;
    /** Superset del builder header: ogni gruppo (`FooterGroupBuilder`) accetta anche `addField`/`addText`/`addSocialLink`. Vedi footer-content.ts. */
    footer?: (nav: FooterSectionBuilder, ctx: ShellNavContext) => void | Promise<void>;
    /** Riga "small print" (default: `defaultFooterCopyright`). Passa da `markdownLite` (stesso sottoinsieme del banner cookie: `[testo](url)`/`**grassetto**`). */
    footerCopyright?: (ctx: ShellNavContext) => string | Promise<string>;
    /** Icona brand in navbar; assente → favIcon di default. SE comparire è invece `DesignSystemPreset.showBrandIcon`. */
    brandIcon?: (ctx: ShellNavContext) => string | Promise<string>;
}

// FOOTER: builder e risoluzione dei gruppi con contenuto misto (link + campi Identity + testo libero).
// addField/addText/addSocialLink sono disponibili SOLO dentro un addGroup (mai in cima al footer):
// danno contenuto a una colonna, non sono link sciolti — evita una terza modalità di rendering
// per la fascia link liberi (FooterLinkRowComponent).

/** Builder disponibile solo dentro un `addGroup` del footer: link/pagine/sottogruppi più contenuti mappati dall'identità o dichiarati a mano. */
export interface FooterGroupBuilder {
    addPage: NavSectionBuilder['addPage'];
    addLink: NavSectionBuilder['addLink'];
    addGroup: (label: string, configure: (group: FooterGroupBuilder) => void, options?: NavItemOptions) => void;
    /** Campo di `Identity` mappato dall'engine (`FooterField`), nascosto se il sito non lo valorizza. */
    addField: (field: FooterField, options?: { itemClass?: string }) => void;
    /** Chiave/valore libero: `value` non è mai tradotto (è un dato). `skipEmptyValue` (default true) nasconde la voce se `value` è vuoto. */
    addText: (label: string, value: string, options?: { itemClass?: string; kind?: FooterItemKind; skipEmptyValue?: boolean }) => void;
    /** Social esplicito: `url` letterale o da `ctx.identity.social`; l'icona è dedotta dall'URL. */
    addSocialLink: (url: string, label?: string, options?: { itemClass?: string; authOnly?: boolean }) => void;
    /** Via di fuga: componente Angular di progetto per un rendering che gli altri metodi non coprono. `key` distingue due foglie con lo stesso `component` nello stesso gruppo. */
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

/** Testo di DEFAULT della riga "small print" del footer, usato solo se il progetto non definisce `ShellNavResolver.footerCopyright`. Un progetto lo sostituisce con `footerCopyright` senza reinventare il formato. */
export function defaultFooterCopyright(appName: string, year: number, translate: (key: string) => string): string {
    return `© ${year} **${appName}** | ${translate('dirittiRiservatiAzienda')}`;
}

/** Footer di DEFAULT (Engine), usato solo se il progetto non definisce `ShellNavResolver.footer` (lo sostituisce per intero, mai insieme). Stesso builder/FooterField/chiavi i18n che userebbe un progetto per personalizzarlo — un solo meccanismo, non un componente parallelo che può disallinearsi. */
export function defaultFooterResolver(f: FooterSectionBuilder, ctx: ShellNavContext): void {
    f.addGroup('datiSocietariAzienda', g => {
        g.addField(FooterField.PartitaIvaCodiceFiscale);
        g.addField(FooterField.RegistroImprese);
        g.addField(FooterField.NumeroRea);
        g.addField(FooterField.CodiceSdi);
    });
    f.addGroup('datiLegaliAzienda', g => {
        g.addField(FooterField.CapitaleSociale);
        g.addField(FooterField.CapitaleVersato);
        g.addField(FooterField.SocioUnico);
        g.addField(FooterField.InLiquidazione);
    });
    f.addGroup('contattiAzienda', g => {
        g.addField(FooterField.RagioneSociale);
        g.addField(FooterField.SedeLegale);
        g.addField(FooterField.RappresentanteLegale);
        g.addField(FooterField.TitolareDelTrattamento);
        g.addField(FooterField.ResponsabileProtezioneDati);
        g.addField(FooterField.Telefono);
        g.addField(FooterField.Email);
        g.addField(FooterField.Pec);
        g.addField(FooterField.OpeningHours);
    });
    // I social non sono un FooterField: identity.social è un array, quindi si itera invece di un
    // singolo addField. Gruppo a sé (non annidato sopra) per restare fedele al layout storico.
    // Rispetta footerIdentita ('essenziale' li nasconde).
    const social = ctx.identity?.social;
    if (ContestoSito.config.footerIdentita === 'esteso' && Array.isArray(social) && social.length > 0) {
        f.addGroup('socialAzienda', g => {
            for (const s of social) {
                if (hasText(s?.url)) g.addSocialLink(s.url, s.name);
            }
        });
    }
}

/** Risolve un item grezzo in zero, una o più foglie: zero se non risolve (pagina disabilitata, campo assente, gruppo vuoto), più di una per campi che possono espandersi in due valori (es. nome+email). Ritorna array per trattare tutti i casi con lo stesso `flatMap`. */
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
