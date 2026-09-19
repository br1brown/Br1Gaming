import type { Address } from './dto/identity.dto';
import type { LocalizationService } from './services/localization.service';

/**
 * Formattazione pura dei campi `Identity`, estratta da `identity-render.component.ts` perché ora
 * ha un secondo consumer: la risoluzione dei `FooterField` dichiarati nel resolver del footer
 * (`footer-content.ts`). Un solo posto per "come si formatta un indirizzo/una valuta dell'identità",
 * cosicché il blocco automatico (`app-identity-render`) e quello dichiarato a mano in `nav.ts`
 * mostrino sempre lo stesso valore, formattato allo stesso modo.
 */

export function hasText(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/** Tono Bootstrap del badge (suffisso di `text-bg-*`/`border-*`) — condiviso fra `app-identity-render`
 *  e i `FooterField` booleani risolti in `footer-content.ts`: stesso vocabolario di stile in entrambi. */
export type BadgeTone = 'success' | 'secondary' | 'warning' | 'danger' | 'info' | 'primary';

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Nome del paese localizzato dal codice ISO 3166-1 alpha-2 (es. "IT"→"Italia") via `Intl.DisplayNames`.
 * Il backend garantisce il codice ISO valido: qui si formatta e basta.
 */
function countryName(code: string | null | undefined, localization: LocalizationService): string | null {
    const c = code?.trim();
    if (!c) return null;
    return localization.formatter.regionName(c);
}

/** Indirizzo su una riga: "via civico - cap città provincia - paese", ogni segmento presente solo se valorizzato. */
export function formatAddress(address: Address | undefined, localization: LocalizationService): string | null {
    if (!address) return null;

    const streetLine = [address.via, address.civico].filter(isNonEmptyString).join(', ');
    const cityLine = [address.cap, address.citta, address.provincia].filter(isNonEmptyString).join(' ');
    const parts = [streetLine, cityLine, countryName(address.nazione, localization)].filter(isNonEmptyString);

    return parts.length > 0 ? parts.join(' - ') : null;
}

/**
 * Valuta formattata secondo il locale corrente. Valuta = fatto dichiarato dall'identità (già
 * validata ISO 4217 dal backend), il locale decide solo il formato; assente → EUR (default dichiarato).
 * Il `catch` è puramente difensivo, come per `regionName`.
 */
export function formatCurrency(value: number | null | undefined, currency: string | null | undefined, localization: LocalizationService): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const code = (currency ?? '').trim().toUpperCase() || 'EUR';
    try {
        return localization.formatter.currency(value, code);
    } catch {
        return localization.formatter.currency(value, 'EUR');
    }
}
