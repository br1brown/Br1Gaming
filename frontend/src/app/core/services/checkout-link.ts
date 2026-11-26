import type { CheckoutItem, CheckoutOutcome, CheckoutRequest, FaIcon } from '../dto/checkout.dto';

/** Nome del query param che porta i dati della pagina `/checkout`. */
export const CHECKOUT_QUERY_PARAM = 'vdc';

/** Limiti di quello che si accetta dall'URL: il parametro lo può scrivere chiunque, quindi la pagina
 *  rifiuta tutto ciò che non ha la forma attesa (e mostra solo testo, mai HTML). */
const MAX_ENCODED = 4000;
const MAX_ITEMS = 20;
const MAX_TEXT = 300;

/** `CheckoutRequest` → stringa per l'URL (JSON UTF-8 in base64url, sicura da mettere in una query). */
export function encodeCheckout(request: CheckoutRequest): string {
    const bytes = new TextEncoder().encode(JSON.stringify(request));
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Stringa dell'URL → `CheckoutRequest`, oppure `null` se manca, non si legge o non ha la forma giusta. */
export function decodeCheckout(vdc: string | null | undefined): CheckoutRequest | null {
    if (!vdc || vdc.length > MAX_ENCODED || !/^[A-Za-z0-9_-]+$/.test(vdc)) return null;
    try {
        const binary = atob(vdc.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        return validate(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    } catch {
        return null;
    }
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT;

function validateOutcome(v: unknown): CheckoutOutcome | null {
    const o = v as Partial<CheckoutOutcome> | null;
    return o && isText(o.title) && isText(o.message) && isText(o.confirmLabel)
        ? { title: o.title, message: o.message, confirmLabel: o.confirmLabel }
        : null;
}

function validate(v: unknown): CheckoutRequest | null {
    const r = v as Partial<CheckoutRequest> | null;
    if (!r || typeof r !== 'object' || !isText(r.merchant) || !isText(r.title) || !isText(r.payLabel)) return null;
    if (typeof r.currency !== 'string' || !/^[A-Z]{3}$/.test(r.currency)) return null;
    try { new Intl.NumberFormat('it', { style: 'currency', currency: r.currency }); } catch { return null; }
    if (r.vatRate !== undefined && (typeof r.vatRate !== 'number' || !Number.isFinite(r.vatRate) || r.vatRate < 0 || r.vatRate > 100)) return null;
    if (!Array.isArray(r.items) || r.items.length === 0 || r.items.length > MAX_ITEMS) return null;
    const items: CheckoutItem[] = [];
    for (const i of r.items as Partial<CheckoutItem>[]) {
        if (!i || !isText(i.label) || typeof i.amount !== 'number' || !Number.isFinite(i.amount) || i.amount < 0 || i.amount > 1e7) return null;
        if (i.note !== undefined && !isText(i.note)) return null;
        if (i.noteIcon !== undefined && typeof i.noteIcon !== 'string') return null;
        items.push({
            label: i.label, amount: i.amount,
            ...(i.note !== undefined && { note: i.note }),
            ...(i.noteIcon !== undefined && { noteIcon: i.noteIcon as FaIcon }),
        });
    }
    if (r.receiptNote !== undefined && !isText(r.receiptNote)) return null;
    const outcome = validateOutcome(r.outcome);
    return outcome ? { merchant: r.merchant, title: r.title, items, currency: r.currency, ...(r.vatRate !== undefined && { vatRate: r.vatRate }), payLabel: r.payLabel, outcome, ...(r.receiptNote !== undefined && { receiptNote: r.receiptNote }) } : null;
}
