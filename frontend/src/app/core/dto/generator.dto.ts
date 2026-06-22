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
}
