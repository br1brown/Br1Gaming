using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Backend.Models.Identity;

/// <summary>
/// Identità del sito: dati legali/anagrafici, contatti, profili social e natura del brand.
/// È la sorgente unica consumata da footer, pagine legali e dati strutturati SEO (JSON-LD).
/// </summary>
/// <remarks>
/// Tutti i campi sono opzionali: un sito personale/portfolio valorizza <see cref="Personal"/> e
/// omette il blocco legale; una vetrina può esporre solo i social. Il livello frontend tratta
/// l'intero modello come nullable — identità assente ⇒ footer/social/JSON-LD si nascondono da soli.
/// </remarks>
public class SiteIdentity
{
    /// <summary>
    /// Natura del brand per il JSON-LD: <c>false</c> (default) = <c>Organization</c>,
    /// <c>true</c> = <c>Person</c> (sito personale/portfolio). Decide il <c>@type</c> dell'entità
    /// pubblisher di WebSite/WebPage.
    /// </summary>
    public bool Personal { get; set; }

    /// <summary>
    /// Ragione sociale o denominazione completa dell'organizzazione.
    /// </summary>
    public string? RagioneSociale { get; set; }

    /// <summary>
    /// Partita IVA dell'organizzazione.
    /// </summary>
    public string? PartitaIva { get; set; }

    /// <summary>
    /// Codice fiscale dell'organizzazione, se distinto dalla partita IVA.
    /// </summary>
    public string? CodiceFiscale { get; set; }

    /// <summary>
    /// Indirizzo della sede legale.
    /// </summary>
    public Address? SedeLegale { get; set; }

    /// <summary>
    /// Recapiti generali dell'organizzazione.
    /// </summary>
    public ContactInfo? Contatti { get; set; }

    /// <summary>
    /// Dati societari aggiuntivi richiesti nelle pagine istituzionali.
    /// </summary>
    public CompanyDetails? DatiSocietari { get; set; }

    /// <summary>
    /// Profili social ufficiali del brand. Ogni voce è un URL — come **stringa nuda** (caso comune)
    /// oppure come oggetto <c>{ url, name }</c> quando si vuole un'etichetta leggibile accanto
    /// all'icona del footer (es. "Instagram — sede IT" e "Instagram — sede EN" su due profili). Il
    /// <c>name</c> è **solo presentazione del footer** ed è localizzabile (<c>{ "it": …, "en": … }</c>);
    /// l'icona (dedotta dall'URL, regex sui social noti) e il <c>sameAs</c> JSON-LD usano solo l'URL,
    /// quindi più profili dello stesso social convivono. Distinti dalla galleria social demo
    /// (<c>data/social.json</c>, mappa nome→URL): qui stanno i profili reali.
    /// </summary>
    public List<SocialLink>? Social { get; set; }

    /// <summary>
    /// Orari di apertura/contatto come **lista di intervalli tipizzati** (<see cref="OpeningHoursInterval"/>):
    /// ogni voce è <c>{ Day: DayOfWeek, Opens: TimeOnly, Closes: TimeOnly }</c>. Più voci sullo stesso
    /// giorno = più fasce (es. pausa pranzo); un giorno senza voci = chiuso.
    /// </summary>
    /// <remarks>
    /// La superficie per chi sviluppa è **tipizzata col framework**: dichiari <c>DayOfWeek.Tuesday</c> e
    /// <c>TimeOnly</c>, non stringhe magiche. In <c>identity.json</c> si scrive coi nomi enum
    /// (<c>"Tuesday"</c>) e orari <c>"HH:mm"</c>; i cast li fa l'Engine (converter). Dato canonico, non
    /// localizzato: il frontend ne deriva la resa leggibile (raggruppando i giorni con orari identici,
    /// nomi nella lingua corrente) e le <c>OpeningHoursSpecification</c> del JSON-LD — dove
    /// <c>DayOfWeek</c> è già il nome schema.org (<c>schema.org/Tuesday</c>).
    /// </remarks>
    public List<OpeningHoursInterval>? OpeningHours { get; set; }

    /// <summary>
    /// Valuta dei valori monetari dell'organizzazione (es. capitale sociale), in codice ISO 4217
    /// (es. <c>EUR</c>, <c>USD</c>, <c>CHF</c>). È un **fatto** dichiarato, non dedotto dal locale
    /// del visitatore: il frontend formatta gli importi con questa valuta nella lingua corrente.
    /// Omessa ⇒ il frontend ripiega su <c>EUR</c>.
    /// </summary>
    public string? Currency { get; set; }

    /// <summary>
    /// Rappresentante legale dell'entità (amministratore unico, legale rappresentante…): dato **noto e
    /// di rilievo legale**, quindi tipizzato e localizzabile, non pescato da <see cref="MetadatiAggiuntivi"/>
    /// per chiave (una chiave sbagliata lo farebbe sparire in silenzio). Reso dal footer/pagine legali.
    /// </summary>
    public string? RappresentanteLegale { get; set; }

    /// <summary>
    /// Collezione opzionale di metadati custom aggiuntivi. **Non vengono resi** dall'identità (che
    /// mostra solo dati noti/tipizzati): sono un contenitore per consumatori del progetto. Per i dati
    /// noti usa i campi dedicati; per proprietà schema.org del JSON-LD usa <see cref="Extra"/>.
    /// </summary>
    public Dictionary<string, string>? MetadatiAggiuntivi { get; set; }

    /// <summary>
    /// Proprietà schema.org "extra" fuse **così come sono** nel nodo dell'entità brand del JSON-LD.
    /// </summary>
    /// <remarks>
    /// Via di fuga generica: il figlio aggiunge o **sovrascrive** qui campi del nodo entità brand
    /// (es. <c>geo</c>, <c>foundingDate</c>) senza toccare modello né adapter. Si valorizza dal file
    /// <c>identity.json</c> o nella <c>ComposeIdentityAsync</c>. L'extra è fuso **per ultimo**, quindi
    /// vince sui default dell'Engine: è la via per cambiare il <c>@type</c> in un sottotipo
    /// (<c>LocalBusiness</c>, <c>Restaurant</c>, <c>Store</c>…) e portare le proprietà che ne derivano.
    /// Restano riservati all'Engine solo <c>@context</c> e <c>@id</c> (perni del grafo: WebSite/WebPage
    /// referenziano il publisher via <c>@id</c>). La **validità schema.org** dei campi extra è
    /// responsabilità del figlio (l'Engine li serializza e basta).
    /// </remarks>
    public Dictionary<string, object>? Extra { get; set; }
}

/// <summary>
/// Rappresenta un indirizzo postale.
/// </summary>
public class Address
{
    /// <summary>
    /// Nome della via o piazza.
    /// </summary>
    public string? Via { get; set; }

    /// <summary>
    /// Numero civico dell'indirizzo.
    /// </summary>
    public string? Civico { get; set; }

    /// <summary>
    /// CAP o codice postale.
    /// </summary>
    public string? Cap { get; set; }

    /// <summary>
    /// Citta' della sede.
    /// </summary>
    public string? Citta { get; set; }

    /// <summary>
    /// Provincia o area amministrativa equivalente.
    /// </summary>
    public string? Provincia { get; set; }

    /// <summary>
    /// Paese come codice ISO 3166-1 alpha-2 (es. <c>IT</c>, <c>AE</c>). Il frontend ne deriva il nome
    /// localizzato (<c>Intl.DisplayNames</c>); il JSON-LD <c>addressCountry</c> usa il codice.
    /// </summary>
    public string? Nazione { get; set; }
}

/// <summary>
/// Raccoglie i principali canali di contatto dell'organizzazione.
/// </summary>
public class ContactInfo
{
    /// <summary>
    /// Numero di telefono principale. Validato (lascamente) con <see cref="System.ComponentModel.DataAnnotations.PhoneAttribute"/>,
    /// primitiva del framework: garbage evidente scartato. La normalizzazione E.164 servirebbe una libreria terza, fuori scope.
    /// </summary>
    public string? Telefono { get; set; }

    /// <summary>
    /// Indirizzo email ordinario. Validato con <see cref="System.Net.Mail.MailAddress"/> (primitiva del
    /// framework): se malformato viene scartato (non reso, fuori dal ContactPoint JSON-LD).
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// Indirizzo PEC. Validato come <see cref="Email"/>.
    /// </summary>
    public string? Pec { get; set; }
}

/// <summary>
/// Dati societari e amministrativi aggiuntivi dell'organizzazione.
/// </summary>
public class CompanyDetails
{
    /// <summary>
    /// Numero o riferimento del registro imprese.
    /// </summary>
    public string? RegistroImprese { get; set; }

    /// <summary>
    /// Numero REA dell'azienda.
    /// </summary>
    public string? NumeroRea { get; set; }

    /// <summary>
    /// Capitale sociale dichiarato.
    /// </summary>
    public decimal? CapitaleSociale { get; set; }

    /// <summary>
    /// Indica se il capitale sociale risulta interamente versato.
    /// </summary>
    public bool? CapitaleInteramenteVersato { get; set; }

    /// <summary>
    /// Indica se la societa' ha un socio unico.
    /// </summary>
    public bool? IsSocioUnico { get; set; }

    /// <summary>
    /// Indica se la societa' e' in liquidazione.
    /// </summary>
    public bool? InLiquidazione { get; set; }

    /// <summary>
    /// Codice SDI per la fatturazione elettronica.
    /// </summary>
    public string? CodiceSdi { get; set; }
}

/// <summary>
/// Un profilo social del brand: un URL, con un'etichetta opzionale per il footer.
/// </summary>
/// <remarks>
/// In <c>identity.json</c> si scrive come **stringa nuda** (solo URL, caso comune) o come oggetto
/// <c>{ "url": …, "name": … }</c> quando serve un nome leggibile accanto all'icona del footer.
/// <see cref="Name"/> è solo presentazione del footer; il resto del sistema (icona dedotta dall'URL,
/// <c>sameAs</c> JSON-LD) usa solo <see cref="Url"/>. La forma stringa|oggetto la normalizza
/// <see cref="SocialLinkJsonConverter"/>, che in uscita emette sempre l'oggetto.
/// </remarks>
[JsonConverter(typeof(SocialLinkJsonConverter))]
public class SocialLink
{
    /// <summary>URL del profilo: sorgente dell'icona (regex) e del <c>sameAs</c> JSON-LD.</summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>Etichetta opzionale mostrata nel footer accanto all'icona; assente ⇒ il frontend
    /// ripiega sul nome del social dedotto dall'URL. Localizzabile in <c>identity.json</c>.</summary>
    public string? Name { get; set; }
}

/// <summary>
/// Legge un <see cref="SocialLink"/> da una stringa nuda (<c>"https://…"</c> ⇒ solo URL) o da un
/// oggetto <c>{ url, name }</c>; in uscita emette sempre l'oggetto (con <c>name</c> solo se
/// valorizzato), così il frontend vede una forma uniforme. **Valida l'URL** (assoluto http/https via
/// <see cref="Uri"/>): una voce con URL mancante o non valido viene scartata. La risoluzione i18n di
/// <c>name</c> avviene a monte (<c>LocalizedJsonDeserializer</c>): qui <c>name</c> è già una stringa.
/// </summary>
public sealed class SocialLinkJsonConverter : JsonConverter<SocialLink>
{
    /// <inheritdoc />
    public override SocialLink? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.Null:
                return null;
            case JsonTokenType.String:
                var single = ValidSocialUrl(reader.GetString());
                return single is null ? null : new SocialLink { Url = single };
            case JsonTokenType.StartObject:
                string? url = null, name = null;
                while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
                {
                    if (reader.TokenType != JsonTokenType.PropertyName) continue;
                    var prop = reader.GetString();
                    reader.Read();
                    if (string.Equals(prop, "url", StringComparison.OrdinalIgnoreCase)) url = reader.GetString();
                    else if (string.Equals(prop, "name", StringComparison.OrdinalIgnoreCase)) name = reader.GetString();
                    else reader.Skip();
                }
                var validUrl = ValidSocialUrl(url);
                return validUrl is null
                    ? null
                    : new SocialLink { Url = validUrl, Name = string.IsNullOrWhiteSpace(name) ? null : name };
            default:
                reader.Skip();
                return null;
        }
    }

    /// <summary>
    /// Restituisce l'URL (trimmato) se è un **assoluto http/https valido**, altrimenti <c>null</c>
    /// (la voce social viene scartata). Validazione con la primitiva del framework
    /// (<see cref="Uri.TryCreate(string, UriKind, out Uri)"/>), non con una regex a mano: copre
    /// schema, host e forma senza falsi positivi, e tiene fuori `javascript:`/`file:`/relativi.
    /// </summary>
    private static string? ValidSocialUrl(string? raw)
    {
        var s = raw?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        return Uri.TryCreate(s, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? s
            : null;
    }

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, SocialLink value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WriteString("url", value.Url);
        if (!string.IsNullOrWhiteSpace(value.Name))
            writer.WriteString("name", value.Name);
        writer.WriteEndObject();
    }
}

/// <summary>
/// Una fascia oraria di apertura: giorno e orari **tipizzati col framework** (<see cref="DayOfWeek"/> +
/// <see cref="TimeOnly"/>). Chi sviluppa dichiara <c>DayOfWeek.Tuesday</c> / <c>new TimeOnly(9, 0)</c>;
/// il filo JSON resta leggibile (<c>{ "day": "Tuesday", "opens": "09:00", "closes": "18:00" }</c>)
/// grazie ai converter, e il <see cref="Day"/> coincide col nome <c>DayOfWeek</c> di schema.org.
/// </summary>
public sealed class OpeningHoursInterval
{
    /// <summary>Giorno della settimana (enum tipizzato; sul filo è il nome, es. <c>"Tuesday"</c>).</summary>
    public DayOfWeek Day { get; set; }

    /// <summary>Apertura. Tipizzata (<see cref="TimeOnly"/>): un orario impossibile è errore di tipo, non di runtime.</summary>
    [JsonConverter(typeof(HourMinuteTimeOnlyConverter))]
    public TimeOnly Opens { get; set; }

    /// <summary>Chiusura. Vedi <see cref="Opens"/>.</summary>
    [JsonConverter(typeof(HourMinuteTimeOnlyConverter))]
    public TimeOnly Closes { get; set; }
}

/// <summary>
/// Converter <see cref="TimeOnly"/> ↔ stringa <c>"HH:mm"</c>: tiene il fatto leggibile in
/// <c>identity.json</c> (<c>"09:00"</c>) mentre nel modello l'orario è tipizzato. In lettura accetta
/// anche <c>"HH:mm:ss"</c>; un valore non valido lancia (errore di configurazione, fail-fast).
/// </summary>
public sealed class HourMinuteTimeOnlyConverter : JsonConverter<TimeOnly>
{
    private static readonly string[] Formats = ["HH:mm", "H:mm", "HH:mm:ss"];

    /// <inheritdoc />
    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        TimeOnly.ParseExact(reader.GetString() ?? string.Empty, Formats, CultureInfo.InvariantCulture);

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString("HH:mm", CultureInfo.InvariantCulture));
}
