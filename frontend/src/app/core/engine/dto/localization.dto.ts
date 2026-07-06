/**
 * Una lingua supportata col nome nativo (es. `{ code: "it", name: "Italiano" }`). Il nome lo deriva
 * il frontend via `Intl.DisplayNames`: nessun round-trip al backend per la localizzazione.
 */
export interface LanguageOption {
    code: string;
    name: string;
}
