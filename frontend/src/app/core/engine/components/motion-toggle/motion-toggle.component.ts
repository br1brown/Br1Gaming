import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AppearanceService } from '../../services/appearance.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

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
                <input class="form-check-input" type="checkbox" role="switch" id="motion-toggle"
                       [checked]="!appearance.smokePaused()" (change)="appearance.setSmokePaused(!$any($event.target).checked)"
                       [attr.aria-describedby]="hint() ? 'motion-toggle-hint' : null">
                <label class="form-check-label" for="motion-toggle">{{ 'motionToggleLabel' | translate }}</label>
                @if (hint()) { <div id="motion-toggle-hint" class="form-text">{{ 'motionToggleAiuto' | translate }}</div> }
            </div>
        }
    `,
})
export class MotionToggleComponent {
    protected readonly appearance = inject(AppearanceService);
    readonly hint = input(true);
}
