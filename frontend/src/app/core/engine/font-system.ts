/**
 * FONT SYSTEM (Engine) — catalogo, tipi, risoluzione. La scelta del progetto è una decisione
 * estetica come colore/pannello/nav: vive nel design system attivo (`DesignSystemPreset.
 * defaultFont`/`addonFonts`, `design-system-presets.ts`), non in un file separato — cambiare
 * design system cambia anche il font, di proposito. Un solo font per l'intero sito: nessun campo
 * dedicato per un font diverso sui titoli — chi lo vuole registra quel font in `addonFonts` (un
 * `SystemFont` o un font caricato) e scrive la regola CSS su `h1`-`h6` a mano, come qualunque altra
 * personalizzazione di progetto (`--fontFamily-<key>`, vedi `CustomFontVar`).
 *
 * UN meccanismo per ogni font, di sistema o di progetto: `FontChoice` (= `SystemFont` o un
 * `CustomFontDef` pieno) è risolto sempre allo stesso modo — self-hosted via `@font-face`, file
 * reali serviti da `/cdn-cgi/font/:key/:index` (`server/routes/system-font.ts`) — e lo stesso file
 * è quello che il rendering server delle immagini OG usa per nome via fontconfig (`PreviewBuilder`).
 * Prima di questo file `WEB_FONTS` (nomi di sistema come "Times New Roman"/"Georgia" — sperati
 * sull'OS del visitatore, mai garantiti) e `SERVER_FONTS` (font realmente installati nel
 * container, ma un catalogo scollegato) erano due scelte indipendenti: un preset poteva mostrare
 * in pagina un serif generico su un OS senza Times, mentre l'immagine di anteprima social usava
 * tutt'altro font. Un font custom di progetto era poi un TERZO meccanismo ancora (`/assets/fonts/`,
 * un solo file, gestito a parte). `SystemFont`+`CustomFontDef` chiudono entrambi i divari: stesso
 * endpoint, stessa forma (chiave → famiglia → facce), sia per gli 11 font già nel container
 * (Apache/OFL, `apk add` nel Dockerfile) sia per quelli caricati dal progetto in `fonts/`.
 */

/** Percorso radice dei font di sistema nel container — installati da `apk add font-roboto
 *  font-noto font-liberation font-dejavu font-opensans font-jetbrains-mono` (`frontend/Dockerfile`).
 *  Verificato contro il contenuto REALE dei 6 pacchetti Alpine (non un percorso indovinato):
 *  stabile da Alpine v3.18 a edge (i primi 4); Open Sans/JetBrains Mono verificati su v3.24. */
const FONTS_ROOT = '/usr/share/fonts';

/** Catalogo dei font di sistema disponibili — enum, non stringhe magiche: `SystemFont.Roboto`.
 *  11 voci invece di 6 pacchetti: quasi ogni pacchetto Alpine installato porta in realtà famiglia
 *  Sans+Serif+Mono complete (scoperto verificando il contenuto reale dei pacchetti), non solo il
 *  Sans che il vecchio `SERVER_FONTS` esponeva — `LiberationSerif`/`LiberationMono` sono il vero
 *  sostituto open di Times New Roman/Courier New, non un parente alla lontana. Open Sans e
 *  JetBrains Mono, aggiunti dopo, sono invece pacchetti mono-famiglia (nessuna variante Serif/Mono
 *  sorella da esporre in più). Candidati scartati allo stesso giro — Nunito e Inter — perché Alpine
 *  li impacchetta SOLO come font variabili (un unico file, asse di peso continuo, non 4 file statici
 *  regular/bold/italic/bold-italic come richiede `SystemFontFace`): Inter arriva anche come
 *  `Inter.ttc`, una collection con le istanze statiche giuste, ma senza un modo affidabile in CSS
 *  (`@font-face`) di indirizzare UNA faccia dentro un `.ttc` — servirebbe o supporto ai font
 *  variabili (un asse di peso, non 4 file) o uno step di estrazione delle istanze statiche in build:
 *  entrambe estensioni reali di questo file, non un'aggiunta al catalogo, quindi non fatte qui. */
export enum SystemFont {
    Roboto = 'Roboto',
    Noto = 'Noto',
    NotoSerif = 'NotoSerif',
    Liberation = 'Liberation',
    LiberationSerif = 'LiberationSerif',
    LiberationMono = 'LiberationMono',
    DejaVu = 'DejaVu',
    DejaVuSerif = 'DejaVuSerif',
    DejaVuMono = 'DejaVuMono',
    OpenSans = 'OpenSans',
    JetBrainsMono = 'JetBrainsMono',
}

const SYSTEM_FONT_VALUES: ReadonlySet<string> = new Set(Object.values(SystemFont));

/** True se `key` è una voce del catalogo di sistema — altrimenti è la `key` di un `CustomFontDef`
 *  di progetto (risolta da un `FontChoice` con `choiceKey()`, sotto). Un solo controllo, usato
 *  ovunque serva distinguere i due casi (risoluzione, metriche, endpoint). */
export function isSystemFont(key: string): key is SystemFont {
    return SYSTEM_FONT_VALUES.has(key);
}

/** Una variante (peso/stile) di un font — un file reale, di sistema (percorso assoluto nel
 *  container) o di progetto (nome file dentro `fonts/`, risolto altrove — vedi
 *  `CustomFontFace`). */
export interface SystemFontFace {
    /** Percorso assoluto nel container. */
    file: string;
    weight: 400 | 700;
    style: 'normal' | 'italic';
}

/** Definizione completa di un font di sistema: nome CSS/fontconfig, famiglia generica di
 *  fallback, e le 4 varianti regular/bold/italic/bold-italic (tutte presenti per queste 11 voci). */
export interface SystemFontDef {
    /** Nome CSS della font-family, uguale al nome che fontconfig risolve lato server. */
    family: string;
    generic: 'sans-serif' | 'serif' | 'monospace';
    faces: readonly [regular: SystemFontFace, bold: SystemFontFace, italic: SystemFontFace, boldItalic: SystemFontFace];
}

/** Il catalogo. Percorsi verificati contro il contenuto reale dei pacchetti Alpine (non
 *  indovinati) — vedi nota di testa. Aggiungerne uno: una voce qui + l'installazione nel
 *  Dockerfile (`apk add`) + rigenerare le metriche di fallback (`services/font-metrics.ts`,
 *  derivabili dai file reali, vedi commento lì). */
export const SYSTEM_FONTS: Record<SystemFont, SystemFontDef> = {
    [SystemFont.Roboto]: {
        family: 'Roboto', generic: 'sans-serif',
        faces: [
            { file: `${FONTS_ROOT}/roboto/Roboto-Regular.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/roboto/Roboto-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/roboto/Roboto-Italic.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/roboto/Roboto-BoldItalic.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.Noto]: {
        family: 'Noto Sans', generic: 'sans-serif',
        faces: [
            { file: `${FONTS_ROOT}/noto/NotoSans-Regular.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/noto/NotoSans-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/noto/NotoSans-Italic.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/noto/NotoSans-BoldItalic.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.NotoSerif]: {
        family: 'Noto Serif', generic: 'serif',
        faces: [
            { file: `${FONTS_ROOT}/noto/NotoSerif-Regular.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/noto/NotoSerif-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/noto/NotoSerif-Italic.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/noto/NotoSerif-BoldItalic.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.Liberation]: {
        family: 'Liberation Sans', generic: 'sans-serif',
        faces: [
            { file: `${FONTS_ROOT}/liberation/LiberationSans-Regular.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/liberation/LiberationSans-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/liberation/LiberationSans-Italic.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/liberation/LiberationSans-BoldItalic.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.LiberationSerif]: {
        family: 'Liberation Serif', generic: 'serif',
        faces: [
            { file: `${FONTS_ROOT}/liberation/LiberationSerif-Regular.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/liberation/LiberationSerif-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/liberation/LiberationSerif-Italic.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/liberation/LiberationSerif-BoldItalic.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.LiberationMono]: {
        family: 'Liberation Mono', generic: 'monospace',
        faces: [
            { file: `${FONTS_ROOT}/liberation/LiberationMono-Regular.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/liberation/LiberationMono-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/liberation/LiberationMono-Italic.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/liberation/LiberationMono-BoldItalic.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.DejaVu]: {
        family: 'DejaVu Sans', generic: 'sans-serif',
        // Regular senza suffisso, "Oblique" (non "Italic") per lo stile inclinato — convenzione
        // di naming del solo ramo Sans/Mono di DejaVu, diversa dal ramo Serif qui sotto.
        faces: [
            { file: `${FONTS_ROOT}/dejavu/DejaVuSans.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/dejavu/DejaVuSans-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/dejavu/DejaVuSans-Oblique.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/dejavu/DejaVuSans-BoldOblique.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.DejaVuSerif]: {
        family: 'DejaVu Serif', generic: 'serif',
        // Qui invece "Italic" vero, non "Oblique" — DejaVu Serif ha un corsivo disegnato apposta.
        faces: [
            { file: `${FONTS_ROOT}/dejavu/DejaVuSerif.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/dejavu/DejaVuSerif-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/dejavu/DejaVuSerif-Italic.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/dejavu/DejaVuSerif-BoldItalic.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.DejaVuMono]: {
        family: 'DejaVu Sans Mono', generic: 'monospace',
        faces: [
            { file: `${FONTS_ROOT}/dejavu/DejaVuSansMono.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/dejavu/DejaVuSansMono-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/dejavu/DejaVuSansMono-Oblique.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/dejavu/DejaVuSansMono-BoldOblique.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.OpenSans]: {
        family: 'Open Sans', generic: 'sans-serif',
        faces: [
            { file: `${FONTS_ROOT}/opensans/OpenSans-Regular.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/opensans/OpenSans-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/opensans/OpenSans-Italic.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/opensans/OpenSans-BoldItalic.ttf`, weight: 700, style: 'italic' },
        ],
    },
    [SystemFont.JetBrainsMono]: {
        family: 'JetBrains Mono', generic: 'monospace',
        faces: [
            { file: `${FONTS_ROOT}/jetbrains-mono/JetBrainsMono-Regular.ttf`, weight: 400, style: 'normal' },
            { file: `${FONTS_ROOT}/jetbrains-mono/JetBrainsMono-Bold.ttf`, weight: 700, style: 'normal' },
            { file: `${FONTS_ROOT}/jetbrains-mono/JetBrainsMono-Italic.ttf`, weight: 400, style: 'italic' },
            { file: `${FONTS_ROOT}/jetbrains-mono/JetBrainsMono-BoldItalic.ttf`, weight: 700, style: 'italic' },
        ],
    },
};

/** Fallback emoji comune a ogni stack (Apple/Segoe, a colori). */
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji"';

/** Compone uno stack CSS: famiglie + fallback emoji + famiglia generica. */
const stack = (families: string, generic: 'sans-serif' | 'serif' | 'monospace' = 'sans-serif'): string =>
    `${families}, ${EMOJI}, ${generic}`;

/** Stack CSS di un `SystemFont` — stessa risoluzione usata internamente da `resolveFonts()`, ma
 *  per un consumer che vuole UN font specifico invece del font attivo del design system
 *  (es. `ImgBuildOptions.fontFamily`, `img-builder.service.ts`: un'immagine generata può chiedere
 *  esplicitamente un font diverso da quello del sito). */
export function systemFontWebStack(key: SystemFont): string {
    const def = SYSTEM_FONTS[key];
    return stack(`"${def.family}"`, def.generic);
}

/** Stack CSS per una `family` di font custom arbitraria — stesso fallback emoji/generic-family di
 *  `systemFontWebStack`, nessun `generic` dichiarabile per un font custom (stessa scelta neutra di
 *  `familyAndGenericFor` sotto). Usato da `custom-font-detect.ts` per costruire lo stack server di
 *  QUALUNQUE `CustomFontDef`, non solo quello attivo del sito. */
export function customFontWebStack(family: string): string {
    return stack(`"${family}"`, 'sans-serif');
}

/** L'unico stack "di sistema" rimasto — nessun self-hosting, nessuna opinione: quello che l'OS
 *  del visitatore offre di default. Usato SOLO quando un design system non imposta `defaultFont`
 *  (es. `aria.design-system.ts`, di proposito). */
const SYSTEM_UI_STACK = stack('system-ui, "Segoe UI", Arial');

/** Pattern per `CustomFontDef.key`: finisce in un path URL (`/cdn-cgi/font/:key/...`) e in un
 *  nome di variabile CSS (`--fontFamily-<key>`) — mai libero di contenere caratteri arbitrari.
 *  Validato da `validateDesignSystemPreset` (design-system-presets.ts). */
export const CUSTOM_FONT_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Una variante di un font caricato dal progetto — file nella cartella `fonts/` (accanto a
 *  `global-settings.json`), risolto a percorso assoluto da `custom-font-detect.ts`. */
export interface CustomFontFace {
    /** Nome del file nella cartella `fonts/` (es. 'Marlboro.woff2'). */
    file: string;
    weight: 400 | 700;
    style: 'normal' | 'italic';
}

/**
 * Font caricato dal progetto — stessa forma di `SystemFontDef` (chiave, famiglia, facce), stesso
 * endpoint di servizio (`/cdn-cgi/font/:key/:index`), STESSO meccanismo del catalogo di sistema.
 * Un valore di `CustomFontDef` è un `FontChoice` a tutti gli effetti — si scrive direttamente
 * come `defaultFont` (il font del sito) o come voce di `addonFonts` (un font aggiuntivo, servito e
 * raggiungibile via `--fontFamily-<key>` ma mai attivo di per sé): stesso identico oggetto, cambia
 * solo dove lo scrivi.
 */
export interface CustomFontDef {
    /** Chiave con cui è esposto — vedi `CUSTOM_FONT_KEY_PATTERN`. Non può coincidere con una voce
     *  di `SystemFont` (validato): l'endpoint disambigua provando prima il catalogo di sistema. */
    key: string;
    /** Nome CSS della font-family. */
    family: string;
    /** Almeno una faccia (di solito la sola regular — il browser sintetizza bold/italic
     *  mancanti). Pesi/stili duplicati non hanno senso, ma non sono validati: l'ultimo vince
     *  nel lookup per indice, comportamento CSS normale su `@font-face` duplicate. */
    faces: readonly CustomFontFace[];
}

/** Una scelta di font — usata sia per `defaultFont` (il font del sito) sia per ogni voce di
 *  `addonFonts` (un font aggiuntivo, servito ma non necessariamente attivo): una voce di
 *  `SystemFont`, oppure un `CustomFontDef` PIENO (key/family/faces), scritto direttamente — non
 *  una `string` che rimanda altrove. Niente indirezione da tenere allineata: il font custom è
 *  l'oggetto stesso, in qualunque dei due punti lo scrivi. */
export type FontChoice = SystemFont | CustomFontDef;

/** Key di una `FontChoice` — il valore dell'enum per un `SystemFont`, `.key` per un `CustomFontDef`. */
function choiceKey(choice: FontChoice): string {
    return typeof choice === 'string' ? choice : choice.key;
}

/** `CustomFontVar` di una voce di `addonFonts`, in entrambe le forme di `FontChoice`. */
function addonVar(entry: FontChoice): CustomFontVar {
    const key = choiceKey(entry);
    const family = typeof entry === 'string' ? SYSTEM_FONTS[entry].family : entry.family;
    return { key, family, cssVar: `--fontFamily-${key}` };
}

/** Una sorgente `@font-face` da iniettare — un file di `SystemFont` o di un `CustomFontDef`,
 *  sempre risolto in URL pubblico dallo stesso endpoint (`/cdn-cgi/font/:key/:index`, vedi
 *  `server/routes/system-font.ts`). */
export interface FontFaceSource {
    family: string;
    weight: 400 | 700;
    style: 'normal' | 'italic';
    url: string;
    /** Valore per `@font-face { src: url(...) format(...) }` — i 11 di sistema sono sempre `.ttf`
     *  (`'truetype'`), un font custom può essere `.woff2`/`.woff`/`.otf`/`.ttf` (`fontFormatFor`
     *  sotto, derivato dall'estensione REALE del file). Un `format()` sbagliato non è solo
     *  cosmetico: un browser conforme scarta la sorgente SENZA scaricarla se dichiara un formato
     *  che non supporta — hardcodare "truetype" per un file .woff2 lo romperebbe silenziosamente. */
    format: 'truetype' | 'woff2' | 'woff' | 'opentype';
}

/** Formato `@font-face` dall'estensione reale del file — vedi `FontFaceSource.format`. */
function fontFormatFor(fileName: string): FontFaceSource['format'] {
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    if (ext === '.woff2') return 'woff2';
    if (ext === '.woff') return 'woff';
    if (ext === '.otf') return 'opentype';
    return 'truetype';
}

/** Un font custom raggiungibile da SCSS di progetto indipendentemente da `defaultFont` — un
 *  `--fontFamily-<key>` per ogni voce di `addonFonts`, scelta o no come font attivo del sito. */
export interface CustomFontVar {
    key: string;
    family: string;
    /** Nome della custom property, es. `--fontFamily-accento`. */
    cssVar: string;
}

/** Input di `resolveFonts` sotto — assemblato in `buildFinalConfig` (`siteBuilder.ts`) dai campi
 *  `defaultFont`/`addonFonts` del design system attivo. */
export interface AppFontConfig {
    /** Font del sito, un solo campo per tutto (nessuna distinzione titoli/corpo — chi la vuole la
     *  scrive in CSS, vedi `CustomFontDef`). Assente: font puro di sistema (`systemUiFonts()`). */
    defaultFont?: FontChoice;
    /** Font aggiuntivi disponibili per QUESTO sito — self-hosted come gli 11 di sistema, stesso
     *  endpoint, mai attivi di per sé (registrarne uno qui non lo rende il font del sito). */
    addonFonts?: readonly FontChoice[];
}

/** Output di `resolveFonts`: quello che i consumer (AppearanceService, server.ts, PreviewBuilder,
 *  font-metrics) leggono davvero — mai il catalogo o `AppFontConfig` direttamente. */
export interface ResolvedFonts {
    /** Stack CSS per il browser (`--fontFamily`) — l'unico font del sito, corpo E titoli. */
    webStack: string;
    /** Stack CSS per le immagini OG (`PreviewBuilder`). Per un `SystemFont` è LO STESSO file di
     *  `webStack`, risolto per nome via fontconfig; per un font custom è la `family` dichiarata
     *  (`custom-font-detect.ts` la corregge se necessario col nome che fontconfig userà davvero
     *  per il file). */
    serverStack: string;
    /** Key del font attivo, per le metriche server: il valore di `SystemFont`, o `.key` del
     *  `CustomFontDef` attivo (`choiceKey()` di `defaultFont`). */
    serverKey: string;
    /** Sorgenti `@font-face` da iniettare: il font attivo PIÙ ogni voce di `addonFonts`
     *  registrata — anche quelle non scelte come font del sito, per restare raggiungibili da SCSS
     *  di progetto (vedi `customFontVars`). Deduplicate per chiave. Vuoto solo se non c'è alcuna
     *  scelta e nessun `addonFonts` (font puro di sistema, es. `aria`). */
    fontFaces: readonly FontFaceSource[];
    /** Un `--fontFamily-<key>` per ogni voce di `addonFonts` — sempre presente, scelta o no come
     *  font attivo via `defaultFont`. */
    customFontVars: readonly CustomFontVar[];
}

/** URL pubblico di una faccia — deve combaciare col routing di `server/routes/system-font.ts`
 *  (`/cdn-cgi/font/:key/:index`), stesso per `SystemFont` e font custom: la chiave è tutto ciò
 *  che serve per disambiguare, l'endpoint prova prima il catalogo di sistema. */
function fontFaceUrl(key: string, index: number): string {
    return `/cdn-cgi/font/${encodeURIComponent(key)}/${index}`;
}

/** Le sorgenti `@font-face` di UNA key già risolta (`SystemFont` o key custom) — `[]` se non
 *  risolve a nulla (chiave custom non presente nella mappa: nessun font caricato, non un crash —
 *  lo stack CSS a monte ha comunque il fallback emoji/generic-family). */
function facesFor(key: string, customByKey: ReadonlyMap<string, CustomFontDef>): FontFaceSource[] {
    if (isSystemFont(key)) {
        const def = SYSTEM_FONTS[key];
        return def.faces.map((face, index) => ({
            family: def.family, weight: face.weight, style: face.style,
            url: fontFaceUrl(key, index), format: fontFormatFor(face.file),
        }));
    }
    const def = customByKey.get(key);
    if (!def) return [];
    return def.faces.map((face, index) => ({
        family: def.family, weight: face.weight, style: face.style,
        url: fontFaceUrl(key, index), format: fontFormatFor(face.file),
    }));
}

/** Famiglia + famiglia generica CSS di una key già risolta — `null` se non risolve a nulla. */
function familyAndGenericFor(
    key: string, customByKey: ReadonlyMap<string, CustomFontDef>,
): { family: string; generic: 'sans-serif' | 'serif' | 'monospace' } | null {
    if (isSystemFont(key)) {
        const def = SYSTEM_FONTS[key];
        return { family: def.family, generic: def.generic };
    }
    const def = customByKey.get(key);
    // Nessun generic dichiarabile per un font custom (il progetto non lo specifica): sans-serif,
    // fallback neutro — stesso comportamento del vecchio `customFont` singolo.
    return def ? { family: def.family, generic: 'sans-serif' } : null;
}

/** Risolve `AppFontConfig` nel font effettivo. Pura: nessun accesso al filesystem — che i file
 *  dichiarati esistano davvero è compito del layer server (`custom-font-detect.ts`/
 *  `system-font.ts`, con `fileExists` a runtime, non a costruzione). */
export function resolveFonts(config: AppFontConfig): ResolvedFonts {
    const addonFonts = config.addonFonts ?? [];
    const customByKey = new Map(
        addonFonts.filter((c): c is CustomFontDef => typeof c !== 'string').map(c => [c.key, c])
    );

    const defaultChoice = config.defaultFont;
    if (defaultChoice == null) return systemUiFonts(addonFonts);

    // Un defaultFont custom è un CustomFontDef scritto DIRETTAMENTE qui, non una key che rimanda
    // ad addonFonts — lo si registra comunque nella mappa di lookup locale, cosicché facesFor()/
    // familyAndGenericFor() (che lavorano per key, indifferenti a dove una definizione è stata
    // dichiarata) lo risolvano esattamente come farebbero per una voce di addonFonts.
    if (typeof defaultChoice !== 'string') customByKey.set(defaultChoice.key, defaultChoice);
    const defaultKey = choiceKey(defaultChoice);

    const resolved = familyAndGenericFor(defaultKey, customByKey);
    const webStack = resolved ? stack(`"${resolved.family}"`, resolved.generic) : SYSTEM_UI_STACK;

    // fontFaces: il font scelto, PIÙ ogni addonFonts registrato (SystemFont o custom) — anche le
    // voci "secondarie" mai scelte come font del sito restano servite e raggiungibili da SCSS
    // (customFontVars sotto). Dedup per key: la stessa chiave non compare due volte.
    const included = new Set<string>();
    const fontFaces: FontFaceSource[] = [];
    const include = (key: string | undefined): void => {
        if (key == null || included.has(key)) return;
        included.add(key);
        fontFaces.push(...facesFor(key, customByKey));
    };
    include(defaultKey);
    for (const c of addonFonts) include(choiceKey(c));

    return {
        webStack,
        serverStack: webStack,
        serverKey: defaultKey,
        fontFaces,
        customFontVars: addonFonts.map(addonVar),
    };
}

/** Stack "nessuna scelta" — vedi `SYSTEM_UI_STACK` sopra. Usato da `resolveFonts()` quando il
 *  design system attivo non imposta `defaultFont`: l'unico caso in cui il sito resta sui font
 *  dell'OS, di proposito. Eventuali `addonFonts` dichiarati (ma non scelti in `defaultFont`)
 *  restano comunque serviti/raggiungibili da SCSS anche in questo caso — "nessuna opinione sul
 *  font" non vuol dire "nessun font disponibile". */
export function systemUiFonts(addonFonts: readonly FontChoice[] = []): ResolvedFonts {
    const customByKey = new Map(
        addonFonts.filter((c): c is CustomFontDef => typeof c !== 'string').map(c => [c.key, c])
    );
    const fontFaces = addonFonts.flatMap(c => facesFor(choiceKey(c), customByKey));
    return {
        webStack: SYSTEM_UI_STACK,
        serverStack: stack('"Liberation Sans"'),
        serverKey: SystemFont.Liberation,
        fontFaces,
        customFontVars: addonFonts.map(addonVar),
    };
}
