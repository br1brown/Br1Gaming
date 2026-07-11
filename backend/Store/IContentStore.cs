namespace Backend.Store;

/// <summary>
/// Contratto d'accesso ai contenuti persistenti: isola il backend dal tipo di storage (controller e
/// servizi dipendono solo da qui). L'identità del sito è un altro sottosistema (<c>IIdentityStore</c>).
/// </summary>
public interface IContentStore
{
    /// <summary>Recupera i link ai social configurati (galleria demo): mappa nome logico → URL.</summary>
    Task<Dictionary<string, string>> GetSocialAsync(CancellationToken cancellationToken = default);
}
