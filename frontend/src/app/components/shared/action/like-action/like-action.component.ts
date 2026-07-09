import { Component, computed, input } from '@angular/core';
import { BaseActionComponent } from '../../base/base-action.component';

/**
 * Bottone "mi piace": registra il risultato mostrato tra i piaciuti del generatore (ex "condivisi").
 * A differenza della condivisione vera e propria (share-action) non apre nessun canale esterno:
 * è un'azione tutta interna al sito, che il chiamante implementa passando `action`.
 */
@Component({
    selector: 'app-like-action',
    standalone: true,
    imports: [],
    templateUrl: './like-action.component.html',
})
export class LikeActionComponent extends BaseActionComponent {
    protected readonly defaultLabelKey = 'mettiMiPiaceAzione';

    /** Funzione che registra il risultato tra i piaciuti (sync o async). */
    readonly action = input.required<() => void | Promise<void>>();

    /** true se il risultato mostrato è già tra i piaciuti (stato piatto, niente "togli mi piace"). */
    readonly liked = input(false);

    override readonly displayLabel = computed(() =>
        this.liked()
            ? this.translate.translate('miPiaceGia')
            : this.translate.translate(this.label() ?? this.defaultLabelKey)
    );

    protected onClick(): void {
        if (this.liked()) return;
        void this.run(async () => {
            await this.action()();
            this.notify.toast(this.translate.translate('miPiaceConferma'), 'success');
        });
    }
}
