import { Pipe, PipeTransform } from '@angular/core';
import { Renderer, marked, type Tokens } from 'marked';
import { isSafeLinkUrl, isSafeImageUrl } from './markdown-url-safety';

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
 * MarkdownPipe — Converte testo Markdown in HTML sicuro (usando marked con GFM e breaks attivi).
 *
 * USO NEI TEMPLATE:
 *   <div [innerHTML]="testoMarkdown | markdown"></div>
 *
 * PROTEZIONE XSS: HTML grezzo e URL pericolosi vengono bloccati (renderer custom).
 *
 * Per l'uso da TypeScript, chiamare il metodo statico `MarkdownPipe.render(value)`.
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
