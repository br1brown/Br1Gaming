using System.Security.Cryptography;
using System.Text;

namespace Backend.Gallery;

/// <summary>
/// Firma HMAC delle generazioni: il backend firma ogni testo che produce, e la galleria accetta
/// in salvataggio solo testi con firma valida. Così nella lista pubblica finiscono unicamente
/// output genuini del generatore, non testo arbitrario inviato a mano.
/// </summary>
/// <remarks>
/// La chiave si legge da <c>Custom:GallerySignKey</c> (config di progetto). Se assente si genera una
/// chiave casuale per-processo: basta perché generazione e salvataggio avvengono nello stesso ciclo
/// di vita del server. Valorizzare la chiave in config rende le firme stabili tra riavvii/istanze.
/// </remarks>
public sealed class GallerySigner
{
    private readonly byte[] _key;

    /// <summary>Inizializza il firmatario con la chiave da config (o una casuale per-processo).</summary>
    /// <param name="config">Configurazione applicativa (sezione <c>Custom</c>).</param>
    public GallerySigner(IConfiguration config)
    {
        var configured = config["Custom:GallerySignKey"];
        _key = !string.IsNullOrWhiteSpace(configured)
            ? Encoding.UTF8.GetBytes(configured)
            : RandomNumberGenerator.GetBytes(32);
    }

    /// <summary>Firma la coppia (slug, markdown) e restituisce la firma in base64url.</summary>
    public string Sign(string slug, string markdown)
    {
        using var hmac = new HMACSHA256(_key);
        var mac = hmac.ComputeHash(Encoding.UTF8.GetBytes(slug + "\n" + markdown));
        return Convert.ToBase64String(mac).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    /// <summary>Verifica una firma in tempo costante.</summary>
    public bool Verify(string slug, string markdown, string? sig)
    {
        var expected = Encoding.UTF8.GetBytes(Sign(slug, markdown));
        var actual = Encoding.UTF8.GetBytes(sig ?? string.Empty);
        return expected.Length == actual.Length && CryptographicOperations.FixedTimeEquals(expected, actual);
    }
}
