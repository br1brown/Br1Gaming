using System.Globalization;
using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.AspNetCore.Localization;
using Microsoft.Extensions.Options;
using Backend.Models.Configuration;
using Backend.Security;
using Backend.Services;
using Backend.Store;

var builder = WebApplication.CreateBuilder(args);

// global-settings.json è l'unica sorgente di verità per la configurazione del deployment.
// Rimuoviamo esplicitamente le configurazioni di default (global-settings.json e simili)
var defaultJsonSources = builder.Configuration.Sources.OfType<Microsoft.Extensions.Configuration.Json.JsonConfigurationSource>().ToList();
foreach (var source in defaultJsonSources)
{
    if (source.Path != null && source.Path.StartsWith("appsettings"))
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

// ── CONFIGURAZIONE ──────────────────────────────────────────────────
//
// Ogni sezione di global-settings.json viene registrata come IOptions<T> (DI)
// e letta una volta come istanza diretta per la configurazione dei servizi.
//
builder.Services.Configure<SecurityOptions>(
    builder.Configuration.GetSection("Security"));
builder.Services.Configure<LocalizationOptions>(
    builder.Configuration.GetSection("Localization"));

var security = builder.Configuration
    .GetSection("Security")
    .Get<SecurityOptions>() ?? new SecurityOptions();
var localization = builder.Configuration
    .GetSection("Localization")
    .Get<LocalizationOptions>() ?? new LocalizationOptions();

// ── SERVIZI APPLICATIVI ─────────────────────────────────────────────
// IContentStore (FileContentStore): accesso dati, sostituibile con DB senza toccare controller.
// SiteService: logica di business del progetto.
// AuthService: infrastruttura JWT, registrata solo se LoginEnabled.
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IContentStore, FileContentStore>();
builder.Services.AddScoped<SiteService>();

if (security.LoginEnabled)
    builder.Services.AddSingleton<AuthService>();

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
