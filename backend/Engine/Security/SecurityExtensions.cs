using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Localization;
using Microsoft.IdentityModel.Tokens;
using Backend;
using Backend.Models.Configuration;

namespace Backend.Security;

/// <summary>
/// Estensioni che registrano e applicano la sicurezza del template (defense in depth).
/// L'ordine di registrazione e applicazione è fisso.
/// </summary>
public static class SecurityExtensions
{
    /// <summary>Registra autenticazione, autorizzazione, CORS, rate limiting e gestione errori. <paramref name="configureRateLimiting"/> è un hook opzionale invocato dopo il default, per policy/soglie aggiuntive di progetto.</summary>
    public static IServiceCollection AddTemplateSecurity(
        this IServiceCollection services,
        SecurityOptions security,
        Action<RateLimiterOptions>? configureRateLimiting = null)
    {
        // ── AUTENTICAZIONE ── Schema primario: API Key (header X-Api-Key).
        var authBuilder = services
            .AddAuthentication(options =>
            {
                // Default per [Authorize] senza policy: basta l'API key.
                // La verifica dell'header avviene in ApiKeyHandler.
                options.DefaultAuthenticateScheme = SecurityDefaults.ApiKeyAuthenticationScheme;
                options.DefaultChallengeScheme = SecurityDefaults.ApiKeyAuthenticationScheme;
            })
            .AddScheme<ApiKeySchemeOptions, ApiKeyHandler>(
                SecurityDefaults.ApiKeyAuthenticationScheme,
                options =>
                {
                    // Chiavi accettate, da Security.ApiConfig.Keys (configurate in global-settings.local.json).
                    // Confronto ORDINALE (case-sensitive): una API key è un segreto,
                    // ignorare il case ne dimezzerebbe l'entropia.
                    options.ValidKeys = new HashSet<string>(security.ApiConfig.Keys, StringComparer.Ordinal);
                });

        // ── JWT BEARER (condizionale) ── Registrato solo col login acceso (Features.Login/PublicLogin).
        if (security.LoginEnabled)
        {
            authBuilder.AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    // La firma deve corrispondere alla nostra SecretKey.
                    // Se qualcuno manipola il payload, la firma non torna e il token viene rifiutato.
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = security.Token.GetSigningKey(),

                    // Issuer e Audience non vincolati: il template non sa quale sara'
                    // il dominio finale. Attivali per architetture multi-tenant.
                    ValidateIssuer = false,
                    ValidateAudience = false,

                    // Scaduto e' scaduto, nessun margine di grazia.
                    ClockSkew = TimeSpan.Zero
                };
                // Un token firmato e non scaduto può essere stato revocato (account cancellato con
                // DELETE /me/data): dopo la firma si chiede a SessionRevocation, e un token emesso
                // prima della revoca è respinto come uno scaduto (401), non resta valido fino a scadenza.
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        var revocation = context.HttpContext.RequestServices.GetRequiredService<ISessionRevocation>();
                        if (context.Principal is not null && revocation.IsRevoked(context.Principal))
                            context.Fail("Sessione revocata: l'account è stato cancellato dopo l'emissione del token.");
                        return Task.CompletedTask;
                    }
                };
            });
            // Registro delle revoche: default in memoria (IMemoryCache), usato qui e da EngineDataPrivacyController.
            // TryAdd: un progetto con più istanze registra la propria ISessionRevocation in Program.cs e vince.
            services.AddMemoryCache();
            services.TryAddSingleton<ISessionRevocation, MemorySessionRevocation>();
        }

        // ── AUTORIZZAZIONE ── Policy "RequireLogin", usata via [Authorize(Policy = "RequireLogin")].
        services.AddAuthorization(options =>
        {
            var policyBuilder = new AuthorizationPolicyBuilder(
                // Schema di partenza: API key (serve sempre).
                // BaseController e AuthController usano [Authorize] senza policy,
                // quindi si fermano qui: basta X-Api-Key valido.
                SecurityDefaults.ApiKeyAuthenticationScheme);

            if (security.LoginEnabled)
                // Se il login e' attivo, la policy richiede anche il JWT Bearer.
                policyBuilder.AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme);

            policyBuilder.RequireAuthenticatedUser();
            // API key E JWT, non uno dei due: ASP.NET fonde i principal degli schemi elencati e
            // RequireAuthenticatedUser passa appena uno riesce. Il claim lo emette solo ApiKeyHandler.
            policyBuilder.RequireClaim(SecurityDefaults.ApiKeyValidatedClaimType, "true");
            // Il token JWT deve avere il ruolo "Authenticated" (emesso da AuthService).
            // Se LoginEnabled e' false, nessun JWT handler esiste e questo requisito
            // non puo' mai essere soddisfatto: ProtectedController resta inaccessibile.
            policyBuilder.RequireRole(SecurityDefaults.AuthenticatedRole);

            options.AddPolicy(SecurityDefaults.RequireLoginPolicy, policyBuilder.Build());
        });

        // RequireLoginPolicy combina due schemi (sopra): senza questo, una richiesta con API key
        // valida ma senza Bearer risulterebbe comunque "autenticata" per ASP.NET Core (basta che
        // UNO schema richiesto abbia successo) e il fallimento di RequireRole diventerebbe un 403
        // invece di un 401 — vedi la remark su LoginChallengeResultHandler.
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, LoginChallengeResultHandler>();

        // ── CORS ────────────────────────────────────────────────────────
        // CorsOrigins vuoto = AllowAnyOrigin deliberato: la protezione reale è l'API key.
        // Valorizzare Security.CorsOrigins solo per domini admin separati o multi-tenant.
        services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                if (security.CorsOrigins.Length == 0)
                    policy.AllowAnyOrigin();
                else
                    policy.WithOrigins(security.CorsOrigins);

				// Gli header consentiti sono quelli usati dal frontend.
				// Retry-After e' esposto esplicitamente perche' il browser non puo' leggerlo
				// senza WithExposedHeaders, anche se e' gia' presente nella risposta.
				policy.AllowAnyMethod()
                    .WithHeaders("Content-Type", "Authorization", SecurityDefaults.ApiKeyHeaderName, "Accept-Language", "X-Connection-Id")
                    .WithExposedHeaders("Retry-After");
            });
        });

        // ── RATE LIMITING ── Protezione da abuso, partizionata per IP. Soglie in
        // Security.ApiConfig.RateLimiting (global-settings.json), un progetto le cambia lì.
        var apiRateLimiting = security.ApiConfig.RateLimiting;
        services.AddRateLimiter(options =>
        {
            // OnRejected scrive un ProblemDetails 429 con Retry-After. UseRequestLocalization non ha
            // ancora eseguito qui, quindi la cultura si ricava direttamente da Accept-Language.
            options.OnRejected = async (context, _) =>
            {
                var http = context.HttpContext;
                http.Response.StatusCode = 429;

                var hasRetryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfterSpan);
                if (hasRetryAfter)
                    http.Response.Headers.RetryAfter = ((int)retryAfterSpan.TotalSeconds).ToString();

                var langTag = http.Request.Headers.AcceptLanguage.FirstOrDefault()?.Split(',')[0].Split(';')[0].Trim();
                if (langTag is not null)
                {
                    try { CultureInfo.CurrentUICulture = CultureInfo.GetCultureInfo(langTag); }
                    catch (CultureNotFoundException) { }
                }

                var localizer = http.RequestServices.GetRequiredService<IStringLocalizer<SharedResource>>();
                var detail = hasRetryAfter
                    ? localizer["error_too_many_requests_timed", (int)retryAfterSpan.TotalSeconds].Value
                    : localizer["error_too_many_requests"].Value;

                var problemDetailsSvc = http.RequestServices.GetRequiredService<IProblemDetailsService>();
                await problemDetailsSvc.TryWriteAsync(new ProblemDetailsContext
                {
                    HttpContext = http,
                    ProblemDetails = new ProblemDetails { Status = 429, Detail = detail }
                });
            };

            // Globale, partizionato per IP. Alto abbastanza per una SPA con prefetch, basso
            // abbastanza per bloccare script automatici e crawler — soglia in ApiConfig.RateLimiting.Global.
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                // RemoteIpAddress e' gia' l'IP reale: se BehindProxy e' true,
                // UseForwardedHeaders lo ha sovrascritto con X-Forwarded-For.
                var partitionKey = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                // ApiConfig.RateLimiting.Enabled = false: nessun conteggio, la richiesta passa sempre.
                // Le policy restano registrate ([EnableRateLimiting("login")] risolve comunque),
                // solo senza effetto pratico — un WAF/reverse proxy a monte può già occuparsene.
                if (!apiRateLimiting.Enabled)
                    return RateLimitPartition.GetNoLimiter(partitionKey);

                return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = apiRateLimiting.Global.PermitLimit,
                    Window = TimeSpan.FromSeconds(apiRateLimiting.Global.WindowSeconds),
                    QueueLimit = 0  // Rifiuta subito, non accodare.
                });
            });

            // Dedicata a POST /auth/login, applicata via [EnableRateLimiting("login")] su
            // AuthController.Login: soglia più stretta (ApiConfig.RateLimiting.Login) per rendere
            // impraticabile il brute force sulle credenziali.
            options.AddPolicy(SecurityDefaults.LoginRateLimitPolicy, context =>
            {
                var partitionKey = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                if (!apiRateLimiting.Enabled)
                    return RateLimitPartition.GetNoLimiter(partitionKey);

                return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = apiRateLimiting.Login.PermitLimit,
                    Window = TimeSpan.FromSeconds(apiRateLimiting.Login.WindowSeconds),
                    QueueLimit = 0
                });
            });

            // Punto di estensione: un progetto che vuole andare oltre le soglie sopra (partizionare
            // per utente, un algoritmo diverso, policy proprie) riceve le stesse options e può
            // aggiungervi o sovrascriverne membri — invocata per ultima, quindi vince lei.
            configureRateLimiting?.Invoke(options);
        });

        // ── GESTIONE ERRORI CENTRALIZZATA ── ApiException → ProblemDetails (RFC 9457).
        services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
                context.ProblemDetails.Extensions["requestId"] = context.HttpContext.TraceIdentifier;
        });
        services.AddExceptionHandler<ApiExceptionHandler>();

        return services;
    }

    /// <summary>Aggiunge alla pipeline HTTP i middleware di sicurezza del template, nell'ordine fisso.</summary>
    public static WebApplication UseTemplateSecurity(
        this WebApplication app,
        SecurityOptions security)
    {
        // ── REQUEST ID ──────────────────────────────────────────────────
        // Correlazione end-to-end con l'SSR Node.
        app.Use(async (context, next) =>
        {
            var incoming = context.Request.Headers["X-Request-Id"].ToString();
            if (!string.IsNullOrEmpty(incoming) && IsValidRequestId(incoming))
                context.TraceIdentifier = incoming;

            context.Response.Headers["X-Request-Id"] = context.TraceIdentifier;
            await next();
        });

        // BehindProxy: legge X-Forwarded-For e sovrascrive RemoteIpAddress con l'IP reale.
        // Necessario perché il rate limiter partiziona per RemoteIpAddress.
        // Se false, il middleware non viene registrato: nessuno può spoofarlo con X-Forwarded-For.
        if (security.BehindProxy)
        {
            var fwdOptions = new ForwardedHeadersOptions
            {
                ForwardedHeaders = ForwardedHeaders.XForwardedFor
                    | ForwardedHeaders.XForwardedProto
            };

            // Trusted solo da reti private RFC 1918 (range Docker) e da loopback: il reverse proxy
            // sulla stessa macchina (nginx → 127.0.0.1:5000) è il deploy non-Docker più comune, e senza
            // X-Forwarded-For letto il rate limiter metterebbe tutti i visitatori in un solo bucket.
            // IP pubblici → X-Forwarded-For ignorato → rate limiter vede l'IP reale.
            fwdOptions.KnownNetworks.Clear();
            fwdOptions.KnownProxies.Clear();
            fwdOptions.KnownProxies.Add(System.Net.IPAddress.Loopback);
            fwdOptions.KnownProxies.Add(System.Net.IPAddress.IPv6Loopback);
            fwdOptions.KnownNetworks.Add(new IPNetwork(System.Net.IPAddress.Parse("10.0.0.0"), 8));
            fwdOptions.KnownNetworks.Add(new IPNetwork(System.Net.IPAddress.Parse("172.16.0.0"), 12));
            fwdOptions.KnownNetworks.Add(new IPNetwork(System.Net.IPAddress.Parse("192.168.0.0"), 16));

            app.UseForwardedHeaders(fwdOptions);
        }

        // CORS prima del rate limiter: i preflight OPTIONS che il browser
        // manda automaticamente prima di ogni richiesta cross-origin vengono
        // gestiti qui e non consumano il budget del rate limiter.
        app.UseCors();

        // Gestione centralizzata errori: deve precedere UseRateLimiter per catturare
        // eventuali eccezioni sollevate nell'elaborazione interna del limiter.
        // I 429 generati da OnRejected non passano per qui (non sono eccezioni),
        // ma qualsiasi altra eccezione inattesa del limiter arriva a questo handler.
        app.UseExceptionHandler();
        app.UseStatusCodePages();

        // Header di sicurezza da security-headers.json, condivisi col frontend SSR: applicati anche
        // qui, PRIMA del rate limiter così li porta anche il 429 di OnRejected, perché quando backend.public è attivo il backend diventa raggiungibile dal browser
        // a prescindere dal reverse proxy. CSP esclusa: il backend serve solo JSON, dove non ha effetto.
        if (security.Headers.Count > 0)
        {
            // Content-Security-Policy: irrilevante su risposte JSON (gestita solo dall'SSR).
            // Strict-Transport-Security: già emessa da UseHsts() più sotto, esclusa qui per
            // non duplicare l'header quando il backend è esposto pubblicamente.
            var browserHeaders = security.Headers
                .Where(h => !string.Equals(h.Key, "Content-Security-Policy", StringComparison.OrdinalIgnoreCase)
                         && !string.Equals(h.Key, "Strict-Transport-Security", StringComparison.OrdinalIgnoreCase))
                .ToArray();

            app.Use(async (context, next) =>
            {
                context.Response.OnStarting(() =>
                {
                    foreach (var (name, value) in browserHeaders)
                        context.Response.Headers[name] = value;
                    return Task.CompletedTask;
                });
                await next();
            });
        }

        // Rate limiting per IP del client.
        // 500 req/min globali, 5 req/min su login (default — configurabili in Security.ApiConfig.RateLimiting).
        // Sta subito dopo l'exception handler (fail fast): se un client sta abusando,
        // viene bloccato subito senza sprecare risorse sui middleware successivi.
        app.UseRateLimiter();

        app.UseHsts();

        return app;
    }

    /// <summary>
    /// Un X-Request-Id in ingresso è accettato solo se alfanumerico (oltre a '.', '-', '_') e non più lungo di 128 caratteri.
    /// </summary>
    private static bool IsValidRequestId(string value) =>
        value.Length <= 128 && value.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_');
}
