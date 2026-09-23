import { AppearanceService, type PaletteTokens } from '../../services/appearance.service';
import {
    ELEVAZIONE_TIERS, MOVIMENTO_DURATA, PULSAZIONE_TIERS,
    toKebabCaseLabel, toPascalCaseLabel,
} from '../../design-system-presets';
import type { SiteConfig } from '../../siteBuilder';

/** I campi del sito che finiscono nel tema compilato, oltre alla palette. */
export type ThemeScssConfig = Pick<SiteConfig, 'aspetto' | 'fonts'>;

/** Le cinque superfici di contenuto di un tono (base, card, hover, muted, subtle). */
export function surfacesOf(p: PaletteTokens, tone: 'light' | 'dark'): string[] {
    return tone === 'light'
        ? [p.colorBaseLt, p.colorSurfaceLt, p.colorSurfaceHoverLt, p.colorMutedBgLt, p.colorSubtleBgLt]
        : [p.colorBaseDk, p.colorSurfaceDk, p.colorSurfaceHoverDk, p.colorMutedBgDk, p.colorSubtleBgDk];
}

/** Motivo per cui la palette non è utilizzabile, o `null`. Superfici collassate su un colore solo: il design system
 *  chiede (`colori.superfici`, `colori.sfondo`, `vividezza`) superfici che nessun testo reggerebbe e il motore ha rinunciato
 *  a distinguerle; da lì testo, link e fill del primario finiscono tutti sul nero o sul bianco. Non è una palette: il
 *  build si ferma qui invece di compilare un sito monocromo con venti avvisi in console. */
export function paletteDegenerata(p: PaletteTokens, colorTema: string): string | null {
    for (const tone of ['light', 'dark'] as const) {
        const set = new Set(surfacesOf(p, tone));
        if (set.size > 1) continue;
        return `Tono ${tone === 'light' ? 'chiaro' : 'scuro'}: le cinque superfici coincidono (${[...set][0]}). Con colorTema ${colorTema} ` +
            'e queste superfici del design system nessun testo resta leggibile e la palette degenera in un colore solo: ' +
            'scegli un brand più chiaro o più scuro, un altro `colori.sfondo`, o superfici diverse da `fusione`.';
    }
    return null;
}

/** Stringa Sass tra virgolette: il contenuto esce tale e quale da `#{...}` nel CSS. */
function sassString(value: string): string {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function sassMap(entries: [string, string][], indent = '    '): string {
    return `(\n${entries.map(([k, v]) => `${indent}${sassString(k)}: ${v},`).join('\n')}\n)`;
}

/** I colori di un tono, coi nomi che usano bootstrap.scss e _tokens.scss. */
function toneEntries(p: PaletteTokens, tone: 'light' | 'dark', superficieNav: 'brand' | 'body'): [string, string][] {
    const lt = tone === 'light';
    const nav = AppearanceService.resolveNavColors(p, superficieNav);
    return [
        ['primary', lt ? p.colorPrimary : p.colorPrimaryFillDk],
        ['primary-fg', lt ? p.colorPrimaryFgLt : p.colorPrimaryFgDk],
        ['secondary', lt ? p.colorSecondaryLt : p.colorSecondaryDk],
        ['link', lt ? p.colorLinkLt : p.colorLinkDk],
        ['body-bg', lt ? p.colorBaseLt : p.colorBaseDk],
        ['body-color', lt ? p.colorSurfaceTextLt : p.colorSurfaceTextDk],
        ['heading', lt ? p.colorHeadingLt : p.colorHeadingDk],
        ['surface', lt ? p.colorSurfaceLt : p.colorSurfaceDk],
        ['surface-hover', lt ? p.colorSurfaceHoverLt : p.colorSurfaceHoverDk],
        ['border', lt ? p.colorSurfaceBorderLt : p.colorSurfaceBorderDk],
        ['muted-bg', lt ? p.colorMutedBgLt : p.colorMutedBgDk],
        ['subtle-bg', lt ? p.colorSubtleBgLt : p.colorSubtleBgDk],
        ['muted-text', lt ? p.colorMutedTextLt : p.colorMutedTextDk],
        ['nav-bg', lt ? nav.navBgLt : nav.navBgDk],
        ['nav-text', lt ? nav.navTextLt : nav.navTextDk],
        ['nav-border', lt ? nav.navBorderLt : nav.navBorderDk],
    ];
}

/** `generated/_theme.scss`: solo DATI Sass (nessun output CSS), letti da bootstrap.scss e base.scss.
 *  Palette per tono, coloriNuovi (nome classe Bootstrap + nome token), leve statiche e font del design system. */
export function buildThemeScss(p: PaletteTokens, cfg: ThemeScssConfig): string {
    const { aspetto } = cfg;
    const movimento = MOVIMENTO_DURATA[aspetto.movimento];
    const elevazione = ELEVAZIONE_TIERS[aspetto.elevazione];
    const pulsazione = PULSAZIONE_TIERS[aspetto.pulsazione];
    const fonts = cfg.fonts;

    const staticVars: [string, string][] = [
        ['movimentoPagina', movimento.pagina],
        ['movimentoPannello', movimento.pannello],
        ['elevazioneRaggio', elevazione.raggio],
        ['shadowElevated', elevazione.ombra],
        ['shadowElevatedHover', elevazione.ombraHover],
        ['pulsazioneNome', pulsazione.nome],
        ['pulsazioneSpread1', pulsazione.spread1],
        ['pulsazioneTrasparenza1', pulsazione.trasparenza1],
        ['pulsazioneSpread2', pulsazione.spread2],
        ['pulsazioneTrasparenza2', pulsazione.trasparenza2],
        ['lightboxRaggio', aspetto.lightboxArrotondato ? '4px' : '0px'],
        ['fontFamily', fonts.webStack],
        ...fonts.customFontVars.map((v): [string, string] => [v.cssVar.replace(/^--/, ''), `"${v.family}"`]),
    ];

    const faces = fonts.fontFaces.map(f => sassMap([
        ['family', sassString(f.family)],
        ['url', sassString(f.url)],
        ['format', sassString(f.format)],
        ['weight', String(f.weight)],
        ['style', f.style],
    ], '        '));

    // Chiave = nome della classe Bootstrap (.btn-oro-chiaro), "token" = suffisso di --color<Token>.
    const custom = Object.entries(p.coloriNuovi).map(([label, hex]): [string, string] =>
        [toKebabCaseLabel(label), `("token": ${sassString(toPascalCaseLabel(label))}, "hex": ${hex})`]);

    // Colori d'accento per tono: (fill, testo). Il fill è quello che il design system ha scelto,
    // il testo la sua variante leggibile sulle superfici del tono (PaletteTokens.accentText).
    const accent = (fillLt: string, fillDk: string, text: { lt: string; dk: string }): string =>
        `("light": (${fillLt}, ${text.lt}), "dark": (${fillDk}, ${text.dk}))`;
    const accents: [string, string][] = [
        ['secondary', accent(p.colorSecondaryLt, p.colorSecondaryDk, p.accentText['secondary'])],
        ...(p.colorInfo ? [['info', accent(p.colorInfo, p.colorInfo, p.accentText['info'])] as [string, string]] : []),
        ...Object.entries(p.coloriNuovi).map(([label, hex]): [string, string] =>
            [toKebabCaseLabel(label), accent(hex, hex, p.accentText[label])]),
    ];

    return [
        '// Generato da generate-statics.ts dalla palette del design system attivo: non modificare,',
        '// si rigenera a ogni build/dev.',
        `$theme-tema: ${p.colorTema};`,
        `$theme-info: ${p.colorInfo ?? 'null'};`,
        `$theme-light: ${sassMap(toneEntries(p, 'light', aspetto.navbar.superficie))};`,
        `$theme-dark: ${sassMap(toneEntries(p, 'dark', aspetto.navbar.superficie))};`,
        `$theme-custom: ${custom.length ? sassMap(custom) : '()'};`,
        `$theme-accents: ${sassMap(accents)};`,
        // Polarità reale di ogni tono: con vividezza il "tono scuro" di un brand chiaro ha
        // un fondo chiaro (e viceversa). Bootstrap usa le derivazioni della polarità, non del nome.
        `$theme-polarity: ${sassMap([
            ['light', AppearanceService.prefersDarkText(p.colorBaseLt) ? 'light' : 'dark'],
            ['dark', AppearanceService.prefersDarkText(p.colorBaseDk) ? 'light' : 'dark'],
        ])};`,
        `$theme-static: ${sassMap(staticVars.map(([k, v]) => [k, sassString(v)]))};`,
        `$theme-font-faces: (${faces.length ? faces.join(', ') + ',' : ''});`,
        '',
    ].join('\n');
}
