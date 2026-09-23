import type { Token, Tokens } from 'marked';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { isSafeImageUrl, isSafeLinkUrl } from '../../pipes/markdown-url-safety';

/** Testo + selezione della textarea: l'unità su cui lavorano i comandi dell'editor (puri, senza DOM). */
export interface EditorState {
    text: string;
    start: number;
    end: number;
}

/** Classe CSS per tipo di token del lexer. Tipi assenti (paragrafi, testo semplice, liste e citazioni
 *  come contenitore) non aggiungono span: restano col colore del testo. `html` è segnato come scartato
 *  perché il renderer sicuro di `MarkdownPipe` lo toglie davvero dall'output. */
const TOKEN_CLASS: Partial<Record<string, string>> = {
    heading: 'md-heading',
    strong: 'md-strong',
    em: 'md-em',
    del: 'md-del',
    codespan: 'md-code',
    code: 'md-code',
    link: 'md-link',
    image: 'md-link',
    hr: 'md-marker',
    html: 'md-discarded',
};

/** Contesto del contenitore in cui si trova il testo fra i token: decide come si colora. */
type GapContext = 'listItem' | 'blockquote' | null;

/** Marcatore `>` di citazione a inizio riga (fino a 3 spazi di rientro). */
const QUOTE_MARKER = /(^|\n)( {0,3}>)/g;

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function childrenOf(token: Token): Token[] | undefined {
    if ('items' in token && Array.isArray(token.items)) return token.items as Token[];
    if ('tokens' in token && Array.isArray(token.tokens)) return token.tokens;
    return undefined;
}

/** Classe del token, o nessuna se la pipeline non lo renderà come tale: un link con URL non sicuro
 *  esce come testo semplice, un'immagine con `src` non sicuro sparisce (quindi è segnata scartata). */
function classOf(token: Token): string | undefined {
    if (token.type === 'link') return isSafeLinkUrl((token as Tokens.Link).href ?? '') ? TOKEN_CLASS['link'] : undefined;
    if (token.type === 'image') return isSafeImageUrl((token as Tokens.Image).href ?? '') ? TOKEN_CLASS['image'] : 'md-discarded';
    return TOKEN_CLASS[token.type];
}

/** Testo fra due token: in una voce di elenco il tratto prima del primo figlio è il marcatore
 *  (`beforeFirst`); in una citazione si colorano solo i `>` a inizio riga (`atLineStart`: il tratto
 *  parte da un inizio riga). */
function emitGap(gap: string, context: GapContext, beforeFirst: boolean, atLineStart: boolean): string {
    if (context === 'listItem' && beforeFirst) return `<span class="md-marker">${escapeHtml(gap)}</span>`;
    if (context !== 'blockquote') return escapeHtml(gap);
    let out = '';
    let last = 0;
    for (const m of gap.matchAll(QUOTE_MARKER)) {
        if (m.index === 0 && m[1] === '' && !atLineStart) continue;
        const markerAt = m.index + m[1].length;
        out += escapeHtml(gap.slice(last, markerAt)) + `<span class="md-marker">${escapeHtml(m[2])}</span>`;
        last = markerAt + m[2].length;
    }
    return out + escapeHtml(gap.slice(last));
}

interface EmitState {
    out: string;
    cursor: number;
}

/** Scorre `tokens` ritrovandoli in `text` col loro `raw`; se marked lo ha normalizzato si prova coi
 *  figli, nello stesso punto. */
function emitTokens(text: string, tokens: Token[], st: EmitState, context: GapContext): void {
    for (const token of tokens) {
        const raw = token.raw ?? '';
        if (!raw) continue;
        const at = text.indexOf(raw, st.cursor);
        if (at < 0) {
            const children = childrenOf(token);
            if (children) emitTokens(text, children, st, context);
            continue;
        }
        if (at > st.cursor) {
            st.out += emitGap(text.slice(st.cursor, at), context, st.cursor === 0, st.cursor === 0 || text[st.cursor - 1] === '\n');
        }
        const children = childrenOf(token);
        const inner = children ? emit(raw, children, contextOf(token)) : escapeHtml(raw);
        const cls = classOf(token);
        st.out += cls ? `<span class="${cls}">${inner}</span>` : inner;
        st.cursor = at + raw.length;
    }
}

function contextOf(token: Token): GapContext {
    if (token.type === 'list_item') return 'listItem';
    if (token.type === 'blockquote') return 'blockquote';
    return null;
}

/** Riemette TUTTO `text` in ordine (la sovrapposizione con la textarea non si sfasa), colorando i token. */
function emit(text: string, tokens: Token[], context: GapContext): string {
    const st: EmitState = { out: '', cursor: 0 };
    emitTokens(text, tokens, st, context);
    if (st.cursor < text.length) {
        st.out += emitGap(text.slice(st.cursor), context, false, st.cursor === 0 || text[st.cursor - 1] === '\n');
    }
    return st.out;
}

/** HTML colorato del sorgente Markdown, dal lexer di `MarkdownPipe` (stesse opzioni del render):
 *  è colorato come titolo/grassetto/link solo ciò che la pipeline renderà come tale. */
export function highlightMarkdown(text: string): string {
    if (!text) return '';
    // Stessa normalizzazione della textarea (e del lexer): con `\r\n` i raw non combacerebbero.
    const normalized = normalizeNewlines(text);
    return emit(normalized, MarkdownPipe.lex(normalized), null);
}

/** A capo uniformati a `\n`, come li restituisce sempre una textarea. */
export function normalizeNewlines(text: string): string {
    return text.replace(/\r\n?/g, '\n');
}

/** Inizio della riga che contiene `pos` (con `pos` 0 è sempre 0, anche se il testo inizia con `\n`). */
function lineStartOf(text: string, pos: number): number {
    return pos <= 0 ? 0 : text.lastIndexOf('\n', pos - 1) + 1;
}

export type WrapFormat = 'bold' | 'italic';

/** Marcatore inserito e caratteri riconosciuti in rimozione. Corsivo con `*`: a differenza di `_`,
 *  la pipeline lo rende anche dentro una parola. */
const WRAP: Record<WrapFormat, { marker: string; chars: readonly string[] }> = {
    bold: { marker: '**', chars: ['*', '_'] },
    italic: { marker: '*', chars: ['*', '_'] },
};

/** Quanti `ch` consecutivi ci sono a partire da `pos` verso `dir` (+1 destra, -1 sinistra), fino a `limit` escluso. */
function runLength(text: string, pos: number, dir: 1 | -1, ch: string, limit: number): number {
    let n = 0;
    let i = dir === 1 ? pos : pos - 1;
    while (dir === 1 ? i < limit : i >= limit) {
        if (text[i] !== ch) break;
        n++;
        i += dir;
    }
    return n;
}

/** Avvolge la selezione in grassetto/corsivo, o lo toglie se c'è già — dentro o subito fuori dalla
 *  selezione. Gli spazi ai bordi della selezione (doppio clic su Windows prende lo spazio dopo la
 *  parola) restano fuori dai marcatori, altrimenti `**parola **` non verrebbe reso. Una sequenza di
 *  marcatori vale grassetto (2), corsivo (1) o entrambi (3): il corsivo non si toglie da `__a__`.
 *  Senza selezione inserisce `placeholder` già selezionato. */
export function toggleWrap(s: EditorState, format: WrapFormat, placeholder: string): EditorState {
    const { text } = s;
    const { marker, chars } = WRAP[format];
    const m = marker.length;
    const selected = text.slice(s.start, s.end);
    let a = s.start + (selected.length - selected.trimStart().length);
    let b = s.end - (selected.length - selected.trimEnd().length);
    if (a >= b) a = b = s.end;

    for (const ch of chars) {
        const leftOut = runLength(text, a, -1, ch, 0);
        const leftIn = runLength(text, a, 1, ch, b);
        const rightIn = leftIn >= b - a ? 0 : runLength(text, b, -1, ch, a + leftIn);
        const rightOut = runLength(text, b, 1, ch, text.length);
        const left = leftOut + leftIn;
        const right = rightIn + rightOut;
        if ((left !== m && left !== 3) || (right !== m && right !== 3)) continue;
        // Tutti i caratteri di una sequenza sono uguali: si tolgono i primi `m` a sinistra e gli ultimi a destra.
        const leftRun = a - leftOut;
        const rightRunEnd = b + rightOut;
        const contentStart = a + leftIn;
        const contentEnd = b - rightIn;
        return {
            text: text.slice(0, leftRun) + text.slice(leftRun + m, rightRunEnd - m) + text.slice(rightRunEnd),
            start: contentStart - m,
            end: contentEnd - m,
        };
    }

    const inner = a < b ? text.slice(a, b) : placeholder;
    return {
        text: text.slice(0, a) + marker + inner + marker + text.slice(b),
        start: a + m,
        end: a + m + inner.length,
    };
}

export type LineFormat = 'heading' | 'subheading' | 'bulletList' | 'numberedList';

const ANY_LINE_PREFIX = /^(#{1,6} |[-*+] |\d+[.)] )/;
const LINE_FORMAT_PREFIX: Record<LineFormat, RegExp> = {
    heading: /^## /,
    subheading: /^### /,
    bulletList: /^[-*+] /,
    numberedList: /^\d+[.)] /,
};
const INDENT = /^[ \t]*/;

/** Applica `format` a ogni riga toccata dalla selezione (sostituendo un altro titolo/elenco già
 *  presente, dopo l'eventuale rientro, che resta), o lo toglie se tutte le righe lo hanno già.
 *  Titolo = `##`, sottotitolo = `###`: il `#` resta al titolo della pagina, che non si scrive nel
 *  contenuto. L'elenco numerato conta a parte per ogni livello di rientro. */
export function toggleLineFormat(s: EditorState, format: LineFormat): EditorState {
    const { text, start, end } = s;
    const blockStart = lineStartOf(text, start);
    const lastLineEnd = text.indexOf('\n', end > start && text[end - 1] === '\n' ? end - 1 : end);
    const blockEnd = lastLineEnd < 0 ? text.length : lastLineEnd;
    const lines = text.slice(blockStart, blockEnd).split('\n');
    const content = lines.filter(l => l.trim() !== '');
    const remove = content.length > 0 && content.every(l => LINE_FORMAT_PREFIX[format].test(l.trimStart()));

    const counters = new Map<number, number>();
    const heads: { old: number; new: number }[] = [];
    const next = lines.map(line => {
        const indent = INDENT.exec(line)![0];
        const rest = line.slice(indent.length);
        const bare = rest.replace(ANY_LINE_PREFIX, '');
        let prefix = '';
        if (!(line.trim() === '' && lines.length > 1) && !remove) {
            // Un livello meno rientrato chiude i sottoelenchi: ricominciano da 1.
            for (const level of counters.keys()) if (level > indent.length) counters.delete(level);
            const n = (counters.get(indent.length) ?? 0) + 1;
            counters.set(indent.length, n);
            prefix = format === 'heading' ? '## '
                : format === 'subheading' ? '### '
                : format === 'bulletList' ? '- '
                : `${n}. `;
        }
        const result = line.trim() === '' && lines.length > 1 ? line : indent + prefix + bare;
        heads.push({ old: line.length - bare.length, new: result.length - bare.length });
        return result;
    });

    const block = next.join('\n');
    const newText = text.slice(0, blockStart) + block + text.slice(blockEnd);
    if (start === end) {
        // Il cursore resta sullo stesso carattere del testo; se era dentro rientro/prefisso va subito dopo il nuovo.
        const head = heads[0];
        const caret = start - blockStart <= head.old ? blockStart + head.new : start + head.new - head.old;
        return { text: newText, start: caret, end: caret };
    }
    return { text: newText, start: blockStart, end: blockStart + block.length };
}

/** Link sulla selezione: `[selezione](https://)` con `https://` selezionato, pronto da sovrascrivere
 *  incollando l'indirizzo. Se la selezione è già un indirizzo, diventa l'URL e si seleziona il testo. */
export function insertLink(s: EditorState, labelPlaceholder: string): EditorState {
    const { text, start, end } = s;
    const selected = text.slice(start, end);
    if (/^(https?:\/\/|mailto:|tel:)\S+$/i.test(selected)) {
        return {
            text: text.slice(0, start) + `[${labelPlaceholder}](${selected})` + text.slice(end),
            start: start + 1,
            end: start + 1 + labelPlaceholder.length,
        };
    }
    const label = selected || labelPlaceholder;
    const url = 'https://';
    const urlStart = start + label.length + 3;
    return {
        text: text.slice(0, start) + `[${label}](${url})` + text.slice(end),
        start: urlStart,
        end: urlStart + url.length,
    };
}

const LIST_ITEM = /^([ \t]*)(?:([-*+])|(\d+)([.)]))[ \t]+/;
/** Linea orizzontale (`---`, `* * *`, `___`…): la pipeline la rende come `<hr>`, non come voce. */
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

interface LineInfo {
    start: number;
    end: number;
    text: string;
}

function lineAt(text: string, start: number): LineInfo {
    const idx = text.indexOf('\n', start);
    const end = idx < 0 ? text.length : idx;
    return { start, end, text: text.slice(start, end) };
}

/** Voce di elenco meno rientrata sopra la riga che inizia a `lineStart`, nello stesso elenco:
 *  la ricerca si ferma a una riga di testo senza rientro che non è una voce. */
function parentItem(text: string, lineStart: number, indent: number): RegExpExecArray | null {
    let pos = lineStart;
    while (pos > 0) {
        const start = lineStartOf(text, pos - 1);
        const line = text.slice(start, pos - 1);
        pos = start;
        const match = LIST_ITEM.exec(line);
        if (match && !THEMATIC_BREAK.test(line)) {
            if (match[1].length < indent) return match;
            continue;
        }
        if (line.trim() !== '' && INDENT.exec(line)![0].length === 0) return null;
    }
    return null;
}

function nextMarker(match: RegExpExecArray): string {
    const [, , bullet, num, delimiter] = match;
    return bullet ?? `${Number(num) + 1}${delimiter}`;
}

/** Rinumera le voci numerate che seguono la riga che inizia a `lineStart` (stesso rientro e
 *  delimitatore), fino a fine blocco: riga vuota, voce già col numero giusto, o riga meno rientrata
 *  che non è una voce di quel livello. Le righe più rientrate (sottoelenchi, continuazioni) si saltano. */
function renumberAfter(text: string, lineStart: number): string {
    const first = LIST_ITEM.exec(lineAt(text, lineStart).text);
    if (!first || first[3] === undefined) return text;
    const indent = first[1];
    const delimiter = first[4];
    let expected = Number(first[3]) + 1;
    let pos = lineAt(text, lineStart).end + 1;
    let out = text;
    while (pos <= out.length) {
        const line = lineAt(out, pos);
        if (line.text.trim() === '') break;
        const lineIndent = INDENT.exec(line.text)![0];
        if (lineIndent.length > indent.length) {
            pos = line.end + 1;
            continue;
        }
        const match = LIST_ITEM.exec(line.text);
        if (!match || match[1] !== indent || match[3] === undefined || match[4] !== delimiter) break;
        if (Number(match[3]) === expected) break;
        const numStart = pos + indent.length;
        out = out.slice(0, numStart) + String(expected) + out.slice(numStart + match[3].length);
        expected++;
        pos = lineAt(out, pos).end + 1;
    }
    return out;
}

/** Invio dentro una voce di elenco: nuova voce con lo stesso marcatore (numerato: il successivo, e
 *  le voci seguenti si rinumerano). Su una voce vuota annidata risale di un livello (diventa voce
 *  dell'elenco padre); su una voce vuota di primo livello chiude l'elenco togliendo il marcatore.
 *  `null` = riga non in elenco (o linea orizzontale), Invio normale. */
export function continueList(s: EditorState): EditorState | null {
    const { text, start, end } = s;
    if (start !== end) return null;
    const line = lineAt(text, lineStartOf(text, start));
    const match = LIST_ITEM.exec(line.text);
    if (!match || THEMATIC_BREAK.test(line.text) || start < line.start + match[0].length) return null;

    if (line.text.slice(match[0].length).trim() === '') {
        const parent = match[1].length > 0 ? parentItem(text, line.start, match[1].length) : null;
        if (!parent) {
            const newText = text.slice(0, line.start) + text.slice(line.start + match[0].length);
            return { text: newText, start: line.start, end: line.start };
        }
        const item = `${parent[1]}${nextMarker(parent)} `;
        const newText = renumberAfter(text.slice(0, line.start) + item + text.slice(line.end), line.start);
        const caret = line.start + item.length;
        return { text: newText, start: caret, end: caret };
    }
    const insert = `\n${match[1]}${nextMarker(match)} `;
    const caret = start + insert.length;
    const newText = renumberAfter(text.slice(0, start) + insert + text.slice(end), start + 1);
    return { text: newText, start: caret, end: caret };
}
