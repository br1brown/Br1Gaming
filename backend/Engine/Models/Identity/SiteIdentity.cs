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
    /// Tipo schema.org dell'entità quando il brand è un'**attività fisica** (es. <c>"Restaurant"</c>,
    /// <c>"Store"</c>, <c>"ProfessionalService"</c>, o il generico <c>"LocalBusiness"</c>). Valorizzato
    /// ⇒ l'entità brand del JSON-LD diventa quel tipo (invece di <c>Organization</c>), con indirizzo e
    /// <c>openingHoursSpecification</c> portati **sul nodo** — i segnali che Google usa per le attività
    /// locali. Ha la precedenza su <see cref="Personal"/>. Omesso ⇒ <c>Organization</c>/<c>Person</c>
    /// come prima.
    /// </summary>
    /// <remarks>
    /// È una **stringa libera, non un enum, di proposito**: i sottotipi di <c>LocalBusiness</c> sono
    /// oltre 150 ed evolvono (un enum sarebbe incompleto e andrebbe a rincorrere schema.org), e siccome
    /// <see cref="Extra"/> può comunque sovrascrivere <c>@type</c> un enum darebbe una coerenza solo
    /// illusoria. Quindi vale come <see cref="Extra"/>/JSON-LD grezzo: la imposti **diretta** (non serve
    /// passare da <see cref="Extra"/>, che resta per le proprietà *in più* come <c>geo</c>/<c>priceRange</c>)
    /// e la validità schema.org è a carico del progetto.
    /// </remarks>
    public string? BusinessType { get; set; }

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
    /// Indirizzo della **sede operativa/fisica** aperta al pubblico, quando diversa dalla
    /// <see cref="SedeLegale"/>. Usata come <c>address</c> dell'entità brand solo quando
    /// <see cref="BusinessType"/> è valorizzato; assente ⇒ si ripiega sulla <see cref="SedeLegale"/>.
    /// </summary>
    public Address? SedeOperativa { get; set; }

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
    /// Validata dallo store con <see cref="System.Globalization.RegionInfo"/> (ISO 4217, gemello della
    /// <c>nazione</c>): assente ⇒ il frontend usa <c>EUR</c> (default dichiarato); presente ma non un
    /// codice valido ⇒ **errore** (niente più degrado silenzioso a EUR di un <c>"Euro"</c>/<c>"XYZ"</c>).
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
    /// localizzato (<c>Intl.DisplayNames</c>); il JSON-LD <c>addressCountry</c> usa il codice. Validato
    /// dallo store con <see cref="System.Globalization.RegionInfo"/> (primitiva del framework): assente ⇒
    /// omesso, presente ma non un codice ISO valido ⇒ **errore** (niente tolleranza sul testo libero:
    /// <c>"Italia"</c> non è un codice, va scritto <c>"IT"</c>).
    /// </summary>
    public string? Nazione { get; set; }
}

/// <summary>
/// Raccoglie i principali canali di contatto dell'organizzazione.
/// </summary>
public class ContactInfo
{
    /// <summary>
    /// Numero di telefono principale. Deve essere **un solo numero**: nel footer diventa un link
    /// <c>tel:</c> cliccabile (non può puntare a due numeri) e un testo visibile. Ammessi **solo** cifre e
    /// separatori visivi (spazi, <c>+ / - . ( )</c>) — niente lettere/testo/markup; ridotto alle sole cifre
    /// + <c>+</c> dev'essere un unico numero E.164-plausibile. **Spazi, <c>/</c>, trattini e parentesi in un
    /// numero solo sono ammessi** (es. <c>06/1234567</c>, <c>+39 06 1234 567</c>); due numeri, un secondo
    /// <c>+</c> o caratteri estranei ⇒ errore. Assente ⇒ omesso.
    /// </summary>
    public string? Telefono { get; set; }

    /// <summary>
    /// Indirizzo email ordinario. Validato con <see cref="System.Net.Mail.MailAddress"/> (primitiva del
    /// framework): assente ⇒ omesso, presente ma malformato ⇒ **errore** (<c>GET /identity</c> 500, non
    /// uno scarto silenzioso).
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
/// <see cref="Uri"/>): una voce presente ma con URL mancante o non valido **lancia**
/// (<see cref="JsonException"/>) — <c>identity.json</c> è config committata, un URL sbagliato è un
/// errore da correggere (fail-fast), non da scartare in silenzio. L'eccezione risale a
/// <c>GET /identity</c> (500 loggato) e il sito resta su, con footer/JSON-LD che si nascondono da sé.
/// La risoluzione i18n di <c>name</c> avviene a monte (<c>LocalizedJsonDeserializer</c>): qui
/// <c>name</c> è già una stringa.
/// </summary>
public sealed class SocialLinkJsonConverter : JsonConverter<SocialLink>
{
    /// <summary>
    /// Forza <see cref="JsonConverter{T}.Read"/> a ricevere anche i token <c>null</c>. Di default
    /// System.Text.Json li gestisce da sé (elemento <c>null</c>) senza chiamare il converter, così un
    /// <c>null</c> nell'array <c>social</c> scivolerebbe dentro in silenzio; intercettandolo finisce nel
    /// ramo <c>default</c> e **lancia** — una voce social nulla è un dato malformato, coerente col fail-fast.
    /// </summary>
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

    /// <summary>
    /// Restituisce l'URL (trimmato) se è un **assoluto http/https valido**, altrimenti **lancia**
    /// <see cref="JsonException"/> (la voce social è presente ma sbagliata: fail-fast, non scarto
    /// silenzioso). Validazione con la primitiva del framework
    /// (<see cref="Uri.TryCreate(string, UriKind, out Uri)"/>), non con una regex a mano: copre
    /// schema, host e forma senza falsi positivi, e tiene fuori `javascript:`/`file:`/relativi.
    /// </summary>
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
