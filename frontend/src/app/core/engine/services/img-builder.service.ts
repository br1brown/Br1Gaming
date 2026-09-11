import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ThemeService } from './theme.service';
import { WEB_FONTS } from '../font-system';
import { resolvedFonts } from '../../../../styles/font-config';

/** Servizio di generazione immagini PNG/SVG a partire da testo (supporto browser e SSR). */

// ─── Tipi pubblici ────────────────────────────────────────────────────────────

/** Modalità di calcolo delle dimensioni rispetto al testo. */
export type ImgRenderMode = 'exactInLine' | 'wrap' | 'fixedRatio' | 'fit';

/** Opzioni per i metodi istanza (default letti dal tema). */
export interface ImgBuildOptions {
    /** Ruolo colore semantico ('primary' | 'secondary') da cui derivare bgColor/textColor. */
    colorRole?: 'primary' | 'secondary';
    /** Colore di sfondo esadecimale (es. '#3a86ff'). Default: colorPrimary/colorSecondary del sito, secondo `colorRole`. */
    bgColor?: string;
    /** Colore del testo esadecimale. Default: calcolato per massimo contrasto WCAG sul bgColor. */
    textColor?: string;
    /** Dimensione del font in pixel. Default: 40. */
    fontSize?: number;
    /** Chiave del font (es. 'Arial', 'Georgia'). Default: il font web risolto del sito. */
    fontFamily?: keyof typeof WEB_FONTS;
    /** Rapporto d'aspetto dell'immagine finale. Default: '4:3'. */
    ratio?: '4:3' | '16:9' | '1:1' | '9:16';
    /** Larghezza massima in pixel. Default: 1200. */
    maxWidth?: number;
    /** Moltiplicatore di interlinea rispetto al fontSize. Default: 1.4. */
    lineHeight?: number;
    /** Modalità di layout. Default: 'wrap'. */
    renderMode?: ImgRenderMode;
    /** Solo per renderMode 'fit': scala minima del font prima di troncare. Default: 0.5. */
    minFontScale?: number;
    /** Solo per renderMode 'fit': righe massime prima del troncamento con ellissi. Default: 6. */
    maxLines?: number;
}

/** Opzioni risolte con tutti i campi obbligatori per buildSvg. */
export interface ImgBuildResolved {
    bgColor: string;
    textColor: string;
    fontSize: number;
    /** Stack font completo pronto per CSS/SVG, es. 'Arial, "Apple Color Emoji", sans-serif'. */
    fontFamily: string;
    ratio: '4:3' | '16:9' | '1:1' | '9:16';
    maxWidth: number;
    lineHeight: number;
    renderMode: ImgRenderMode;
    /** Solo 'fit': scala minima del font prima di troncare. */
    minFontScale: number;
    /** Solo 'fit': righe massime prima del troncamento con ellissi. */
    maxLines: number;
}

// ─── Tipi shrink-to-fit ─────────────────────────────────────────────────────────

/** Un blocco di testo da far entrare (es. titolo, sottotitolo). */
export interface TextBlockSpec {
    /** Testo del blocco (già normalizzato dal chiamante). */
    text: string;
    /** Font-size a scala piena (verrà ridotto in proporzione durante lo shrink). */
    baseFontSize: number;
    /** Moltiplicatore di interlinea del blocco. */
    lineHeight: number;
    /** Numero massimo di righe oltre cui troncare con ellissi (ultima risorsa). */
    maxLines: number;
    /** Il blocco è in grassetto? Incide solo sulla misura della larghezza. Default: false. */
    bold?: boolean;
}

/** Risultato di layout di un singolo blocco dopo il fit. */
export interface FittedBlock {
    /** Font-size finale (dopo l'eventuale shrink). */
    fontSize: number;
    /** Righe wrappate (eventualmente troncate con ellissi). */
    lines: string[];
    /** Passo verticale tra una riga e l'altra (fontSize · lineHeight). */
    lineStep: number;
    /** Altezza del blocco (fontSize + righe extra · lineStep). */
    blockHeight: number;
}

/** Opzioni del fit. La misura è iniettabile: canvas nel browser, tabella font sul server. */
export interface FitOptions {
    /** Scala minima del font sotto cui non scendere (poi si tronca). Default: 0.6. */
    minScale?: number;
    /** Passo di riduzione della scala a ogni tentativo. Default: 0.05. */
    step?: number;
    /** Misura size-aware della larghezza. Default: stima `text.length · fontSize · 0.55`. */
    measureFn?: (text: string, fontSizePx: number, bold: boolean) => number;
}

/** Esito complessivo del fit di uno o più blocchi entro un'altezza disponibile. */
export interface FitResult {
    /** Scala del font applicata (1 = nessuna riduzione). */
    scale: number;
    /** Blocchi risolti, nello stesso ordine di input. */
    blocks: FittedBlock[];
    /** Altezza totale occupata dal testo (somma blocchi + gap tra blocchi). */
    textHeight: number;
    /** True se è stato necessario troncare con ellissi (non bastava lo shrink). */
    truncated: boolean;
}

// ─── Tipi pill/badge ────────────────────────────────────────────────────────────

/** Opzioni per buildPill (chip/badge arrotondato con testo e sfondo). */
export interface PillOptions {
    /** Testo principale del pill, in grassetto. */
    text: string;
    /** Subline opzionale su riga singola (troncata con ellissi se eccede). */
    subtitle?: string;
    /** Colore di sfondo del pill. */
    bgColor: string;
    /** Larghezza massima totale del pill (padding compreso). */
    maxWidth: number;
    /** Coordinata X del bordo sinistro. */
    x: number;
    /** Coordinata Y del bordo superiore. */
    y?: number;
    /** Coordinata Y del centro verticale a cui ancorare il pill. */
    anchorCenterY?: number;
    /** Font-size del testo principale. Default: 40. */
    fontSize?: number;
    /** Font-size della subline. Default: ~55% di fontSize. */
    subtitleFontSize?: number;
    /** Font-family. Default: webStack risolto. */
    fontFamily?: string;
    /** Moltiplicatore line-height del testo principale. Default: 1.3. */
    lineHeight?: number;
    /** Max righe del testo principale prima del troncamento. Default: 3. */
    maxLines?: number;
    /** Padding orizzontale sinistro. Default: fontSize * 0.85. */
    hPadL?: number;
    /** Padding orizzontale destro. Default: fontSize * 0.85. */
    hPadR?: number;
    /** Padding verticale sopra/sotto il testo. Default: fontSize * 0.45. */
    vPad?: number;
    /** Opacità di riempimento del pill. Default: 1. */
    fillOpacity?: number;
    /** Funzione di misura della larghezza del testo. */
    measureFn?: (text: string, fontSizePx: number, bold: boolean) => number;
}

/** Esito di buildPill (frammento SVG e dimensioni). */
export interface PillResult {
    /** Frammento SVG del pill. */
    svg: string;
    /** Larghezza finale del pill. */
    width: number;
    /** Altezza finale del pill. */
    height: number;
    /** Coordinata Y del bordo superiore effettivamente usata. */
    y: number;
}

/** Opzioni per overlay pill con posizionamento automatico via corner/margin. */
export interface PillOverlayOptions extends Omit<PillOptions, 'x' | 'y' | 'anchorCenterY' | 'maxWidth' | 'bgColor' | 'measureFn'> {
    /** Colore di sfondo del pill (default da colorRole o tema). */
    bgColor?: string;
    /** Ruolo colore semantico se bgColor è omesso. Default: 'primary'. */
    colorRole?: 'primary' | 'secondary';
    /** Angolo del canvas su cui ancorare il pill. Default: 'bottom-left'. */
    corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Distanza dai bordi del canvas in px. Default: 24. */
    margin?: number;
    /** Larghezza massima del pill. Default: larghezza canvas - margin * 2. */
    maxWidth?: number;
}

/** Opzioni di adattamento dell'immagine di base al canvas finale. */
export interface ImageCanvasOptions {
    /** Larghezza finale del canvas. */
    width?: number;
    /** Altezza finale del canvas. */
    height?: number;
    /** Modalità di adattamento proporzioni ('cover' | 'contain'). Default: 'cover'. */
    fit?: 'cover' | 'contain';
    /** Modalità di disegno dello sfondo ('direct' | 'blurred'). Default: 'direct'. */
    background?: 'direct' | 'blurred';
    /** Disegno dell'immagine nitida sopra lo sfondo sfocato ('contain' | 'inset' | 'none'). */
    foreground?: 'contain' | 'inset' | 'none';
    /** Solo con foreground: 'inset'. Altezza massima del riquadro nitido (frazione di height). Default: 0.5. */
    insetHeightRatio?: number;
    /** Colore di riempimento iniziale del canvas (previene trasparenze indesiderate). */
    backdropColor?: string;
}

/** Opzioni per buildCaption (fascia scrim con testo e subline). */
export interface CaptionOptions {
    /** Larghezza del canvas. */
    canvasW: number;
    /** Altezza del canvas. */
    canvasH: number;
    /** Testo principale della caption. */
    text: string;
    /** Sottotitolo opzionale a riga singola. */
    subtitle?: string;
    /** Posizione della fascia ('top' | 'bottom' | 'center'). Default: 'bottom'. */
    position?: 'top' | 'bottom' | 'center';
    /** Colore pieno dello scrim. Default: '#000000'. */
    scrimColor?: string;
    /** Opacità della zona piena dello scrim. Default: 1. */
    scrimOpacity?: number;
    /** Altezza della sfumatura come frazione di canvasH. Default: 0.12. */
    fadeRatio?: number;
    /** Font-size del testo principale. Default: proporzionale a canvasH (~9%). */
    fontSize?: number;
    /** Font-size della subline. Default: ~55% di fontSize. */
    subtitleFontSize?: number;
    /** Font-family. Default: webStack risolto. */
    fontFamily?: string;
    /** Moltiplicatore line-height del testo principale. Default: 1.3. */
    lineHeight?: number;
    /** Righe massime del testo principale. Default: 4. */
    maxLines?: number;
    /** Scala minima del font prima di troncare con ellissi. Default: 0.5. */
    minFontScale?: number;
    /** Padding orizzontale dello scrim. Default: fontSize. */
    paddingH?: number;
    /** Padding verticale del blocco testo. Default: fontSize * 0.6. */
    paddingV?: number;
    /** Funzione di misura del testo. */
    measureFn?: (text: string, fontSizePx: number, bold: boolean) => number;
}

/** Opzioni per overlay caption con scrimColor opzionale da tema. */
export interface CaptionOverlayOptions extends Omit<CaptionOptions, 'canvasW' | 'canvasH' | 'measureFn' | 'scrimColor'> {
    /** Colore pieno dello scrim. Default dal tema secondo colorRole. */
    scrimColor?: string;
    /** Ruolo colore semantico se scrimColor è omesso. Default: 'primary'. */
    colorRole?: 'primary' | 'secondary';
    /** Se true, calcola da sé l'altezza del canvas (`imgOpts.height` viene ignorato) e i `maxLines`
     *  perché `text`/`subtitle` entrino SEMPRE per intero, mai troncati con ellissi — a differenza
     *  del comportamento di base, legato al rapporto dell'immagine con un tetto fisso di righe.
     *  Il canvas risultante può divergere dal rapporto naturale dell'immagine: `imgOpts.background`/
     *  `foreground` diventano quindi `'blurred'`/`'contain'` di default (sovrascrivibili) perché
     *  l'immagine resti sempre intera invece di essere ritagliata dal `'cover'` di base. Utile
     *  quando il testo non è noto a priori (es. generato). Default: false. */
    autoFit?: boolean;
    /** Solo con `autoFit`: quota minima di canvas riservata all'immagine di sfondo sopra la fascia
     *  di testo (0-1), perché la fascia non arrivi a coprire l'intera immagine con testi lunghi.
     *  Default: 0.15 (15%). */
    minImageRatio?: number;
}

// ─── Servizio ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ImgBuilderService {
    private readonly theme = inject(ThemeService);

    /** Falso in SSR: buildCanvas lancia se chiamato fuori dal browser. */
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    /** Dimensioni massime/minime assolute in pixel per evitare immagini aberranti. */
    private static readonly DIMENSIONE_MAX_PX = 8000;
    private static readonly DIMENSIONE_MIN_PX = 125;

    // ============================================================
    // ─── Metodi istanza (leggono i Signal del tema come default) ─
    // ============================================================

    /** Genera il canvas PNG con il testo richiesto (solo browser, null in SSR). */
    async buildCanvas(text: string, opts: ImgBuildOptions = {}): Promise<HTMLCanvasElement | null> {
        if (!this.isBrowser) return null;

        const r = this.resolveOptions(opts);
        const { svg, width, height } = ImgBuilderService.buildSvg(text, r);

        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(width);
            canvas.height = Math.ceil(height);
            const ctx = canvas.getContext('2d')!;

            // Conversione SVG → Blob → URL temporaneo → Image
            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const objectUrl = URL.createObjectURL(blob);
            const img = new Image();

            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(objectUrl);
                resolve(canvas);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Rendering SVG→Canvas fallito'));
            };
            img.src = objectUrl;
        });
    }

    /** Restituisce un Blob PNG (utile per download o condivisione via Web Share API). */
    async buildBlob(text: string, opts?: ImgBuildOptions): Promise<Blob | null> {
        const canvas = await this.buildCanvas(text, opts);
        if (!canvas) return null;
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    /** Restituisce un File PNG pronto per essere allegato a un FormData o upload. */
    async buildFile(text: string, filename = 'immagine.png', opts?: ImgBuildOptions): Promise<File | null> {
        const blob = await this.buildBlob(text, opts);
        return blob ? new File([blob], filename, { type: 'image/png' }) : null;
    }

    /** Sovrappone un badge/pill di testo a un'immagine esistente (solo browser, null in SSR). */
    async buildCanvasWithPill(
        imageSrc: string | Blob,
        pillOpts: PillOverlayOptions,
        imgOpts: ImageCanvasOptions = {},
    ): Promise<HTMLCanvasElement | null> {
        if (!this.isBrowser) return null;

        const { baseImg, width, height, canvas, ctx } = await this.prepareBaseCanvas(imageSrc, imgOpts);

        const bgColor = pillOpts.bgColor ?? this.roleColors(pillOpts.colorRole)[0];
        ImgBuilderService.drawImageBackground(ctx, baseImg, width, height, imgOpts, imgOpts.backdropColor ?? bgColor);

        const fontFamily = pillOpts.fontFamily ?? resolvedFonts.webStack;
        const measureFn = ImgBuilderService.canvasMeasureFn(ctx, fontFamily);

        const margin = pillOpts.margin ?? 24;
        const corner = pillOpts.corner ?? 'bottom-left';
        const maxWidth = pillOpts.maxWidth ?? (width - margin * 2);
        const basePill = { ...pillOpts, bgColor, fontFamily, maxWidth, measureFn };

        // Probe per calcolare le dimensioni del pill, poi calcolo coordinate effettive
        const probe = ImgBuilderService.buildPill({ ...basePill, x: 0, y: 0 });
        const x = corner.endsWith('right') ? width - margin - probe.width : margin;
        const y = corner.startsWith('bottom') ? height - margin - probe.height : margin;

        const pill = ImgBuilderService.buildPill({ ...basePill, x, y });
        const pillSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${pill.svg}</svg>`;
        const pillImg = await ImgBuilderService.loadImage(new Blob([pillSvg], { type: 'image/svg+xml;charset=utf-8' }));
        ctx.drawImage(pillImg, 0, 0, width, height);

        return canvas;
    }

    /** Come `buildCanvasWithPill`, ma restituisce direttamente un Blob PNG. */
    async buildBlobWithPill(imageSrc: string | Blob, pillOpts: PillOverlayOptions, imgOpts?: ImageCanvasOptions): Promise<Blob | null> {
        const canvas = await this.buildCanvasWithPill(imageSrc, pillOpts, imgOpts);
        if (!canvas) return null;
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    /** Come `buildCanvasWithPill`, ma restituisce direttamente un File PNG. */
    async buildFileWithPill(imageSrc: string | Blob, pillOpts: PillOverlayOptions, filename = 'immagine.png', imgOpts?: ImageCanvasOptions): Promise<File | null> {
        const blob = await this.buildBlobWithPill(imageSrc, pillOpts, imgOpts);
        return blob ? new File([blob], filename, { type: 'image/png' }) : null;
    }

    /** Sovrappone una caption (scrim + testo) a un'immagine esistente (solo browser, null in SSR). */
    async buildCanvasWithCaption(
        imageSrc: string | Blob,
        captionOpts: CaptionOverlayOptions,
        imgOpts: ImageCanvasOptions = {},
    ): Promise<HTMLCanvasElement | null> {
        if (!this.isBrowser) return null;

        let resolvedImgOpts = imgOpts;
        let resolvedCaptionOpts = captionOpts;
        if (captionOpts.autoFit) {
            const width = imgOpts.width ?? 1200;
            const fontSize = captionOpts.fontSize ?? Math.round(width * 0.04);
            const fontFamily = captionOpts.fontFamily ?? resolvedFonts.webStack;
            // ctx di sola misura: measureText dipende solo dal font impostato su ctx, non dalle
            // dimensioni del canvas — stessa identica misura che darebbe il ctx (canvas diverso,
            // stesso font) che disegna il risultato più sotto, quindi nessuno scarto da coprire.
            const measureCtx = document.createElement('canvas').getContext('2d')!;
            const measureFn = ImgBuilderService.canvasMeasureFn(measureCtx, fontFamily);
            const { canvasH, maxLines } = ImgBuilderService.fitCaptionHeight(width, captionOpts.text, captionOpts.subtitle, fontSize, {
                lineHeight: captionOpts.lineHeight,
                subtitleFontSize: captionOpts.subtitleFontSize,
                paddingH: captionOpts.paddingH,
                paddingV: captionOpts.paddingV,
                measureFn,
                minImageRatio: captionOpts.minImageRatio,
            });
            // Senza autoFit, canvasH = height naturale dell'immagine (nessun crop, 'cover' è un
            // no-op). Qui invece canvasH lo decide il testo: può divergere parecchio dal rapporto
            // naturale, e il default 'direct'+'cover' ritaglierebbe l'immagine per riempire il
            // nuovo canvas. Default a 'blurred'+'contain' (solo se il chiamante non ha scelto
            // esplicitamente altro): l'immagine resta SEMPRE intera, mai tagliata, riempita da
            // uno sfondo sfocato invece che dal crop — degrada bene anche quando il rapporto non
            // diverge (contain ≈ cover se i rapporti già combaciano).
            resolvedImgOpts = {
                background: 'blurred',
                foreground: 'contain',
                ...imgOpts,
                width,
                height: canvasH,
            };
            // minFontScale: 1 = nessuno shrink: canvasH è già dimensionato per la scala piena.
            resolvedCaptionOpts = { ...captionOpts, fontSize, maxLines, minFontScale: 1 };
        }

        const { baseImg, width, height, canvas, ctx } = await this.prepareBaseCanvas(imageSrc, resolvedImgOpts);

        const scrimColor = resolvedCaptionOpts.scrimColor ?? this.roleColors(resolvedCaptionOpts.colorRole)[0];
        ImgBuilderService.drawImageBackground(ctx, baseImg, width, height, resolvedImgOpts, resolvedImgOpts.backdropColor ?? scrimColor);

        const fontFamily = resolvedCaptionOpts.fontFamily ?? resolvedFonts.webStack;
        const measureFn = ImgBuilderService.canvasMeasureFn(ctx, fontFamily);

        const { svg } = ImgBuilderService.buildCaption({ ...resolvedCaptionOpts, canvasW: width, canvasH: height, scrimColor, fontFamily, measureFn });
        const captionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svg}</svg>`;
        const captionImg = await ImgBuilderService.loadImage(new Blob([captionSvg], { type: 'image/svg+xml;charset=utf-8' }));
        ctx.drawImage(captionImg, 0, 0, width, height);

        return canvas;
    }

    /** Come `buildCanvasWithCaption`, ma restituisce direttamente un Blob PNG. */
    async buildBlobWithCaption(imageSrc: string | Blob, captionOpts: CaptionOverlayOptions, imgOpts?: ImageCanvasOptions): Promise<Blob | null> {
        const canvas = await this.buildCanvasWithCaption(imageSrc, captionOpts, imgOpts);
        if (!canvas) return null;
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    /** Come `buildCanvasWithCaption`, ma restituisce direttamente un File PNG. */
    async buildFileWithCaption(imageSrc: string | Blob, captionOpts: CaptionOverlayOptions, filename = 'immagine.png', imgOpts?: ImageCanvasOptions): Promise<File | null> {
        const blob = await this.buildBlobWithCaption(imageSrc, captionOpts, imgOpts);
        return blob ? new File([blob], filename, { type: 'image/png' }) : null;
    }

    /** Coppia (sfondo, testo) del tema per il colorRole richiesto ('secondary' o default 'primary'). */
    private roleColors(colorRole?: 'primary' | 'secondary'): [string, string] {
        return colorRole === 'secondary'
            ? [this.theme.colorSecondary(), this.theme.colorSecondaryText()]
            : [this.theme.colorPrimary(), this.theme.colorPrimaryText()];
    }

    private async prepareBaseCanvas(imageSrc: string | Blob, imgOpts: ImageCanvasOptions) {
        const baseImg = await ImgBuilderService.loadImage(imageSrc);
        const naturalRatio = baseImg.naturalWidth / baseImg.naturalHeight;
        let width = imgOpts.width;
        let height = imgOpts.height;
        if (width && !height) height = Math.round(width / naturalRatio);
        else if (height && !width) width = Math.round(height * naturalRatio);
        else if (!width || !height) { width = baseImg.naturalWidth; height = baseImg.naturalHeight; }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        return { baseImg, width, height, canvas, ctx };
    }

    /** Risolve le opzioni con i valori correnti del tema. */
    private resolveOptions(opts: ImgBuildOptions): ImgBuildResolved {
        const [roleBg, roleText] = this.roleColors(opts.colorRole);
        return {
            bgColor: opts.bgColor ?? roleBg,
            textColor: opts.textColor ?? roleText,
            fontSize: opts.fontSize ?? 40,
            // opts.fontFamily è una CHIAVE di WEB_FONTS: va risolta nello stack CSS reale,
            // altrimenti il canvas riceve la chiave (es. "Times") invece del font stack.
            fontFamily: opts.fontFamily ? WEB_FONTS[opts.fontFamily] : resolvedFonts.webStack,
            ratio: opts.ratio ?? '4:3',
            maxWidth: opts.maxWidth ?? 1000,
            lineHeight: opts.lineHeight ?? 1.4,
            renderMode: opts.renderMode ?? 'wrap',
            minFontScale: opts.minFontScale ?? 0.5,
            maxLines: opts.maxLines ?? 6,
        };
    }

    /** `measureFn` (testo, fontSize, bold) → larghezza, per pill/caption che misurano su un
     *  canvas 2D già aperto (`ctx`) invece di approssimare la larghezza del testo. */
    private static canvasMeasureFn(ctx: CanvasRenderingContext2D, fontFamily: string): (t: string, fontSizePx: number, bold: boolean) => number {
        return (t, fontSizePx, bold) => {
            ctx.font = `${bold ? 700 : 400} ${fontSizePx}px ${fontFamily}`;
            return ctx.measureText(t).width;
        };
    }

    // ============================================================
    // ─── API STATICA — pura, SSR-safe, zero Signal/this/DOM ─────
    //
    // Non ha accesso ai Signal Angular né al DOM: tutti i parametri
    // devono essere passati esplicitamente dal chiamante.
    // ============================================================

    /** Calcola font-size e wrapping per adattare blocchi di testo all'altezza disponibile. */
    static fitTextBlocks(
        blocks: TextBlockSpec[],
        maxWidthPx: number,
        availableHeight: number,
        gap: number,
        opts: FitOptions = {},
    ): FitResult {
        const minScale = opts.minScale ?? 0.6;
        const step = opts.step ?? 0.05;
        const measure = opts.measureFn ?? ((t: string, fs: number) => t.length * fs * 0.55);

        const compute = (scale: number, truncate: boolean): { blocks: FittedBlock[]; textHeight: number } => {
            const fitted = blocks.map(b => {
                const fontSize = Math.max(1, Math.round(b.baseFontSize * scale));
                const lineStep = fontSize * b.lineHeight;
                const lines = ImgBuilderService.wrapText(
                    b.text, maxWidthPx, fontSize,
                    (t: string) => measure(t, fontSize, b.bold ?? false),
                    truncate ? b.maxLines : undefined,
                );
                const blockHeight = fontSize + (lines.length - 1) * lineStep;
                return { fontSize, lines, lineStep, blockHeight };
            });
            const textHeight = fitted.reduce((sum, f) => sum + f.blockHeight, 0)
                + gap * Math.max(0, fitted.length - 1);
            return { blocks: fitted, textHeight };
        };

        // Shrink-to-fit: riduce la scala finché il testo entra in altezza
        for (let scale = 1; scale >= minScale - 1e-9; scale -= step) {
            const c = compute(scale, false);
            if (c.textHeight <= availableHeight) {
                return { scale, blocks: c.blocks, textHeight: c.textHeight, truncated: false };
            }
        }
        // Fallback: scala piena e troncamento a maxLines
        const c = compute(1, true);
        return { scale: 1, blocks: c.blocks, textHeight: c.textHeight, truncated: true };
    }

    /** Padding orizzontale del pill come frazione di fontSize. */
    static readonly PILL_PAD_H_RATIO = 0.85;
    /** Padding verticale del pill come frazione di fontSize. */
    static readonly PILL_PAD_V_RATIO = 0.45;
    /** Gap tra testo principale e subline come frazione di paddingV. */
    static readonly PILL_SUBTITLE_GAP_RATIO = 0.4;
    /** Offset dalla cima del font-box alla baseline tipografica. */
    static readonly PILL_BASELINE_OFFSET_RATIO = 0.8;

    /** Costruisce il frammento SVG di un pill/badge arrotondato. */
    static buildPill(opts: PillOptions): PillResult {
        const esc = ImgBuilderService.escapeXml;
        const fontSize = opts.fontSize ?? 40;
        const subtitleFontSize = opts.subtitleFontSize ?? Math.round(fontSize * 0.55);
        const fontFamily = opts.fontFamily ?? resolvedFonts.webStack;
        const lineHeight = opts.lineHeight ?? 1.3;
        const maxLines = opts.maxLines ?? 3;
        const hPadL = opts.hPadL ?? Math.round(fontSize * this.PILL_PAD_H_RATIO);
        const hPadR = opts.hPadR ?? Math.round(fontSize * this.PILL_PAD_H_RATIO);
        const vPad = opts.vPad ?? Math.round(fontSize * this.PILL_PAD_V_RATIO);
        const fillOpacity = opts.fillOpacity ?? 1;
        const measure = opts.measureFn ?? ((t: string, fs: number) => t.length * fs * 0.55);

        const textColor = ImgBuilderService.getReadableTextColor(opts.bgColor);
        const mutedTextColor = ImgBuilderService.mutedTextColor(textColor, opts.bgColor);
        const lineStep = fontSize * lineHeight;
        const maxTextW = opts.maxWidth - hPadL - hPadR;

        const maxTextHeight = fontSize + (maxLines - 1) * lineStep;
        const lines = ImgBuilderService.fitTextBlocks(
            [{ text: opts.text, baseFontSize: fontSize, lineHeight, maxLines, bold: true }],
            maxTextW, maxTextHeight, 0, { minScale: 1, measureFn: measure },
        ).blocks[0].lines;

        const longestLineW = Math.max(...lines.map(l => measure(l, fontSize, true)));
        const blockHeight = fontSize + (lines.length - 1) * lineStep;

        const hasSubtitle = !!opts.subtitle;
        const subtitleLine = hasSubtitle
            ? ImgBuilderService.wrapText(opts.subtitle!, maxTextW, subtitleFontSize, (t: string) => measure(t, subtitleFontSize, false), 1)[0]
            : '';
        const subtitleLineW = hasSubtitle ? measure(subtitleLine, subtitleFontSize, false) : 0;
        const subtitleGap = Math.round(vPad * this.PILL_SUBTITLE_GAP_RATIO);

        const contentHeight = blockHeight + (hasSubtitle ? subtitleGap + subtitleFontSize : 0);
        const height = Math.round(contentHeight + vPad * 2);
        const width = Math.max(0, Math.round(Math.min(Math.max(longestLineW, subtitleLineW) + hPadL + hPadR, opts.maxWidth)));

        const y = opts.anchorCenterY !== undefined ? Math.round(opts.anchorCenterY - height / 2) : Math.round(opts.y ?? 0);
        const radius = Math.round(Math.min(height / 2, fontSize / 2 + vPad));

        const textX = opts.x + hPadL;
        const contentTop = y + (height - contentHeight) / 2;
        const firstBaselineY = contentTop + fontSize * this.PILL_BASELINE_OFFSET_RATIO;

        const tspans = lines
            .map((line, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : lineStep}">${esc(line)}</tspan>`)
            .join('');

        const subtitleEl = hasSubtitle
            ? (() => {
                const subtitleBaselineY = contentTop + blockHeight + subtitleGap + subtitleFontSize * this.PILL_BASELINE_OFFSET_RATIO;
                return `<text x="${textX}" y="${subtitleBaselineY}" font-family="${esc(fontFamily)}" font-size="${subtitleFontSize}" font-weight="400" fill="${esc(mutedTextColor)}" text-anchor="start">${esc(subtitleLine)}</text>`;
            })()
            : '';

        const svg =
            `<rect x="${opts.x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${esc(opts.bgColor)}" fill-opacity="${fillOpacity}"/>` +
            `<text x="${textX}" y="${firstBaselineY}" font-family="${esc(fontFamily)}" font-size="${fontSize}" font-weight="700" fill="${esc(textColor)}" text-anchor="start">${tspans}</text>` +
            subtitleEl;

        return { svg, width, height, y };
    }

    /** Righe massime di default per la caption. */
    static readonly MAX_CAPTION_LINES = 4;

    /** Frazione massima di canvasH che buildCaption riserva al testo del titolo prima di
     *  ricorrere allo shrink-to-fit (poi, sotto `minFontScale`, al troncamento con ellissi).
     *  Condivisa con `fitCaptionHeight`, che la usa al contrario per calcolare l'altezza minima
     *  di canvas che garantisce scala 1 (nessuno shrink, nessun troncamento). */
    static readonly CAPTION_MAX_TEXT_HEIGHT_RATIO = 0.6;

    /**
     * Calcola l'altezza minima di canvas che fa entrare per intero `text`/`subtitle` in una
     * {@link buildCaption} a scala 1 — nessuno shrink-to-fit, nessun troncamento con ellissi —
     * più i `maxLines` esatti da passarle perché il suo shrink-to-fit interno non tronchi mai.
     * Usata da `buildCanvasWithCaption` quando `captionOpts.autoFit` è true.
     *
     * Stessa matematica di `buildCaption` (stesso `PILL_SUBTITLE_GAP_RATIO`,
     * `CAPTION_MAX_TEXT_HEIGHT_RATIO`), non una ricostruzione approssimata: nessun margine di
     * sicurezza applicato al risultato, perché il chiamante userà lo stesso `measureFn` (stesso
     * font, `ctx.measureText` non dipende dalle dimensioni del canvas) sia qui che nel render
     * finale — la misura è già esatta, non una stima da poi correggere.
     */
    static fitCaptionHeight(canvasW: number, text: string, subtitle: string | undefined, fontSize: number, opts: {
        lineHeight?: number;
        subtitleFontSize?: number;
        paddingH?: number;
        paddingV?: number;
        measureFn?: (text: string, fontSizePx: number, bold: boolean) => number;
        minImageRatio?: number;
    } = {}): { canvasH: number; maxLines: number } {
        const lineHeight = opts.lineHeight ?? 1.3;
        const paddingH = opts.paddingH ?? fontSize;
        const paddingV = opts.paddingV ?? Math.round(fontSize * 0.6);
        const measure = opts.measureFn ?? ((t: string, fs: number) => t.length * fs * 0.55);
        const minImageRatio = opts.minImageRatio ?? 0.15;

        const maxTextW = canvasW - paddingH * 2;
        const lineStep = fontSize * lineHeight;
        // maxLines omesso: wrapText non tronca mai, righe è il conteggio reale a scala 1.
        const lines = ImgBuilderService.wrapText(
            ImgBuilderService.normalizeWhitespace(text), maxTextW, fontSize,
            (t: string) => measure(t, fontSize, true),
        );
        const blockHeight = fontSize + (lines.length - 1) * lineStep;

        const subtitleFontSize = opts.subtitleFontSize ?? Math.round(fontSize * 0.55);
        const subtitleGap = Math.round(paddingV * this.PILL_SUBTITLE_GAP_RATIO);
        const contentHeight = blockHeight + (subtitle ? subtitleGap + subtitleFontSize : 0);
        const flatH = contentHeight + paddingV * 2;

        // Altezza minima perché il testo entri a scala 1 dentro il tetto di buildCaption, più
        // quella che lascia visibile almeno `minImageRatio` di immagine sopra la fascia.
        const heightForTextCap = blockHeight / this.CAPTION_MAX_TEXT_HEIGHT_RATIO;
        const heightForImageMargin = flatH / (1 - minImageRatio);
        const canvasH = Math.ceil(Math.max(heightForTextCap, heightForImageMargin));

        return { canvasH, maxLines: lines.length };
    }

    /** Costruisce il frammento SVG di una caption con fascia scrim. */
    static buildCaption(opts: CaptionOptions): { svg: string } {
        const esc = ImgBuilderService.escapeXml;
        const { canvasW, canvasH } = opts;
        const position = opts.position ?? 'bottom';
        const scrimColor = opts.scrimColor ?? '#000000';
        const scrimOpacity = opts.scrimOpacity ?? 1;
        const fadeRatio = opts.fadeRatio ?? 0.12;
        const fontSize = opts.fontSize ?? Math.round(canvasH * 0.09);
        const subtitleFontSize = opts.subtitleFontSize ?? Math.round(fontSize * 0.55);
        const fontFamily = opts.fontFamily ?? resolvedFonts.webStack;
        const lineHeight = opts.lineHeight ?? 1.3;
        const maxLines = opts.maxLines ?? this.MAX_CAPTION_LINES;
        const paddingH = opts.paddingH ?? fontSize;
        const paddingV = opts.paddingV ?? Math.round(fontSize * 0.6);
        const measure = opts.measureFn ?? ((t: string, fs: number) => t.length * fs * 0.55);

        const textColor = ImgBuilderService.getReadableTextColor(scrimColor);
        const mutedTextColor = ImgBuilderService.mutedTextColor(textColor, scrimColor);
        const lineStep = fontSize * lineHeight;

        const maxTextW = canvasW - paddingH * 2;
        const maxTextHeight = Math.min(canvasH * this.CAPTION_MAX_TEXT_HEIGHT_RATIO, fontSize + (maxLines - 1) * lineStep);
        const titleFit = ImgBuilderService.fitTextBlocks(
            [{ text: opts.text, baseFontSize: fontSize, lineHeight, maxLines, bold: true }],
            maxTextW, maxTextHeight, 0, { minScale: opts.minFontScale ?? 0.5, measureFn: measure },
        ).blocks[0];
        const { lines, fontSize: titleFontSize, lineStep: titleLineStep, blockHeight } = titleFit;

        const hasSubtitle = !!opts.subtitle;
        const subtitleLine = hasSubtitle
            ? ImgBuilderService.wrapText(opts.subtitle!, maxTextW, subtitleFontSize, (t: string) => measure(t, subtitleFontSize, false), 1)[0]
            : '';
        const subtitleGap = Math.round(paddingV * ImgBuilderService.PILL_SUBTITLE_GAP_RATIO);
        const contentHeight = blockHeight + (hasSubtitle ? subtitleGap + subtitleFontSize : 0);

        const flatH = Math.min(Math.round(contentHeight + paddingV * 2), canvasH);
        const fadeH = Math.round(canvasH * fadeRatio);

        const gradId = `capFade${Math.random().toString(36).slice(2, 9)}`;
        const fadeGradient = (id: string, opacity0: number, opacity1: number) =>
            `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
            `<stop offset="0%" stop-color="${esc(scrimColor)}" stop-opacity="${opacity0}"/>` +
            `<stop offset="100%" stop-color="${esc(scrimColor)}" stop-opacity="${opacity1}"/>` +
            `</linearGradient>`;

        let flatY: number;
        let defs: string;
        let fadeRects: string;

        if (position === 'top') {
            flatY = 0;
            defs = `<defs>${fadeGradient(gradId, scrimOpacity, 0)}</defs>`;
            fadeRects = `<rect x="0" y="${flatH}" width="${canvasW}" height="${fadeH}" fill="url(#${gradId})"/>`;
        } else if (position === 'center') {
            flatY = Math.round((canvasH - flatH) / 2);
            const gradTopId = `${gradId}t`, gradBotId = `${gradId}b`;
            defs = `<defs>${fadeGradient(gradTopId, 0, scrimOpacity)}${fadeGradient(gradBotId, scrimOpacity, 0)}</defs>`;
            fadeRects =
                `<rect x="0" y="${flatY - fadeH}" width="${canvasW}" height="${fadeH}" fill="url(#${gradTopId})"/>` +
                `<rect x="0" y="${flatY + flatH}" width="${canvasW}" height="${fadeH}" fill="url(#${gradBotId})"/>`;
        } else { // 'bottom'
            flatY = canvasH - flatH;
            defs = `<defs>${fadeGradient(gradId, 0, scrimOpacity)}</defs>`;
            fadeRects = `<rect x="0" y="${flatY - fadeH}" width="${canvasW}" height="${fadeH}" fill="url(#${gradId})"/>`;
        }

        const flatRect = `<rect x="0" y="${flatY}" width="${canvasW}" height="${flatH}" fill="${esc(scrimColor)}" fill-opacity="${scrimOpacity}"/>`;

        const centerX = canvasW / 2;
        const contentTop = flatY + (flatH - contentHeight) / 2;
        const firstBaselineY = contentTop + titleFontSize * this.PILL_BASELINE_OFFSET_RATIO;
        const tspans = lines
            .map((line, i) => `<tspan x="${centerX}" dy="${i === 0 ? 0 : titleLineStep}">${esc(line)}</tspan>`)
            .join('');
        const titleEl = `<text x="${centerX}" y="${firstBaselineY}" font-family="${esc(fontFamily)}" font-size="${titleFontSize}" font-weight="700" fill="${esc(textColor)}" text-anchor="middle">${tspans}</text>`;

        const subtitleEl = hasSubtitle
            ? (() => {
                const subtitleBaselineY = contentTop + blockHeight + subtitleGap + subtitleFontSize * this.PILL_BASELINE_OFFSET_RATIO;
                return `<text x="${centerX}" y="${subtitleBaselineY}" font-family="${esc(fontFamily)}" font-size="${subtitleFontSize}" font-weight="400" fill="${esc(mutedTextColor)}" text-anchor="middle">${esc(subtitleLine)}</text>`;
            })()
            : '';

        return { svg: defs + fadeRects + flatRect + titleEl + subtitleEl };
    }

    static buildSvg(text: string, r: ImgBuildResolved): { svg: string; width: number; height: number } {
        const { bgColor, textColor, fontFamily, ratio, maxWidth, lineHeight, renderMode } = r;

        // Nel browser: misura size-aware con le metriche reali del font (il peso 700 combacia col
        // rendering). Nel server (SSR/Node): undefined → wrapText/fitTextBlocks usano la stima.
        let browserMeasure: ((t: string, fontSizePx: number) => number) | undefined;
        if (typeof document !== 'undefined') {
            const ctx = document.createElement('canvas').getContext('2d')!;
            browserMeasure = (t: string, fontSizePx: number) => {
                ctx.font = `700 ${fontSizePx}px ${fontFamily}`;
                return ctx.measureText(t).width;
            };
        }

        // Il padding è proporzionale al font base: testi grandi hanno margini grandi.
        const paddingPx = r.fontSize * 2;
        const targetRatio = ImgBuilderService.parseRatio(ratio);
        const normalizedText = ImgBuilderService.normalizeWhitespace(text);

        let finalWidth: number;
        let finalHeight: number;
        let lines: string[];
        // Font effettivamente renderizzato: pari al base, tranne in 'fit' dove può ridursi.
        let fontSize = r.fontSize;

        // Misura "baked" al font base, per le modalità che non scalano il testo.
        const measureFn = browserMeasure ? (t: string) => browserMeasure!(t, r.fontSize) : undefined;
        const measure = measureFn ?? ((t: string) => ImgBuilderService.approxTextWidth(t, r.fontSize));

        if (renderMode === 'exactInLine') {
            // ── Nessun wrap: il contenuto guida le dimensioni ─────────────────────
            lines = normalizedText.split('\n').map(l => l.trim() || ' ');

            const larghezzaMassimaTestoPx = Math.max(...lines.map(l => measure(l)));
            const contentW = larghezzaMassimaTestoPx + paddingPx * 2;
            const contentH = lines.length * (fontSize * lineHeight) + paddingPx * 2;

            if (contentW / contentH > targetRatio) {
                finalWidth = contentW;
                finalHeight = contentW / targetRatio;
            } else {
                finalHeight = contentH;
                finalWidth = contentH * targetRatio;
            }

        } else if (renderMode === 'wrap') {
            // ── Larghezza fissa a maxWidth, altezza segue il contenuto ────────────
            const larghezzaDisponibilePx = maxWidth - paddingPx * 2;
            lines = ImgBuilderService.wrapText(normalizedText, larghezzaDisponibilePx, fontSize, measureFn);

            const altezzaTotaleTestoPx = lines.length * (fontSize * lineHeight);
            finalWidth = maxWidth;
            finalHeight = Math.max(altezzaTotaleTestoPx + paddingPx * 2, finalWidth / targetRatio);

        } else if (renderMode === 'fixedRatio') {
            // ── fixedRatio: il ratio comanda, margini dinamici, ri-wrapping ───────
            let larghezza = maxWidth;
            let padding = larghezza * 0.05;
            lines = ImgBuilderService.wrapText(normalizedText, larghezza - padding * 2, fontSize, measureFn);

            let altezza = lines.length * (fontSize * lineHeight) + padding * 2;
            if (larghezza / altezza < targetRatio) {
                larghezza = altezza * targetRatio;
                padding = larghezza * 0.05;
                lines = ImgBuilderService.wrapText(normalizedText, larghezza - padding * 2, fontSize, measureFn);
                altezza = lines.length * (fontSize * lineHeight) + padding * 2;
                if (larghezza / altezza > targetRatio) {
                    altezza = larghezza / targetRatio;
                }
            } else {
                altezza = larghezza / targetRatio;
            }

            finalWidth = larghezza;
            finalHeight = altezza;

        } else {
            // ── 'fit': box FISSO, il testo viene rimpicciolito (shrink-to-fit) per entrare ──
            finalWidth = maxWidth;
            finalHeight = maxWidth / targetRatio;
            const fit = ImgBuilderService.fitTextBlocks(
                [{ text: normalizedText, baseFontSize: r.fontSize, lineHeight, maxLines: r.maxLines, bold: true }],
                finalWidth - paddingPx * 2,
                finalHeight - paddingPx * 2,
                0,
                { minScale: r.minFontScale, measureFn: browserMeasure },
            );
            lines = fit.blocks[0].lines;
            fontSize = fit.blocks[0].fontSize;
        }

        // Clamp finale: evita dimensioni fuori controllo per testi molto lunghi o molto corti
        finalWidth = Math.min(Math.max(Math.ceil(finalWidth), ImgBuilderService.DIMENSIONE_MIN_PX), ImgBuilderService.DIMENSIONE_MAX_PX);
        finalHeight = Math.min(Math.max(Math.ceil(finalHeight), ImgBuilderService.DIMENSIONE_MIN_PX), ImgBuilderService.DIMENSIONE_MAX_PX);

        // Posizionamento verticale del blocco testo al centro del canvas
        const altezzaRigaPx = fontSize * lineHeight;
        const altezzaBloccoTestoPx = lines.length * altezzaRigaPx;
        const centraleX = finalWidth / 2;
        const primaRigaY = (finalHeight - altezzaBloccoTestoPx) / 2 + altezzaRigaPx / 2;

        const esc = ImgBuilderService.escapeXml;
        const tspans = lines
            .map((riga, i) => `<tspan x="${centraleX}" dy="${i === 0 ? 0 : altezzaRigaPx}">${esc(riga)}</tspan>`)
            .join('');

        const svg =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="${finalWidth}" height="${finalHeight}" viewBox="0 0 ${finalWidth} ${finalHeight}">` +
            `<rect width="${finalWidth}" height="${finalHeight}" fill="${esc(bgColor)}"/>` +
            `<text x="${centraleX}" y="${primaRigaY}" font-family="${esc(fontFamily)}" font-size="${fontSize}" font-weight="700" fill="${esc(textColor)}" text-anchor="middle" dominant-baseline="middle">` +
            tspans +
            `</text>` +
            `</svg>`;

        return { svg, width: finalWidth, height: finalHeight };
    }

    /** Sostituisce i caratteri riservati XML/SVG con le entità corrispondenti. */
    static escapeXml(value: string): string {
        return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /** Calcola il contrasto ottimale per il colore del testo (ThemeService). */
    static getReadableTextColor(bgHex: string): '#000000' | '#ffffff' {
        return ThemeService.getReadableTextColor(bgHex);
    }

    /** Rinforza il colore primario in OKLCH per garantire il contrasto target con il testo. */
    static strongFillColor(colorPrimary: string, targetContrast = 7): string {
        const [L0, C, H] = ThemeService.hexToOklch(colorPrimary);
        for (let L = L0; L >= 0.02; L -= 0.005) {
            const candidate = ThemeService.oklchToHex(L, C, H);
            const contrast = Math.max(
                ThemeService.calcContrastRatio(candidate, '#000000'),
                ThemeService.calcContrastRatio(candidate, '#ffffff'),
            );
            if (contrast >= targetContrast) return candidate;
        }
        return '#000000';
    }

    /** Calcola un colore di testo attenuato preservando il contrasto minimo garantito. */
    static mutedTextColor(fgHex: string, bgHex: string, targetOpacity = 0.75, minContrast = 5.5): string {
        for (let opacity = targetOpacity; opacity <= 1; opacity += 0.05) {
            const candidate = ThemeService.mixHexColors(fgHex, bgHex, 1 - opacity);
            if (ThemeService.calcContrastRatio(candidate, bgHex) >= minContrast) return candidate;
        }
        return fgHex;
    }

    // ── Helper privati statici ─────────────────────────────────────────────────

    /** Carica un'immagine da URL o Blob in un elemento Image. */
    private static loadImage(src: string | Blob): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const objectUrl = typeof src !== 'string' ? URL.createObjectURL(src) : null;
            const finalSrc = objectUrl ?? (src as string);
            const img = new Image();
            if (typeof src === 'string' && /^https?:\/\//.test(src)) img.crossOrigin = 'anonymous';
            img.onload = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); resolve(img); };
            img.onerror = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); reject(new Error('Caricamento immagine fallito')); };
            img.src = finalSrc;
        });
    }

    /** Disegna l'immagine nel riquadro target adattando le proporzioni ('cover' | 'contain'). */
    private static drawImageFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, targetW: number, targetH: number, fit: 'cover' | 'contain'): void {
        const srcRatio = img.naturalWidth / img.naturalHeight;
        const targetRatio = targetW / targetH;
        if (fit === 'cover') {
            let sw = img.naturalWidth, sh = img.naturalHeight;
            if (srcRatio > targetRatio) { sw = sh * targetRatio; } else { sh = sw / targetRatio; }
            const sx = (img.naturalWidth - sw) / 2;
            const sy = (img.naturalHeight - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        } else {
            let dw = targetW, dh = targetW / srcRatio;
            if (dh > targetH) { dh = targetH; dw = targetH * srcRatio; }
            const dx = (targetW - dw) / 2;
            const dy = (targetH - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
        }
    }

    /** Raggio di blur proporzionale per lo sfondo sfocato. */
    private static readonly BLURRED_BG_RATIO = 0.025;

    /** Disegna lo sfondo dell'immagine secondo le opzioni specificate. */
    private static drawImageBackground(ctx: CanvasRenderingContext2D, img: HTMLImageElement, targetW: number, targetH: number, opts: ImageCanvasOptions, backdropColor: string): void {
        ctx.fillStyle = backdropColor;
        ctx.fillRect(0, 0, targetW, targetH);

        if ((opts.background ?? 'direct') === 'direct') {
            ImgBuilderService.drawImageFit(ctx, img, targetW, targetH, opts.fit ?? 'cover');
            return;
        }

        const blurPx = Math.max(1, Math.round(Math.min(targetW, targetH) * ImgBuilderService.BLURRED_BG_RATIO));
        ctx.save();
        ctx.filter = `blur(${blurPx}px)`;
        ImgBuilderService.drawImageFit(ctx, img, targetW, targetH, 'cover');
        ctx.restore();

        const foreground = opts.foreground ?? 'contain';
        if (foreground === 'none') return;

        if (foreground === 'contain') {
            ImgBuilderService.drawImageFit(ctx, img, targetW, targetH, 'contain');
            return;
        }

        const maxInsetH = Math.round(targetH * (opts.insetHeightRatio ?? 0.5));
        const srcRatio = img.naturalWidth / img.naturalHeight;
        let insetW = maxInsetH * srcRatio;
        let insetH = maxInsetH;
        if (insetW > targetW) { insetW = targetW; insetH = insetW / srcRatio; }
        const dx = Math.round((targetW - insetW) / 2);
        ctx.drawImage(img, dx, 0, insetW, insetH);
    }

    /** Converte la stringa ratio (es. '16:9') in valore decimale (fallback 4/3). */
    private static parseRatio(ratio: string): number {
        const match = /^(\d+):(\d+)$/.exec(ratio);
        if (!match) return 4 / 3;
        const denominatore = Number(match[2]);
        return denominatore === 0 ? 4 / 3 : Number(match[1]) / denominatore;
    }

    /** Spezza il testo in righe entro maxWidthPx. */
    static wrapText(text: string, maxWidthPx: number, fontSizePx: number, measureFn?: (t: string) => number, maxLines?: number): string[] {
        const measure = measureFn ?? ((t: string) => t.length * fontSizePx * 0.55);

        const righe = text.split('\n').flatMap(paragrafo => {
            const p = paragrafo.trim();
            // Riga vuota → spazio singolo per preservare la spaziatura verticale nel SVG
            if (!p) return [' '];

            const parole: string[] = p.split(/\s+/);
            const righe: string[] = [];
            let rigaCorrente = '';

            for (const parola of parole) {
                // Parola più lunga della riga: spezzala carattere per carattere
                if (measure(parola) > maxWidthPx) {
                    if (rigaCorrente) { righe.push(rigaCorrente); rigaCorrente = ''; }
                    for (const char of parola) {
                        const candidato = rigaCorrente ? rigaCorrente + char : char;
                        if (measure(candidato) > maxWidthPx && rigaCorrente) {
                            righe.push(rigaCorrente);
                            rigaCorrente = char;
                        } else {
                            rigaCorrente = candidato;
                        }
                    }
                    continue;
                }
                // Prima parola della riga corrente
                if (!rigaCorrente) { rigaCorrente = parola; continue; }
                // La parola ci sta: aggiungila alla riga corrente
                const candidato = rigaCorrente + ' ' + parola;
                if (measure(candidato) <= maxWidthPx) {
                    rigaCorrente = candidato;
                } else {
                    // Non ci sta: chiudi la riga corrente e inizia una nuova
                    righe.push(rigaCorrente);
                    rigaCorrente = parola;
                }
            }
            if (rigaCorrente) righe.push(rigaCorrente);
            return righe;
        });

        // Troncamento con ellissi se supera maxLines
        if (maxLines && righe.length > maxLines) {
            const tenute = righe.slice(0, maxLines);
            let ultima = tenute[maxLines - 1].trimEnd();
            while (ultima && measure(ultima + '…') > maxWidthPx) ultima = ultima.slice(0, -1).trimEnd();
            tenute[maxLines - 1] = ultima + '…';
            return tenute;
        }
        return righe;
    }

    /** Stima la larghezza in pixel di una stringa senza canvas. */
    private static approxTextWidth(text: string, fontSize: number): number {
        return text.length * fontSize * 0.55;
    }

    /** Normalizza i ritorni a capo e comprime gli spazi multipli. */
    static normalizeWhitespace(text: string): string {
        return text
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map(riga => riga.replace(/\s+/g, ' ').trim())
            .join('\n');
    }
}
