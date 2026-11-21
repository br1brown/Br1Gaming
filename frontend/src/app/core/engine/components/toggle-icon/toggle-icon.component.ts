import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BusyIconComponent } from '../busy-icon/busy-icon.component';

/** Il colore dell'icona accesa (variante `icon`): il «text-emphasis» di Bootstrap, che resta leggibile su ogni superficie e in entrambi i toni. */
export type ToggleIconTone = 'warning' | 'danger' | 'primary' | 'success' | 'info' | 'secondary';

/**
 * Interruttore a due stati, solo presentazione: il glifo che gli dai (`icon`), lo stato (`active`) e la richiesta di cambiarlo (`toggle`).
 * Non decide niente: chi lo usa cambia `active` quando e se vuole. È la base di `app-like-action` (cuore) e `app-favorite-action` (stella), che
 * aggiungono il lavoro da fare, il caricamento e i testi; da solo serve per un interruttore tuo (un segnalibro, una campanella, un «segui»).
 *
 * ```html
 * <app-toggle-icon icon="fa-solid fa-bookmark" [active]="salvato()" label="Salva" activeLabel="Togli dai salvati" (toggle)="salva($event)" />
 * ```
 * Due aspetti: `variant="icon"` (di serie) è solo il glifo, con il contorno da spento e pieno e colorato da acceso (come la stellina dei preferiti);
 * `variant="button"` è un `btn-outline-secondary` che da acceso diventa `.active`, con la label accanto se `showLabel`.
 * Funziona con qualunque glifo pieno di Font Awesome (`fa-solid`): il contorno da spento è disegnato dal browser, non da un secondo glifo.
 */
@Component({
    selector: 'app-toggle-icon',
    imports: [BusyIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (variant() === 'button') {
            <button type="button" class="btn btn-outline-secondary btn-touch" [class.w-100]="fullWidth()" [class.active]="active()"
                    [attr.aria-pressed]="active()" [disabled]="loading() || disabled()" [attr.aria-busy]="loading() || null"
                    [attr.title]="showLabel() ? null : name()" [attr.aria-label]="showLabel() ? null : name()"
                    [attr.tabindex]="tabbable() ? null : -1" (click)="toggle.emit(!active())">
                <app-busy-icon [glyph]="icon()" [busy]="loading()" />
                @if (showLabel()) { <span>{{ name() }}</span> }
            </button>
        } @else {
            <button type="button" class="btn btn-touch btn-link p-0 toggle-icon" [class.toggle-icon--on]="active()"
                    [style.--toggle-icon-color]="'var(--bs-' + tone() + '-text-emphasis)'"
                    [attr.aria-pressed]="active()" [disabled]="loading() || disabled()" [attr.aria-busy]="loading() || null"
                    [attr.aria-label]="name()" [attr.title]="name()" [attr.tabindex]="tabbable() ? null : -1" (click)="toggle.emit(!active())">
                <app-busy-icon [glyph]="icon()" [busy]="loading()" />
            </button>
        }
    `,
    styles: [`
        /* Spento: solo il contorno del glifo (la Font Awesome «regular» non è caricata). Acceso: pieno, nel colore dell'interruttore. */
        .toggle-icon { --toggle-icon-color: var(--bs-secondary-color); min-width: var(--touchTarget); text-decoration: none; color: var(--bs-secondary-color); }
        .toggle-icon ::ng-deep i { font-size: 1.25rem; color: transparent; -webkit-text-stroke: 1.5px var(--bs-secondary-color); }
        .toggle-icon--on, .toggle-icon--on:hover { color: var(--toggle-icon-color); }
        .toggle-icon--on ::ng-deep i { color: var(--toggle-icon-color); -webkit-text-stroke: 0; }
    `],
    // A tutta larghezza l'host diventa block, così il `w-100` del bottone riempie davvero il padre.
    host: { '[class.d-inline-block]': '!fullWidth()', '[class.d-block]': 'fullWidth()' },
})
export class ToggleIconComponent {
    /** Classi Font Awesome del glifo, piene (es. `fa-solid fa-star`). */
    readonly icon = input.required<string>();
    readonly active = input(false);
    /** Nome accessibile da spento (già tradotto). Con `showLabel` è anche il testo. */
    readonly label = input('');
    /** Nome accessibile da acceso (già tradotto); senza, resta `label`. */
    readonly activeLabel = input('');
    readonly variant = input<'icon' | 'button'>('icon');
    readonly tone = input<ToggleIconTone>('warning');
    /** Solo con `variant="button"`: la label accanto al glifo. */
    readonly showLabel = input(false);
    readonly fullWidth = input(false);
    /** Spinner al posto del glifo, bottone non cliccabile: il lavoro di chi lo usa è in corso. */
    readonly loading = input(false);
    readonly disabled = input(false);
    /** Negli elenchi l'interruttore esce dal Tab (un solo Tab per riga); si ritrova nella scheda, dove c'è sempre. */
    readonly tabbable = input(true);

    /** Lo stato che si chiede: l'opposto di `active`. Non cambia niente da solo. */
    readonly toggle = output<boolean>();

    protected name(): string { return this.active() && this.activeLabel() ? this.activeLabel() : this.label(); }
}
