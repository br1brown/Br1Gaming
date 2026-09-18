import { WEB_FONTS, ServerFont, type CustomFontDef } from './font-system';

/**
 * Design system: bundle di campi granulari (tono, superfici, chrome per ruolo, palette, font) che
 * decide l'aspetto del sito — l'UNICA fonte di questi campi, sempre una funzione
 * (`DesignSystemFactory`), mai un letterale statico. `extendDesignSystem` sotto è l'UNICA grammatica
 * per scriverne uno, Engine o dominio — preset condivisi in `components/shared/design-systems/
 * engine/`, dettaglio in frontend/README.md §"Preset di Design System".
 */

/**
 * Ruolo dichiarato da una pagina (`layout.role`) — CHE COSA è, non COME appare: lo decide il design
 * system attivo (`ruoloPagina`). 4 di serie: `'default'`/`'legal'`/`'error'`/`'naked'` (l'unico
 * forzato, vedi `NAKED_CHROME`). `(string & {})` accetta anche ruoli custom, registrati con la loro
 * chiave in `ruoloPagina` e validati a runtime da `assertRuoloConosciuto` (siteBuilder.ts), non dal
 * compilatore. Dettaglio: frontend/README.md §"Ruoli di Pagina".
 */
export type PageRole = 'default' | 'legal' | 'error' | 'naked' | (string & {});

/**
 * Comportamento di un ruolo, campo per campo. I 6 booleani (`showNav`/`showFooter`/`showPanel`/
 * `showBreadcrumb`/`pageFade`/`showBrandIcon`) hanno un interruttore MASTER sul campo globale
 * omonimo (`false` esplicito blocca ogni ruolo); `fitViewport`/`showSmoke` sono puramente per-ruolo,
 * nessun master omonimo (`showSmoke` resta comunque legato a `smoke.enable`). Dettaglio:
 * frontend/README.md §"Ruoli di Pagina".
 */
export interface SpecRuoloPagina {
    /** Mostra la navbar su questo ruolo. Stessa regola/eccezione master di `DesignSystemPreset.showNav`. */
    showNav?: boolean;
    /** Mostra il footer su questo ruolo. Stessa regola/eccezione master di `showNav`. */
    showFooter?: boolean;
    /** Mostra il pannello contenuti su questo ruolo. Stessa regola/eccezione master di `showNav`. */
    showPanel?: boolean;
    /** Vista full-bleed senza pannello/container. Default `false`, nessun master (vedi il commento della classe). */
    fitViewport?: boolean;
    /** Mostra l'effetto smoke su questo ruolo. Subordinato a `DesignSystemPreset.smoke.enable`. */
    showSmoke?: boolean;
    /** Mostra il breadcrumb sulle pagine di questo ruolo. Stessa regola/eccezione master di `showNav`. */
    showBreadcrumb?: boolean;
    /** Fade-in d'ingresso pagina per questo ruolo. Stessa regola/eccezione master di `showNav`. */
    pageFade?: boolean;
    /** Mostra l'icona di brand in navbar su questo ruolo (QUALE icona: `ShellNavResolver.brandIcon`). */
    showBrandIcon?: boolean;
}

/** Chrome del ruolo `'naked'` — valore fisso, nessun design system la personalizza (`resolveRuoloPagina`, siteBuilder.ts). */
export const NAKED_CHROME: SpecRuoloPagina = { showNav: false, showFooter: false, showPanel: false };

/** Default di Engine per `'error'` — niente pannello, scostabile mappando `ruoloPagina.error`. */
export const ERROR_CHROME_DEFAULT: SpecRuoloPagina = { showPanel: false };

/** Default di Engine per `'legal'` — niente smoke decorativo, scostabile mappando `ruoloPagina.legal.showSmoke`. */
export const LEGAL_CHROME_DEFAULT: SpecRuoloPagina = { showSmoke: false };

/** Configurazione dell'effetto smoke (particellare, decorativo) — territorio del design system, non `global-settings.json`. */
export interface SmokeSettings {
    enable: boolean;
    color: string;
    opacity: number;
    maximumVelocity: number;
    particleRadius: number;
    density: number;
}

/** Valore numerico dietro `superfici: 'distinte'` (o assente) — comportamento storico:
 *  near-black/near-white appena tinto. Uso interno, per chi consuma `ThemeService.computePalette`
 *  direttamente con un `backgroundVividness` grezzo (es. i test). */
export const VIVIDEZZA_NEUTRA = 0;
/** Valore numerico dietro `superfici: 'fusione'` — la superficie usa la lucentezza del brand: uno
 *  sfondo che È quel colore, non un nero/bianco tinto. Stesso uso interno di `VIVIDEZZA_NEUTRA`. */
export const VIVIDEZZA_PIENA = 1;

/** Bundle di default per un preset — solo i campi che il preset sceglie di toccare. */
export interface DesignSystemPreset {
    forceThemeTone?: 'light' | 'dark';
    panelSurface?: 'light' | 'dark' | 'auto';
    /** Sfondo/testo di navbar e footer. `'brand'` (default): superficie immersiva derivata dal brand. `'body'`: condivide lo sfondo pagina (es. `muro`). */
    navSurface?: 'brand' | 'body';
    /**
     * Come questo design system interpreta ogni ruolo di `PageRole` — un dizionario aperto, un
     * ruolo in più si registra scrivendo la sua chiave qui. `'naked'` non è qui (hard-coded, vedi
     * `NAKED_CHROME`); `'error'`/`'legal'` hanno anche un default di Engine applicato prima.
     */
    ruoloPagina?: Partial<Record<PageRole, SpecRuoloPagina>>;
    /** Mostra la navbar. Interruttore MASTER: `false` esplicito blocca ogni `ruoloPagina.*.showNav`. Default `true`. */
    showNav?: boolean;
    /** Mostra il footer. Stessa regola/eccezione master di `showNav`. Default `true`. */
    showFooter?: boolean;
    /** Mostra il pannello contenuti (`.content-panel`). Stessa regola/eccezione master di `showNav`.
     *  Default `true` — ma `false` se non impostato e `superfici` è `'fusione'` (vedi sotto). */
    showPanel?: boolean;
    /** Navbar fissa allo scroll — identità del design system, non un flag di sito. Default `false`. */
    fixedTopHeader?: boolean;
    /** Fade-in d'ingresso pagina, default globale per ogni ruolo che non lo scosta (`SpecRuoloPagina.pageFade`). Default `true`. */
    pageFade?: boolean;
    /** Mostra il breadcrumb, default globale per ogni ruolo che non lo scosta (`SpecRuoloPagina.showBreadcrumb`). Default `false`. */
    showBreadcrumb?: boolean;
    /** Mostra l'icona di brand in navbar, default globale per ogni ruolo che non lo scosta. Default `true`. */
    showBrandIcon?: boolean;
    /**
     * Override dei quattro colori derivati opzionali. `colorBackground`/`colorText` restano un
     * suggerimento (garanzia WCAG sempre attiva); `colorSecondary`/`colorInfo` sono override
     * "duri" (l'hex esatto, nessuna garanzia). Dettaglio: frontend/README.md §"Override opzionali".
     */
    colorBackground?: string;
    colorSecondary?: string;
    colorText?: string;
    colorInfo?: string;
    /**
     * Quanto le superfici del sito (pannello, navbar/footer, hover, bordi) restano DISTINTE fra loro
     * o si FONDONO nello stesso colore. `'distinte'` (default): ognuna resta un grigio/nero/bianco
     * con un'ombra di tinta del brand, ben separate le une dalle altre — il dark/light mode classico.
     * `'fusione'`: tutte diventano il colore ESATTO del brand, un unico campo di colore continuo —
     * implica anche `showPanel: false` se non impostato esplicitamente: un pannello di tono diverso
     * vanificherebbe la fusione, uno dello stesso colore sarebbe indistinguibile dal resto (vedi
     * `muro.design-system.ts`). Dettaglio: frontend/README.md §"Sfondo a tinta piena".
     */
    superfici?: 'distinte' | 'fusione';
    /**
     * Colori con nome proprio oltre ai quattro slot fissi — override "duro" come `colorSecondary`,
     * esposto come `--color<Label>`/`--color<Label>Text`. Etichette riservate rifiutate a
     * validazione (`RESERVED_PALETTE_LABELS` sotto). Dettaglio: frontend/README.md §"Colori con nome proprio".
     */
    customPalette?: Record<string, string>;
    /** Effetto smoke, decorativo. `enable` è l'interruttore MASTER. Dettaglio: frontend/README.md §"Effetto smoke". */
    smoke?: Partial<SmokeSettings>;
    /** Se l'og:image mostra solo lo sfondo, senza titolo/favicon sovrapposti. Default `false`. */
    ogImagePlain?: boolean;
    /** Font browser — chiave di `WEB_FONTS` (font-system.ts). Default `'System'`. */
    webFont?: keyof typeof WEB_FONTS;
    /** Font per il rendering server (Sharp/librsvg) — voce di `ServerFont`, catalogo separato da `webFont`. Default `ServerFont.Liberation`. */
    serverFont?: ServerFont;
    /** Font caricato dal progetto (`fonts/`) — sostituisce ENTRAMBI `webFont`/`serverFont`. Assente = nessun font custom. */
    customFont?: CustomFontDef;
}

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Come `HEX_COLOR_PATTERN`, ma ammette anche 8 cifre (alpha) — solo `smoke.color` ne ha bisogno. */
const SMOKE_HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Segmenti già usati da un token di sistema `--color<Segmento>` — un'etichetta `customPalette` omonima lo sovrascriverebbe silenziosamente. Validato in `validateDesignSystemPreset`. */
const RESERVED_PALETTE_LABELS = new Set([
    'base', 'basedk', 'baselt',
    'heading', 'headingdk', 'headinglt', 'headingrgb', 'headingrgbdk', 'headingrgblt',
    'infotext',
    'link', 'linkdk', 'linkhoverrgbdk', 'linkhoverrgblt', 'linklt', 'linkrgbdk', 'linkrgblt',
    'mutedbg', 'mutedbgdk', 'mutedbglt', 'mutedtext', 'mutedtextdk', 'mutedtextlt',
    'navbg', 'navbgdk', 'navbglt', 'navborder', 'navborderdk', 'navborderlt', 'navtext', 'navtextdk', 'navtextlt',
    'primary', 'primarybgsubtle', 'primarybgsubtledk', 'primarybgsubtlelt',
    'primarybordersubtle', 'primarybordersubtledk', 'primarybordersubtlelt',
    'primarydk', 'primaryfg', 'primaryfgdk', 'primaryfglt', 'primaryfgrgb', 'primaryfgrgbdk', 'primaryfgrgblt',
    'primarylt', 'primaryrgb', 'primaryrgbdk', 'primaryrgblt', 'primarytext', 'primarytextdk',
    'primarytextemphasis', 'primarytextemphasisdk', 'primarytextemphasislt', 'primarytextlt',
    'secondary', 'secondarybgsubtle', 'secondarybgsubtledk', 'secondarybgsubtlelt',
    'secondarybordersubtle', 'secondarybordersubtledk', 'secondarybordersubtlelt',
    'secondarydk', 'secondarylt', 'secondaryrgb', 'secondaryrgbdk', 'secondaryrgblt',
    'secondarytext', 'secondarytextdk', 'secondarytextemphasis', 'secondarytextemphasisdk',
    'secondarytextemphasislt', 'secondarytextlt',
    'subtlebg', 'subtlebgdk', 'subtlebglt',
    'surface', 'surfaceborder', 'surfaceborderdk', 'surfaceborderlt', 'surfacehover',
    'surfacetext', 'surfacetextdk', 'surfacetextlt', 'surfacetextrgbdk', 'surfacetextrgblt',
    'tema', 'tematext',
]);

/** `'bordeaux'` → `'Bordeaux'` — usata qui e da `ThemeService` per comporre `--color<Label>`. */
export function toPascalCaseLabel(label: string): string {
    return label
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

/**
 * Valida un design system risolto: colori hex validi, `customPalette` senza collisioni con token
 * di sistema. Chiamata da `extendDesignSystem` a ogni resolve — stesso percorso per un preset
 * condiviso o scritto da zero, nessuno dei due è privilegiato.
 */
export function validateDesignSystemPreset(name: string, preset: DesignSystemPreset): void {
    const colorFields: readonly (readonly [string, string | undefined])[] = [
        ['colorSecondary', preset.colorSecondary],
        ['colorBackground', preset.colorBackground],
        ['colorText', preset.colorText],
        ['colorInfo', preset.colorInfo],
    ];
    for (const [field, value] of colorFields) {
        if (value != null && !HEX_COLOR_PATTERN.test(value)) {
            throw new Error(
                `[DesignSystem] "${name}".${field}="${value}" non è un colore hex valido (atteso ` +
                `#RGB o #RRGGBB, es. "#131e55" — niente canale alpha).`
            );
        }
    }
    for (const [label, value] of Object.entries(preset.customPalette ?? {})) {
        if (!HEX_COLOR_PATTERN.test(value)) {
            throw new Error(
                `[DesignSystem] "${name}".customPalette["${label}"]="${value}" non è un colore hex ` +
                `valido (atteso #RGB o #RRGGBB, es. "#5c1a2b" — niente canale alpha).`
            );
        }
        const pascal = toPascalCaseLabel(label);
        if (RESERVED_PALETTE_LABELS.has(pascal.toLowerCase())) {
            throw new Error(
                `[DesignSystem] "${name}".customPalette["${label}"] usa un nome riservato: ` +
                `--color${pascal} è già un token di sistema (ThemeService) e verrebbe sovrascritto ` +
                `silenziosamente. Scegli un'altra etichetta.`
            );
        }
    }
    const smoke = preset.smoke;
    if (smoke?.color != null && !SMOKE_HEX_COLOR_PATTERN.test(smoke.color)) {
        throw new Error(
            `[DesignSystem] "${name}".smoke.color="${smoke.color}" non è un colore hex valido ` +
            `(atteso #RGB, #RRGGBB o #RRGGBBAA, es. "#b5d9ff").`
        );
    }
    if (smoke?.opacity != null && (smoke.opacity < 0 || smoke.opacity > 1)) {
        throw new Error(`[DesignSystem] "${name}".smoke.opacity=${smoke.opacity} deve essere tra 0 e 1.`);
    }
    const nonNegativeSmokeFields: readonly (readonly [string, number | undefined])[] = [
        ['maximumVelocity', smoke?.maximumVelocity],
        ['particleRadius', smoke?.particleRadius],
        ['density', smoke?.density],
    ];
    for (const [field, value] of nonNegativeSmokeFields) {
        if (value != null && value < 0) {
            throw new Error(`[DesignSystem] "${name}".smoke.${field}=${value} non può essere negativo.`);
        }
    }
}

/** Un design system è una funzione, non un dato — stesso idioma di `pages: () => [...]` in site.ts. */
export type DesignSystemFactory = () => DesignSystemPreset;

/** Punto di partenza minimo per `extendDesignSystem` — nessun campo forzato. Usato dai preset condivisi e da chi parte da zero. */
export const emptyDesignSystem: DesignSystemFactory = () => ({});

/** Deep-merge mirato per i campi annidati (`ruoloPagina`, `customPalette`, `smoke`); tutto il resto
 *  è un override shallow — `patch` vince sul campo omonimo di `base`, un campo assente in `patch`
 *  lascia quello di `base`. */
function mergeDesignSystemPreset(base: DesignSystemPreset, patch: Partial<DesignSystemPreset>): DesignSystemPreset {
    return {
        ...base,
        ...patch,
        // Fonde OGNI ruolo presente da un lato o dall'altro (non solo default/legal/error) — fix
        // per un bug reale di perdita silenziosa di un ruolo custom del base non toccato dal patch.
        ruoloPagina: (patch.ruoloPagina || base.ruoloPagina) ? (() => {
            const roles = new Set([
                ...Object.keys(base.ruoloPagina ?? {}),
                ...Object.keys(patch.ruoloPagina ?? {}),
            ]) as Set<PageRole>;
            const merged: Partial<Record<PageRole, SpecRuoloPagina>> = {};
            for (const role of roles) merged[role] = { ...base.ruoloPagina?.[role], ...patch.ruoloPagina?.[role] };
            return merged;
        })() : undefined,
        customPalette: (patch.customPalette || base.customPalette)
            ? { ...base.customPalette, ...patch.customPalette }
            : undefined,
        smoke: (patch.smoke || base.smoke)
            ? { ...base.smoke, ...patch.smoke }
            : undefined,
    };
}

/**
 * Grammatica UNICA per scrivere un design system, Engine o dominio: estende un altro
 * (`emptyDesignSystem`, un preset condiviso, o un altro `extendDesignSystem`) con un patch piatto —
 * un ruolo custom si registra scrivendo la sua chiave in `ruoloPagina`. `patch` può anche essere una
 * funzione che riceve `base` già risolto, per un override calcolato. Dettaglio:
 * frontend/README.md §"Preset di Design System".
 * ```typescript
 * import { muroDesignSystem } from '../../../components/shared/design-systems/engine/muro.design-system';
 *
 * export const clienteX = extendDesignSystem(muroDesignSystem, {
 *     customPalette: { bordeaux: '#5c1a2b', oro: '#a97d3f' },
 *     ruoloPagina: { sidebar: { showNav: false } },  // ruolo custom: la chiave stessa lo registra
 * });
 * ```
 */
export function extendDesignSystem(
    base: DesignSystemFactory,
    patch: Partial<DesignSystemPreset> | ((resolved: DesignSystemPreset) => Partial<DesignSystemPreset>),
): DesignSystemFactory {
    return () => {
        const resolved = base();
        const merged = mergeDesignSystemPreset(resolved, typeof patch === 'function' ? patch(resolved) : patch);
        // Nessun nome di registro da riportare (un design system non ne ha uno): il messaggio
        // d'errore identifica comunque il campo/valore incriminato.
        validateDesignSystemPreset('extendDesignSystem(...)', merged);
        return merged;
    };
}
