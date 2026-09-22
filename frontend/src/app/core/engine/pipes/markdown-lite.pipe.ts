import { Pipe, PipeTransform } from '@angular/core';
import { isSafeLinkUrl } from './markdown-url-safety';

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Un token per volta, nell'ordine in cui compaiono: `[testo](url)` (gruppi 1-2) oppure
 *  `**testo**` (gruppo 3) — mai innestati fra loro (un `**[x](y)**` non annida, tratta l'intera
 *  sequenza più esterna che matcha per prima). Volutamente NON `*corsivo*`/liste/altro: quei due
 *  bastano a coprire link + enfasi, i due soli usi reali finora in stringhe i18n legali/cookie. */
const TOKEN_PATTERN = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;

/** Sottoinsieme di `MarkdownPipe` ridotto a `[testo](url)` e `**grassetto**` (resto HTML-escaped);
 *  usare dove il contenuto è garantito limitato a questi due pattern (es. banner cookie). Esiste
 *  perché `CookieBannerComponent` è montato eager in `AppComponent`: un `import` statico di
 *  `MarkdownPipe` trascinerebbe l'intera `marked` (~41.5KB raw/11.8KB gzip) nel bundle iniziale di
 *  ogni progetto figlio solo per un link e un grassetto — due regex bastano e la tengono fuori. */
@Pipe({ name: 'markdownLite' })
export class MarkdownLitePipe implements PipeTransform {
    transform(value: string): string {
        if (!value) return '';
        let result = '';
        let lastIndex = 0;
        for (const match of value.matchAll(TOKEN_PATTERN)) {
            const [full, linkLabel, linkUrl, boldText] = match;
            const index = match.index ?? 0;
            result += escapeHtml(value.slice(lastIndex, index));
            if (linkLabel !== undefined) {
                result += isSafeLinkUrl(linkUrl)
                    ? `<a href="${escapeHtml(linkUrl.trim())}">${escapeHtml(linkLabel)}</a>`
                    : escapeHtml(linkLabel);
            } else {
                result += `<strong>${escapeHtml(boldText)}</strong>`;
            }
            lastIndex = index + full.length;
        }
        result += escapeHtml(value.slice(lastIndex));
        return result;
    }
}
