import { type FontChoice, type CustomFontDef, CUSTOM_FONT_KEY_PATTERN, isSystemFont } from './font-system';

/** Design system: bundle di campi (tono, superfici, chrome per ruolo, palette, font), sempre una funzione (`DesignSystemFactory`), mai un letterale statico. Grammatica: `extendDesignSystem` sotto. */

/** Ruolo dichiarato da una pagina (`layout.role`): CHE COSA è, non COME appare (lo decide `ruoloPagina`). 4 di serie + ruoli custom `(string & {})`, validati a runtime da `assertRuoloConosciuto`. */
export type PageRole = 'default' | 'legal' | 'error' | 'naked' | (string & {});

/** Comportamento di un ruolo, campo per campo. Un ruolo può solo spegnere: ciò che il design system
 *  risolto (default compresi, cioè `Aspetto`) lascia spento resta spento anche se il ruolo lo accende.
 *  Un campo assente nel ruolo segue il design system. */
export interface SpecRuoloPagina {
    /** Navbar su questo ruolo; con `navbar.show: false` resta spenta comunque. */
    showNav?: boolean;
    /** Footer su questo ruolo; con `footer.show: false` resta spento comunque. */
    showFooter?: boolean;
    /** Pannello contenuti su questo ruolo; con `colori.superfici` 'distinte', 'tenue' o 'fusione' resta spento comunque. */
    showPanel?: boolean;
    /** Vista full-bleed senza pannello/container né footer. Default `false`; nessun campo del design system lo vincola. */
    fitViewport?: boolean;
    /** Effetto smoke su questo ruolo; senza `smoke.enable: true` resta spento comunque. Assente: acceso dove c'è il pannello e la vista non è full-bleed. */
    showSmoke?: boolean;
    /** Breadcrumb su questo ruolo; senza `breadcrumb.show: true` (default `false`) resta spento comunque. */
    showBreadcrumb?: boolean;
    /** Fade-in d'ingresso pagina su questo ruolo; con `movimento: 'fermo'` resta spento comunque. */
    pageFade?: boolean;
    /** Icona di brand in navbar su questo ruolo (QUALE icona: `ShellNavResolver.brandIcon`); con `navbar.icona: false` resta spenta comunque. */
    showBrandIcon?: boolean;
}

/** Chrome del ruolo `'naked'`: pagina nuda, senza navbar, footer, pannello, breadcrumb né smoke (il
 *  fade d'ingresso segue `movimento`). Valore fisso: `ruoloPagina.naked` è un errore di validazione. */
export const NAKED_CHROME: SpecRuoloPagina = { showNav: false, showFooter: false, showPanel: false, showBreadcrumb: false, showSmoke: false };

/** Default di Engine per `'error'` — niente pannello, scostabile mappando `ruoloPagina.error`. */
export const ERROR_CHROME_DEFAULT: SpecRuoloPagina = { showPanel: false };

/** Default di Engine per `'legal'` — niente smoke decorativo, scostabile mappando `ruoloPagina.legal.showSmoke`. */
export const LEGAL_CHROME_DEFAULT: SpecRuoloPagina = { showSmoke: false };

/** Configurazione RISOLTA dell'effetto smoke, quella che `SmokeEffectComponent` consuma. Un design system non la scrive direttamente: scrive `SmokePreset` (`intensita`), `risolviAspetto` la risolve via `SMOKE_INTENSITY`. */
export interface SmokeSettings {
    enable: boolean;
    color: string;
    opacity: number;
    maximumVelocity: number;
    particleRadius: number;
    density: number;
}

/** 3 gradi crescenti dell'effetto smoke, nomi skeuomorfici come `superfici`, non i numeri grezzi della simulazione. Vedi `SMOKE_INTENSITY`. */
export type SmokeIntensity = 'pulviscolo' | 'bruma' | 'nebbia';

/** Valori grezzi dietro ogni `SmokeIntensity`, uso interno di `risolviAspetto` — mai scritti a mano da un design system. */
export const SMOKE_INTENSITY: Record<SmokeIntensity, Pick<SmokeSettings, 'maximumVelocity' | 'particleRadius' | 'density'>> = {
    pulviscolo: { maximumVelocity: 8, particleRadius: 6, density: 10 },
    bruma: { maximumVelocity: 40, particleRadius: 80, density: 16 },
    nebbia: { maximumVelocity: 100, particleRadius: 220, density: 20 },
};

/** Configurazione smoke COME LA SCRIVE un design system: `color`/`opacity` restano override diretti, ma niente parametri grezzi della simulazione — al loro posto `intensita` (default 'pulviscolo' se `enable: true`). */
export interface SmokePreset {
    enable: boolean;
    color: string;
    opacity?: number;
    intensita?: SmokeIntensity;
}

/** 3 velocità nominate per ogni gesto d'apertura/transizione (fade pagina, dropdown, lightbox): un solo asse invece di durate scelte indipendentemente per ognuno. Stesso principio di `superfici`/`smoke.intensita`. */
export type Movimento = 'fermo' | 'scatto' | 'svelto' | 'morbido';

/** Durate dietro ogni `Movimento`, dalla più lunga alla più corta: `pagina` (fade di pagina),
 *  `pannello` (un pannello che compare: dropdown, lightbox, banner), `micro` (feedback di hover/press
 *  su un controllo già visibile). Mai `micro` > `pannello` > `pagina`. */
export const MOVIMENTO_DURATA: Record<Movimento, { pagina: string; pannello: string; micro: string }> = {
    fermo: { pagina: '0s', pannello: '0s', micro: '0s' },
    scatto: { pagina: '0.15s', pannello: '0.1s', micro: '0.08s' },
    svelto: { pagina: '0.25s', pannello: '0.15s', micro: '0.15s' },
    morbido: { pagina: '0.45s', pannello: '0.28s', micro: '0.2s' },
};

/** 3 gradi di "quanto un pannello elevato si stacca dalla superficie sotto": ombra e raggio d'angolo scelti insieme, non separabili (stessa idea di `superfici`). */
export type Elevazione = 'piatta' | 'sospesa' | 'flottante';

/** Valori grezzi dietro ogni `Elevazione`, uso interno di `theme-scss.ts`. 'sospesa' è il default. */
export const ELEVAZIONE_TIERS: Record<Elevazione, { ombra: string; ombraHover: string; raggio: string; ombraBarraGiu: string; ombraBarraSu: string }> = {
    piatta: { ombra: '0 1px 3px rgba(0, 0, 0, 0.10)', ombraHover: '0 2px 6px rgba(0, 0, 0, 0.14)', raggio: '0.35rem', ombraBarraGiu: '0 1px 2px rgba(0, 0, 0, 0.04)', ombraBarraSu: '0 -1px 2px rgba(0, 0, 0, 0.05)' },
    sospesa: { ombra: '0 10px 24px rgba(0, 0, 0, 0.18)', ombraHover: '0 14px 28px rgba(0, 0, 0, 0.24)', raggio: '0.85rem', ombraBarraGiu: '0 4px 12px rgba(0, 0, 0, 0.06)', ombraBarraSu: '0 -4px 12px rgba(0, 0, 0, 0.08)' },
    flottante: { ombra: '0 18px 40px rgba(0, 0, 0, 0.24)', ombraHover: '0 24px 52px rgba(0, 0, 0, 0.30)', raggio: '1.25rem', ombraBarraGiu: '0 6px 18px rgba(0, 0, 0, 0.10)', ombraBarraSu: '0 -6px 18px rgba(0, 0, 0, 0.12)' },
};

/** 3 gradi di respiro fra chrome, pannello e contenuto (spazio interno del pannello e distacco da
 *  navbar, footer e bordi dello schermo), sui gradini di `$spacers` di Bootstrap: `respiro` sotto md,
 *  `respiroLargo` da md in su. Stesso principio di `elevazione`: un asse nominato, non numeri sparsi. */
export type Densita = 'compatta' | 'normale' | 'ariosa';
export const DENSITA_TIERS: Record<Densita, { respiro: string; respiroLargo: string }> = {
    compatta: { respiro: '0.5rem', respiroLargo: '1rem' },
    normale: { respiro: '1rem', respiroLargo: '1.5rem' },
    ariosa: { respiro: '1.5rem', respiroLargo: '3rem' },
};

/** Larghezza massima dello shell (contenuto, navbar e footer si centrano oltre) per `larghezza`: la
 *  stessa scelta della colonna del pannello, portata agli schermi ultra-wide. */
export const CONTENT_WIDTH_SHELL_MAX: Record<ContentWidth, string> = {
    colonna: '80rem',
    ampio: '90rem',
    pieno: '100rem',
};

/** Larghezza della colonna del pannello contenuti e del breadcrumb sopra, dalla più stretta alla
 *  piena. Senza pannello la pagina occupa tutta la riga, qualunque valore. */
export type ContentWidth = 'colonna' | 'ampio' | 'pieno';

/** Classi Bootstrap grezze dietro ogni `ContentWidth` — SOLO uso interno di `app.component.html`.
 *  `'ampio'` è il default. */
export const CONTENT_WIDTH_CLASSES: Record<ContentWidth, string> = {
    colonna: 'col-12 col-lg-8 offset-lg-2',
    ampio: 'col-12 col-lg-10 offset-lg-1',
    pieno: 'col-12',
};

/** L'offset-lg-N di `CONTENT_WIDTH_CLASSES`, in colonne su 12: campo esplicito invece di re-derivarlo
 *  dalla stringa di classi, così un `ContentWidth` nuovo non compila finché non lo valorizza qui. */
export const CONTENT_WIDTH_OFFSET_LG: Record<ContentWidth, number> = {
    colonna: 2,
    ampio: 1,
    pieno: 0,
};

/** 3 caratteri nominati per il separatore fra le voci del breadcrumb (`BreadcrumbComponent`). */
export type BreadcrumbStile = 'traccia' | 'freccia' | 'punto';

/** Caratteri grezzi dietro ogni `BreadcrumbStile` — SOLO uso interno di `BreadcrumbComponent`.
 *  `'traccia'` (`/`) è il default. */
export const BREADCRUMB_SEPARATORE: Record<BreadcrumbStile, string> = {
    traccia: '/',
    freccia: '›',
    punto: '·',
};

/** 3 soglie nominate di scroll oltre cui compare il FAB "torna su" (`BackToTopComponent`). */
export type BackToTopSoglia = 'pronta' | 'standard' | 'tardiva';

/** Soglie grezze (px) dietro ogni `BackToTopSoglia` — SOLO uso interno di `BackToTopComponent`.
 *  `'standard'` (300px) è il default. */
export const BACK_TO_TOP_SOGLIA_PX: Record<BackToTopSoglia, number> = {
    pronta: 150,
    standard: 300,
    tardiva: 600,
};

/** Bottone di riapertura del cookie banner: `'discreto'` (default, più piccolo) o `'standard'` come gli altri FAB. */
export type CookieReopenStile = 'discreto' | 'standard';

/** 2 stili nominati per il badge di notifiche non lette (`NotificationBellComponent`): `'numero'`
 *  (default) mostra il conteggio, `'puntino'` solo un indicatore. */
export type BadgeNotifiche = 'numero' | 'puntino';

/** Intensità dell'alone pulsante dei toggle attivi (`.pulse-live`); `'assente'` lo spegne. Default `'lieve'`. */
export type PulsazioneAttiva = 'assente' | 'lieve' | 'marcata';

/** Valori grezzi dietro ogni `PulsazioneAttiva` — SOLO uso interno di `theme-scss.ts`.
 *  `'assente'`: `nome: 'none'` disattiva l'animazione via `animation-name`, gli altri campi sono
 *  ignorati. `'lieve'` è il default. */
export const PULSAZIONE_TIERS: Record<PulsazioneAttiva, { nome: string; spread1: string; trasparenza1: string; spread2: string; trasparenza2: string }> = {
    assente: { nome: 'none', spread1: '0px', trasparenza1: '100%', spread2: '0px', trasparenza2: '100%' },
    lieve: { nome: 'pulseLive', spread1: '4px', trasparenza1: '78%', spread2: '8px', trasparenza2: '55%' },
    marcata: { nome: 'pulseLive', spread1: '6px', trasparenza1: '70%', spread2: '12px', trasparenza2: '40%' },
};

/** Input di `DesignSystemPreset.og.testo` — testo e font correnti dell'immagine OG, PRIMA
 *  di un'eventuale personalizzazione. */
export interface OgTextTransformInput {
    title: string;
    subtitle: string;
    /** Font attivo del sito, già risolto: mai assente (ripiego `SystemFont.Liberation`). */
    font: FontChoice;
}

/** Esito di `DesignSystemPreset.og.testo` — vedi il campo per il contratto su `font`. */
export interface OgTextTransformResult {
    title: string;
    subtitle: string;
    /** Assente: resta il font del sito. */
    font?: FontChoice;
}

/** I colori di un design system oltre al brand; `secondary`/`info` rimpiazzano quelli di Bootstrap. */
export type Palette = { secondary?: string; info?: string } & Record<string, string>;

/** Quanto le superfici prendono il colore del brand, e se c'è il pannello contenuti: con 'distinte', 'tenue' e
 *  'fusione' il pannello non c'è su nessuna pagina, qualunque ruolo. Default (assente) `'foglio'`. */
export type Superfici = 'foglio' | 'distinte' | 'tenue' | 'tenue-flottante' | 'fusione';

/** Il design system, raggruppato per area: ogni gruppo è facoltativo e si fonde campo per campo
 *  con quello del design system esteso. Ciò che il design system risolto (default compresi) lascia
 *  spento resta spento su tutto il sito: un ruolo di pagina può solo spegnere. */
export interface DesignSystemPreset {
    tono?: {
        /** Fissa tutto il sito su un tono, ignorando la preferenza OS. Assente: segue l'OS. */
        forza?: 'light' | 'dark';
        /** Tono del pannello contenuti, `'auto'` = quello del sito. Default `'light'` (`'auto'` con `forza`). */
        pannello?: 'light' | 'dark' | 'auto';
    };
    colori?: {
        /** Quanto le superfici prendono il colore del brand, e se c'è il pannello. Default `'foglio'`. */
        superfici?: Superfici;
        /** Tinta di sfondo e testo al posto del brand; contrasto WCAG sempre garantito. Assente: dal brand. */
        sfondo?: string;
        /** I colori del sito oltre al brand: `secondary` e `info` sostituiscono quelli di Bootstrap, ogni
         *  altro nome ne aggiunge uno (`.btn-<nome>`, `.text-<nome>`, `--color<Nome>`). Fill esatto, testo
         *  leggibile. Nome in camelCase ASCII (`oro`, `oroChiaro`), fuori dai nomi che Bootstrap usa già. */
        palette?: Palette;
    };
    /** Quanto si muove il sito: durata di transizione fra pagine, fade d'ingresso, aperture e alone dei
     *  toggle attivi. `'fermo'` li spegne ovunque, anche nei ruoli che li chiedono. Default `'svelto'`. */
    movimento?: Movimento;
    /** Ombra di dropdown, menu contestuale, cookie banner, FAB e delle barre (navbar, footer, fasce in fondo); raggio d'angolo di dropdown e menu contestuale (i FAB restano tondi). Default `'sospesa'`. */
    elevazione?: Elevazione;
    /** Respiro fra chrome, pannello e contenuto: spazio interno del pannello e distacco da navbar, footer e bordi. Default `'normale'`. */
    densita?: Densita;
    navbar?: {
        /** `false`: niente navbar su nessuna pagina, qualunque ruolo. Default `true`. */
        show?: boolean;
        /** Navbar fissa allo scroll. Default `false`. */
        fissa?: boolean;
        /** `'brand'` (default): superficie immersiva dal brand; `'body'`: come lo sfondo pagina. Vale anche per il footer. */
        superficie?: 'brand' | 'body';
        /** Icona di brand nella navbar; `false` la toglie ovunque, qualunque ruolo. Default `true`. */
        icona?: boolean;
    };
    footer?: {
        /** `false`: niente footer su nessuna pagina, qualunque ruolo. Default `true`. */
        show?: boolean;
    };
    breadcrumb?: {
        /** Breadcrumb sulle pagine (mai sulla home). Default `false`: spento, nessun ruolo lo accende;
         *  `true`: acceso, un ruolo può toglierlo. */
        show?: boolean;
        /** Separatore fra le voci. Default `'traccia'`. */
        stile?: BreadcrumbStile;
        /** Voci oltre le quali il percorso diventa "Home … penultimo ultimo"; `'none'` mai. Intero >= 3. Default `4`. */
        maxVoci?: number | 'none';
    };
    fab?: {
        /** Scroll oltre cui compare "torna su". Default `'standard'`. */
        tornaSuSoglia?: BackToTopSoglia;
        /** Bottone di riapertura del cookie banner. Default `'discreto'`. */
        cookie?: CookieReopenStile;
    };
    /** Larghezza della colonna del pannello contenuti (e del breadcrumb); senza pannello non ha effetto. Default `'ampio'`. */
    larghezza?: ContentWidth;
    /** Badge delle notifiche non lette. Default `'numero'`. */
    badgeNotifiche?: BadgeNotifiche;
    /** Angoli arrotondati sull'immagine ingrandita. Default `true`. */
    lightboxArrotondato?: boolean;
    /** Effetto smoke; senza `enable` non compare su nessuna pagina, qualunque ruolo. */
    smoke?: Partial<SmokePreset>;
    font?: {
        /** Font del sito (web e og:image). Assente: font di sistema. */
        principale?: FontChoice;
        /** Font in più, raggiungibili da SCSS con `--fontFamily-<key>`; non diventano attivi. */
        aggiuntivi?: readonly FontChoice[];
    };
    og?: {
        /** og:image con solo lo sfondo, senza titolo e icona. Default `false`. */
        soloSfondo?: boolean;
        /** Testo/font della sola og:image. Il font ammesso è una voce di `SystemFont` o un font custom
         *  del catalogo (`principale`/`aggiuntivi`, riconosciuto per `key`); un valore diverso è ignorato
         *  (resta il font del sito) con un avviso per ogni valore distinto. */
        testo?: (input: OgTextTransformInput) => OgTextTransformResult;
    };
    /** Comportamento per ruolo di pagina (dizionario aperto: una chiave nuova registra il ruolo). `'naked'` è fisso e non si mappa. */
    ruoloPagina?: Partial<Record<PageRole, SpecRuoloPagina>>;
}

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Come `HEX_COLOR_PATTERN`, ma ammette anche 8 cifre (alpha) — solo `smoke.color` ne ha bisogno. */
const SMOKE_HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Nome di un colore di `colori.palette`: camelCase ASCII (minuscola iniziale, poi lettere e cifre),
 *  così `.btn-<kebab>` e `--color<Pascal>` si ricavano senza ambiguità e senza perdere caratteri. */
const NOME_COLORE_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

/** I token `--color<Nome>` del tema: un colore di `colori.palette` genera `--color<Nome>` e `--color<Nome>Text`, nessuno dei due deve cadere su questi. */
const TOKEN_DI_SISTEMA = new Set([
    'Tema', 'TemaText', 'Primary', 'PrimaryFg', 'PrimaryText', 'Secondary', 'SecondaryText', 'Info', 'InfoText',
    'Base', 'Heading', 'Link', 'Surface', 'SurfaceText', 'SurfaceHover', 'SurfaceBorder',
    'MutedBg', 'MutedText', 'SubtleBg', 'NavBg', 'NavText', 'NavBorder',
].map(t => t.toLowerCase()));

/** Colori di tema di Bootstrap: `secondary` e `info` la palette li rimpiazza, gli altri non sono nomi liberi. */
const COLORI_TEMA_BOOTSTRAP = new Set(['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'light', 'dark']);

/** La mappa `$colors` di Bootstrap (`--bs-blue`, `--bs-gray-dark`...). */
const COLORI_BASE_BOOTSTRAP = new Set([
    'blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'teal', 'cyan',
    'black', 'white', 'gray', 'gray-dark',
]);

/** Segmenti dopo `.btn-`/`.text-`/`.bg-`/`.border-`/`.link-`/... in Bootstrap 5.3: un nome di palette
 *  che inizia con uno di questi collide con una classe di serie (es. `.btn-sm`, `.border-top`). */
const SEGMENTI_CLASSI_BOOTSTRAP = new Set([
    '0', '1', '2', '3', '4', '5', 'action', 'bg', 'black', 'body', 'bottom', 'break', 'capitalize',
    'center', 'check', 'close', 'danger', 'dark', 'decoration', 'dismissible', 'end', 'gradient',
    'group', 'heading', 'info', 'lg', 'light', 'link', 'lowercase', 'md', 'muted', 'nowrap', 'offset',
    'opacity', 'outline', 'primary', 'reset', 'secondary', 'sm', 'start', 'success', 'toolbar', 'top',
    'transparent', 'truncate', 'underline', 'uppercase', 'warning', 'white', 'wrap', 'xl', 'xxl',
]);

/** Variabili `--bs-*` di `:root`/`[data-bs-theme=dark]` di Bootstrap 5.3 che non iniziano con un nome
 *  già escluso sopra: un colore genera `--bs-<nome>` (più `-rgb`, `-text-emphasis`, `-bg-subtle`,
 *  `-border-subtle`) e ne sovrascriverebbe una. */
const VARIABILI_BOOTSTRAP = new Set([
    'font-sans-serif', 'font-monospace', 'emphasis-color', 'emphasis-color-rgb', 'tertiary-color',
    'tertiary-color-rgb', 'tertiary-bg', 'tertiary-bg-rgb', 'code-color', 'highlight-color', 'highlight-bg',
    'border-width', 'border-style', 'border-color', 'border-color-translucent', 'border-radius',
    'border-radius-sm', 'border-radius-lg', 'border-radius-xl', 'border-radius-xxl', 'border-radius-2xl',
    'border-radius-pill', 'box-shadow', 'box-shadow-sm', 'box-shadow-lg', 'box-shadow-inset',
    'focus-ring-width', 'focus-ring-opacity', 'focus-ring-color', 'form-valid-color', 'form-valid-border-color',
    'form-invalid-color', 'form-invalid-border-color', 'breakpoint-xs', 'breakpoint-sm', 'breakpoint-md',
    'breakpoint-lg', 'breakpoint-xl', 'breakpoint-xxl', 'form-select-bg-img', 'form-switch-bg', 'navbar-color',
    'navbar-hover-color', 'navbar-disabled-color', 'navbar-active-color', 'navbar-brand-color',
    'navbar-brand-hover-color', 'navbar-toggler-border-color', 'navbar-toggler-icon-bg', 'accordion-btn-icon',
    'accordion-btn-active-icon', 'btn-close-filter', 'carousel-indicator-active-bg', 'carousel-caption-color',
    'carousel-control-icon-filter',
]);

/** Suffissi che Bootstrap aggiunge al nome di ogni colore di tema (`--bs-oro-rgb`, `.bg-oro-subtle`...). */
const SUFFISSI_DERIVATI = ['rgb', 'subtle', 'emphasis'];

/** `'oroChiaro'` → `'oro-chiaro'` — nome della classe Bootstrap di un colore di `colori.palette`. */
export function toKebabCaseLabel(label: string): string {
    return label
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(part => part.toLowerCase())
        .join('-');
}

/** `'bordeaux'` → `'Bordeaux'` — usata qui e da `theme-scss.ts` per comporre `--color<Label>`. */
export function toPascalCaseLabel(label: string): string {
    return label
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

/** Perché `label` non può essere un colore nuovo di `colori.palette`, o `null` se può. */
function motivoNomeColoreRifiutato(label: string): string | null {
    if (!NOME_COLORE_PATTERN.test(label)) {
        return 'un nome di colore è camelCase ASCII: inizia con una lettera minuscola, poi solo lettere e ' +
            'cifre (es. "oro", "oroChiaro", "blu2") — niente trattini, spazi, accenti o cifra iniziale';
    }
    const kebab = toKebabCaseLabel(label);
    const segmenti = kebab.split('-');
    if (COLORI_TEMA_BOOTSTRAP.has(kebab)) {
        return `"${kebab}" è un colore di tema di Bootstrap (fra questi la palette rimpiazza solo secondary e info)`;
    }
    if (COLORI_BASE_BOOTSTRAP.has(kebab)) {
        return `"${kebab}" è un colore della mappa $colors di Bootstrap (--bs-${kebab})`;
    }
    if (SEGMENTI_CLASSI_BOOTSTRAP.has(segmenti[0])) {
        return `inizia con "${segmenti[0]}", che Bootstrap usa già dopo .btn-/.text-/.bg-/.border-/.link-/.alert- ` +
            `(es. .btn-${segmenti[0]}...): le classi .btn-${kebab}/.text-${kebab} si mescolerebbero a quelle di serie`;
    }
    if (SUFFISSI_DERIVATI.includes(segmenti[segmenti.length - 1])) {
        return `finisce in "-${segmenti[segmenti.length - 1]}", suffisso che Bootstrap aggiunge ai colori di tema ` +
            `(--bs-<nome>-rgb, .bg-<nome>-subtle, .text-<nome>-emphasis)`;
    }
    const variabile = [kebab, ...['rgb', 'text-emphasis', 'bg-subtle', 'border-subtle'].map(s => `${kebab}-${s}`)]
        .find(v => VARIABILI_BOOTSTRAP.has(v));
    if (variabile) return `genererebbe --bs-${variabile}, variabile che Bootstrap usa già`;
    const pascal = toPascalCaseLabel(label).toLowerCase();
    if (TOKEN_DI_SISTEMA.has(pascal) || TOKEN_DI_SISTEMA.has(pascal + 'text')) {
        return `--color${toPascalCaseLabel(label)} o --color${toPascalCaseLabel(label)}Text è già un token del tema`;
    }
    return null;
}

/** Valida `colori.palette`: valori hex, nomi ammessi, nessuna collisione fra due voci dopo la conversione in classi e token. */
function checkPalette(name: string, palette: unknown): void {
    if (palette == null) return;
    if (typeof palette !== 'object' || Array.isArray(palette)) {
        throw new Error(`[DesignSystem] "${name}".colori.palette deve essere un oggetto { nome: "#RRGGBB" }.`);
    }
    const classi = new Map<string, string>();
    const token = new Map<string, string>();
    for (const [label, value] of Object.entries(palette)) {
        if (value === undefined) continue;
        if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
            throw new Error(
                `[DesignSystem] "${name}".colori.palette["${label}"]=${JSON.stringify(value)} non è un colore hex ` +
                `valido (atteso #RGB o #RRGGBB, es. "#5c1a2b" — niente canale alpha).`
            );
        }
        // secondary/info sono i colori di Bootstrap che la palette rimpiazza: niente controlli di nome.
        if (label === 'secondary' || label === 'info') continue;
        const motivo = motivoNomeColoreRifiutato(label);
        if (motivo) {
            throw new Error(`[DesignSystem] "${name}".colori.palette["${label}"]: nome non ammesso — ${motivo}. Scegli un'altra etichetta.`);
        }
        const kebab = toKebabCaseLabel(label);
        const altraClasse = classi.get(kebab);
        if (altraClasse) {
            throw new Error(
                `[DesignSystem] "${name}".colori.palette: "${altraClasse}" e "${label}" diventano entrambi le classi ` +
                `.btn-${kebab}/.text-${kebab}. Tieni uno solo dei due nomi.`
            );
        }
        classi.set(kebab, label);
        const pascal = toPascalCaseLabel(label);
        for (const t of [pascal, pascal + 'Text']) {
            const altroToken = token.get(t.toLowerCase());
            if (altroToken) {
                throw new Error(
                    `[DesignSystem] "${name}".colori.palette: "${altroToken}" e "${label}" generano entrambi il token ` +
                    `--color${t}. Tieni uno solo dei due nomi.`
                );
            }
            token.set(t.toLowerCase(), label);
        }
    }
}

/** Valori ammessi di un campo enumerato; il `Record` obbliga a elencarli tutti. */
function valoriDi<T extends string>(valori: Record<T, unknown>): readonly string[] {
    return Object.keys(valori);
}

/** Regola di un campo: valori ammessi, booleano, funzione, oppure `'a parte'` (validato da codice dedicato). */
type RegolaCampo = readonly string[] | 'boolean' | 'function' | 'a parte';

/** I gruppi del design system: si fondono campo per campo, non si sostituiscono interi. */
const GRUPPI = ['tono', 'colori', 'navbar', 'footer', 'breadcrumb', 'fab', 'font', 'og', 'smoke'] as const;
type Gruppo = typeof GRUPPI[number];

/** Campi di ogni gruppo e loro regola: i tipi obbligano a elencarli tutti, e solo quelli. */
const REGOLE_GRUPPI: { [G in Gruppo]: Record<keyof NonNullable<DesignSystemPreset[G]>, RegolaCampo> } = {
    tono: {
        forza: valoriDi<'light' | 'dark'>({ light: 1, dark: 1 }),
        pannello: valoriDi<'light' | 'dark' | 'auto'>({ light: 1, dark: 1, auto: 1 }),
    },
    colori: {
        superfici: valoriDi<Superfici>({ foglio: 1, distinte: 1, tenue: 1, 'tenue-flottante': 1, fusione: 1 }),
        sfondo: 'a parte',
        palette: 'a parte',
    },
    navbar: { show: 'boolean', fissa: 'boolean', superficie: valoriDi<'brand' | 'body'>({ brand: 1, body: 1 }), icona: 'boolean' },
    footer: { show: 'boolean' },
    breadcrumb: { show: 'boolean', stile: valoriDi(BREADCRUMB_SEPARATORE), maxVoci: 'a parte' },
    fab: { tornaSuSoglia: valoriDi(BACK_TO_TOP_SOGLIA_PX), cookie: valoriDi<CookieReopenStile>({ discreto: 1, standard: 1 }) },
    font: { principale: 'a parte', aggiuntivi: 'a parte' },
    og: { soloSfondo: 'boolean', testo: 'function' },
    smoke: { enable: 'boolean', color: 'a parte', opacity: 'a parte', intensita: valoriDi(SMOKE_INTENSITY) },
};

/** Campi fuori dai gruppi e loro regola. */
const REGOLE_RADICE: Record<Exclude<keyof DesignSystemPreset, Gruppo>, RegolaCampo> = {
    movimento: valoriDi(MOVIMENTO_DURATA),
    elevazione: valoriDi(ELEVAZIONE_TIERS),
    densita: valoriDi(DENSITA_TIERS),
    larghezza: valoriDi(CONTENT_WIDTH_CLASSES),
    badgeNotifiche: valoriDi<BadgeNotifiche>({ numero: 1, puntino: 1 }),
    lightboxArrotondato: 'boolean',
    ruoloPagina: 'a parte',
};

/** Campi di `SpecRuoloPagina`, tutti booleani. */
const CAMPI_RUOLO: Record<keyof SpecRuoloPagina, true> = {
    showNav: true, showFooter: true, showPanel: true, fitViewport: true,
    showSmoke: true, showBreadcrumb: true, pageFade: true, showBrandIcon: true,
};

function isOggetto(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Controlla un campo contro la sua regola; `undefined` vale "non specificato" e passa sempre. */
function checkCampo(name: string, path: string, value: unknown, regola: RegolaCampo): void {
    if (value === undefined || regola === 'a parte') return;
    if (regola === 'boolean') {
        if (typeof value !== 'boolean') {
            throw new Error(`[DesignSystem] "${name}".${path}=${JSON.stringify(value)} non valido: atteso true o false.`);
        }
        return;
    }
    if (regola === 'function') {
        if (typeof value !== 'function') {
            throw new Error(`[DesignSystem] "${name}".${path} deve essere una funzione.`);
        }
        return;
    }
    if (typeof value !== 'string' || !regola.includes(value)) {
        throw new Error(
            `[DesignSystem] "${name}".${path}=${JSON.stringify(value)} non valido: valori ammessi ` +
            `${regola.map(v => `'${v}'`).join(', ')}.`
        );
    }
}

/** Nessun campo fuori da `ammessi`: un nome sbagliato non passa ignorato in silenzio. */
function checkCampiNoti(name: string, path: string, obj: Record<string, unknown>, ammessi: readonly string[]): void {
    for (const key of Object.keys(obj)) {
        if (!ammessi.includes(key)) {
            throw new Error(
                `[DesignSystem] "${name}".${path}${key}: campo sconosciuto (campi ammessi: ${ammessi.join(', ')}).`
            );
        }
    }
}

/** Valida `ruoloPagina`: oggetto di ruoli, ogni ruolo con soli campi booleani di `SpecRuoloPagina`, niente `'naked'`. */
function checkRuoloPagina(name: string, ruoli: unknown): void {
    if (ruoli === undefined) return;
    if (!isOggetto(ruoli)) {
        throw new Error(`[DesignSystem] "${name}".ruoloPagina deve essere un oggetto { ruolo: { ... } }.`);
    }
    for (const [role, spec] of Object.entries(ruoli)) {
        if (role === 'naked') {
            throw new Error(
                `[DesignSystem] "${name}".ruoloPagina.naked non è ammesso: il ruolo 'naked' è fisso (niente ` +
                `navbar, footer, pannello, breadcrumb né smoke) e nessun design system lo personalizza. ` +
                `Per una variante registra un ruolo custom con un altro nome.`
            );
        }
        if (spec === undefined) continue;
        if (!isOggetto(spec)) {
            throw new Error(`[DesignSystem] "${name}".ruoloPagina.${role} deve essere un oggetto (es. { showNav: false }).`);
        }
        checkCampiNoti(name, `ruoloPagina.${role}.`, spec, Object.keys(CAMPI_RUOLO));
        for (const [field, value] of Object.entries(spec)) checkCampo(name, `ruoloPagina.${role}.${field}`, value, 'boolean');
    }
}

/** Valida un design system risolto (campi noti, valori ammessi, hex validi, nomi di palette, font): chiamata a ogni esecuzione della factory di `extendDesignSystem`. */
export function validateDesignSystemPreset(name: string, preset: DesignSystemPreset): void {
    const raw = preset as Record<string, unknown>;
    checkCampiNoti(name, '', raw, [...GRUPPI, ...Object.keys(REGOLE_RADICE)]);
    for (const [field, regola] of Object.entries(REGOLE_RADICE)) checkCampo(name, field, raw[field], regola);
    for (const gruppo of GRUPPI) {
        const valore = raw[gruppo];
        if (valore === undefined) continue;
        if (!isOggetto(valore)) {
            throw new Error(`[DesignSystem] "${name}".${gruppo} deve essere un oggetto.`);
        }
        const regole: Record<string, RegolaCampo> = REGOLE_GRUPPI[gruppo];
        checkCampiNoti(name, `${gruppo}.`, valore, Object.keys(regole));
        for (const [field, regola] of Object.entries(regole)) checkCampo(name, `${gruppo}.${field}`, valore[field], regola);
    }
    checkRuoloPagina(name, preset.ruoloPagina);

    const colori = preset.colori ?? {};
    if (colori.sfondo != null && (typeof colori.sfondo !== 'string' || !HEX_COLOR_PATTERN.test(colori.sfondo))) {
        throw new Error(
            `[DesignSystem] "${name}".colori.sfondo=${JSON.stringify(colori.sfondo)} non è un colore hex valido ` +
            `(atteso #RGB o #RRGGBB, es. "#131e55" — niente canale alpha).`
        );
    }
    checkPalette(name, colori.palette);

    const smoke = preset.smoke;
    if (smoke?.color != null && (typeof smoke.color !== 'string' || !SMOKE_HEX_COLOR_PATTERN.test(smoke.color))) {
        throw new Error(
            `[DesignSystem] "${name}".smoke.color=${JSON.stringify(smoke.color)} non è un colore hex valido ` +
            `(atteso #RGB, #RRGGBB o #RRGGBBAA, es. "#b5d9ff").`
        );
    }
    if (smoke?.opacity !== undefined
        && (typeof smoke.opacity !== 'number' || !Number.isFinite(smoke.opacity) || smoke.opacity < 0 || smoke.opacity > 1)) {
        throw new Error(`[DesignSystem] "${name}".smoke.opacity=${String(smoke.opacity)} non valido: atteso un numero fra 0 e 1.`);
    }
    const maxItems = preset.breadcrumb?.maxVoci;
    if (maxItems !== undefined && maxItems !== 'none' && (!Number.isInteger(maxItems) || maxItems < 3)) {
        throw new Error(
            `[DesignSystem] "${name}".breadcrumb.maxVoci=${JSON.stringify(maxItems)} non valido: deve essere un ` +
            `intero >= 3 (il troncamento mostra Home, "…", penultimo e ultimo: sotto 3 voci non c'è nulla ` +
            `da nascondere) oppure la stringa 'none'.`
        );
    }
    const principale = preset.font?.principale;
    if (principale != null) {
        if (typeof principale === 'string') {
            if (!isSystemFont(principale)) {
                throw new Error(`[DesignSystem] "${name}".font.principale: "${principale}" non è una voce di SystemFont valida.`);
            }
        } else {
            checkCustomFontDef(name, 'font.principale', principale);
        }
    }
    const aggiuntivi: unknown = preset.font?.aggiuntivi ?? [];
    if (!Array.isArray(aggiuntivi)) {
        throw new Error(`[DesignSystem] "${name}".font.aggiuntivi deve essere un array di font.`);
    }
    const seenKeys = new Set<string>();
    for (const addon of aggiuntivi as readonly FontChoice[]) {
        // Voce SystemFont: già una voce reale del catalogo (garantito da tsc — vedi FontChoice),
        // nessun campo da validare. Un guard a runtime resta comunque utile a chi bypassa i tipi.
        if (typeof addon === 'string') {
            if (!isSystemFont(addon)) {
                throw new Error(`[DesignSystem] "${name}".font.aggiuntivi: "${addon}" non è una voce di SystemFont valida.`);
            }
            if (seenKeys.has(addon)) {
                throw new Error(`[DesignSystem] "${name}".font.aggiuntivi: key "${addon}" duplicata.`);
            }
            seenKeys.add(addon);
            continue;
        }
        checkCustomFontDef(name, 'font.aggiuntivi', addon);
        if (seenKeys.has(addon.key)) {
            throw new Error(`[DesignSystem] "${name}".font.aggiuntivi: key "${addon.key}" duplicata.`);
        }
        seenKeys.add(addon.key);
    }
}

/** Nome di file di una faccia: solo il nome, senza cartelle, con estensione di font. */
const FONT_FILE_PATTERN = /^[^\\/:*?"<>|\x00-\x1f]+\.(ttf|otf|woff|woff2)$/i;

/** Caratteri che romperebbero la `font-family` nel CSS generato. */
const FONT_FAMILY_VIETATI = /["\\;{}<>\r\n]/;

/** Valida un `CustomFontDef`, come `font.principale` o voce di `font.aggiuntivi` (scelte indipendenti). */
function checkCustomFontDef(name: string, fieldLabel: string, font: CustomFontDef): void {
    if (!isOggetto(font)) {
        throw new Error(`[DesignSystem] "${name}".${fieldLabel}: atteso una voce di SystemFont o un oggetto { key, family, faces }.`);
    }
    if (typeof font.key !== 'string' || !CUSTOM_FONT_KEY_PATTERN.test(font.key)) {
        throw new Error(
            `[DesignSystem] "${name}".${fieldLabel}: key ${JSON.stringify(font.key)} non valida (atteso ` +
            `[a-zA-Z0-9_-]+ — finisce in un URL e in una variabile CSS).`
        );
    }
    if (isSystemFont(font.key)) {
        throw new Error(
            `[DesignSystem] "${name}".${fieldLabel}: key "${font.key}" coincide con una voce di ` +
            `SystemFont — scegline un'altra, l'endpoint non potrebbe distinguerle.`
        );
    }
    if (typeof font.family !== 'string' || font.family.trim() === '' || FONT_FAMILY_VIETATI.test(font.family)) {
        throw new Error(
            `[DesignSystem] "${name}".${fieldLabel}["${font.key}"].family=${JSON.stringify(font.family)} non valida: ` +
            `atteso un nome di font non vuoto, senza virgolette doppie, backslash, ";", "{", "}", "<", ">" né a capo.`
        );
    }
    if (!Array.isArray(font.faces) || font.faces.length === 0) {
        throw new Error(`[DesignSystem] "${name}".${fieldLabel}["${font.key}"]: nessuna faccia dichiarata (almeno la regular).`);
    }
    font.faces.forEach((face, index) => {
        const path = `[DesignSystem] "${name}".${fieldLabel}["${font.key}"].faces[${index}]`;
        if (typeof face?.file !== 'string' || !FONT_FILE_PATTERN.test(face.file) || face.file.includes('..')) {
            throw new Error(
                `${path}.file=${JSON.stringify(face?.file)} non valido: atteso il solo nome di un file nella cartella ` +
                `fonts/ (niente cartelle, "/", "\\" o ".."), con estensione .ttf, .otf, .woff o .woff2 (es. "MioFont.woff2").`
            );
        }
        if (face.weight !== 400 && face.weight !== 700) {
            throw new Error(`${path}.weight=${JSON.stringify(face.weight)} non valido: valori ammessi 400, 700.`);
        }
        if (face.style !== 'normal' && face.style !== 'italic') {
            throw new Error(`${path}.style=${JSON.stringify(face.style)} non valido: valori ammessi 'normal', 'italic'.`);
        }
    });
}

/** Un design system è una funzione, non un dato — stesso idioma di `pages: () => [...]` in site.ts. */
export type DesignSystemFactory = () => DesignSystemPreset;

/** Punto di partenza minimo per `extendDesignSystem` — nessun campo forzato. Usato dai preset pronti e da chi parte da zero. */
export const emptyDesignSystem: DesignSystemFactory = () => ({});

/** Design system con ogni default applicato (= `ContestoSito.config.aspetto`); ogni campo ha un
 *  valore tranne quattro la cui assenza è essa stessa una scelta (`tono.forza`, `colori.sfondo`, `font.principale`, `og.testo`). */
export interface Aspetto {
    tono: { forza?: 'light' | 'dark'; pannello: 'light' | 'dark' | 'auto' };
    colori: {
        superfici: Superfici;
        sfondo?: string;
        palette: Palette;
        /** Quanto le superfici prendono la lucentezza del brand (0-1), da `superfici`. */
        vividezza: number;
    };
    /** C'è il pannello contenuti, da `colori.superfici`. */
    pannello: boolean;
    movimento: Movimento;
    /** Transizioni fra pagine e fade d'ingresso: tutto tranne `movimento: 'fermo'`. */
    transizioni: boolean;
    /** Alone dei toggle attivi, dal movimento: spento da fermo, più ampio se morbido. */
    pulsazione: PulsazioneAttiva;
    elevazione: Elevazione;
    densita: Densita;
    navbar: { show: boolean; fissa: boolean; superficie: 'brand' | 'body'; icona: boolean };
    footer: { show: boolean };
    breadcrumb: { show: boolean; stile: BreadcrumbStile; maxVoci: number | 'none' };
    fab: { tornaSuSoglia: BackToTopSoglia; cookie: CookieReopenStile };
    larghezza: ContentWidth;
    badgeNotifiche: BadgeNotifiche;
    lightboxArrotondato: boolean;
    smoke: SmokeSettings;
    font: { principale?: FontChoice; aggiuntivi: readonly FontChoice[] };
    og: { soloSfondo: boolean; testo?: (input: OgTextTransformInput) => OgTextTransformResult };
}

/** 0 = nero/bianco appena tinto, 1 = superfici con la lucentezza del brand, 0.5 a metà strada. */
function vividezzaDi(superfici: Superfici): number {
    switch (superfici) {
        case 'fusione': return 1;
        case 'tenue': case 'tenue-flottante': return 0.5;
        default: return 0;
    }
}

/** Con 'distinte', 'tenue' e 'fusione' il pannello non c'è: su 'fusione' un foglio di qualunque tono vanificherebbe la fusione. */
export function superficiConPannello(superfici: Superfici | undefined): boolean {
    return superfici !== 'distinte' && superfici !== 'tenue' && superfici !== 'fusione';
}

/** Applica i default a un design system risolto (o all'assenza di uno). */
export function risolviAspetto(preset: DesignSystemPreset | undefined): Aspetto {
    const p = preset ?? {};
    const superfici = p.colori?.superfici ?? 'foglio';
    const movimento = p.movimento ?? 'svelto';
    return {
        // Con un tono forzato il pannello segue il sito, invece di una card chiara che nessuno ha chiesto.
        tono: { forza: p.tono?.forza, pannello: p.tono?.pannello ?? (p.tono?.forza ? 'auto' : 'light') },
        colori: { superfici, sfondo: p.colori?.sfondo, palette: { ...p.colori?.palette }, vividezza: vividezzaDi(superfici) },
        pannello: superficiConPannello(superfici),
        movimento,
        transizioni: movimento !== 'fermo',
        pulsazione: movimento === 'fermo' ? 'assente' : movimento === 'morbido' ? 'marcata' : 'lieve',
        elevazione: p.elevazione ?? 'sospesa',
        densita: p.densita ?? 'normale',
        navbar: {
            show: p.navbar?.show ?? true,
            fissa: p.navbar?.fissa ?? false,
            superficie: p.navbar?.superficie ?? 'brand',
            icona: p.navbar?.icona ?? true,
        },
        footer: { show: p.footer?.show ?? true },
        breadcrumb: { show: p.breadcrumb?.show ?? false, stile: p.breadcrumb?.stile ?? 'traccia', maxVoci: p.breadcrumb?.maxVoci ?? 4 },
        fab: { tornaSuSoglia: p.fab?.tornaSuSoglia ?? 'standard', cookie: p.fab?.cookie ?? 'discreto' },
        larghezza: p.larghezza ?? 'ampio',
        badgeNotifiche: p.badgeNotifiche ?? 'numero',
        lightboxArrotondato: p.lightboxArrotondato ?? true,
        smoke: {
            enable: p.smoke?.enable ?? false,
            color: p.smoke?.color ?? '#ffffff',
            opacity: p.smoke?.opacity ?? 0.5,
            ...SMOKE_INTENSITY[p.smoke?.intensita ?? 'pulviscolo'],
        },
        font: { principale: p.font?.principale, aggiuntivi: p.font?.aggiuntivi ?? [] },
        og: { soloSfondo: p.og?.soloSfondo ?? false, testo: p.og?.testo },
    };
}

/** Copia di `obj` senza i campi `undefined`: in un patch `undefined` vale "non specificato", quindi resta il valore di `base`. */
function definiti<T extends object>(obj: T | undefined): Partial<T> {
    return Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** `patch` vince campo per campo su `base`; dentro un gruppo, un campo assente o `undefined` lascia quello di `base`. */
function mergeDesignSystemPreset(base: DesignSystemPreset, patch: Partial<DesignSystemPreset>): DesignSystemPreset {
    const merged: Record<string, unknown> = { ...base, ...definiti(patch) };
    for (const gruppo of GRUPPI) {
        if (base[gruppo] || patch[gruppo]) merged[gruppo] = { ...base[gruppo], ...definiti(patch[gruppo]) };
    }
    const result = merged as DesignSystemPreset;
    if (base.colori?.palette || patch.colori?.palette) {
        result.colori = { ...result.colori, palette: { ...base.colori?.palette, ...definiti(patch.colori?.palette) } as Palette };
    }
    // Ogni ruolo presente da un lato o dall'altro, anche uno custom del base non toccato dal patch.
    if (base.ruoloPagina || patch.ruoloPagina) {
        const roles = new Set([...Object.keys(base.ruoloPagina ?? {}), ...Object.keys(patch.ruoloPagina ?? {})]) as Set<PageRole>;
        const ruoli: Partial<Record<PageRole, SpecRuoloPagina>> = {};
        for (const role of roles) {
            const own = (r: Partial<Record<PageRole, SpecRuoloPagina>> | undefined) =>
                r && Object.hasOwn(r, role) ? r[role] : undefined;
            ruoli[role] = { ...own(base.ruoloPagina), ...definiti(own(patch.ruoloPagina)) };
        }
        result.ruoloPagina = ruoli;
    }
    return result;
}

/** Campi di `P` che `T` non conosce, portati a `never`. */
type SoloCampiNoti<T, P> = { [K in Exclude<keyof P, keyof T>]: never };

/** La patch restituita da una funzione così com'è scritta (`P`), purché sia un `Partial<DesignSystemPreset>`
 *  senza campi sconosciuti alla radice, nei gruppi e nei ruoli: il controllo che una patch-oggetto
 *  ha già dai campi in eccesso di TypeScript. */
type PatchEsatta<P> = P & Partial<DesignSystemPreset>
    & SoloCampiNoti<DesignSystemPreset, P>
    & { [G in keyof P & Gruppo]?: SoloCampiNoti<NonNullable<DesignSystemPreset[G]>, NonNullable<P[G]>> }
    & { [K in keyof P & 'ruoloPagina']?: { [R in keyof NonNullable<P[K]>]?: SoloCampiNoti<SpecRuoloPagina, NonNullable<NonNullable<P[K]>[R]>> } };

/** L'unico modo di scrivere un design system: `extendDesignSystem(base, { ...patch })`, patch piatto o funzione del base risolto. */
export function extendDesignSystem<const P>(
    base: DesignSystemFactory,
    patch: Partial<DesignSystemPreset> | ((resolved: DesignSystemPreset) => PatchEsatta<P>),
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
