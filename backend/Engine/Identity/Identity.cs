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

            // Fail-fast sui dati presenti-ma-malformati. identity.json è config committata: un valore
            // sbagliato è un errore da correggere, non da inghiottire in silenzio. Un campo *assente*
            // resta assente (l'identità è tutta opzionale): rompe solo il dato presente e non valido.
            // Gli URL social li valida (e in caso lancia) il SocialLinkJsonConverter già in deserialize;
            // qui restano i campi validati dopo, con le primitive del framework. L'eccezione risale a
            // GET /identity (500 loggato) e il sito resta su: footer/JSON-LD si nascondono da sé.
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

            // Giorno degli orari fuori range. Il JsonStringEnumConverter accetta le stringhe numeriche
            // ("8") mappandole all'intero sottostante senza validare il range: un giorno impossibile
            // scivolerebbe dentro come (DayOfWeek)8 (i nomi errati tipo "Lunedì" li coglie già lui). Qui
            // lo intercettiamo — coerente col fail-fast: un orario su un giorno inesistente è un errore.
            if (identity?.OpeningHours is { } hours)
                foreach (var h in hours)
                    if (!Enum.IsDefined(h.Day))
                        throw new JsonException(
                            $"identity.json: giorno orari non valido: '{(int)h.Day}' (atteso un giorno della settimana, es. \"Monday\").");
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
    /// Restituisce l'email (trimmata) se ben formata secondo <see cref="MailAddress"/> (primitiva del
    /// framework). Assente (null/vuoto) ⇒ <c>null</c> (campo omesso, legittimo). Presente ma malformata
    /// ⇒ **lancia** <see cref="JsonException"/>: <c>identity.json</c> è config committata, un dato
    /// sbagliato è un errore da correggere (fail-fast), non da scartare in silenzio.
    /// </summary>
    protected static string? ValidEmail(string? raw)
    {
        var s = raw?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        if (!MailAddress.TryCreate(s, out _))
            throw new JsonException($"identity.json: email/PEC malformata: '{s}'.");
        return s;
    }

    /// <summary>
    /// Restituisce il paese (trimmato) se è un codice ISO 3166-1 alpha-2 valido, validato con
    /// <see cref="RegionInfo"/> (primitiva del framework, gemello lato server di <c>Intl.DisplayNames</c>).
    /// Assente ⇒ <c>null</c> (omesso); presente ma non un codice valido ⇒ **lancia**: niente tolleranza
    /// sul testo libero legacy (<c>"Italia"</c> non è un codice, va scritto <c>"IT"</c>).
    /// </summary>
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

    /// <summary>
    /// Restituisce la valuta in maiuscolo canonico se è un codice ISO 4217 noto, validato con la primitiva
    /// del framework (<see cref="RegionInfo.ISOCurrencySymbol"/>) — è il gemello di <see cref="ValidCountry"/>
    /// per il paese. Assente ⇒ <c>null</c> (il frontend usa <c>EUR</c> come default dichiarato); presente ma
    /// non un codice valido ⇒ **lancia** (<c>"Euro"</c>/<c>"XYZ"</c> non sono codici). Toglie il degrado
    /// silenzioso: prima una valuta sbagliata veniva resa in EUR senza alcun segnale.
    /// </summary>
    protected static string? ValidCurrency(string? raw)
    {
        var s = raw?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        if (!IsoCurrencies.Contains(s))
            throw new JsonException(
                $"identity.json: 'currency' non è un codice ISO 4217 valido: '{s}'. Usa il codice (es. \"EUR\"), non il nome.");
        return s.ToUpperInvariant();
    }

    /// <summary>Forma ammessa per l'intera stringa telefono: **solo** cifre e separatori visivi di un
    /// numero (spazi, <c>+ / - . ( )</c>). Niente lettere, testo o markup — la stringa viene conservata
    /// e resa nel footer, quindi non deve contenere altro che il numero e la sua formattazione.</summary>
    private static readonly System.Text.RegularExpressions.Regex PhoneShape =
        new(@"^[+\d\s/().\-]+$", System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>Il numero, ridotto a cifre + eventuale <c>+</c> (la forma con cui il footer costruisce
    /// l'href <c>tel:</c>), deve essere UN solo numero E.164-plausibile: un singolo <c>+</c> iniziale e
    /// 6–15 cifre.</summary>
    private static readonly System.Text.RegularExpressions.Regex SingleNumber =
        new(@"^\+?\d{6,15}$", System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>
    /// Verifica che il telefono sia **un solo numero**, sanificato alla fonte. Nel footer diventa un link
    /// <c>tel:</c> cliccabile (che non può puntare a due numeri) **e** un testo visibile: due controlli.
    /// (1) L'intera stringa deve avere solo cifre e separatori visivi (<see cref="PhoneShape"/>): niente
    /// lettere/testo/markup che verrebbero conservati e resi. (2) Ridotta a cifre + <c>+</c> — la forma
    /// con cui <c>ContactUrl.phone</c> costruisce l'href — deve restare un unico numero E.164-plausibile
    /// (<see cref="SingleNumber"/>). Così **spazi, <c>/</c>, trattini, punti e parentesi in un numero solo
    /// restano validi** (a differenza del vecchio <c>PhoneAttribute</c>, che rifiutava <c>06/1234567</c>),
    /// mentre **due numeri** (troppe cifre), un **secondo <c>+</c>** o qualunque **testo estraneo** vengono
    /// colti. Assente ⇒ <c>null</c> (omesso); presente ma non conforme ⇒ **lancia**. Conserva la stringa
    /// originale (la formattazione leggibile è per la resa). Difesa a più strati: anche il footer sanifica
    /// (href ridotto alle sole cifre + sanitizer di Angular sul binding <c>[href]</c>, testo escapato in
    /// interpolazione), ma qui il dato entra già pulito.
    /// </summary>
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
