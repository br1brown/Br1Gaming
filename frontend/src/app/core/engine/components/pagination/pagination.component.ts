import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Paginazione «precedente / pagina X di Y / successiva»: due bottoni da almeno 44 px e il testo, uguale su telefono e computer.
 * Non compare con una pagina sola. Dentro `app-paged-list` è già incluso; da solo serve a chi gestisce da sé il caricamento.
 */
@Component({
    selector: 'app-pagination',
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (pages() > 1) {
            <nav class="d-flex align-items-center justify-content-between gap-2" [attr.aria-label]="'paginationNav' | translate">
                <button type="button" class="btn btn-outline-primary btn-touch" [disabled]="page() <= 1"
                        (click)="pageChange.emit(page() - 1)">
                    <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                    <span>{{ 'paginationPrev' | translate }}</span>
                </button>
                <span class="text-center small" aria-live="polite">{{ 'paginationPageOf' | translate: page() : pages() }}</span>
                <button type="button" class="btn btn-outline-primary btn-touch" [disabled]="page() >= pages()"
                        (click)="pageChange.emit(page() + 1)">
                    <span>{{ 'paginationNext' | translate }}</span>
                    <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
            </nav>
        }
    `,
})
export class PaginationComponent {
    /** La pagina corrente, da 1. */
    readonly page = input.required<number>();
    /** Quanti elementi in tutto (non in questa pagina). */
    readonly total = input.required<number>();
    readonly pageSize = input.required<number>();
    readonly pageChange = output<number>();

    protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
}
