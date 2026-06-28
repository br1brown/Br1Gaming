using System.Globalization;

namespace Backend.Models.Localization;

/// <summary>
/// Primitivi di localizzazione derivati dalle culture .NET, serviti da <c>GET /localization</c>:
/// il frontend li **consuma** invece di rifarseli a mano (niente mappe lingua→regione hardcoded,
/// niente calcolo dei nomi giorno nel componente).
/// </summary>
/// <remarks>
/// <see cref="Current"/> e <see cref="DayNames"/> dipendono dalla cultura della richiesta
/// (Accept-Language risolto da <c>UseRequestLocalization</c>); <see cref="Default"/> e
/// <see cref="Languages"/> sono globali. Tutto deriva dalle <see cref="CultureInfo"/> dichiarate in
/// <c>EngineCultures</c> — la sorgente è il framework, non una config.
/// </remarks>
public sealed class SiteLocalization
{
    /// <summary>Tag BCP-47 *specifico* della lingua corrente (es. <c>it-IT</c>): per le API di formato del frontend (Intl).</summary>
    public string Current { get; set; } = string.Empty;

    /// <summary>Codice a due lettere della lingua di default del sito (es. <c>it</c>).</summary>
    public string Default { get; set; } = string.Empty;

    /// <summary>Nomi giorno abbreviati nella lingua corrente, per nome <see cref="DayOfWeek"/> (es. <c>{ "Monday": "lun" }</c>).</summary>
    public Dictionary<string, string> DayNames { get; set; } = new();

    /// <summary>Lingue supportate con il loro nome nativo, per il selettore lingua del frontend.</summary>
    public List<LanguageOption> Languages { get; set; } = new();

    /// <summary>
    /// Costruisce i primitivi dalla cultura corrente e dall'elenco delle culture supportate.
    /// </summary>
    public static SiteLocalization Build(CultureInfo current, IReadOnlyList<CultureInfo> supported, CultureInfo @default)
    {
        // BCP-47 specifico (con regione) dalla cultura corrente, anche se neutra: it → it-IT.
        var specific = current.IsNeutralCulture ? CultureInfo.CreateSpecificCulture(current.Name) : current;
        var abbreviated = current.DateTimeFormat.AbbreviatedDayNames;

        return new SiteLocalization
        {
            Current = specific.Name,
            Default = @default.TwoLetterISOLanguageName,
            // Chiave = nome DayOfWeek ("Monday"…): stessa forma con cui gli orari dichiarano il giorno,
            // così il frontend fa il lookup diretto. Indice 0=Sunday…6=Saturday di AbbreviatedDayNames.
            DayNames = Enum.GetValues<DayOfWeek>().ToDictionary(d => d.ToString(), d => abbreviated[(int)d]),
            Languages = supported.Select(c => new LanguageOption
            {
                Code = c.TwoLetterISOLanguageName,
                Code3 = c.ThreeLetterISOLanguageName,
                // Nome nativo (ogni lingua nel proprio idioma), con l'iniziale maiuscola secondo la
                // lingua stessa: NativeName è "italiano"/"English", lo normalizziamo a "Italiano".
                Name = Capitalize(c.NativeName, c),
            }).ToList(),
        };
    }

    private static string Capitalize(string value, CultureInfo culture) =>
        string.IsNullOrEmpty(value) ? value : char.ToUpper(value[0], culture) + value[1..];
}

/// <summary>Una lingua supportata, arricchita dalla cultura: codici a 2/3 lettere e nome nativo.</summary>
public sealed class LanguageOption
{
    /// <summary>Codice lingua a due lettere, ISO 639-1 (es. <c>it</c>), passato a <c>setLanguage</c>.</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Codice lingua a tre lettere, ISO 639-2 (es. <c>ita</c>).</summary>
    public string Code3 { get; set; } = string.Empty;

    /// <summary>Nome della lingua nel proprio idioma (es. <c>Italiano</c>, <c>English</c>).</summary>
    public string Name { get; set; } = string.Empty;
}
