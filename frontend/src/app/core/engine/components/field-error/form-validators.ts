import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parseLooseCoordinate, parseLooseDecimal, parseLooseInteger } from '../../input-parsers';
import { Validation } from '../../services/validation';

/** Validatori per i reactive forms, con codici d'errore che `app-field-error` spiega da sé. Un campo vuoto è valido per tutti
 *  tranne `requiredTrimmed`; i numeri si leggono come li scrive la gente (`input-parsers.ts`), `min`/`max` come `Validators.min`/`max`. */

const isEmpty = (value: unknown): boolean => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/** Obbligatorio senza contare gli spazi: un nome di soli spazi è vuoto (`Validators.required` lo lascia passare). */
export const requiredTrimmed: ValidatorFn = (c: AbstractControl): ValidationErrors | null => isEmpty(c.value) ? { required: true } : null;

interface Bounds { min?: number; max?: number }

/** `{ min }` o `{ max }` se `n` è fuori dai limiti, con la forma di `Validators.min`/`max`; altrimenti `null`. */
function outOfBounds(n: number, { min, max }: Bounds): ValidationErrors | null {
    if (min !== undefined && n < min) return { min: { min, actual: n } };
    if (max !== undefined && n > max) return { max: { max, actual: n } };
    return null;
}

/** Un intero **non negativo** scritto come lo scrive la gente («40 letti», «circa 40», «1.000»; fino a 9 cifre, come `parseLooseInteger`): `integer` se non lo è (un «-5» non è un intero qui), `min`/`max` se fuori limiti. Per numeri negativi o con decimali `decimal`. Vuoto = ok. */
export function integer(options: Bounds & { locale?: string } = {}): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
        if (isEmpty(c.value)) return null;
        const n = parseLooseInteger(c.value, { locale: options.locale });
        if (n === null || Number.isNaN(n)) return { integer: true };
        return outOfBounds(n, options);
    };
}

/** Un numero con decimali («6 €», «1.200,50»): `decimal` se non lo è, `min`/`max` se fuori limiti. `thousands: false` per misure e coordinate. Vuoto = ok. */
export function decimal(options: Bounds & { locale?: string; thousands?: boolean } = {}): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
        if (isEmpty(c.value)) return null;
        const n = parseLooseDecimal(c.value, { locale: options.locale, thousands: options.thousands });
        if (n === null || Number.isNaN(n)) return { decimal: true };
        return outOfBounds(n, options);
    };
}

/** Una coordinata scritta come la copia la gente («44,5», «44.5°», «44.5 N», «3.2 W») dentro `min`-`max`; l'errore ha il codice `code`. Vuoto = ok. */
export function coordinate(min: number, max: number, code: string = 'coordinate'): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
        if (isEmpty(c.value)) return null;
        const n = parseLooseCoordinate(c.value);
        return n === null || Number.isNaN(n) || n < min || n > max ? { [code]: true } : null;
    };
}

/** Latitudine in gradi, da -90 a 90 (errore `latitude`). */
export const latitude: ValidatorFn = coordinate(-90, 90, 'latitude');
/** Longitudine in gradi, da -180 a 180 (errore `longitude`). */
export const longitude: ValidatorFn = coordinate(-180, 180, 'longitude');

/** Un indirizzo email plausibile: `qualcosa@dominio.estensione` (estensione di almeno due lettere), senza spazi. Più severo di `Validators.email`, che accetta `a@b`. Errore `email`. Vuoto = ok. */
export const emailPlausible: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
    if (isEmpty(c.value)) return null;
    const value = String(c.value).trim();
    return Validation.email(value) && /\.[^\s@.]{2,}$/.test(value) ? null : { email: true };
};

/** Un solo numero di telefono nel formato che l'Engine accetta (`Validation.phone.isValid`: cifre e separatori, 6-15 cifre, niente lettere). Errore `phone`. Vuoto = ok. */
export const phone: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
    isEmpty(c.value) || Validation.phone.isValid(String(c.value)) ? null : { phone: true };

// I controlli già collegati: un `sameAs` si ricalcola da solo quando cambia l'altro campo, ma si collega una volta sola per controllo.
const linked = new WeakSet<AbstractControl>();

/** Errore `sameAs` se il valore differisce da quello del campo `otherName` dello stesso gruppo (`ignoreCase` per le email).
 *  Quando cambia l'altro campo la conferma si ricontrolla da sé, una volta e senza emettere eventi; fuori da un gruppo non confronta niente. */
export function sameAs(otherName: string, options: { ignoreCase?: boolean } = {}): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
        const other = c.parent?.get(otherName);
        if (!other) return null;
        if (!linked.has(c)) {
            linked.add(c);
            other.valueChanges.subscribe(() => c.updateValueAndValidity({ onlySelf: true, emitEvent: false }));
        }
        const norm = (v: unknown): string => {
            const s = v === null || v === undefined ? '' : String(v);
            return options.ignoreCase ? s.toLowerCase() : s;
        };
        return norm(c.value) === norm(other.value) ? null : { sameAs: true };
    };
}
