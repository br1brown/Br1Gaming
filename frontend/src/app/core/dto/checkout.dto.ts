/** Dati di una pagina di checkout (allineati a `CheckoutRequestDto` in `backend/Models/Checkout.cs`).
 *  Chi manda l'utente a `/checkout` li serializza con `encodeCheckout` nel parametro `vdc`. */
/** Icona Font Awesome come classe (`fa-solid fa-notes-medical`). */
export type FaIcon = `fa-${'solid' | 'regular' | 'brands'} fa-${string}`;
/** Icona di una nota che non ne sceglie una. */
export const DEFAULT_NOTE_ICON: FaIcon = 'fa-solid fa-circle-info';

export interface CheckoutItem {
    /** Descrizione della voce (già tradotta). */
    label: string;
    /** Importo (imponibile) nella valuta del checkout: totale e IVA li calcola la pagina. */
    amount: number;
    /** Annotazione facoltativa sotto la voce (es. una detrazione fiscale): compare solo sulle voci che la portano. */
    note?: string;
    /** Icona Font Awesome della nota; assente = `DEFAULT_NOTE_ICON`. Ha senso solo con una `note`. */
    noteIcon?: FaIcon;
}

/** Cosa dire quando si preme il pulsante di pagamento. */
export interface CheckoutOutcome {
    title: string;
    message: string;
    confirmLabel: string;
}

export interface CheckoutRequest {
    /** Chi vende, mostrato in testata. */
    merchant: string;
    /** Titolo del riepilogo (es. «Riepilogo ordine»). */
    title: string;
    items: CheckoutItem[];
    /** Codice ISO 4217 (es. `EUR`). */
    currency: string;
    /** Aliquota IVA in percentuale (es. `22`), da 0 a 100. Se supera 0 la pagina aggiunge in fondo la voce IVA
     *  sulla somma delle voci e la include nel totale; assente = nessuna IVA. */
    vatRate?: number;
    /** Testo del pulsante di pagamento. */
    payLabel: string;
    outcome: CheckoutOutcome;
    /** Frase in fondo alla ricevuta emessa dopo il pagamento (facoltativa). */
    receiptNote?: string;
}
