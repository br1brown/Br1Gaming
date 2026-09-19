import { isPlatformBrowser } from '@angular/common';
import { CSP_NONCE, Injectable, PLATFORM_ID, Signal, WritableSignal, afterNextRender, computed, inject, isDevMode, signal, DOCUMENT } from '@angular/core';
import { ContestoSito } from '../../../site';
import { toPascalCaseLabel, MOVIMENTO_DURATA, ELEVAZIONE_TIERS, HOVER_INTENSITY_TIERS, PULSAZIONE_TIERS, MUTEZZA_SECONDARIO_FATTORE, SEPARAZIONE_SUPERFICI_FATTORE } from '../design-system-presets';

/**
 * Coppie CSS custom property per i 4 assi "sensazione" del design system attivo (`movimento`/
 * `elevazione`/`hoverIntensity`/`pulsazioneAttiva`, `design-system-presets.ts`) — costante di
 * MODULO, non un metodo: a differenza della palette colore (tone-reattiva, ricalcolata ad ogni
 * cambio `prefers-color-scheme`), questi 4 assi dipendono SOLO da `ContestoSito.config`, fissa per
 * l'intero deployment — calcolarli una volta sola al load del modulo (server E client) invece che
 * ad ogni `_applyPalette`/render SSR evita lookup ripetuti su valori che non cambiano mai.
 * Condivisa fra `_applyPalette` (client) e `_buildThemeStyleTagFromPalette` (SSR) così le due
 * emissioni non possono divergere.
 */
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
    ];
})();

/**
 * Token subtle/emphasis generati da `computeSemanticSubtle` per un colore semantico.
 * Alimentano il sistema Bootstrap `.alert-*-subtle` / `.text-*-emphasis` / `.bg-*-subtle`.
 * Le varianti `Lt`/`Dk` sono pre-calcolate per entrambi i toni: `_applyPalette`
 * seleziona la coppia corretta in base al tone OS corrente.
 */
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

/**
 * Snapshot completo della palette calcolata da `computePalette` per un dato `colorTema`.
 * Tutti i valori sono esadecimali (`#rrggbb`) tranne `colorPrimaryRgb` (tripla `"r, g, b"`)
 * e `naturalTone`. Le varianti `Lt`/`Dk` sono pre-calcolate per entrambi i toni in un
 * unico passaggio: `_applyPalette` si limita a selezionare la coppia corretta senza
 * ricalcolare nulla a ogni cambio di tema.
 */
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
    /**
     * Gemella scura di `colorPrimary`: brand schiarito in OKLCH (hue e chroma preservate) finché il
     * contrasto 4.8:1 (sopra AA) sulla superficie più ESTREMA dark (`mutedBgDk`) è garantito. Usata per
     * il primary come FOREGROUND (testo `.text-primary`, bordo `.border-primary`) in dark mode, dove
     * `colorPrimary` — tarato per il fondo chiaro — risulterebbe scuro-su-scuro. CSS: `--colorPrimaryFgDk`
     */
    colorPrimaryFgDk: string;
    /** Tripla RGB di `colorPrimaryFgDk`, per le utility `rgba()` con opacity. CSS: `--colorPrimaryFgRgbDk` */
    colorPrimaryFgDkRgb: string;
    /**
     * Variante LIGHT del primary come FOREGROUND (testo `.text-primary`, bordo `.border-primary`):
     * brand scurito in OKLCH finché il contrasto 4.8:1 (sopra AA) sulla superficie più ESTREMA light
     * (`mutedBgLt`) è garantito. Disaccoppiata dal fill `colorPrimary` (`--bs-primary`), che resta il
     * colore brand fedele: il foreground vive sulle superfici, il fill ospita testo proprio. CSS: `--colorPrimaryFgLt`
     */
    colorPrimaryFgLt: string;
    /** Tripla RGB di `colorPrimaryFgLt`. CSS: `--colorPrimaryFgRgbLt` */
    colorPrimaryFgLtRgb: string;
    /**
     * Variante DARK del primary come FILL (`--bs-primary` in dark mode): `colorPrimary` schiarito quanto
     * basta per un boundary ≥3.2:1 sul fondo pagina scuro, così `.btn-primary`/`.bg-primary` resta
     * visibile anche con brand quasi-neri. Brand già luminosi: invariato. CSS: `--colorPrimaryDk` (fill)
     */
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
    /** Sfondo pagina light: quasi bianco con leggera tinta brand (L=0.970 di default — più basso,
     *  fino alla lucentezza reale del colore di sfondo, con `backgroundVividness` > 0, vedi
     *  `PaletteOverrides`). CSS: `--colorBaseLt` */
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
    /** Sfondo pagina dark: quasi nero con leggera tinta brand (L=0.140 di default — più alto, fino
     *  alla lucentezza reale del colore di sfondo, con `backgroundVividness` > 0, vedi
     *  `PaletteOverrides`). CSS: `--colorBaseDk` */
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
    /**
     * Sfondo navbar/footer light. Se `colorTemaText === '#ffffff'` (brand scuro): usa `colorTema` direttamente
     * per un look brand immersivo. Altrimenti versione pastello (L=0.965) per evitare colori aggressivi. CSS: `--colorNavBgLt`
     */
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

    /**
     * Tono suggerito dal brand: `'light'` se il brand è sufficientemente chiaro da richiedere testo scuro,
     * `'dark'` altrimenti. Usato come valore iniziale di `themeTone` in SSR (dove `prefers-color-scheme` non è disponibile).
     */
    naturalTone: 'light' | 'dark';

    /**
     * Colori con nome proprio risolti da `PaletteOverrides.customPalette` — chiave = la stessa
     * etichetta scelta dal design system (es. `'bordeaux'`), stessa pipeline WCAG di
     * `colorSecondary*` (fill conforme al contrasto target + testo leggibile sopra). `{}` se nessun
     * design system ne propone. CSS: `--color<Label>` (Pascal-case)/`--color<Label>Text`.
     */
    customPalette: Record<string, { lt: string; ltText: '#000000' | '#ffffff'; dk: string; dkText: '#000000' | '#ffffff' }>;
}

/**
 * Override opzionali per le catene di derivazione che possono avere una hue indipendente dal
 * brand: secondario, sfondo (superfici), testo e info. Due comportamenti diversi secondo il campo.
 * `background`/`text` sostituiscono hue e chroma SOLO per la propria catena — le varianti
 * light/dark restano comunque calcolate e garantite WCAG dalla stessa pipeline usata per
 * `colorTema`: sono famiglie di più superfici derivate (base/surface/hover/subtle/muted...), non
 * un singolo colore, quindi non hanno un equivalente "letterale" da imporre di peso.
 * `secondary`/`info`/ogni voce di `customPalette` sono invece override "duri": il fill finale
 * (light E dark) è ESATTAMENTE l'hex scritto, senza alcuna ricerca di contrasto — resta calcolato
 * solo il testo leggibile sopra (altrimenti sarebbe invisibile, non solo fuori standard). Un design
 * system vince quindi anche sulle garanzie WCAG dell'engine per questi tre campi: se il risultato
 * non è leggibile a sufficienza è una scelta visibile e reversibile di chi l'ha impostata, non un
 * bug dell'engine. Assente: ciascun campo ha un proprio fallback, calcolato come sempre con
 * garanzia WCAG — vedi il commento del singolo campo (`text` NON ricade sul brand ma su
 * `background`, `info` non ha alcun fallback).
 */
export interface PaletteOverrides {
    /**
     * Override "duro" di `colorSecondary*`: se presente, il fill finale è esattamente questo hex
     * in entrambi i toni, nessuna ricerca di contrasto — solo `subtleSecondary` resta derivato con
     * garanzia WCAG dalla stessa hue/chroma. Assente: muted del brand, calcolato come sempre con
     * garanzia WCAG.
     */
    secondary?: string;
    /**
     * Hue/chroma indipendenti per `colorBase*`/`colorSurface*`/`colorMutedBg*`/`colorSubtleBg*` —
     * famiglia di superfici derivate, sempre garantita WCAG (non un override "duro": non esiste un
     * solo hex che sia contemporaneamente base/surface/hover/subtle/muted).
     */
    background?: string;
    /**
     * Hue/chroma indipendenti per `colorSurfaceText*`/`colorHeading*`/`colorMutedText*` — stessa
     * natura di `background` sopra (famiglia derivata, sempre garantita WCAG). Assente: il testo
     * NON ricade sul brand ma segue `background` (che a sua volta è il brand se nemmeno quello è
     * overridden) — testo e sfondo restano sempre intonati di default, evitando due tinte
     * scollegate che nessuno ha scelto di proposito.
     */
    text?: string;
    /**
     * Override "duro" di `colorInfo*`, stessa natura di `secondary` sopra: se presente, il fill
     * finale è esattamente questo hex in entrambi i toni, nessuna ricerca di contrasto — solo
     * `subtleInfo` resta derivato con garanzia WCAG. A differenza degli altri campi, `info` non ha
     * un fallback derivato dal brand: assente, `computePalette` non produce alcun token
     * `colorInfo*` e Bootstrap 5.3 continua a gestire `--bs-info*` per intero coi suoi blocchi
     * `[data-bs-theme]` nativi.
     */
    info?: string;
    /**
     * Colori con nome proprio (da `DesignSystemPreset.customPalette`) — override "duro" come
     * `secondary`: ogni voce diventa il fill esatto (light E dark, nessuna ricerca di contrasto)
     * del token dinamico corrispondente (`--color<Label>`/`--color<Label>Text`, quest'ultimo
     * calcolato per restare leggibile sopra), invece dei nomi fissi `colorSecondary*`. Assente/
     * vuoto: nessun token in più, comportamento identico a prima dell'introduzione di questo campo.
     */
    customPalette?: Record<string, string>;
    /**
     * Quanto le superfici (`colorBase*`/`colorSurface*`/`colorMutedBg*`/`colorSubtleBg*`/
     * `colorNavBg*`) devono "somigliare" al colore che le governa (`background` se presente,
     * altrimenti il brand) invece che restare quasi neutre — 0 (default) = comportamento storico:
     * near-black/near-white con una tinta appena percettibile (stile "dark mode" di
     * GitHub/Discord/VS Code); 1 = la superficie usa la STESSA lucentezza (L, in OKLCH) del colore
     * di riferimento — uno sfondo che è visibilmente quel colore, non nero tinto (es. un sito con
     * un intero campo rosso acceso come sfondo, non un dark mode neutro). Valori intermedi
     * interpolano linearmente fra i due. Interpolare (non sostituire) preserva l'ORDINE relativo fra
     * le superfici della scala (base più scura di surface, più scura di hover, ecc. — nessuna può
     * mai superare le altre, qualunque sia il valore) — a costo di margini di contrasto FRA superfici
     * via via più stretti quanto più ci si avvicina a 1 (mai sotto WCAG: il testo sopra ciascuna
     * superficie resta calcolato con `findCompliantColor` contro la superficie REALE risultante, non
     * contro il valore storico). Assente/0: zero differenza per un design system che non lo imposta.
     */
    backgroundVividness?: number;
    /**
     * Fattore (0-1) che moltiplica il chroma OKLCH del `secondary` auto-calcolato dal brand —
     * SOLO se `secondary` sopra non è già un override "duro" (quello vince comunque per intero).
     * 1 (default) = comportamento storico. Da `DesignSystemPreset.mutezzaSecondario`
     * (`MUTEZZA_SECONDARIO_FATTORE`, `design-system-presets.ts`).
     */
    mutezzaSecondarioFattore?: number;
    /**
     * Fattore che scala lo SCARTO di lucentezza di ogni superficie di contenuto (subtle/muted/
     * surface/surfaceHover) dalla base — asse ORTOGONALE a `backgroundVividness` (che decide quanto
     * ci si avvicina al colore del BRAND, non quanto le superfici si distinguono FRA loro). Il
     * bordo (`colorSurfaceBorder*`) resta escluso: ancorato a un minimo WCAG 1.4.11, non una scelta
     * di stile. 1 (default) = scarti storici esatti. Da `DesignSystemPreset.separazioneSuperfici`
     * (`SEPARAZIONE_SUPERFICI_FATTORE`, `design-system-presets.ts`).
     */
    separazioneSuperficiFattore?: number;
}

/**
 * APPEARANCE SERVICE
 *
 * Unica fonte di verità per l'estetica del sito derivata dal design system attivo — non solo
 * colore, nonostante il nome storico (ThemeService) suggerisse altro:
 * - Palette calcolata una volta via OKLCH da ContestoSito.config.colorTema
 * - themeTone è un signal reattivo all'OS preference (prefers-color-scheme)
 * - movimento/elevazione/hoverIntensity/pulsazioneAttiva (STATIC_DESIGN_VARS, sopra) — CSS vars
 *   statiche per l'intero deployment, non legate al colore
 * - font-face self-hosted del font attivo e di ogni addonFonts registrato, di sistema o di progetto (_ensureFontFaces)
 * - _applyPalette inietta tutte queste CSS vars e attributi su <html> in modo sincrono; condivide
 *   lo stesso canale SSR (`_buildThemeStyleTagFromPalette`) con tutti e 3 gli assi sopra — motivo
 *   per cui restano in UNA classe invece di essere separati per argomento (ENGINE.md, sezione
 *   "Leve nominate del design system: risoluzione")
 *
 * Metodi statici (puri, usabili da Node/scripts di build):
 *   computePalette, hexToOklch, oklchToHex,
 *   computeThemeTone, computeColorPrimary, prefersDarkText,
 *   getReadableTextColor, mixHexColors, calcContrastRatio, ecc.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {

    // Colore brand — fisso per l'intera sessione, da ContestoSito.config (site.colorTema in
    // global-settings.json): non esiste più un modo di cambiarlo a runtime (era setColorTema(),
    // mai chiamato da nessun consumer reale, rimosso). Resta un Signal (non un plain field) solo
    // per compatibilità dell'API pubblica `colorTema` sotto — chi la legge continua a chiamarla
    // come prima, `_palette` computed continua a funzionare invariato.
    private readonly _colorTema: Signal<string>;
    private readonly _palette: Signal<PaletteTokens>;

    // Override di secondario/sfondo/testo — statici per la durata della sessione (config di
    // progetto, non runtime come colorTema): letti una volta in costruzione da ContestoSito.config.
    private readonly _overrides: PaletteOverrides;

    private readonly document = inject(DOCUMENT);
    private readonly platformId = inject(PLATFORM_ID);
    // Stesso nonce del provider CSP_NONCE server-side (o, sul bootstrap client-only, dell'attributo
    // ngCspNonce che server.ts inietta su <app-root> — vedi CSP_NONCE in @angular/core): serve
    // esplicito perché _ensureFontFaces crea il tag via DOM nativo (createElement), non via
    // Renderer2 — Angular applica il nonce in automatico solo agli elementi che crea lui.
    private readonly cspNonce = inject(CSP_NONCE, { optional: true });

    // ── Plain readonly from palette ───────────────────────────────────────

    /** Colore brand — fisso per l'intera sessione (`site.colorTema`), mai a runtime. CSS: `--colorTema` */
    readonly colorTema: Signal<string>;
    /** Signal `#000000` o `#ffffff` — testo a contrasto massimo su `--colorTema`. CSS: `--colorTemaText` */
    readonly colorTemaText: Signal<'#000000' | '#ffffff'>;
    /**
     * Signal della variante scurita del brand con contrasto WCAG 4.5:1 sullo sfondo pagina chiaro reale.
     * Usare per bottoni, CTA e link. CSS: `--colorPrimary`
     */
    readonly colorPrimary: Signal<string>;
    /** Signal `#000000` o `#ffffff` — testo leggibile su `--colorPrimary`. CSS: `--colorPrimaryText` */
    readonly colorPrimaryText: Signal<'#000000' | '#ffffff'>;
    /**
     * Signal della variante muted del brand (chroma ridotta al 75%, o hue indipendente se
     * `colorSecondary` è overridden in global-settings.json). Come `colorPrimary`, non è
     * tone-adaptive: stesso valore a prescindere dal tema OS — coerente con l'uso in canvas/immagini
     * generate, che restano un artefatto statico una volta prodotte. CSS: `--colorSecondaryLt`
     */
    readonly colorSecondary: Signal<string>;
    /** Signal `#000000` o `#ffffff` — testo leggibile su `--colorSecondary`. CSS: `--colorSecondaryTextLt` */
    readonly colorSecondaryText: Signal<'#000000' | '#ffffff'>;
    /**
     * Tono effettivo del pannello contenuti (`.content-panel`), indipendente dalla preferenza OS
     * (o dal tono fissato da `forceThemeTone`) che governa navbar/footer/sfondo — dal
     * `panelSurface` del design system attivo (`'light'|'dark'`), `null` se `'auto'` (segue
     * l'ambiente, quale che sia). Guida sia l'attributo Bootstrap sia le classi CSS, un'unica fonte di verità:
     * `<div [attr.data-bs-theme]="theme.panelTone" [class.panel-light]="theme.panelTone === 'light'"
     *       [class.panel-dark]="theme.panelTone === 'dark'">`.
     */
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
    /**
     * Signal `'light' | 'dark'` reattivo alla preferenza OS (`prefers-color-scheme`).
     * Cambia in tempo reale se l'utente alterna il tema di sistema senza ricaricare la pagina.
     * Riflesso come attributo `data-theme-tone` su `<html>`.
     * Usare nei componenti che adattano canvas, icone o stili inline al tono corrente.
     */
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
        // panelSurface pinna il pannello indipendentemente dall'ambiente circostante — anche se
        // quell'ambiente è già fissato da forceThemeTone: un pannello su un tono diverso dal resto
        // del sito è una composizione valida (pattern comune ad es. in Radix Themes/Chakra/Ant
        // Design/Carbon: una card chiara dentro un'app scura, o viceversa), non un conflitto da
        // arbitrare qui. siteBuilder.ts sceglie già il default giusto in base a forceThemeTone
        // ('auto' se impostato, altrimenti 'light'): qui non resta che leggerlo.
        this.panelTone = ContestoSito.config.panelSurface === 'auto' ? null : ContestoSito.config.panelSurface;
        this._navSurface = ContestoSito.config.navSurface;

        // 3. themeTone inizializzato col tono forzato se presente, altrimenti naturalTone
        //    (SSR-safe, senza leggere prefers-color-scheme).
        this._themeTone = signal(this._forcedThemeTone ?? this._palette().naturalTone);
        this.themeTone = this._themeTone.asReadonly();

        // 4. `<style id="theme-init">` presente = l'SSR ha già iniettato i blocchi
        //    `@media(prefers-color-scheme)` che coprono DA SOLI, in puro CSS, sia il render
        //    iniziale sia ogni cambio OS successivo (colorTema è fisso per la sessione — non
        //    esiste più nulla che possa disallinearli da quel CSS). Stesso principio già usato da
        //    `_ensureFontFaces` per l'@font-face: quando il tag manca (CSR-only, es. build/
        //    preview senza SSR) non c'è alcun CSS a cui appoggiarsi, quindi JS applica e riapplica
        //    per intero; quando c'è, JS non riscrive mai le CSS vars — evita ~100 `setProperty` a
        //    vuoto sia al boot sia ad ogni toggle OS.
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

    /**
     * Sceglie quale coppia di token già calcolati alimenta lo slot navbar/footer — stessa
     * matematica di `computePalette`, solo una scelta di ALIAS in più (vedi `SiteShellConfig.navSurface`).
     * `'brand'` (default): i token immersivi dedicati (`colorNavBg*`/`colorNavText*`/`colorNavBorder*`).
     * `'body'`: gli stessi token dello sfondo pagina (`colorBase*`/`colorSurfaceText*`/`colorSurfaceBorder*`)
     * — navbar/footer diventano indistinguibili dal contenuto, nessuna cesura.
     */
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

    /**
     * Inietta tutte le CSS custom properties del tema su `<html>` via `style.setProperty`.
     * Chiamata SOLO quando manca `<style id="theme-init">` (CSR-only, vedi costruttore) — al boot
     * e ad ogni cambio `prefers-color-scheme`; quando il tag SSR è presente i suoi blocchi
     * `@media` coprono già entrambi i casi in puro CSS, questo metodo non viene mai invocato.
     * Aggiorna anche `data-bs-theme` e `data-theme-tone` per il sistema di varianti Bootstrap.
     */
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
            // Triple RGB fisse Lt/Dk di link e link-hover: senza queste, un subtheme [data-bs-theme]
            // nidificato (es. pannello forced-light dentro pagina dark, vedi app.component.html) fa
            // ricadere Bootstrap sul SUO --bs-link-color-rgb di stock (#0d6efd) — la mixin
            // theme-bridge in _lib.scss sovrascrive --bs-link-color (hex) ma non la variante -rgb,
            // che è quella che il CSS compilato di Bootstrap usa davvero per il colore del testo dei
            // link (`a { color: rgba(var(--bs-link-color-rgb), ...) }`) e per il suo hover
            // (`a:hover { --bs-link-color-rgb: var(--bs-link-hover-color-rgb) }`). Definite per
            // garantire la propagazione del colore brand (e la conformità WCAG AA) anche dentro un
            // subtheme [data-bs-theme] nidificato, evitando il fallback ai blu default di Bootstrap.
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

    /**
     * Produce il blocco `<style id="theme-init">` da iniettare nell'HTML SSR prima di `</head>`.
     * Posizionato dopo il `<link>` di Bootstrap → stessa specificità (0,1,0), posizione successiva
     * → nostro `:root` vince la cascade senza bisogno di inline styles.
     * I `@media` blocks delegano al browser la scelta del tone in base all'OS — OMESSI del tutto
     * se `forcedTone` è impostato: senza quei blocchi nessun cambio di `prefers-color-scheme` può
     * più sovrascrivere le CSS vars, il `:root` col tono forzato resta l'unica dichiarazione.
     * Se ci sono `@font-face` da iniettare (`SystemFont` attivo e/o font custom), le aggiunge nello
     * STESSO tag — così `_ensureFontFaces` (client) lo trova già pronto ed evita un duplicato.
     */
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

    /**
     * Target di contrasto NON-testo per il boundary del fill primary (`--bs-primary`) contro lo sfondo
     * pagina: 3.2:1, un margine sopra il minimo WCAG 1.4.11 (3:1). Usato in dark mode da
     * `computeColorPrimaryFillDk` per garantire che `.btn-primary`/`.bg-primary` resti distinguibile
     * dal fondo scuro anche con brand quasi-neri (che da soli sarebbero invisibili, ~1:1).
     */
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
        // Testo: se overrides.text è presente resta un override pieno e indipendente (stessa
        // pipeline di sempre, contrasto garantito allo stesso modo). Se ASSENTE, il default non è
        // più il brand ma lo sfondo (C_bg/H_bg) — che a sua volta è già il brand se nemmeno
        // colorBackground è stato impostato. Testo e sfondo restano quindi sempre intonati tra loro
        // di default, invece di poter divergere in due tinte scollegate senza che nessuno lo scelga
        // esplicitamente: elimina un asse di stonatura estetica che il solo controllo WCAG (basato
        // su luminanza, non su armonia) non può intercettare.
        const [C_txt, H_txt] = overrides?.text ? chFor(overrides.text) : [C_bg, H_bg];

        // I tetti di chroma delle superfici (vedi computeBaseLt/computeMutedBgLt/ecc., tutti
        // Math.min(C*fattore, tetto)) sono tarati per il caso "brand derivato automaticamente":
        // una sfumatura appena percettibile, perché prima era l'unico input possibile — e quel tetto
        // è quasi sempre il valore VINCENTE del min(), a prescindere da quanto è saturo il colore in
        // ingresso (un input molto saturo supera il tetto comunque). Con un override esplicito il
        // risultato resterebbe quindi IDENTICO indipendentemente dalla tinta scelta: un giallo pieno
        // finirebbe comunque appena percettibile. bgBoost/txtBoost moltiplicano il risultato GIÀ
        // clampato (non l'input prima del tetto: min(a,b)*k = min(a*k,b*k), quindi alzare l'input da
        // solo non basta se il tetto resta più piccolo) SOLO quando la tinta arriva da un override —
        // il caso derivato dal brand resta bit-a-bit invariato. 16 è tarato empiricamente: rende la
        // tinta riconoscibile (#fffacd → base ≈ #f8f6e1, chiaramente calda) restando una superficie
        // chiara/scura, non un blocco di colore pieno — verificato anche con input a saturazione
        // piena (#ff0000, #00ff00) senza mai scendere sotto WCAG AA. Il contrasto resta garantito a
        // prescindere dal boost: findCompliantColor calcola sempre il testo dinamicamente contro la
        // superficie reale risultante, qualunque essa sia.
        const OVERRIDE_CHROMA_BOOST = 16;
        // `backgroundVividness`: quanto le superfici di CONTENUTO (base/surface/hover/subtle/muted —
        // non la navbar, vedi sotto) devono avvicinarsi, in LUCENTEZZA (OKLCH L, `liftBg` sotto) E
        // SATURAZIONE (chroma — attiva lo stesso `OVERRIDE_CHROMA_BOOST` di un `background` esplicito,
        // altrimenti alzare solo la lucentezza produrrebbe un grigio spento, non il colore atteso), al
        // colore che le governa — vedi il campo su `PaletteOverrides` per il perché. `L_bg` è quel
        // colore (background se presente, altrimenti il brand — stessa fonte di C_bg/H_bg sopra,
        // quindi coerente anche quando nessuno dei due è impostato: vividness=0 e L_bg=qualunque
        // restano un no-op).
        const vividness = Math.max(0, Math.min(1, overrides?.backgroundVividness ?? 0));
        const bgBoost = (overrides?.background || vividness > 0) ? OVERRIDE_CHROMA_BOOST : 1;
        const txtBoost = overrides?.text ? OVERRIDE_CHROMA_BOOST : 1;
        const [L_bg] = AppearanceService.hexToOklch(overrides?.background ?? colorTema);
        // `L_t` (SEMPRE il brand, mai `background`) alza solo la LUCENTEZZA della navbar (mai la
        // chroma: il rapporto/tetto di `colorNavBg*` non è tarato per il boost x16 usato sopra, la
        // saturerebbe oltre il colore di riferimento) — la navbar resta legata al brand come da
        // sempre (vedi colorNavBg* sotto); su `navSurface:'body'` non è comunque usata, la navbar
        // eredita di peso i token di sfondo (già pienamente vivid-capable) invece di questi.
        const [L_t] = AppearanceService.hexToOklch(colorTema);
        const liftBg = (defaultL: number): number => defaultL + (L_bg - defaultL) * vividness;
        const liftNav = (defaultL: number): number => defaultL + (L_t - defaultL) * vividness;

        // `separazioneSuperficiFattore`: asse ORTOGONALE a vividness — scala lo SCARTO di
        // lucentezza di ogni superficie di CONTENUTO dalla base (0.970 Lt / 0.140 Dk, l'ancora fissa
        // che resta sempre 0.970/0.140 qualunque sia il fattore), applicato PRIMA di liftBg qui
        // sotto. 1 (default) = scarti storici esatti. Il bordo (colorSurfaceBorder*) resta escluso
        // di proposito: ancorato a un minimo WCAG 1.4.11, non una scelta di stile — vedi
        // `PaletteOverrides.separazioneSuperficiFattore`.
        const separaFattore = Math.max(0, overrides?.separazioneSuperficiFattore ?? 1);
        const separaLt = (defaultL: number): number => 0.970 + (defaultL - 0.970) * separaFattore;
        const separaDk = (defaultL: number): number => 0.140 + (defaultL - 0.140) * separaFattore;

        // Sfondo base precomputato — serve come riferimento per i check di contrasto
        // dei colori semantici (findCompliantColor li usa per garantire WCAG 4.5:1).
        // Segue l'override background se presente. Non passa da separaLt/separaDk: è l'ANCORA,
        // lo scarto da se stesso è sempre 0 qualunque sia separazioneSuperficiFattore.
        const baseLtHex = AppearanceService.computeBaseLt(C_bg, H_bg, bgBoost, liftBg(0.970));
        const baseDkHex = AppearanceService.computeBaseDk(C_bg, H_bg, bgBoost, liftBg(0.140));

        // Superfici precomputate qui (dipendono solo da C_bg/H_bg) perché sono i riferimenti
        // di contrasto per i foreground derivati (link/secondary/muted/primary-fg).
        //
        // tertiary-bg (--bs-tertiary-bg): table-striped alternato, placeholder.
        const colorSubtleBgLt = AppearanceService.oklchToHex(liftBg(separaLt(0.967)), Math.min(C_bg * 0.05, 0.007) * bgBoost, H_bg);
        const colorSubtleBgDk = AppearanceService.oklchToHex(liftBg(separaDk(0.248)), Math.min(C_bg * 0.20, 0.025) * bgBoost, H_bg);
        // secondary-bg (--bs-secondary-bg): disabled inputs, table-striped. È la superficie
        // più ESTREMA su cui i foreground possono comparire, in ENTRAMBI i toni:
        //   light L=0.942 → più SCURA di tertiary(0.967)/base(0.970)/surface(0.985)/hover(0.950);
        //   dark  L=0.295 → più CHIARA di tertiary(0.248)/surface(0.180)/base(0.140)/hover(0.220).
        // Tarare i foreground contro questa (anziché la tertiary) garantisce il target a fortiori
        // su TUTTE le altre superfici (base, card, hover, tertiary) — verificato via stress test.
        // Con `backgroundVividness` > 0 ognuna di queste L viene "alzata" (liftBg) della stessa
        // proporzione verso quella del colore di sfondo: l'ORDINE relativo (chi è più chiaro/scuro
        // di chi) resta identico qualunque sia la vividness, perché è la STESSA trasformazione affine
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
            // Nessun override: variante muted del brand, calcolata come sempre con garanzia WCAG —
            // sia come TESTO sulla superficie muted (comportamento storico) sia come FILL contro lo
            // sfondo pagina reale (colorBaseLt/Dk, passati qui sotto): senza questo secondo vincolo,
            // un `backgroundVividness` alto può avvicinare lo sfondo pagina alla stessa hue del
            // secondario quanto basta per farlo scomparire come blocco (contrasto sotto 3:1, WCAG
            // 1.4.11), anche se il testo sopra resta correttamente leggibile — scoperto da
            // example.design-system.spec.ts (Muro ora sempre a vividness:1).
            // `mutezzaSecondarioFattore` (PaletteOverrides sopra): quanto il secondary si allontana
            // in chroma dal brand pieno — 0.75 (default) è il fattore storico, invariato per chi non
            // tocca `DesignSystemPreset.mutezzaSecondario`.
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
        // secondary-color: testo muted — hue dal testo (segue l'override), TARGET_TEXT (4.8:1,
        // sopra AA) garantito da findCompliantColor contro la superficie più ESTREMA (secondary-bg,
        // già bg-aware): il muted compare su card/pannelli, righe tabella alternate e input
        // disabilitati. Garantendolo lì, lo si ottiene su ogni altra superficie. È il token che
        // l'audit segnalava al limite (4.49:1).
        // NB: colorSurfaceDkHex resta definito qui, è ancora il token --colorSurfaceDk nel return —
        // segue l'override background, non testo.
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
            // Border L=0.600: un valore più basso (es. ~0.490) fa cadere il contrasto sotto 3:1 su
            // tutte le superfici tranne base (es. bordo input disabilitato su secondary-bg L=0.295
            // → 2.18:1). A L=0.600 il caso peggiore vs la superficie più CHIARA (secondary-bg) è
            // ≈ 3.47:1 — margine sopra il minimo WCAG 1.4.11 (3:1); a fortiori su base/surface/hover/tertiary.
            // Con backgroundVividness > 0 anche i bordi si alzano (liftBg) della stessa proporzione:
            // il margine sopra si restringe ma non si azzera per vividness < 1 (a vividness=1 tutte
            // le superfici collassano sullo stesso L del colore di sfondo, bordo incluso).
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

        // Un override "duro" (colorSecondary/colorInfo/customPalette, vedi PaletteOverrides sopra)
        // non ha più la rete di sicurezza che il calcolo automatico garantisce — può collassare
        // sulla superficie che lo circonda invece che solo su un testo poco leggibile (quello resta
        // sempre garantito). auditPaletteContrast copre proprio questo buco: solo un warning in
        // dev-mode, mai un blocco — il design system resta libero di scegliere, ma lo scopre subito
        // invece che a occhio (vedi README §"Override opzionali").
        if (isDevMode()) {
            for (const message of AppearanceService.auditPaletteContrast(tokens)) {
                console.warn(`[AppearanceService] ${message}`);
            }
        }

        return tokens;
    }

    /**
     * WCAG 1.4.11 (contrasto "non testuale", ≥3:1): un fill (secondario/info/customPalette) deve
     * restare DISTINGUIBILE dalla superficie su cui probabilmente si appoggia (pagina o pannello),
     * non solo avere un testo leggibile sopra — quel secondo problema è già coperto altrove
     * (`getReadableTextColor`) e non richiede questo controllo. Un override "duro" può collassare
     * qui perché non passa più dalla ricerca di contrasto automatica (vedi `computePalette` sopra):
     * questa funzione è la rete di sicurezza — SOLO segnalazione, mai una correzione silenziosa,
     * coerente con "il design system vince su tutto" del refactor precedente. Pura e statica: la
     * stessa lista di problemi la usa sia `computePalette` (console.warn in dev) sia
     * `design-system-presets.spec.ts`, stesso identico calcolo in entrambi.
     */
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

    /**
     * Sfondo pagina chiaro reale: off-white con micro-tinta brand (L=0.970, chroma minima).
     * È il riferimento di contrasto per i token che vi compaiono come testo (`colorPrimary`,
     * `colorLink`, `mutedText`): più scuro del bianco puro, quindi il caso peggiore in light mode.
     * Fonte unica della formula — usato sia da `computePalette` (token `colorBaseLt`) sia da
     * `computeColorPrimary`, così il primary si tara sullo stesso fondo su cui poi vive.
     */
    private static computeBaseLt(C: number, H: number, boost = 1, liftedL = 0.970): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.03, 0.004) * boost, H);
    }

    /**
     * Sfondo pagina scuro reale: near-black con micro-tinta brand (L=0.140, chroma minima).
     * Gemello scuro di `computeBaseLt`: è il riferimento di contrasto per il boundary del FILL primary
     * in dark mode (`colorPrimaryFillDk`). Fonte unica della formula — usato sia da `computePalette`
     * (token `colorBaseDk`) sia da `computeColorPrimaryFillDk`, così il fill scuro si tara sullo stesso
     * fondo pagina su cui poi compare. (I foreground dark — `colorPrimaryFgDk`, `colorLinkDk` — si
     * tarano invece sulla superficie più estrema `mutedBgDk`, non sulla base.)
     */
    private static computeBaseDk(C: number, H: number, boost = 1, liftedL = 0.140): string {
        return AppearanceService.oklchToHex(liftedL, Math.min(C * 0.08, 0.010) * boost, H);
    }

    /**
     * Superficie più ESTREMA su cui un foreground può comparire (`--bs-secondary-bg`: table-striped,
     * input disabilitati). Light L=0.942 → più scura di tertiary/base/surface/hover; dark L=0.295 →
     * più chiara delle stesse. È il riferimento di contrasto worst-case per i token foreground:
     * garantendo il target qui lo si ottiene a fortiori su ogni altra superficie. Fonte unica della
     * formula — usata da `computePalette` (token `colorMutedBg`) e dai foreground `computeColorPrimaryFgLt`/`computeColorPrimaryFgDk`.
     */
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

    /**
     * Deriva una coppia fill/testo WCAG-safe (Lt/Dk) da hue/chroma dati per il secondario
     * auto-calcolato (nessun override — vedi `PaletteOverrides.secondary`): cerca la prima
     * variante che sia SIA leggibile come testo sulla superficie muted di riferimento (target
     * `TARGET_TEXT_CONTRAST`) SIA distinguibile come fill dallo sfondo pagina reale (`baseBgLt/Dk`,
     * WCAG 1.4.11 ≥3:1 — senza questo secondo vincolo un `backgroundVividness` alto può avvicinare
     * lo sfondo pagina alla stessa hue del secondario quanto basta da farlo scomparire come
     * blocco). Se nemmeno bianco/nero puro (il ripiego naturale) bastano su ENTRAMBI i fronti —
     * caso limite di brand a chroma molto alta — resta comunque il massimo contrasto ottenibile
     * sulla superficie muted, mai sotto WCAG lì (vedi `findDualCompliantColor`).
     */
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

    /** Come `findCompliantColor`, ma richiede la soglia su DUE sfondi contemporaneamente — usato
     *  solo per il secondario auto-calcolato (`computeAccentPair`): deve restare leggibile come
     *  TESTO sulla superficie muted (`targetMuted`, `TARGET_TEXT_CONTRAST`) E distinguibile come
     *  FILL dallo sfondo pagina reale (`targetBase`, WCAG 1.4.11 ≥3:1) — senza questo secondo
     *  vincolo, un `backgroundVividness` alto può avvicinare `bgBase` alla stessa hue del
     *  secondario quanto basta da farlo scomparire come blocco, anche se il testo sopra resta
     *  leggibile. Se nessuna L soddisfa entrambi i vincoli (caso limite, es. un brand scuro con
     *  `forceThemeTone` che rende irraggiungibile la variante Lt — non un bug, quella variante non
     *  viene mai davvero renderizzata in quel caso): il ripiego è nero o bianco, quello con il
     *  contrasto MINIMO più alto sui due sfondi PRESI INSIEME — non semplicemente il migliore su
     *  `bgMuted` (`getReadableTextColor(bgMuted)`, come in `findCompliantColor`): quel ripiego
     *  ignorerebbe proprio il vincolo che questa funzione esiste per garantire, vanificandolo nel
     *  caso limite invece di limitarsi a rilassarlo. */
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
    // SSR dei tag <head>) sia direttamente dai consumer (vedi frontend/README.md "Metodi Statici
    // (SSR-Safe)"): pure, senza stato, chiamabili sia lato server che client.

    /**
     * Variante del brand con contrasto WCAG 4.5:1 (AA, testo normale) sullo sfondo pagina chiaro
     * reale `baseLt`, per bottoni/CTA/link e testo `.text-primary`. Scurisce in OKLCH a hue e
     * chroma invariati — abbassa solo la luminanza L, partendo da quella del brand, il minimo
     * indispensabile per raggiungere 4.5:1. A differenza del mix con nero in RGB, NON desatura:
     * un brand chiaro (es. `#bfffff`) resta una tinta viva invece di virare al grigio spento, e
     * un brand già conforme viene restituito pressoché intatto invece di essere sovra-scurito.
     *
     * Il riferimento è `baseLt` (off-white con micro-tinta brand, L=0.970), NON il bianco puro:
     * il primary compare anche come testo su quel fondo, che essendo più scuro del bianco
     * abbassa il contrasto reale (~0.4 in meno) — tararlo sul bianco lascerebbe il testo più
     * piccolo sotto la soglia AA sulla pagina vera. Stesso ragionamento già applicato a
     * `colorLink`. Il contrasto WCAG dipende dalla luminanza, non dalla chroma: preservare la
     * saturazione non costa accessibilità.
     * Fallback `#1a1a1a` se nessuna L conforme (hue al limite del gamut sRGB).
     *
     * `baseLtHex`, se passato, sostituisce il calcolo interno di `baseLt` — usato da
     * `computePalette` per tarare il primary sulla superficie REALE quando `PaletteOverrides.background`
     * è presente, invece che su una derivata dal solo brand.
     */
    static computeColorPrimary(colorTema: string, baseLtHex?: string): string {
        const [L0, C, H] = AppearanceService.hexToOklch(colorTema);
        const bg = baseLtHex ?? AppearanceService.computeBaseLt(C, H);
        for (let L = L0; L >= 0.05; L -= 0.01) {
            const candidate = AppearanceService.oklchToHex(L, C, H);
            if (AppearanceService.calcContrastRatio(candidate, bg) >= 4.5) return candidate;
        }
        // Nessuna L a chroma fisso raggiunge il target (`bg` con lucentezza vicina a quella del
        // brand — tipico con `backgroundVividness` alto: un `#1a1a1a` fisso qui non era nemmeno
        // garantito conforme contro un fondo così). Stesso ripiego di `findCompliantColor`: massimo
        // contrasto possibile (nero o bianco puro), sacrificando la tinta brand ma mai la conformità.
        const fallback = AppearanceService.getReadableTextColor(bg);
        if (isDevMode()) {
            console.warn(`[AppearanceService] computeColorPrimary non converge a 4.5:1 (bg=${bg}) → ripiego su ${fallback}.`);
        }
        return fallback;
    }

    /**
     * Variante LIGHT del primary come FOREGROUND (testo `.text-primary`, bordo `.border-primary`).
     * Gemella light di `computeColorPrimaryFgDk`: scurisce il brand in OKLCH (hue e chroma preservate)
     * finché il contrasto `TARGET_TEXT_CONTRAST` (4.8:1, sopra AA) sulla superficie più ESTREMA light
     * (`mutedBgLt`, `--bs-secondary-bg` L=0.942) è garantito. È DISACCOPPIATA dal fill `colorPrimary`:
     * il fill `--bs-primary` resta il colore brand fedele (tarato 4.5:1 su `baseLt`, ospita testo
     * proprio via `colorPrimaryText`), mentre questo foreground vive sulle superfici interne (card,
     * righe-tabella, input disabilitati) dove serve più contrasto. Tararlo su `baseLt` come il fill
     * lasciava `.text-primary` a ~4.1:1 su quelle superfici. Fallback `#1a1a1a` (hue al limite gamut).
     *
     * `mutedBgLtHex`, se passato, sostituisce il calcolo interno di `mutedBgLt` — usato da
     * `computePalette` per rispettare `PaletteOverrides.background` quando presente.
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
     * Variante DARK del primary come FILL (`--bs-primary`, `.btn-primary`/`.bg-primary`) in dark mode.
     * Il fill light `colorPrimary` è tarato per il fondo CHIARO: usato letteralmente come bg su pagina
     * scura, un brand scuro/quasi-nero sparisce (boundary ~1:1, sotto WCAG 1.4.11). Qui si SCHIARISCE
     * il fill light in OKLCH (hue e chroma preservati) finché soddisfa DUE vincoli: boundary
     * `TARGET_FILL_BOUNDARY` (3.2:1) vs lo sfondo pagina scuro `baseDk`, E un testo leggibile (≥4.5:1,
     * bianco o nero) ospitabile sopra. I brand già abbastanza luminosi restano invariati (nessuna
     * deriva). Il testo del bottone in dark è poi `getReadableTextColor(questo)` = `colorPrimaryTextDk`.
     *
     * `baseDkHex`, se passato, sostituisce il calcolo interno di `baseDk` — usato da `computePalette`
     * per rispettare `PaletteOverrides.background` quando presente.
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
     * Gemella scura di `computeColorPrimary`: variante del brand con contrasto WCAG sopra-AA
     * (`TARGET_TEXT_CONTRAST` = 4.8:1) per il primary usato come FOREGROUND (testo `.text-primary`,
     * bordo `.border-primary`) in dark mode. Schiarisce in OKLCH a hue e chroma invariati — alza solo
     * la luminanza L partendo da quella del brand, il minimo indispensabile. Preserva la chroma REALE
     * del brand (non una minima): un primary-come-testo resta una tinta brand viva anche su fondo scuro.
     *
     * Riferimento = la superficie più ESTREMA `mutedBgDk` (`--bs-secondary-bg`, L=0.295), NON la base
     * pagina: il primary come foreground compare anche su card/righe-tabella/input disabilitati, dove
     * il contrasto è peggiore che sulla base (tarando su `baseDk` `.text-primary` cadeva a ~3.1:1).
     * È token foreground-only (mai usato come fill `--bs-primary`), quindi alzarne il contrasto non
     * tocca i bottoni. Fallback `#e6e6e6` se nessuna L conforme (hue al limite del gamut sRGB).
     *
     * `mutedBgDkHex`, se passato, sostituisce il calcolo interno di `mutedBgDk` — usato da
     * `computePalette` per rispettare `PaletteOverrides.background` quando presente.
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
