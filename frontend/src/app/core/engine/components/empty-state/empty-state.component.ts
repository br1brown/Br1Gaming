import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Stato vuoto (lista, ricerca o filtro senza risultati): icona, messaggio e azione proiettata
 *  opzionale, al posto di un'area bianca che sembra un errore. `role="status"`: annunciato quando
 *  compare dopo un'azione dell'utente (es. un filtro che svuota la lista). */
@Component({
    selector: 'app-empty-state',
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="empty-state" [class.empty-state--compact]="compact()" role="status">
            @if (icon()) {
                <i class="empty-state__icon" [class]="icon()" aria-hidden="true"></i>
            }
            <p class="empty-state__title">{{ titleKey() | translate }}</p>
            @if (descriptionKey(); as description) {
                <p class="empty-state__text">{{ description | translate }}</p>
            }
            <div class="empty-state__actions"><ng-content /></div>
        </div>
    `,
    host: { class: 'd-block' },
})
export class EmptyStateComponent {
    /** Chiave i18n (o testo) del messaggio principale. */
    readonly titleKey = input('nessunElementoStato');
    /** Chiave i18n (o testo) di una riga di spiegazione o suggerimento. */
    readonly descriptionKey = input<string | null>(null);
    /** Classi Font Awesome dell'icona; vuoto = nessuna icona. */
    readonly icon = input('fa-regular fa-folder-open');
    /** Variante compatta, senza icona grande: dentro un dropdown o una card piccola. */
    readonly compact = input(false);
}
