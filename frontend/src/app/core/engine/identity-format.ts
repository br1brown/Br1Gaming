import type { Address, OpeningInterval } from './dto/identity.dto';
import { DAY_ORDER } from './dto/identity.dto';
import type { LocalizationService } from './services/localization.service';

/** Formattazione pura dei campi `Identity`, estratta da `identity-render.component.ts` perché ha
 *  un secondo consumer (`footer-content.ts`): un solo posto per "come si formatta un indirizzo/una
 *  valuta", così il blocco automatico e quello dichiarato a mano in `nav.ts` restano allineati. */

export function hasText(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/** Orario "HH:mm" (24h). Difesa contro valori sporchi (sorgente esterna/CMS) prima di renderli o di
 *  mapparli su JSON-LD — stessa regex per `app-opening-hours` (tabella settimanale) e
 *  `page-meta.service.ts` (`OpeningHoursSpecification` che Google legge dal rich result "Orari"): un
 *  valore che passa il controllo in un posto deve passarlo anche nell'altro, altrimenti footer e
 *  JSON-LD mostrano orari diversi per lo stesso dato senza che nessuno dei due se ne accorga. */
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function isHm(value: unknown): value is string {
    return typeof value === 'string' && HM_RE.test(value);
}

/** True se una singola fascia oraria è valida (giorno noto, apertura/chiusura in formato "HH:mm") —
 *  la STESSA decisione che sia `app-opening-hours` (tabella/accordion) sia `page-meta.service.ts`
 *  (JSON-LD) devono prendere per lo stesso intervallo, quindi presa qui una sola volta. */
export function isValidOpeningInterval(it: OpeningInterval | null | undefined): it is OpeningInterval {
    return !!it && DAY_ORDER.includes(it.day) && isHm(it.opens) && isHm(it.closes);
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
