import {
    Component,
    ElementRef,
    Injector,
    computed,
    inject,
    input,
    output,
    viewChildren,
} from '@angular/core';
import { FocusKeyManager, FocusableOption } from '@angular/cdk/a11y';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ContextMenuOption } from './context-menu.models';

/** UI del menu contestuale, creata dentro un overlay CDK dalla `ContextMenuDirective` — non va
 *  usata direttamente nei template. Posizionamento e dismiss-on-outside-click li fa CDK Overlay;
 *  qui resta il rendering della lista e la navigazione da tastiera con CDK `FocusKeyManager`. */
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

    // In ordine DOM: solo i bottoni menuitem hanno #itemEl (i separatori no), quindi coincide
    // già con l'ordine di navigazione voluto senza dover escludere altro.
    private readonly itemEls = viewChildren<ElementRef<HTMLButtonElement>>('itemEl');
    private readonly items = computed<FocusableOption[]>(() =>
        this.itemEls().map(el => ({
            disabled: el.nativeElement.disabled,
            focus: () => el.nativeElement.focus(),
        }))
    );
    // Signal-based: si ricostruisce da sola quando `items` cambia (es. opzioni async), nessun
    // ri-query manuale del DOM. withWrap/withHomeAndEnd riproducono lo stesso comportamento
    // di prima (frecce con giro, Home/End al primo/ultimo); l'orientamento verticale è il default.
    private readonly keyManager = new FocusKeyManager(this.items, inject(Injector))
        .withWrap()
        .withHomeAndEnd();

    /** Sposta il focus al primo menuitem abilitato */
    focusFirst(): void {
        requestAnimationFrame(() => this.keyManager.setFirstItemActive());
    }

    onSelect(option: ContextMenuOption): void {
        if (!option.disabled) {
            this.optionSelected.emit(option);
        }
    }

    onKeydown(event: KeyboardEvent): void {
        // Tab: FocusKeyManager la ignora di proposito (emette solo `tabOut`, senza preventDefault —
        // lascia al consumer decidere) — qui il menu si chiude invece di lasciare che il browser
        // sposti il focus fuori.
        if (event.key === 'Tab') {
            event.preventDefault();
            this.menuDismissed.emit();
            return;
        }
        this.keyManager.onKeydown(event);
    }
}
