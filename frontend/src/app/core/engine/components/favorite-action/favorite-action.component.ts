import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BaseToggleActionComponent } from '../base/base-toggle-action.component';
import { ToggleIconComponent, type ToggleIconTone } from '../toggle-icon/toggle-icon.component';

/**
 * «Preferito» (stella), costruito su `app-toggle-icon`: lo stesso schema di `app-like-action`, con il significato di «salvato» invece di «mi piace»
 * (senza toast di conferma, di serie solo il glifo). Due modi:
 * - **interruttore** (`[toggle]="true"`): la stellina dei preferiti, si accende e si spegne;
 * - **permanente** (di serie): una volta preferito resta tale, il click non fa più niente.
 *
 * ```html
 * <app-favorite-action [action]="alterna" [toggle]="true" [favorite]="salvato()" />
 * <app-favorite-action [action]="alterna" [toggle]="true" [favorite]="salvato()" icon="fa-solid fa-heart" tone="danger" label="Salva" />   <!-- stessa cosa col cuore -->
 * ```
 * Per un nome accessibile diverso per riga («Aggiungi ai preferiti: Casa X») passa `label` e `activeLabel` già tradotti.
 */
@Component({
    selector: 'app-favorite-action',
    standalone: true,
    imports: [ToggleIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <app-toggle-icon [icon]="icon()" [active]="state()" [variant]="shape()" [tone]="tone()" [label]="offLabel()" [activeLabel]="displayLabel()"
                         [showLabel]="showLabel()" [fullWidth]="fullWidth()" [loading]="loading()" [disabled]="disabled()" [tabbable]="tabbable()"
                         (toggle)="onToggle()" />
    `,
})
export class FavoriteActionComponent extends BaseToggleActionComponent {
    protected readonly defaultLabelKey = 'preferitoAggiungiAzione';
    protected readonly defaultVariant = 'icon';
    protected readonly labelKeys = { off: 'preferitoAggiungiAzione', onPermanent: 'preferitoGiaAzione', onToggle: 'preferitoTogliAzione' };

    /** «Già preferito». Lo stato del bottone: lo aggiorna chi usa il componente; con `[toggle]` il componente passa da sé al nuovo stato dopo un'azione riuscita e segue comunque ogni cambio da fuori. */
    readonly favorite = input(false);
    readonly icon = input('fa-solid fa-star');
    readonly tone = input<ToggleIconTone>('warning');

    protected externalState(): boolean { return this.favorite(); }
}
