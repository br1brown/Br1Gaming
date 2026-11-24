import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { TranslateService } from '../../services/translate.service';

/** Chiave i18n di serie per ogni errore dei validatori di Angular; l'ultimo argomento è il parametro `{0}` del testo. */
const DEFAULT_KEYS: Readonly<Record<string, { key: string; arg?: (e: unknown) => unknown }>> = {
    required: { key: 'campoObbligatorioErrore' },
    email: { key: 'fieldErrorEmail' },
    maxlength: { key: 'fieldErrorMaxLength', arg: e => (e as { requiredLength?: number } | null)?.requiredLength },
    minlength: { key: 'fieldErrorMinLength', arg: e => (e as { requiredLength?: number } | null)?.requiredLength },
    min: { key: 'fieldErrorMin', arg: e => (e as { min?: number } | null)?.min },
    max: { key: 'fieldErrorMax', arg: e => (e as { max?: number } | null)?.max },
    pattern: { key: 'fieldErrorPattern' },
    // I codici dei validatori dell'Engine (`form-validators.ts`).
    integer: { key: 'fieldErrorInteger' },
    decimal: { key: 'fieldErrorDecimal' },
    phone: { key: 'fieldErrorPhone' },
    sameAs: { key: 'fieldErrorSameAs' },
    latitude: { key: 'fieldErrorLatitude' },
    longitude: { key: 'fieldErrorLongitude' },
    coordinate: { key: 'fieldErrorCoordinate' },
};

/** Messaggio d'errore sotto un campo toccato e non valido; l'`id` è quello di `aria-describedby` (direttiva `appFieldError`).
 *  I validatori di Angular e dell'Engine hanno un testo di serie, `messages` traduce i codici del progetto, un errore `server` stringa si mostra com'è. */
@Component({
    selector: 'app-field-error',
    // Lo stato di un controllo non è un signal: serve il controllo a ogni giro, niente OnPush.
    changeDetection: ChangeDetectionStrategy.Default,
    // `id="..."` sull'elemento ospite è l'INPUT `id`, ma Angular lascia anche l'attributo sul DOM: due elementi con lo stesso id (l'ospite e il div del messaggio),
    // e `aria-describedby` punterebbe al primo. L'id vero è quello del div.
    host: { '[attr.id]': 'null' },
    template: `@if (message(); as m) { <div class="invalid-feedback d-block" [id]="id()">{{ m }}</div> }`,
})
export class FieldErrorComponent {
    private readonly translate = inject(TranslateService);

    readonly control = input.required<AbstractControl | null>();
    /** L'id del messaggio: quello che il campo dichiara in `appFieldError`. */
    readonly id = input.required<string>();
    /** Codice di un errore del progetto → chiave i18n del testo (il parametro `{0}` è `requiredLength`/`min`/`max` se c'è). Vince sui testi di serie. */
    readonly messages = input<Readonly<Record<string, string>>>({});

    protected message(): string | null {
        const c = this.control();
        if (!c || !c.invalid || !c.touched) return null;

        const errors: ValidationErrors = c.errors ?? {};
        if (typeof errors['server'] === 'string') return errors['server'];

        const custom = this.messages();
        for (const code of Object.keys(errors)) {
            // hasOwn: un codice come `constructor` o `__proto__` non deve pescare dal prototipo di `{}`.
            if (Object.hasOwn(custom, code) && typeof custom[code] === 'string') return this.translate.translate(custom[code], errors[code] === true ? '' : this.argOf(errors[code]));
        }
        for (const [code, def] of Object.entries(DEFAULT_KEYS)) {
            if (errors[code] !== undefined) return this.translate.translate(def.key, def.arg?.(errors[code]) ?? '');
        }
        return this.translate.translate('fieldErrorInvalid');
    }

    private argOf(error: unknown): unknown {
        const e = error as { requiredLength?: number; min?: number; max?: number } | null;
        return e?.requiredLength ?? e?.min ?? e?.max ?? '';
    }
}
