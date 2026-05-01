/**
 * Servizio di generazione immagini su canvas — funzioni pure, nessuna dipendenza Angular.
 * Utilizzabile da qualsiasi componente per creare immagini dinamiche (banner, placeholder, ecc.)
 */
import { Injectable, inject } from '@angular/core';
import { ThemeService } from './theme.service';

// Utility Type: prende le opzioni di render ma esclude i colori (che verranno iniettati dal tema)
type ImgRenderCoreOpts = Omit<ImgRenderOptions, 'bgColor' | 'textColor'>;

/**
 * Font web-safe affidabili per garantire che il rendering sia coerente 
 * tra diversi sistemi operativi (Windows, macOS, Linux).
 */
const FONTS: Record<string, string> = {
    'Arial': 'Arial, sans-serif',
    'Georgia': 'Georgia, serif',
    'Courier New': '"Courier New", monospace',
    'Verdana': 'Verdana, sans-serif',
    'Times': '"Times New Roman", serif',
};

export const FONT_NAMES = Object.keys(FONTS);

export interface ImgRenderOptions {
    text: string;         // Testo da scrivere
    bgColor: string;      // Colore di sfondo (es. HEX o RGB)
    textColor: string;    // Colore del font
    fontSize: number;     // Dimensione font in pixel
    canvasWidth: number;  // Larghezza fissa dell'immagine
    fontFamily: string;   // Nome del font (chiave di FONTS)
    margin: number;       // Padding interno per il testo
}

@Injectable({ providedIn: 'root' })
export class ImgBuilderService {
    private readonly theme = inject(ThemeService);

    /** 
     * Renderizza sul canvas usando i colori correnti del tema.
     * Molto utile per generare asset che si adattano al Dark/Light mode.
     */
    render(canvas: HTMLCanvasElement, opts: ImgRenderCoreOpts): void {
        renderToCanvas(canvas, {
            ...opts,
            bgColor: this.theme.colorPrimary(),
            textColor: this.theme.colorPrimaryText(),
        });
    }

    /** Permette il rendering ignorando il tema (colori custom scelti dall'utente). */
    renderWithColors(canvas: HTMLCanvasElement, opts: ImgRenderCoreOpts, fg: string, bg: string): void {
        renderToCanvas(canvas, { ...opts, bgColor: bg, textColor: fg });
    }
}

/** 
 * LOGICA DI WRAPPING (Andata a capo)
 * Suddivide un blocco di testo in riga basandosi sulla larghezza massima del canvas.
 */
function splitParagraphIntoLines(ctx: CanvasRenderingContext2D, testo: string, maxWidth: number): string[] {
    const parole = testo.trim().split(/\s+/).filter(Boolean);
    if (!parole.length) return [''];

    const righe: string[] = [];
    let rigaCorrente = '';

    for (const parola of parole) {
        const candidato = rigaCorrente ? `${rigaCorrente} ${parola}` : parola;

        // Se la riga con la nuova parola ci sta, la aggiungiamo
        if (ctx.measureText(candidato).width <= maxWidth) {
            rigaCorrente = candidato;
        } else {
            // Se non ci sta, salviamo la riga corrente e iniziamo la riga successiva
            if (rigaCorrente) righe.push(rigaCorrente);

            // Caso critico: la singola parola è più lunga dell'intero canvas (es. un URL lunghissimo)
            if (ctx.measureText(parola).width > maxWidth) {
                let chunk = '';
                for (const char of parola) {
                    if (ctx.measureText(chunk + char).width <= maxWidth) {
                        chunk += char;
                    } else {
                        if (chunk) righe.push(chunk);
                        chunk = char;
                    }
                }
                rigaCorrente = chunk;
            } else {
                rigaCorrente = parola;
            }
        }
    }
    if (rigaCorrente) righe.push(rigaCorrente);
    return righe;
}

/** 
 * Gestisce i newline (\n) inseriti manualmente dall'utente
 * e poi applica lo split automatico su ogni riga risultante.
 */
function splitTextIntoLines(ctx: CanvasRenderingContext2D, testo: string, maxWidth: number): string[] {
    return testo
        .replace(/\r\n/g, '\n') // Normalizza i ritorni a capo Windows
        .split('\n')
        .flatMap(paragrafo => splitParagraphIntoLines(ctx, paragrafo, maxWidth));
}

/** 
 * FUNZIONE CORE DI RENDERING
 * Applica le impostazioni al contesto 2D del Canvas e disegna.
 */
export function renderToCanvas(canvas: HTMLCanvasElement, opts: ImgRenderOptions): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { text, bgColor, textColor, fontSize, canvasWidth: width, fontFamily, margin } = opts;

    // Preparazione font
    const fontCss = `${fontSize}px ${FONTS[fontFamily] ?? fontFamily}`;
    ctx.font = fontCss;

    // Calcolo delle righe necessarie
    const maxWidth = width - margin * 2;
    const righe = splitTextIntoLines(ctx, text, maxWidth);

    // Calcolo dell'altezza dinamica: 
    // L'altezza deve contenere tutto il testo, ma manteniamo almeno un aspect ratio di 4:3
    const altezzaMinima = Math.ceil(width * 3 / 4);
    const altezzaTesto = righe.length * fontSize * 1.4 + margin * 2; // Interlinea 1.4
    const height = Math.max(altezzaTesto, altezzaMinima);

    // Applichiamo le dimensioni al canvas (questo resetta il contesto)
    canvas.width = width;
    canvas.height = height;

    // Disegno dello sfondo
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Configurazione stile testo (centrato orizzontalmente e verticalmente)
    ctx.font = fontCss; // Ri-settato perché il cambio width/height resetta il ctx
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const lineHeight = fontSize * 1.4;
    const totalTextHeight = righe.length * lineHeight;

    // Calcoliamo la Y iniziale per centrare il blocco di testo verticalmente
    const startY = (height - totalTextHeight) / 2;

    // Disegno riga per riga
    for (let i = 0; i < righe.length; i++) {
        ctx.fillText(righe[i], width / 2, startY + i * lineHeight);
    }
}