using System.Globalization;
using Backend.Models.Configuration;

namespace Backend.Engine.Localization;

/// <summary>Arricchisce i codici lingua dichiarati in <c>Localization.SupportedLanguages</c> nelle <see cref="CultureInfo"/> tipizzate che alimentano <c>UseRequestLocalization</c>.</summary>
public static class EngineCultures
{
    /// <summary>Cultura dal codice lingua (es. <c>"it"</c>). Lancia su codice non valido (errore di configurazione, fail-fast).</summary>
    public static CultureInfo Parse(string code) => CultureInfo.GetCultureInfo(code);

    /// <summary>Culture supportate, dai codici di <paramref name="options"/>.</summary>
    public static IReadOnlyList<CultureInfo> Supported(LocalizationOptions options) =>
        options.SupportedLanguages.Select(Parse).ToArray();

    /// <summary>Cultura di default, dal codice di <paramref name="options"/>.</summary>
    public static CultureInfo Default(LocalizationOptions options) => Parse(options.DefaultLanguage);
}
