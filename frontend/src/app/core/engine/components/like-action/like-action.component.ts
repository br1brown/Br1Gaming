import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BaseToggleActionComponent } from '../base/base-toggle-action.component';
import { ToggleIconComponent, type ToggleIconTone } from '../toggle-icon/toggle-icon.component';

/**
 * «Mi piace» (cuore), costruito su `app-toggle-icon`. **Di serie si comporta come ha sempre fatto**: `action` registra l'apprezzamento e conferma con un toast;
 * lo stato è solo `liked` (lo cambia chi usa il componente); una volta `liked` il click non fa più niente, niente «togli». Stesso nome, stesso selettore, stesso aspetto.
 * Opt-in: `[toggle]="true"` lo rende un interruttore che si accende e si spegne da sé (`action(prossimo)` sa in che direzione); `variant`, `icon`, `tone` cambiano l'aspetto.
 *
 * ```html
 * <app-like-action [action]="registra" />                                                   <!-- come sempre -->
 * <app-like-action [action]="alterna" [toggle]="true" [liked]="piace()" variant="icon" />   <!-- un «mi piace» che si toglie, solo cuore -->
 * ```
 * Stesse opzioni di `app-favorite-action`: `variant`, `tone`, `icon`, `tabbable`, `disabled`, e quelle delle azioni (`label`, `showLabel`, `fullWidth`).
 */
@Component({
    selector: 'app-like-action',
    standalone: true,
    imports: [ToggleIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './like-action.component.html',
})
export class LikeActionComponent extends BaseToggleActionComponent {
    protected readonly defaultLabelKey = 'mettiMiPiaceAzione';
    protected readonly defaultVariant = 'button';
    protected readonly labelKeys = { off: 'mettiMiPiaceAzione', onPermanent: 'miPiaceGia', onToggle: 'miPiaceTogli' };

    /** «Già piaciuto». Di serie è lo stato del bottone, come sempre: lo aggiorna chi usa il componente. Con `[toggle]` il componente passa da sé al nuovo stato dopo un'azione riuscita e segue comunque ogni cambio da fuori. */
    readonly liked = input(false);
    readonly icon = input('fa-solid fa-heart');
    readonly tone = input<ToggleIconTone>('danger');

    protected externalState(): boolean { return this.liked(); }

    protected override afterChange(next: boolean): void {
        if (next) this.notify.toast(this.translate.translate('miPiaceConferma'), 'success');
    }
}
