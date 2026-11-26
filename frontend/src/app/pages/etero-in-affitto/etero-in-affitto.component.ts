import { Component, DOCUMENT, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { PageDirective } from '../../core/engine/directives/page.directive';
import { PageType } from '../../site';
import { encodeCheckout, CHECKOUT_QUERY_PARAM } from '../../core/services/checkout-link';
import type { AlertDialog, LandingPage, LandingSection, PressureSection, PricingPlan } from '../../core/dto/landing.dto';

/**
 * Landing parodia «EteroInAffitto». Non contiene testo: tutto (titolo, sezioni, prezzi, checkout dei
 * piani) arriva dal backend in un'unica chiamata, già nella lingua giusta — vedi `LandingPage`.
 * Qui si fa solo l'`@switch` sul tipo di sezione: un piano a pagamento è un link al checkout
 * condiviso, un piano gratuito apre un alert.
 */
@Component({
    selector: 'app-etero-in-affitto',
    standalone: true,
    imports: [PageDirective],
    templateUrl: './etero-in-affitto.component.html',
    styleUrl: './etero-in-affitto.component.scss',
})
export class EteroInAffittoComponent extends PageBaseComponent<LandingPage> {
    protected readonly PageType = PageType;
    protected readonly sections = computed<LandingSection[]>(() => this.pageContent()?.sections ?? []);

    /** Query del link al checkout, per piano: `/checkout?vdc=<dati del piano serializzati>`. */
    protected readonly checkoutQuery = computed<Record<string, Record<string, string>>>(() => {
        const query: Record<string, Record<string, string>> = {};
        for (const section of this.sections()) {
            if (section.type !== 'pricing') continue;
            for (const plan of section.plans) {
                if (plan.checkout) query[plan.id] = { [CHECKOUT_QUERY_PARAM]: encodeCheckout(plan.checkout) };
            }
        }
        return query;
    });

    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly document = inject(DOCUMENT);

    /** Alert aperto da questa pagina in questo momento: SweetAlert mostra un popup alla volta e un nuovo `fire()`
     *  sostituisce quello aperto, quindi nulla di automatico (uscita, acquisti) parte finché c'è un dialogo. */
    private dialogOpen = false;

    // ── Pressione sul visitatore (parodia): tutta la configurazione arriva dal JSON ──
    protected readonly pressure = computed<PressureSection | undefined>(
        () => this.sections().find((s): s is PressureSection => s.type === 'pressure'));

    /** Secondi mancanti del conto alla rovescia. Parte dallo stesso valore in SSR e nel browser (niente
     *  differenze all'idratazione) e scorre solo nel browser. */
    private readonly remaining = signal(0);
    protected readonly countdownText = computed(() => {
        const c = this.pressure()?.countdown;
        if (!c) return null;
        const r = this.remaining() || c.minutes * 60;
        const mm = String(Math.floor(r / 60)).padStart(2, '0');
        const ss = String(r % 60).padStart(2, '0');
        return c.text.replace('{0}', `${mm}:${ss}`);
    });

    /** Spettatori per piano: si parte dal minimo (uguale in SSR e browser) e poi oscillano. */
    private readonly viewers = signal<Record<string, number>>({});
    protected viewersText(plan: PricingPlan): string | null {
        const v = plan.viewers;
        return v ? v.text.replace('{0}', String(this.viewers()[plan.id] ?? v.min)) : null;
    }

    constructor() {
        super();
        effect(onCleanup => {
            const pressure = this.pressure();
            if (!this.isBrowser || !pressure) return;
            onCleanup(this.runPressure(pressure));
        });
    }

    /** Avvia i comportamenti della pressione e restituisce chi li ferma (timer e ascoltatori) alla chiusura della pagina. */
    private runPressure(pressure: PressureSection): () => void {
        const stops: (() => void)[] = [];

        const countdown = pressure.countdown;
        if (countdown) {
            const total = countdown.minutes * 60;
            this.remaining.set(total);
            const id = setInterval(() => this.remaining.update(r => (r <= 1 ? total : r - 1)), 1000);
            stops.push(() => clearInterval(id));
        }

        const withViewers = this.sections().flatMap(s => s.type === 'pricing' ? s.plans : []).filter(p => p.viewers);
        if (withViewers.length) {
            const id = setInterval(() => this.viewers.update(current => {
                const next = { ...current };
                for (const plan of withViewers) {
                    const { min, max } = plan.viewers!;
                    const now = next[plan.id] ?? min;
                    next[plan.id] = Math.min(max, Math.max(min, now + Math.floor(Math.random() * 3) - 1));
                }
                return next;
            }), 4000);
            stops.push(() => clearInterval(id));
        }

        // Uscita: una sola volta, solo con un puntatore preciso (desktop), quando il mouse lascia la finestra dall'alto.
        const exit = pressure.exit;
        if (exit && typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches) {
            let shown = false;
            const onOut = (e: MouseEvent) => {
                if (shown || this.dialogOpen || e.relatedTarget !== null || e.clientY > 0) return;
                shown = true;
                void this.showAlert(exit);
            };
            this.document.addEventListener('mouseout', onOut);
            stops.push(() => this.document.removeEventListener('mouseout', onOut));
        }

        // Acquisti altrui: uno ogni tot secondi, un numero limitato di volte, mai sopra un dialogo né a scheda nascosta.
        const purchases = pressure.purchases;
        if (purchases) {
            let count = 0;
            const id = setInterval(() => {
                if (count >= purchases.max) { clearInterval(id); return; }
                if (this.dialogOpen || this.document.hidden) return;
                this.notify.toast(purchases.messages[count % purchases.messages.length], 'info', { position: 'bottom-right', durationMs: 4500 });
                count++;
            }, purchases.intervalSeconds * 1000);
            stops.push(() => clearInterval(id));
        }

        return () => stops.forEach(stop => stop());
    }

    /** Alert con un solo pulsante di conferma; un clic fuori non lo chiude. */
    protected async showAlert(dialog: AlertDialog): Promise<void> {
        this.dialogOpen = true;
        try {
            await this.notify.alert(dialog.title, dialog.message, { confirmText: dialog.confirmLabel, allowOutsideClick: false });
        } finally {
            this.dialogOpen = false;
        }
    }

    /** Pulsante di un piano gratuito. */
    protected async openPlan(plan: PricingPlan): Promise<void> {
        if (plan.dialog) await this.showAlert(plan.dialog);
    }
}
