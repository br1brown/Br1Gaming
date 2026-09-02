import { Component, Signal, computed, input } from '@angular/core';
import { BaseContactComponent } from '../base/base-contact.component';
import { LinkBadgeComponent } from '../link-badge/link-badge.component';
import { ContactUrl } from '../utils/contact-url';
import { MailContactConfig } from '../mail-contact/mail-contact.component';

@Component({
    selector: 'app-pec-contact',
    standalone: true,
    imports: [LinkBadgeComponent],
    templateUrl: './pec-contact.component.html',
})
export class PecContactComponent extends BaseContactComponent {
    readonly config = input.required<MailContactConfig>();

    protected readonly defaultLabelKey = 'inviaPecAzione';

    readonly glyph: Signal<string> = computed(() => 'fa-solid fa-envelope-circle-check');
    readonly color: Signal<string | null> = computed(() => null);
    readonly content: Signal<string> = computed(() => this.config().to.trim());
    readonly href: Signal<string> = computed(() => {
        const { to, subject, body } = this.config();
        return ContactUrl.mail(to, subject, body);
    });
}
