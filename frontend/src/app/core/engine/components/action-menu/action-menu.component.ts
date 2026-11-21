import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ContextMenuDirective } from '../../directives/context-menu.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';
import type { ContextMenuOption } from '../context-menu/context-menu.models';

/**
 * Il bottone «⋮» che apre con un click un menu di azioni: l'«overflow menu», il modo consueto di raccogliere le azioni di una scheda o di una riga
 * (modifica, elimina…) senza una fila di pulsanti. Il menu è quello di `[appContextMenu]`, ma si apre attaccato al bottone (popover sotto di lui, anche su touch: il bottom sheet resta per il
 * tasto destro e la pressione lunga), con Escape, click fuori e ritorno del focus. Il tasto destro e la pressione lunga sul bottone aprono lo stesso menu.
 *
 * ```html
 * <app-action-menu [options]="voci" [label]="'Azioni su ' + nome" />
 * ```
 * Le etichette delle `options` sono già tradotte; `label` è il nome accessibile del bottone (senza, il generico «Azioni»).
 * Per una sola azione per riga un pulsante dedicato resta meglio: il menu aggiunge un clic.
 */
@Component({
    selector: 'app-action-menu',
    imports: [ContextMenuDirective, TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button type="button" class="btn btn-outline-secondary btn-touch" aria-haspopup="menu"
                #trigger [appContextMenu]="options()" #menu="appContextMenu" [disabled]="disabled()"
                [attr.aria-label]="label() ?? ('actionMenuLabel' | translate)" (click)="menu.openFromElement(trigger)">
            <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
        </button>`,
})
export class ActionMenuComponent {
    readonly options = input.required<ContextMenuOption[]>();
    /** Nome accessibile del bottone, es. «Azioni su Parma 3». */
    readonly label = input<string | null>(null);
    readonly disabled = input(false);
}
