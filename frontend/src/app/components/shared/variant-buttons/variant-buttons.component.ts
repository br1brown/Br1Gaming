import { Component, input } from '@angular/core';
import { GeneratorVariantOption } from '../../../core/dto/generator.dto';

/**
 * Selettore della "variante" di un generatore per un numero di opzioni MEDIO (3-11): troppe per il
 * cursore a pillola (`app-variant-toggle`, pensato per 2 sole opzioni: con più segmenti il thumb
 * scorrevole si affolla), non abbastanza — o comunque senza un vero senso "a ruota" — per la ruota a
 * spicchi (`app-variant-wheel`, riservata alle 12 opzioni come i segni zodiacali, dove uno spicchio
 * per opzione è naturale). Un bottone per opzione, stesso linguaggio visivo delle pillole già usate nel
 * widget generator-hub della home page (coerenza tra i due punti in cui si sceglie una variante).
 * Stessa interfaccia degli altri due selettori (opzioni + chiave attiva + funzione da chiamare, nessuno
 * stato proprio) così il chiamante sceglie il widget guardando solo `options().length`.
 */
@Component({
    selector: 'app-variant-buttons',
    standalone: true,
    imports: [],
    templateUrl: './variant-buttons.component.html',
    styles: [`
        :host { display: block; }
        .variant-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: .4rem;
        }
        .variant-buttons-btn {
            padding: .35rem .85rem;
            border-radius: 999px;
            border: 1px dashed color-mix(in srgb, currentColor 22%, transparent);
            background: transparent;
            color: inherit;
            font-size: .82rem;
            font-weight: 600;
            cursor: pointer;
            transition: border-color .2s ease, color .2s ease;
        }
        .variant-buttons-btn.active {
            border-style: solid;
            border-color: var(--colorPrimary);
            color: var(--colorPrimary);
            font-weight: 700;
        }
        .variant-buttons-btn:disabled { cursor: default; opacity: .7; }
        .variant-buttons-btn:focus-visible {
            outline: var(--focusRingWidth) solid var(--focusRingColor);
            outline-offset: var(--focusRingOffset);
        }
    `],
})
export class VariantButtonsComponent {
    /** Le opzioni selezionabili (pensato per 3-11). */
    readonly options = input.required<GeneratorVariantOption[]>();
    /** Chiave dell'opzione attualmente attiva. */
    readonly active = input<string | null>(null);
    /** Disabilita l'interazione mentre una generazione è in corso. */
    readonly loading = input(false);
    /** Etichetta accessibile del gruppo (es. "Tipo di locale"). */
    readonly ariaLabel = input('');
    /** Chiamata con la chiave scelta: il parent decide cosa farne (tipicamente rigenerare). */
    readonly onPick = input.required<(key: string) => void>();
}
