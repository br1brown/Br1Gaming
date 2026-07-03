/** Un'opzione di una variante (es. un segno zodiacale): solo ciò che serve a UI e API. */
export interface GeneratorVariantOption {
    /** Chiave passata all'API alla generazione (es. 'ariete'). */
    key: string;
    /** Etichetta mostrata all'utente (es. 'Ariete'). */
    label: string;
}

/**
 * La dimensione di scelta che alcuni generatori offrono PRIMA di generare (es. il segno per
 * l'oroscopo). Assente per i generatori normali (un bottone e via).
 */
export interface GeneratorVariant {
    /** Chiave della dimensione (es. 'segno'). */
    key: string;
    /** Etichetta della dimensione (es. 'Segno zodiacale'). */
    label: string;
    /** Le opzioni selezionabili. */
    options: GeneratorVariantOption[];
}

export interface GeneratorInfo {
    slug: string;
    name: string;
    description: string;
    /** Presente solo per i generatori "parametrici": la scelta da fare prima di generare. */
    variant?: GeneratorVariant | null;
}

export interface GenerateResponse {
    text: string;
    markdown: string;
    /**
     * Peso del testo generato (rarità/notabilità): somma, su ogni frase, del punteggio base
     * della frase più il prodotto dei valori degli elementi che ne hanno riempito i segnaposto.
     * Il significato dipende dal generatore (es. quanto è estremo, o quanto è raro un nome).
     * Calcolato dal backend; al momento non mostrato in UI (riservato a usi futuri).
     */
    score: number;
    /**
     * Firma HMAC della generazione rilasciata dal backend. Va rimandata indietro per condividere la
     * generazione: il server accetta solo testi con firma valida (output genuini).
     */
    sig: string;
}

/** Una generazione condivisa nella raccolta pubblica (corrisponde al record C# `ShareEntry`). */
export interface ShareEntry {
    /** Id content-addressed: generazioni identiche condividono lo stesso id. */
    id: string;
    /** Slug del generatore che l'ha prodotta. */
    slug: string;
    /** Testo senza formattazione (copia/voce/immagine). */
    text: string;
    /** Testo in Markdown (resa a schermo). */
    markdown: string;
    /** Peso/rarità della generazione. */
    score: number;
    /** Istante di prima condivisione (ISO 8601). */
    createdUtc: string;
}

/** Esito della condivisione: l'id con cui recuperare/ricondividere la generazione. */
export interface ShareSaveResult {
    id: string;
}

/**
 * Contenuto risolto della pagina generatore (il `<T>` di GeneratorDetailComponent).
 *
 * `result` è valorizzato dal resolver SOLO nel recupero `?g=` (frase condivisa): così la
 * generazione recuperata è già in SSR e il component non la ri-fetcha. Per la generazione
 * NUOVA resta `null` — la produce il client, evitando un re-generate ad ogni cambio lingua.
 */
export interface GeneratorPageContent {
    generator: GeneratorInfo;
    result: GenerateResponse | null;
    recovered: boolean;
}
