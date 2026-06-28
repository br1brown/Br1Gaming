/**
 * Primitivi di localizzazione serviti da GET /localization (derivati dalle culture .NET del backend).
 * Il frontend li consuma per la resa (footer: giorni/valuta) e il selettore lingua, invece di mappare
 * lingue→regione o calcolare i nomi giorno a mano.
 */
export interface SiteLocalization {
    /** Tag BCP-47 specifico della lingua corrente (es. "it-IT"), per le API Intl del frontend. */
    current: string;
    /** Codice a due lettere della lingua di default del sito (es. "it"). */
    default: string;
    /** Nomi giorno abbreviati nella lingua corrente, per codice schema.org Mo..Su (es. { "Mo": "lun" }). */
    dayNames: Record<string, string>;
    /** Lingue supportate col nome nativo, per il selettore lingua. */
    languages: LanguageOption[];
}

/** Una lingua supportata, arricchita dalla cultura: codici a 2/3 lettere + nome nativo
 *  (es. { code: "it", code3: "ita", name: "Italiano" }). */
export interface LanguageOption {
    code: string;
    code3: string;
    name: string;
}
