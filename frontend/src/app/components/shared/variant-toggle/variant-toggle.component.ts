import { Component, computed, input } from '@angular/core';
import { GeneratorVariantOption } from '../../../core/dto/generator.dto';

/**
 * Selettore della "variante" di un generatore per POCHE opzioni (2-3, es. italiano/straniero dei
 * locali): un cursore che scorre da un lato all'altro di una pillola, non una ruota — la ruota
 * (`app-variant-wheel`) resta per le varianti con tante opzioni (i 12 segni dell'oroscopo), dove uno
 * spicchio per opzione ha senso; con 2 sole opzioni renderebbe solo due semicerchi. Stessa interfaccia
 * della ruota (input delle opzioni + funzione da chiamare con la chiave scelta, nessuno stato
 * proprio) così il chiamante sceglie il widget guardando `options().length`, non la logica.
 */
@Component({
    selector: 'app-variant-toggle',
    standalone: true,
    imports: [],
    templateUrl: './variant-toggle.component.html',
    styles: [`
        :host { display: block; }
        .variant-toggle {
            position: relative;
            display: inline-flex;
            padding: .3rem;
            border-radius: 999px;
            background: var(--bs-tertiary-bg);
            box-shadow: inset 0 1px 3px color-mix(in srgb, black 25%, transparent);
        }
        /* Cursore fisico (stessa firma bisello di .btn-skeuo, _skeuo.scss): scorre in "left"
           invece che a spicchi, per questo qui e non nella ruota. */
        .variant-toggle-thumb {
            position: absolute;
            top: .3rem;
            bottom: .3rem;
            border-radius: 999px;
            background: linear-gradient(180deg,
                color-mix(in srgb, white 22%, var(--colorPrimary)) 0%,
                var(--colorPrimary) 55%,
                color-mix(in srgb, black 18%, var(--colorPrimary)) 100%);
            box-shadow:
                0 2px 0 color-mix(in srgb, black 35%, var(--colorPrimary)),
                0 4px 10px color-mix(in srgb, black 25%, transparent);
            transition: left .25s cubic-bezier(.34, 1.56, .64, 1);
        }
        .variant-toggle-btn {
            position: relative;
            z-index: 1;
            flex: 1 1 0;
            border: none;
            background: transparent;
            padding: .45rem 1.1rem;
            border-radius: 999px;
            font-weight: 700;
            font-size: .85rem;
            color: var(--bs-body-color);
            cursor: pointer;
            white-space: nowrap;
            transition: color .2s ease;
        }
        .variant-toggle-btn.active {
            color: var(--colorPrimaryText);
            background-color: var(--colorPrimary);
            background-image: linear-gradient(180deg,
                color-mix(in srgb, white 22%, var(--colorPrimary)) 0%,
                var(--colorPrimary) 55%,
                color-mix(in srgb, black 18%, var(--colorPrimary)) 100%);
        }
        .variant-toggle-btn:disabled { cursor: default; opacity: .7; }
        .variant-toggle-btn:focus-visible {
            outline: var(--focusRingWidth) solid var(--focusRingColor);
            outline-offset: var(--focusRingOffset);
        }
        @media (prefers-reduced-motion: reduce) {
            .variant-toggle-thumb { transition: none; }
        }
    `],
})
export class VariantToggleComponent {
    /** Le opzioni selezionabili (pensato per 2-3, es. italiano/straniero). */
    readonly options = input.required<GeneratorVariantOption[]>();
    /** Chiave dell'opzione attualmente attiva. */
    readonly active = input<string | null>(null);
    /** Disabilita l'interazione mentre una generazione è in corso. */
    readonly loading = input(false);
    /** Etichetta accessibile del gruppo (es. "Tipo di locale"). */
    readonly ariaLabel = input('');
    /** Chiamata con la chiave scelta: il parent decide cosa farne (tipicamente rigenerare). */
    readonly onPick = input.required<(key: string) => void>();

    /** Indice dell'opzione attiva; 0 se nessuna corrisponde (prima del primo pick esplicito, il
     *  parent tiene comunque la prima opzione come default — vedi generator-detail). */
    protected readonly activeIndex = computed(() => {
        const idx = this.options().findIndex(o => o.key === this.active());
        return idx < 0 ? 0 : idx;
    });

    /** Percentuale di larghezza di UN segmento (opzioni equidistribuite nella pillola). */
    protected readonly segmentPct = computed(() => 100 / Math.max(1, this.options().length));

    /** Posizione (da sinistra) e larghezza del cursore, in percentuale del contenitore. */
    protected readonly thumbLeftPct = computed(() => this.activeIndex() * this.segmentPct());
}
