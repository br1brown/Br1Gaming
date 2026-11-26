using System.Text.Json.Serialization;

namespace Backend.Models;

/// <summary>
/// Pagina landing completa, già risolta nella lingua della richiesta. Una pagina = una lista di
/// sezioni tipizzate: il frontend le disegna in ordine, uno <c>switch</c> sul <c>type</c>.
/// </summary>
/// <param name="Title">Titolo SEO della pagina.</param>
/// <param name="Description">Descrizione SEO (meta description).</param>
/// <param name="Sections">Sezioni nell'ordine in cui vanno mostrate.</param>
public sealed record LandingPageDto(string Title, string Description, IReadOnlyList<LandingSection> Sections);

/// <summary>
/// Una sezione. Il discriminatore JSON è <c>type</c>; nel file <c>data/landing-*.json</c> deve essere
/// la PRIMA proprietà dell'oggetto (vincolo di System.Text.Json per la deserializzazione polimorfa).
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(HeroSection), "hero")]
[JsonDerivedType(typeof(FeatureListSection), "featureList")]
[JsonDerivedType(typeof(StepsSection), "steps")]
[JsonDerivedType(typeof(ProseSection), "prose")]
[JsonDerivedType(typeof(PricingSection), "pricing")]
[JsonDerivedType(typeof(FaqSection), "faq")]
[JsonDerivedType(typeof(CtaSection), "cta")]
[JsonDerivedType(typeof(PressureSection), "pressure")]
public abstract record LandingSection
{
    /// <summary>Identificatore stabile della sezione (ancora HTML, aria, test).</summary>
    public required string Id { get; init; }
}

/// <summary>Immagine con testo alternativo; <c>Asset</c> è l'id di <c>assets/mapping.json</c>.</summary>
public sealed record LandingImage(string Asset, string Alt);

/// <summary>Voce con un titolo in evidenza seguito dal testo (punto di un elenco, passo di una procedura).</summary>
public sealed record TitledItem(string Title, string Text);

/// <summary>Apertura: nome del prodotto, claim, sottotitolo e testo introduttivo.</summary>
public sealed record HeroSection : LandingSection
{
    /// <summary>Nome del prodotto (il titolo di pagina, h1).</summary>
    public required string Brand { get; init; }
    /// <summary>Claim principale.</summary>
    public required string Headline { get; init; }
    /// <summary>Sottotitolo, in corsivo.</summary>
    public required string Subheadline { get; init; }
    /// <summary>Paragrafi introduttivi.</summary>
    /// <summary>Paragrafi di testo.</summary>
    public required IReadOnlyList<string> Body { get; init; }
    /// <summary>Logo o immagine di apertura, se c'è.</summary>
    public LandingImage? Image { get; init; }
}

/// <summary>Sezione con un'introduzione e un elenco puntato di voci titolate.</summary>
public sealed record FeatureListSection : LandingSection
{
    /// <summary>Titolo della sezione.</summary>
    public required string Heading { get; init; }
    /// <summary>Testo che introduce l'elenco.</summary>
    public string? Intro { get; init; }
    /// <summary>Voci, nell'ordine in cui vanno mostrate.</summary>
    public required IReadOnlyList<TitledItem> Items { get; init; }
}

/// <summary>Procedura numerata. <c>HeadingLevel</c> 3 = sottosezione della sezione che la precede.</summary>
public sealed record StepsSection : LandingSection
{
    /// <summary>Titolo della sezione.</summary>
    public required string Heading { get; init; }
    /// <summary>Livello del titolo: 2 = sezione, 3 = sottosezione.</summary>
    public int HeadingLevel { get; init; } = 3;
    /// <summary>Voci, nell'ordine in cui vanno mostrate.</summary>
    public required IReadOnlyList<TitledItem> Items { get; init; }
}

/// <summary>Titolo e paragrafi di testo corrente.</summary>
public sealed record ProseSection : LandingSection
{
    /// <summary>Titolo della sezione.</summary>
    public required string Heading { get; init; }
    /// <summary>Paragrafi di testo.</summary>
    public required IReadOnlyList<string> Paragraphs { get; init; }
}

/// <summary>Una riga del confronto fra piani: l'etichetta (es. «Obiettivo»), un attacco in grassetto opzionale e il testo che segue.</summary>
public sealed record PricingDetail(string Label, string? Lead, string Text);

/// <summary>Messaggio mostrato in un alert con un solo pulsante di conferma (piano gratuito, badge dei negozi, uscita dalla pagina).</summary>
public sealed record AlertDialog(string Title, string Message, string ConfirmLabel);

/// <summary>
/// Un piano: prezzo, dettagli (un array di righe etichettate, autosufficiente) e cosa fa il pulsante.
/// Un piano gratuito ha un <see cref="Dialog"/>; uno a pagamento manda al <see cref="Checkout"/>. Uno solo dei due.
/// </summary>
public sealed record PricingPlan(
    string Id,
    string Name,
    string? Badge,
    string Price,
    string Period,
    bool Featured,
    IReadOnlyList<PricingDetail> Details,
    string CtaLabel,
    AlertDialog? Dialog,
    CheckoutRequestDto? Checkout,
    ViewersSpec? Viewers = null,
    string? Scarcity = null);

/// <summary>Confronto fra piani, uno accanto all'altro.</summary>
public sealed record PricingSection : LandingSection
{
    /// <summary>Titolo della sezione.</summary>
    /// <summary>Titolo della sezione.</summary>
    public required string Heading { get; init; }
    /// <summary>Piani, nell'ordine in cui vanno mostrati.</summary>
    public required IReadOnlyList<PricingPlan> Plans { get; init; }
}

/// <summary>Domanda e risposta.</summary>
public sealed record FaqItem(string Question, string Answer);

/// <summary>Domande frequenti.</summary>
public sealed record FaqSection : LandingSection
{
    /// <summary>Titolo della sezione.</summary>
    public required string Heading { get; init; }
    /// <summary>Voci, nell'ordine in cui vanno mostrate.</summary>
    public required IReadOnlyList<FaqItem> Items { get; init; }
}

/// <summary>Chiusura con invito all'azione e nota finale.</summary>
public sealed record CtaSection : LandingSection
{
    /// <summary>Titolo della sezione.</summary>
    public required string Heading { get; init; }
    /// <summary>Paragrafi di testo.</summary>
    public required IReadOnlyList<string> Body { get; init; }
    /// <summary>Nota finale, in piccolo.</summary>
    public string? Note { get; init; }
    /// <summary>Badge «Scarica» sul modello di quelli dei negozi: ognuno apre un alert.</summary>
    public IReadOnlyList<StoreBadge>? Badges { get; init; }
}

/// <summary>Badge di scaricamento: una riga piccola sopra e una grande sotto, come i badge dei negozi.</summary>
/// <param name="SubLabel">Riga piccola (es. «Disponibile sulle piattaforme»).</param>
/// <param name="Label">Riga grande (es. «Scarica»).</param>
/// <param name="Icon">Icona Font Awesome come classe (es. <c>fa-solid fa-mobile-screen-button</c>).</param>
/// <param name="Dialog">Cosa dice l'alert aperto dal badge.</param>
public sealed record StoreBadge(string SubLabel, string Label, string Icon, AlertDialog Dialog);

/// <summary>Quante persone «stanno guardando» un piano: un numero che oscilla fra <paramref name="Min"/> e <paramref name="Max"/>.</summary>
/// <param name="Text">Testo con <c>{0}</c> al posto del numero (es. «{0} persone stanno guardando questo piano»).</param>
public sealed record ViewersSpec(string Text, int Min, int Max);

/// <summary>Conto alla rovescia: <paramref name="Minutes"/> minuti, poi ricomincia. <c>{0}</c> nel testo diventa mm:ss.</summary>
public sealed record CountdownSpec(string Text, int Minutes);

/// <summary>
/// Notifiche di «acquisti recenti»: una dopo l'altra ogni <paramref name="IntervalSeconds"/> secondi, al massimo <paramref name="Max"/> volte.
/// Le frasi sono <paramref name="Messages"/> (fisse, letterali) più <paramref name="Generate"/> frasi nuove del generatore
/// nascosto «acquirenti», a ogni richiesta, che parlano dei piani a pagamento della pagina stessa.
/// </summary>
public sealed record PurchaseToasts(int IntervalSeconds, int Max, IReadOnlyList<string>? Messages = null, int Generate = 0);

/// <summary>
/// Pressione sul visitatore, in stile dark pattern (parodia): una barra col conto alla rovescia in cima, un alert quando
/// il mouse esce dalla finestra, notifiche di acquisti altrui. Ogni parte è facoltativa.
/// </summary>
public sealed record PressureSection : LandingSection
{
    /// <summary>Barra con conto alla rovescia, in cima alla pagina.</summary>
    public CountdownSpec? Countdown { get; init; }
    /// <summary>Alert mostrato una sola volta quando il mouse esce dalla pagina (solo desktop).</summary>
    public AlertDialog? Exit { get; init; }
    /// <summary>Notifiche di acquisti recenti.</summary>
    public PurchaseToasts? Purchases { get; init; }
}
