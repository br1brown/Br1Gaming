import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Glifo di un bottone che diventa spinner mentre l'azione è in corso, nello stesso box fisso: il
 *  bottone non cambia misura al cambio di stato. Decorativo per gli screen reader: lo stato lo
 *  annuncia `aria-busy` sul bottone. */
@Component({
    selector: 'app-busy-icon',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (busy()) {
            <span class="spinner-border busy-icon__spinner" aria-hidden="true"></span>
        } @else if (glyph()) {
            <i [class]="glyph()" aria-hidden="true"></i>
        }
    `,
    host: {
        class: 'busy-icon',
        '[class.busy-icon--sm]': 'size() === "sm"',
        '[class.busy-icon--lg]': 'size() === "lg"',
        '[class.busy-icon--empty]': '!busy() && !glyph()',
    },
})
export class BusyIconComponent {
    /** Classi Font Awesome del glifo a riposo (es. "fa-solid fa-download"). Vuoto = nessun glifo a
     *  riposo: il box compare solo col caricamento (bottoni di solo testo). */
    readonly glyph = input<string>('');
    readonly busy = input(false);
    /** Taglia dal token `--iconSize-*`: `sm` nei `.btn-sm`, `md` (default) nei `.btn`. */
    readonly size = input<'sm' | 'md' | 'lg'>('md');
}
