import { Directive, Signal, computed, inject } from '@angular/core';
import { BaseLinkComponent } from './base-link.component';
import { TranslateService } from '../../services/translate.service';

/**
 * Specializza `BaseLinkComponent` per i canali di contatto (label = chiave i18n tradotta).
 * Il concreto dichiara solo `defaultLabelKey`, `glyph`, `color`, `href`.
 */
@Directive()
export abstract class BaseContactComponent extends BaseLinkComponent {
    protected readonly translate = inject(TranslateService);

    /** Chiave i18n di default per label e aria-label. */
    protected abstract readonly defaultLabelKey: string;

    readonly displayLabel: Signal<string> = computed(() =>
        this.translate.translate(this.label() ?? this.defaultLabelKey)
    );
}
