namespace Backend.Models;

// ── Snapshot (stateless — nessuna sessione lato server) ──────────────

/// <summary>Scelta proposta al giocatore in uno snapshot di scena.</summary>
/// <param name="Id">Identificatore univoco della scelta nella scena.</param>
/// <param name="Text">Testo mostrato al giocatore.</param>
public record ChoiceSnapshot(string Id, string Text);

/// <summary>
/// Fotografia completa di un passo di gioco: scena corrente, scelte visibili e stato.
/// È l'unica risposta del play — il client la persiste e la rimanda, il server non tiene sessioni.
/// </summary>
/// <param name="StorySlug">Slug della storia a cui appartiene lo snapshot.</param>
/// <param name="StoryTitle">Titolo della storia.</param>
/// <param name="SceneId">Identificatore della scena corrente.</param>
/// <param name="SceneText">Testo della scena, già calcolato per lo stato corrente.</param>
/// <param name="EndingTitle">Titolo del finale, valorizzato solo se <paramref name="IsEnding"/> è true.</param>
/// <param name="EndingImageId">Asset id dell'immagine del finale, o null. Significativo solo se <paramref name="IsEnding"/> è true.</param>
/// <param name="Choices">Scelte visibili per lo stato corrente.</param>
/// <param name="IsEnding">True se la scena è un finale (nessuna scelta).</param>
/// <param name="Consequences">Testo della conseguenza dell'ultima scelta, o null.</param>
/// <param name="ChosenChoiceText">Testo della scelta appena fatta, o null all'avvio/resume.</param>
/// <param name="Stats">Stato di gioco esportato, da rimandare al play successivo.</param>
public record StorySnapshot(
    string StorySlug,
    string StoryTitle,
    string SceneId,
    string SceneText,
    string? EndingTitle,
    string? EndingImageId,
    List<ChoiceSnapshot> Choices,
    bool IsEnding,
    string? Consequences,
    string? ChosenChoiceText,
    Dictionary<string, object> Stats);

// ── DTO esposti dall'API ──────────────────────────────────────────────

/// <summary>Voce di catalogo di una storia.</summary>
/// <param name="Slug">Slug univoco della storia.</param>
/// <param name="Title">Titolo della storia.</param>
/// <param name="Description">Descrizione breve, o null.</param>
public sealed record StorySummaryDto(string Slug, string Title, string? Description);

/// <summary>
/// Body del play: tutti i campi opzionali — nessuno = start, solo SceneId = resume,
/// SceneId + ChoiceId = scelta del giocatore.
/// </summary>
/// <param name="SceneId">Scena corrente del client, o null per iniziare da capo.</param>
/// <param name="ChoiceId">Scelta fatta nella scena corrente, o null.</param>
/// <param name="Stats">Stato di gioco salvato dal client (dall'ultimo <see cref="StorySnapshot.Stats"/>).</param>
public sealed record StoryPlayRequestDto(string? SceneId, string? ChoiceId, Dictionary<string, object>? Stats);

/// <summary>Voce di catalogo di un generatore.</summary>
/// <param name="Slug">Slug univoco del generatore.</param>
/// <param name="Name">Nome visualizzato (fallback: lo slug).</param>
/// <param name="Description">Descrizione breve, o null.</param>
public sealed record GeneratorInfoDto(string Slug, string Name, string? Description);

/// <summary>
/// Prodotto finale di un ciclo di generazione. Il client renderizza il Markdown
/// col pipe `markdown` dell'engine (sanificato): nessuna resa HTML lato server.
/// </summary>
/// <param name="Text">Testo piano, senza formattazione (per speech e condivisione).</param>
/// <param name="Markdown">Testo in Markdown.</param>
/// <param name="Score">
/// Peso del testo (rarità/notabilità): somma, su ogni frase, del punteggio base della frase
/// più il prodotto dei valori degli elementi che ne hanno riempito i segnaposto. Il significato
/// dipende dal generatore (per incel/mbeb quanto è estremo; per i locali quanto è raro un nome).
/// </param>
public sealed record GenerationResult(string Text, string Markdown, double Score);
