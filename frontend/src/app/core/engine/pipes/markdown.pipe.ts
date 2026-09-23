import { Pipe, PipeTransform } from '@angular/core';
import { Renderer, marked, type Tokens, type TokensList } from 'marked';
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

/** Converte Markdown in HTML sicuro (`marked`, GFM + breaks): `<div [innerHTML]="testo | markdown">`.
 *  HTML grezzo e URL pericolosi bloccati dal renderer custom sopra. Da TypeScript: `MarkdownPipe.render(value)`. */
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

    /** Token del lexer con le STESSE opzioni di `render`: ciò che qui è un titolo, un grassetto o un
     *  link è esattamente ciò che `render` renderà come tale (usato da `MarkdownEditorComponent`). */
    static lex(value: string): TokensList {
        return marked.lexer(value ?? '', MARKDOWN_OPTIONS);
    }
}
