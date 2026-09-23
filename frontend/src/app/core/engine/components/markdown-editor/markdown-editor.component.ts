import { ChangeDetectionStrategy, Component, ElementRef, Injectable, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslateService } from '../../services/translate.service';
import {
    continueList, highlightMarkdown, insertLink, normalizeNewlines, toggleLineFormat, toggleWrap,
    type EditorState, type LineFormat,
} from './markdown-editor-text';

/** Override opzionale dei testi inseriti dai comandi senza selezione. */
export interface MarkdownEditorLabels {
    /** Testo segnaposto del grassetto. */
    boldPlaceholder?: string;
    /** Testo segnaposto del corsivo. */
    italicPlaceholder?: string;
    /** Testo segnaposto dell'etichetta di un link. */
    linkPlaceholder?: string;
}

type EditorCommand = 'undo' | 'redo' | 'bold' | 'italic' | LineFormat | 'link';

interface ToolbarButton {
    command: EditorCommand;
    /** Chiave i18n dell'etichetta (basic.*.json, sovrascrivibile da addon.*.json). */
    labelKey: string;
    icon: string;
    /** Scorciatoia mostrata nel tooltip. */
    shortcut?: string;
    /** Stessa scorciatoia per le tecnologie assistive (`aria-keyshortcuts`, alternative separate da spazio). */
    keyshortcuts?: string;
    /** Separatore visivo prima del bottone: raggruppa i comandi affini. */
    groupStart?: boolean;
}

const TOOLBAR: readonly ToolbarButton[] = [
    { command: 'undo', labelKey: 'mdEditorUndo', icon: 'fa-solid fa-rotate-left', shortcut: 'Ctrl+Z', keyshortcuts: 'Control+Z' },
    { command: 'redo', labelKey: 'mdEditorRedo', icon: 'fa-solid fa-rotate-right', shortcut: 'Ctrl+Y', keyshortcuts: 'Control+Y Control+Shift+Z' },
    { command: 'bold', labelKey: 'mdEditorBold', icon: 'fa-solid fa-bold', shortcut: 'Ctrl+B', keyshortcuts: 'Control+B', groupStart: true },
    { command: 'italic', labelKey: 'mdEditorItalic', icon: 'fa-solid fa-italic', shortcut: 'Ctrl+I', keyshortcuts: 'Control+I' },
    { command: 'heading', labelKey: 'mdEditorHeading', icon: 'fa-solid fa-heading', groupStart: true },
    { command: 'subheading', labelKey: 'mdEditorSubheading', icon: 'fa-solid fa-heading fa-2xs' },
    { command: 'bulletList', labelKey: 'mdEditorBulletList', icon: 'fa-solid fa-list-ul', groupStart: true },
    { command: 'numberedList', labelKey: 'mdEditorNumberedList', icon: 'fa-solid fa-list-ol' },
    { command: 'link', labelKey: 'mdEditorLink', icon: 'fa-solid fa-link', shortcut: 'Ctrl+K', keyshortcuts: 'Control+K', groupStart: true },
];

/** Indice del bottone Anteprima nella barra: viene dopo tutti i comandi. */
const PREVIEW_INDEX = TOOLBAR.length;

/** Passi di annullamento conservati: oltre, si perdono i più vecchi. */
const HISTORY_LIMIT = 200;
/** Caratteri conservati in tutta la cronologia (ogni passo tiene il testo intero): oltre, si perdono i passi più vecchi. */
const HISTORY_MAX_CHARS = 2_000_000;
/** Battute più vicine di così finiscono nello stesso passo di annullamento. */
const TYPING_GROUP_MS = 1000;

/** Tipo di battuta, per decidere quando inizia un nuovo passo di annullamento. */
type TypingKind = 'word' | 'space' | 'delete';

/** Battuta da raggruppare, o `null` per le modifiche in blocco (incolla, taglia, trascina, correzione
 *  ortografica), che fanno sempre un passo a sé. */
function typingKind(event: InputEvent): TypingKind | null {
    const type = event.inputType;
    if (/^(insertFrom|deleteBy|insertReplacement)/.test(type)) return null;
    if (type.startsWith('delete')) return 'delete';
    if (type === 'insertLineBreak' || type === 'insertParagraph') return 'space';
    if (type === 'insertText' || type === 'insertCompositionText') return /^\s+$/.test(event.data ?? '') ? 'space' : 'word';
    return null;
}

/** Contatore degli id generati, uno per applicazione: in SSR riparte a ogni richiesta, come nel browser. */
@Injectable({ providedIn: 'root' })
class MarkdownEditorIds {
    private next = 0;
    take(): string {
        return `md-editor-${this.next++}`;
    }
}

/** Campo di form Markdown (`[(ngModel)]`/`formControlName`): colori, barra e anteprima vengono da `MarkdownPipe`. */
@Component({
    selector: 'app-markdown-editor',
    imports: [MarkdownPipe, TranslatePipe],
    templateUrl: './markdown-editor.component.html',
    styleUrl: './markdown-editor.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MarkdownEditorComponent), multi: true }],
})
export class MarkdownEditorComponent implements ControlValueAccessor {
    private readonly translate = inject(TranslateService);

    /** `id` della textarea, per un `<label for>` esterno. Default: generato. */
    readonly inputId = input<string>(inject(MarkdownEditorIds).take());
    /** Nome accessibile se manca un `<label for>` esterno. */
    readonly ariaLabel = input<string | null>(null);
    readonly placeholder = input<string>('');
    /** Altezza minima in righe: la casella cresce col contenuto, senza barra di scorrimento interna. */
    readonly rows = input<number>(8);
    /** Override opzionale dei testi segnaposto — vedi {@link MarkdownEditorLabels}. */
    readonly labels = input<MarkdownEditorLabels>({});

    protected readonly toolbar = TOOLBAR;
    protected readonly previewIndex = PREVIEW_INDEX;
    protected readonly value = signal('');
    protected readonly disabled = signal(false);
    protected readonly previewing = signal(false);
    protected readonly canUndo = signal(false);
    protected readonly canRedo = signal(false);
    protected readonly highlighted = computed(() => {
        const text = this.value();
        // Una riga vuota finale non ha altezza in un blocco di testo: lo spazio la tiene alta
        // quanto quella della textarea, altrimenti il cursore finirebbe sotto l'evidenziazione.
        return highlightMarkdown(text) + (text.endsWith('\n') ? ' ' : '');
    });
    protected readonly previewId = computed(() => `${this.inputId()}-preview`);

    /** Bottone della barra scelto per ultimo (indice in `toolbar`, `previewIndex` = Anteprima). */
    private readonly focusIndex = signal(0);
    /** Indici dei bottoni abilitati, in ordine: le frecce si muovono solo fra questi. */
    private readonly enabledButtons = computed(() => {
        const enabled = TOOLBAR.map((b, i) => (this.isCommandDisabled(b.command) ? -1 : i)).filter(i => i >= 0);
        if (!this.disabled()) enabled.push(PREVIEW_INDEX);
        return enabled;
    });
    /** Unico bottone della barra raggiungibile con Tab (tabindex mobile): l'ultimo scelto, o il primo
     *  abilitato se quello è stato disabilitato. */
    protected readonly tabStop = computed(() => {
        const enabled = this.enabledButtons();
        const wanted = this.focusIndex();
        return enabled.includes(wanted) ? wanted : (enabled[0] ?? -1);
    });

    private readonly area = viewChild<ElementRef<HTMLTextAreaElement>>('area');
    private readonly toolbarEl = viewChild<ElementRef<HTMLElement>>('toolbarEl');
    private past: EditorState[] = [];
    private future: EditorState[] = [];
    private lastTypingAt = 0;
    private lastTypingKind: TypingKind | null = null;
    private onChange: (value: string) => void = () => {};
    private onTouched: () => void = () => {};

    writeValue(value: string | null): void {
        this.value.set(normalizeNewlines(value ?? ''));
        this.past = [];
        this.future = [];
        this.syncHistoryFlags();
    }

    registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
    registerOnTouched(fn: () => void): void { this.onTouched = fn; }
    setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }

    protected isCommandDisabled(command: EditorCommand): boolean {
        if (this.disabled() || this.previewing()) return true;
        if (command === 'undo') return !this.canUndo();
        if (command === 'redo') return !this.canRedo();
        return false;
    }

    protected togglePreview(): void {
        this.previewing.update(p => !p);
    }

    protected onToolbarFocus(index: number): void {
        this.focusIndex.set(index);
    }

    /** Barra con un solo punto di Tab: frecce Sinistra/Destra (circolari), Home e Fine spostano il focus fra i bottoni abilitati. */
    protected onToolbarKeydown(event: KeyboardEvent): void {
        const enabled = this.enabledButtons();
        if (enabled.length === 0) return;
        const current = Math.max(0, enabled.indexOf(this.tabStop()));
        let next: number;
        switch (event.key) {
            case 'ArrowRight': next = enabled[(current + 1) % enabled.length]; break;
            case 'ArrowLeft': next = enabled[(current - 1 + enabled.length) % enabled.length]; break;
            case 'Home': next = enabled[0]; break;
            case 'End': next = enabled[enabled.length - 1]; break;
            default: return;
        }
        event.preventDefault();
        this.focusIndex.set(next);
        this.toolbarEl()?.nativeElement.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
    }

    protected onBlur(): void {
        this.onTouched();
    }

    protected onInput(event: Event): void {
        this.commit((event.target as HTMLTextAreaElement).value);
    }

    /** La cronologia è dell'editor, non del browser: la textarea viene riscritta dai comandi, e una
     *  riscrittura via codice svuota l'annulla nativo. Anche l'annulla da menu contestuale passa di qui. */
    protected onBeforeInput(event: InputEvent): void {
        if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
            event.preventDefault();
            this.run(event.inputType === 'historyUndo' ? 'undo' : 'redo');
            return;
        }
        this.remember(typingKind(event));
    }

    protected onKeydown(event: KeyboardEvent): void {
        const mod = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        let command: EditorCommand | null = null;
        if (mod && !event.altKey) {
            if (key === 'z') command = event.shiftKey ? 'redo' : 'undo';
            else if (key === 'y') command = 'redo';
            else if (key === 'b') command = 'bold';
            else if (key === 'i') command = 'italic';
            else if (key === 'k') command = 'link';
        }
        if (command) {
            event.preventDefault();
            this.run(command);
            return;
        }
        if (key === 'enter' && !mod && !event.shiftKey && !event.altKey && !event.isComposing) {
            const next = continueList(this.state());
            if (next) {
                event.preventDefault();
                this.apply(next);
            }
        }
    }

    protected run(command: EditorCommand): void {
        if (this.isCommandDisabled(command)) return;
        const s = this.state();
        const labels = this.labels();
        switch (command) {
            case 'undo': return this.stepHistory(this.past, this.future);
            case 'redo': return this.stepHistory(this.future, this.past);
            case 'bold': return this.apply(toggleWrap(s, 'bold',
                labels.boldPlaceholder ?? this.translate.translate('mdEditorBoldPlaceholder')));
            case 'italic': return this.apply(toggleWrap(s, 'italic',
                labels.italicPlaceholder ?? this.translate.translate('mdEditorItalicPlaceholder')));
            case 'link': return this.apply(insertLink(s,
                labels.linkPlaceholder ?? this.translate.translate('mdEditorLinkPlaceholder')));
            default: return this.apply(toggleLineFormat(s, command));
        }
    }

    private state(): EditorState {
        const el = this.area()?.nativeElement;
        const text = el?.value ?? this.value();
        return { text, start: el?.selectionStart ?? text.length, end: el?.selectionEnd ?? text.length };
    }

    private apply(next: EditorState): void {
        this.remember(null);
        this.write(next);
    }

    /** Sposta un passo da `from` a `to` (annulla: da past a future; ripeti: il contrario). */
    private stepHistory(from: EditorState[], to: EditorState[]): void {
        const target = from.pop();
        if (!target) return;
        to.push(this.state());
        this.lastTypingKind = null;
        this.capHistory();
        this.write(target);
        this.syncHistoryFlags();
    }

    private write(next: EditorState): void {
        const el = this.area()?.nativeElement;
        if (el) {
            el.value = next.text;
            el.focus();
            el.setSelectionRange(next.start, next.end);
        }
        this.commit(next.text);
    }

    private commit(text: string): void {
        this.value.set(text);
        this.onChange(text);
    }

    /** Salva lo stato corrente come passo di annullamento. Le battute ravvicinate dello stesso tipo
     *  confluiscono in un passo solo, e lo spazio dopo una parola resta con la parola: si annulla una
     *  parola alla volta, non una lettera. `kind` null (comandi, incolla, taglia) = sempre un passo nuovo. */
    private remember(kind: TypingKind | null): void {
        const now = Date.now();
        const previous = this.lastTypingKind;
        const grouped = kind !== null && previous !== null && now - this.lastTypingAt < TYPING_GROUP_MS
            && (kind === previous || (previous === 'word' && kind === 'space'));
        this.lastTypingAt = now;
        this.lastTypingKind = kind;
        if (grouped) return;
        this.past.push(this.state());
        this.future = [];
        this.capHistory();
        this.syncHistoryFlags();
    }

    /** Tiene la cronologia entro `HISTORY_LIMIT` passi e `HISTORY_MAX_CHARS` caratteri, togliendo i
     *  passi più vecchi (l'ultimo passo resta comunque). */
    private capHistory(): void {
        let chars = 0;
        for (const step of this.past) chars += step.text.length;
        for (const step of this.future) chars += step.text.length;
        while (this.past.length + this.future.length > 1
            && (this.past.length + this.future.length > HISTORY_LIMIT || chars > HISTORY_MAX_CHARS)) {
            const dropped = this.past.length > 0 ? this.past.shift()! : this.future.shift()!;
            chars -= dropped.text.length;
        }
    }

    private syncHistoryFlags(): void {
        this.canUndo.set(this.past.length > 0);
        this.canRedo.set(this.future.length > 0);
    }
}
