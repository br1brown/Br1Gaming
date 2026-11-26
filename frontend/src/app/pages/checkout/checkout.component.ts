import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { PageBaseComponent } from '../../core/engine/pages/page-base.component';
import { TranslatePipe } from '../../core/engine/pipes/translate.pipe';
import { FieldErrorDirective } from '../../core/engine/directives/field-error.directive';
import { FieldErrorComponent } from '../../core/engine/components/field-error/field-error.component';
import { ErrorSummaryComponent } from '../../core/engine/components/error-summary/error-summary.component';
import { BusyIconComponent } from '../../core/engine/components/busy-icon/busy-icon.component';
import { showFormErrors, type FieldErrorItem } from '../../core/engine/components/error-summary/form-errors';
import { requiredTrimmed } from '../../core/engine/components/field-error/form-validators';
import { DEFAULT_NOTE_ICON, type CheckoutItem, type CheckoutRequest } from '../../core/dto/checkout.dto';
import { PrintActionComponent } from '../../core/engine/components/print-action/print-action.component';
import { DownloadActionComponent } from '../../core/engine/components/download-action/download-action.component';
import { buildReceiptHtml, type ReceiptView } from '../../core/services/checkout-receipt';
import { nextPaint } from '../../core/engine/scroll';

const digitsOf = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

/** Numero di carta: da 13 a 19 cifre, spazi ammessi. Niente Luhn: la pagina non verifica niente di vero. */
const cardNumber = (c: AbstractControl): ValidationErrors | null => {
    const n = digitsOf(c.value).length;
    return !c.value || (n >= 13 && n <= 19) ? null : { cardNumber: true };
};

/** Scadenza `MM/AA` (`cardExpiry`), non già passata (`cardExpired`). */
const cardExpiry = (c: AbstractControl): ValidationErrors | null => {
    if (!c.value) return null;
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(c.value));
    if (!m) return { cardExpiry: true };
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    const now = new Date();
    const expired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
    if (month < 1 || month > 12) return { cardExpiry: true };
    return expired ? { cardExpired: true } : null;
};

const digitsBetween = (code: string, min: number, max: number) => (c: AbstractControl): ValidationErrors | null => {
    const n = digitsOf(c.value).length;
    return !c.value || (/^\d+$/.test(String(c.value)) && n >= min && n <= max) ? null : { [code]: true };
};

/**
 * Checkout condiviso: una pagina di pagamento finta e generica. Venditore, voci di costo ed esito li
 * decide chi manda l'utente qui (`vdc` nell'URL, vedi `CheckoutRequest`); il campo di ogni dato di carta
 * ha l'`autocomplete` giusto, come in un checkout vero. **Non salva e non invia niente**: i valori
 * stanno solo nel form, che si svuota subito dopo il «pagamento».
 */
@Component({
    selector: 'app-checkout',
    standalone: true,
    imports: [ReactiveFormsModule, TranslatePipe, FieldErrorDirective, FieldErrorComponent, ErrorSummaryComponent, BusyIconComponent, PrintActionComponent, DownloadActionComponent],
    templateUrl: './checkout.component.html',
    styleUrl: './checkout.component.scss',
})
export class CheckoutComponent extends PageBaseComponent<CheckoutRequest> {
    private readonly fb = inject(FormBuilder);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly location = inject(Location);

    protected readonly busy = signal(false);
    protected readonly errori = signal<FieldErrorItem[]>([]);

    /** Ricevuta emessa dopo il pagamento: sostituisce il modulo. Non contiene dati di carta, che non si conservano. */
    protected readonly ricevuta = signal<ReceiptView | null>(null);
    private readonly boxRicevuta = viewChild<ElementRef<HTMLElement>>('boxRicevuta');

    protected readonly form = this.fb.nonNullable.group({
        nome: ['', [requiredTrimmed]],
        numero: ['', [requiredTrimmed, cardNumber]],
        scadenza: ['', [requiredTrimmed, cardExpiry]],
        codice: ['', [requiredTrimmed, digitsBetween('cardCode', 3, 4)]],
        pin: ['', [requiredTrimmed, digitsBetween('cardPin', 4, 6)]],
    });

    /** Imponibile, IVA e totale. Si calcola in centesimi interi (niente errori di virgola mobile) e l'IVA si
     *  arrotonda una volta sola, sulla somma delle voci: è la voce che la pagina aggiunge in fondo. */
    protected readonly riepilogo = computed(() => {
        const c = this.pageContent();
        if (!c) return null;
        const imponibile = c.items.reduce((sum, i) => sum + Math.round(i.amount * 100), 0);
        const aliquota = c.vatRate ?? 0;
        const iva = aliquota > 0 ? Math.round(imponibile * aliquota / 100) : 0;
        return { aliquota, iva: iva / 100, totale: (imponibile + iva) / 100 };
    });

    /** Totale (voci + IVA), formattato nella valuta e nella lingua correnti. */
    protected readonly totale = computed(() => this.formatAmount(this.riepilogo()?.totale ?? 0));

    /** Icona della nota di una voce: quella scelta dal dato, un'icona informativa se non ne sceglie. */
    protected noteIcon(item: CheckoutItem): string {
        return item.noteIcon ?? DEFAULT_NOTE_ICON;
    }

    protected formatAmount(amount: number): string {
        const currency = this.pageContent()?.currency ?? 'EUR';
        return new Intl.NumberFormat(this.translate.currentLang(), { style: 'currency', currency }).format(amount);
    }

    /** Numero a gruppi di quattro mentre si scrive, come fanno i checkout veri. */
    protected formatNumero(event: Event): void {
        const el = event.target as HTMLInputElement;
        const formatted = digitsOf(el.value).slice(0, 19).replace(/(.{4})(?=.)/g, '$1 ');
        this.form.controls.numero.setValue(formatted);
    }

    /** Scadenza con la barra inserita da sé dopo il mese. */
    protected formatScadenza(event: Event): void {
        const el = event.target as HTMLInputElement;
        const d = digitsOf(el.value).slice(0, 4);
        this.form.controls.scadenza.setValue(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
    }

    protected async paga(): Promise<void> {
        const request = this.pageContent();
        if (!request || this.busy()) return;
        this.errori.set(await showFormErrors(this.form, this.host.nativeElement));
        if (!this.form.valid) return;

        this.busy.set(true);
        // «Sembra vero»: una breve attesa di elaborazione, come un pagamento che parte davvero.
        await new Promise<void>(resolve => setTimeout(resolve, 1400));
        // I dati di carta non si tengono un istante di più del necessario.
        this.form.reset();
        this.errori.set([]);
        this.busy.set(false);

        // La ricevuta porta l'istante del pagamento, non quello in cui si chiude l'alert.
        const ricevuta = this.emettiRicevuta(request);
        const { title, message, confirmLabel } = request.outcome;
        await this.notify.alert(title, message, { icon: 'success', confirmText: confirmLabel, allowOutsideClick: false });
        this.ricevuta.set(ricevuta);
        // La ricevuta prende il posto del modulo ed è in cima alla pagina: si torna lì, col focus sulla ricevuta.
        // In cima e non «fino alla ricevuta»: l'alert che si chiude sposta ancora l'impaginazione per un istante.
        await nextPaint();
        globalThis.scrollTo?.({ top: 0 });
        this.boxRicevuta()?.nativeElement.focus({ preventScroll: true });
    }

    /** Ricevuta del pagamento appena fatto, con gli importi già formattati (la pagina e il file scaricato mostrano lo stesso). */
    private emettiRicevuta(request: CheckoutRequest): ReceiptView {
        const r = this.riepilogo()!;
        const lang = this.translate.currentLang();
        const t = (key: string, ...args: unknown[]) => this.translate.translate(key, ...args);
        const now = new Date();
        const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const suffix = crypto.getRandomValues(new Uint16Array(1))[0].toString(16).toUpperCase().padStart(4, '0');
        return {
            lang,
            merchant: request.merchant,
            labels: { ricevuta: t('checkoutRicevuta'), numero: t('checkoutNumero'), data: t('checkoutData'), totale: t('checkoutTotale'), pagato: t('checkoutPagato') },
            numero: `R-${ymd}-${suffix}`,
            data: new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeStyle: 'short' }).format(now),
            righe: request.items.map(i => ({
                label: i.label,
                ...(i.note && { note: i.note, icon: this.noteIcon(i) }),
                importo: this.formatAmount(i.amount),
            })),
            ...(r.aliquota > 0 && { iva: { label: t('checkoutIva', r.aliquota), importo: this.formatAmount(r.iva) } }),
            totale: this.formatAmount(r.totale),
            ...(request.receiptNote && { nota: request.receiptNote }),
        };
    }

    /** Il file della ricevuta: un HTML autonomo, che si apre ovunque e si può stampare in PDF. */
    protected readonly scaricaHtml = (): Blob => new Blob([buildReceiptHtml(this.ricevuta()!)], { type: 'text/html;charset=utf-8' });
    protected readonly nomeFile = computed(() => `ricevuta-${this.ricevuta()?.numero ?? 'pagamento'}.html`);

    protected torna(): void {
        this.location.back();
    }
}
