using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Linq;
using System.Net.Mail;
using Backend.Engine;
using Backend.Models;
using Backend.Models.Configuration;
using Backend.Models.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Backend.Identity;

/// <summary>
/// Contratto di accesso all'identità del sito (dati legali/anagrafici, social, natura del brand).
/// </summary>
/// <remarks>
/// È il seam con cui un progetto figlio sceglie la sorgente dell'identità: il default file-based
/// (<see cref="FileIdentityStore"/>) basta nella maggior parte dei casi (identità = config statica),
/// ma chi tiene questi dati in un DB o dietro un'API esterna registra la propria implementazione in DI.
/// L'identità è la sorgente unica per footer, pagine legali e dati strutturati SEO (JSON-LD).
/// </remarks>
public interface IIdentityStore
{
    /// <summary>
    /// Recupera l'identità del sito nella lingua richiesta, oppure <c>null</c> se non è configurata.
    /// </summary>
    /// <param name="language">Codice lingua per la risoluzione dei campi localizzati (es. <c>it</c>).</param>
    /// <param name="cancellationToken">Token della richiesta HTTP, propagato alla lettura.</param>
    /// <returns>L'identità localizzata, o <c>null</c> se la sorgente non espone dati.</returns>
    Task<SiteIdentity?> GetIdentityAsync(string language, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementazione di default di <see cref="IIdentityStore"/>: legge <c>data/identity.json</c>.
/// </summary>
/// <remarks>
/// File assente ⇒ restituisce <c>null</c> (non un errore): un sito senza identità configurata è
/// legittimo, e il frontend nasconde da sé footer, social e JSON-LD relativi. Riusa la stessa
/// risoluzione i18n e cache in memoria del resto dello store (<see cref="FileUtils"/>).
/// </remarks>
public class FileIdentityStore : IIdentityStore
{
    private readonly string _dataPath;
    private readonly IMemoryCache _cache;
    private readonly HashSet<string> _supportedLanguages;
    private readonly string _defaultLanguage;

    /// <inheritdoc cref="FileIdentityStore"/>
    public FileIdentityStore(IWebHostEnvironment env, IOptions<LocalizationOptions> localizationOptions, IMemoryCache cache)
    {
        _cache = cache;
        _dataPath = Path.Combine(env.ContentRootPath, "data");

        var loc = localizationOptions.Value;
        _supportedLanguages = new HashSet<string>(
            loc.SupportedLanguages.Select(l => CultureInfo.GetCultureInfo(l).TwoLetterISOLanguageName),
            StringComparer.OrdinalIgnoreCase);
        _defaultLanguage = CultureInfo.GetCultureInfo(loc.DefaultLanguage).TwoLetterISOLanguageName;
    }

    /// <inheritdoc />
    public async Task<SiteIdentity?> GetIdentityAsync(string language, CancellationToken cancellationToken = default)
    {
        SiteIdentity? identity = null;
        try
        {
            var json = await FileUtils.ReadStaticFileAsync("identity", _dataPath, _cache, cancellationToken: cancellationToken);
            identity = new FileUtils.LocalizedJsonDeserializer(_defaultLanguage)
                .Deserialize<SiteIdentity>(json, language, _supportedLanguages);

            // Le voci social con URL non valido le scarta il SocialLinkJsonConverter ritornando null:
            // System.Text.Json però le lascia come elementi null nella lista. Le compattiamo qui, così
            // la risposta non porta `null` (il frontend ha comunque la sua difesa, ma la sorgente è pulita).
            if (identity?.Social is { } social)
                identity.Social = social.Where(s => s is not null).ToList();

            // Email/PEC validate con la primitiva del framework (System.Net.Mail.MailAddress), non con
            // una regex a mano: malformate → null (non rese, fuori dal ContactPoint JSON-LD).
            if (identity?.Contatti is { } contatti)
            {
                contatti.Email = ValidEmail(contatti.Email);
                contatti.Pec = ValidEmail(contatti.Pec);
                contatti.Telefono = ValidPhone(contatti.Telefono);
            }
        }
        catch (NotFoundException)
        {
            // Identità non configurata da file: resta null. Non è un errore — il footer/le pagine
            // legali/il JSON-LD nascondono da sé le sezioni; e il compose hook qui sotto può comunque
            // costruirla da altre fonti (caso "tutto da un'API, niente file").
        }

        return await ComposeIdentityAsync(identity, language, cancellationToken);
    }

    /// <summary>
    /// Punto di estensione per comporre l'identità da più sorgenti. Riceve il modello assemblato dal
    /// file (o <c>null</c> se assente) e lo restituisce — **di default invariato** (passthrough).
    /// </summary>
    /// <remarks>
    /// Un progetto figlio sottoclassa <see cref="FileIdentityStore"/> e fa l'override di questo metodo
    /// per fondere nel modello parti prese da altre fonti (es. orari o capitale da un DB/API), senza
    /// reimplementare la lettura del file. Per una sorgente completamente diversa resta l'alternativa
    /// più radicale: registrare una propria <see cref="IIdentityStore"/>.
    /// </remarks>
    protected virtual Task<SiteIdentity?> ComposeIdentityAsync(SiteIdentity? identity, string language, CancellationToken cancellationToken)
        => Task.FromResult(identity);

    /// <summary>
    /// Restituisce l'email (trimmata) se è ben formata secondo <see cref="MailAddress"/> (primitiva
    /// del framework), altrimenti <c>null</c> — il campo non viene reso né finisce nel ContactPoint.
    /// </summary>
    protected static string? ValidEmail(string? raw)
    {
        var s = raw?.Trim();
        return !string.IsNullOrEmpty(s) && MailAddress.TryCreate(s, out _) ? s : null;
    }

    /// <summary>
    /// Validatore telefono del framework (<see cref="PhoneAttribute"/>, DataAnnotations). Volutamente
    /// **lasco** — i formati telefonici variano nel mondo, non c'è un tipo forte come email/URL; cattura
    /// il garbage evidente. La normalizzazione E.164 servirebbe una libreria terza, fuori scope.
    /// </summary>
    private static readonly PhoneAttribute PhoneValidator = new();
    protected static string? ValidPhone(string? raw)
    {
        var s = raw?.Trim();
        return !string.IsNullOrEmpty(s) && PhoneValidator.IsValid(s) ? s : null;
    }
}

/// <summary>
/// Registrazione DI del sottosistema identità del template.
/// </summary>
public static class IdentityExtensions
{
    /// <summary>
    /// Registra la sorgente identità di default (file-based).
    /// </summary>
    /// <remarks>
    /// Usa <c>TryAddSingleton</c>: un progetto figlio può sostituire la sorgente (DB, API esterna)
    /// registrando la propria <see cref="IIdentityStore"/> nel blocco SERVIZI APPLICATIVI, senza
    /// toccare l'Engine. È una via di fuga, non un obbligo: il caso comune resta riempire
    /// <c>data/identity.json</c>.
    /// </remarks>
    public static IServiceCollection AddTemplateIdentity(this IServiceCollection services)
    {
        services.TryAddSingleton<IIdentityStore, FileIdentityStore>();
        return services;
    }
}
