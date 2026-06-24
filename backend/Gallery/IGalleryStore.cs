using Backend.Models;

namespace Backend.Gallery;

/// <summary>
/// Archivio delle generazioni salvate in galleria. Indicizzato per id content-addressed:
/// salvare due volte la stessa generazione non crea doppioni.
/// </summary>
public interface IGalleryStore
{
    /// <summary>Salva (se nuova) una generazione e restituisce la voce risultante.</summary>
    /// <param name="slug">Slug del generatore di origine.</param>
    /// <param name="text">Testo senza formattazione (per copia/voce/immagine).</param>
    /// <param name="markdown">Testo in Markdown (canonico per l'id content-addressed).</param>
    /// <param name="score">Peso/rarità.</param>
    GalleryEntry Save(string slug, string text, string markdown, double score);

    /// <summary>Recupera una voce per id, o <c>null</c> se assente.</summary>
    GalleryEntry? Get(string id);

    /// <summary>Le voci più recenti, in ordine decrescente di data.</summary>
    /// <param name="limit">Numero massimo di voci.</param>
    /// <param name="slug">Se valorizzato, restringe al solo generatore con quello slug.</param>
    IReadOnlyList<GalleryEntry> GetRecent(int limit, string? slug = null);

    /// <summary>Numero di generazioni salvate per ciascun generatore (slug → conteggio).</summary>
    IReadOnlyDictionary<string, int> Counts();
}
