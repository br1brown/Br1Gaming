namespace Backend.Models.Configuration;

/// <summary>
/// Carrier DI delle lingue del sito (codici a due lettere + default), alimentato in
/// <c>Program.cs</c> dalla sorgente di verità tipizzata <c>EngineCultures</c> — **non** più da
/// <c>global-settings.json</c>. Resta come forma comoda per gli store i18n che iniettano
/// <c>IOptions&lt;LocalizationOptions&gt;</c>.
/// </summary>
public class LocalizationOptions
{
    /// <summary>Lingua predefinita dell'applicazione (codice ISO 639-1, es. "it").</summary>
    public string DefaultLanguage { get; set; } = "it";

    /// <summary>
    /// Elenco delle lingue supportate (codici ISO 639-1, es. ["it", "en"]).
    /// </summary>
    /// <remarks>
    /// Default **vuoto** di proposito: il binder di config .NET *appende* l'array bound al valore
    /// iniziale della proprietà, quindi un default non vuoto si sommerebbe a quanto dichiarato in
    /// <c>global-settings.json</c> (es. default <c>["it","en"]</c> + config <c>["it","en"]</c> ⇒ 4
    /// voci duplicate). Con il default vuoto il config **sostituisce** pulito.
    /// </remarks>
    public string[] SupportedLanguages { get; set; } = [];
}
