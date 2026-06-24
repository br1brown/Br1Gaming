namespace Backend.Models;

/// <summary>Una generazione salvata nella galleria pubblica.</summary>
/// <param name="Id">Id content-addressed (hash del testo): generazioni identiche condividono lo stesso id.</param>
/// <param name="Slug">Slug del generatore che l'ha prodotta.</param>
/// <param name="Text">Testo della generazione senza formattazione (per copia/voce/immagine).</param>
/// <param name="Markdown">Testo della generazione in Markdown (per la resa a schermo).</param>
/// <param name="Score">Peso/rarità della generazione.</param>
/// <param name="CreatedUtc">Istante di primo salvataggio.</param>
public sealed record GalleryEntry(string Id, string Slug, string Text, string Markdown, double Score, DateTimeOffset CreatedUtc);

/// <summary>Body per salvare una generazione: Markdown, punteggio e firma HMAC rilasciata alla generazione.</summary>
public sealed record GallerySaveRequest(string Markdown, double Score, string Sig);

/// <summary>Esito del salvataggio: id con cui recuperare/condividere la generazione.</summary>
public sealed record GallerySaveResult(string Id);

/// <summary>
/// Risposta della generazione: i tre formati di <see cref="GenerationResult"/> più la firma
/// necessaria a ri-salvare la generazione in galleria (solo gli output veri sono salvabili).
/// </summary>
public sealed record GenerationResultDto(string Text, string Markdown, double Score, string Sig);
