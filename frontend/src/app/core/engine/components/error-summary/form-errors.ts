import type { AbstractControl } from '@angular/forms';
import { nextPaint } from '../../scroll';

/** Un campo da correggere, come lo legge il riepilogo: l'`id` a cui puntare, il nome che l'utente gli vede e il messaggio che ha sotto. */
export interface FieldErrorItem {
    id: string;
    label: string;
    message: string;
}

const INVALID = '[aria-invalid="true"], input.is-invalid, select.is-invalid, textarea.is-invalid';
let nextId = 1;

const spaces = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();
/** Il nome del campo senza l'asterisco dell'obbligatorio né i due punti dell'etichetta («Nome *:» → «Nome»). */
const clean = (text: string | null | undefined): string => spaces((text ?? '').replace(/[*:]/g, ' '));
const textOfIds = (root: Document, ids: string | null): string => (ids ?? '').split(/\s+/).filter(Boolean).map(id => root.getElementById(id)?.textContent ?? '').join(' ');

/** Il nome del campo come lo vede chi lo compila: `aria-labelledby`, poi `label[for]`, poi la `label` che lo contiene, poi `aria-label`. */
function labelOf(el: HTMLElement, doc: Document): string {
    const labelledBy = clean(textOfIds(doc, el.getAttribute('aria-labelledby')));
    if (labelledBy) return labelledBy;
    if (el.id) {
        // Confronto sull'attributo, non un selettore `label[for="…"]`: un `id` con virgolette o parentesi non lo romperebbe, e non serve `CSS.escape`.
        const forLabel = Array.from(doc.querySelectorAll('label[for]')).find(l => l.getAttribute('for') === el.id);
        if (forLabel?.textContent && clean(forLabel.textContent)) return clean(forLabel.textContent);
    }
    const wrapping = el.closest('label');
    if (wrapping?.textContent && clean(wrapping.textContent)) return clean(wrapping.textContent);
    return clean(el.getAttribute('aria-label'));
}

/** Il messaggio sotto il campo: fra gli elementi di `aria-describedby`, quello `.invalid-feedback`, altrimenti l'ultimo (il testo d'aiuto, se c'è, viene prima). */
function messageOf(el: HTMLElement, doc: Document): string {
    const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    const nodes = ids.map(id => doc.getElementById(id)).filter((n): n is HTMLElement => n !== null);
    const target = nodes.find(n => n.classList.contains('invalid-feedback')) ?? nodes.at(-1);
    return spaces(target?.textContent);
}

/** I campi non validi dentro `root` (`aria-invalid="true"` o `.is-invalid`), in ordine di pagina, con id, nome e messaggio letti dal DOM.
 *  Salta campi disabilitati o nascosti e i radio dello stesso gruppo dopo il primo; un campo senza `id` ne riceve uno. */
export function collectFieldErrors(root: ParentNode): FieldErrorItem[] {
    const doc = (root as Node).ownerDocument ?? (root as Document);
    const items: FieldErrorItem[] = [];
    const radioGroups = new Set<string>();
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(INVALID))) {
        if ((el as HTMLInputElement).disabled || el.hidden || el.closest('[hidden], [aria-hidden="true"]')) continue;
        if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
            if (radioGroups.has(el.name)) continue;
            radioGroups.add(el.name);
        }
        if (!el.id) el.id = `fe-${nextId++}`;
        const label = labelOf(el, doc);
        items.push({ id: el.id, label: label || el.id, message: messageOf(el, doc) });
    }
    return items;
}

const prefersReducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Porta il focus (e la vista) su un elemento: scorrimento morbido salvo `prefers-reduced-motion`. */
export function focusElement(el: HTMLElement): void {
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/** Il focus sul primo campo da correggere dentro `root`; rende il campo, o `null` se non ce n'è. */
export function focusFirstInvalid(root: ParentNode): HTMLElement | null {
    const first = collectFieldErrors(root)[0];
    const el = first ? (root as Node).ownerDocument?.getElementById(first.id) ?? (root as Document).getElementById?.(first.id) ?? null : null;
    if (el) focusElement(el);
    return el;
}

/** All'invio di un form non valido: tocca ogni campo, aspetta che i messaggi siano disegnati e rende l'elenco per `<app-error-summary>`.
 *  Con il form valido rende `[]`. */
export async function showFormErrors(form: AbstractControl, root: HTMLElement): Promise<FieldErrorItem[]> {
    if (form.valid) return [];
    form.markAllAsTouched();
    await nextPaint();
    return collectFieldErrors(root);
}
