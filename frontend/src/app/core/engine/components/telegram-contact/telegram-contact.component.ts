import { Component, Signal, computed, input } from '@angular/core';
import { BaseContactComponent } from '../base/base-contact.component';
import { LinkBadgeComponent } from '../link-badge/link-badge.component';
import { brandColors } from '../social-link/social-link.component';
import { ContactUrl } from '../utils/contact-url';

@Component({
    selector: 'app-telegram-contact',
    standalone: true,
    imports: [LinkBadgeComponent],
    templateUrl: './telegram-contact.component.html',
})
export class TelegramContactComponent extends BaseContactComponent {
    /** Username Telegram (con o senza @). */
    readonly handle = input.required<string>();

    protected readonly defaultLabelKey = 'telegramAzione';

    readonly glyph: Signal<string> = computed(() => 'fa-brands fa-telegram');
    readonly color: Signal<string | null> = computed(() => brandColors('telegram').color);
    override readonly glyphColor: Signal<string | null> = computed(() => brandColors('telegram').fg);
    override readonly glyphMode: Signal<'glyph' | 'disc'> = computed(() => brandColors('telegram').mode);
    readonly content: Signal<string> = computed(() => this.handle().trim());
    readonly href: Signal<string> = computed(() => ContactUrl.telegram(this.handle()));
}
