namespace Backend.Models;

/// <summary>Voce di costo di un ordine.</summary>
/// <param name="Label">Descrizione della voce (già tradotta).</param>
/// <param name="Amount">Importo (imponibile) nella valuta del checkout; totale e IVA li calcola la pagina.</param>
/// <param name="Note">Annotazione facoltativa sotto la voce (es. una detrazione fiscale): compare solo sulle voci che la portano.</param>
/// <param name="NoteIcon">Icona Font Awesome della nota, come classe (es. <c>fa-solid fa-notes-medical</c>); assente = un'icona informativa di serie. Ha senso solo con una <paramref name="Note"/>.</param>
public sealed record CheckoutItem(string Label, decimal Amount, string? Note = null, string? NoteIcon = null);

/// <summary>Messaggio finale di un pagamento: titolo, testo e etichetta del pulsante di chiusura.</summary>
public sealed record CheckoutOutcome(string Title, string Message, string ConfirmLabel);

/// <summary>
/// Dati di una pagina di checkout, generici: chi manda l'utente a <c>/checkout</c> li serializza nel
/// parametro <c>vdc</c> (vedi <c>core/services/checkout-link.ts</c> nel frontend). Nessun dato di pagamento
/// ci passa: la pagina non invia né salva quello che si digita.
/// </summary>
/// <param name="Merchant">Chi vende, mostrato in testata.</param>
/// <param name="Title">Titolo del riepilogo (es. «Riepilogo ordine»).</param>
/// <param name="Items">Voci di costo, nell'ordine in cui vanno mostrate.</param>
/// <param name="Currency">Codice ISO 4217 della valuta (es. <c>EUR</c>).</param>
/// <param name="VatRate">Aliquota IVA in percentuale (es. <c>22</c>), da 0 a 100. Se c'è e supera 0, la pagina aggiunge in fondo la voce IVA sulla somma delle voci e la include nel totale; assente = nessuna IVA.</param>
/// <param name="PayLabel">Testo del pulsante di pagamento.</param>
/// <param name="Outcome">Cosa dire quando si preme il pulsante di pagamento.</param>
/// <param name="ReceiptNote">Frase in fondo alla ricevuta emessa dopo il pagamento (facoltativa).</param>
public sealed record CheckoutRequestDto(
    string Merchant,
    string Title,
    IReadOnlyList<CheckoutItem> Items,
    string Currency,
    decimal? VatRate,
    string PayLabel,
    CheckoutOutcome Outcome,
    string? ReceiptNote = null);
