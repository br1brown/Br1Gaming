import { Component, input } from '@angular/core';
import { GeneratorVariantOption } from '../../../core/dto/generator.dto';

/**
 * Selettore della "variante" di un generatore (es. i 12 segni dell'oroscopo): una griglia di chip
 * che va a capo, MAI a scroll orizzontale — tutte le opzioni restano sempre visibili, niente
 * scoperto solo scorrendo. Non sono tab (non c'è un pannello persistente per opzione: ogni scelta
 * rigenera da capo), quindi niente semantica tablist/tab — è un gruppo di scelta singola
 * (`radiogroup`/`radio`), che descrive meglio cosa succede davvero.
 * Componente puramente presentazionale: non genera, non condivide, non sa nulla del generatore —
 * riceve le opzioni e una funzione da chiamare con la chiave scelta (stesso pattern di
 * `speakText`/`buildShareCanvas` in GeneratorDetailComponent: il parent resta l'unico proprietario
 * della logica).
 */
@Component({
    selector: 'app-variant-picker',
    standalone: true,
    imports: [],
    templateUrl: './variant-picker.component.html',
    styles: [`
        :host { display: block; }
        .variant-picker button {
            border: 1px solid var(--bs-border-color);
            border-radius: 999px;
            background: transparent;
            padding: 0.3rem 0.85rem;
            font-size: 0.9rem;
            color: inherit;
            opacity: 0.75;
        }
        .variant-picker button:hover:not(:disabled) { opacity: 1; border-color: var(--bs-primary); }
        .variant-picker button:disabled { cursor: default; }
        .variant-picker button.active {
            opacity: 1;
            font-weight: 700;
            color: var(--bs-primary);
            border-color: var(--bs-primary);
            background: color-mix(in srgb, var(--bs-primary) 12%, transparent);
        }
    `],
})
export class VariantPickerComponent {
    /** Le opzioni selezionabili (es. i 12 segni). */
    readonly options = input.required<GeneratorVariantOption[]>();
    /** Chiave dell'opzione attualmente attiva. */
    readonly active = input<string | null>(null);
    /** Disabilita i pulsanti mentre una generazione è in corso. */
    readonly loading = input(false);
    /** Etichetta accessibile del gruppo (es. "Scegli il tuo segno"). */
    readonly ariaLabel = input('');
    /** Chiamata con la chiave scelta: il parent decide cosa farne (tipicamente rigenerare). */
    readonly onPick = input.required<(key: string) => void>();
}
