import { Validation } from '../../../core/engine/services/validation';

/**
 * Funzioni pure che costruiscono gli URL dei canali di contatto/navigazione. Rispecchiano i formati
 * di `QrCodeService.builders` (stesso link nel QR e nei bottoni) e normalizzano il numero via
 * `Validation.phone`, stessa regola del backend.
 */

/** Tiene solo cifre (per `wa.me`, che vuole prefisso+numero senza `+` né separatori). */
function digitsOnly(phone: string): string {
    return Validation.phone.toDial(phone).replace(/\+/g, '');
}

export const ContactUrl = {
    /** mailto: con subject/body opzionali. */
    mail: (to: string, subject = '', body = ''): string => {
        const params = new URLSearchParams();
        if (subject) params.set('subject', subject);
        if (body) params.set('body', body);
        const query = params.toString();
        return `mailto:${to.trim()}${query ? '?' + query : ''}`;
    },

    /** tel: nella forma dialabile condivisa (cifre + eventuale `+`), separatori rimossi. */
    phone: (number: string): string => `tel:${Validation.phone.toDial(number)}`,

    /** https://wa.me/<cifre> con testo precompilato opzionale. */
    whatsapp: (phone: string, text = ''): string =>
        `https://wa.me/${digitsOnly(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`,

    /** https://t.me/<handle> (rimuove la @ iniziale). */
    telegram: (handle: string): string =>
        `https://t.me/${handle.trim().replace(/^@/, '')}`,
} as const;
