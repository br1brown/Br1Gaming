using System.Globalization;
using System.Text.Json.Serialization;
using DnsClient;
using FluentValidation;
using Microsoft.AspNetCore.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Backend.Blob;
using Backend.Delivery;
using Backend.Shares;
using Backend.Generators;
using Backend.Diagnostics;
using Backend.Engine;
using Backend.Engine.Localization;
using Backend.Identity;
using Backend.Mail;
using Backend.Models.Configuration;
using Backend.Notifications;
using Backend.Privacy;
using Backend.Security;
using Backend.Sitemap;
using Backend.Tasks;
using Backend.Services;
using Backend.Stories;
using Backend.Store;

var builder = WebApplication.CreateBuilder(args);

// Non rivelare il server software nell'header Server (Kestrel lo emette di default): equivalente
// dell'x-powered-by disattivato sul Node SSR. Qui perché AddServerHeader è un'opzione di Kestrel.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// global-settings.json è l'unica sorgente di verità per la configurazione del deployment.
// Rimuoviamo esplicitamente le configurazioni di default (global-settings.json e simili)
var defaultJsonSources = builder.Configuration.Sources.OfType<Microsoft.Extensions.Configuration.Json.JsonConfigurationSource>().ToList();
foreach (var source in defaultJsonSources)
{
    if (source.Path != null && source.Path.StartsWith("appsettings", StringComparison.OrdinalIgnoreCase))
    {
        builder.Configuration.Sources.Remove(source);
    }
}

// Dev: cwd=backend/ → la root del repo è un livello sopra. Si usa un path ASSOLUTO:
// AddJsonFile con path relativo "../" verrebbe rifiutato dal PhysicalFileProvider
// (la traversal ".." è bloccata), quindi in locale il file non verrebbe mai caricato.
// Docker: cwd=/app, file montato come /app/global-settings.json → global-settings.json (stesso dir).
builder.Configuration.AddJsonFile(
    Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "global-settings.json")),
    optional: true, reloadOnChange: false);
builder.Configuration.AddJsonFile("global-settings.json", optional: true, reloadOnChange: false);

// global-settings.local.json: override coi SEGRETI (ApiConfig.Keys, Token) — gitignored.
// In dev è la sorgente di verità dei segreti. In prod/Docker questo file non esiste 
// (i segreti sono iniettati o montati direttamente sul file base).
// In Development, se manca nella root del repository, lo si genera con le chiavi (come setup.mjs):
// il login demo del template è acceso e senza SecretKey il server non partirebbe.
if (LocalSettingsFile.EnsureForDevelopment(builder.Environment) is { } createdLocal)
    Console.WriteLine($"[backend] creato {createdLocal} con API key e SecretKey generate (gitignored).");
builder.Configuration.AddJsonFile(
    Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "global-settings.local.json")),
    optional: true, reloadOnChange: false);
builder.Configuration.AddJsonFile("global-settings.local.json", optional: true, reloadOnChange: false);

// security-headers.json: header di sicurezza del template (uguali per ogni progetto, non
// gestiti dal figlio). Si fonde nella sezione "Security": fornisce Security.Headers mentre
// ApiConfig/CorsOrigins/BehindProxy/Token restano in global-settings.json.
builder.Configuration.AddJsonFile(
    Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "security-headers.json")),
    optional: true, reloadOnChange: false);
builder.Configuration.AddJsonFile("security-headers.json", optional: true, reloadOnChange: false);

// Variabili d'ambiente con PRECEDENZA sul JSON (aggiunte per ultime): inietta un segreto dalla
// piattaforma senza che finisca sul file montato. Convenzione .NET: "Mail:Password" → "Mail__Password".
builder.Configuration.AddEnvironmentVariables();

// ── CONFIGURAZIONE ──────────────────────────────────────────────────
// Ogni sezione di global-settings.json registrata come IOptions<T> (DI) e letta una volta come
// istanza diretta per la configurazione dei servizi.
builder.Services.Configure<SecurityOptions>(
    builder.Configuration.GetSection("Security"));
builder.Services.Configure<LocalizationOptions>(
    builder.Configuration.GetSection("Localization"));
builder.Services.Configure<MailOptions>(
    builder.Configuration.GetSection("Mail"));
builder.Services.Configure<ErrorReportingOptions>(
    builder.Configuration.GetSection("ErrorReporting"));
builder.Services.Configure<FrontendOptions>(
    builder.Configuration.GetSection("Frontend"));
builder.Services.Configure<MediaOptions>(
    builder.Configuration.GetSection("Media"));
builder.Services.Configure<NotificationsOptions>(
    builder.Configuration.GetSection("Notifications"));

var security = builder.Configuration
    .GetSection("Security")
    .Get<SecurityOptions>() ?? new SecurityOptions();
// Lingue: codici a due lettere dichiarati in global-settings.json; EngineCultures li arricchisce
// nelle CultureInfo tipizzate (qui per UseRequestLocalization, e in GET /localization per il frontend).
var localization = builder.Configuration
    .GetSection("Localization")
    .Get<LocalizationOptions>() ?? new LocalizationOptions();
var mail = builder.Configuration
    .GetSection("Mail")
    .Get<MailOptions>() ?? new MailOptions();
// Features (global-settings.json) è l'interruttore, la configurazione il requisito. Solo da file JSON: il frontend lo
// compila da global-settings.json, e una variabile d'ambiente accenderebbe qui ciò che navbar e privacy ignorano. Il
// .local non si distingue qui (è JSON anche lui): Features lì lo rifiutano generate:statics e il deploy.
// Qualunque chiave Features:* in una fonte non JSON ferma l'avvio, qualunque sia il valore.
var featuresOutsideJson = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);
foreach (var provider in ((IConfigurationRoot)builder.Configuration).Providers)
{
    if (provider is Microsoft.Extensions.Configuration.Json.JsonConfigurationProvider)
        continue;
    if (provider.TryGet("Features", out _))
        featuresOutsideJson.Add("Features");
    foreach (var key in provider.GetChildKeys(Array.Empty<string>(), "Features"))
        featuresOutsideJson.Add($"Features:{key}");
}
if (featuresOutsideJson.Count > 0)
    throw new InvalidOperationException(
        $"{string.Join(", ", featuresOutsideJson)} arriva da variabili d'ambiente o riga di comando: Features va solo in global-settings.json, letto anche dal frontend.");
var features = builder.Configuration.GetSection("Features").Get<FeaturesOptions>() ?? new FeaturesOptions();
features.EnsureRequirements(
    security,
    mail,
    builder.Configuration.GetSection("ErrorReporting").Get<ErrorReportingOptions>() ?? new ErrorReportingOptions());
security.LoginEnabled = features.LoginActive;
builder.Services.PostConfigure<SecurityOptions>(o => o.LoginEnabled = features.LoginActive);
builder.Services.Configure<FeaturesOptions>(builder.Configuration.GetSection("Features"));

// ── SERVIZI APPLICATIVI ─────────────────────────────────────────────
// AuthService: infrastruttura JWT; AccountService/AppPersonalDataStore: account utenti e dati
// personali dell'engine — tutti e tre registrati solo se LoginEnabled (spento in questo progetto).
builder.Services.AddMemoryCache();

// <DEMO_BLOCK_START>
// IContentStore (FileContentStore): accesso dati demo (galleria social), sostituibile con DB.
// SiteService: logica di business del progetto.
builder.Services.AddSingleton<IContentStore, FileContentStore>();
builder.Services.AddScoped<SiteService>();
// <DEMO_BLOCK_END>

// Translator "finto spagnolo": logica pura e stateless (fonte unica in C#), servita da BaseController.
builder.Services.AddSingleton<FintoSpagnoloTranslator>();
// Lombroso Scanner: LombrosoGenerator usa la stessa grammatica combinatoria dei generatori (Tag,
// Frase, liste condivise) ma è un IHiddenGenerator — AddGenerators() lo esclude di proposito, non
// deve comparire in "generators". LombrosoScanner lo compila e sceglie l'archetipo dall'hash che
// il client calcola dal frame — la foto non lascia mai il browser, solo l'hash arriva qui.
builder.Services.AddSingleton<LombrosoScanner>();
// Generatori: factory di registrazione che auto-scopre gli IGenerator dell'assembly e li indicizza
// (vedi GeneratorRegistration). Aggiungere un generatore = creare la classe.
builder.Services.AddGenerators();
// StoryService: registro storie e motore narrativo (auto-registrazione come i generatori).
builder.Services.AddStories();
// Condivisi (raccolta pubblica): store file-based in db/ + firmatario HMAC delle generazioni.
builder.Services.AddShares();

// Storage dei file caricati: sorgente di PROGETTO (AppBlobStore) sopra il default file-based
// dell'Engine. Vince sul default registrato da AddTemplateBlob (TryAdd) — stesso schema di
// IIdentityStore/AppIdentityStore sotto.
builder.Services.AddTemplateBlob();
// AppBlobStore legge la sessione corrente (per il controllo di proprietà su DELETE) fuori da un
// controller: le sostiene solo IHttpContextAccessor.
builder.Services.AddHttpContextAccessor();
// DbContext EF Core del progetto (SQLite, db/app.db — separata da uploads/, che lo sweep orfani
// enumera). Punto dove aggiungere le proprie entità. Factory (non AddDbContext): il registry è
// singleton, un DbContext no — la factory ne crea uno nuovo, breve, per operazione.
var dbDirectory = Path.Combine(builder.Environment.ContentRootPath, "db");
Directory.CreateDirectory(dbDirectory); // SQLite apre il file ma non crea la cartella che lo contiene
builder.Services.AddDbContextFactory<AppDbContext>(options =>
    options.UseSqlite($"Data Source={Path.Combine(dbDirectory, "app.db")}"));
// Chi ha caricato/cancellato ogni slug — un progetto con più admin concorrenti ha già EF Core a
// gestire lock/transazioni, non un JSON letto-modificato-riscritto a mano.
builder.Services.AddSingleton<BlobOwnershipRegistry>();
builder.Services.AddSingleton<FileBlobStore, AppBlobStore>();
// Cache dei blob ridimensionati/riconvertiti al volo (GET /blob/{slug}?webopt=true): dedicata,
// con SizeLimit proprio — vedi BoundedByteCache per il perchè non riusa la IMemoryCache condivisa.
builder.Services.AddSingleton(_ => new BoundedByteCache("BLOB_WEBOPT_CACHE_MAX_MB"));

// Identità del sito: sorgente di PROGETTO (AppIdentityStore) sopra il default file-based dell'Engine.
// Vince sul default registrato da AddTemplateIdentity (TryAdd): è qui che il figlio compone
// l'identità da più fonti (override ComposeIdentityAsync in Store/AppIdentityStore.cs).
builder.Services.AddSingleton<IIdentityStore, AppIdentityStore>();

// Mailer: sender + coda + worker (EmailSenderHostedService, con retry), così la richiesta HTTP non
// aspetta l'SMTP. Attivo solo con Features.Mail. ILookupClient: DNS con cache per il check MX opzionale.
builder.Services.AddSingleton<ILookupClient>(
    new LookupClient(new LookupClientOptions { Timeout = TimeSpan.FromSeconds(5), UseCache = true }));
builder.Services.AddSingleton<IEngineMailer, EngineMailer>();
builder.Services.AddSingleton<ChannelEmailQueue>();
builder.Services.AddSingleton<IEmailQueue>(sp => sp.GetRequiredService<ChannelEmailQueue>());
builder.Services.AddHostedService<EmailSenderHostedService>();

// Error reporting: un POST JSON verso un webhook esterno per ogni eccezione non applicativa o
// applicativa con status ≥500 (vedi ApiExceptionHandler.ShouldReport). Lo accende Features.ErrorReporting,
// ErrorReporting.WebhookUrl è il requisito: a flag spento nessuna chiamata HTTP uscente.
// Nessun pacchetto NuGet aggiuntivo: solo HttpClient tipizzato via IHttpClientFactory.
builder.Services.AddHttpClient<IErrorReportingService, EngineErrorReporting>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(5);
});
// Coda e worker propri delle segnalazioni: un webhook lento non ferma i task di dominio, e un
// visitatore che spara /diagnostics/ui-fault non riempie la coda dei lavori veri.
builder.Services.AddSingleton<ErrorReportQueue>();
builder.Services.AddHostedService<ErrorReportDispatcher>();

// Invalidazione on-demand della cache di sitemap.xml sul frontend Node SSR: un POST verso
// Frontend.Origin dopo ogni scrittura che cambia un catalogo dietro dynamicParams. Spento di
// default (Frontend.Origin vuoto): nessuna chiamata HTTP uscente finché non lo configuri (vedi
// FrontendOptions). Stesso schema HttpClient tipizzato di IErrorReportingService.
builder.Services.AddHttpClient<SitemapNotifier>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(5);
});

if (security.LoginEnabled)
{
    builder.Services.AddSingleton<AuthService>();

    // Sensati solo col login acceso (spento, gli endpoint sono esclusi dalla discovery, vedi
    // TemplateControllerFeatureProvider). AccountService è l'unico posto che conosce gli account;
    // AppPersonalDataStore vince sul default vuoto di AddTemplatePrivacy e gli delega la cancellazione.
    builder.Services.AddSingleton<AccountService>();
    builder.Services.AddSingleton<IPersonalDataStore, AppPersonalDataStore>();
}

// Notifiche realtime (SSE): stream singleton + resolver di gruppo di default. Meccanismo
// dell'engine, indipendente dal login — i figli possono targetizzare per utente registrando
// il proprio INotificationGroupResolver. Vedi Engine/Notifications/.
builder.Services.AddTemplateNotifications();

// Task in background generici (coda + hosted service) e delivery degli esiti (notifica/email
// con switch automatico). Insieme abilitano il pattern "POST ritorna subito → task lungo →
// notifica a fine lavoro". Vedi Engine/Tasks/ e Engine/Delivery/.
builder.Services.AddTemplateBackgroundTasks();
builder.Services.AddTemplateDelivery();

// Identità del sito (dati legali, social del brand, tipo entità): sottosistema dell'engine servito
// da GET /identity. Sorgente di default file-based (data/identity.json); un figlio la sostituisce
// registrando la propria IIdentityStore (DB/API esterna). Vedi Engine/Identity/.
builder.Services.AddTemplateIdentity();

// Dati personali (export + diritto all'oblio): sottosistema dell'engine servito su
// GET/DELETE /me/data (dietro login). Registra il default vuoto (TryAdd): col login acceso è
// già stata registrata AppPersonalDataStore qui sopra, che quindi vince — è lì che il progetto
// aggrega i propri store di dominio (profilo, acquisti, ...). Vedi Engine/Privacy/.
builder.Services.AddTemplatePrivacy();

// Registra tutti i validator FluentValidation dell'assembly corrente (Validation/).
// I controller iniettano IValidator<T> ed eseguono la validazione esplicitamente.
builder.Services.AddValidatorsFromAssemblyContaining<Program>(ServiceLifetime.Singleton);

builder.Services
    .AddControllers()
    .ConfigureApplicationPartManager(manager =>
    {
        manager.FeatureProviders.Add(
            new TemplateControllerFeatureProvider(security.LoginEnabled));
    })
    .AddJsonOptions(options =>
    {
        // Campi null vengono omessi dal JSON (risposte piu' leggere).
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        // Enum serializzati come stringa, non come numero (piu' leggibili nelle risposte).
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// ── LOCALIZZAZIONE ──────────────────────────────────────────────────
// Lingue supportate = codici in LocalizationOptions, arricchiti in CultureInfo da EngineCultures.
// AddLocalization abilita IStringLocalizer: i messaggi vivono nei file .resx sotto Resources/.
builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    var supported = EngineCultures.Supported(localization).ToArray();
    options.DefaultRequestCulture = new RequestCulture(localization.DefaultLanguage);
    options.SupportedCultures = supported;
    options.SupportedUICultures = supported;
    options.ApplyCurrentCultureToResponseHeaders = true;
    options.RequestCultureProviders = [new AcceptLanguageHeaderRequestCultureProvider()];
});

// ── SICUREZZA ───────────────────────────────────────────────────────
// Una sola chiamata registra tutti i servizi di sicurezza: API key, JWT, CORS, rate limiting,
// security headers, gestione centralizzata degli errori (ProblemDetails).
builder.Services.AddTemplateSecurity(security);

// Health check — GET /health (senza autenticazione)
builder.Services.AddHealthChecks();

var app = builder.Build();

// ── DATABASE ────────────────────────────────────────────────────────
// Applica le migration pending all'avvio: db/app.db esiste/è aggiornato prima che arrivi la
// prima richiesta, invece di scoprire uno schema mancante al primo upload.
using (var dbContext = app.Services.GetRequiredService<IDbContextFactory<AppDbContext>>().CreateDbContext())
    dbContext.Database.Migrate();

// Sweep dei blob che il database dice già cancellati ma sono ancora fisicamente su disco (un
// crash fra il commit del database e la cancellazione del file in AppBlobStore.DeleteAsync) —
// all'avvio, non schedulato: se il progetto ne ha bisogno più spesso, lo richiama da dove preferisce.
if (app.Services.GetRequiredService<FileBlobStore>() is AppBlobStore appBlobStore)
{
    var removedOrphans = await appBlobStore.CleanupOrphanedFilesAsync();
    if (removedOrphans > 0)
        app.Logger.LogInformation("Sweep blob orfani: {Count} file rimossi.", removedOrphans);
}

// ── MAILER ──────────────────────────────────────────────────────────
// Spento (Features.Mail o sezione "Mail" mancante) ogni invio risponde 503. Qui solo lo stato
// all'avvio, nessun segreto nei log.
app.Logger.LogInformation("Mailer {State}.",
    app.Services.GetRequiredService<IEngineMailer>().IsEnabled ? $"attivo (SMTP {mail.Host}:{mail.Port})" : "spento");

// ── ERROR REPORTING ─────────────────────────────────────────────────
app.Logger.LogInformation("Error reporting {State}.",
    app.Services.GetRequiredService<IErrorReportingService>().IsEnabled ? "attivo" : "spento");

// ── SITEMAP NOTIFIER ────────────────────────────────────────────────
app.Logger.LogInformation("Invalidazione cache sitemap sul frontend {State}.",
    app.Services.GetRequiredService<SitemapNotifier>().IsEnabled ? "attiva" : "non configurata");

// ── PIPELINE HTTP ───────────────────────────────────────────────────
// L'ordine è critico.
app.UseTemplateSecurity(security);

app.UseRequestLocalization(
    app.Services.GetRequiredService<IOptions<RequestLocalizationOptions>>().Value);

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();
