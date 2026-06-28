namespace Backend.Store;

/// <summary>
/// Definisce il contratto di accesso ai contenuti persistenti del sito.
/// </summary>
/// <remarks>
/// L'obiettivo dell'interfaccia e' isolare il resto del backend dal tipo di storage usato:
/// i controller e i servizi dipendono soltanto da questo contratto.
/// L'identità del sito non passa di qui: è un sottosistema dell'Engine (<c>IIdentityStore</c>).
/// </remarks>
public interface IContentStore
{
    /// <summary>
    /// Recupera i link ai social network configurati per il sito (galleria demo).
    /// </summary>
    /// <param name="cancellationToken">
    /// Token legato alla richiesta HTTP: interrompe la lettura se il client abbandona la chiamata.
    /// </param>
    /// <returns>
    /// Una mappa in cui la chiave rappresenta il nome logico del social e il valore l'URL finale da esporre.
    /// </returns>
    Task<Dictionary<string, string>> GetSocialAsync(CancellationToken cancellationToken = default);
}
