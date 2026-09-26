// Modulo foglia, senza import: legal-pages lo legge al caricamento e non deve entrare nel ciclo di footer-content.
/** L'engine possiede per intero la forma di `Identity`: `FooterField` la rende utilizzabile dal resolver del footer (`nav.ts`) senza che il progetto conosca chiave i18n o forma esatta — `g.addField(FooterField.PartitaIva)` pesca, formatta e nasconde se non valorizzato. Fuori da qui: social (`addSocialLink`, sempre espliciti) e contenuto libero (`addText`). */
export enum FooterField {
    RagioneSociale,
    PartitaIva,
    CodiceFiscale,
    /** P.IVA e Codice Fiscale, un campo solo: se coincidono (caso comune, ditta individuale) una
     *  riga sola "Codice Fiscale / P.IVA", altrimenti le due righe separate. Alternativa ad usare `PartitaIva`/`CodiceFiscale` separati: la scelta
     *  è del progetto, non c'è una combinazione "giusta" a priori. */
    PartitaIvaCodiceFiscale,
    RegistroImprese,
    NumeroRea,
    CodiceSdi,
    CapitaleSociale,
    CapitaleVersato,
    SocioUnico,
    InLiquidazione,
    SedeLegale,
    Telefono,
    Email,
    Pec,
    RappresentanteLegale,
    TitolareDelTrattamento,
    ResponsabileProtezioneDati,
    OpeningHours,
}
