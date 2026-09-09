import { ImgBuilderService, TextBlockSpec } from '../services/img-builder.service';
import { FontMetrics } from '../services/font-metrics';
import { loadServerFontMetrics } from './server-font-metrics';
import { resolvedFonts } from '../../../../styles/font-config';

// Lato server le metriche vengono dai font reali installati (fallback alle tabelle se non leggibili).
FontMetrics.configure(loadServerFontMetrics);

export interface PreviewSvgOptions {
    /** Titolo principale della preview. */
    title: string;
    /** Subline opzionale su riga singola (troncata con ellissi se eccede). */
    subtitle?: string | null;
    /** Colore di sfondo dell'intera immagine SVG. */
    bgColor: string;
    /** Favicon/logo opzionale codificato come data URL SVG/PNG. */
    faviconDataUrl?: string;
    /** Colore principale del testo. */
    textColor?: string;
    /** Larghezza canvas SVG finale. */
    width?: number;
    /** Altezza canvas SVG finale. */
    height?: number;
    /** Font-family globale usato nei text node SVG. */
    fontFamily?: string;
    /** Font-size del titolo principale. */
    titleFontSize?: number;
    /** Font-size della subline. */
    subtitleFontSize?: number;
    /** Dimensione quadrata favicon/logo. */
    faviconSize?: number;
    /** Padding orizzontale interno. */
    horizontalPadding?: number;
    /** Moltiplicatore line-height del titolo. */
    titleLineHeight?: number;
}

export interface TitleBadgeOptions {
    /** Larghezza del canvas SVG di output (deve combaciare con la cover OG). */
    canvasW: number;
    /** Altezza del canvas SVG di output. */
    canvasH: number;
    /** X del bordo sinistro del badge (di solito a destra dell'icona favicon). */
    anchorLeft: number;
    /** Y del centro verticale a cui ancorare il badge (di solito il centro dell'icona). */
    anchorCenterY: number;
    /** Limite destro entro cui il badge non può sconfinare. */
    maxRight: number;
    /** Testo del badge (già normalizzato). */
    title: string;
    /** Subline opzionale su riga singola (troncata con ellissi se eccede). */
    subtitle?: string;
    /** Colore di sfondo del pill; il testo riceve automaticamente il contrasto WCAG. */
    bgColor: string;
    /** Override del font-size (default: FONT_PRIMARY). */
    fontSize?: number;
    /** Font-size della subline (default: ~55% di fontSize). */
    subtitleFontSize?: number;
    /** Padding orizzontale sinistro (default: fontSize × ImgBuilderService.PILL_PAD_H_RATIO). */
    hPadL?: number;
    /** Padding orizzontale destro (default: fontSize × ImgBuilderService.PILL_PAD_H_RATIO). */
    hPadR?: number;
    /** Padding verticale sopra/sotto il testo (default: fontSize × ImgBuilderService.PILL_PAD_V_RATIO). */
    vPad?: number;
    /** Opacità del pill (default: 1, piena — vedi ImgBuilderService.PillOptions.fillOpacity). */
    fillOpacity?: number;
}

export class PreviewBuilder {
    // =========================================================
    // DESIGN SYSTEM & TOKENS CONDIVISI
    // =========================================================

    // --- Tipografia ---
    /** Font size per elementi primari (Titolo preview, Testo badge). */
    static readonly FONT_PRIMARY = 56;
    /** Font size per la subline (preview testuale e badge sopra immagine). */
    static readonly FONT_SECONDARY = 30;
    /** Moltiplicatore line-height universale per tutti i testi multilinea */
    static readonly LINE_HEIGHT = 1.3;

    // --- Gap proporzionali (preview testuale) ---
    /** Gap tra la favicon e il titolo, come frazione di `titleFontSize`. */
    static readonly IDENTITY_GAP_RATIO = 0.5;
    /** Gap tra titolo e subline, come frazione di `subtitleFontSize`. */
    static readonly SUBTITLE_GAP_RATIO = 0.5;

    // --- Spaziature (Padding & Margini) ---
    /** Padding orizzontale globale del canvas della preview (safe-zone). */
    static readonly SPACING_LG = 80;

    // --- Opacità ---
    /** Opacità target per la subline attenuata. */
    static readonly OPACITY_TEXT_SECONDARY = 0.75;
    /** Opacità di default per lo sfondo del badge OG. */
    static readonly OPACITY_OVERLAY = 1;

    // --- Dimensioni Specifiche Preview ---
    static readonly CANVAS_WIDTH = 1200;
    static readonly CANVAS_HEIGHT = 630;
    /** Dimensione della favicon nella preview. */
    static readonly FAVICON_SIZE = 72;

    // --- Limiti righe (anti-overflow verticale) ---
    /** Max righe del titolo nella preview testuale. */
    static readonly MAX_TITLE_LINES = 3;
    /** Max righe del badge titolo sopra l'immagine. */
    static readonly MAX_BADGE_LINES = 3;

    // =========================================================
    // LOGICA PREVIEW SVG
    // =========================================================

    /** Risolve tutte le opzioni della preview applicando normalizzazione e fallback ai token del Design System. */
    static resolvePreviewBuilder(opts: PreviewSvgOptions) {
        const textColor = opts.textColor ?? ImgBuilderService.getReadableTextColor(opts.bgColor);
        return {
            title: ImgBuilderService.normalizeWhitespace(opts.title),
            subtitle: ImgBuilderService.normalizeWhitespace(opts.subtitle ?? ''),
            bgColor: opts.bgColor,
            faviconDataUrl: opts.faviconDataUrl ?? '',
            textColor,
            mutedTextColor: ImgBuilderService.mutedTextColor(textColor, opts.bgColor, this.OPACITY_TEXT_SECONDARY),
            width: Math.max(1, Math.ceil(opts.width ?? this.CANVAS_WIDTH)),
            height: Math.max(1, Math.ceil(opts.height ?? this.CANVAS_HEIGHT)),
            fontFamily: opts.fontFamily ?? resolvedFonts.serverStack,
            titleFontSize: opts.titleFontSize ?? this.FONT_PRIMARY,
            subtitleFontSize: opts.subtitleFontSize ?? this.FONT_SECONDARY,
            faviconSize: opts.faviconSize ?? this.FAVICON_SIZE,
            horizontalPadding: opts.horizontalPadding ?? this.SPACING_LG,
            titleLineHeight: opts.titleLineHeight ?? this.LINE_HEIGHT,
        };
    }

    /** Costruisce la preview SVG con favicon, titolo e subline opzionale. */
    static buildPreview(opts: PreviewSvgOptions): { svg: string; width: number; height: number } {
        const r = this.resolvePreviewBuilder(opts);

        const margin = r.horizontalPadding;
        const leftX = margin;
        const maxWidthPx = r.width - margin * 2;

        const esc = ImgBuilderService.escapeXml;

        const hasFavicon = r.faviconDataUrl.length > 0;
        const identityIconSize = hasFavicon ? r.faviconSize : 0;

        const identityGap = Math.round(r.titleFontSize * this.IDENTITY_GAP_RATIO);
        const identityEl = hasFavicon
            ? `<image href="${r.faviconDataUrl}" x="${leftX}" y="${margin}" width="${identityIconSize}" height="${identityIconSize}"/>`
            : '';
        const contentTop = margin + (hasFavicon ? identityIconSize + identityGap : 0);

        const hasSubtitle = r.subtitle.length > 0;
        const subtitleGap = Math.round(r.subtitleFontSize * this.SUBTITLE_GAP_RATIO);
        const reservedForSubtitle = hasSubtitle ? subtitleGap + r.subtitleFontSize : 0;

        const titleLineStep = r.titleFontSize * r.titleLineHeight;
        const maxTitleBudget = r.titleFontSize + (this.MAX_TITLE_LINES - 1) * titleLineStep;
        const availableTitleHeight = Math.min(
            r.height - contentTop - margin - reservedForSubtitle,
            maxTitleBudget,
        );
        const blocks: TextBlockSpec[] = [
            { text: r.title, baseFontSize: r.titleFontSize, lineHeight: r.titleLineHeight, maxLines: this.MAX_TITLE_LINES, bold: true },
        ];
        const titleFit = ImgBuilderService.fitTextBlocks(blocks, maxWidthPx, availableTitleHeight, 0, {
            minScale: 1, measureFn: FontMetrics.measure,
        }).blocks[0];

        let topY = contentTop;

        const titleTspans = titleFit.lines
            .map((line, i) => `<tspan x="${leftX}" dy="${i === 0 ? 0 : titleFit.lineStep}">${esc(line)}</tspan>`)
            .join('');

        const titleEl =
            `<text x="${leftX}" y="${topY + titleFit.fontSize}" font-family="${esc(r.fontFamily)}" font-size="${titleFit.fontSize}" font-weight="700" fill="${esc(r.textColor)}" text-anchor="start">${titleTspans}</text>`;

        topY += titleFit.blockHeight;

        let subtitleEl = '';
        if (hasSubtitle) {
            topY += subtitleGap;
            const measureSub = (t: string) => FontMetrics.measure(t, r.subtitleFontSize, false);
            const subtitleLine = ImgBuilderService.wrapText(r.subtitle, maxWidthPx, r.subtitleFontSize, measureSub, 1)[0];
            subtitleEl =
                `<text x="${leftX}" y="${topY + r.subtitleFontSize}" font-family="${esc(r.fontFamily)}" font-size="${r.subtitleFontSize}" font-weight="400" fill="${esc(r.mutedTextColor)}" text-anchor="start">${esc(subtitleLine)}</text>`;
        }

        const svg =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="${r.width}" height="${r.height}" viewBox="0 0 ${r.width} ${r.height}">` +
            `<rect width="${r.width}" height="${r.height}" fill="${esc(r.bgColor)}"/>` +
            identityEl + titleEl + subtitleEl +
            `</svg>`;

        return { svg, width: r.width, height: r.height };
    }

    // =========================================================
    // LOGICA BADGE SVG
    // =========================================================

    /** Costruisce il pill/badge SVG sopra l'immagine. */
    static buildTitleBadge(opts: TitleBadgeOptions): string {
        const fontSize = opts.fontSize ?? this.FONT_PRIMARY;
        const pill = ImgBuilderService.buildPill({
            text: opts.title,
            subtitle: opts.subtitle,
            bgColor: opts.bgColor,
            maxWidth: opts.maxRight - opts.anchorLeft,
            x: opts.anchorLeft,
            anchorCenterY: opts.anchorCenterY,
            fontSize,
            subtitleFontSize: opts.subtitleFontSize,
            fontFamily: resolvedFonts.serverStack,
            lineHeight: this.LINE_HEIGHT,
            maxLines: this.MAX_BADGE_LINES,
            hPadL: opts.hPadL,
            hPadR: opts.hPadR,
            vPad: opts.vPad,
            fillOpacity: opts.fillOpacity ?? this.OPACITY_OVERLAY,
            measureFn: FontMetrics.measure,
        });

        return `<?xml version="1.0" encoding="UTF-8"?>` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.canvasW}" height="${opts.canvasH}">` +
            pill.svg +
            `</svg>`;
    }
}
