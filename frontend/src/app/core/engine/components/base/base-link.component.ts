import { Directive, Signal, computed, input } from '@angular/core';

/**
 * Base condivisa dalle famiglie "contatti" e "navigazione": semplici link (`<a href>`) con
 * icona-badge e label opzionale, nessun servizio da iniettare. Centralizza gli input comuni
 * (label/showLabel/fullWidth); il concreto fornisce href/glyph/color/displayLabel e delega il
 * rendering a `LinkBadgeComponent`.
 */
@Directive({
    host: {
        '[class.d-inline-block]': '!fullWidth()',
        '[class.d-block]': 'fullWidth()',
    },
})
export abstract class BaseLinkComponent {
    /** Chiave i18n (o stringa letterale) per label e aria-label. */
    readonly label = input<string>();
    /** Mostra la label testuale accanto all'icona. */
    readonly showLabel = input(false);
    /**
     * Mostra il CONTENUTO (numero, email, handle…) invece dell'etichetta — es. "xxx@pec.it" al posto
     * di "PEC" (accessibilità: leggi il dato senza cliccare). Implica testo visibile anche con `showLabel` false.
     */
    readonly showValue = input(false);
    /** Occupa tutta la larghezza del contenitore. */
    readonly fullWidth = input(false);

    /**
     * Override opzionale: se fornita, al click esegue questa funzione invece di navigare (es. modale
     * mail). L'`href` resta come fallback per no-JS, click destro e "copia indirizzo link".
     */
    readonly action = input<() => void | Promise<void>>();

    /** URL risolto da aprire. */
    abstract readonly href: Signal<string>;
    /** Classi FontAwesome del glifo (es. "fa-brands fa-whatsapp"). */
    abstract readonly glyph: Signal<string>;
    /** Colore brand della pastiglia (null = default del tema). */
    abstract readonly color: Signal<string | null>;
    /** Label tradotta/derivata (es. "PEC"), usata anche come tooltip/aria. */
    abstract readonly displayLabel: Signal<string>;
    /** Contenuto leggibile (es. "xxx@pec.it", "+39…", handle). */
    abstract readonly content: Signal<string>;

    /**
     * Testo mostrato accanto all'icona, in base alle due flag:
     *  - solo `showLabel`            → "Etichetta"
     *  - solo `showValue`            → "valore"
     *  - entrambe                    → "Etichetta: valore" (disambigua, es. PEC vs email)
     */
    readonly displayText: Signal<string> = computed(() => {
        const label = this.displayLabel();
        if (!this.showValue()) return label;
        const value = this.content();
        if (!value) return label;
        return this.showLabel() ? `${label}: ${value}` : value;
    });
    /** Se mostrare del testo accanto all'icona (label e/o contenuto). */
    readonly showText: Signal<boolean> = computed(() => this.showLabel() || this.showValue());
}
