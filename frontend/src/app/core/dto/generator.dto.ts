export interface GeneratorInfo {
    slug: string;
    name: string;
    description: string;
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
