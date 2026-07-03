/**
 * LOCALE FORMATTER
 *
 * Facciata unica per la formattazione culture-aware (date, numeri, valuta, nomi regione). Passi il
 * dato, esce la stringa nel locale corrente: l'implementazione — oggi `Intl`, lo standard di
 * piattaforma — resta NASCOSTA, così domani si può cambiare (altra libreria) senza toccare un solo
 * chiamante. Il locale non è cablato qui: arriva da un provider reattivo (vedi
 * `LocalizationService.formatter`), quindi le stringhe seguono la lingua corrente da sole.
 */
export class LocaleFormatter {
    constructor(private readonly localeOf: () => string) {}

    /** Data. Default: stile lungo (es. "3 luglio 2026" / "July 3, 2026"), fuso UTC per non spostare
     *  le date "solo giorno". Passa `options` per un formato diverso. */
    date(value: Date, options?: Intl.DateTimeFormatOptions): string {
        return new Intl.DateTimeFormat(this.localeOf(), { timeZone: 'UTC', ...(options ?? { dateStyle: 'long' }) }).format(value);
    }

    /** Numero secondo il locale corrente. */
    number(value: number, options?: Intl.NumberFormatOptions): string {
        return new Intl.NumberFormat(this.localeOf(), options).format(value);
    }

    /** Valuta. `currency` = codice ISO 4217 (es. 'EUR'); il locale decide solo il formato.
     *  Lancia su codice valuta non valido: il chiamante decide l'eventuale fallback. */
    currency(value: number, currency: string, options?: Intl.NumberFormatOptions): string {
        return new Intl.NumberFormat(this.localeOf(), { style: 'currency', currency, ...options }).format(value);
    }

    /** Nome di regione/paese dal codice ISO 3166-1 alpha-2 (es. 'IT' → "Italia" / "Italy").
     *  Codice non valido / testo libero → reso com'è. */
    regionName(code: string): string {
        try {
            return new Intl.DisplayNames([this.localeOf()], { type: 'region' }).of(code) ?? code;
        } catch {
            return code;
        }
    }
}
