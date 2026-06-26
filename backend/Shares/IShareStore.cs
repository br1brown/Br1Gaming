using Backend.Models;

namespace Backend.Shares;

/// <summary>
/// Archivio delle generazioni condivise. Indicizzato per id content-addressed:
/// condividere due volte la stessa generazione non crea doppioni.
/// </summary>
public interface IShareStore
{
    /// <summary>Salva (se nuova) una generazione condivisa e restituisce la voce risultante.</summary>
    /// <param name="slug">Slug del generatore di origine.</param>
    /// <param name="text">Testo senza formattazione (per copia/voce/immagine).</param>
    /// <param name="markdown">Testo in Markdown (canonico per l'id content-addressed).</param>
    /// <param name="score">Peso/rarità.</param>
    ShareEntry Save(string slug, string text, string markdown, double score);

    /// <summary>Recupera una voce per id, o <c>null</c> se assente.</summary>
    ShareEntry? Get(string id);

    /// <summary>Le voci più recenti, in ordine decrescente di data.</summary>
    /// <param name="limit">Numero massimo di voci.</param>
    /// <param name="slug">Se valorizzato, restringe al solo generatore con quello slug.</param>
    IReadOnlyList<ShareEntry> GetRecent(int limit, string? slug = null);

    /// <summary>Numero di generazioni condivise per ciascun generatore (slug → conteggio).</summary>
    IReadOnlyDictionary<string, int> Counts();
}
