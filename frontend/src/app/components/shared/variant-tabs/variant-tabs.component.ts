import { Component, input } from '@angular/core';
import { GeneratorVariantOption } from '../../../core/dto/generator.dto';

/**
 * Selettore a tab-bar per la "variante" di un generatore (es. i 12 segni dell'oroscopo): una riga
 * di tab scorrevole in orizzontale, con la stessa grammatica visiva dei link di navigazione attivi
 * del sito (sottolineatura + grassetto sull'attiva, vedi nav/_links.scss) invece di pulsanti a
 * pillola indipendenti — così si legge come UNA barra di schede, non come bottoni sparsi.
 * Componente puramente presentazionale: non genera, non condivide, non sa nulla del generatore —
 * riceve le opzioni e una funzione da chiamare con la chiave scelta (stesso pattern di
 * `speakText`/`buildShareCanvas` in GeneratorDetailComponent: il parent resta l'unico proprietario
 * della logica).
 */
@Component({
    selector: 'app-variant-tabs',
    standalone: true,
    imports: [],
    templateUrl: './variant-tabs.component.html',
    styles: [`
        :host { display: block; }
        /* Scorrevole in orizzontale sui pochi pixel del mobile, senza andare a capo; la riga di
           base (border-bottom) è la "linea dei binari" comune a tutte le tab. */
        .variant-tabs {
            scrollbar-width: none;
            border-bottom: 1px solid var(--bs-border-color);
        }
        .variant-tabs::-webkit-scrollbar { display: none; }
        .variant-tabs button {
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            border-radius: 0;
            margin-bottom: -1px;
            padding: 0.45rem 0.15rem;
            white-space: nowrap;
            color: inherit;
            opacity: 0.6;
        }
        .variant-tabs button:hover:not(:disabled) { opacity: 0.85; }
        .variant-tabs button:disabled { cursor: default; }
        .variant-tabs button.active {
            opacity: 1;
            font-weight: 700;
            border-bottom-color: var(--bs-primary);
        }
    `],
})
export class VariantTabsComponent {
    /** Le opzioni selezionabili (es. i 12 segni). */
    readonly options = input.required<GeneratorVariantOption[]>();
    /** Chiave dell'opzione attualmente attiva. */
    readonly active = input<string | null>(null);
    /** Disabilita i pulsanti mentre una generazione è in corso. */
    readonly loading = input(false);
    /** Etichetta accessibile della tab-bar (es. "Scegli il tuo segno"). */
    readonly ariaLabel = input('');
    /** Chiamata con la chiave scelta: il parent decide cosa farne (tipicamente rigenerare). */
    readonly onPick = input.required<(key: string) => void>();
}
