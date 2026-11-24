import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { AppearanceService } from '../../services/appearance.service';
import { CookieConsentService } from '../../services/cookie-consent.service';
import { injectCookieReopenVisible } from '../cookie-banner/cookie-banner.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { injectPrefersReducedMotion } from '../../breakpoints';
import { ContestoSito } from '../../../../site';

/** Pulsante che ferma o riprende lo smoke (WCAG 2.2.2). Host `sticky-bottom` alto 0 fra `<main>` e footer: flotta sopra il
 *  pulsante dei cookie e si ferma da solo dove inizia il footer. Sparisce col banner dei cookie aperto e con «riduci movimento». */
@Component({
    selector: 'app-motion-pause',
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrl: './motion-pause.component.scss',
    host: {
        class: 'sticky-bottom d-block',
        '[class.motion-pause--above-cookie]': 'aboveCookie()',
        '[class.motion-pause--standard]': 'standard',
    },
    template: `
        @if (visible()) {
            @let key = appearance.smokePaused() ? 'motionPauseRiprendi' : 'motionPauseFerma';
            <button type="button"
                    class="motion-pause-btn surface-elevated fab rounded-circle border-0 p-0 d-flex align-items-center justify-content-center position-absolute"
                    [attr.aria-label]="key | translate" [attr.title]="key | translate"
                    (click)="appearance.setSmokePaused(!appearance.smokePaused())">
                <i class="fa-solid icon-md" [class.fa-pause]="!appearance.smokePaused()" [class.fa-play]="appearance.smokePaused()" aria-hidden="true"></i>
            </button>
        }
    `,
})
export class MotionPauseComponent {
    protected readonly appearance = inject(AppearanceService);
    private readonly cookie = inject(CookieConsentService);
    private readonly reducedMotion = injectPrefersReducedMotion();
    // Solo dopo l'idratazione: in SSR non si sa né lo stato dei cookie né la preferenza di movimento.
    private readonly hydrated = signal(false);

    /** Stessa misura del pulsante dei cookie (`fab.cookie` del design system). */
    protected readonly standard = ContestoSito.config.aspetto.fab.cookie === 'standard';

    protected readonly aboveCookie = injectCookieReopenVisible();
    protected readonly visible = computed(() =>
        this.hydrated() && this.appearance.smokeAvailable && !this.reducedMotion()
        && !(this.cookie.isNeeded() && !this.cookie.responded()));

    constructor() {
        afterNextRender(() => this.hydrated.set(true));
    }
}
