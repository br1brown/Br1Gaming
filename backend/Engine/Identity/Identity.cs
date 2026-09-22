using System.Globalization;
using System.Linq;
using System.Net.Mail;
using System.Text.Json;
using Backend.Engine;
using Backend.Models;
using Backend.Models.Configuration;
using Backend.Models.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Backend.Identity;

/// <summary>Seam per la sorgente dell'identità del sito: il default file-based basta nella maggior parte dei casi, un progetto con dati in DB/API registra la propria implementazione in DI.</summary>
public interface IIdentityStore
{
    /// <summary>Identità del sito nella lingua richiesta, o null se non configurata.</summary>
    Task<SiteIdentity?> GetIdentityAsync(string language, CancellationToken cancellationToken = default);
}

/// <summary>Implementazione di default di <see cref="IIdentityStore"/>: legge <c>data/identity.json</c>; file assente ⇒ null (non un errore).</summary>
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

            // Fail-fast sui dati presenti-ma-malformati (identity.json è config committata): un campo
            // assente resta assente, solo un valore presente e sbagliato lancia (risale a GET /identity,
            // 500 loggato). Gli URL social li valida già SocialLinkJsonConverter in deserialize.
            if (identity?.Contatti is { } contatti)
            {
                contatti.Email = ValidEmail(contatti.Email);
                contatti.Pec = ValidEmail(contatti.Pec);
                contatti.Telefono = ValidPhone(contatti.Telefono);
            }
            if (identity?.SedeLegale is { } sedeLegale)
                sedeLegale.Nazione = ValidCountry(sedeLegale.Nazione);
            if (identity?.SedeOperativa is { } sedeOperativa)
                sedeOperativa.Nazione = ValidCountry(sedeOperativa.Nazione);
            if (identity is not null)
                identity.Currency = ValidCurrency(identity.Currency);
            if (identity?.TitolareDelTrattamento is { } titolare)
                titolare.Email = ValidEmail(titolare.Email);
            if (identity?.ResponsabileProtezioneDati is { } dpo)
                dpo.Email = ValidEmail(dpo.Email);

            // JsonStringEnumConverter accetta stringhe numeriche ("8") senza validare il range: un
            // giorno impossibile scivolerebbe come (DayOfWeek)8 (i nomi errati li coglie già lui).
            if (identity?.OpeningHours is { } hours)
                foreach (var h in hours)
                    if (!Enum.IsDefined(h.Day))
                        throw new JsonException(
                            $"identity.json: giorno orari non valido: '{(int)h.Day}' (atteso un giorno della settimana, es. \"Monday\").");
        }
        catch (NotFoundException)
        {
            // Non è un errore: il compose hook sotto può comunque costruire l'identità da altre fonti.
        }

        return await ComposeIdentityAsync(identity, language, cancellationToken);
    }

    /// <summary>Punto di estensione (default: passthrough) per fondere nel modello letto da file parti prese da altre fonti, senza reimplementare la lettura.</summary>
    protected virtual Task<SiteIdentity?> ComposeIdentityAsync(SiteIdentity? identity, string language, CancellationToken cancellationToken)
        => Task.FromResult(identity);

    /// <summary>Email trimmata se ben formata (<see cref="MailAddress"/>); assente ⇒ null, malformata ⇒ lancia (fail-fast).</summary>
    protected static string? ValidEmail(string? raw)
    {
        var s = raw?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        if (!MailAddress.TryCreate(s, out _))
            throw new JsonException($"identity.json: email/PEC malformata: '{s}'.");
        return s;
    }

    /// <summary>Paese se codice ISO 3166-1 alpha-2 valido (<see cref="RegionInfo"/>); assente ⇒ null, non valido (es. "Italia") ⇒ lancia.</summary>
    protected static string? ValidCountry(string? raw)
    {
        var s = raw?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        try { _ = new RegionInfo(s); }
        catch (ArgumentException)
        {
            throw new JsonException(
                $"identity.json: 'nazione' non è un codice ISO 3166-1 alpha-2 valido: '{s}'. Usa il codice (es. \"IT\"), non il nome.");
        }
        return s;
    }

    /// <summary>Insieme dei codici valuta ISO 4217 noti al framework, ricavati da
    /// <see cref="RegionInfo.ISOCurrencySymbol"/> su tutte le culture specifiche (nessuna lista a mano).</summary>
    private static readonly HashSet<string> IsoCurrencies = CultureInfo
        .GetCultures(CultureTypes.SpecificCultures)
        .Select(c => { try { return new RegionInfo(c.Name).ISOCurrencySymbol; } catch { return null; } })
        .Where(x => !string.IsNullOrEmpty(x))
        .Select(x => x!)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    /// <summary>Valuta canonica (uppercase) se codice ISO 4217 noto; assente ⇒ null, non valido (es. "Euro") ⇒ lancia invece di ripiegare in silenzio su EUR.</summary>
    protected static string? ValidCurrency(string? raw)
    {
        var s = raw?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        if (!IsoCurrencies.Contains(s))
            throw new JsonException(
                $"identity.json: 'currency' non è un codice ISO 4217 valido: '{s}'. Usa il codice (es. \"EUR\"), non il nome.");
        return s.ToUpperInvariant();
    }

    /// <summary>Solo cifre e separatori visivi di un numero (spazi, <c>+ / - . ( )</c>): niente lettere/testo/markup nella stringa resa nel footer.</summary>
    private static readonly System.Text.RegularExpressions.Regex PhoneShape =
        new(@"^[+\d\s/().\-]+$", System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>Ridotto a cifre + eventuale <c>+</c> (la forma dell'href <c>tel:</c>), deve restare UN solo numero E.164-plausibile.</summary>
    private static readonly System.Text.RegularExpressions.Regex SingleNumber =
        new(@"^\+?\d{6,15}$", System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>Numero valido sia come link <c>tel:</c> che come testo (<see cref="PhoneShape"/> + <see cref="SingleNumber"/>); assente ⇒ null, anomalo (testo estraneo, due numeri) ⇒ lancia.</summary>
    protected static string? ValidPhone(string? raw)
    {
        var s = raw?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        if (!PhoneShape.IsMatch(s))
            throw new JsonException(
                $"identity.json: telefono con caratteri non ammessi: '{s}' (solo cifre, spazi, '+' e i separatori / - . ( )).");
        var dial = System.Text.RegularExpressions.Regex.Replace(s, @"[^\d+]", "");
        if (!SingleNumber.IsMatch(dial))
            throw new JsonException(
                $"identity.json: telefono non valido come numero singolo: '{s}' (serve un solo numero; spazi e '/' vanno bene, ma non due numeri).");
        return s;
    }
}

/// <summary>Registrazione DI del sottosistema identità del template.</summary>
public static class IdentityExtensions
{
    /// <summary>Registra la sorgente file-based di default con <c>TryAddSingleton</c>: un progetto figlio può sostituirla registrando la propria <see cref="IIdentityStore"/>.</summary>
    public static IServiceCollection AddTemplateIdentity(this IServiceCollection services)
    {
        services.TryAddSingleton<IIdentityStore, FileIdentityStore>();
        return services;
    }
}
