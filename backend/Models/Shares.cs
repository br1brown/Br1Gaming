namespace Backend.Models;

/// <summary>Una generazione condivisa (raccolta pubblica dei condivisi).</summary>
/// <param name="Id">Id content-addressed (hash del testo): generazioni identiche condividono lo stesso id.</param>
/// <param name="Slug">Slug del generatore che l'ha prodotta.</param>
/// <param name="Text">Testo della generazione senza formattazione (per copia/voce/immagine).</param>
/// <param name="Markdown">Testo della generazione in Markdown (per la resa a schermo).</param>
/// <param name="Score">Peso/rarità della generazione.</param>
/// <param name="CreatedUtc">Istante di prima condivisione.</param>
public sealed record ShareEntry(string Id, string Slug, string Text, string Markdown, double Score, DateTimeOffset CreatedUtc);

/// <summary>Body per condividere una generazione: Markdown, punteggio e firma HMAC rilasciata alla generazione.</summary>
public sealed record ShareSaveRequest(string Markdown, double Score, string Sig);

/// <summary>Esito della condivisione: id con cui recuperare/ricondividere la generazione.</summary>
public sealed record ShareSaveResult(string Id);

/// <summary>
/// Risposta della generazione: i tre formati di <see cref="GenerationResult"/> più la firma
/// necessaria a condividere la generazione (solo gli output veri sono condivisibili).
/// </summary>
public sealed record GenerationResultDto(string Text, string Markdown, double Score, string Sig);
