import {
    Component,
    ElementRef,
    input,
    output,
    viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ContextMenuOption } from './context-menu.models';

/**
 * UI del menu contestuale, creata dentro un overlay CDK dalla `ContextMenuDirective`.
 * Non va usata direttamente nei template. Il posizionamento lo fa CDK Overlay: qui resta
 * solo il rendering della lista, la navigazione da tastiera e la gestione del focus.
 */
@Component({
    selector: 'app-context-menu-overlay',
    standalone: true,
    imports: [TranslatePipe],
    templateUrl: './context-menu-overlay.component.html',
    styleUrl: './context-menu-overlay.component.scss',
    host: { '(keydown)': 'onKeydown($event)' }
})
export class ContextMenuOverlayComponent {
    readonly options = input<ContextMenuOption[]>([]);
    readonly presentation = input<'popover' | 'sheet'>('popover');
    readonly optionSelected = output<ContextMenuOption>();
    /** Emesso quando il menu va chiuso senza selezione (es. Tab). */
    readonly menuDismissed = output<void>();

    readonly menuEl = viewChild<ElementRef<HTMLElement>>('menuEl');

    /** Sposta il focus al primo menuitem abilitato */
    focusFirst(): void {
        requestAnimationFrame(() => this.getFocusableItems()[0]?.focus());
    }

    onSelect(option: ContextMenuOption): void {
        if (!option.disabled) {
            this.optionSelected.emit(option);
        }
    }

    onKeydown(event: KeyboardEvent): void {
        const items = this.getFocusableItems();
        if (items.length === 0) return;

        const idx = items.indexOf(document.activeElement as HTMLButtonElement);

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                items[(idx + 1) % items.length].focus();
                break;
            case 'ArrowUp':
                event.preventDefault();
                items[(idx - 1 + items.length) % items.length].focus();
                break;
            case 'Home':
                event.preventDefault();
                items[0].focus();
                break;
            case 'End':
                event.preventDefault();
                items[items.length - 1].focus();
                break;
            case 'Tab':
                event.preventDefault();
                this.menuDismissed.emit();
                break;
        }
    }

    private getFocusableItems(): HTMLButtonElement[] {
        return Array.from(
            this.menuEl()?.nativeElement?.querySelectorAll<HTMLButtonElement>(
                'button[role="menuitem"]:not([disabled]):not(.disabled)'
            ) ?? []
        );
    }
}
