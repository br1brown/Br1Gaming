import { ImgBuilderService, TextBlockSpec } from '../services/img-builder.service';
import { FontMetrics } from '../services/font-metrics';
import { loadServerFontMetrics } from './server-font-metrics';
import { FontConfig } from '../../../../styles/font-config';

// Lato server le metriche vengono dai font reali installati (fallback alle tabelle se non leggibili).
FontMetrics.configure(loadServerFontMetrics);

export interface PreviewSvgOptions {
    /** Nome applicazione mostrato nella preview SVG. */
    appName: string;
    /** Titolo principale della preview. */
    title: string;
    /** Sottotitolo opzionale mostrato sotto il titolo. */
    subtitle?: string | null;
    /** Colore di sfondo dell'intera immagine SVG. */
    bgColor: string;
    /** Favicon/logo codificato come data URL SVG/PNG. */
    faviconDataUrl?: string;
    /** Colore principale del testo. */
    textColor?: string;
    /** Larghezza canvas SVG finale. */
    width?: number;
    /** Altezza canvas SVG finale. */
    height?: number;
    /** Font-family globale usato nei text node SVG. */
    fontFamily?: string;
    /** Font-size del nome applicazione. */
    appFontSize?: number;
    /** Font-size del titolo principale. */
    titleFontSize?: number;
    /** Font-size del sottotitolo. */
    subtitleFontSize?: number;
    /** Dimensione quadrata favicon/logo. */
    faviconSize?: number;
    /** Spaziatura verticale tra i blocchi. */
    spacing?: number;
    /** Padding orizzontale interno. */
    horizontalPadding?: number;
    /** Moltiplicatore line-height del titolo. */
    titleLineHeight?: number;
    /** Moltiplicatore line-height del sottotitolo. */
    subtitleLineHeight?: number;
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
    /** Colore di sfondo del pill; il testo riceve automaticamente il contrasto WCAG. */
    bgColor: string;
    /** Override del font-size (default: FONT_PRIMARY). */
    fontSize?: number;
    /** Padding orizzontale sinistro (default: SPACING_MD). */
    hPadL?: number;
    /** Padding orizzontale destro (default: SPACING_MD). */
    hPadR?: number;
    /** Padding verticale sopra/sotto il testo (default: SPACING_SM). */
    vPad?: number;
    /** Opacità del pill (default: OPACITY_OVERLAY). */
    fillOpacity?: number;
}

export class PreviewBuilder {
    // =========================================================
    // DESIGN SYSTEM & TOKENS CONDIVISI
    // =========================================================

    // --- Tipografia ---
    /** Font size per elementi primari (Titolo preview, Testo badge) */
    static readonly FONT_PRIMARY = 40;
    /** Font size per elementi secondari (Sottotitolo, Nome App) */
    static readonly FONT_SECONDARY = 30;
    /** Moltiplicatore line-height universale per tutti i testi multilinea */
    static readonly LINE_HEIGHT = 1.3;

    /** Offset per spostarsi dalla cima del cap-box alla baseline tipografica nei nodi <text>. */
    static readonly BASELINE_OFFSET_RATIO = 0.8;

    // --- Spaziature (Padding & Margini) ---
    /** Padding verticale ridotto (es. interno verticale del badge) */
    static readonly SPACING_SM = 16;
    /** Spaziatura standard tra i blocchi della preview e padding orizzontale del badge */
    static readonly SPACING_MD = 32;
    /** Padding orizzontale globale del canvas della preview (per evitare bordi troppo vicini) */
    static readonly SPACING_LG = 48;

    // --- Opacità ---
    /** Opacità unificata per testi non principali (Nome App, Sottotitolo) per gerarchia visiva. */
    static readonly OPACITY_TEXT_SECONDARY = 0.75;
    /** Opacità per lo sfondo di elementi in overlay (es. sfondo del badge OG). */
    static readonly OPACITY_OVERLAY = 0.9;

    // --- Dimensioni Specifiche Preview ---
    static readonly CANVAS_WIDTH = 1200;
    static readonly CANVAS_HEIGHT = 630;
    static readonly FAVICON_SIZE = 200;

    // --- Limiti righe (anti-overflow verticale) ---
    /** Max righe del titolo nella preview testuale (centrata: oltre sforerebbe il canvas). */
    static readonly MAX_TITLE_LINES = 3;
    /** Max righe del sottotitolo nella preview testuale. */
    static readonly MAX_SUBTITLE_LINES = 3;
    /** Max righe del badge titolo sopra l'immagine (oltre il pill crescerebbe troppo). */
    static readonly MAX_BADGE_LINES = 3;

    // --- Shrink-to-fit (preview testuale) ---
    /** Scala minima del font sotto cui non si scende: oltre, si tronca invece di rimpicciolire. */
    static readonly MIN_FONT_SCALE = 0.6;
    /** Passo di riduzione della scala a ogni tentativo di fit. */
    static readonly FONT_SHRINK_STEP = 0.05;

    // =========================================================
    // LOGICA PREVIEW SVG
    // =========================================================

    /** Risolve tutte le opzioni della preview applicando normalizzazione e fallback ai token del Design System. */
    static resolvePreviewBuilder(opts: PreviewSvgOptions) {
        return {
            appName: ImgBuilderService.normalizeWhitespace(opts.appName),
            title: ImgBuilderService.normalizeWhitespace(opts.title),
            subtitle: ImgBuilderService.normalizeWhitespace(opts.subtitle ?? ''),
            bgColor: opts.bgColor,
            faviconDataUrl: opts.faviconDataUrl ?? '',
            textColor: opts.textColor ?? ImgBuilderService.getReadableTextColor(opts.bgColor),
            width: Math.max(1, Math.ceil(opts.width ?? this.CANVAS_WIDTH)),
            height: Math.max(1, Math.ceil(opts.height ?? this.CANVAS_HEIGHT)),
            fontFamily: opts.fontFamily ?? FontConfig.DEFAULT_SERVER_FONT,
            appFontSize: opts.appFontSize ?? this.FONT_SECONDARY,
            titleFontSize: opts.titleFontSize ?? this.FONT_PRIMARY,
            subtitleFontSize: opts.subtitleFontSize ?? this.FONT_SECONDARY,
            faviconSize: opts.faviconSize ?? this.FAVICON_SIZE,
            spacing: opts.spacing ?? this.SPACING_MD,
            horizontalPadding: opts.horizontalPadding ?? this.SPACING_LG,
            titleLineHeight: opts.titleLineHeight ?? this.LINE_HEIGHT,
            subtitleLineHeight: opts.subtitleLineHeight ?? this.LINE_HEIGHT,
        };
    }

    /** Costruisce una preview SVG completa centrata verticalmente con nome app, favicon, titolo e sottotitolo. */
    static buildPreview(opts: PreviewSvgOptions): { svg: string; width: number; height: number } {
        const r = this.resolvePreviewBuilder(opts);

        // Centro asse X
        const cx = r.width / 2;
        // Spazio massimo in larghezza a disposizione del testo
        const maxWidthPx = r.width - r.horizontalPadding * 2;

        const esc = ImgBuilderService.escapeXml;

        // Shrink-to-fit (canvas fisso 1200x630): si riducono i font di titolo/sottotitolo finché
        // il testo entra; solo se nemmeno al minimo leggibile entra, si tronca con ellissi.
        // Il calcolo è delegato alla funzione pura condivisa ImgBuilderService.fitTextBlocks,
        // con misura reale del font server (FontMetrics) invece della stima 0.55.
        // Elementi fissi sopra il testo (non scalati): nome app (se presente) + favicon + spaziature.
        // appName vuoto (es. home: il nome app fa già da titolo) → la sua riga non occupa spazio,
        // così favicon e titolo restano centrati senza un gap fantasma in alto.
        const hasAppName = r.appName.length > 0;
        const reservedHeight = (hasAppName ? r.appFontSize + r.spacing : 0) + r.faviconSize + r.spacing;
        const availableTextHeight = r.height - this.SPACING_MD * 2 - reservedHeight;

        const blocks: TextBlockSpec[] = [
            { text: r.title, baseFontSize: r.titleFontSize, lineHeight: r.titleLineHeight, maxLines: this.MAX_TITLE_LINES, bold: true },
        ];
        if (r.subtitle) {
            blocks.push({ text: r.subtitle, baseFontSize: r.subtitleFontSize, lineHeight: r.subtitleLineHeight, maxLines: this.MAX_SUBTITLE_LINES });
        }
        const fit = ImgBuilderService.fitTextBlocks(blocks, maxWidthPx, availableTextHeight, r.spacing, {
            minScale: this.MIN_FONT_SCALE, step: this.FONT_SHRINK_STEP, measureFn: FontMetrics.measure,
        });

        const titleFit = fit.blocks[0];
        const subtitleFit = fit.blocks[1]; // undefined quando non c'è sottotitolo
        const titleLines = titleFit.lines;
        const titleFontSize = titleFit.fontSize;
        const titleLineStep = titleFit.lineStep;
        const titleBlockHeight = titleFit.blockHeight;
        const subtitleLines = subtitleFit?.lines ?? [];
        const subtitleFontSize = subtitleFit?.fontSize ?? r.subtitleFontSize;
        const subtitleLineStep = subtitleFit?.lineStep ?? 0;

        // Coordinata Y di partenza per centrare in blocco il contenuto
        const totalHeight = reservedHeight + fit.textHeight;
        let topY = (r.height - totalHeight) / 2;

        /** Nodo SVG del nome applicazione (in alto). Omesso quando appName è vuoto. */
        const appNameEl = hasAppName
            ? `<text x="${cx}" y="${topY + r.appFontSize}" font-family="${esc(r.fontFamily)}" font-size="${r.appFontSize}" font-weight="400" fill="${esc(r.textColor)}" text-anchor="middle" opacity="${this.OPACITY_TEXT_SECONDARY}">${esc(r.appName)}</text>`
            : '';

        if (hasAppName) topY += r.appFontSize + r.spacing;

        /** Nodo SVG favicon/logo centrale. Centrato rispetto a X = cx. */
        const faviconEl = r.faviconDataUrl
            ? `<image href="${r.faviconDataUrl}" x="${cx - r.faviconSize / 2}" y="${topY}" width="${r.faviconSize}" height="${r.faviconSize}"/>`
            : '';

        topY += r.faviconSize + r.spacing;

        /** Tspan multilinea del titolo principale. La prima riga ha dy=0, le successive scendono di titleLineStep. */
        const titleTspans = titleLines
            .map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : titleLineStep}">${esc(line)}</tspan>`)
            .join('');

        /** Nodo SVG del titolo principale. */
        const titleEl =
            `<text x="${cx}" y="${topY + titleFontSize}" font-family="${esc(r.fontFamily)}" font-size="${titleFontSize}" font-weight="700" fill="${esc(r.textColor)}" text-anchor="middle">${titleTspans}</text>`;

        topY += titleBlockHeight + r.spacing;

        let subtitleEl = '';

        if (subtitleLines.length > 0) {
            /** Tspan multilinea del sottotitolo. */
            const subtitleTspans = subtitleLines
                .map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : subtitleLineStep}">${esc(line)}</tspan>`)
                .join('');

            /** Nodo SVG del sottotitolo. */
            subtitleEl =
                `<text x="${cx}" y="${topY + subtitleFontSize}" font-family="${esc(r.fontFamily)}" font-size="${subtitleFontSize}" font-weight="400" fill="${esc(r.textColor)}" text-anchor="middle" opacity="${this.OPACITY_TEXT_SECONDARY}">${subtitleTspans}</text>`;
        }

        /** SVG finale completo di background e raggruppamento nodi. */
        const svg =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="${r.width}" height="${r.height}" viewBox="0 0 ${r.width} ${r.height}">` +
            `<rect width="${r.width}" height="${r.height}" fill="${esc(r.bgColor)}"/>` +
            appNameEl + faviconEl + titleEl + subtitleEl +
            `</svg>`;

        return { svg, width: r.width, height: r.height };
    }

    // =========================================================
    // LOGICA BADGE SVG
    // =========================================================

    /** Risolve configurazione finale del badge applicando fallback ai token del Design System. */
    private static resolveTitleBadgeBuilder(opts: TitleBadgeOptions) {
        const fontSize = opts.fontSize ?? this.FONT_PRIMARY;
        // Unificato il padding orizzontale destro/sinistro usando la spaziatura media condivisa
        const hPadL = opts.hPadL ?? this.SPACING_MD;
        const hPadR = opts.hPadR ?? this.SPACING_MD;
        const vPad = opts.vPad ?? this.SPACING_SM;

        return {
            ...opts,
            fontSize,
            hPadL,
            hPadR,
            vPad,
            fillOpacity: opts.fillOpacity ?? this.OPACITY_OVERLAY,
            fontFamily: FontConfig.DEFAULT_SERVER_FONT,
            lineStep: fontSize * this.LINE_HEIGHT,
            textColor: ImgBuilderService.getReadableTextColor(opts.bgColor),
        };
    }

    /** Restituisce l'SVG completo (canvas canvasW × canvasH) con il solo pill/badge disegnato. */
    static buildTitleBadge(opts: TitleBadgeOptions): string {
        const r = this.resolveTitleBadgeBuilder(opts);
        const esc = ImgBuilderService.escapeXml;

        // Spazio disponibile per il testo (al netto dei padding orizzontali e del limite destro del canvas).
        const maxTextW = r.maxRight - r.anchorLeft - r.hPadL - r.hPadR;

        /** Righe wrappate del titolo badge. Il font è fisso (proporzionato alla favicon), quindi
         *  niente shrink (minScale 1): fitTextBlocks serve qui solo a wrappare e troncare con ellissi
         *  oltre MAX_BADGE_LINES, con la stessa misura reale del font (FontMetrics) del resto.
         *  L'altezza disponibile è fissata a MAX_BADGE_LINES righe così il cap scatta sempre. */
        const maxBadgeHeight = r.fontSize + (this.MAX_BADGE_LINES - 1) * r.lineStep;
        const lines = ImgBuilderService.fitTextBlocks(
            [{ text: r.title, baseFontSize: r.fontSize, lineHeight: this.LINE_HEIGHT, maxLines: this.MAX_BADGE_LINES, bold: true }],
            maxTextW, maxBadgeHeight, 0, { minScale: 1, measureFn: FontMetrics.measure },
        ).blocks[0].lines;

        /** Larghezza in pixel della riga più lunga, misurata con le metriche reali del font. */
        const longestLineW = Math.max(...lines.map(l => FontMetrics.measure(l, r.fontSize, true)));

        /** Altezza del blocco multilinea del testo badge (senza padding). */
        const blockHeight = r.fontSize + (lines.length - 1) * r.lineStep;

        /** Altezza finale del rettangolo del badge/pill (includendo i padding verticali). */
        const badgeH = Math.round(blockHeight + r.vPad * 2);

        /** Larghezza finale del badge: si stringe sul testo reale ma non supera il margine destro.
         *  Clamp a >=0: con geometrie degeneri (anchorLeft > maxRight) eviterebbe un rect a
         *  larghezza negativa, che è SVG non valida. */
        const badgeW = Math.max(0, Math.round(Math.min(
            longestLineW + r.hPadL + r.hPadR,
            r.maxRight - r.anchorLeft
        )));

        /** Coordinata Y superiore del rettangolo del badge (centrato verticalmente su anchorCenterY). */
        const badgeY = Math.round(r.anchorCenterY - badgeH / 2);

        /** Border radius finale del pill.
         *  Se è una riga singola forma un semicerchio perfetto sui bordi,
         *  se è multilinea si limita il raggio per non arrotondare eccessivamente i lati. */
        const radius = Math.round(Math.min(badgeH / 2, r.fontSize / 2 + r.vPad));

        /** Coordinata X iniziale di partenza per scrivere il testo all'interno del badge. */
        const textX = r.anchorLeft + r.hPadL;

        /** Baseline Y della prima riga del testo badge.
         *  Centra verticalmente il blocco testuale nel pill.
         *  Il fattore BASELINE_OFFSET_RATIO (0.8) sposta la Y dalla cima del font-box alla sua baseline tipografica. */
        const firstBaselineY = badgeY + (badgeH - blockHeight) / 2 + r.fontSize * this.BASELINE_OFFSET_RATIO;

        /** Tspan multilinea del testo badge. */
        const tspans = lines
            .map((line, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : r.lineStep}">${esc(line)}</tspan>`)
            .join('');

        return `<?xml version="1.0" encoding="UTF-8"?>` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="${r.canvasW}" height="${r.canvasH}">` +
            `<rect x="${r.anchorLeft}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${radius}" fill="${esc(r.bgColor)}" fill-opacity="${r.fillOpacity}"/>` +
            `<text x="${textX}" y="${firstBaselineY}" ` +
            `font-family="${esc(r.fontFamily)}" ` +
            `font-size="${r.fontSize}" font-weight="700" fill="${esc(r.textColor)}" ` +
            `text-anchor="start">${tspans}</text>` +
            `</svg>`;
    }
}
