using Microsoft.Extensions.Options;
using Backend.Models.Configuration;

namespace Backend.Sitemap;

/// <summary>
/// Avvisa il frontend Node SSR che un catalogo dietro <c>dynamicParams</c> è cambiato: un
/// <c>POST</c> senza corpo verso <c>{Frontend.Origin}/internal/revalidate-sitemap</c>, via
/// <see cref="HttpClient"/> tipizzato (stesso schema di <c>EngineErrorReporting</c>), autenticato
/// con la <c>x-api-key</c> condivisa. Esposta ai controller come proprietà ambient
/// (<c>EngineApiController.Sitemap</c>).
/// </summary>
public sealed class SitemapNotifier
{
    private readonly HttpClient _http;
    private readonly FrontendOptions _options;
    private readonly string _apiKey;
    private readonly ILogger<SitemapNotifier> _logger;

    /// <summary>Inietta l'HttpClient tipizzato, le opzioni del frontend, il logger e legge l'API key condivisa.</summary>
    public SitemapNotifier(HttpClient http, IOptions<FrontendOptions> options, IOptions<SecurityOptions> security, ILogger<SitemapNotifier> logger)
    {
        _http = http;
        _options = options.Value;
        // Stessa chiave con cui il frontend si autentica verso il backend (fetchBackendJson),
        // usata qui nella direzione opposta. Vuota solo se Security.ApiKeys non è configurato.
        _apiKey = security.Value.ApiKeys.FirstOrDefault() ?? "";
        _logger = logger;
    }

    /// <summary><see langword="true"/> se <see cref="FrontendOptions.Origin"/> è configurato.</summary>
    public bool IsEnabled => _options.IsConfigured;

    /// <summary>
    /// Chiede al frontend di invalidare la cache della sitemap. Non lancia mai: un fallimento
    /// viene solo loggato, non deve far fallire la scrittura che l'ha innescata.
    /// </summary>
    public async Task NotifyChangedAsync(CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured)
            return;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.Origin.TrimEnd('/')}/internal/revalidate-sitemap");
            request.Headers.Add("x-api-key", _apiKey);
            var response = await _http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("Invalidazione della cache sitemap sul frontend ha risposto {StatusCode}.", (int)response.StatusCode);
        }
        catch (OperationCanceledException)
        {
            // Shutdown in corso: non è un errore del frontend.
        }
        catch (Exception ex)
        {
            // Non deve MAI propagare: un problema di invalidazione cache non deve mai far fallire
            // la scrittura che l'ha innescata (e non deve far crashare chi la chiama in background).
            _logger.LogWarning(ex, "Invalidazione della cache sitemap sul frontend fallita.");
        }
    }
}
