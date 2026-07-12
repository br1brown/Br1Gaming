/**
 * Fonte di verità centralizzata per i font del sito, senza dipendenze (importabile ovunque).
 * `WEB_FONTS` = browser/Canvas (font di sistema); `SERVER_FONTS` = Sharp/OG (installati nel Docker).
 * Default nei membri `DEFAULT_WEB_FONT` / `DEFAULT_SERVER_FONT_KEY` (le ricette per aggiungerli sotto).
 */

/** Font server installati nel container Docker. Enum (non stringhe magiche) per tipizzare default e
 *  metriche: si seleziona il font scrivendo `ServerFont.Liberation`, mai `'Liberation'`. */
export enum ServerFont {
    Roboto = 'Roboto',
    DejaVu = 'DejaVu',
    Noto = 'Noto',
    Liberation = 'Liberation',
}

/** Fallback emoji comune a ogni stack: fa renderizzare le emoji a colori (Apple/Segoe). */
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji"';

/** Compone uno stack CSS: famiglie preferite + fallback emoji + famiglia generica.
 *  Evita di ripetere il suffisso emoji su ogni voce; ogni font dichiara solo la sua parte. */
const stack = (families: string, generic: 'sans-serif' | 'serif' | 'monospace' = 'sans-serif'): string =>
    `${families}, ${EMOJI}, ${generic}`;

export class FontConfig {

    /** Font browser/Canvas — di sistema, zero dipendenze. Aggiungerne uno: basta una voce qui. */
    static readonly WEB_FONTS = {
        System: stack('system-ui, "Segoe UI", Arial'),
        Arial: stack('Arial'),
        Verdana: stack('Verdana'),
        Georgia: stack('Georgia', 'serif'),
        Times: stack('"Times New Roman", Times', 'serif'),
        CourierNew: stack('"Courier New"', 'monospace'),
    } as const;

    /** Font Sharp/OG installati nel Docker (ImgBuilderService, PreviewBuilder).
     *  Aggiungerne uno: enum `ServerFont` + qui + `FONT_METRICS` (obbligatorie) + install nel Dockerfile. */
    static readonly SERVER_FONTS: Record<ServerFont, string> = {
        [ServerFont.Roboto]: stack('Roboto'),
        [ServerFont.DejaVu]: stack('DejaVu Sans'),
        [ServerFont.Noto]: stack('"Noto Sans"'),
        [ServerFont.Liberation]: stack('"Liberation Sans"'),
    };

    /** Default server (immagini OG): a differenza del web serve la CHIAVE, perché le metriche di layout
     *  (`FONT_METRICS` in font-metrics.ts) sono indicizzate per font. Sorgente UNICA: cambia qui per
     *  allineare in un colpo lo stack SVG (`DEFAULT_SERVER_FONT`) e le metriche. Stile a membro come il
     *  web, non stringa magica: `ServerFont.Liberation`. */
    static readonly DEFAULT_SERVER_FONT_KEY = ServerFont.Liberation;

    /** Default browser/Canvas: qui basta lo STACK (il valore). Il browser misura il testo da solo
     *  (canvas), e ThemeService inietta questa stringa in `--fontFamily`: la chiave non serve a runtime. */
    static readonly DEFAULT_WEB_FONT = FontConfig.WEB_FONTS.Verdana;

    /** Stack CSS del font server di default, derivato dalla chiave sopra. */
    static readonly DEFAULT_SERVER_FONT = FontConfig.SERVER_FONTS[FontConfig.DEFAULT_SERVER_FONT_KEY];

}
