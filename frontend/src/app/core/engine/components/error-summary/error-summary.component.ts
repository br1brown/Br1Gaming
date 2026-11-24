import { ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, ElementRef, Injector, afterNextRender, effect, inject, input, untracked, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslateService } from '../../services/translate.service';
import { focusElement, type FieldErrorItem } from './form-errors';

/** Riepilogo degli errori in cima al form: nome e messaggio di ogni campo (`items`, il clic porta al campo) e messaggi senza campo (`general`).
 *  A ogni nuovo elenco prende il focus, e finché è visibile il titolo della pagina inizia con «Errore: ». */
@Component({
    selector: 'app-error-summary',
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (visible()) {
            <div #box class="alert alert-danger error-summary" tabindex="-1" data-error-summary>
                <div role="alert">
                    <h2 class="h5 alert-heading">{{ heading() | translate }}</h2>
                    <ul class="mb-0 ps-3">
                        @for (item of items(); track item.id) {
                            <li>
                                <button type="button" class="btn btn-link p-0 text-start align-baseline text-reset text-decoration-underline fw-semibold" (click)="go(item)">{{ item.label }}@if (item.message) {: {{ item.message }}}</button>
                            </li>
                        }
                        @for (message of general(); track $index) { <li>{{ message }}</li> }
                    </ul>
                </div>
            </div>
        }
    `,
})
export class ErrorSummaryComponent {
    private readonly document = inject(DOCUMENT);
    private readonly injector = inject(Injector);
    private readonly title = inject(Title);
    private readonly translate = inject(TranslateService);

    /** I campi da correggere (`collectFieldErrors` / `showFormErrors`). */
    readonly items = input<readonly FieldErrorItem[]>([]);
    /** I messaggi che non appartengono a un campo. */
    readonly general = input<readonly string[]>([]);
    /** Chiave i18n (o testo) del titolo. */
    readonly heading = input('errorSummaryTitolo');

    private readonly box = viewChild<ElementRef<HTMLElement>>('box');
    protected readonly visible = () => this.items().length > 0 || this.general().length > 0;

    constructor() {
        // Un nuovo elenco non vuoto: il focus al riepilogo, dopo che è stato disegnato.
        effect(() => {
            this.items(); this.general();
            if (!untracked(this.visible)) return;
            afterNextRender(() => this.box()?.nativeElement.focus({ preventScroll: false }), { injector: this.injector });
        });
        // «Errore: » davanti al titolo finché il riepilogo si vede.
        effect(() => {
            const prefix = this.translate.translate('errorSummaryTitlePrefix');
            if (this.visible()) { if (!this.title.getTitle().startsWith(prefix)) this.title.setTitle(prefix + this.title.getTitle()); }
            else this.removePrefix(prefix);
        });
        inject(DestroyRef).onDestroy(() => this.removePrefix(this.translate.translate('errorSummaryTitlePrefix')));
    }

    private removePrefix(prefix: string): void {
        const current = this.title.getTitle();
        if (current.startsWith(prefix)) this.title.setTitle(current.slice(prefix.length));
    }

    /** Il clic su una voce: il focus (e la vista) sul campo. Un campo sparito dal DOM nel frattempo non fa niente. */
    protected go(item: FieldErrorItem): void {
        const el = this.document.getElementById(item.id);
        if (el) focusElement(el);
    }
}
