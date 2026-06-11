import { Pipe, PipeTransform } from '@angular/core';
import { Renderer, marked, type Tokens } from 'marked';

/** `marked` NON sanifica gli URL: senza questi check un `[x](javascript:alert(1))` o
 *  un'immagine con `src` malevolo produrrebbero attributi eseguibili. Consentiamo solo
 *  schemi sicuri (e i relativi/anchor); tutto il resto viene neutralizzato. */
function isSafeLinkUrl(url: string): boolean {
    const u = url.trim();
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u);
    if (scheme) return ['http', 'https', 'mailto', 'tel'].includes(scheme[1].toLowerCase());
    return !u.startsWith('//'); // relativi/anchor/assoluti ok; blocca i protocol-relative
}

function isSafeImageUrl(url: string): boolean {
    const u = url.trim();
    if (/^data:image\//i.test(u)) return true;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u);
    if (scheme) return ['http', 'https'].includes(scheme[1].toLowerCase());
    return !u.startsWith('//');
}

/** Renderer sicuro: blocca l'HTML grezzo (renderer.html) e neutralizza gli URL non sicuri
 *  (javascript:, data:, vbscript:, protocol-relative…) nei link e nelle immagini. */
const safeRenderer = new Renderer();
safeRenderer.html = () => '';

const baseLink = safeRenderer.link.bind(safeRenderer);
safeRenderer.link = function (this: Renderer, token: Tokens.Link): string {
    // URL non sicuro: rendiamo solo il testo del link, senza href.
    return isSafeLinkUrl(token.href ?? '') ? baseLink(token) : this.parser.parseInline(token.tokens);
};

const baseImage = safeRenderer.image.bind(safeRenderer);
safeRenderer.image = function (this: Renderer, token: Tokens.Image): string {
    // src non sicuro: l'immagine viene scartata.
    return isSafeImageUrl(token.href ?? '') ? baseImage(token) : '';
};

const MARKDOWN_OPTIONS = {
    breaks: true,
    gfm: true,
    renderer: safeRenderer
} as const;

/**
 * MarkdownPipe — Converte testo Markdown in HTML sicuro.
 *
 * USO NEI TEMPLATE:
 *   <div [innerHTML]="testoMarkdown | markdown"></div>
 *
 * PROTEZIONE XSS:
 *   L'HTML grezzo inserito nel Markdown viene completamente ignorato
 *   (renderer.html restituisce stringa vuota). Questo impedisce attacchi
 *   di tipo Cross-Site Scripting: anche se un utente scrive tag <script>
 *   nel testo, questi non verranno renderizzati.
 *
 * Supporta GitHub Flavored Markdown (tabelle, checklist, ecc.) e
 * conversione automatica degli "a capo" in <br>.
 *
 * Per usare la conversione anche da codice TypeScript (fuori dai template),
 * chiamare il metodo statico MarkdownPipe.render(value).
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
    transform(value: string): string {
        return MarkdownPipe.render(value);
    }

    /** Converte Markdown in HTML sicuro. Utilizzabile anche fuori dai template. */
    static render(value: string): string {
        if (!value) return '';
        return marked.parse(value, MARKDOWN_OPTIONS) as string;
    }
}
