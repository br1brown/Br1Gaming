import { type FontChoice, type CustomFontDef, CUSTOM_FONT_KEY_PATTERN, isSystemFont } from './font-system';

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
 * Comportamento di un ruolo, campo per campo. `showNav`/`showFooter`/`showBreadcrumb`/`pageFade`/
 * `showBrandIcon` hanno un interruttore MASTER sul campo globale omonimo (`false` esplicito blocca
 * ogni ruolo); `showPanel` ha lo stesso tipo di master ma su un campo DIVERSO, non omonimo —
 * `DesignSystemPreset.superfici` (derivato, vedi lì) — stesso pattern di `showSmoke`, puramente
 * per-ruolo ma comunque subordinato a `smoke.enable`; `fitViewport` è l'unico senza alcun master.
 * Dettaglio: frontend/README.md §"Ruoli di Pagina".
 */
export interface SpecRuoloPagina {
    /** Mostra la navbar su questo ruolo. Stessa regola/eccezione master di `DesignSystemPreset.showNav`. */
    showNav?: boolean;
    /** Mostra il footer su questo ruolo. Stessa regola/eccezione master di `showNav`. */
    showFooter?: boolean;
    /** Mostra il pannello contenuti su questo ruolo. Master su `DesignSystemPreset.superfici`
     *  (derivato: alcuni valori lo bloccano a `false`, altri no — vedi lì), stessa regola/eccezione
     *  degli altri campi master altrimenti. */
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

/** Configurazione RISOLTA dell'effetto smoke (particellare, decorativo) — quella che
 *  `SmokeEffectComponent` consuma davvero (velocità/raggio/densità grezzi della simulazione).
 *  Un design system NON scrive questa forma direttamente: scrive `SmokePreset` sotto (`intensita`),
 *  `buildSite()` la risolve in questa tramite `SMOKE_INTENSITY`. Territorio del design system,
 *  non `global-settings.json`. */
export interface SmokeSettings {
    enable: boolean;
    color: string;
    opacity: number;
    maximumVelocity: number;
    particleRadius: number;
    density: number;
}

/** 3 gradi di presenza dell'effetto smoke, crescenti — nomi skeuomorfici come `superfici`
 *  (fenomeni atmosferici di densità crescente), non i 3 numeri grezzi della simulazione
 *  (`maximumVelocity`/`particleRadius`/`density`) che stanno dietro. Vedi `SMOKE_INTENSITY` per i
 *  valori, `DesignSystemPreset.smoke` per l'uso pratico. */
export type SmokeIntensity = 'pulviscolo' | 'bruma' | 'nebbia';

/** Valori grezzi della simulazione dietro ogni `SmokeIntensity` — SOLO uso interno di `buildSite()`
 *  per risolvere `SmokePreset.intensita` in `SmokeSettings`, mai scritti a mano da un design
 *  system. `'pulviscolo'`: puntini piccoli, lenti, radi. `'bruma'`: macchie medie, deriva
 *  moderata. `'nebbia'`: macchie grandi e dense, molto presente. */
export const SMOKE_INTENSITY: Record<SmokeIntensity, Pick<SmokeSettings, 'maximumVelocity' | 'particleRadius' | 'density'>> = {
    pulviscolo: { maximumVelocity: 8, particleRadius: 6, density: 10 },
    bruma: { maximumVelocity: 40, particleRadius: 80, density: 16 },
    nebbia: { maximumVelocity: 100, particleRadius: 220, density: 20 },
};

/**
 * Configurazione dell'effetto smoke COME LA SCRIVE un design system — `color`/`opacity` restano
 * override diretti (già intuitivi: un hex, un alpha 0-1), ma niente `maximumVelocity`/
 * `particleRadius`/`density` grezzi: quei tre numeri sono parametri della simulazione, non una
 * decisione di design, e il loro range utile dipende da un fattore di scala interno a
 * `SmokeEffectComponent` che nessun design system dovrebbe dover conoscere. Al loro posto,
 * `intensita` (un `SmokeIntensity`, default `'pulviscolo'` se `enable: true` e non specificata).
 */
export interface SmokePreset {
    enable: boolean;
    color: string;
    opacity?: number;
    intensita?: SmokeIntensity;
}

/** 3 velocità nominate per OGNI gesto d'apertura/transizione dell'interfaccia (fade di pagina,
 *  dropdown/submenu di navbar, context-menu, lightbox) — un solo asse invece di 4 durate scelte
 *  indipendentemente per ognuno (il difetto che questo campo corregge: oggi 0.25s/0.15s/0.12s/
 *  0.16s per lo stesso identico gesto "un pannello compare"). Non è un valore in ms/s scelto a
 *  mano: solo i 3 gradi con un carattere riconoscibile sono esposti, stesso principio di
 *  `superfici`/`smoke.intensita`. */
export type Movimento = 'scatto' | 'svelto' | 'morbido';

/** Durate grezze dietro ogni `Movimento` — SOLO uso interno di `AppearanceService`, mai scritte a mano
 *  da un design system. `pagina`: fade-in del contenuto di pagina (`.page-fade`). `pannello`:
 *  apertura di dropdown/submenu/context-menu/lightbox — un gesto più piccolo, sempre più rapido
 *  del fade di pagina a parità di grado. `'svelto'` (default) riprende i valori storici più
 *  diffusi nel codice (0.25s pagina, 0.15s pannello). */
export const MOVIMENTO_DURATA: Record<Movimento, { pagina: string; pannello: string }> = {
    scatto: { pagina: '0.15s', pannello: '0.1s' },
    svelto: { pagina: '0.25s', pannello: '0.15s' },
    morbido: { pagina: '0.45s', pannello: '0.28s' },
};

/** 3 gradi nominati di "quanto un pannello elevato (dropdown/submenu/context-menu/`.fab`/
 *  `.surface-elevated`) si stacca dalla superficie sotto" — ombra E raggio d'angolo insieme, non
 *  separabili (stessa idea di `superfici`: una sensazione unica, non due numeri da tenere
 *  sincronizzati). Corregge lo stesso difetto di `Movimento`: oggi l'ombra è un unico valore
 *  fisso ovunque MA il raggio d'angolo diverge già senza motivo fra dropdown (0.85rem) e
 *  context-menu (8px). */
export type Elevazione = 'piatta' | 'sospesa' | 'flottante';

/** Valori grezzi dietro ogni `Elevazione` — SOLO uso interno di `AppearanceService`, mai scritti a
 *  mano. `'sospesa'` (default) riprende l'ombra storica di `--shadowElevated`/
 *  `--shadowElevatedHover` e il raggio storico del dropdown navbar (0.85rem). */
export const ELEVAZIONE_TIERS: Record<Elevazione, { ombra: string; ombraHover: string; raggio: string }> = {
    piatta: { ombra: '0 1px 3px rgba(0, 0, 0, 0.10)', ombraHover: '0 2px 6px rgba(0, 0, 0, 0.14)', raggio: '0.35rem' },
    sospesa: { ombra: '0 10px 24px rgba(0, 0, 0, 0.18)', ombraHover: '0 14px 28px rgba(0, 0, 0, 0.24)', raggio: '0.85rem' },
    flottante: { ombra: '0 18px 40px rgba(0, 0, 0, 0.24)', ombraHover: '0 24px 52px rgba(0, 0, 0, 0.30)', raggio: '1.25rem' },
};

/** 3 larghezze nominate per la colonna del pannello contenuti (`.content-panel` e la vista senza
 *  pannello, `app.component.html`) — oggi un'unica larghezza fissa (l'80% centrato) per OGNI
 *  pagina di OGNI design system, indipendentemente da quanto "arioso" o "denso" vuole essere il
 *  resto dell'identità visiva. */
export type ContentWidth = 'colonna' | 'ampio' | 'pieno';

/** Classi Bootstrap grezze dietro ogni `ContentWidth` — SOLO uso interno di `app.component.html`.
 *  `'ampio'` (default) riprende la larghezza storica dell'engine. */
export const CONTENT_WIDTH_CLASSES: Record<ContentWidth, string> = {
    colonna: 'col-12 col-lg-8 offset-lg-2',
    ampio: 'col-12 col-lg-10 offset-lg-1',
    pieno: 'col-12',
};

/** 3 caratteri nominati per il separatore fra le voci del breadcrumb (`BreadcrumbComponent`) —
 *  oggi `/` fisso in markup, indipendentemente dall'identità del design system attivo. */
export type BreadcrumbStile = 'traccia' | 'freccia' | 'punto';

/** Caratteri grezzi dietro ogni `BreadcrumbStile` — SOLO uso interno di `BreadcrumbComponent`.
 *  `'traccia'` (default) riprende il separatore storico (`/`). */
export const BREADCRUMB_SEPARATORE: Record<BreadcrumbStile, string> = {
    traccia: '/',
    freccia: '›',
    punto: '·',
};

/** 3 gradi di smorzamento del chroma OKLCH del `secondary` auto-calcolato dal brand (quando
 *  `colorSecondary` NON è overridden) — quanto si allontana in saturazione dal brand pieno.
 *  L'override "duro" via `colorSecondary` resta un'altra leva, non tocca questo campo. */
export type MutezzaSecondario = 'tenue' | 'standard' | 'satura';

/** Fattore grezzo (0-1, moltiplica il chroma del brand) dietro ogni `MutezzaSecondario` — SOLO
 *  uso interno di `AppearanceService`. `'standard'` (default) riprende il fattore storico (0.75). */
export const MUTEZZA_SECONDARIO_FATTORE: Record<MutezzaSecondario, number> = {
    tenue: 0.5,
    standard: 0.75,
    satura: 1,
};

/** 3 intensità nominate per lo scurimento hover/active dei bottoni pieni (`.btn-primary`/
 *  `.btn-secondary`/`.btn-info`) — oggi percentuali fisse (12/16/18/22%) identiche per ogni
 *  design system, indipendenti da quanto "vivace" vuole sentirsi il feedback interattivo. In DARK
 *  lo scurimento hover/active è un trade-off già accettato dell'engine (`_bootstrap-theme.scss`,
 *  commento su `.btn-primary`): il boundary TRANSITORIO scende sotto WCAG 1.4.11 mentre il testo
 *  resta sempre ≥5.9:1 e lo stato a RIPOSO resta ≥3.2:1 (garantito altrove, non da questo campo).
 *  `'decisa'` spinge un po' più in là lo stesso trade-off già presente oggi, non ne introduce uno
 *  nuovo. */
export type HoverIntensity = 'lieve' | 'standard' | 'decisa';

/** Percentuali grezze di `color-mix` verso il nero dietro ogni `HoverIntensity` — SOLO uso interno
 *  di `_bootstrap-theme.scss` via CSS custom properties. `'standard'` (default) riprende le
 *  percentuali storiche (12/16/18/22%). */
export const HOVER_INTENSITY_TIERS: Record<HoverIntensity, { hoverBg: string; hoverBorder: string; activeBg: string; activeBorder: string }> = {
    lieve: { hoverBg: '8%', hoverBorder: '11%', activeBg: '13%', activeBorder: '16%' },
    standard: { hoverBg: '12%', hoverBorder: '16%', activeBg: '18%', activeBorder: '22%' },
    decisa: { hoverBg: '18%', hoverBorder: '24%', activeBg: '26%', activeBorder: '32%' },
};

/** 3 gradi nominati di quanto le superfici di contenuto (base/subtle/muted/surface/hover) restano
 *  RAVVICINATE o si SEPARANO fra loro in lucentezza — asse ORTOGONALE a `superfici` (che decide
 *  quanto si avvicinano al colore del BRAND, non quanto si distinguono FRA loro). Il bordo delle
 *  superfici (`colorSurfaceBorder*`) resta escluso di proposito: è ancorato a un minimo di
 *  contrasto WCAG 1.4.11, non una scelta di stile. */
export type SeparazioneSuperfici = 'ravvicinate' | 'classica' | 'marcata';

/** Fattore grezzo che scala lo scarto di lucentezza di ogni superficie dalla base — SOLO uso
 *  interno di `AppearanceService`. `'classica'` (default, fattore 1) riproduce ESATTAMENTE gli scarti
 *  storici — invarianza garantita per chi non tocca questo campo. */
export const SEPARAZIONE_SUPERFICI_FATTORE: Record<SeparazioneSuperfici, number> = {
    ravvicinate: 0.5,
    classica: 1,
    marcata: 1.6,
};

/** 2 stili nominati per il blocco identità nel footer (`app-identity-render` dentro
 *  `FooterComponent`) — oggi social SEMPRE mostrati e orari SEMPRE come accordion, per ogni
 *  design system. `'esteso'` (default) riprende il comportamento storico. */
export type FooterIdentita = 'essenziale' | 'esteso';

/** 3 soglie nominate di scroll oltre cui compare il FAB "torna su" (`BackToTopComponent`) — oggi
 *  300px fisso per ogni design system. */
export type BackToTopSoglia = 'pronta' | 'standard' | 'tardiva';

/** Soglie grezze (px) dietro ogni `BackToTopSoglia` — SOLO uso interno di `BackToTopComponent`.
 *  `'standard'` (default) riprende la soglia storica (300px). */
export const BACK_TO_TOP_SOGLIA_PX: Record<BackToTopSoglia, number> = {
    pronta: 150,
    standard: 300,
    tardiva: 600,
};

/** 2 stili nominati per il FAB di riapertura del cookie banner (`CookieBannerComponent`) — oggi
 *  sempre più piccolo/trasparente del `.fab` standard, ancorato al lato opposto. `'discreto'`
 *  (default) riprende il comportamento storico; `'standard'` lo allinea al resto dei FAB del sito
 *  (stessa dimensione/opacità/lato di `BackToTopComponent`). */
export type CookieReopenStile = 'discreto' | 'standard';

/** 2 stili nominati per il badge di notifiche non lette (`NotificationBellComponent`) — oggi
 *  sempre un conteggio numerico pieno. `'numero'` (default) riprende il comportamento storico. */
export type BadgeNotifiche = 'numero' | 'puntino';

/** 3 intensità nominate per l'alone pulsante (`.pulse-live`, oggi legato solo a
 *  `speech-action.component.html`, ma disponibile a qualunque toggle attivo) — ampiezza/
 *  trasparenza dell'alone fisse, sempre le stesse quando il toggle è attivo. `'lieve'` (default)
 *  riprende il comportamento storico; `'assente'` disattiva l'animazione. */
export type PulsazioneAttiva = 'assente' | 'lieve' | 'marcata';

/** Valori grezzi dietro ogni `PulsazioneAttiva` — SOLO uso interno di `AppearanceService`.
 *  `'assente'`: `nome: 'none'` disattiva l'animazione via `animation-name`, gli altri campi sono
 *  ignorati. `'lieve'` (default) riprende ampiezza/trasparenza storiche. */
export const PULSAZIONE_TIERS: Record<PulsazioneAttiva, { nome: string; spread1: string; trasparenza1: string; spread2: string; trasparenza2: string }> = {
    assente: { nome: 'none', spread1: '0px', trasparenza1: '100%', spread2: '0px', trasparenza2: '100%' },
    lieve: { nome: 'pulseLive', spread1: '4px', trasparenza1: '78%', spread2: '8px', trasparenza2: '55%' },
    marcata: { nome: 'pulseLive', spread1: '6px', trasparenza1: '70%', spread2: '12px', trasparenza2: '40%' },
};

/** Valore numerico dietro `superfici: 'foglio'`/`'distinte'` (o l'assenza del campo) —
 *  comportamento storico: near-black/near-white appena tinto. Uso interno, per chi consuma
 *  `AppearanceService.computePalette` direttamente con un `backgroundVividness` grezzo (es. i test). */
export const VIVIDEZZA_NEUTRA = 0;
/** Valore numerico dietro `superfici: 'tenue'`/`'tenue-flotting'` — a metà strada fra
 *  `VIVIDEZZA_NEUTRA` e `VIVIDEZZA_PIENA`: le superfici si avvicinano alla lucentezza del brand
 *  senza diventarla esattamente. Stesso uso interno di `VIVIDEZZA_NEUTRA`. */
export const VIVIDEZZA_TENUE = 0.5;
/** Valore numerico dietro `superfici: 'fusione'` — la superficie usa la lucentezza del brand: uno
 *  sfondo che È quel colore, non un nero/bianco tinto. Stesso uso interno di `VIVIDEZZA_NEUTRA`. */
export const VIVIDEZZA_PIENA = 1;

/** Input di `DesignSystemPreset.ogTextTransform` — testo e font correnti dell'immagine OG, PRIMA
 *  di un'eventuale personalizzazione. */
export interface OgTextTransformInput {
    title: string;
    subtitle: string;
    /** Font attivo del sito (`defaultFont`, già risolto — coincide con quanto dichiarato nel
     *  preset anche dopo un `extendDesignSystem` che lo sovrascrive), mai assente: un sito senza
     *  `defaultFont` esplicito ricade comunque su `SystemFont.Liberation`, stesso fallback di
     *  `systemUiFonts()`. */
    defaultFont: FontChoice;
}

/** Esito di `DesignSystemPreset.ogTextTransform` — vedi il campo per il contratto su `font`. */
export interface OgTextTransformResult {
    title: string;
    subtitle: string;
    /** Assente: resta il `defaultFont` del sito. */
    font?: FontChoice;
}

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
     * Identità visiva delle superfici del sito — DUE cose insieme, non separabili: quanto pannello/
     * navbar/footer/hover/bordi restano DISTINTI fra loro o si FONDONO nello stesso colore, E se il
     * pannello contenuti (`.content-panel`) è presente. Interruttore MASTER su
     * `SpecRuoloPagina.showPanel` esattamente come `showNav`/`showFooter`/ecc. lo sono sui propri
     * campi omonimi (stesso pattern di `smoke.enable` su `showSmoke`) — un ruolo non può riaccendere
     * il pannello se il valore scelto qui non ce l'ha, può sempre spegnerlo se ce l'ha.
     *
     * Nomi skeuomorfici come i preset condivisi (Aria/Carta/Lavagna/.../Muro, §"Preset di Design
     * System") — la sensazione fisica, non i due booleani sottostanti. 5 valori, ogni combinazione
     * esprimibile è una scelta sensata (nessuna coppia vividezza/pannello senza senso
     * rappresentabile):
     * - `'foglio'` (*assente* = stesso identico comportamento, mai divergono): neutro
     *   (`colorBase*`/`colorSurface*`/ecc. near-black/near-white appena tinti, il dark/light mode
     *   classico), PANNELLO ACCESO — il contenuto su un foglio sopra una superficie neutra, il
     *   comportamento storico, invariato per chi non tocca questo campo.
     * - `'distinte'`: stesso neutro di `'foglio'`, PANNELLO SPENTO — il contenuto vive direttamente
     *   sulla superficie, senza un foglio a parte.
     * - `'tenue'`: a metà strada fra neutro e tinta piena, PANNELLO SPENTO.
     * - `'tenue-flotting'`: stessa via di mezzo, PANNELLO ACCESO — il foglio resta a galla sopra una
     *   superficie già colorata, non più neutra.
     * - `'fusione'`: tinta piena — tutte le superfici diventano il colore ESATTO del brand, un unico
     *   campo di colore continuo — PANNELLO SEMPRE SPENTO, nessuna variante "flotting": un foglio di
     *   tono diverso vanificherebbe la fusione, uno dello stesso colore sarebbe indistinguibile dal
     *   resto (vedi `muro.design-system.ts`).
     *
     * Uso pratico — quale scegliere:
     * - Non tocchi questo campo → hai già `'foglio'`, il comportamento di sempre. Non serve
     *   dichiararlo per "essere espliciti": è ridondante, non più chiaro.
     * - Vuoi un sito "a tinta piena" senza pannello, il caso di `muro` → `'fusione'`, punto: non
     *   c'è altro da combinare (niente `showPanel` a parte, vedi sopra).
     * - Vuoi una tinta via di mezzo ma NON vuoi perdere il pannello → `'tenue-flotting'`.
     * - Vuoi il pannello spento ma SENZA la tinta piena di `'fusione'` (un'identità piatta, non
     *   satura) → `'distinte'`.
     *
     * Dettaglio: frontend/README.md §"Sfondo a tinta piena".
     */
    superfici?: 'foglio' | 'distinte' | 'tenue' | 'tenue-flotting' | 'fusione';
    /**
     * Colori con nome proprio oltre ai quattro slot fissi — override "duro" come `colorSecondary`,
     * esposto come `--color<Label>`/`--color<Label>Text`. Etichette riservate rifiutate a
     * validazione (`RESERVED_PALETTE_LABELS` sotto). Dettaglio: frontend/README.md §"Colori con nome proprio".
     */
    customPalette?: Record<string, string>;
    /** Effetto smoke, decorativo. `enable` è l'interruttore MASTER, `intensita` sceglie il grado di
     *  presenza (`SmokeIntensity`, vedi `SmokePreset` sopra) — non i numeri grezzi della
     *  simulazione. Dettaglio: frontend/README.md §"Effetto smoke". */
    smoke?: Partial<SmokePreset>;
    /** Velocità dei gesti d'apertura/transizione (fade di pagina, dropdown/submenu/context-menu/
     *  lightbox) — vedi `Movimento`/`MOVIMENTO_DURATA` sopra. Default `'svelto'`. */
    movimento?: Movimento;
    /** Ombra + raggio d'angolo dei pannelli elevati (dropdown/submenu/context-menu/`.fab`/
     *  `.surface-elevated`) — vedi `Elevazione`/`ELEVAZIONE_TIERS` sopra. Default `'sospesa'`. */
    elevazione?: Elevazione;
    /** Larghezza della colonna del pannello contenuti — vedi `ContentWidth`/`CONTENT_WIDTH_CLASSES`
     *  sopra. Default `'ampio'`. */
    contentWidth?: ContentWidth;
    /** Separatore fra le voci del breadcrumb — vedi `BreadcrumbStile`/`BREADCRUMB_SEPARATORE`
     *  sopra. Default `'traccia'`. */
    breadcrumbStile?: BreadcrumbStile;
    /** Saturazione del `secondary` auto-calcolato (ignorato se `colorSecondary` è overridden) —
     *  vedi `MutezzaSecondario`/`MUTEZZA_SECONDARIO_FATTORE` sopra. Default `'standard'`. */
    mutezzaSecondario?: MutezzaSecondario;
    /** Intensità dello scurimento hover/active dei bottoni pieni — vedi `HoverIntensity`/
     *  `HOVER_INTENSITY_TIERS` sopra. Default `'standard'`. */
    hoverIntensity?: HoverIntensity;
    /** Quanto le superfici di contenuto si separano fra loro in lucentezza (asse ortogonale a
     *  `superfici`) — vedi `SeparazioneSuperfici`/`SEPARAZIONE_SUPERFICI_FATTORE` sopra. Default
     *  `'classica'`. */
    separazioneSuperfici?: SeparazioneSuperfici;
    /** Presentazione del blocco identità nel footer (social, orari) — vedi `FooterIdentita` sopra.
     *  Default `'esteso'`. */
    footerIdentita?: FooterIdentita;
    /** Soglia di scroll oltre cui compare il FAB "torna su" — vedi `BackToTopSoglia`/
     *  `BACK_TO_TOP_SOGLIA_PX` sopra. Default `'standard'`. */
    backToTopSoglia?: BackToTopSoglia;
    /** Stile/posizione del FAB di riapertura del cookie banner — vedi `CookieReopenStile` sopra.
     *  Default `'discreto'`. */
    cookieReopenStile?: CookieReopenStile;
    /** Stile del badge di notifiche non lette — vedi `BadgeNotifiche` sopra. Default `'numero'`. */
    badgeNotifiche?: BadgeNotifiche;
    /** Intensità dell'alone pulsante di un toggle attivo — vedi `PulsazioneAttiva` sopra. Default
     *  `'lieve'`. */
    pulsazioneAttiva?: PulsazioneAttiva;
    /** Se l'og:image mostra solo lo sfondo, senza titolo/favicon sovrapposti. Default `false`. */
    ogImagePlain?: boolean;
    /**
     * Personalizzazione facoltativa di testo/font SOLO per l'immagine OG (titolo/sottotitolo) —
     * MAI per il resto del sito, che resta sempre su `defaultFont`/i testi di pagina reali. Assente
     * (il caso comune): l'immagine OG mostra `title`/`subtitle` così come sono, nel `defaultFont`
     * del sito — la bussola di ogni campo di questo bundle, qui compresa: un design system che non
     * la tocca si comporta esattamente come uno che non sa che esiste.
     *
     * `font`, se restituito, deve essere lo stesso `defaultFont` o una voce già dichiarata in
     * `addonFonts` — MAI un font nuovo scritto qui al volo: un `SystemFont` è sempre valido (il
     * catalogo è sempre raggiungibile, indipendentemente da cosa il sito ha scelto), un
     * `CustomFontDef` deve invece coincidere per `key` con uno già registrato altrove (`defaultFont`
     * o `addonFonts`), l'unico modo per restare dentro le stesse garanzie di reachability/
     * correzione server (`fc-scan`, `custom-font-detect.ts`) già valide per ogni altro font del
     * catalogo — mai una seconda fonte di verità scollegata. Un valore non valido viene ignorato
     * (si ripiega sul `defaultFont` del sito), mai un errore/crash: stesso trattamento silenzioso
     * di ogni altro campo opzionale di questo bundle.
     */
    ogTextTransform?: (input: OgTextTransformInput) => OgTextTransformResult;
    /** Font del sito, un solo campo per tutto (nessuna distinzione titoli/corpo) — un `FontChoice`
     *  (font-system.ts): una voce di `SystemFont` (già installata nel container) O un `CustomFontDef`
     *  pieno (`{key, family, faces}`, scritto qui direttamente — cartella `fonts/`, accanto a
     *  `global-settings.json`), non una `string` che rimanda altrove — stesso meccanismo per
     *  entrambi, self-hosted via `@font-face` per il browser E usato per nome dal rendering server
     *  delle immagini OG. Assente: font puro di sistema, nessuna opinione (`aria.design-system.ts`).
     *  Un font diverso solo sui titoli non è un campo di questo bundle: si registra in `addonFonts`
     *  e si scrive la regola CSS su `h1`-`h6` a mano (`--fontFamily-<key>`, `frontend/README.md`
     *  §"Font: `SystemFont` + `addonFonts`"). */
    defaultFont?: FontChoice;
    /** Font "aggiuntivi" di questo sito — zero o più `FontChoice` (una voce di `SystemFont`, o un
     *  `CustomFontDef` pieno per un font caricato dal progetto — nessun uso del sistema di
     *  asset/mapping, i file restano nella cartella `fonts/`), ognuno raggiungibile per `key` da
     *  SCSS di progetto via `--fontFamily-<key>` (sempre disponibile, scelto o no come font del
     *  sito). Registrare un font qui NON lo rende attivo: `defaultFont` resta l'unico modo
     *  esplicito di scegliere il font attivo, nessuna eccezione — utile per esporre un secondo
     *  font di sistema (es. `--fontFamily-Roboto`) oltre a quello scelto in `defaultFont`, senza
     *  ridichiararlo. */
    addonFonts?: readonly FontChoice[];
}

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Come `HEX_COLOR_PATTERN`, ma ammette anche 8 cifre (alpha) — solo `smoke.color` ne ha bisogno. */
const SMOKE_HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Segmenti già usati da un token di sistema `--color<Segmento>` — un'etichetta `customPalette` omonima lo sovrascriverebbe silenziosamente. Validato in `validateDesignSystemPreset`. */
const RESERVED_PALETTE_LABELS = new Set([
    'base', 'basedk', 'baselt',
    'heading', 'headingdk', 'headinglt', 'headingrgb', 'headingrgbdk', 'headingrgblt',
    'info', 'infotext',
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

/** `'bordeaux'` → `'Bordeaux'` — usata qui e da `AppearanceService` per comporre `--color<Label>`. */
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
                `--color${pascal} è già un token di sistema (AppearanceService) e verrebbe sovrascritto ` +
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
    if (preset.defaultFont != null && typeof preset.defaultFont !== 'string') {
        checkCustomFontDef(name, 'defaultFont', preset.defaultFont);
    }
    const addonFonts = preset.addonFonts ?? [];
    const seenKeys = new Set<string>();
    for (const addon of addonFonts) {
        // Voce SystemFont: già una voce reale del catalogo (garantito da tsc — vedi FontChoice),
        // nessun campo da validare. Un guard a runtime resta comunque utile a chi bypassa i tipi.
        if (typeof addon === 'string') {
            if (!isSystemFont(addon)) {
                throw new Error(`[DesignSystem] "${name}".addonFonts: "${addon}" non è una voce di SystemFont valida.`);
            }
            if (seenKeys.has(addon)) {
                throw new Error(`[DesignSystem] "${name}".addonFonts: key "${addon}" duplicata.`);
            }
            seenKeys.add(addon);
            continue;
        }
        checkCustomFontDef(name, 'addonFonts', addon);
        if (seenKeys.has(addon.key)) {
            throw new Error(`[DesignSystem] "${name}".addonFonts: key "${addon.key}" duplicata.`);
        }
        seenKeys.add(addon.key);
    }
}

/** Valida la forma di UN `CustomFontDef`, scritto come `defaultFont` o come voce di `addonFonts`
 *  — stesso controllo in entrambi i casi, nessuna verifica incrociata fra i due campi: sono scelte
 *  indipendenti (un `defaultFont` custom NON deve comparire anche in `addonFonts` per essere
 *  servito — lo è già in quanto font attivo — ma può, senza che sia un errore). */
function checkCustomFontDef(name: string, fieldLabel: string, font: CustomFontDef): void {
    if (!CUSTOM_FONT_KEY_PATTERN.test(font.key)) {
        throw new Error(
            `[DesignSystem] "${name}".${fieldLabel}: key "${font.key}" non valida (atteso ` +
            `[a-zA-Z0-9_-]+ — finisce in un URL e in una variabile CSS).`
        );
    }
    if (isSystemFont(font.key)) {
        throw new Error(
            `[DesignSystem] "${name}".${fieldLabel}: key "${font.key}" coincide con una voce di ` +
            `SystemFont — scegline un'altra, l'endpoint non potrebbe distinguerle.`
        );
    }
    if (font.faces.length === 0) {
        throw new Error(`[DesignSystem] "${name}".${fieldLabel}["${font.key}"]: nessuna faccia dichiarata (almeno la regular).`);
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
 *
 * `defaultFont`/`addonFonts` sono `FontChoice` semplici (`SystemFont | CustomFontDef`, vedi
 * `font-system.ts`) — un font custom si scrive come oggetto letterale DIRETTAMENTE nel campo che
 * lo usa, mai come `string` che rimanda a un'altra dichiarazione: niente da tenere allineato fra
 * due campi, niente indirezione da validare a compile-time. Dettaglio ed esempio completo:
 * `frontend/README.md` §"Font: `SystemFont` + `addonFonts`".
 * ```typescript
 * export const clienteX = extendDesignSystem(cartaDesignSystem, {
 *     defaultFont: { key: 'brand', family: 'MiaFontBrand', faces: [{ file: 'MiaFontBrand.woff2', weight: 400, style: 'normal' }] },
 *     addonFonts: [SystemFont.Roboto], // --fontFamily-Roboto raggiungibile da SCSS, pur restando 'brand' il font attivo
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
