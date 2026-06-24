using System.Globalization;
using System.Text.Json.Serialization;
using DnsClient;
using FluentValidation;
using Microsoft.AspNetCore.Localization;
using Microsoft.Extensions.Options;
using Backend.Delivery;
using Backend.Gallery;
using Backend.Generators;
using Backend.Mail;
using Backend.Models.Configuration;
using Backend.Notifications;
using Backend.Security;
using Backend.Tasks;
using Backend.Services;
using Backend.Stories;
using Backend.Store;

var builder = WebApplication.CreateBuilder(args);

// Non rivelare il server software nell'header `Server` (banner grabbing): Kestrel emette
// "Server: Kestrel" di default. È l'equivalente del `x-powered-by` disattivato sul Node SSR
// (server.ts): conta quando `backend.public` espone Kestrel direttamente al browser, ma resta
// una buona pratica a prescindere. Impostato qui sull'host perché AddServerHeader è un'opzione
// di build di Kestrel, non un middleware.
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

// global-settings.local.json: override coi SEGRETI (ApiKeys, Token) — gitignored.
// In DEV locale è la sorgente di verità della API key: caricato DOPO global-settings.json,
// il layering di ASP.NET fa lo stesso deep-merge che in prod fa scripts/lib/br1-config.sh
// (.br1-settings.effective.json). In Docker/prod il file non esiste (i segreti sono già
// fusi nel global-settings.json montato) → optional, nessun effetto. Stessa coppia di path
// dev (../) e Docker (cwd) usata per global-settings.json.
builder.Configuration.AddJsonFile(
    Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "global-settings.local.json")),
    optional: true, reloadOnChange: false);
builder.Configuration.AddJsonFile("global-settings.local.json", optional: true, reloadOnChange: false);

// security-headers.json: header di sicurezza del template (uguali per ogni progetto, non
// gestiti dal figlio). Si fonde nella sezione "Security": fornisce Security.Headers mentre
// ApiKeys/CorsOrigins/BehindProxy/Token restano in global-settings.json.
builder.Configuration.AddJsonFile(
    Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "security-headers.json")),
    optional: true, reloadOnChange: false);
builder.Configuration.AddJsonFile("security-headers.json", optional: true, reloadOnChange: false);

// Variabili d'ambiente con PRECEDENZA sul JSON (aggiunte per ultime): permettono di iniettare
// un segreto dalla piattaforma senza che finisca nel file montato su disco. Convenzione .NET:
// il separatore di sezione è il doppio underscore, quindi "Mail:Password" → env "Mail__Password",
// "Security:Token:SecretKey" → "Security__Token__SecretKey". Se la variabile non è impostata,
// vale il valore del JSON (modello di default invariato). Il passaggio al container è in
// docker-compose.yml (backend.environment).
builder.Configuration.AddEnvironmentVariables();

// ── CONFIGURAZIONE ──────────────────────────────────────────────────
//
// Ogni sezione di global-settings.json viene registrata come IOptions<T> (DI)
// e letta una volta come istanza diretta per la configurazione dei servizi.
//
builder.Services.Configure<SecurityOptions>(
    builder.Configuration.GetSection("Security"));
builder.Services.Configure<LocalizationOptions>(
    builder.Configuration.GetSection("Localization"));
builder.Services.Configure<MailOptions>(
    builder.Configuration.GetSection("Mail"));

var security = builder.Configuration
    .GetSection("Security")
    .Get<SecurityOptions>() ?? new SecurityOptions();
var localization = builder.Configuration
    .GetSection("Localization")
    .Get<LocalizationOptions>() ?? new LocalizationOptions();
var mail = builder.Configuration
    .GetSection("Mail")
    .Get<MailOptions>() ?? new MailOptions();

// ── SERVIZI APPLICATIVI ─────────────────────────────────────────────
// IContentStore (FileContentStore): accesso dati, sostituibile con DB senza toccare controller.
// SiteService: profilo e social del sito (data/irl.json + social.json).
// GeneratorService: catalogo e generazione testo (generatori come istanze di classi, composizioni via ereditarietà).
// StoryService: registro storie e motore narrativo.
// AuthService: infrastruttura JWT, registrata solo se LoginEnabled.
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IContentStore, FileContentStore>();
builder.Services.AddSingleton<BlobStore>();
builder.Services.AddScoped<SiteService>();
// Generatori: factory di registrazione che auto-scopre gli IGenerator dell'assembly e li indicizza
// (vedi GeneratorRegistration). Aggiungere un generatore = creare la classe.
builder.Services.AddGenerators();
// StoryService: registro storie e motore narrativo (auto-registrazione come i generatori).
builder.Services.AddStories();
// Galleria pubblica: store file-based in db/ + firmatario HMAC delle generazioni.
builder.Services.AddGallery();

// Mailer: il sender (IEngineMailer) più coda + worker di invio in background. Accodare e
// rispondere subito evita di bloccare la richiesta HTTP sull'I/O SMTP; l'invio (con retry)
// avviene in EmailSenderHostedService. Attivo solo se configurato (vedi MailOptions.IsConfigured).
// ILookupClient: resolver DNS (singleton, con cache) usato dal check MX opzionale del mailer.
builder.Services.AddSingleton<ILookupClient>(
    new LookupClient(new LookupClientOptions { Timeout = TimeSpan.FromSeconds(5), UseCache = true }));
builder.Services.AddSingleton<IEngineMailer, EngineMailer>();
builder.Services.AddSingleton<ChannelEmailQueue>();
builder.Services.AddSingleton<IEmailQueue>(sp => sp.GetRequiredService<ChannelEmailQueue>());
builder.Services.AddHostedService<EmailSenderHostedService>();

if (security.LoginEnabled)
    builder.Services.AddSingleton<AuthService>();

// Notifiche realtime (SSE): stream singleton + resolver di gruppo di default. Meccanismo
// dell'engine, indipendente dal login — i figli possono targetizzare per utente registrando
// il proprio INotificationGroupResolver. Vedi Engine/Notifications/.
builder.Services.AddTemplateNotifications();

// Task in background generici (coda + hosted service) e delivery degli esiti (notifica/email
// con switch automatico). Insieme abilitano il pattern "POST ritorna subito → task lungo →
// notifica a fine lavoro". Vedi Engine/Tasks/ e Engine/Delivery/.
builder.Services.AddTemplateBackgroundTasks();
builder.Services.AddTemplateDelivery();

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
//
// Le lingue supportate vengono lette da LocalizationOptions (già registrato).
// La lingua della richiesta viene poi risolta dall'header Accept-Language
// inviato dal frontend (impostato dall'interceptor Angular).
//
// AddLocalization abilita IStringLocalizer: i messaggi (validazione ed errori applicativi)
// vivono nei file .resx sotto Resources/ e si risolvono per CurrentUICulture.
builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    var supported = localization.SupportedLanguages.Select(l => new CultureInfo(l)).ToArray();
    options.DefaultRequestCulture = new RequestCulture(localization.DefaultLanguage);
    options.SupportedCultures = supported;
    options.SupportedUICultures = supported;
    options.ApplyCurrentCultureToResponseHeaders = true;
    options.RequestCultureProviders = [new AcceptLanguageHeaderRequestCultureProvider()];
});

// ── SICUREZZA ───────────────────────────────────────────────────────
//
// Una sola chiamata registra TUTTI i servizi di sicurezza del template:
// API key, JWT (se configurato), CORS, rate limiting, security headers
// e gestione centralizzata degli errori (ProblemDetails).
//
builder.Services.AddTemplateSecurity(security);

// Health check — GET /health (senza autenticazione)
builder.Services.AddHealthChecks();

var app = builder.Build();

// ── MAILER ──────────────────────────────────────────────────────────
// Il mailer è un singleton in DI (IEngineMailer). Come il login si attiva solo se configurato:
// senza una sezione "Mail" valida IsEnabled resta false e ogni invio risponde 503. Qui si
// traccia solo lo stato all'avvio (nessun segreto nei log).
app.Logger.LogInformation("Mailer {State}.",
    app.Services.GetRequiredService<IEngineMailer>().IsEnabled ? $"attivo (SMTP {mail.Host}:{mail.Port})" : "non configurato");

// ── PIPELINE HTTP ───────────────────────────────────────────────────
// L'ordine è critico. Vedi README.md → "Ordine della pipeline HTTP".
app.UseTemplateSecurity(security);

app.UseRequestLocalization(
    app.Services.GetRequiredService<IOptions<RequestLocalizationOptions>>().Value);

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();
