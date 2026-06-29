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

}
