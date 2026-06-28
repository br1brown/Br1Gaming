using System.Globalization;
using Backend.Models.Configuration;

namespace Backend.Engine.Localization;

/// <summary>
/// Trasforma i **codici lingua dichiarati** (due lettere, in <c>global-settings.json</c> →
/// <c>Localization</c>, esposti via <see cref="LocalizationOptions"/>) nelle <see cref="CultureInfo"/>
/// **tipizzate** del framework. È la magia "dichiari il noto — i codici — e il framework deriva il
/// resto": da queste culture l'Engine ricava BCP-47, nomi nativi, codici a 2/3 lettere e nomi giorno
/// (vedi <c>GET /localization</c>), e ci alimenta <c>UseRequestLocalization</c>.
/// </summary>
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
