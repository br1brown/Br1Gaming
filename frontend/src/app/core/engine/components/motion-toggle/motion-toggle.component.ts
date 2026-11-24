import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AppearanceService } from '../../services/appearance.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

let nextId = 0;

/** Interruttore «Animazione di sfondo» (WCAG 2.2.2): ferma o riprende l'effetto smoke e ricorda la scelta sul dispositivo. **Non compare da solo
 *  se il design system non accende lo smoke**: si mette dove serve (impostazioni, footer) senza `@if`, e un sito senza effetto non ha un
 *  controllo che non fa niente. `[hint]="false"` toglie il testo d'aiuto sotto. */
@Component({
    selector: 'app-motion-toggle',
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (appearance.smokeAvailable) {
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" role="switch" [id]="id"
                       [checked]="!appearance.smokePaused()" (change)="appearance.setSmokePaused(!$any($event.target).checked)"
                       [attr.aria-describedby]="hint() ? id + '-hint' : null">
                <label class="form-check-label" [for]="id">{{ 'motionToggleLabel' | translate }}</label>
                @if (hint()) { <div [id]="id + '-hint'" class="form-text">{{ 'motionToggleAiuto' | translate }}</div> }
            </div>
        }
    `,
})
export class MotionToggleComponent {
    protected readonly appearance = inject(AppearanceService);
    readonly hint = input(true);
    /** Id unico per ogni copia: il footer e una pagina di impostazioni possono mostrarlo insieme. */
    protected readonly id = `motion-toggle-${++nextId}`;
}
