/** Facciata unica per la formattazione culture-aware (date, numeri, valuta, nomi regione).
 *  L'implementazione (oggi `Intl`) resta nascosta: domani si può cambiare senza toccare un
 *  chiamante. Il locale arriva da un provider reattivo (`LocalizationService.formatter`), le
 *  stringhe seguono la lingua corrente da sole. */
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

    /** Tempo relativo a `now` ("2 ore fa", "ieri", "in 3 giorni", "adesso") da `Intl.RelativeTimeFormat`
     *  nel locale corrente, `numeric: 'auto'` per le forme parlate ("ieri" invece di "1 giorno fa").
     *  Unità più grande che entra nel delta (anno → mese → giorno → ora → minuto), sotto il minuto
     *  "adesso". Data non valida → stringa vuota. */
    relativeTime(value: Date | string, now: Date = new Date()): string {
        const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
        if (!Number.isFinite(time)) return '';
        const seconds = Math.round((time - now.getTime()) / 1000); // negativo = passato
        const rtf = new Intl.RelativeTimeFormat(this.localeOf(), { numeric: 'auto' });
        const units: [Intl.RelativeTimeFormatUnit, number][] = [
            ['year', 31_536_000], ['month', 2_592_000], ['day', 86_400], ['hour', 3_600], ['minute', 60],
        ];
        for (const [unit, size] of units) {
            if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit);
        }
        return rtf.format(0, 'second');
    }

    /** Nome di regione/paese dal codice ISO 3166-1 alpha-2 (es. 'IT' → "Italia" / "Italy").
     *  Per l'identità il codice è già validato a monte (backend); il fallback "reso com'è" resta solo
     *  come difesa generica del formatter per input non risolvibili da Intl. */
    regionName(code: string): string {
        try {
            return new Intl.DisplayNames([this.localeOf()], { type: 'region' }).of(code) ?? code;
        } catch {
            return code;
        }
    }
}
