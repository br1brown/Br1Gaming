import { isPlatformBrowser } from '@angular/common';
import { CSP_NONCE, Injectable, PLATFORM_ID, Signal, WritableSignal, afterNextRender, computed, inject, isDevMode, signal, DOCUMENT } from '@angular/core';
import { ContestoSito } from '../../../site';
import { toPascalCaseLabel, MOVIMENTO_DURATA, ELEVAZIONE_TIERS, HOVER_INTENSITY_TIERS, PULSAZIONE_TIERS, MUTEZZA_SECONDARIO_FATTORE, SEPARAZIONE_SUPERFICI_FATTORE } from '../design-system-presets';

/** Coppie CSS custom property per gli assi "sensazione" del design system. Costante di MODULO (non un metodo): a differenza della palette colore, questi assi dipendono solo da `ContestoSito.config`, fissa per tutto il deployment — calcolata una volta, condivisa fra client e SSR così le due emissioni non divergono. */
const STATIC_DESIGN_VARS: readonly [string, string][] = (() => {
    const cfg = ContestoSito.config;
    const movimento = MOVIMENTO_DURATA[cfg.movimento];
    const elevazione = ELEVAZIONE_TIERS[cfg.elevazione];
    const hover = HOVER_INTENSITY_TIERS[cfg.hoverIntensity];
    const pulsazione = PULSAZIONE_TIERS[cfg.pulsazioneAttiva];
    return [
        ['--movimentoPagina', movimento.pagina],
        ['--movimentoPannello', movimento.pannello],
        ['--elevazioneRaggio', elevazione.raggio],
        ['--shadowElevated', elevazione.ombra],
        ['--shadowElevatedHover', elevazione.ombraHover],
        ['--hoverBg', hover.hoverBg],
        ['--hoverBorder', hover.hoverBorder],
        ['--activeBg', hover.activeBg],
        ['--activeBorder', hover.activeBorder],
        ['--pulsazioneNome', pulsazione.nome],
        ['--pulsazioneSpread1', pulsazione.spread1],
        ['--pulsazioneTrasparenza1', pulsazione.trasparenza1],
        ['--pulsazioneSpread2', pulsazione.spread2],
        ['--pulsazioneTrasparenza2', pulsazione.trasparenza2],
        ['--lightboxRaggio', cfg.lightboxBordiArrotondati ? '4px' : '0px'],
    ];
})();

/** Token subtle/emphasis da `computeSemanticSubtle`, per `.alert-*-subtle`/`.text-*-emphasis`/`.bg-*-subtle`. Varianti Lt/Dk pre-calcolate, `_applyPalette` sceglie la coppia in base al tone OS. */
export interface SemanticSubtleTokens {
    /** Sfondo pastello light: tinta pallida del colore semantico su base chiara. CSS: `--bs-*-bg-subtle` (light) */
    bgSubtleLt: string;
    /** Sfondo pastello dark: tinta pallida del colore semantico su base scura. CSS: `--bs-*-bg-subtle` (dark) */
    bgSubtleDk: string;
    /** Bordo intermedio light per `.alert-*`. CSS: `--bs-*-border-subtle` (light) */
    borderSubtleLt: string;
    /** Bordo intermedio dark per `.alert-*`. CSS: `--bs-*-border-subtle` (dark) */
    borderSubtleDk: string;
    /** Testo con contrasto WCAG 4.5:1 su `bgSubtleLt`, per `.text-*-emphasis`. CSS: `--bs-*-text-emphasis` (light) */
    textEmphasisLt: string;
    /** Testo con contrasto WCAG 4.5:1 su `bgSubtleDk`, per `.text-*-emphasis`. CSS: `--bs-*-text-emphasis` (dark) */
    textEmphasisDk: string;
}

/** Snapshot della palette da `computePalette` per un `colorTema`: esadecimale tranne `colorPrimaryRgb` (tripla RGB) e `naturalTone`. Varianti Lt/Dk pre-calcolate insieme, `_applyPalette` sceglie senza ricalcolare. */
export interface PaletteTokens {
    // ── Brand ─────────────────────────────────────────────────────────────────
    /** Colore brand esatto (`site.colorTema` in global-settings.json). CSS: `--colorTema` */
    colorTema: string;
    /** `#000000` o `#ffffff` — testo a massimo contrasto su `colorTema`. CSS: `--colorTemaText` */
    colorTemaText: '#000000' | '#ffffff';
    /** Brand scurito in OKLCH (hue e chroma preservate) finché il contrasto WCAG 4.5:1 sullo sfondo pagina chiaro (`baseLt`) è garantito. Usato per link, bottoni, CTA. CSS: `--colorPrimary` */
    colorPrimary: string;
    /** Tripla RGB di `colorPrimary` (es. `"31, 64, 255"`), per le utility `rgba()` di Bootstrap. CSS: `--colorPrimaryRgb` */
    colorPrimaryRgb: string;
    /** Gemella scura di `colorPrimary` (brand schiarito in OKLCH, contrasto 4.8:1 su `mutedBgDk`): FOREGROUND del primary in dark mode, dove `colorPrimary` risulterebbe scuro-su-scuro. CSS: `--colorPrimaryFgDk` */
    colorPrimaryFgDk: string;
    /** Tripla RGB di `colorPrimaryFgDk`, per le utility `rgba()` con opacity. CSS: `--colorPrimaryFgRgbDk` */
    colorPrimaryFgDkRgb: string;
    /** Variante light del primary come FOREGROUND (brand scurito in OKLCH, contrasto 4.8:1 su `mutedBgLt`), disaccoppiata dal fill `colorPrimary`: il foreground vive sulle superfici, il fill ospita testo proprio. CSS: `--colorPrimaryFgLt` */
    colorPrimaryFgLt: string;
    /** Tripla RGB di `colorPrimaryFgLt`. CSS: `--colorPrimaryFgRgbLt` */
    colorPrimaryFgLtRgb: string;
    /** Variante dark del primary come FILL: `colorPrimary` schiarito quanto basta per un boundary ≥3.2:1 sul fondo scuro (brand già luminosi: invariato). CSS: `--colorPrimaryDk` (fill) */
    colorPrimaryFillDk: string;
    /** Tripla RGB di `colorPrimaryFillDk`. CSS: `--colorPrimaryRgbDk` (fill) */
    colorPrimaryFillDkRgb: string;
    /** `#000000` o `#ffffff` — testo leggibile su `colorPrimaryFillDk` (fill primary in dark). CSS: `--colorPrimaryTextDk` */
    colorPrimaryTextDk: '#000000' | '#ffffff';
    /** `#000000` o `#ffffff` — testo leggibile su `colorPrimary` (fill primary in light). CSS: `--colorPrimaryText` */
    colorPrimaryText: '#000000' | '#ffffff';

    // ── Link — tone-adaptive ────────────────────────────────────────────────
    /** Link in light mode: uguale a `colorPrimary`, già 4.5:1 su sfondo chiaro. CSS: `--colorLinkLt` */
    colorLinkLt: string;
    /** Link in dark mode: stessa hue brand, luminosità alzata da `findCompliantColor` fino a 4.5:1 su sfondo scuro. CSS: `--colorLinkDk` */
    colorLinkDk: string;

    // ── Surfaces — light tone ──────────────────────────────────────────────
    /** Sfondo pagina light: quasi bianco con leggera tinta brand (L=0.970 default, più basso con `PaletteOverrides.backgroundVividness` > 0). CSS: `--colorBaseLt` */
    colorBaseLt: string;
    /** Sfondo card/modal light: leggermente più luminoso di Base (L=0.985). CSS: `--colorSurfaceLt` */
    colorSurfaceLt: string;
    /** Sfondo hover su elementi interattivi light (L=0.950). CSS: `--colorSurfaceHoverLt` */
    colorSurfaceHoverLt: string;
    /** Bordo separatore light: L=0.570, C=0 → ~4.3:1 su Base (WCAG 1.4.11 ≥ 3:1). CSS: `--colorSurfaceBorderLt` */
    colorSurfaceBorderLt: string;
    /** Testo corpo light: quasi nero con leggera tinta brand (L=0.200). CSS: `--colorSurfaceTextLt` */
    colorSurfaceTextLt: string;

    // ── Surfaces — dark tone ───────────────────────────────────────────────
    /** Sfondo pagina dark: quasi nero con leggera tinta brand (L=0.140 default, più alto con `PaletteOverrides.backgroundVividness` > 0). CSS: `--colorBaseDk` */
    colorBaseDk: string;
    /** Sfondo card/modal dark (L=0.180). CSS: `--colorSurfaceDk` */
    colorSurfaceDk: string;
    /** Sfondo hover su elementi interattivi dark (L=0.220). CSS: `--colorSurfaceHoverDk` */
    colorSurfaceHoverDk: string;
    /** Bordo separatore dark: L=0.490, C=0 → ~3.3:1 su Base dark (WCAG 1.4.11 ≥ 3:1). CSS: `--colorSurfaceBorderDk` */
    colorSurfaceBorderDk: string;
    /** Testo corpo dark: quasi bianco con leggera tinta brand (L=0.920). CSS: `--colorSurfaceTextDk` */
    colorSurfaceTextDk: string;

    // ── Semantic — light tone ──────────────────────────────────────────────
    /** Variante muted del brand (chroma ridotta al 75%), light mode. Usato da `.btn-secondary`, `.badge`. CSS: `--colorSecondaryLt` */
    colorSecondaryLt: string;
    /** `#000000` o `#ffffff` — testo leggibile su `colorSecondaryLt`. CSS: `--colorSecondaryTextLt` */
    colorSecondaryTextLt: '#000000' | '#ffffff';

    // ── Semantic — dark tone ───────────────────────────────────────────────
    /** Variante muted del brand (chroma ridotta al 75%), dark mode. CSS: `--colorSecondaryDk` */
    colorSecondaryDk: string;
    /** `#000000` o `#ffffff` — testo leggibile su `colorSecondaryDk`. CSS: `--colorSecondaryTextDk` */
    colorSecondaryTextDk: '#000000' | '#ffffff';

    // ── Subtle/emphasis — usati da .alert-*-subtle, .text-*-emphasis per primary e secondary
    /** Token sfondo/bordo/testo per `.alert-primary`, `.text-primary-emphasis`, `.bg-primary-subtle`. */
    subtlePrimary: SemanticSubtleTokens;
    /** Token sfondo/bordo/testo per `.alert-secondary`, `.text-secondary-emphasis`, `.bg-secondary-subtle`. */
    subtleSecondary: SemanticSubtleTokens;
    // Nota: warning/success/danger NON sono calcolati qui — restano colori semantici con hue fisse
    // (non derivate dal brand): significato universale (allerta/successo/errore), non negoziabile.
    // Bootstrap 5.3 fornisce già varianti light/dark WCAG-safe tramite i blocchi [data-bs-theme] nel
    // suo CSS. AppearanceService imposta data-bs-theme su <html>, quindi --bs-warning-text-emphasis ecc.
    // si risolvono automaticamente senza ricalcolo.

    // ── Info — SOLO se PaletteOverrides.info è presente (a differenza di primary/secondary non ha
    // un fallback derivato dal brand: assente, questi 5 campi restano undefined e --bs-info* resta
    // gestito per intero da Bootstrap, invariato). Stessa pipeline WCAG di subtleSecondary.
    /** `.btn-outline-info`/testo su `colorInfoBgSubtleLt`. Presente solo se overridden. CSS: `--colorInfoLt` */
    colorInfoLt?: string;
    /** Come sopra, dark mode. CSS: `--colorInfoDk` */
    colorInfoDk?: string;
    /** `#000000` o `#ffffff` — testo leggibile su `colorInfoLt`. CSS: `--colorInfoTextLt` */
    colorInfoTextLt?: '#000000' | '#ffffff';
    /** `#000000` o `#ffffff` — testo leggibile su `colorInfoDk`. CSS: `--colorInfoTextDk` */
    colorInfoTextDk?: '#000000' | '#ffffff';
    /** Token sfondo/bordo/testo per `.alert-info`, `.text-info-emphasis`, `.bg-info-subtle`. Presente solo se overridden. */
    subtleInfo?: SemanticSubtleTokens;

    // ── Structural Bootstrap vars (headings, muted bg, muted text) ─────────
    /** Colore headings/`<strong>` light: quasi nero con leggera tinta brand (L=0.165). CSS: `--colorHeadingLt` / `--bs-heading-color` */
    colorHeadingLt: string;
    /** Colore headings/`<strong>` dark: quasi bianco con leggera tinta brand (L=0.958). CSS: `--colorHeadingDk` / `--bs-heading-color` */
    colorHeadingDk: string;
    /** Sfondo muted light: input disabilitati, righe table-striped (L=0.942). CSS: `--bs-secondary-bg` (light) */
    colorMutedBgLt: string;
    /** Sfondo muted dark: input disabilitati, righe table-striped (L=0.295). CSS: `--bs-secondary-bg` (dark) */
    colorMutedBgDk: string;
    /** Sfondo tertiary light: table-striped alternato, testo placeholder (L=0.967). CSS: `--bs-tertiary-bg` (light) */
    colorSubtleBgLt: string;
    /** Sfondo tertiary dark: table-striped alternato, testo placeholder (L=0.248). CSS: `--bs-tertiary-bg` (dark) */
    colorSubtleBgDk: string;
    /** Testo muted light: WCAG 4.5:1 su `colorBaseLt`, calcolato da `findCompliantColor`. CSS: `--bs-secondary-color` (light) */
    colorMutedTextLt: string;
    /** Testo muted dark: WCAG 4.5:1 su `colorBaseDk`, calcolato da `findCompliantColor`. CSS: `--bs-secondary-color` (dark) */
    colorMutedTextDk: string;

    // ── Adaptive Navbar/Footer tokens ──────────────────────────────────────
    /** Sfondo navbar/footer light: `colorTema` diretto se brand scuro (look immersivo), altrimenti pastello (L=0.965) per evitare colori aggressivi. CSS: `--colorNavBgLt` */
    colorNavBgLt: string;
    /** Testo navbar/footer light: bianco su brand scuro, oppure quasi-nero tintato brand su pastello. CSS: `--colorNavTextLt` */
    colorNavTextLt: string;
    /** Sfondo navbar/footer dark: quasi nero con leggera tinta brand (L=0.150). CSS: `--colorNavBgDk` */
    colorNavBgDk: string;
    /** Testo navbar/footer dark: quasi bianco con leggera tinta brand (L=0.920). CSS: `--colorNavTextDk` */
    colorNavTextDk: string;
    /** Bordo navbar/dropdown light: mix 15% text su bg. CSS: `--colorNavBorderLt` */
    colorNavBorderLt: string;
    /** Bordo navbar/dropdown dark: mix 15% text su bg. CSS: `--colorNavBorderDk` */
    colorNavBorderDk: string;

    /** Tono suggerito dal brand ('light' se richiede testo scuro): valore iniziale di `themeTone` in SSR, dove `prefers-color-scheme` non è disponibile. */
    naturalTone: 'light' | 'dark';

    /** Colori con nome proprio da `PaletteOverrides.customPalette` (stessa pipeline WCAG di `colorSecondary*`); `{}` se nessun design system ne propone. CSS: `--color<Label>`/`--color<Label>Text`. */
    customPalette: Record<string, { lt: string; ltText: '#000000' | '#ffffff'; dk: string; dkText: '#000000' | '#ffffff' }>;
}

/** Override opzionali con hue indipendente dal brand: secondario, sfondo, testo, info. `background`/`text` restano famiglie derivate con garanzia WCAG; `secondary`/`info`/`customPalette` sono override "duri" (fill esatto, WCAG non garantita — scelta visibile di chi lo imposta). Dettagli per campo sotto. */
export interface PaletteOverrides {
    /** Override "duro" di `colorSecondary*`: se presente, fill esatto in entrambi i toni (nessuna ricerca di contrasto), solo `subtleSecondary` resta derivato WCAG. Assente: muted del brand, come sempre. */
    secondary?: string;
    /** Hue/chroma indipendenti per la famiglia base/surface/mutedBg/subtleBg — sempre derivata con garanzia WCAG (non un override "duro": nessun hex singolo copre tutti quei ruoli). */
    background?: string;
    /** Hue/chroma per surfaceText/heading/mutedText, stessa natura di `background`. Assente: il testo segue `background` (o il brand), mai scollegato da chi non l'ha scelto. */
    text?: string;
    /** Override "duro" di `colorInfo*` come `secondary`. A differenza degli altri campi non ha fallback dal brand: assente, niente token `colorInfo*` e Bootstrap gestisce `--bs-info*` per intero. */
    info?: string;
    /** Colori con nome proprio (`DesignSystemPreset.customPalette`), override "duro" come `secondary`: ogni voce diventa il fill esatto di `--color<Label>`/`--color<Label>Text`. Vuoto: nessun token in più. */
    customPalette?: Record<string, string>;
    /** Quanto le superfici si avvicinano alla lucentezza (L, OKLCH) del colore di riferimento invece di restare neutre: 0 (default) = near-black/white appena tinto, 1 = sfondo visibilmente quel colore, interpolato in mezzo. L'interpolazione preserva l'ordine fra superfici e non scende mai sotto WCAG (testo ricalcolato contro la superficie reale). */
    backgroundVividness?: number;
    /** Fattore (0-1) sul chroma OKLCH del `secondary` auto-calcolato, solo se non è già un override "duro". 1 (default) = comportamento storico. Da `DesignSystemPreset.mutezzaSecondario`. */
    mutezzaSecondarioFattore?: number;
    /** Fattore che scala lo scarto di lucentezza fra le superfici di contenuto (asse ortogonale a `backgroundVividness`); il bordo resta escluso (ancorato al minimo WCAG 1.4.11). 1 (default) = scarti storici. Da `DesignSystemPreset.separazioneSuperfici`. */
    separazioneSuperficiFattore?: number;
}

/**
 * Unica fonte di verità per l'estetica del sito derivata dal design system attivo (palette colore
 * OKLCH, movimento/elevazione/hoverIntensity, font-face self-hosted): `_applyPalette` inietta tutte
 * le CSS vars su `<html>` in modo sincrono, condividendo il canale SSR con tutti gli assi — perché
 * restano in una classe sola. Metodi statici puri (usabili anche da script di build): computePalette,
 * hexToOklch, oklchToHex, computeThemeTone, computeColorPrimary, prefersDarkText,
 * getReadableTextColor, mixHexColors, calcContrastRatio.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {

    // Fisso per l'intera sessione (site.colorTema): niente più setColorTema() a runtime (rimosso,
    // mai usato). Resta un Signal solo per compatibilità dell'API pubblica `colorTema` sotto.
    private readonly _colorTema: Signal<string>;
    private readonly _palette: Signal<PaletteTokens>;

    // Statici per la sessione (config di progetto, non runtime come colorTema).
    private readonly _overrides: PaletteOverrides;

    private readonly document = inject(DOCUMENT);
    private readonly platformId = inject(PLATFORM_ID);
    // Stesso nonce del provider CSP_NONCE: serve esplicito perché _ensureFontFaces crea il tag via
    // DOM nativo, non via Renderer2 (che applicherebbe il nonce in automatico).
    private readonly cspNonce = inject(CSP_NONCE, { optional: true });

    // ── Plain readonly from palette ───────────────────────────────────────

    /** Colore brand — fisso per l'intera sessione (`site.colorTema`), mai a runtime. CSS: `--colorTema` */
    readonly colorTema: Signal<string>;
    /** Signal `#000000` o `#ffffff` — testo a contrasto massimo su `--colorTema`. CSS: `--colorTemaText` */
    readonly colorTemaText: Signal<'#000000' | '#ffffff'>;
    /** Signal della variante scurita del brand, contrasto WCAG 4.5:1 sullo sfondo chiaro reale. Bottoni, CTA, link. CSS: `--colorPrimary` */
    readonly colorPrimary: Signal<string>;
    /** Signal `#000000` o `#ffffff` — testo leggibile su `--colorPrimary`. CSS: `--colorPrimaryText` */
    readonly colorPrimaryText: Signal<'#000000' | '#ffffff'>;
    /** Signal della variante muted del brand (o hue indipendente se overridden). Non tone-adaptive come `colorPrimary`, coerente con l'uso in canvas/immagini generate (artefatto statico). CSS: `--colorSecondaryLt` */
    readonly colorSecondary: Signal<string>;
    /** Signal `#000000` o `#ffffff` — testo leggibile su `--colorSecondary`. CSS: `--colorSecondaryTextLt` */
    readonly colorSecondaryText: Signal<'#000000' | '#ffffff'>;
    /** Tono del pannello contenuti (`.content-panel`), indipendente dal tono di navbar/footer/sfondo: da `panelSurface` del design system, `null` se `'auto'` (segue l'ambiente). Unica fonte per attributo Bootstrap e classi CSS. */
    readonly panelTone: 'light' | 'dark' | null;
    // Da global-settings.json → site.forceThemeTone. null = segue l'OS (comportamento di sempre).
    private readonly _forcedThemeTone: 'light' | 'dark' | undefined;
    // Da shell.navSurface in site.ts (impostabile anche via shell.designSystem). 'brand' = storico
    // (navbar/footer come superficie immersiva di brand); 'body' = condividono lo sfondo pagina.
    private readonly _navSurface: 'brand' | 'body';

    // ── OS-reactive signals ───────────────────────────────────────────────

    // WritableSignal interno: aggiornato dal listener prefers-color-scheme nel costruttore.
    // Esposto in sola lettura come `themeTone` — i componenti leggono, non scrivono.
    private readonly _themeTone: WritableSignal<'light' | 'dark'>;
    /** Signal reattivo a `prefers-color-scheme`, cambia senza reload; riflesso come attributo `data-theme-tone` su `<html>`. Per componenti che adattano canvas/icone/stili inline al tono corrente. */
    readonly themeTone: Signal<'light' | 'dark'>;

    constructor() {
        // 1. Colore brand (fisso, da ContestoSito.config) + palette computed con cache automatica.
        this._colorTema = signal(ContestoSito.config.colorTema);
        this._overrides = {
            secondary: ContestoSito.config.colorSecondary,
            background: ContestoSito.config.colorBackground,
            text: ContestoSito.config.colorText,
            info: ContestoSito.config.colorInfo,
            customPalette: ContestoSito.config.customPalette,
            backgroundVividness: ContestoSito.config.backgroundVividness,
            mutezzaSecondarioFattore: MUTEZZA_SECONDARIO_FATTORE[ContestoSito.config.mutezzaSecondario],
            separazioneSuperficiFattore: SEPARAZIONE_SUPERFICI_FATTORE[ContestoSito.config.separazioneSuperfici],
        };
        this._palette = computed(() => AppearanceService._getCachedPalette(this._colorTema(), this._overrides));

        // 2. Signal pubblici derivati dalla palette — si aggiornano automaticamente
        //    quando cambia _colorTema, senza calcoli aggiuntivi.
        this.colorTema          = this._colorTema;
        this.colorTemaText      = computed(() => this._palette().colorTemaText);
        this.colorPrimary       = computed(() => this._palette().colorPrimary);
        this.colorPrimaryText   = computed(() => this._palette().colorPrimaryText);
        this.colorSecondary     = computed(() => this._palette().colorSecondaryLt);
        this.colorSecondaryText = computed(() => this._palette().colorSecondaryTextLt);
        // Da global-settings.json → site.forceThemeTone: sito intero fissato su un tono, mai riletto dall'OS.
        this._forcedThemeTone = ContestoSito.config.forceThemeTone;
        // panelSurface pinna il pannello indipendentemente dall'ambiente (anche se fissato da
        // forceThemeTone): un tono diverso dal resto del sito è una composizione valida (pattern
        // comune, es. Radix/Chakra/Carbon), non un conflitto da arbitrare qui.
        this.panelTone = ContestoSito.config.panelSurface === 'auto' ? null : ContestoSito.config.panelSurface;
        this._navSurface = ContestoSito.config.navSurface;

        // 3. themeTone inizializzato col tono forzato se presente, altrimenti naturalTone
        //    (SSR-safe, senza leggere prefers-color-scheme).
        this._themeTone = signal(this._forcedThemeTone ?? this._palette().naturalTone);
        this.themeTone = this._themeTone.asReadonly();

        // 4. `<style id="theme-init">` presente = l'SSR ha già iniettato i blocchi @media che coprono
        //    da soli, in puro CSS, render iniziale e ogni cambio OS: JS non riscrive mai le CSS vars
        //    (evita ~100 setProperty a vuoto). Manca solo su CSR-only (build/preview senza SSR).
        const ssrThemeTagPresent = isPlatformBrowser(this.platformId) && !!this.document.getElementById('theme-init');

        afterNextRender(() => {
            if (!ssrThemeTagPresent) this._applyPalette(this._palette(), this._themeTone());
            this._ensureFontFaces();
        });

        if (!isPlatformBrowser(this.platformId)) return;

        // 5-6. Tono forzato: mai leggere né ascoltare prefers-color-scheme — resta quello
        //      configurato per tutta la sessione, un eventuale cambio OS non ha effetto.
        if (this._forcedThemeTone) return;

        // 5. Aggiorna con le preferenze OS reali (client-only).
        const osTone: 'light' | 'dark' =
            window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        this._themeTone.set(osTone);

        // 6. Ascolta i cambiamenti OS in tempo reale — SEMPRE, per `themeTone` (letto anche da chi
        //    non ha bisogno delle CSS vars, es. navbar.component.html/notification.service.ts):
        //    solo la riapplicazione costosa delle CSS vars è condizionata, il signal resta reattivo
        //    in ogni caso.
        window.matchMedia('(prefers-color-scheme: dark)')
            .addEventListener('change', e => {
                const t: 'light' | 'dark' = e.matches ? 'dark' : 'light';
                this._themeTone.set(t);
                if (!ssrThemeTagPresent) this._applyPalette(this._palette(), t);
            });
    }

    // ── DOM injection ─────────────────────────────────────────────────────

    /** Sceglie la coppia di token già calcolati per lo slot navbar/footer (alias, non nuova matematica): 'brand' = token immersivi dedicati, 'body' = stessi token dello sfondo pagina (nessuna cesura col contenuto). */
    private static _resolveNavColors(p: PaletteTokens, navSurface: 'brand' | 'body'): {
        navBgLt: string; navBgDk: string;
        navTextLt: string; navTextDk: string;
        navBorderLt: string; navBorderDk: string;
    } {
        if (navSurface === 'body') {
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

    /** Inietta le CSS custom properties del tema su `<html>` (+ data-bs-theme/data-theme-tone). Solo CSR-only, quando manca `<style id="theme-init">`: col tag SSR i blocchi @media coprono già tutto in CSS puro. */
    private _applyPalette(p: PaletteTokens, tone: 'light' | 'dark'): void {
        const el = this.document.documentElement;
        const lt = tone === 'light';
        const nav = AppearanceService._resolveNavColors(p, this._navSurface);

        el.setAttribute('data-bs-theme', tone);
        el.setAttribute('data-theme-tone', tone);

        const link = lt ? p.colorLinkLt : p.colorLinkDk;
        // Fissi Lt/Dk (non tone-adaptive sull'OS): servono al ponte CSS dei subtheme [data-bs-theme]
        // nidificati, stesso motivo di --colorLinkLt/Dk sotto — vedi commento su "Varianti Lt/Dk separate".
        const linkHoverLt = AppearanceService.mixHexColors(p.colorLinkLt, '#000000', 0.15);
        const linkHoverDk = AppearanceService.mixHexColors(p.colorLinkDk, '#ffffff', 0.15);
        const fontFamily = ContestoSito.config.fonts.webStack;
        const vars: [string, string][] = [
            // Font
            ['--fontFamily', fontFamily],
            ['--bs-body-font-family', fontFamily],
            // Font custom raggiungibili da SCSS di progetto (--fontFamily-<key>), indipendenti da
            // quale sia il font attivo del sito — vedi ResolvedFonts.customFontVars.
            ...AppearanceService._customFontVarEntries(),
            // Brand
            ['--colorTema', p.colorTema],
            ['--colorTemaText', p.colorTemaText],
            // Primary FILL tone-adaptive (--bs-primary, .btn-primary/.bg-primary): colorPrimary in
            // light, colorPrimaryFillDk in dark (schiarito per boundary ≥3.2:1 sul fondo scuro).
            // Il testo del fill segue: colorPrimaryText (light) / colorPrimaryTextDk (dark).
            ['--colorPrimary', lt ? p.colorPrimary : p.colorPrimaryFillDk],
            ['--colorPrimaryRgb', lt ? p.colorPrimaryRgb : p.colorPrimaryFillDkRgb],
            ['--colorPrimaryText', lt ? p.colorPrimaryText : p.colorPrimaryTextDk],
            // Varianti fisse Lt/Dk del FILL per il ponte CSS dei subtheme [data-bs-theme] nidificati
            ['--colorPrimaryLt', p.colorPrimary],
            ['--colorPrimaryRgbLt', p.colorPrimaryRgb],
            ['--colorPrimaryTextLt', p.colorPrimaryText],
            ['--colorPrimaryDk', p.colorPrimaryFillDk],
            ['--colorPrimaryRgbDk', p.colorPrimaryFillDkRgb],
            ['--colorPrimaryTextDk', p.colorPrimaryTextDk],
            // Primary FOREGROUND tone-adaptive (testo/bordo .text-primary/.border-primary),
            // DISACCOPPIATO dal fill: colorPrimaryFgLt in light, colorPrimaryFgDk in dark — entrambi
            // tarati 4.8:1 sulla superficie più estrema. I FILL restano su --bs-primary. Pattern di --colorLink.
            ['--colorPrimaryFg', lt ? p.colorPrimaryFgLt : p.colorPrimaryFgDk],
            ['--colorPrimaryFgRgb', lt ? p.colorPrimaryFgLtRgb : p.colorPrimaryFgDkRgb],
            // Varianti fisse Lt/Dk del primary FOREGROUND per il ponte CSS dei subtheme [data-bs-theme]
            ['--colorPrimaryFgLt', p.colorPrimaryFgLt],
            ['--colorPrimaryFgRgbLt', p.colorPrimaryFgLtRgb],
            ['--colorPrimaryFgDk', p.colorPrimaryFgDk],
            ['--colorPrimaryFgRgbDk', p.colorPrimaryFgDkRgb],
            // Link + focus ring — tone-adaptive: contrasto leggibile del link sul pannello
            ['--colorLinkLt', p.colorLinkLt],
            ['--colorLinkDk', p.colorLinkDk],
            // Triple RGB fisse Lt/Dk di link/link-hover: la mixin theme-bridge in _lib.scss sovrascrive
            // --bs-link-color (hex) ma non la variante -rgb, che Bootstrap usa davvero per il testo dei
            // link (rgba(var(--bs-link-color-rgb))). Senza, un subtheme [data-bs-theme] nidificato
            // ricadrebbe sul blu di stock Bootstrap invece del brand.
            ['--colorLinkRgbLt', AppearanceService.hexToRgbTriplet(p.colorLinkLt)],
            ['--colorLinkRgbDk', AppearanceService.hexToRgbTriplet(p.colorLinkDk)],
            ['--colorLinkHoverRgbLt', AppearanceService.hexToRgbTriplet(linkHoverLt)],
            ['--colorLinkHoverRgbDk', AppearanceService.hexToRgbTriplet(linkHoverDk)],
            ['--colorLink', link],
            ['--focusRingColor', link],
            ['--bs-link-color', link],
            ['--bs-link-hover-color', lt ? linkHoverLt : linkHoverDk],
            // Surfaces (tone-adaptive)
            ['--colorBase', lt ? p.colorBaseLt : p.colorBaseDk],
            ['--colorSurface', lt ? p.colorSurfaceLt : p.colorSurfaceDk],
            ['--colorSurfaceHover', lt ? p.colorSurfaceHoverLt : p.colorSurfaceHoverDk],
            ['--colorSurfaceBorder', lt ? p.colorSurfaceBorderLt : p.colorSurfaceBorderDk],
            ['--colorSurfaceText', lt ? p.colorSurfaceTextLt : p.colorSurfaceTextDk],
            // Semantic (tone-adaptive, derivati da brand)
            ['--colorSecondary', lt ? p.colorSecondaryLt : p.colorSecondaryDk],
            ['--colorSecondaryRgb', AppearanceService.hexToRgbTriplet(lt ? p.colorSecondaryLt : p.colorSecondaryDk)],
            ['--colorSecondaryText', lt ? p.colorSecondaryTextLt : p.colorSecondaryTextDk],
            // Bootstrap overrides
            ['--bs-primary', lt ? p.colorPrimary : p.colorPrimaryFillDk],
            ['--bs-primary-rgb', lt ? p.colorPrimaryRgb : p.colorPrimaryFillDkRgb],
            ['--bs-secondary', lt ? p.colorSecondaryLt : p.colorSecondaryDk],
            ['--bs-body-bg', lt ? p.colorBaseLt : p.colorBaseDk],
            ['--bs-body-color', lt ? p.colorSurfaceTextLt : p.colorSurfaceTextDk],
            ['--bs-body-color-rgb', AppearanceService.hexToRgbTriplet(lt ? p.colorSurfaceTextLt : p.colorSurfaceTextDk)],
            ['--bs-border-color', lt ? p.colorSurfaceBorderLt : p.colorSurfaceBorderDk],
            // RGB triplets semantici per rgba() utilities Bootstrap
            ['--bs-secondary-rgb', AppearanceService.hexToRgbTriplet(lt ? p.colorSecondaryLt : p.colorSecondaryDk)],
            ['--bs-link-color-rgb', AppearanceService.hexToRgbTriplet(link)],
            // Variabili strutturali Bootstrap
            ['--bs-emphasis-color', lt ? p.colorHeadingLt : p.colorHeadingDk],
            ['--bs-emphasis-color-rgb', AppearanceService.hexToRgbTriplet(lt ? p.colorHeadingLt : p.colorHeadingDk)],
            ['--bs-heading-color', lt ? p.colorHeadingLt : p.colorHeadingDk],
            ['--bs-secondary-bg', lt ? p.colorMutedBgLt : p.colorMutedBgDk],
            ['--bs-secondary-bg-rgb', AppearanceService.hexToRgbTriplet(lt ? p.colorMutedBgLt : p.colorMutedBgDk)],
            ['--bs-tertiary-bg', lt ? p.colorSubtleBgLt : p.colorSubtleBgDk],
            ['--bs-tertiary-bg-rgb', AppearanceService.hexToRgbTriplet(lt ? p.colorSubtleBgLt : p.colorSubtleBgDk)],
            ['--bs-secondary-color', lt ? p.colorMutedTextLt : p.colorMutedTextDk],
            ['--bs-secondary-color-rgb', AppearanceService.hexToRgbTriplet(lt ? p.colorMutedTextLt : p.colorMutedTextDk)],
            // Bootstrap subtle/emphasis system — .alert-*-subtle, .text-*-emphasis per primary e secondary
            ['--bs-primary-bg-subtle', lt ? p.subtlePrimary.bgSubtleLt : p.subtlePrimary.bgSubtleDk],
            ['--bs-primary-border-subtle', lt ? p.subtlePrimary.borderSubtleLt : p.subtlePrimary.borderSubtleDk],
            ['--bs-primary-text-emphasis', lt ? p.subtlePrimary.textEmphasisLt : p.subtlePrimary.textEmphasisDk],
            ['--bs-secondary-bg-subtle', lt ? p.subtleSecondary.bgSubtleLt : p.subtleSecondary.bgSubtleDk],
            ['--bs-secondary-border-subtle', lt ? p.subtleSecondary.borderSubtleLt : p.subtleSecondary.borderSubtleDk],
            ['--bs-secondary-text-emphasis', lt ? p.subtleSecondary.textEmphasisLt : p.subtleSecondary.textEmphasisDk],
            // Bridge vars — esposti come --color* su :root così base.scss può propagarli
            // ai subtheme [data-bs-theme] nested via var(--color*) senza dipendere dall'inline style
            ['--colorHeading', lt ? p.colorHeadingLt : p.colorHeadingDk],
            ['--colorHeadingRgb', AppearanceService.hexToRgbTriplet(lt ? p.colorHeadingLt : p.colorHeadingDk)],
            ['--colorMutedBg', lt ? p.colorMutedBgLt : p.colorMutedBgDk],
            ['--colorSubtleBg', lt ? p.colorSubtleBgLt : p.colorSubtleBgDk],
            ['--colorMutedText', lt ? p.colorMutedTextLt : p.colorMutedTextDk],
            ['--colorPrimaryBgSubtle', lt ? p.subtlePrimary.bgSubtleLt : p.subtlePrimary.bgSubtleDk],
            ['--colorPrimaryBorderSubtle', lt ? p.subtlePrimary.borderSubtleLt : p.subtlePrimary.borderSubtleDk],
            ['--colorPrimaryTextEmphasis', lt ? p.subtlePrimary.textEmphasisLt : p.subtlePrimary.textEmphasisDk],
            ['--colorSecondaryBgSubtle', lt ? p.subtleSecondary.bgSubtleLt : p.subtleSecondary.bgSubtleDk],
            ['--colorSecondaryBorderSubtle', lt ? p.subtleSecondary.borderSubtleLt : p.subtleSecondary.borderSubtleDk],
            ['--colorSecondaryTextEmphasis', lt ? p.subtleSecondary.textEmphasisLt : p.subtleSecondary.textEmphasisDk],
            // Varianti Lt/Dk separate — necessarie per il ponte CSS dei subtheme [data-bs-theme]
            // nidificati (es. pannello forced-light dentro pagina dark). Le variabili tone-adattive
            // sopra si risolvono sempre dal tone corrente dell'OS; questi token fissi permettono
            // a [data-bs-theme="light/dark"] in base.scss di usare il valore corretto
            // indipendentemente dal tone globale. Stesso pattern già usato per --colorLinkLt/Dk.
            ['--colorSecondaryLt', p.colorSecondaryLt],
            ['--colorSecondaryDk', p.colorSecondaryDk],
            ['--colorSecondaryRgbLt', AppearanceService.hexToRgbTriplet(p.colorSecondaryLt)],
            ['--colorSecondaryRgbDk', AppearanceService.hexToRgbTriplet(p.colorSecondaryDk)],
            ['--colorSecondaryTextLt', p.colorSecondaryTextLt],
            ['--colorSecondaryTextDk', p.colorSecondaryTextDk],
            // Idem per il subtle/emphasis system (.bg-*-subtle, .text-*-emphasis): senza queste
            // fisse, un subtheme [data-bs-theme] nidificato in tono diverso dal globale (es. pannello
            // forced-light dentro pagina dark) resterebbe con badge/alert colorati sul tono SBAGLIATO,
            // perché --colorPrimaryBgSubtle/--colorSecondaryBgSubtle sopra sono tone-adaptive sull'OS.
            ['--colorPrimaryBgSubtleLt', p.subtlePrimary.bgSubtleLt],
            ['--colorPrimaryBgSubtleDk', p.subtlePrimary.bgSubtleDk],
            ['--colorPrimaryBorderSubtleLt', p.subtlePrimary.borderSubtleLt],
            ['--colorPrimaryBorderSubtleDk', p.subtlePrimary.borderSubtleDk],
            ['--colorPrimaryTextEmphasisLt', p.subtlePrimary.textEmphasisLt],
            ['--colorPrimaryTextEmphasisDk', p.subtlePrimary.textEmphasisDk],
            ['--colorSecondaryBgSubtleLt', p.subtleSecondary.bgSubtleLt],
            ['--colorSecondaryBgSubtleDk', p.subtleSecondary.bgSubtleDk],
            ['--colorSecondaryBorderSubtleLt', p.subtleSecondary.borderSubtleLt],
            ['--colorSecondaryBorderSubtleDk', p.subtleSecondary.borderSubtleDk],
            ['--colorSecondaryTextEmphasisLt', p.subtleSecondary.textEmphasisLt],
            ['--colorSecondaryTextEmphasisDk', p.subtleSecondary.textEmphasisDk],
            ['--colorHeadingLt', p.colorHeadingLt],
            ['--colorHeadingDk', p.colorHeadingDk],
            ['--colorHeadingRgbLt', AppearanceService.hexToRgbTriplet(p.colorHeadingLt)],
            ['--colorHeadingRgbDk', AppearanceService.hexToRgbTriplet(p.colorHeadingDk)],
            ['--colorSurfaceTextLt', p.colorSurfaceTextLt],
            ['--colorSurfaceTextDk', p.colorSurfaceTextDk],
            ['--colorSurfaceTextRgbLt', AppearanceService.hexToRgbTriplet(p.colorSurfaceTextLt)],
            ['--colorSurfaceTextRgbDk', AppearanceService.hexToRgbTriplet(p.colorSurfaceTextDk)],
            ['--colorBaseLt', p.colorBaseLt],
            ['--colorBaseDk', p.colorBaseDk],
            ['--colorSurfaceBorderLt', p.colorSurfaceBorderLt],
            ['--colorSurfaceBorderDk', p.colorSurfaceBorderDk],
            ['--colorMutedBgLt', p.colorMutedBgLt],
            ['--colorMutedBgDk', p.colorMutedBgDk],
            ['--colorSubtleBgLt', p.colorSubtleBgLt],
            ['--colorSubtleBgDk', p.colorSubtleBgDk],
            ['--colorMutedTextLt', p.colorMutedTextLt],
            ['--colorMutedTextDk', p.colorMutedTextDk],
            // Adaptive Nav variables — quale coppia alimenta questi token dipende da `_navSurface`
            // (vedi `_resolveNavColors`): 'brand' (default) = i token immersivi dedicati qui sotto,
            // 'body' = alias dei token dello sfondo pagina, per un chrome senza cesura.
            ['--colorNavBg', lt ? nav.navBgLt : nav.navBgDk],
            ['--colorNavText', lt ? nav.navTextLt : nav.navTextDk],
            ['--colorNavBgLt', nav.navBgLt],
            ['--colorNavBgDk', nav.navBgDk],
            ['--colorNavTextLt', nav.navTextLt],
            ['--colorNavTextDk', nav.navTextDk],
            ['--colorNavBorder', lt ? nav.navBorderLt : nav.navBorderDk],
            ['--colorNavBorderLt', nav.navBorderLt],
            ['--colorNavBorderDk', nav.navBorderDk],
        ];

        // Info — SOLO se PaletteOverrides.info era presente in computePalette (vedi PaletteTokens).
        // Assente: questi campi sono undefined, niente viene toccato, --bs-info* resta gestito da
        // Bootstrap. Presente: stesso schema --bs-primary*/--bs-secondary* sopra.
        if (p.colorInfoLt !== undefined && p.colorInfoDk !== undefined && p.subtleInfo) {
            const colorInfo = lt ? p.colorInfoLt : p.colorInfoDk;
            const colorInfoText = lt ? p.colorInfoTextLt! : p.colorInfoTextDk!;
            vars.push(
                ['--bs-info', colorInfo],
                ['--bs-info-rgb', AppearanceService.hexToRgbTriplet(colorInfo)],
                ['--colorInfoText', colorInfoText],
                ['--bs-info-bg-subtle', lt ? p.subtleInfo.bgSubtleLt : p.subtleInfo.bgSubtleDk],
                ['--bs-info-border-subtle', lt ? p.subtleInfo.borderSubtleLt : p.subtleInfo.borderSubtleDk],
                ['--bs-info-text-emphasis', lt ? p.subtleInfo.textEmphasisLt : p.subtleInfo.textEmphasisDk],
            );
        }

        // customPalette: una coppia --color<Label>/--color<Label>Text per voce (tone-adaptive, come
        // --colorSecondary sopra) — {} se nessun design system ne propone, nessun var in più.
        for (const [label, colors] of Object.entries(p.customPalette)) {
            const cssLabel = toPascalCaseLabel(label);
            vars.push(
                [`--color${cssLabel}`, lt ? colors.lt : colors.dk],
                [`--color${cssLabel}Text`, lt ? colors.ltText : colors.dkText],
            );
        }

        vars.push(...STATIC_DESIGN_VARS);

        for (const [prop, val] of vars) {
            el.style.setProperty(prop, val);
        }
        el.style.colorScheme = tone;
    }

    /** Inietta le `@font-face` (`ContestoSito.config.fonts.fontFaces` — il font attivo, di sistema
     *  o custom, più ogni `addonFonts` "secondario" registrato) una sola volta. Se `theme-init` è
     *  già nel DOM l'SSR l'ha già fatto — altrimenti (client-only, `ng serve`) crea un tag
     *  dedicato, perché le CSS custom properties di `_applyPalette` non possono dichiarare un
     *  at-rule. */
    private _ensureFontFaces(): void {
        if (!ContestoSito.config.fonts.fontFaces.length) return;
        if (this.document.getElementById('theme-init')) return;
        if (this.document.getElementById('custom-font-face')) return;
        const style = this.document.createElement('style');
        style.setAttribute('id', 'custom-font-face');
        if (this.cspNonce) style.setAttribute('nonce', this.cspNonce);
        style.textContent = AppearanceService._buildFontFaceRules();
        this.document.head.appendChild(style);
    }

    /** Regole `@font-face`: una per ogni sorgente di `ContestoSito.config.fonts.fontFaces` — di
     *  sistema o custom, stesso endpoint per entrambi (`SystemFont`/`CustomFontDef`, uniformato
     *  in `resolveFonts()`), nessuna distinzione qui — dato puro, identico client e server. */
    private static _buildFontFaceRules(): string {
        return ContestoSito.config.fonts.fontFaces
            .map(f => `@font-face{font-family:"${f.family}";src:url("${f.url}") format("${f.format}");font-weight:${f.weight};font-style:${f.style};font-display:swap;}`)
            .join('');
    }

    /** Un `[--fontFamily-<key>, valore]` per ogni `addonFonts` registrato — raggiungibile da SCSS
     *  di progetto indipendentemente da quale sia il font attivo (vedi `ResolvedFonts.customFontVars`). */
    private static _customFontVarEntries(): [string, string][] {
        return ContestoSito.config.fonts.customFontVars.map(v => [v.cssVar, `"${v.family}"`]);
    }

    // ── Theme HTML injection ──────────────────────────────────────────────

    // Cache di computePalette con chiave colorTema: evita di ricalcolare la costosa pipeline
    // OKLCH se buildThemeStyleTag/computePalette viene chiamato più volte con lo stesso brand
    // (comune in SSR dove molte route lo chiamano nella stessa sessione Node).
    private static readonly _paletteCache = new Map<string, PaletteTokens>();

    // Chiave di cache: colorTema + override serializzati (assenti = stringa vuota, invariata
    // quando PaletteOverrides non è passato).
    private static _paletteCacheKey(colorTema: string, overrides?: PaletteOverrides): string {
        return `${colorTema}|${overrides?.secondary ?? ''}|${overrides?.background ?? ''}|${overrides?.text ?? ''}|${overrides?.info ?? ''}`;
    }

    // Legge dalla cache o calcola e memorizza la palette per questo brand color + override.
    private static _getCachedPalette(colorTema: string, overrides?: PaletteOverrides): PaletteTokens {
        const key = AppearanceService._paletteCacheKey(colorTema, overrides);
        let p = AppearanceService._paletteCache.get(key);
        if (!p) {
            p = AppearanceService.computePalette(colorTema, overrides);
            AppearanceService._paletteCache.set(key, p);
        }
        return p;
    }

    /** Produce `<style id="theme-init">` da iniettare in `<head>` in SSR. `forcedTone`: da
     *  `ContestoSito.config.forceThemeTone` — se impostato, ignora `prefers-color-scheme` e si
     *  fissa su quel tono. `navSurface`: da `ContestoSito.config.navSurface` — vedi `_resolveNavColors`. */
    static buildThemeStyleTag(colorTema: string, overrides?: PaletteOverrides, forcedTone?: 'light' | 'dark' | null, navSurface: 'brand' | 'body' = 'brand'): string {
        return AppearanceService._buildThemeStyleTagFromPalette(AppearanceService._getCachedPalette(colorTema, overrides), forcedTone, navSurface);
    }

    /** Blocco `<style id="theme-init">` per l'HTML SSR: dopo il `<link>` Bootstrap, stessa specificità (0,1,0) ma posizione successiva → il nostro `:root` vince senza inline styles. I blocchi @media sono omessi se `forcedTone` è impostato (nessun cambio OS può sovrascrivere). @font-face vanno nello stesso tag, così `_ensureFontFaces` (client) lo trova pronto ed evita duplicati. */
    private static _buildThemeStyleTagFromPalette(p: PaletteTokens, forcedTone?: 'light' | 'dark' | null, navSurface: 'brand' | 'body' = 'brand'): string {
        const nav = AppearanceService._resolveNavColors(p, navSurface);

        const surfaces = (tone: 'light' | 'dark'): string => {
            const s = tone === 'light';
            const link = s ? p.colorLinkLt : p.colorLinkDk;
            return (
                // Link + focus ring tone-adaptive
                `--colorLink:${link};` +
                `--focusRingColor:${link};` +
                `--bs-link-color:${link};` +
                `--bs-link-color-rgb:${AppearanceService.hexToRgbTriplet(link)};` +
                `--bs-link-hover-color:${AppearanceService.mixHexColors(link, s ? '#000000' : '#ffffff', 0.15)};` +
                // Surfaces
                `--colorBase:${s ? p.colorBaseLt : p.colorBaseDk};` +
                `--colorSurface:${s ? p.colorSurfaceLt : p.colorSurfaceDk};` +
                `--colorSurfaceHover:${s ? p.colorSurfaceHoverLt : p.colorSurfaceHoverDk};` +
                `--colorSurfaceBorder:${s ? p.colorSurfaceBorderLt : p.colorSurfaceBorderDk};` +
                `--colorSurfaceText:${s ? p.colorSurfaceTextLt : p.colorSurfaceTextDk};` +
                // Semantic
                `--colorSecondary:${s ? p.colorSecondaryLt : p.colorSecondaryDk};` +
                `--colorSecondaryRgb:${AppearanceService.hexToRgbTriplet(s ? p.colorSecondaryLt : p.colorSecondaryDk)};` +
                `--colorSecondaryText:${s ? p.colorSecondaryTextLt : p.colorSecondaryTextDk};` +
                // Bootstrap
                `--bs-body-bg:${s ? p.colorBaseLt : p.colorBaseDk};` +
                `--bs-body-color:${s ? p.colorSurfaceTextLt : p.colorSurfaceTextDk};` +
                `--bs-body-color-rgb:${AppearanceService.hexToRgbTriplet(s ? p.colorSurfaceTextLt : p.colorSurfaceTextDk)};` +
                `--bs-border-color:${s ? p.colorSurfaceBorderLt : p.colorSurfaceBorderDk};` +
                `--bs-secondary:${s ? p.colorSecondaryLt : p.colorSecondaryDk};` +
                `color-scheme:${tone};` +
                // Expose lt/dk link vars per CSS subtheme overrides
                `--colorLinkLt:${p.colorLinkLt};` +
                `--colorLinkDk:${p.colorLinkDk};` +
                // Primary FOREGROUND tone-adaptive (disaccoppiato dal fill) — .text-primary/.border-primary
                // ≥4.8:1 sulla superficie estrema in entrambi i toni
                `--colorPrimaryFg:${s ? p.colorPrimaryFgLt : p.colorPrimaryFgDk};` +
                `--colorPrimaryFgRgb:${s ? p.colorPrimaryFgLtRgb : p.colorPrimaryFgDkRgb};` +
                // Primary FILL tone-adaptive — colorPrimary in light, colorPrimaryFillDk in dark
                // (schiarito per boundary ≥3.2:1). --bs-primary segue; il testo del fill anche.
                `--colorPrimary:${s ? p.colorPrimary : p.colorPrimaryFillDk};` +
                `--colorPrimaryRgb:${s ? p.colorPrimaryRgb : p.colorPrimaryFillDkRgb};` +
                `--colorPrimaryText:${s ? p.colorPrimaryText : p.colorPrimaryTextDk};` +
                `--bs-primary:${s ? p.colorPrimary : p.colorPrimaryFillDk};` +
                `--bs-primary-rgb:${s ? p.colorPrimaryRgb : p.colorPrimaryFillDkRgb};` +
                // RGB triplets semantici
                `--bs-secondary-rgb:${AppearanceService.hexToRgbTriplet(s ? p.colorSecondaryLt : p.colorSecondaryDk)};` +
                // Strutturali Bootstrap
                `--bs-emphasis-color:${s ? p.colorHeadingLt : p.colorHeadingDk};` +
                `--bs-emphasis-color-rgb:${AppearanceService.hexToRgbTriplet(s ? p.colorHeadingLt : p.colorHeadingDk)};` +
                `--bs-heading-color:${s ? p.colorHeadingLt : p.colorHeadingDk};` +
                `--bs-secondary-bg:${s ? p.colorMutedBgLt : p.colorMutedBgDk};` +
                `--bs-secondary-bg-rgb:${AppearanceService.hexToRgbTriplet(s ? p.colorMutedBgLt : p.colorMutedBgDk)};` +
                `--bs-tertiary-bg:${s ? p.colorSubtleBgLt : p.colorSubtleBgDk};` +
                `--bs-tertiary-bg-rgb:${AppearanceService.hexToRgbTriplet(s ? p.colorSubtleBgLt : p.colorSubtleBgDk)};` +
                `--bs-secondary-color:${s ? p.colorMutedTextLt : p.colorMutedTextDk};` +
                `--bs-secondary-color-rgb:${AppearanceService.hexToRgbTriplet(s ? p.colorMutedTextLt : p.colorMutedTextDk)};` +
                // Subtle/emphasis system
                `--bs-primary-bg-subtle:${s ? p.subtlePrimary.bgSubtleLt : p.subtlePrimary.bgSubtleDk};` +
                `--bs-primary-border-subtle:${s ? p.subtlePrimary.borderSubtleLt : p.subtlePrimary.borderSubtleDk};` +
                `--bs-primary-text-emphasis:${s ? p.subtlePrimary.textEmphasisLt : p.subtlePrimary.textEmphasisDk};` +
                `--bs-secondary-bg-subtle:${s ? p.subtleSecondary.bgSubtleLt : p.subtleSecondary.bgSubtleDk};` +
                `--bs-secondary-border-subtle:${s ? p.subtleSecondary.borderSubtleLt : p.subtleSecondary.borderSubtleDk};` +
                `--bs-secondary-text-emphasis:${s ? p.subtleSecondary.textEmphasisLt : p.subtleSecondary.textEmphasisDk};` +
                `--colorHeading:${s ? p.colorHeadingLt : p.colorHeadingDk};` +
                `--colorHeadingRgb:${AppearanceService.hexToRgbTriplet(s ? p.colorHeadingLt : p.colorHeadingDk)};` +
                `--colorMutedBg:${s ? p.colorMutedBgLt : p.colorMutedBgDk};` +
                `--colorSubtleBg:${s ? p.colorSubtleBgLt : p.colorSubtleBgDk};` +
                `--colorMutedText:${s ? p.colorMutedTextLt : p.colorMutedTextDk};` +
                `--colorPrimaryBgSubtle:${s ? p.subtlePrimary.bgSubtleLt : p.subtlePrimary.bgSubtleDk};` +
                `--colorPrimaryBorderSubtle:${s ? p.subtlePrimary.borderSubtleLt : p.subtlePrimary.borderSubtleDk};` +
                `--colorPrimaryTextEmphasis:${s ? p.subtlePrimary.textEmphasisLt : p.subtlePrimary.textEmphasisDk};` +
                `--colorSecondaryBgSubtle:${s ? p.subtleSecondary.bgSubtleLt : p.subtleSecondary.bgSubtleDk};` +
                `--colorSecondaryBorderSubtle:${s ? p.subtleSecondary.borderSubtleLt : p.subtleSecondary.borderSubtleDk};` +
                `--colorSecondaryTextEmphasis:${s ? p.subtleSecondary.textEmphasisLt : p.subtleSecondary.textEmphasisDk};` +
                `--colorNavBg:${s ? nav.navBgLt : nav.navBgDk};` +
                `--colorNavText:${s ? nav.navTextLt : nav.navTextDk};` +
                `--colorNavBorder:${s ? nav.navBorderLt : nav.navBorderDk};` +
                // Info — SOLO se PaletteOverrides.info era presente (vedi PaletteTokens/_applyPalette).
                // Assente: stringa vuota, --bs-info* resta gestito per intero da Bootstrap.
                (p.colorInfoLt !== undefined && p.colorInfoDk !== undefined && p.subtleInfo
                    ? `--bs-info:${s ? p.colorInfoLt : p.colorInfoDk};` +
                      `--bs-info-rgb:${AppearanceService.hexToRgbTriplet(s ? p.colorInfoLt : p.colorInfoDk)};` +
                      `--colorInfoText:${s ? p.colorInfoTextLt : p.colorInfoTextDk};` +
                      `--bs-info-bg-subtle:${s ? p.subtleInfo.bgSubtleLt : p.subtleInfo.bgSubtleDk};` +
                      `--bs-info-border-subtle:${s ? p.subtleInfo.borderSubtleLt : p.subtleInfo.borderSubtleDk};` +
                      `--bs-info-text-emphasis:${s ? p.subtleInfo.textEmphasisLt : p.subtleInfo.textEmphasisDk};`
                    : '') +
                // customPalette — stesso schema --colorSecondary sopra, una coppia per voce.
                Object.entries(p.customPalette).map(([label, colors]) => {
                    const cssLabel = toPascalCaseLabel(label);
                    return `--color${cssLabel}:${s ? colors.lt : colors.dk};` +
                        `--color${cssLabel}Text:${s ? colors.ltText : colors.dkText};`;
                }).join('')
            );
        };

        const fontFamily = ContestoSito.config.fonts.webStack;
        const base =
            `--fontFamily:${fontFamily};` +
            `--bs-body-font-family:${fontFamily};` +
            AppearanceService._customFontVarEntries().map(([k, v]) => `${k}:${v};`).join('') +
            `--colorTema:${p.colorTema};` +
            `--colorTemaText:${p.colorTemaText};` +
            // (--colorPrimary/--colorPrimaryText/--bs-primary sono tone-adaptive in surfaces())
            // Varianti fisse Lt/Dk del primary FILL — per il ponte CSS subtheme in base.scss
            `--colorPrimaryLt:${p.colorPrimary};` +
            `--colorPrimaryRgbLt:${p.colorPrimaryRgb};` +
            `--colorPrimaryTextLt:${p.colorPrimaryText};` +
            `--colorPrimaryDk:${p.colorPrimaryFillDk};` +
            `--colorPrimaryRgbDk:${p.colorPrimaryFillDkRgb};` +
            `--colorPrimaryTextDk:${p.colorPrimaryTextDk};` +
            // Varianti fisse Lt/Dk del primary FOREGROUND — per il ponte CSS subtheme in base.scss
            `--colorPrimaryFgLt:${p.colorPrimaryFgLt};` +
            `--colorPrimaryFgRgbLt:${p.colorPrimaryFgLtRgb};` +
            `--colorPrimaryFgDk:${p.colorPrimaryFgDk};` +
            `--colorPrimaryFgRgbDk:${p.colorPrimaryFgDkRgb};` +
            // Varianti Lt/Dk fisse — per il ponte CSS subtheme in base.scss
            `--colorHeadingLt:${p.colorHeadingLt};` +
            `--colorHeadingDk:${p.colorHeadingDk};` +
            `--colorHeadingRgbLt:${AppearanceService.hexToRgbTriplet(p.colorHeadingLt)};` +
            `--colorHeadingRgbDk:${AppearanceService.hexToRgbTriplet(p.colorHeadingDk)};` +
            `--colorSurfaceTextLt:${p.colorSurfaceTextLt};` +
            `--colorSurfaceTextDk:${p.colorSurfaceTextDk};` +
            `--colorSurfaceTextRgbLt:${AppearanceService.hexToRgbTriplet(p.colorSurfaceTextLt)};` +
            `--colorSurfaceTextRgbDk:${AppearanceService.hexToRgbTriplet(p.colorSurfaceTextDk)};` +
            `--colorBaseLt:${p.colorBaseLt};` +
            `--colorBaseDk:${p.colorBaseDk};` +
            `--colorSurfaceBorderLt:${p.colorSurfaceBorderLt};` +
            `--colorSurfaceBorderDk:${p.colorSurfaceBorderDk};` +
            `--colorMutedBgLt:${p.colorMutedBgLt};` +
            `--colorMutedBgDk:${p.colorMutedBgDk};` +
            `--colorSubtleBgLt:${p.colorSubtleBgLt};` +
            `--colorSubtleBgDk:${p.colorSubtleBgDk};` +
            `--colorMutedTextLt:${p.colorMutedTextLt};` +
            `--colorMutedTextDk:${p.colorMutedTextDk};` +
            `--colorSecondaryLt:${p.colorSecondaryLt};` +
            `--colorSecondaryDk:${p.colorSecondaryDk};` +
            `--colorSecondaryRgbLt:${AppearanceService.hexToRgbTriplet(p.colorSecondaryLt)};` +
            `--colorSecondaryRgbDk:${AppearanceService.hexToRgbTriplet(p.colorSecondaryDk)};` +
            `--colorSecondaryTextLt:${p.colorSecondaryTextLt};` +
            `--colorSecondaryTextDk:${p.colorSecondaryTextDk};` +
            // Varianti fisse Lt/Dk del subtle/emphasis system — stesso motivo di colorSecondaryLt/Dk sopra.
            `--colorPrimaryBgSubtleLt:${p.subtlePrimary.bgSubtleLt};` +
            `--colorPrimaryBgSubtleDk:${p.subtlePrimary.bgSubtleDk};` +
            `--colorPrimaryBorderSubtleLt:${p.subtlePrimary.borderSubtleLt};` +
            `--colorPrimaryBorderSubtleDk:${p.subtlePrimary.borderSubtleDk};` +
            `--colorPrimaryTextEmphasisLt:${p.subtlePrimary.textEmphasisLt};` +
            `--colorPrimaryTextEmphasisDk:${p.subtlePrimary.textEmphasisDk};` +
            `--colorSecondaryBgSubtleLt:${p.subtleSecondary.bgSubtleLt};` +
            `--colorSecondaryBgSubtleDk:${p.subtleSecondary.bgSubtleDk};` +
            `--colorSecondaryBorderSubtleLt:${p.subtleSecondary.borderSubtleLt};` +
            `--colorSecondaryBorderSubtleDk:${p.subtleSecondary.borderSubtleDk};` +
            `--colorSecondaryTextEmphasisLt:${p.subtleSecondary.textEmphasisLt};` +
            `--colorSecondaryTextEmphasisDk:${p.subtleSecondary.textEmphasisDk};` +
            `--colorNavBgLt:${nav.navBgLt};` +
            `--colorNavBgDk:${nav.navBgDk};` +
            `--colorNavTextLt:${nav.navTextLt};` +
            `--colorNavTextDk:${nav.navTextDk};` +
            `--colorNavBorderLt:${nav.navBorderLt};` +
            `--colorNavBorderDk:${nav.navBorderDk};` +
            STATIC_DESIGN_VARS.map(([k, v]) => `${k}:${v};`).join('');

        return (
            `<style id="theme-init">` +
            (ContestoSito.config.fonts.fontFaces.length ? AppearanceService._buildFontFaceRules() : '') +
            `:root{${base}${surfaces(forcedTone ?? p.naturalTone)}}` +
            (forcedTone
                ? ''
                : `@media(prefers-color-scheme:light){:root{${surfaces('light')}}}` +
                  `@media(prefers-color-scheme:dark){:root{${surfaces('dark')}}}`) +
            `</style>`
        );
    }

    // ── Static palette computation ────────────────────────────────────────

    /**
     * Target di contrasto per i foreground testuali derivati (link, secondary, muted, primary-fg):
     * 4.8:1, un margine sopra il minimo WCAG AA (4.5:1) per una lettura più confortevole e robusta
     * agli arrotondamenti dell'audit. Fonte unica usata da `computePalette` e `computeColorPrimaryFgDk`.
     */
    private static readonly TARGET_TEXT_CONTRAST = 4.8;

    /** Target contrasto NON-testo del boundary fill primary contro lo sfondo: 3.2:1 (sopra il minimo WCAG 1.4.11 3:1). Usato in dark da `computeColorPrimaryFillDk` (brand quasi-neri sarebbero altrimenti ~1:1, invisibili). */
    private static readonly TARGET_FILL_BOUNDARY = 3.2;

    /**
     * Calcola l'intera `PaletteTokens` dal solo colore brand.
     * Ogni token è derivato matematicamente in OKLCH: nessun valore hardcoded
     * ad eccezione delle costanti di luminosità (L) che definiscono la struttura Bootstrap.
     */
    static computePalette(colorTema: string, overrides?: PaletteOverrides): PaletteTokens {
        const [, C_t, H_t] = AppearanceService.hexToOklch(colorTema);
        const colorTemaText = AppearanceService.getReadableTextColor(colorTema);
        const naturalTone = AppearanceService.computeThemeTone(colorTema);

        // Hue/chroma di sfondo: dall'override se presente, altrimenti dal brand — un solo hex
        // alimenta comunque entrambi i toni, come C_t/H_t per colorTema.
        const chFor = (hex?: string): [number, number] => {
            if (!hex) return [C_t, H_t];
            const [, c, h] = AppearanceService.hexToOklch(hex);
            return [c, h];
        };
        const [C_bg, H_bg] = chFor(overrides?.background);
        // Testo: se overrides.text è presente resta un override pieno (stessa pipeline, contrasto
        // garantito uguale). Assente, il default non è più il brand ma lo sfondo (C_bg/H_bg): testo
        // e sfondo restano sempre intonati di default, invece di poter divergere senza che nessuno lo scelga.
        const [C_txt, H_txt] = overrides?.text ? chFor(overrides.text) : [C_bg, H_bg];

        // I tetti di chroma delle superfici (Math.min(C*fattore, tetto)) sono tarati per il brand
        // derivato automaticamente: con un override esplicito il tetto vincerebbe quasi sempre e il
        // risultato sarebbe identico a prescindere dalla tinta. bgBoost/txtBoost moltiplicano il
        // risultato GIÀ clampato (min(a,b)*k = min(a*k,b*k)) solo quando la tinta viene da un
        // override; il caso derivato dal brand resta bit-a-bit invariato. 16 è tarato empiricamente
        // (tinta riconoscibile ma non un blocco di colore pieno, verificato anche a saturazione piena
        // #ff0000/#00ff00). Il contrasto resta garantito a prescindere: findCompliantColor lo calcola
        // sempre contro la superficie reale risultante.
        const OVERRIDE_CHROMA_BOOST = 16;
        const vividness = Math.max(0, Math.min(1, overrides?.backgroundVividness ?? 0));
        const bgBoost = (overrides?.background || vividness > 0) ? OVERRIDE_CHROMA_BOOST : 1;
        const txtBoost = overrides?.text ? OVERRIDE_CHROMA_BOOST : 1;
        const [L_bg] = AppearanceService.hexToOklch(overrides?.background ?? colorTema);
        // `L_t` (sempre il brand, mai `background`) alza solo la lucentezza della navbar, mai la
        // chroma (il tetto di colorNavBg* non è tarato per il boost x16, saturerebbe troppo).
        const [L_t] = AppearanceService.hexToOklch(colorTema);
        const liftBg = (defaultL: number): number => defaultL + (L_bg - defaultL) * vividness;
        const liftNav = (defaultL: number): number => defaultL + (L_t - defaultL) * vividness;

        const separaFattore = Math.max(0, overrides?.separazioneSuperficiFattore ?? 1);
        const separaLt = (defaultL: number): number => 0.970 + (defaultL - 0.970) * separaFattore;
        const separaDk = (defaultL: number): number => 0.140 + (defaultL - 0.140) * separaFattore;

        // Sfondo base precomputato — serve come riferimento per i check di contrasto
        // dei colori semantici (findCompliantColor li usa per garantire WCAG 4.5:1).
        // Segue l'override background se presente. Non passa da separaLt/separaDk: è l'ANCORA,
        // lo scarto da se stesso è sempre 0 qualunque sia separazioneSuperficiFattore.
        const baseLtHex = AppearanceService.computeBaseLt(C_bg, H_bg, bgBoost, liftBg(0.970));
        const baseDkHex = AppearanceService.computeBaseDk(C_bg, H_bg, bgBoost, liftBg(0.140));

        // Superfici precomputate qui (dipendono solo da C_bg/H_bg): riferimenti di contrasto per i
        // foreground derivati (link/secondary/muted/primary-fg).
        // tertiary-bg (--bs-tertiary-bg): table-striped alternato, placeholder.
        const colorSubtleBgLt = AppearanceService.oklchToHex(liftBg(separaLt(0.967)), Math.min(C_bg * 0.05, 0.007) * bgBoost, H_bg);
        const colorSubtleBgDk = AppearanceService.oklchToHex(liftBg(separaDk(0.248)), Math.min(C_bg * 0.20, 0.025) * bgBoost, H_bg);
        // secondary-bg (--bs-secondary-bg): disabled inputs, table-striped. Superficie più ESTREMA su
        // cui i foreground possono comparire in entrambi i toni (light L=0.942 più scura di tutte le
        // altre, dark L=0.295 più chiara di tutte le altre): tararli contro questa garantisce il
        // target a fortiori sulle altre. Con `backgroundVividness` > 0, liftBg alza ogni L della
        // stessa proporzione, quindi l'ordine relativo resta identico qualunque sia la vividness
        // applicata a tutte — i margini fra superfici si stringono man mano che vividness cresce, ma
        // il testo sopra resta comunque garantito WCAG perché calcolato contro la superficie reale.
        const colorMutedBgLt = AppearanceService.computeMutedBgLt(C_bg, H_bg, bgBoost, liftBg(separaLt(0.942)));
        const colorMutedBgDk = AppearanceService.computeMutedBgDk(C_bg, H_bg, bgBoost, liftBg(separaDk(0.295)));

        // Primary: fill/foreground tarati esplicitamente sulle superfici REALI appena calcolate
        // (già bg-aware) invece di ri-derivarle internamente dal solo brand — altrimenti, con un
        // background overridden, il contrasto verrebbe garantito contro una superficie diversa
        // da quella che l'utente vede davvero.
        const colorPrimary = AppearanceService.computeColorPrimary(colorTema, baseLtHex);
        const colorPrimaryRgb = AppearanceService.hexToRgbTriplet(colorPrimary);
        const colorPrimaryFgDk = AppearanceService.computeColorPrimaryFgDk(colorTema, colorMutedBgDk);
        const colorPrimaryFgDkRgb = AppearanceService.hexToRgbTriplet(colorPrimaryFgDk);
        const colorPrimaryFgLt = AppearanceService.computeColorPrimaryFgLt(colorTema, colorMutedBgLt);
        const colorPrimaryFgLtRgb = AppearanceService.hexToRgbTriplet(colorPrimaryFgLt);
        const colorPrimaryFillDk = AppearanceService.computeColorPrimaryFillDk(colorPrimary, baseDkHex);
        const colorPrimaryFillDkRgb = AppearanceService.hexToRgbTriplet(colorPrimaryFillDk);
        const colorPrimaryText = AppearanceService.getReadableTextColor(colorPrimary);
        const colorPrimaryTextDk = AppearanceService.getReadableTextColor(colorPrimaryFillDk);

        // Target di contrasto per i foreground testuali: 4.8:1, sopra il minimo WCAG AA (4.5:1).
        // Il margine evita di "passare per il rotto della cuffia" (token al limite a 4.50) e dà una
        // lettura più confortevole; findCompliantColor ripiega comunque su nero/bianco se serve,
        // quindi alzare il target non scende MAI sotto AA. Verificato: 0 perdita di tinta brand.
        const TARGET_TEXT = AppearanceService.TARGET_TEXT_CONTRAST;

        // Link Lt/Dk: hue del BRAND (il link è un'affordance di brand, non di sfondo/testo), L
        // cercata finché ≥ TARGET_TEXT sulla superficie più
        // estrema (secondary-bg), così il link resta leggibile su ogni superficie/componente.
        // Chroma minima 0.08 per una tinta riconoscibile anche su brand grigi.
        const colorLinkLt = AppearanceService.findCompliantColor(
            Math.max(C_t, 0.08), H_t, colorMutedBgLt, TARGET_TEXT, 0.55, -0.01
        );
        const colorLinkDk = AppearanceService.findCompliantColor(
            Math.max(C_t, 0.08), H_t, colorMutedBgDk, TARGET_TEXT, 0.55, +0.01
        );

        // Secondary: hue/chroma indipendenti se overrides.secondary è presente, altrimenti C più
        // bassa del brand — è una variante muted, non un accento.
        let C_sec: number, H_sec: number;
        let secLt: string, secDk: string;
        if (overrides?.secondary) {
            // Override "duro": il design system vince letteralmente, in entrambi i toni — nessuna
            // ricerca di contrasto (a differenza del ramo sotto). Un design system che sa cosa vuole
            // può quindi imporre esattamente quel fill anche se non è conforme WCAG: se il risultato
            // non è leggibile è una scelta visibile e reversibile di chi l'ha impostata, non un bug
            // dell'engine — vedi il commento su `PaletteOverrides.secondary`.
            const [, c, h] = AppearanceService.hexToOklch(overrides.secondary);
            C_sec = c; H_sec = h;
            secLt = overrides.secondary;
            secDk = overrides.secondary;
        } else {
            // Nessun override: variante muted del brand, garanzia WCAG sia come TESTO sulla
            // superficie muted sia come FILL contro lo sfondo reale (colorBaseLt/Dk, sotto) — senza
            // questo secondo vincolo, backgroundVividness alto può avvicinare lo sfondo alla stessa
            // hue del secondary fino a farlo scomparire come blocco, pur restando leggibile come
            // testo (regressione coperta da example.design-system.spec.ts, Muro a vividness:1).
            // mutezzaSecondarioFattore: 0.75 default (invariato se non si tocca DesignSystemPreset).
            C_sec = Math.min(C_t * (overrides?.mutezzaSecondarioFattore ?? 0.75), 0.12);
            H_sec = H_t;
            ({ lt: secLt, dk: secDk } = AppearanceService.computeAccentPair(C_sec, H_sec, colorMutedBgLt, colorMutedBgDk, baseLtHex, baseDkHex, 0.72, 0.55));
        }

        // customPalette: una coppia fill/testo per etichetta, stessa pipeline di secondary sopra —
        // ogni voce è già un hex esplicito (mai "derivato dal brand" implicitamente, a differenza
        // del ramo senza override di secondary: un colore con nome proprio è sempre una scelta
        // esplicita del design system).
        const customPalette: PaletteTokens['customPalette'] = {};
        for (const [label, hex] of Object.entries(overrides?.customPalette ?? {})) {
            // Override "duro" come colorSecondary sopra: un colore con nome proprio è sempre una
            // scelta esplicita del design system, quindi vince com'è scritto — nessuna ricerca di
            // contrasto sul fill, solo il testo leggibile sopra (senza quello sarebbe invisibile,
            // non solo fuori standard).
            customPalette[label] = {
                lt: hex, ltText: AppearanceService.getReadableTextColor(hex),
                dk: hex, dkText: AppearanceService.getReadableTextColor(hex),
            };
        }

        // ── Subtle/emphasis system ─────────────────────────────────────────
        const [, C_p, H_p] = AppearanceService.hexToOklch(colorPrimary);
        const subtlePrimary = AppearanceService.computeSemanticSubtle(C_p, H_p);
        const subtleSecondary = AppearanceService.computeSemanticSubtle(C_sec, H_sec);

        // Info: SOLO se overrides.info è presente — stessa pipeline di secondary (findCompliantColor
        // con fallback bianco/nero, poi subtle/emphasis), ma senza fallback derivato dal brand: quando
        // assente questi token restano undefined e _applyPalette/_buildThemeStyleTagFromPalette non
        // toccano --bs-info*, che resta gestito per intero da Bootstrap.
        let colorInfoLt: string | undefined;
        let colorInfoDk: string | undefined;
        let colorInfoTextLt: '#000000' | '#ffffff' | undefined;
        let colorInfoTextDk: '#000000' | '#ffffff' | undefined;
        let subtleInfo: SemanticSubtleTokens | undefined;
        if (overrides?.info) {
            // Override "duro" come colorSecondary sopra: nessuna ricerca di contrasto, il colore
            // scelto vince com'è scritto in entrambi i toni.
            const [, C_info, H_info] = AppearanceService.hexToOklch(overrides.info);
            colorInfoLt = overrides.info;
            colorInfoDk = overrides.info;
            colorInfoTextLt = AppearanceService.getReadableTextColor(colorInfoLt);
            colorInfoTextDk = AppearanceService.getReadableTextColor(colorInfoDk);
            subtleInfo = AppearanceService.computeSemanticSubtle(C_info, H_info);
        }


        // ── Structural Bootstrap vars ──────────────────────────────────────
        // emphasis: headings/strong — quasi nero/bianco con leggera tinta testo (segue l'override testo)
        const colorHeadingLt = AppearanceService.oklchToHex(0.165, Math.min(C_txt * 0.14, 0.020) * txtBoost, H_txt);
        const colorHeadingDk = AppearanceService.oklchToHex(0.958, Math.min(C_txt * 0.04, 0.006) * txtBoost, H_txt);
        // (colorMutedBgLt/Dk — secondary-bg — sono precomputati sopra: servono come
        //  riferimento di contrasto estremo per i foreground oltre che come token nel return.)
        // secondary-color: testo muted, TARGET_TEXT (4.8:1) garantito contro la superficie più
        // estrema (secondary-bg) — così vale anche sulle altre superfici dove il muted compare
        // (card, righe alternate, input disabilitati). Era il token che l'audit segnalava al limite (4.49:1).
        const colorSurfaceDkHex = AppearanceService.oklchToHex(liftBg(separaDk(0.180)), Math.min(C_bg * 0.12, 0.014) * bgBoost, H_bg);
        const colorMutedTextLt = AppearanceService.findCompliantColor(Math.min(C_txt * 0.08, 0.012) * txtBoost, H_txt, colorMutedBgLt, TARGET_TEXT, 0.65, -0.01);
        const colorMutedTextDk = AppearanceService.findCompliantColor(Math.min(C_txt * 0.08, 0.012) * txtBoost, H_txt, colorMutedBgDk, TARGET_TEXT, 0.45, +0.01);

        // Adaptive Navbar/Footer colors (NavBg / NavText) — restano legati al BRAND (C_t/H_t), non
        // a background/testo: la navbar è pensata come superficie immersiva di brand, non di contenuto.
        let colorNavBgLt: string;
        let colorNavTextLt: string;
        if (colorTemaText === '#ffffff') {
            // Brand color is dark and supports white text beautifully.
            // We use the brand color directly for a very immersive branded look.
            colorNavBgLt = colorTema;
            colorNavTextLt = '#ffffff';
        } else {
            // Brand color is light/vibrant (like pure red, yellow, neon).
            // A solid background would force dark text and look extremely aggressive.
            // Instead, we use an elegant, soft off-white/pastel version of the brand color,
            // with a dark brand-tinted text.
            colorNavBgLt = AppearanceService.oklchToHex(liftNav(0.965), Math.min(C_t * 0.20, 0.020), H_t);
            colorNavTextLt = AppearanceService.oklchToHex(0.200, Math.min(C_t * 0.40, 0.040), H_t);
        }

        // In dark mode, we always want a very dark background to respect the dark theme,
        // but elegantly tinted with the brand color. `liftNav`: la navbar resta legata al brand
        // (mai a `background`), quindi il target del lift è sempre colorTema, non C_bg/H_bg.
        const colorNavBgDk = AppearanceService.oklchToHex(liftNav(0.150), Math.min(C_t * 0.25, 0.030), H_t);
        const colorNavTextDk = AppearanceService.oklchToHex(0.920, Math.min(C_t * 0.06, 0.010), H_t);

        const colorNavBorderLt = AppearanceService.mixHexColors(colorNavBgLt, colorNavTextLt, 0.15);
        const colorNavBorderDk = AppearanceService.mixHexColors(colorNavBgDk, colorNavTextDk, 0.15);

        const tokens: PaletteTokens = {
            colorTema,
            colorTemaText,
            colorPrimary,
            colorPrimaryRgb,
            colorPrimaryFgDk,
            colorPrimaryFgDkRgb,
            colorPrimaryFgLt,
            colorPrimaryFgLtRgb,
            colorPrimaryFillDk,
            colorPrimaryFillDkRgb,
            colorPrimaryTextDk,
            colorPrimaryText,
            colorLinkLt,
            colorLinkDk,

            // Light surfaces — high L, low chroma, background hue (testo: text hue).
            // Border L=0.570: caso peggiore vs la superficie più SCURA (secondary-bg L=0.942)
            // → ≈ 3.75:1 (WCAG 1.4.11 ≥ 3:1); a fortiori su base/surface/hover/tertiary.
            colorBaseLt: baseLtHex,
            colorSurfaceLt: AppearanceService.oklchToHex(liftBg(separaLt(0.985)), Math.min(C_bg * 0.02, 0.003) * bgBoost, H_bg),
            colorSurfaceHoverLt: AppearanceService.oklchToHex(liftBg(separaLt(0.950)), Math.min(C_bg * 0.04, 0.006) * bgBoost, H_bg),
            // NON separaLt: ancorato a un minimo di contrasto WCAG 1.4.11, non una scelta di stile.
            colorSurfaceBorderLt: AppearanceService.oklchToHex(liftBg(0.570), 0, 0),
            colorSurfaceTextLt: AppearanceService.oklchToHex(0.200, Math.min(C_txt * 0.20, 0.030) * txtBoost, H_txt),

            // Dark surfaces — low L, moderate chroma, background hue (testo: text hue).
            // Border L=0.600: più basso (es. ~0.490) fa cadere il contrasto sotto 3:1 su tutte le
            // superfici tranne base. A 0.600 il caso peggiore (vs secondary-bg) è ≈3.47:1, sopra il
            // minimo WCAG 1.4.11. Con backgroundVividness > 0 anche i bordi si alzano (liftBg): il
            // margine si restringe ma non si azzera finché vividness < 1.
            colorBaseDk: baseDkHex,
            colorSurfaceDk: colorSurfaceDkHex,
            colorSurfaceHoverDk: AppearanceService.oklchToHex(liftBg(separaDk(0.220)), Math.min(C_bg * 0.10, 0.012) * bgBoost, H_bg),
            // NON separaDk: ancorato a un minimo di contrasto WCAG 1.4.11, non una scelta di stile.
            colorSurfaceBorderDk: AppearanceService.oklchToHex(liftBg(0.600), 0, 0),
            colorSurfaceTextDk: AppearanceService.oklchToHex(0.920, Math.min(C_txt * 0.06, 0.010) * txtBoost, H_txt),

            // Semantic light
            colorSecondaryLt: secLt, colorSecondaryTextLt: AppearanceService.getReadableTextColor(secLt),

            // Semantic dark
            colorSecondaryDk: secDk, colorSecondaryTextDk: AppearanceService.getReadableTextColor(secDk),

            subtlePrimary, subtleSecondary,
            colorInfoLt, colorInfoDk, colorInfoTextLt, colorInfoTextDk, subtleInfo,
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
            customPalette,
        };

        // Un override "duro" non passa dalla ricerca di contrasto automatica e può collassare sulla
        // superficie circostante (il testo sopra resta comunque garantito). auditPaletteContrast
        // copre questo buco: solo un warning in dev-mode, mai un blocco — il design system resta
        // libero di scegliere, ma lo scopre subito invece che a occhio.
        if (isDevMode()) {
            for (const message of AppearanceService.auditPaletteContrast(tokens)) {
                console.warn(`[AppearanceService] ${message}`);
            }
        }

        return tokens;
    }

    /** WCAG 1.4.11 (≥3:1): un fill (secondario/info/customPalette) deve restare distinguibile dalla superficie su cui si appoggia, non solo avere testo leggibile sopra (già coperto da `getReadableTextColor`). Rete di sicurezza per gli override "duri": solo segnalazione, mai correzione silenziosa. Pura e statica, stesso calcolo usato da `computePalette` e da `design-system-presets.spec.ts`. */
    static auditPaletteContrast(tokens: PaletteTokens): string[] {
        const MIN_UI_CONTRAST = 3.0;
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
        if (tokens.colorInfoLt !== undefined && tokens.colorInfoDk !== undefined) {
            checkFill('colorInfo', tokens.colorInfoLt, tokens.colorInfoDk);
        }
        for (const [label, colors] of Object.entries(tokens.customPalette)) {
            checkFill(`customPalette.${label}`, colors.lt, colors.dk);
        }

        return messages;
    }

    /** Sfondo pagina chiaro reale (L=0.970, chroma minima): riferimento di contrasto per i token testuali (colorPrimary, colorLink, mutedText). Fonte unica, usata sia da `computePalette` sia da `computeColorPrimary` così tarano sullo stesso fondo. */
    private static computeBaseLt(C: number, H: number, boost = 1, liftedL = 0.970): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.03, 0.004) * boost, H);
    }

    /** Gemello scuro di `computeBaseLt` (L=0.140): riferimento di contrasto per il boundary del FILL primary in dark (`colorPrimaryFillDk`). I foreground dark si tarano invece su `mutedBgDk`, non sulla base. */
    private static computeBaseDk(C: number, H: number, boost = 1, liftedL = 0.140): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.08, 0.010) * boost, H);
    }

    /** Superficie più ESTREMA su cui un foreground può comparire (`--bs-secondary-bg`): riferimento worst-case, garantendo il target qui lo si ottiene a fortiori sulle altre. Usata da `computePalette` e dai `computeColorPrimaryFg*`. */
    private static computeMutedBgLt(C: number, H: number, boost = 1, liftedL = 0.942): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.08, 0.011) * boost, H);
    }
    private static computeMutedBgDk(C: number, H: number, boost = 1, liftedL = 0.295): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.18, 0.022) * boost, H);
    }

    // Calcola le 3 varianti subtle/emphasis per un colore semantico dato C e H OKLCH.
    // bg-subtle: sfondo pastello (L alto/basso, C molto bassa) per .alert-*, .bg-*-subtle
    // border-subtle: bordo intermedio per .alert-* border
    // text-emphasis: WCAG 4.5:1 su bg-subtle per .text-*-emphasis e testo in .alert-*
    private static computeSemanticSubtle(C: number, H: number): SemanticSubtleTokens {
        const bgSubtleLt = AppearanceService.oklchToHex(0.935, Math.min(C * 0.18, 0.030), H);
        const bgSubtleDk = AppearanceService.oklchToHex(0.175, Math.min(C * 0.30, 0.042), H);
        const borderSubtleLt = AppearanceService.oklchToHex(0.750, Math.min(C * 0.48, 0.082), H);
        const borderSubtleDk = AppearanceService.oklchToHex(0.385, Math.min(C * 0.58, 0.090), H);
        const textEmphasisLt = AppearanceService.findCompliantColor(Math.min(C, 0.18), H, bgSubtleLt, 4.5, 0.45, -0.01);
        const textEmphasisDk = AppearanceService.findCompliantColor(Math.min(C, 0.18), H, bgSubtleDk, 4.5, 0.62, +0.01);
        return { bgSubtleLt, bgSubtleDk, borderSubtleLt, borderSubtleDk, textEmphasisLt, textEmphasisDk };
    }

    /** Coppia fill/testo WCAG-safe (Lt/Dk) per il secondario auto-calcolato: leggibile come testo sulla superficie muted E distinguibile come fill dallo sfondo reale (vedi `findDualCompliantColor`). */
    private static computeAccentPair(
        C: number, H: number,
        mutedBgLt: string, mutedBgDk: string,
        baseBgLt: string, baseBgDk: string,
        startLt: number, startDk: number,
    ): { lt: string; ltText: '#000000' | '#ffffff'; dk: string; dkText: '#000000' | '#ffffff' } {
        const TARGET_TEXT = AppearanceService.TARGET_TEXT_CONTRAST;
        const MIN_UI_CONTRAST = 3.0;
        const lt = AppearanceService.findDualCompliantColor(C, H, mutedBgLt, TARGET_TEXT, baseBgLt, MIN_UI_CONTRAST, startLt, -0.01);
        const dk = AppearanceService.findDualCompliantColor(C, H, mutedBgDk, TARGET_TEXT, baseBgDk, MIN_UI_CONTRAST, startDk, +0.01);
        return {
            lt, ltText: AppearanceService.getReadableTextColor(lt),
            dk, dkText: AppearanceService.getReadableTextColor(dk),
        };
    }

    /** Come `findCompliantColor` ma su DUE sfondi contemporaneamente (testo su `bgMuted` E fill su `bgBase`, per non far scomparire il secondary se `backgroundVividness` avvicina lo sfondo alla sua hue). Se nessuna L soddisfa entrambi (caso limite): nero o bianco, quello col contrasto minimo più alto sui due PRESI INSIEME — non il migliore sul solo `bgMuted`, che vanificherebbe il vincolo. */
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

    // ── Metodi statici (SSR-safe) ───────────────────────────────────────────
    // API pubblica di calcolo colore, usata sia internamente (computePalette e la generazione
    // SSR dei tag <head>) sia direttamente dai consumer: pure, senza stato, chiamabili sia lato
    // server che client.

    /**
     * Variante del brand con contrasto WCAG 4.5:1 su `baseLt` (off-white L=0.970, NON bianco puro:
     * più scuro, abbassa il contrasto reale di ~0.4). Scurisce in OKLCH a hue/chroma invariati —
     * solo la luminanza scende, il minimo indispensabile: a differenza del mix con nero in RGB non
     * desatura (un brand chiaro resta vivo, non vira al grigio). Fallback `#1a1a1a` se nessuna L
     * conforme (hue al limite del gamut sRGB).
     * `baseLtHex`, se passato, sostituisce il calcolo interno — usato da `computePalette` per tarare
     * sulla superficie REALE quando `PaletteOverrides.background` è presente.
     */
    static computeColorPrimary(colorTema: string, baseLtHex?: string): string {
        const [L0, C, H] = AppearanceService.hexToOklch(colorTema);
        const bg = baseLtHex ?? AppearanceService.computeBaseLt(C, H);
        for (let L = L0; L >= 0.05; L -= 0.01) {
            const candidate = AppearanceService.oklchToHex(L, C, H);
            if (AppearanceService.calcContrastRatio(candidate, bg) >= 4.5) return candidate;
        }
        // Nessuna L raggiunge il target (bg con lucentezza vicina al brand, tipico con
        // backgroundVividness alto): stesso ripiego di findCompliantColor, massimo contrasto possibile.
        const fallback = AppearanceService.getReadableTextColor(bg);
        if (isDevMode()) {
            console.warn(`[AppearanceService] computeColorPrimary non converge a 4.5:1 (bg=${bg}) → ripiego su ${fallback}.`);
        }
        return fallback;
    }

    /**
     * Primary come FOREGROUND light (`.text-primary`/`.border-primary`): scurisce il brand in OKLCH
     * finché `TARGET_TEXT_CONTRAST` (4.8:1) su `mutedBgLt` (L=0.942) è garantito. Disaccoppiata dal
     * fill `colorPrimary` (tarato 4.5:1 su `baseLt`): il fill resta fedele, questo foreground vive
     * sulle superfici interne dove serve più contrasto (tararlo su `baseLt` come il fill lasciava
     * `.text-primary` a ~4.1:1 lì). Fallback `#1a1a1a`.
     * `mutedBgLtHex`, se passato, sostituisce il calcolo interno — usato da `computePalette` per `PaletteOverrides.background`.
     */
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

    /**
     * Primary come FILL dark (`--bs-primary`, `.btn-primary`/`.bg-primary`): il fill light è tarato
     * per il fondo chiaro, usato tale e quale su pagina scura un brand quasi-nero sparirebbe
     * (boundary ~1:1). Qui si SCHIARISCE in OKLCH finché soddisfa boundary `TARGET_FILL_BOUNDARY`
     * (3.2:1) vs `baseDk` E un testo leggibile (≥4.5:1) sopra. Brand già luminosi restano invariati.
     * `baseDkHex`, se passato, sostituisce il calcolo interno — usato da `computePalette` per `PaletteOverrides.background`.
     */
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

    /**
     * Gemella scura di `computeColorPrimary`: FOREGROUND (`.text-primary`/`.border-primary`) in dark,
     * schiarisce il brand in OKLCH finché `TARGET_TEXT_CONTRAST` (4.8:1) su `mutedBgDk` (L=0.295, non
     * la base pagina: su `baseDk` `.text-primary` cadeva a ~3.1:1). Foreground-only, mai il fill
     * `--bs-primary`. Fallback `#e6e6e6`.
     * `mutedBgDkHex`, se passato, sostituisce il calcolo interno — usato da `computePalette` per `PaletteOverrides.background`.
     */
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

    /** Restituisce la tripla `"r, g, b"` (es. `"31, 64, 255"`) per le utility `rgba()` di Bootstrap/CSS. */
    static hexToRgbTriplet(hexColor: string): string {
        const { r, g, b } = AppearanceService.hexToRgb(hexColor);
        return `${r}, ${g}, ${b}`;
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
