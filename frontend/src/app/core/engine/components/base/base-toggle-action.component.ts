import { Directive, computed, input, linkedSignal } from '@angular/core';
import { BaseActionComponent } from './base-action.component';

/**
 * Base di `app-like-action` e `app-favorite-action`: un'azione a due stati disegnata da `app-toggle-icon`.
 * Due modi, scelti da chi la usa con `[toggle]`:
 * - **permanente** (di serie, e il comportamento che `app-like-action` ha sempre avuto): lo stato è solo quello che arriva da fuori (`[liked]`, `[favorite]`);
 *   il click fa il lavoro (e il «mi piace» conferma con un toast) ma non cambia lo stato da sé, e una volta acceso non fa più niente. Il valore che `action` restituisce è ignorato.
 * - **interruttore** (`[toggle]="true"`, opt-in): il click accende e spegne. `action(prossimo)` riceve lo stato che si chiede; dopo un'azione riuscita il componente passa da sé
 *   al nuovo stato (e segue comunque ogni cambio da fuori); se risponde `false` il cambio è rifiutato e lo stato resta com'è.
 */
@Directive()
export abstract class BaseToggleActionComponent extends BaseActionComponent {
    /** Il lavoro da fare. Sync o async; un'eccezione mostra l'errore di serie e lascia lo stato com'è. Chi non guarda l'argomento (`() => …`) funziona come sempre. */
    readonly action = input.required<(next: boolean) => void | boolean | Promise<void | boolean>>();
    /** `true` = interruttore (si accende e si spegne); `false` = permanente. */
    readonly toggle = input(false);
    /** `icon` = solo il glifo; `button` = bottone con bordo e label. Di serie quello del componente concreto. */
    readonly variant = input<'icon' | 'button' | null>(null);
    /** Nome accessibile da acceso quando si può spegnere (già tradotto o chiave); senza, quello di serie («Togli…»). */
    readonly activeLabel = input<string>();
    readonly disabled = input(false);
    /** Fuori dal Tab (negli elenchi). */
    readonly tabbable = input(true);

    protected abstract readonly defaultVariant: 'icon' | 'button';
    /** Lo stato che arriva da fuori (`[liked]` o `[favorite]`). */
    protected abstract externalState(): boolean;
    /** I testi: da spento, da acceso in modo permanente, da acceso quando si può spegnere. */
    protected abstract readonly labelKeys: { off: string; onPermanent: string; onToggle: string };
    /** Un evento dopo un cambio riuscito (un toast, per il «mi piace»). */
    protected afterChange(_next: boolean): void { /* niente di serie */ }

    protected readonly state = linkedSignal(() => this.externalState());
    protected readonly shape = computed(() => this.variant() ?? this.defaultVariant);

    override readonly displayLabel = computed(() => {
        const k = this.labelKeys;
        if (!this.state()) return this.translate.translate(this.label() ?? k.off);
        if (this.toggle() && this.activeLabel()) return this.translate.translate(this.activeLabel() as string);
        return this.translate.translate(this.toggle() ? k.onToggle : k.onPermanent);
    });

    /** La label da spento, per chi mostra anche il nome dell'azione che si sta per fare. */
    protected readonly offLabel = computed(() => this.translate.translate(this.label() ?? this.labelKeys.off));

    protected onToggle(): void {
        // Permanente e già acceso: il click non fa più niente (resta acceso, come registrato).
        if (this.state() && !this.toggle()) return;
        const next = !this.state();
        void this.run(async () => {
            const result = await this.action()(next);
            // Permanente: come sempre, il lavoro e basta (lo stato lo cambia chi usa il componente, il valore restituito non conta).
            if (!this.toggle()) { this.afterChange(next); return; }
            if (result === false) return;
            this.state.set(next);
            this.afterChange(next);
        });
    }
}
