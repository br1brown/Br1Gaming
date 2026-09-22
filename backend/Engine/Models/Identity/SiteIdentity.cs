using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Backend.Models.Identity;

/// <summary>Identità del sito (dati legali, contatti, social): sorgente unica di footer, pagine legali e JSON-LD SEO.</summary>
public class SiteIdentity
{
    /// <summary>Natura del brand per il JSON-LD: false (default) = Organization, true = Person.</summary>
    public bool Personal { get; set; }

    /// <summary>Sottotipo schema.org se il brand è un'attività fisica (es. "Restaurant"); ha precedenza su <see cref="Personal"/>. Stringa libera, non enum: i sottotipi LocalBusiness sono 150+ e in evoluzione.</summary>
    public string? BusinessType { get; set; }

    /// <summary>Ragione sociale o denominazione completa dell'organizzazione.</summary>
    public string? RagioneSociale { get; set; }

    /// <summary>Partita IVA dell'organizzazione.</summary>
    public string? PartitaIva { get; set; }

    /// <summary>Codice fiscale dell'organizzazione, se distinto dalla partita IVA.</summary>
    public string? CodiceFiscale { get; set; }

    /// <summary>Indirizzo della sede legale.</summary>
    public Address? SedeLegale { get; set; }

    /// <summary>Sede operativa/fisica aperta al pubblico se diversa dalla <see cref="SedeLegale"/>; assente ⇒ si ripiega su quella.</summary>
    public Address? SedeOperativa { get; set; }

    /// <summary>Recapiti generali dell'organizzazione.</summary>
    public ContactInfo? Contatti { get; set; }

    /// <summary>Dati societari aggiuntivi richiesti nelle pagine istituzionali.</summary>
    public CompanyDetails? DatiSocietari { get; set; }

    /// <summary>Profili social del brand: URL nudo, o <c>{ url, name }</c> con etichetta per il footer (localizzabile). Più profili dello stesso social convivono, distinta dalla galleria demo <c>data/social.json</c>.</summary>
    public List<SocialLink>? Social { get; set; }

    /// <summary>Orari come intervalli tipizzati (<see cref="OpeningHoursInterval"/>): più voci sullo stesso giorno = più fasce, nessuna voce = chiuso.</summary>
    public List<OpeningHoursInterval>? OpeningHours { get; set; }

    /// <summary>Valuta ISO 4217 (es. EUR) dei valori monetari; omessa ⇒ il frontend usa EUR di default.</summary>
    public string? Currency { get; set; }

    /// <summary>Rappresentante legale (amministratore unico, legale rappresentante…), reso dal footer/pagine legali.</summary>
    public string? RappresentanteLegale { get; set; }

    /// <summary>Titolare del trattamento GDPR (art. 4.7), solo se diverso da <see cref="RappresentanteLegale"/>. Nessun fallback: assente ⇒ null, il frontend mostra solo l'identità generale.</summary>
    public LegalRole? TitolareDelTrattamento { get; set; }

    /// <summary>DPO (GDPR art. 37), solo se designato. Nessun fallback: assente ⇒ null, il frontend nasconde la riga.</summary>
    public LegalRole? ResponsabileProtezioneDati { get; set; }

    /// <summary>Metadati custom non resi dall'identità: contenitore generico per il progetto (dati noti → campi dedicati; JSON-LD → <see cref="Extra"/>).</summary>
    public Dictionary<string, string>? MetadatiAggiuntivi { get; set; }

    /// <summary>Proprietà schema.org fuse per ultime (quindi vincenti) nel nodo entità brand del JSON-LD — via per cambiare <c>@type</c> in un sottotipo. Riservati all'Engine solo <c>@context</c>/<c>@id</c>.</summary>
    public Dictionary<string, object>? Extra { get; set; }
}

/// <summary>Un indirizzo postale.</summary>
public class Address
{
    /// <summary>Nome della via o piazza.</summary>
    public string? Via { get; set; }

    /// <summary>Numero civico dell'indirizzo.</summary>
    public string? Civico { get; set; }

    /// <summary>CAP o codice postale.</summary>
    public string? Cap { get; set; }

    /// <summary>Città della sede.</summary>
    public string? Citta { get; set; }

    /// <summary>Provincia o area amministrativa equivalente.</summary>
    public string? Provincia { get; set; }

    /// <summary>Codice ISO 3166-1 alpha-2 (es. "IT"), non il nome esteso — validato dallo store.</summary>
    public string? Nazione { get; set; }
}

/// <summary>I principali canali di contatto dell'organizzazione.</summary>
public class ContactInfo
{
    /// <summary>Numero di telefono principale: un solo numero (diventa link <c>tel:</c> nel footer), validato dallo store.</summary>
    public string? Telefono { get; set; }

    /// <summary>Indirizzo email ordinario, validato dallo store.</summary>
    public string? Email { get; set; }

    /// <summary>Indirizzo PEC, validato come <see cref="Email"/>.</summary>
    public string? Pec { get; set; }
}

/// <summary>Una carica/ruolo legale con nome e contatto email dedicati (es. titolare del trattamento, DPO).</summary>
public class LegalRole
{
    /// <summary>Nome della persona o denominazione dell'ente che ricopre la carica.</summary>
    public string? Nome { get; set; }

    /// <summary>Email dedicata alla carica, distinta dai <see cref="ContactInfo"/> generali.</summary>
    public string? Email { get; set; }
}

/// <summary>Dati societari e amministrativi aggiuntivi dell'organizzazione.</summary>
public class CompanyDetails
{
    /// <summary>Numero o riferimento del registro imprese.</summary>
    public string? RegistroImprese { get; set; }

    /// <summary>Numero REA dell'azienda.</summary>
    public string? NumeroRea { get; set; }

    /// <summary>Capitale sociale dichiarato.</summary>
    public decimal? CapitaleSociale { get; set; }

    /// <summary>Se il capitale sociale risulta interamente versato.</summary>
    public bool? CapitaleInteramenteVersato { get; set; }

    /// <summary>Se la società ha un socio unico.</summary>
    public bool? IsSocioUnico { get; set; }

    /// <summary>Se la società è in liquidazione.</summary>
    public bool? InLiquidazione { get; set; }

    /// <summary>Codice SDI per la fatturazione elettronica.</summary>
    public string? CodiceSdi { get; set; }
}

/// <summary>Un profilo social del brand: URL con etichetta opzionale per il footer. Normalizzato da <see cref="SocialLinkJsonConverter"/> (stringa nuda o oggetto in ingresso, sempre oggetto in uscita).</summary>
[JsonConverter(typeof(SocialLinkJsonConverter))]
public class SocialLink
{
    /// <summary>URL del profilo: sorgente dell'icona (regex) e del <c>sameAs</c> JSON-LD.</summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>Etichetta opzionale nel footer; assente ⇒ nome del social dedotto dall'URL. Localizzabile.</summary>
    public string? Name { get; set; }
}

/// <summary>Legge un <see cref="SocialLink"/> da stringa nuda o oggetto <c>{ url, name }</c>; valida l'URL (assoluto http/https) e lancia in fail-fast se mancante o non valido.</summary>
public sealed class SocialLinkJsonConverter : JsonConverter<SocialLink>
{
    /// <summary>Intercetta anche i token null (altrimenti System.Text.Json li gestirebbe da sé, bypassando il converter): una voce social nulla è malformata.</summary>
    public override bool HandleNull => true;

    /// <inheritdoc />
    public override SocialLink Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.String:
                return new SocialLink { Url = RequireSocialUrl(reader.GetString()) };
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
                return new SocialLink { Url = RequireSocialUrl(url), Name = string.IsNullOrWhiteSpace(name) ? null : name };
            default:
                // null, numero, array…: una voce 'social' non è né stringa né oggetto ⇒ dato malformato.
                throw new JsonException(
                    $"identity.json: voce 'social' non valida (atteso un URL come stringa o un oggetto {{ url, name }}, trovato {reader.TokenType}).");
        }
    }

    /// <summary>URL trimmato se assoluto http/https valido, altrimenti lancia (fail-fast): valida con <see cref="Uri.TryCreate(string, UriKind, out Uri)"/>, esclude javascript:/file:/relativi.</summary>
    private static string RequireSocialUrl(string? raw)
    {
        var s = raw?.Trim();
        if (string.IsNullOrEmpty(s))
            throw new JsonException("identity.json: voce 'social' con URL mancante.");
        if (!(Uri.TryCreate(s, UriKind.Absolute, out var uri)
              && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)))
            throw new JsonException($"identity.json: URL social non valido (atteso http/https assoluto): '{s}'.");
        return s;
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

/// <summary>Una fascia oraria: giorno e orari tipizzati (<see cref="DayOfWeek"/> + <see cref="TimeOnly"/>), leggibili sul filo JSON grazie ai converter.</summary>
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

/// <summary>Converter <see cref="TimeOnly"/> ↔ stringa "HH:mm" (accetta anche "HH:mm:ss" in lettura); valore non valido lancia.</summary>
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
