namespace Backend.Models.Configuration;

/// <summary>Lingue del sito (codici a due lettere + default), bound da <c>global-settings.json</c> § <c>Localization</c>. <c>EngineCultures</c> arricchisce questi codici in <see cref="System.Globalization.CultureInfo"/>, separatamente.</summary>
public class LocalizationOptions
{
    /// <summary>Lingua predefinita dell'applicazione (codice ISO 639-1, es. "it").</summary>
    public string DefaultLanguage { get; set; } = "it";

    /// <summary>Lingue supportate (ISO 639-1, es. ["it", "en"]). Default vuoto di proposito: il binder .NET APPENDE al default, un default non vuoto duplicherebbe le voci del config invece di sostituirle.</summary>
    public string[] SupportedLanguages { get; set; } = [];
}
