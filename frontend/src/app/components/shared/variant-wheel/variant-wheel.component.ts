import { Component, computed, input } from '@angular/core';
import { GeneratorVariantOption } from '../../../core/dto/generator.dto';

/** Uno spicchio già pronto per il template: il path SVG della fetta e la posizione dell'etichetta,
 *  calcolati una volta da `wedges` (nessuna trigonometria nell'HTML). */
interface Wedge {
    key: string;
    label: string;
    path: string;
    labelX: number;
    labelY: number;
    anchor: 'start' | 'middle' | 'end';
}

// VIEW abbastanza più largo di CX/CY*2 da lasciare margine alle etichette più lunghe
// ("Capricorno", "Sagittario") che sporgono oltre R_LABEL: altrimenti il viewBox le taglia ai bordi.
const CX = 200, CY = 200, R = 100, R_LABEL = 122, VIEW = 400;

/** Un punto sulla circonferenza di raggio `r`, ad angolo `deg` misurato da ORE 12 in senso orario
 *  (coerente con l'occhio: spicchio 0 in cima, si gira come le lancette). */
function point(deg: number, r: number): { x: number; y: number } {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/**
 * Selettore della "variante" di un generatore (es. i 12 segni dell'oroscopo) come RUOTA divisa in
 * spicchi: tocchi lo spicchio, sotto compare la generazione per quel segno — stesso schema del
 * picker a chip (input delle opzioni + funzione da chiamare con la chiave scelta, nessuno stato
 * proprio), solo la forma cambia. Il numero di spicchi segue `options().length`: non c'è nulla di
 * cablato sui 12 segni, quindi funziona per qualunque variante futura con poche opzioni — ma è
 * pensato per un pugno di scelte (una ruota con 40 spicchi sottilissimi non si legge più).
 */
@Component({
    selector: 'app-variant-wheel',
    standalone: true,
    imports: [],
    templateUrl: './variant-wheel.component.html',
    styles: [`
        :host { display: block; width: 100%; }
        svg { width: 100%; max-width: 360px; height: auto; display: block; margin: 0 auto; overflow: visible; }
        .wedge { cursor: pointer; }
        .wedge path {
            fill: var(--bs-tertiary-bg, #eee);
            stroke: var(--bs-body-bg, #fff);
            stroke-width: 2;
            transition: fill .15s ease;
        }
        .wedge:hover:not(.disabled) path { fill: color-mix(in srgb, var(--bs-primary) 30%, var(--bs-tertiary-bg, #eee)); }
        .wedge.active path { fill: var(--bs-primary); }
        .wedge text {
            font-size: 11px;
            fill: currentColor;
            dominant-baseline: central;
        }
        .wedge.active text { font-weight: 700; }
        .disabled { pointer-events: none; opacity: .6; }
    `],
})
export class VariantWheelComponent {
    /** Le opzioni selezionabili (es. i 12 segni). */
    readonly options = input.required<GeneratorVariantOption[]>();
    /** Chiave dell'opzione attualmente attiva. */
    readonly active = input<string | null>(null);
    /** Disabilita l'interazione mentre una generazione è in corso. */
    readonly loading = input(false);
    /** Etichetta accessibile del gruppo (es. "Scegli il tuo segno"). */
    readonly ariaLabel = input('');
    /** Chiamata con la chiave scelta: il parent decide cosa farne (tipicamente rigenerare). */
    readonly onPick = input.required<(key: string) => void>();

    protected readonly viewBox = `0 0 ${VIEW} ${VIEW}`;

    protected readonly wedges = computed<Wedge[]>(() => {
        const opts = this.options();
        const n = opts.length;
        if (n === 0) return [];
        const step = 360 / n;
        return opts.map((opt, i) => {
            const start = i * step, end = (i + 1) * step, mid = start + step / 2;
            const p1 = point(start, R), p2 = point(end, R);
            const largeArc = step > 180 ? 1 : 0;
            const path = `M ${CX} ${CY} L ${p1.x} ${p1.y} A ${R} ${R} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
            const labelPt = point(mid, R_LABEL);
            // Ancoraggio in base a quanto lo spicchio pende a destra/sinistra del centro: in cima/fondo
            // resta centrato, altrimenti il testo si allontana dal cerchio nella direzione giusta.
            const dx = labelPt.x - CX;
            const anchor: Wedge['anchor'] = Math.abs(dx) < 8 ? 'middle' : dx > 0 ? 'start' : 'end';
            return { key: opt.key, label: opt.label, path, labelX: labelPt.x, labelY: labelPt.y, anchor };
        });
    });
}
