import { ChangeDetectionStrategy, Component, computed, forwardRef, input, model, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** I valori che un controllo segmentato può portare: stringa, numero, booleano o `null` («non indicato»). */
export type SegmentedValue = string | number | boolean | null;

/** Un segmento: il valore, il testo (chiave i18n o testo) e un glifo Font Awesome facoltativo. */
export interface SegmentedOption<V extends SegmentedValue = SegmentedValue> {
    value: V;
    label: string;
    icon?: string;
}

/** Sì / no: due segmenti, per una domanda che ha sempre una risposta. */
export const YES_NO_OPTIONS: readonly SegmentedOption<boolean>[] = [
    { value: true, label: 'segmentedSi' },
    { value: false, label: 'segmentedNo' },
];

/** Sì / no / non indicato: `null` è la terza risposta (la fonte non lo dice). */
export const YES_NO_UNKNOWN_OPTIONS: readonly SegmentedOption<boolean | null>[] = [
    ...YES_NO_OPTIONS,
    { value: null, label: 'segmentedNonIndicato' },
];

/** Scelta di una voce fra 2-6 visibili, in un form (`formControlName`, `ngModel`) o con `[(value)]`: bottoni da 44 px con `aria-pressed`, spunta sul scelto.
 *  `variant`: `group` (bottoni affiancati, default) o `pill` (cursore che scorre). Nome del gruppo con `label` o `labelledBy`. */
@Component({
    selector: 'app-segmented-control',
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SegmentedControlComponent), multi: true }],
    host: { class: 'd-block' },
    template: `
        @if (variant() === 'pill') {
            <div class="segmented segmented--pill" role="group" [attr.aria-label]="label() || null" [attr.aria-labelledby]="labelledBy() || null"
                 [style.--seg-count]="options().length" [style.--seg-index]="activeIndex()">
                @if (activeIndex() >= 0) { <span class="segmented__thumb" aria-hidden="true"></span> }
                @for (o of options(); track o.label) {
                    <button type="button" class="segmented__btn" [class.is-active]="isActive(o)" [attr.aria-pressed]="isActive(o)"
                            [disabled]="isDisabled()" (click)="pick(o)" (blur)="onTouched()">
                        @if (o.icon) { <i [class]="o.icon" aria-hidden="true"></i> }
                        <span>{{ o.label | translate }}</span>
                    </button>
                }
            </div>
        } @else {
            <div class="btn-group segmented" role="group" [attr.aria-label]="label() || null" [attr.aria-labelledby]="labelledBy() || null">
                @for (o of options(); track o.label) {
                    <button type="button" class="btn btn-touch" [class.btn-primary]="isActive(o)" [class.btn-outline-secondary]="!isActive(o)"
                            [attr.aria-pressed]="isActive(o)" [disabled]="isDisabled()" (click)="pick(o)" (blur)="onTouched()">
                        @if (isActive(o)) { <i class="fa-solid fa-check" aria-hidden="true"></i> }
                        @else if (o.icon) { <i [class]="o.icon" aria-hidden="true"></i> }
                        <span>{{ o.label | translate }}</span>
                    </button>
                }
            </div>
        }
    `,
    styles: `
        .segmented:not(.segmented--pill) .btn { flex: 1 1 auto; }
        .segmented--pill {
            position: relative; display: inline-grid; grid-template-columns: repeat(var(--seg-count), 1fr);
            padding: var(--space-1); border-radius: 999px; background: var(--bs-tertiary-bg);
        }
        .segmented__thumb {
            position: absolute; top: var(--space-1); bottom: var(--space-1); left: var(--space-1);
            width: calc((100% - 2 * var(--space-1)) / var(--seg-count)); border-radius: 999px; background: var(--colorPrimary);
            transform: translateX(calc(var(--seg-index) * 100%)); transition: transform var(--movimentoMicro);
        }
        .segmented__btn {
            position: relative; z-index: 1; min-height: 44px; padding: 0 var(--space-3); border: 0; border-radius: 999px;
            background: transparent; color: var(--bs-body-color); font-weight: 600; white-space: nowrap; cursor: pointer;
            transition: color var(--movimentoMicro);
        }
        .segmented__btn.is-active { color: var(--colorPrimaryText); }
        .segmented__btn:disabled { cursor: default; opacity: .7; }
        .segmented__btn:focus-visible { outline: var(--focusRingWidth) solid var(--focusRingColor); outline-offset: var(--focusRingOffset); }
        @media (prefers-reduced-motion: reduce) { .segmented__thumb, .segmented__btn { transition: none; } }
    `,
})
export class SegmentedControlComponent<V extends SegmentedValue = SegmentedValue> implements ControlValueAccessor {
    /** I segmenti, nell'ordine in cui si disegnano. L'etichetta di ogni segmento è anche la sua chiave: devono essere diverse. */
    readonly options = input.required<readonly SegmentedOption<V>[]>();
    /** Il valore scelto (`[(value)]`); dentro un form lo gestisce il controllo. */
    readonly value = model<V | null>(null);
    readonly variant = input<'group' | 'pill'>('group');
    /** Nome accessibile del gruppo (testo già tradotto). */
    readonly label = input('');
    /** Id di un'etichetta già in pagina che dà il nome al gruppo, in alternativa a `label`. */
    readonly labelledBy = input('');
    readonly disabled = input(false);

    private readonly formDisabled = signal(false);
    protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
    protected readonly activeIndex = computed(() => this.options().findIndex(o => o.value === this.value()));

    private onChange: (v: V) => void = () => undefined;
    protected onTouched: () => void = () => undefined;

    protected isActive(o: SegmentedOption<V>): boolean { return o.value === this.value(); }

    protected pick(o: SegmentedOption<V>): void {
        this.value.set(o.value);
        this.onChange(o.value);
        this.onTouched();
    }

    writeValue(v: V | null | undefined): void { this.value.set(v ?? null); }
    registerOnChange(fn: (v: V) => void): void { this.onChange = fn; }
    registerOnTouched(fn: () => void): void { this.onTouched = fn; }
    setDisabledState(disabled: boolean): void { this.formDisabled.set(disabled); }
}
