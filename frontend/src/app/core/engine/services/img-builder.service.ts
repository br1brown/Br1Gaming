import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ThemeService } from './theme.service';
import { FontConfig } from '../../../../styles/font-config';

/**
 * IMG BUILDER SERVICE
 *
 * Genera immagini PNG a partire da testo:
 *   - nel browser produce un HTMLCanvasElement (async, perché SVG→canvas richiede Image.onload)
 *   - lato server (Node/SSR) si usa solo la parte statica `buildSvg`, che non tocca DOM
 *
 * Architettura a due livelli:
 *   1. Metodi ISTANZA  (buildCanvas, buildBlob, buildFile)
 *      → accettano opzioni parziali, completano i default dai Signal del tema Angular
 *   2. Metodo STATICO  (buildSvg)
 *      → riceve tutti i parametri obbligatori; zero Angular, zero DOM, chiamabile da Node
 *
 * Questo disegno garantisce che browser e server usino esattamente la stessa logica
 * di layout e rendering — un solo posto dove cambiare se si vuole modificare l'aspetto.
 */

// ─── Tipi pubblici ────────────────────────────────────────────────────────────

/**
 * Controlla come vengono calcolate le dimensioni dell'immagine in relazione al testo.
 *
 *  'exactInLine' → nessun wrap automatico: si rispettano solo i \n espliciti e il canvas
 *                  si ridimensiona attorno al testo. Utile per titoli brevi e tag.
 *  'wrap'        → (default) larghezza fissa a maxWidth, wrap automatico, altezza segue il
 *                  contenuto. Il ratio aggiunge solo spazio verticale minimo.
 *  'fixedRatio'  → il ratio comanda: la larghezza si espande se necessario, i margini
 *                  diventano dinamici (5% della larghezza) e il testo viene ri-wrappato.
 *                  Utile quando il formato dell'immagine è più importante della lunghezza.
 *  'fit'         → box FISSO (maxWidth × maxWidth/ratio): il testo NON allarga il canvas ma
 *                  viene rimpicciolito (shrink-to-fit) finché entra; oltre la scala minima si
 *                  tronca con ellissi. Utile per card di dimensione fissa (es. anteprime OG).
 */
export type ImgRenderMode = 'exactInLine' | 'wrap' | 'fixedRatio' | 'fit';

/**
 * Opzioni per i metodi istanza: tutti i campi sono facoltativi perché i default
 * vengono letti in autonomia dai Signal del tema (colore, font, ecc.).
 * Da usare nei componenti Angular, non nel layer server.
 */
export interface ImgBuildOptions {
    /** Colore di sfondo esadecimale (es. '#3a86ff'). Default: colorTema del sito. */
    bgColor?: string;
    /** Colore del testo esadecimale. Default: calcolato per massimo contrasto WCAG sul bgColor. */
    textColor?: string;
    /** Dimensione del font in pixel. Default: 40. */
    fontSize?: number;
    /** Chiave del font (es. 'Arial', 'Georgia'). Default: FontConfig.DEFAULT_WEB_FONT. */
    fontFamily?: keyof typeof FontConfig.WEB_FONTS;
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

/**
 * Versione con tutti i campi obbligatori: prodotta da resolveOptions() e
 * consumata da buildSvg(). Garantisce che nessun parametro sia undefined
 * quando si entra nella logica di layout.
 */
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

    /**
     * Genera il canvas PNG con il testo richiesto.
     * Restituisce null se chiamata fuori dal browser (SSR/prerender), cosi' il chiamante
     * puo' gestire l'assenza di canvas come normale ramo di codice senza guard di piattaforma.
     *
     * Flusso interno (solo browser):
     *   1. resolveOptions() completa i default dai Signal
     *   2. buildSvg() produce la stringa SVG con il layout calcolato
     *   3. L'SVG viene trasformato in Blob → ObjectURL → Image.onload → ctx.drawImage
     *
     * È asincrona perché il browser carica l'immagine SVG in modo non bloccante
     * tramite Image.onload; non è possibile farlo in modo sincrono.
     */
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
                URL.revokeObjectURL(objectUrl); // libera la memoria del Blob
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

    /**
     * Unico punto dove vengono letti i Signal Angular.
     * Converte ImgBuildOptions (tutto opzionale) in ImgBuildResolved (tutto obbligatorio)
     * riempiendo i buchi con i valori correnti del tema.
     */
    private resolveOptions(opts: ImgBuildOptions): ImgBuildResolved {
        return {
            bgColor: opts.bgColor ?? this.theme.colorPrimary(),
            textColor: opts.textColor ?? this.theme.colorPrimaryText(),
            fontSize: opts.fontSize ?? 40,
            // opts.fontFamily è una CHIAVE di WEB_FONTS: va risolta nello stack CSS reale,
            // altrimenti il canvas riceve la chiave (es. "Times") invece del font stack.
            fontFamily: opts.fontFamily ? FontConfig.WEB_FONTS[opts.fontFamily] : FontConfig.DEFAULT_WEB_FONT,
            ratio: opts.ratio ?? '4:3',
            maxWidth: opts.maxWidth ?? 1000,
            lineHeight: opts.lineHeight ?? 1.4,
            renderMode: opts.renderMode ?? 'wrap',
            minFontScale: opts.minFontScale ?? 0.5,
            maxLines: opts.maxLines ?? 6,
        };
    }

    // ============================================================
    // ─── API STATICA — pura, SSR-safe, zero Signal/this/DOM ─────
    //
    // Non ha accesso ai Signal Angular né al DOM: tutti i parametri
    // devono essere passati esplicitamente dal chiamante.
    // ============================================================

    /**
     * Shrink-to-fit puro: dati uno o più blocchi di testo e l'altezza disponibile, calcola i
     * font-size e le righe che li fanno entrare, e ritorna SOLO i dati di layout (nessuna immagine).
     * Il chiamante (SVG server, canvas front, badge) decide poi come renderizzarli.
     *
     * Strategia: riduce in proporzione i font di tutti i blocchi finché il testo entra in altezza;
     * solo se nemmeno alla scala minima entra, tiene il font pieno e tronca con ellissi a `maxLines`.
     *
     * La misura della larghezza è iniettabile (`opts.measureFn`): nel browser si passa
     * `ctx.measureText` (metriche reali), sul server la tabella `FontMetrics` (Liberation/Arial);
     * in assenza si usa la stima costante storica. Il fit VERTICALE è comunque esatto perché le
     * righe diventano `<tspan>`/righe esplicite: il loro numero — e quindi l'altezza — è quello qui.
     *
     * @param availableHeight Altezza che il SOLO testo può occupare (il chiamante ha già sottratto
     *                        eventuali elementi fissi come favicon/nome app e i loro margini).
     * @param gap Spazio verticale tra un blocco e il successivo.
     */
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

        // 1) Shrink-to-fit senza troncare: riduce i font finché TUTTO il testo entra.
        for (let scale = 1; scale >= minScale - 1e-9; scale -= step) {
            const c = compute(scale, false);
            if (c.textHeight <= availableHeight) {
                return { scale, blocks: c.blocks, textHeight: c.textHeight, truncated: false };
            }
        }
        // 2) Non basta: font pieno (più leggibile) + troncamento con ellissi a maxLines.
        const c = compute(1, true);
        return { scale: 1, blocks: c.blocks, textHeight: c.textHeight, truncated: true };
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

        // ── Posizionamento verticale del blocco testo ─────────────────────────────
        // Il blocco testo deve risultare centrato verticalmente nel canvas.
        // SVG posiziona il testo con l'attributo `y` = baseline della prima riga,
        // poi ogni <tspan> aggiunge `dy` (delta-y) rispetto alla riga precedente.
        //
        //  startY = margine superiore disponibile + metà interlinea
        //         = (altezzaCanvas - altezzaBloccoTesto) / 2  +  altezzaRiga / 2
        //
        // Il "+ altezzaRiga / 2" compensa `dominant-baseline="middle"` applicato al <text>:
        // con quel valore il punto di ancoraggio è al centro del carattere, non alla baseline.
        const altezzaRigaPx = fontSize * lineHeight;
        const altezzaBloccoTestoPx = lines.length * altezzaRigaPx;
        const centraleX = finalWidth / 2;
        const primaRigaY = (finalHeight - altezzaBloccoTestoPx) / 2 + altezzaRigaPx / 2;

        // ── Assemblaggio SVG ──────────────────────────────────────────────────────
        // Ogni riga diventa un <tspan>: la prima ha dy=0 (parte da primaRigaY),
        // le successive hanno dy=altezzaRigaPx (spostamento relativo rispetto al tspan precedente).
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

    /**
     * Sostituisce i caratteri riservati XML/SVG con le entità corrispondenti.
     * Necessario sia per i valori degli attributi (fill, font-family) sia per
     * il contenuto testuale dei <tspan>, dove '<' e '&' romperebbero il markup.
     */
    static escapeXml(value: string): string {
        // Rimuove i caratteri di controllo non validi in XML 1.0 (tutti i C0 tranne tab/LF/CR):
        // se finissero nell'SVG romperebbero il parsing di Sharp/librsvg (PCDATA invalid Char).
        return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Espone getReadableTextColor di ThemeService tramite questo servizio.
     * Comodo per chi importa già ImgBuilderService e vuole calcolare il contrasto
     * senza aggiungere una seconda dipendenza.
     */
    static getReadableTextColor(bgHex: string): '#000000' | '#ffffff' {
        return ThemeService.getReadableTextColor(bgHex);
    }

    // ── Helper privati statici ─────────────────────────────────────────────────

    /**
     * Converte la stringa ratio (es. '16:9') nel numero decimale corrispondente (es. 1.777...).
     * Fallback a 4/3 se il formato non è riconosciuto o se il denominatore è 0.
     */
    private static parseRatio(ratio: string): number {
        const match = /^(\d+):(\d+)$/.exec(ratio);
        if (!match) return 4 / 3;
        const denominatore = Number(match[2]);
        return denominatore === 0 ? 4 / 3 : Number(match[1]) / denominatore;
    }

    /**
     * Spezza il testo in righe che stanno entro maxWidthPx.
     *
     * Se measureFn è fornita (es. ctx.measureText nel browser) misura la larghezza
     * reale di ogni stringa. Altrimenti usa la stima fontSize * 0.55 (SSR/server).
     *
     * Gestisce anche il caso in cui una singola parola sia più lunga della riga:
     * in quel caso la parola viene spezzata carattere per carattere.
     */
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

        // Cap sul numero di righe: garantisce che il blocco di testo non sfori il canvas
        // (il limite sui caratteri non basta, dipende da quanti vanno a capo). L'ultima riga
        // tenuta viene accorciata quel tanto che basta perché ci stia il carattere finale '…'.
        if (maxLines && righe.length > maxLines) {
            const tenute = righe.slice(0, maxLines);
            let ultima = tenute[maxLines - 1].trimEnd();
            while (ultima && measure(ultima + '…') > maxWidthPx) ultima = ultima.slice(0, -1).trimEnd();
            tenute[maxLines - 1] = ultima + '…';
            return tenute;
        }
        return righe;
    }

    /**
     * Stima la larghezza in pixel di una stringa senza canvas.
     * Usa lo stesso fattore 0.55 di wrapText per coerenza nel calcolo del layout.
     */
    private static approxTextWidth(text: string, fontSize: number): number {
        return text.length * fontSize * 0.55;
    }

    /**
     * Normalizza i ritorni a capo (CRLF → LF) e comprime gli spazi multipli
     * all'interno di ogni riga in uno spazio singolo.
     * Preserva le righe vuote (usate come separatori di paragrafo).
     */
    static normalizeWhitespace(text: string): string {
        return text
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map(riga => riga.replace(/\s+/g, ' ').trim())
            .join('\n');
    }
}
