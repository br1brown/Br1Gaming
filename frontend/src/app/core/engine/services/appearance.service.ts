import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, Signal, WritableSignal, inject, isDevMode, signal, DOCUMENT } from '@angular/core';
import { ContestoSito } from '../../../site';
import type { SiteConfig } from '../siteBuilder';

/** Input della palette per Bootstrap (compilati in `generated/_theme.scss`) più i token che lui non ha; Lt/Dk = per tono. */
export interface PaletteTokens {
    // ── Brand ─────────────────────────────────────────────────────────────────
    /** Colore brand esatto (`site.colorTema` in global-settings.json). */
    colorTema: string;
    /** Brand scurito in OKLCH (hue e chroma preservate) finché il contrasto WCAG 4.5:1 sullo sfondo pagina chiaro (`colorBaseLt`) è garantito. `$primary` di Bootstrap. */
    colorPrimary: string;
    /** Primary come FILL in dark: `colorPrimary` schiarito quanto basta per un boundary ≥3.2:1 sul fondo scuro (brand già luminosi: invariato). `--bs-primary` in tono scuro. */
    colorPrimaryFillDk: string;
    /** Primary come FOREGROUND light (testo/bordo, `.text-primary`, testo dei bottoni outline): ≥4.8:1 su ogni superficie light. */
    colorPrimaryFgLt: string;
    /** Primary come FOREGROUND dark: ≥4.8:1 su ogni superficie dark, dove il fill sarebbe scuro-su-scuro. */
    colorPrimaryFgDk: string;

    // ── Link — tone-adaptive ────────────────────────────────────────────────
    /** Link light: hue del brand, ≥4.8:1 su ogni superficie light. `$link-color`. */
    colorLinkLt: string;
    /** Link dark: hue del brand, ≥4.8:1 su ogni superficie dark. `$link-color-dark`. */
    colorLinkDk: string;

    // ── Superfici — light ───────────────────────────────────────────────────
    /** Sfondo pagina light: quasi bianco con leggera tinta (L=0.970, più basso con `vividezza` > 0). `$body-bg`. */
    colorBaseLt: string;
    /** Sfondo pannello/card light (L=0.985). `--colorSurface`. */
    colorSurfaceLt: string;
    /** Sfondo hover su elementi interattivi light (L=0.950). `--colorSurfaceHover`. */
    colorSurfaceHoverLt: string;
    /** Bordo separatore light: grigio neutro, ≥3:1 su ogni superficie light (WCAG 1.4.11) a qualunque `vividezza` — vedi `findContrastOnSurfaces`. `$border-color`. */
    colorSurfaceBorderLt: string;
    /** Testo corpo light: quasi nero con leggera tinta (L=0.200, spostata solo se serve per ≥4.8:1 su ogni superficie light). `$body-color`. */
    colorSurfaceTextLt: string;

    // ── Superfici — dark ────────────────────────────────────────────────────
    /** Sfondo pagina dark: quasi nero con leggera tinta (L=0.140, più alto con `vividezza` > 0). `$body-bg-dark`. */
    colorBaseDk: string;
    /** Sfondo pannello/card dark (L=0.180). */
    colorSurfaceDk: string;
    /** Sfondo hover dark (L=0.220). */
    colorSurfaceHoverDk: string;
    /** Bordo separatore dark: grigio neutro, ≥3:1 su ogni superficie dark. `$border-color-dark`. */
    colorSurfaceBorderDk: string;
    /** Testo corpo dark: quasi bianco con leggera tinta (L=0.920, spostata solo se serve per ≥4.8:1 su ogni superficie dark). `$body-color-dark`. */
    colorSurfaceTextDk: string;

    // ── Secondario / info ───────────────────────────────────────────────────
    /** Variante muted del brand (o override "duro"), light. `$secondary`. */
    colorSecondaryLt: string;
    /** Variante muted del brand (o override "duro"), dark. `--bs-secondary` in tono scuro. */
    colorSecondaryDk: string;
    /** Override "duro" di `$info`, SOLO se il design system lo propone: assente, Bootstrap tiene il suo. */
    colorInfo?: string;

    // ── Strutturali ─────────────────────────────────────────────────────────
    /** Titoli/`<strong>` light (L=0.165, spostata solo se serve per ≥4.8:1). `$body-emphasis-color`. */
    colorHeadingLt: string;
    /** Titoli/`<strong>` dark (L=0.958, idem). `$body-emphasis-color-dark`. */
    colorHeadingDk: string;
    /** Sfondo muted light: input disabilitati, righe table-striped (L=0.942): a vividness 0 la più scura, riferimento iniziale dei primi piani. `$body-secondary-bg`. */
    colorMutedBgLt: string;
    /** Sfondo muted dark (L=0.295). `$body-secondary-bg-dark`. */
    colorMutedBgDk: string;
    /** Sfondo tertiary light (L=0.967). `$body-tertiary-bg`. */
    colorSubtleBgLt: string;
    /** Sfondo tertiary dark (L=0.248). `$body-tertiary-bg-dark`. */
    colorSubtleBgDk: string;
    /** Testo muted light: ≥4.8:1 su ogni superficie light. `$body-secondary-color`. */
    colorMutedTextLt: string;
    /** Testo muted dark: ≥4.8:1 su ogni superficie dark. `$body-secondary-color-dark`. */
    colorMutedTextDk: string;

    // ── Navbar/footer immersivi (navbar.superficie 'brand') ────────────────────────
    /** Sfondo navbar/footer light: `colorTema` diretto se brand scuro, altrimenti pastello (L=0.965). */
    colorNavBgLt: string;
    /** Testo navbar/footer light: bianco su brand scuro, oppure quasi-nero tintato su pastello (≥4.8:1). */
    colorNavTextLt: string;
    /** Sfondo navbar/footer dark: quasi nero tintato brand (L=0.150). */
    colorNavBgDk: string;
    /** Testo navbar/footer dark: quasi bianco tintato brand (L=0.920, spostata solo se serve per ≥4.8:1). */
    colorNavTextDk: string;
    /** Bordo navbar/dropdown light: mix 15% text su bg. */
    colorNavBorderLt: string;
    /** Bordo navbar/dropdown dark: mix 15% text su bg. */
    colorNavBorderDk: string;

    /** Tono suggerito dal brand ('light' se richiede testo scuro): tono iniziale in SSR, dove `prefers-color-scheme` non è disponibile. */
    naturalTone: 'light' | 'dark';

    /** Colori con nome proprio da `PaletteOverrides.coloriNuovi`, override "duri": il fill esatto di `--color<Label>` e delle classi Bootstrap del colore. `{}` se nessuno. */
    coloriNuovi: Record<string, string>;

    /** Variante da TESTO, per tono, dei colori d'accento: `secondary`, `info` (solo se overridden) e ogni etichetta di `coloriNuovi`. Il fill resta l'hex scelto; dove il colore finisce come testo sulla pagina (`.text-*`, `.link-*`, bottoni outline) si usa questa, stessa tinta spostata in L quanto basta per ≥4.8:1 su ogni superficie del tono. Per il secondario derivato coincide col fill, già leggibile. */
    accentText: Record<string, { lt: string; dk: string }>;
}

/** Override opzionali con hue indipendente dal brand: secondario, sfondo, info. `background` resta una famiglia derivata con garanzia WCAG; `secondary`/`info`/`coloriNuovi` sono override "duri": il fill è esatto anche se non si stacca dal fondo (scelta visibile di chi lo imposta), mentre come testo usano la variante leggibile di `PaletteTokens.accentText`. Dettagli per campo sotto. */
export interface PaletteOverrides {
    /** Override "duro" di `colorSecondary*`: se presente, fill esatto in entrambi i toni (nessuna ricerca di contrasto). Assente: muted del brand. */
    secondary?: string;
    /** Hue/chroma indipendenti per la famiglia base/surface/mutedBg/subtleBg — sempre derivata con garanzia WCAG (non un override "duro": nessun hex singolo copre tutti quei ruoli). */
    background?: string;
    /** Override "duro" di `$info`. Senza fallback dal brand: assente, Bootstrap tiene il suo. */
    info?: string;
    /** Colori con nome proprio (i nomi nuovi di `colori.palette`), override "duro" come `secondary`. Vuoto: nessun token in più. */
    coloriNuovi?: Record<string, string>;
    /** Quanto le superfici si avvicinano alla lucentezza (L, OKLCH) del colore di riferimento invece di restare neutre: 0 (default) = near-black/white appena tinto, 1 = sfondo visibilmente quel colore, interpolato in mezzo. Testo, titoli e bordi sono ricercati contro le superfici reali risultanti. */
    vividezza?: number;
}

/** Gli override di un design system risolto (default: quello attivo in site.ts), unica fonte per
 *  client, SSR e script di build. */
export function siteOverrides(cfg: SiteConfig = ContestoSito.config): PaletteOverrides {
    // secondary/info rimpiazzano quelli di serie, ogni altro nome è un colore in più.
    const { secondary, info, ...coloriNuovi } = cfg.aspetto.colori.palette;
    return {
        secondary,
        background: cfg.aspetto.colori.sfondo,
        info,
        coloriNuovi,
        vividezza: cfg.aspetto.colori.vividezza,
    };
}

/** Palette del design system: il CSS la riceve compilata in build; qui restano il tono corrente (`data-bs-theme`)
 *  e i colori per chi disegna fuori dal CSS (canvas, QR, immagini). Statici puri, usati anche in build e SSR. */
@Injectable({ providedIn: 'root' })
export class AppearanceService {

    private readonly _palette: PaletteTokens = AppearanceService.computePaletteCached(ContestoSito.config.colorTema, siteOverrides());

    private readonly document = inject(DOCUMENT);
    private readonly platformId = inject(PLATFORM_ID);

    /** Colore brand (`site.colorTema`). */
    readonly colorTema: Signal<string> = signal(this._palette.colorTema).asReadonly();
    /** Testo leggibile su `colorTema`: lo stesso di `--colorTemaText`. */
    readonly colorTemaText: Signal<'#000000' | '#ffffff'> = signal(AppearanceService.getFillTextColor(this._palette.colorTema)).asReadonly();
    /** Primary (fill light, 4.5:1 sullo sfondo chiaro). */
    readonly colorPrimary: Signal<string> = signal(this._palette.colorPrimary).asReadonly();
    /** Testo leggibile su `colorPrimary`: lo stesso di `--colorPrimaryText` nel tono chiaro. */
    readonly colorPrimaryText: Signal<'#000000' | '#ffffff'> = signal(AppearanceService.getFillTextColor(this._palette.colorPrimary)).asReadonly();
    /** Secondario light: non tone-adaptive, coerente con canvas/immagini generate (artefatto statico). */
    readonly colorSecondary: Signal<string> = signal(this._palette.colorSecondaryLt).asReadonly();
    /** Testo leggibile su `colorSecondary`: lo stesso di `--colorSecondaryText` nel tono chiaro. */
    readonly colorSecondaryText: Signal<'#000000' | '#ffffff'> = signal(AppearanceService.getFillTextColor(this._palette.colorSecondaryLt)).asReadonly();
    /** Tono del pannello contenuti (`.content-panel`), indipendente dal tono di navbar/footer/sfondo: da `tono.pannello` del design system, `null` se `'auto'` (segue l'ambiente). Unica fonte per attributo Bootstrap e classi CSS. */
    readonly panelTone: 'light' | 'dark' | null =
        ContestoSito.config.aspetto.tono.pannello === 'auto' ? null : ContestoSito.config.aspetto.tono.pannello;

    // `tono.forza` del design system: sito intero fissato su un tono, mai riletto dall'OS.
    private readonly _forcedThemeTone = ContestoSito.config.aspetto.tono.forza;
    // SSR: tono forzato o naturale del brand (prefers-color-scheme non disponibile). Nel browser lo
    // corregge subito il costruttore, come già fa theme-init.js prima del primo paint.
    private readonly _themeTone: WritableSignal<'light' | 'dark'> = signal(this._forcedThemeTone ?? this._palette.naturalTone);
    /** Signal reattivo a `prefers-color-scheme`, cambia senza reload; riflesso come `data-bs-theme` su `<html>`. */
    readonly themeTone: Signal<'light' | 'dark'> = this._themeTone.asReadonly();

    constructor() {
        if (!isPlatformBrowser(this.platformId) || this._forcedThemeTone) return;
        const query = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = (dark: boolean): void => {
            const tone = dark ? 'dark' : 'light';
            this._themeTone.set(tone);
            // Il CSS del tema è compilato per [data-bs-theme]: l'attributo è l'unico interruttore.
            const el = this.document.documentElement;
            el.setAttribute('data-bs-theme', tone);
        };
        apply(query.matches);
        query.addEventListener('change', e => apply(e.matches));
    }

    /** La coppia di token per lo slot navbar/footer (alias, non nuova matematica): 'brand' = token immersivi dedicati, 'body' = stessi token dello sfondo pagina (nessuna cesura col contenuto). */
    static resolveNavColors(p: PaletteTokens, superficie: 'brand' | 'body'): {
        navBgLt: string; navBgDk: string;
        navTextLt: string; navTextDk: string;
        navBorderLt: string; navBorderDk: string;
    } {
        if (superficie === 'body') {
            return {
                navBgLt: p.colorBaseLt, navBgDk: p.colorBaseDk,
                navTextLt: p.colorSurfaceTextLt, navTextDk: p.colorSurfaceTextDk,
                navBorderLt: p.colorSurfaceBorderLt, navBorderDk: p.colorSurfaceBorderDk,
            };
        }
        return {
            navBgLt: p.colorNavBgLt, navBgDk: p.colorNavBgDk,
            navTextLt: p.colorNavTextLt, navTextDk: p.colorNavTextDk,
            navBorderLt: p.colorNavBorderLt, navBorderDk: p.colorNavBorderDk,
        };
    }

    // Cache di computePalette: build script, SSR e client chiedono la stessa palette più volte.
    private static readonly _paletteCache = new Map<string, PaletteTokens>();

    /** `computePalette` con cache per brand + override (stessa palette in build, SSR e client). */
    static computePaletteCached(colorTema: string, overrides?: PaletteOverrides): PaletteTokens {
        const key = `${colorTema}|${JSON.stringify(overrides ?? {})}`;
        let p = AppearanceService._paletteCache.get(key);
        if (!p) {
            p = AppearanceService.computePalette(colorTema, overrides);
            AppearanceService._paletteCache.set(key, p);
        }
        return p;
    }

    // ── Static palette computation ────────────────────────────────────────

    /** Contrasto dei testi derivati: 4.8:1, un margine sopra il minimo AA (4.5:1). */
    private static readonly TARGET_TEXT_CONTRAST = 4.8;

    /** Target contrasto NON-testo del boundary fill primary contro lo sfondo: 3.2:1 (sopra il minimo WCAG 1.4.11 3:1). Usato in dark da `computeColorPrimaryFillDk` (brand quasi-neri sarebbero altrimenti ~1:1, invisibili). */
    private static readonly TARGET_FILL_BOUNDARY = 3.2;

    /** L'intera `PaletteTokens` dal brand e dagli override, in OKLCH: fisse solo le L strutturali delle superfici. */
    static computePalette(colorTema: string, overrides?: PaletteOverrides): PaletteTokens {
        const [, C_t, H_t] = AppearanceService.hexToOklch(colorTema);
        const naturalTone = AppearanceService.computeThemeTone(colorTema);

        // Hue/chroma di sfondo: dall'override se presente, altrimenti dal brand — un solo hex
        // alimenta comunque entrambi i toni, come C_t/H_t per colorTema.
        const chFor = (hex?: string): [number, number] => {
            if (!hex) return [C_t, H_t];
            const [, c, h] = AppearanceService.hexToOklch(hex);
            return [c, h];
        };
        const [C_bg, H_bg] = chFor(overrides?.background);
        // Il testo prende la tinta dello sfondo: i due restano sempre intonati.
        const [C_txt, H_txt] = [C_bg, H_bg];

        // I tetti di chroma delle superfici sono tarati sul brand: una tinta scelta apposta (override) li
        // moltiplica ×16, altrimenti resterebbe invisibile; con la sola vividness il boost cresce con lei.
        const OVERRIDE_CHROMA_BOOST = 16;
        const vividness = Math.max(0, Math.min(1, overrides?.vividezza ?? 0));
        const bgBoost = overrides?.background
            ? OVERRIDE_CHROMA_BOOST
            : 1 + (OVERRIDE_CHROMA_BOOST - 1) * vividness;
        const [L_bg] = AppearanceService.hexToOklch(overrides?.background ?? colorTema);
        // `L_t` (sempre il brand, mai `background`) alza solo la lucentezza della navbar, mai la
        // chroma (il tetto di colorNavBg* non è tarato per il boost x16, saturerebbe troppo).
        const [L_t] = AppearanceService.hexToOklch(colorTema);
        const liftBg = (defaultL: number): number => defaultL + (L_bg - defaultL) * vividness;
        const liftNav = (defaultL: number): number => defaultL + (L_t - defaultL) * vividness;

        // Le cinque superfici di contenuto di un tono (base, card, hover, muted, tertiary) per un dato
        // fattore di separazione. La base è l'ANCORA: lo scarto da se stessa è sempre 0. Tutti i primi
        // piani (testo, titoli, link, bordo...) sono poi tarati contro queste superfici reali.
        const surfacesAt = (tone: 'light' | 'dark', factor: number): string[] => {
            // Per card, hover, muted, tertiary: [L a vividness 0, quota della chroma di sfondo, tetto].
            const [anchor, baseHex, steps]: [number, string, [number, number, number][]] = tone === 'light'
                ? [0.970, AppearanceService.computeBaseLt(C_bg, H_bg, bgBoost, liftBg(0.970)),
                    [[0.985, 0.02, 0.003], [0.950, 0.04, 0.006], [0.942, 0.08, 0.011], [0.967, 0.05, 0.007]]]
                : [0.140, AppearanceService.computeBaseDk(C_bg, H_bg, bgBoost, liftBg(0.140)),
                    [[0.180, 0.12, 0.014], [0.220, 0.10, 0.012], [0.295, 0.18, 0.022], [0.248, 0.20, 0.025]]];
            // Con la vividness le superfici convergono sulla lucentezza della base: si staccano per luce,
            // verso il lato opposto al testo, e mai più sature della base (sembrerebbero un errore).
            const [L_base, C_base] = AppearanceService.hexToOklch(baseHex);
            const away = AppearanceService.prefersDarkText(baseHex) ? 1 : -1;
            const byLight = (L: number, C: number): string => {
                let c = Math.min(C, C_base);
                let hex = AppearanceService.oklchToHex(L, c, H_bg);
                // L'arrotondamento a 8 bit può sforare la chroma della base di un soffio.
                while (c > 0 && AppearanceService.hexToOklch(hex)[1] > C_base) hex = AppearanceService.oklchToHex(L, c = Math.max(0, c - 0.002), H_bg);
                return hex;
            };
            return [baseHex, ...steps.map(([defaultL, ratio, cap]) => {
                const C = Math.min(C_bg * ratio, cap) * bgBoost;
                return vividness > 0
                    ? byLight(L_base + away * Math.abs(defaultL - anchor) * factor, C)
                    : AppearanceService.oklchToHex(liftBg(anchor + (defaultL - anchor) * factor), C, H_bg);
            })];
        };
        // Con vividness e separazione alte le superfici possono stare a cavallo della luminanza media:
        // nessun colore (nemmeno nero o bianco) resterebbe leggibile su tutte. Lì la leggibilità vince
        // sulla separazione: lo scarto si dimezza finché il testo torna possibile.
        const readableSurfaces = (tone: 'light' | 'dark'): string[] => {
            const bestText = (surfaces: string[]): number => Math.max(
                ...['#000000', '#ffffff'].map(fg => Math.min(...surfaces.map(bg => AppearanceService.calcContrastRatio(fg, bg)))));
            let factor = 1;
            let surfaces = surfacesAt(tone, factor);
            for (let i = 0; i < 5 && factor > 0 && bestText(surfaces) < AppearanceService.TARGET_TEXT_CONTRAST; i++) {
                factor = i < 4 ? factor / 2 : 0;
                surfaces = surfacesAt(tone, factor);
            }
            // Anche a separazione 0 le superfici differiscono in saturazione, quindi in luminanza: se
            // ancora non basta, coincidono tutte con la base (su un colore solo, nero o bianco reggono).
            if (bestText(surfaces) < AppearanceService.TARGET_TEXT_CONTRAST) surfaces = surfaces.map(() => surfaces[0]);
            return surfaces;
        };
        const [baseLtHex, colorSurfaceLt, colorSurfaceHoverLt, colorMutedBgLt, colorSubtleBgLt] = readableSurfaces('light');
        const [baseDkHex, colorSurfaceDkHex, colorSurfaceHoverDk, colorMutedBgDk, colorSubtleBgDk] = readableSurfaces('dark');

        // Primary tarato sulle superfici reali appena calcolate, non su quelle del solo brand.
        const primaryBase = AppearanceService.computeColorPrimary(colorTema, baseLtHex);
        const primaryFgDkBase = AppearanceService.computeColorPrimaryFgDk(colorTema, colorMutedBgDk);
        const primaryFgLtBase = AppearanceService.computeColorPrimaryFgLt(colorTema, colorMutedBgLt);
        const primaryFillDkBase = AppearanceService.computeColorPrimaryFillDk(primaryBase, baseDkHex);

        const TARGET_TEXT = AppearanceService.TARGET_TEXT_CONTRAST;

        // Link Lt/Dk: hue del BRAND (il link è un'affordance di brand, non di sfondo/testo), L
        // cercata finché ≥ TARGET_TEXT sulla superficie muted, poi verificata su tutte (sotto).
        // Chroma minima 0.08 per una tinta riconoscibile anche su brand grigi.
        const linkLtBase = AppearanceService.findCompliantColor(
            Math.max(C_t, 0.08), H_t, colorMutedBgLt, TARGET_TEXT, 0.55, -0.01
        );
        const linkDkBase = AppearanceService.findCompliantColor(
            Math.max(C_t, 0.08), H_t, colorMutedBgDk, TARGET_TEXT, 0.55, +0.01
        );

        // Secondary: hue/chroma indipendenti se overrides.secondary è presente, altrimenti C più
        // bassa del brand — è una variante muted, non un accento.
        let secLt: string, secDk: string;
        // Solo il secondario derivato va poi tarato sulle superfici: un override "duro" resta com'è.
        const secondaryDerived = !overrides?.secondary;
        if (overrides?.secondary) {
            // Override "duro": il fill è l'hex scelto in entrambi i toni (il testo ha accentText).
            secLt = overrides.secondary;
            secDk = overrides.secondary;
        } else {
            // Muted del brand: leggibile come testo E staccato dal fondo come fill (la vividness può avvicinarli).
            const C_sec = Math.min(C_t * (0.75), 0.12);
            ({ lt: secLt, dk: secDk } = AppearanceService.computeAccentPair(C_sec, H_t, colorMutedBgLt, colorMutedBgDk, baseLtHex, baseDkHex, 0.72, 0.55));
        }

        // coloriNuovi e info: override "duri", il colore scelto vince com'è scritto in entrambi i
        // toni — nessuna ricerca di contrasto sul fill. Il testo leggibile sopra lo ricava Bootstrap
        // (color-contrast) in fase di compilazione.
        const coloriNuovi: PaletteTokens['coloriNuovi'] = { ...(overrides?.coloriNuovi ?? {}) };
        const colorInfo = overrides?.info;


        // ── Structural Bootstrap vars ──────────────────────────────────────
        // secondary-color: testo muted, TARGET_TEXT (4.8:1) cercato sulla superficie muted e poi
        // verificato su tutte (sotto), dove compare: card, righe alternate, input disabilitati.
        const mutedTextLtBase = AppearanceService.findCompliantColor(Math.min(C_txt * 0.08, 0.012), H_txt, colorMutedBgLt, TARGET_TEXT, 0.65, -0.01);
        const mutedTextDkBase = AppearanceService.findCompliantColor(Math.min(C_txt * 0.08, 0.012), H_txt, colorMutedBgDk, TARGET_TEXT, 0.45, +0.01);

        // Adaptive Navbar/Footer colors (NavBg / NavText) — restano legati al BRAND (C_t/H_t), non
        // a background/testo: la navbar è pensata come superficie immersiva di brand, non di contenuto.
        let colorNavBgLt: string;
        let colorNavTextLt: string;
        if (AppearanceService.getReadableTextColor(colorTema) === '#ffffff') {
            // Brand scuro: la navbar è il brand pieno, testo bianco. Dove il bianco batte il nero regge
            // sempre ≥4.58:1 (AA); sotto TARGET_TEXT resta bianco (nessun colore fa meglio) e in dev lo segnala.
            colorNavBgLt = colorTema;
            colorNavTextLt = AppearanceService.findContrastOnSurfaces(0, 0, [colorNavBgLt], TARGET_TEXT, 1, -0.01);
        } else {
            // Brand chiaro/acceso: pieno sarebbe aggressivo, si usa un pastello con testo scuro tintato.
            colorNavBgLt = AppearanceService.oklchToHex(liftNav(0.965), Math.min(C_t * 0.20, 0.020), H_t);
            colorNavTextLt = AppearanceService.findContrastOnSurfaces(Math.min(C_t * 0.40, 0.040), H_t, [colorNavBgLt], TARGET_TEXT, 0.200, -0.01);
        }

        // In dark mode, we always want a very dark background to respect the dark theme,
        // but elegantly tinted with the brand color. `liftNav`: la navbar resta legata al brand
        // (mai a `background`), quindi il target del lift è sempre colorTema, non C_bg/H_bg.
        const colorNavBgDk = AppearanceService.oklchToHex(liftNav(0.150), Math.min(C_t * 0.25, 0.030), H_t);
        const colorNavTextDk = AppearanceService.findContrastOnSurfaces(Math.min(C_t * 0.06, 0.010), H_t, [colorNavBgDk], TARGET_TEXT, 0.920, +0.01);

        // Bordo navbar decorativo: 15% del testo sul fondo, nessun contrasto garantito.
        const colorNavBorderLt = AppearanceService.mixHexColors(colorNavBgLt, colorNavTextLt, 0.15);
        const colorNavBorderDk = AppearanceService.mixHexColors(colorNavBgDk, colorNavTextDk, 0.15);

        // Superfici di contenuto per tono. Testo, titoli e bordo stanno sopra a tutte, quindi vanno
        // tarati contro ognuna (non solo contro la più estrema: con vividness alta l'ordine di
        // contrasto fra superfici e primo piano non è più quello di vividness 0).
        const surfacesLt = [baseLtHex, colorSurfaceLt, colorSurfaceHoverLt, colorMutedBgLt, colorSubtleBgLt];
        const surfacesDk = [baseDkHex, colorSurfaceDkHex, colorSurfaceHoverDk, colorMutedBgDk, colorSubtleBgDk];
        // Testo corpo (L 0.200 / 0.920) e titoli/strong (L 0.165 / 0.958): quasi nero/bianco con leggera
        // tinta testo. A vividness 0 queste L reggono già e restano identiche; con le superfici portate
        // verso la lucentezza del brand (es. brand chiaro in tono scuro) si spostano finché reggono.
        const colorSurfaceTextLt = AppearanceService.findContrastOnSurfaces(Math.min(C_txt * 0.20, 0.030), H_txt, surfacesLt, TARGET_TEXT, 0.200, -0.01);
        const colorSurfaceTextDk = AppearanceService.findContrastOnSurfaces(Math.min(C_txt * 0.06, 0.010), H_txt, surfacesDk, TARGET_TEXT, 0.920, +0.01);
        const colorHeadingLt = AppearanceService.findContrastOnSurfaces(Math.min(C_txt * 0.14, 0.020), H_txt, surfacesLt, TARGET_TEXT, 0.165, -0.01);
        const colorHeadingDk = AppearanceService.findContrastOnSurfaces(Math.min(C_txt * 0.04, 0.006), H_txt, surfacesDk, TARGET_TEXT, 0.958, +0.01);
        // Bordo neutro Lt L=0.570 / Dk L=0.600, portato da liftBg come le superfici: a vividness 0 ≥3:1
        // sulla superficie peggiore (≈3.75 e ≈3.47:1); dove non regge 3:1 su tutte si sposta in L.
        const colorSurfaceBorderLt = AppearanceService.findContrastOnSurfaces(0, 0, surfacesLt, AppearanceService.MIN_UI_CONTRAST, liftBg(0.570), -0.01);
        const colorSurfaceBorderDk = AppearanceService.findContrastOnSurfaces(0, 0, surfacesDk, AppearanceService.MIN_UI_CONTRAST, liftBg(0.600), +0.01);
        // Link, testo secondario, primary come testo, secondario derivato: tarati prima sulla sola
        // superficie muted, che a vividness 0 è la più estrema. Con la vividness l'ordine fra superfici
        // non è più quello: restano identici se reggono già su tutte, altrimenti si spostano in L.
        const colorLinkLt = AppearanceService.keepOnSurfaces(linkLtBase, surfacesLt, TARGET_TEXT, -0.01);
        const colorLinkDk = AppearanceService.keepOnSurfaces(linkDkBase, surfacesDk, TARGET_TEXT, +0.01);
        const colorMutedTextLt = AppearanceService.keepOnSurfaces(mutedTextLtBase, surfacesLt, TARGET_TEXT, -0.01);
        const colorMutedTextDk = AppearanceService.keepOnSurfaces(mutedTextDkBase, surfacesDk, TARGET_TEXT, +0.01);
        const colorPrimaryFgLt = AppearanceService.keepOnSurfaces(primaryFgLtBase, surfacesLt, TARGET_TEXT, -0.01);
        const colorPrimaryFgDk = AppearanceService.keepOnSurfaces(primaryFgDkBase, surfacesDk, TARGET_TEXT, +0.01);
        // Il fill primary (bottoni, checkbox spuntata) deve staccarsi dalle superfici su cui sta davvero:
        // pagina e card/pannello.
        const colorPrimary = AppearanceService.keepOnSurfaces(primaryBase, [baseLtHex, colorSurfaceLt], AppearanceService.MIN_UI_CONTRAST, -0.01);
        const colorPrimaryFillDk = AppearanceService.keepOnSurfaces(primaryFillDkBase, [baseDkHex, colorSurfaceDkHex], AppearanceService.MIN_UI_CONTRAST, +0.01);
        if (secondaryDerived) {
            secLt = AppearanceService.keepOnSurfaces(secLt, surfacesLt, TARGET_TEXT, -0.01);
            secDk = AppearanceService.keepOnSurfaces(secDk, surfacesDk, TARGET_TEXT, +0.01);
        }
        // Colori d'accento come testo: un override "duro" resta esatto come fill, ma dove finisce
        // come testo sulla pagina gli serve la sua variante leggibile, come il primary (fill vs fg).
        const textOn = (hex: string): { lt: string; dk: string } => ({
            lt: AppearanceService.keepOnSurfaces(hex, surfacesLt, TARGET_TEXT, -0.01),
            dk: AppearanceService.keepOnSurfaces(hex, surfacesDk, TARGET_TEXT, +0.01),
        });
        const accentText: PaletteTokens['accentText'] = {
            secondary: secondaryDerived ? { lt: secLt, dk: secDk } : { lt: textOn(secLt).lt, dk: textOn(secDk).dk },
            ...(colorInfo ? { info: textOn(colorInfo) } : {}),
            ...Object.fromEntries(Object.entries(coloriNuovi).map(([label, hex]) => [label, textOn(hex)])),
        };

        const tokens: PaletteTokens = {
            colorTema,
            colorPrimary,
            colorPrimaryFgDk,
            colorPrimaryFgLt,
            colorPrimaryFillDk,
            colorLinkLt,
            colorLinkDk,

            // Light surfaces — high L, low chroma, background hue (testo: text hue).
            colorBaseLt: baseLtHex,
            colorSurfaceLt,
            colorSurfaceHoverLt,
            // Il bordo non segue la separazione: è ancorato al minimo WCAG 1.4.11, non una scelta di stile.
            colorSurfaceBorderLt,
            colorSurfaceTextLt,

            // Dark surfaces — low L, moderate chroma, background hue (testo: text hue).
            colorBaseDk: baseDkHex,
            colorSurfaceDk: colorSurfaceDkHex,
            colorSurfaceHoverDk,
            // Il bordo non segue la separazione: è ancorato al minimo WCAG 1.4.11, non una scelta di stile.
            colorSurfaceBorderDk,
            colorSurfaceTextDk,

            colorSecondaryLt: secLt,
            colorSecondaryDk: secDk,
            colorInfo,
            colorHeadingLt, colorHeadingDk,
            colorMutedBgLt, colorMutedBgDk,
            colorSubtleBgLt, colorSubtleBgDk,
            colorMutedTextLt, colorMutedTextDk,

            colorNavBgLt,
            colorNavTextLt,
            colorNavBgDk,
            colorNavTextDk,
            colorNavBorderLt,
            colorNavBorderDk,

            naturalTone,
            coloriNuovi,
            accentText,
        };

        // Un fill "duro" può confondersi col fondo: in dev lo si segnala, mai lo si corregge.
        if (isDevMode()) {
            for (const message of AppearanceService.auditPaletteContrast(tokens)) {
                console.warn(`[AppearanceService] ${message}`);
            }
        }

        return tokens;
    }

    /** WCAG 1.4.11 (≥3:1): un fill (secondario/info/coloriNuovi) deve restare distinguibile dalla superficie su cui si appoggia, non solo avere testo leggibile sopra (già coperto da `getReadableTextColor`). Rete di sicurezza per gli override "duri": solo segnalazione, mai correzione silenziosa. Pura e statica, chiamata da `computePalette`. */
    static auditPaletteContrast(tokens: PaletteTokens): string[] {
        const MIN_UI_CONTRAST = AppearanceService.MIN_UI_CONTRAST;
        const messages: string[] = [];

        const checkFill = (label: string, fillLt: string, fillDk: string): void => {
            const surfacesLt: [string, string][] = [['colorBaseLt', tokens.colorBaseLt], ['colorSurfaceLt', tokens.colorSurfaceLt]];
            const surfacesDk: [string, string][] = [['colorBaseDk', tokens.colorBaseDk], ['colorSurfaceDk', tokens.colorSurfaceDk]];
            for (const [surfaceName, surfaceHex] of surfacesLt) {
                const ratio = AppearanceService.calcContrastRatio(fillLt, surfaceHex);
                if (ratio < MIN_UI_CONTRAST) {
                    messages.push(`${label}Lt (${fillLt}) ha contrasto ${ratio.toFixed(2)}:1 contro ${surfaceName} (${surfaceHex}) — sotto la soglia WCAG 1.4.11 (${MIN_UI_CONTRAST}:1) per elementi UI: rischia di risultare invisibile, non solo poco leggibile.`);
                }
            }
            for (const [surfaceName, surfaceHex] of surfacesDk) {
                const ratio = AppearanceService.calcContrastRatio(fillDk, surfaceHex);
                if (ratio < MIN_UI_CONTRAST) {
                    messages.push(`${label}Dk (${fillDk}) ha contrasto ${ratio.toFixed(2)}:1 contro ${surfaceName} (${surfaceHex}) — sotto la soglia WCAG 1.4.11 (${MIN_UI_CONTRAST}:1) per elementi UI: rischia di risultare invisibile, non solo poco leggibile.`);
                }
            }
        };

        checkFill('colorSecondary', tokens.colorSecondaryLt, tokens.colorSecondaryDk);
        if (tokens.colorInfo !== undefined) {
            checkFill('colorInfo', tokens.colorInfo, tokens.colorInfo);
        }
        for (const [label, hex] of Object.entries(tokens.coloriNuovi)) {
            checkFill(`coloriNuovi.${label}`, hex, hex);
        }

        return messages;
    }

    /** Minimo WCAG 1.4.11 per i confini di componenti UI (bordi, fill contro lo sfondo). */
    private static readonly MIN_UI_CONTRAST = 3.0;

    /** `hex` se ha già contrasto ≥ `target` su tutte le `surfaces`, altrimenti la stessa tinta spostata in L quanto basta (`findContrastOnSurfaces`). */
    private static keepOnSurfaces(hex: string, surfaces: string[], target: number, step: number): string {
        if (Math.min(...surfaces.map(s => AppearanceService.calcContrastRatio(hex, s))) >= target) return hex;
        const [L, C, H] = AppearanceService.hexToOklch(hex);
        return AppearanceService.findContrastOnSurfaces(C, H, surfaces, target, L, step);
    }

    /** Primo piano OKLCH(L, C, H) con contrasto ≥ `target` su TUTTE le `surfaces` (testo, titoli, bordo: stanno sopra ognuna). Parte da `startL` (tenuto se già basta) e cerca prima nella direzione di `step` (più scuro in light, più chiaro in dark), poi in quella opposta: con `vividezza` alta le superfici convergono sulla lucentezza del brand e il primo piano deve poterle scavalcare. Nessuna L conforme: nero o bianco, il migliore sul caso peggiore. */
    private static findContrastOnSurfaces(C: number, H: number, surfaces: string[], target: number, startL: number, step: number): string {
        const worst = (hex: string): number =>
            Math.min(...surfaces.map(s => AppearanceService.calcContrastRatio(hex, s)));
        const start = AppearanceService.oklchToHex(startL, C, H);
        if (worst(start) >= target) return start;
        for (const dir of [step, -step]) {
            for (let i = 1; i <= 100; i++) {
                const L = startL + dir * i;
                if (L < 0 || L > 1) break;
                const hex = AppearanceService.oklchToHex(L, C, H);
                if (worst(hex) >= target) return hex;
            }
        }
        // Superfici a luminanza intermedia e distanti fra loro: né il nero né il bianco raggiungono
        // il target su tutte. Si tiene il migliore sul caso peggiore e lo si segnala.
        const fallback = worst('#000000') >= worst('#ffffff') ? '#000000' : '#ffffff';
        if (isDevMode()) {
            console.warn(
                `[AppearanceService] findContrastOnSurfaces non raggiunge ${target}:1 su tutte le superfici ` +
                `(${surfaces.join(', ')}) → ripiego su ${fallback} (${worst(fallback).toFixed(2)}:1).`
            );
        }
        return fallback;
    }

    /** Sfondo pagina chiaro reale (L=0.970, chroma minima): riferimento di contrasto per i token testuali (colorPrimary, colorLink, mutedText). Fonte unica, usata sia da `computePalette` sia da `computeColorPrimary` così tarano sullo stesso fondo. */
    private static computeBaseLt(C: number, H: number, boost = 1, liftedL = 0.970): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.03, 0.004) * boost, H);
    }

    /** Gemello scuro di `computeBaseLt` (L=0.140): riferimento di contrasto per il boundary del FILL primary in dark (`colorPrimaryFillDk`). I foreground dark si tarano invece su `mutedBgDk`, non sulla base. */
    private static computeBaseDk(C: number, H: number, boost = 1, liftedL = 0.140): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.08, 0.010) * boost, H);
    }

    /** Superficie più ESTREMA su cui un foreground può comparire (`--bs-secondary-bg`): riferimento worst-case, garantendo il target qui lo si ottiene a fortiori sulle altre. Default dei `computeColorPrimaryFg*`; stessi numeri del gradino muted in `computePalette`. */
    private static computeMutedBgLt(C: number, H: number, boost = 1, liftedL = 0.942): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.08, 0.011) * boost, H);
    }
    private static computeMutedBgDk(C: number, H: number, boost = 1, liftedL = 0.295): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.18, 0.022) * boost, H);
    }

    /** Coppia di fill WCAG-safe (Lt/Dk) per il secondario auto-calcolato: leggibile come testo sulla superficie muted E distinguibile come fill dallo sfondo reale (vedi `findDualCompliantColor`). */
    private static computeAccentPair(
        C: number, H: number,
        mutedBgLt: string, mutedBgDk: string,
        baseBgLt: string, baseBgDk: string,
        startLt: number, startDk: number,
    ): { lt: string; dk: string } {
        const TARGET_TEXT = AppearanceService.TARGET_TEXT_CONTRAST;
        const MIN_UI_CONTRAST = AppearanceService.MIN_UI_CONTRAST;
        const lt = AppearanceService.findDualCompliantColor(C, H, mutedBgLt, TARGET_TEXT, baseBgLt, MIN_UI_CONTRAST, startLt, -0.01);
        const dk = AppearanceService.findDualCompliantColor(C, H, mutedBgDk, TARGET_TEXT, baseBgDk, MIN_UI_CONTRAST, startDk, +0.01);
        return { lt, dk };
    }

    /** Come `findCompliantColor` ma su DUE sfondi contemporaneamente (testo su `bgMuted` E fill su `bgBase`, per non far scomparire il secondary se `vividezza` avvicina lo sfondo alla sua hue). Se nessuna L soddisfa entrambi (caso limite): nero o bianco, quello col contrasto minimo più alto sui due PRESI INSIEME — non il migliore sul solo `bgMuted`, che vanificherebbe il vincolo. */
    private static findDualCompliantColor(
        C: number, H: number,
        bgMuted: string, targetMuted: number,
        bgBase: string, targetBase: number,
        startL: number, step: number,
    ): string {
        let L = startL;
        for (let i = 0; i < 70; i++) {
            L = Math.min(0.95, Math.max(0.05, L + step));
            const hex = AppearanceService.oklchToHex(L, C, H);
            if (AppearanceService.calcContrastRatio(hex, bgMuted) >= targetMuted && AppearanceService.calcContrastRatio(hex, bgBase) >= targetBase) {
                return hex;
            }
        }
        const worstCase = (candidate: string): number => Math.min(
            AppearanceService.calcContrastRatio(candidate, bgMuted),
            AppearanceService.calcContrastRatio(candidate, bgBase)
        );
        const fallback = worstCase('#000000') >= worstCase('#ffffff') ? '#000000' : '#ffffff';
        if (isDevMode()) {
            console.warn(
                `[AppearanceService] findDualCompliantColor non converge su entrambi i vincoli ` +
                `(C=${C.toFixed(3)}, H=${H.toFixed(1)}, mutedBg=${bgMuted}, baseBg=${bgBase}) → ripiego su ${fallback}.`
            );
        }
        return fallback;
    }

    // Cerca il colore OKLCH(L, C, H) con il contrasto WCAG ≥ targetRatio contro bgHex.
    // startL + step definiscono la direzione: step < 0 = scende (light mode, cerca scuro);
    // step > 0 = sale (dark mode, cerca chiaro). Fa max 70 passi da 0.01 L cadauno.
    private static findCompliantColor(
        C: number, H: number,
        bgHex: string, targetRatio: number,
        startL: number, step: number,
    ): string {
        let L = startL;
        for (let i = 0; i < 70; i++) {
            L = Math.min(0.95, Math.max(0.05, L + step));
            const hex = AppearanceService.oklchToHex(L, C, H);
            if (AppearanceService.calcContrastRatio(hex, bgHex) >= targetRatio) return hex;
        }
        // Nessuna L a chroma fisso raggiunge il target (tipico con hue molto sature,
        // clampate al gamut sRGB): si ripiega sul massimo contrasto possibile su bgHex
        // (nero o bianco puro), sacrificando la tinta brand ma MAI la conformità WCAG.
        const fallback = AppearanceService.getReadableTextColor(bgHex);
        if (isDevMode()) {
            console.warn(
                `[AppearanceService] findCompliantColor non converge a ${targetRatio}:1 ` +
                `(C=${C.toFixed(3)}, H=${H.toFixed(1)}, bg=${bgHex}) → ripiego su ${fallback}.`
            );
        }
        return fallback;
    }

    // ── OKLCH ↔ hex pipeline ──────────────────────────────────────────────
    // Algoritmo di Björn Ottosson (https://bottosson.github.io/posts/oklab/).
    // Pipeline andata: sRGB → linearizza → spazio LMS (matrice M1) → cbrt → OKLab (matrice M2) → OKLCH.

    /** Converte un colore hex sRGB in `[L, C, H]` OKLCH. Restituisce L ∈ [0,1], C ∈ [0,~0.4], H ∈ [0,360). */
    static hexToOklch(hex: string): [number, number, number] {
        const { r, g, b } = AppearanceService.hexToRgb(hex);
        const lr = AppearanceService.toLinearChannel(r / 255);
        const lg = AppearanceService.toLinearChannel(g / 255);
        const lb = AppearanceService.toLinearChannel(b / 255);

        const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
        const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
        const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

        const l_ = Math.cbrt(Math.max(0, l));
        const m_ = Math.cbrt(Math.max(0, m));
        const s_ = Math.cbrt(Math.max(0, s));

        const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
        const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
        const bk = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

        const C = Math.sqrt(a * a + bk * bk);
        const H = ((Math.atan2(bk, a) * 180 / Math.PI) + 360) % 360;

        return [L, C, H];
    }

    /** Inverso di `hexToOklch`: `[L, C, H]` OKLCH → hex sRGB. Pipeline: OKLCH → OKLab → LMS → linear → sRGB → hex. I canali sRGB sono clampati a `[0, 255]`. */
    static oklchToHex(L: number, C: number, H: number): string {
        const hRad = H * Math.PI / 180;
        const a = C * Math.cos(hRad);
        const bk = C * Math.sin(hRad);

        const l_ = L + 0.3963377774 * a + 0.2158037573 * bk;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * bk;
        const s_ = L - 0.0894841775 * a - 1.2914855480 * bk;

        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;

        const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

        const encode = (c: number): number => {
            const v = Math.max(0, Math.min(1, c));
            return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
        };

        return AppearanceService.rgbToHex(
            Math.round(encode(lr) * 255),
            Math.round(encode(lg) * 255),
            Math.round(encode(lb) * 255),
        );
    }

    // ── Metodi statici: calcolo colore puro, usabile in build, SSR e client ──

    /** Brand scurito in OKLCH (solo L, la tinta resta viva) fino a 4.5:1 su `baseLtHex` (default: la base del solo brand). */
    static computeColorPrimary(colorTema: string, baseLtHex?: string): string {
        const [L0, C, H] = AppearanceService.hexToOklch(colorTema);
        const bg = baseLtHex ?? AppearanceService.computeBaseLt(C, H);
        for (let L = L0; L >= 0.05; L -= 0.01) {
            const candidate = AppearanceService.oklchToHex(L, C, H);
            if (AppearanceService.calcContrastRatio(candidate, bg) >= 4.5) return candidate;
        }
        // Nessuna L raggiunge il target (bg con lucentezza vicina al brand, tipico con
        // vividezza alto): stesso ripiego di findCompliantColor, massimo contrasto possibile.
        const fallback = AppearanceService.getReadableTextColor(bg);
        if (isDevMode()) {
            console.warn(`[AppearanceService] computeColorPrimary non converge a 4.5:1 (bg=${bg}) → ripiego su ${fallback}.`);
        }
        return fallback;
    }

    /** Primary come testo in light: brand scurito fino a 4.8:1 su `mutedBgLtHex`, separato dal fill. */
    static computeColorPrimaryFgLt(colorTema: string, mutedBgLtHex?: string): string {
        const [L0, C, H] = AppearanceService.hexToOklch(colorTema);
        const bg = mutedBgLtHex ?? AppearanceService.computeMutedBgLt(C, H);
        for (let L = L0; L >= 0.05; L -= 0.01) {
            const candidate = AppearanceService.oklchToHex(L, C, H);
            if (AppearanceService.calcContrastRatio(candidate, bg) >= AppearanceService.TARGET_TEXT_CONTRAST) return candidate;
        }
        // Vedi commento gemello in `computeColorPrimary`: stesso ripiego garantito di `findCompliantColor`.
        const fallback = AppearanceService.getReadableTextColor(bg);
        if (isDevMode()) {
            console.warn(`[AppearanceService] computeColorPrimaryFgLt non converge a ${AppearanceService.TARGET_TEXT_CONTRAST}:1 (bg=${bg}) → ripiego su ${fallback}.`);
        }
        return fallback;
    }

    /** Primary come fill in dark: schiarito finché si stacca dal fondo (3.2:1) con testo leggibile sopra. */
    private static computeColorPrimaryFillDk(colorPrimaryLt: string, baseDkHex?: string): string {
        const [L0, C, H] = AppearanceService.hexToOklch(colorPrimaryLt);
        const bg = baseDkHex ?? AppearanceService.computeBaseDk(C, H);
        for (let L = L0; L <= 0.98; L += 0.01) {
            const candidate = AppearanceService.oklchToHex(L, C, H);
            const boundary = AppearanceService.calcContrastRatio(candidate, bg);
            const text = Math.max(
                AppearanceService.calcContrastRatio(candidate, '#000000'),
                AppearanceService.calcContrastRatio(candidate, '#ffffff'),
            );
            if (boundary >= AppearanceService.TARGET_FILL_BOUNDARY && text >= 4.5) return candidate;
        }
        return colorPrimaryLt;
    }

    /** Primary come testo in dark: brand schiarito fino a 4.8:1 su `mutedBgDkHex`. */
    static computeColorPrimaryFgDk(colorTema: string, mutedBgDkHex?: string): string {
        const [L0, C, H] = AppearanceService.hexToOklch(colorTema);
        const bg = mutedBgDkHex ?? AppearanceService.computeMutedBgDk(C, H);
        for (let L = L0; L <= 0.98; L += 0.01) {
            const candidate = AppearanceService.oklchToHex(L, C, H);
            if (AppearanceService.calcContrastRatio(candidate, bg) >= AppearanceService.TARGET_TEXT_CONTRAST) return candidate;
        }
        // Vedi commento gemello in `computeColorPrimary`: stesso ripiego garantito di `findCompliantColor`.
        const fallback = AppearanceService.getReadableTextColor(bg);
        if (isDevMode()) {
            console.warn(`[AppearanceService] computeColorPrimaryFgDk non converge a ${AppearanceService.TARGET_TEXT_CONTRAST}:1 (bg=${bg}) → ripiego su ${fallback}.`);
        }
        return fallback;
    }

    /** `'light'` se il brand richiede testo scuro (colore chiaro), `'dark'` se richiede testo bianco. */
    static computeThemeTone(colorTema: string): 'light' | 'dark' {
        return AppearanceService.prefersDarkText(colorTema) ? 'light' : 'dark';
    }

    /** `true` se il nero ha contrasto ≥ del bianco sul colore dato — indica un colore chiaro/pastello. */
    static prefersDarkText(hexColor: string): boolean {
        return AppearanceService.calcContrastRatio(hexColor, '#000000') >=
            AppearanceService.calcContrastRatio(hexColor, '#ffffff');
    }

    /** `#000000` se il colore è chiaro, `#ffffff` se è scuro — massimo contrasto WCAG. */
    static getReadableTextColor(hexColor: string): '#000000' | '#ffffff' {
        return AppearanceService.prefersDarkText(hexColor) ? '#000000' : '#ffffff';
    }

    /** Testo su un fill come `color-contrast()` di Bootstrap, quindi come i `--color*Text` del CSS: il bianco
     *  se regge `$min-contrast-ratio` (4.5:1), altrimenti il nero se regge, altrimenti il più contrastato. */
    static getFillTextColor(hexColor: string): '#000000' | '#ffffff' {
        const white = AppearanceService.calcContrastRatio(hexColor, '#ffffff');
        if (white >= 4.5) return '#ffffff';
        const black = AppearanceService.calcContrastRatio(hexColor, '#000000');
        if (black >= 4.5) return '#000000';
        return black > white ? '#000000' : '#ffffff';
    }

    /** Interpola linearmente in spazio RGB tra due hex. `mixWeight=0` → base pura, `1` → mix puro. */
    static mixHexColors(baseHex: string, mixHex: string, mixWeight: number): string {
        const base = AppearanceService.hexToRgb(baseHex);
        const mix = AppearanceService.hexToRgb(mixHex);
        const weight = Math.min(Math.max(mixWeight, 0), 1);
        const r = Math.round(base.r * (1 - weight) + mix.r * weight);
        const g = Math.round(base.g * (1 - weight) + mix.g * weight);
        const b = Math.round(base.b * (1 - weight) + mix.b * weight);
        return AppearanceService.rgbToHex(r, g, b);
    }

    /** Rapporto di contrasto WCAG 2.1: `(L_chiaro + 0.05) / (L_scuro + 0.05)`. Range [1, 21]. */
    static calcContrastRatio(colorA: string, colorB: string): number {
        const lumA = AppearanceService.calcLuminance(colorA);
        const lumB = AppearanceService.calcLuminance(colorB);
        const lighter = Math.max(lumA, lumB);
        const darker = Math.min(lumA, lumB);
        return (lighter + 0.05) / (darker + 0.05);
    }

    /** Luminanza relativa WCAG 2.1: `0.2126R + 0.7152G + 0.0722B` sui canali linearizzati. Range [0, 1]. */
    static calcLuminance(hexColor: string): number {
        const n = AppearanceService.normalizeHex(hexColor);
        const r = AppearanceService.toLinearChannel(parseInt(n.substring(0, 2), 16) / 255);
        const g = AppearanceService.toLinearChannel(parseInt(n.substring(2, 4), 16) / 255);
        const b = AppearanceService.toLinearChannel(parseInt(n.substring(4, 6), 16) / 255);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    // ── Private helpers ───────────────────────────────────────────────────

    // Converte hex → {r, g, b} uint8. Delega la normalizzazione a normalizeHex.
    private static hexToRgb(hexColor: string): { r: number; g: number; b: number } {
        const n = AppearanceService.normalizeHex(hexColor);
        return {
            r: parseInt(n.slice(0, 2), 16),
            g: parseInt(n.slice(2, 4), 16),
            b: parseInt(n.slice(4, 6), 16),
        };
    }

    // Rimuove il '#', espande la shorthand #RGB → #RRGGBB e garantisce esattamente 6 caratteri.
    private static normalizeHex(hexColor: string): string {
        const s = hexColor.replace('#', '').trim();
        return s.length === 3
            ? s.split('').map(c => c + c).join('')
            : s.padEnd(6, '0').slice(0, 6);
    }

    // Converte tre canali uint8 in '#rrggbb', clampando ogni canale a [0, 255].
    private static rgbToHex(r: number, g: number, b: number): string {
        const ch = (v: number) =>
            Math.min(Math.max(Math.round(v), 0), 255).toString(16).padStart(2, '0');
        return `#${ch(r)}${ch(g)}${ch(b)}`;
    }

    // Linearizzazione gamma sRGB (IEC 61966-2-1): rimuove la curva gamma prima del calcolo della luminanza.
    // Soglia 0.04045: valori sotto usano la rampa lineare, sopra la curva di potenza 2.4.
    private static toLinearChannel(channelValue: number): number {
        return channelValue <= 0.04045
            ? channelValue / 12.92
            : Math.pow((channelValue + 0.055) / 1.055, 2.4);
    }
}
