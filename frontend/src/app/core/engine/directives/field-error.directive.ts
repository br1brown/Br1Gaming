import { Directive, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';

/** Collega la validazione di un campo al suo messaggio d'errore (`.is-invalid`, `aria-invalid`,
 *  `aria-describedby`), mostrato solo quando il campo è touched o il form è stato inviato — mai a
 *  form appena aperto (WCAG 3.3.1/4.1.2). */
@Directive({
    selector: '[appFieldError]',
    host: {
        '[class.is-invalid]': 'showError',
        '[attr.aria-invalid]': 'showError ? "true" : null',
        '[attr.aria-describedby]': 'describedBy',
    },
})
export class FieldErrorDirective {
    private readonly control = inject(NgControl, { self: true });

    /** Id dell'elemento col messaggio d'errore. */
    readonly errorId = input.required<string>({ alias: 'appFieldError' });
    /** Id di un testo d'aiuto sempre presente, letto anche senza errore. */
    readonly appFieldHint = input<string | null>(null);

    get showError(): boolean {
        const c = this.control;
        return c.invalid === true && c.touched === true;
    }

    get describedBy(): string | null {
        const ids = [this.appFieldHint(), this.showError ? this.errorId() : null].filter(Boolean);
        return ids.length > 0 ? ids.join(' ') : null;
    }
}
