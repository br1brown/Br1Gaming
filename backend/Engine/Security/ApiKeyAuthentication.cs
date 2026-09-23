using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Backend.Security;

/// <summary>Nomi condivisi dallo schema API key: prima linea di difesa, certifica il client (non l'utente — per quello c'è JWT).</summary>
public static class SecurityDefaults
{
	/// <summary>Nome logico dello schema di autenticazione ASP.NET.</summary>
	public const string ApiKeyAuthenticationScheme = "ApiKey";

	/// <summary>Header HTTP in cui il client invia la API key.</summary>
	public const string ApiKeyHeaderName = "X-Api-Key";

	/// <summary>Policy che richiede API key + JWT + ruolo, usata da ProtectedController.</summary>
	public const string RequireLoginPolicy = "RequireLogin";

	/// <summary>Ruolo assegnato da <c>AuthService.GenerateToken</c>, richiesto da <see cref="RequireLoginPolicy"/>. Case-sensitive.</summary>
	public const string AuthenticatedRole = "Authenticated";

	/// <summary>Tipo del claim col payload di sessione, vedi <c>SessionPayload</c>.</summary>
	public const string SessionClaimType = "session";

	/// <summary>Claim emesso da <see cref="ApiKeyHandler"/> quando la API key è valida: la policy <see cref="RequireLoginPolicy"/> lo esige,
	/// così un JWT da solo non basta (i due schemi fondono i principal e "autenticato" varrebbe con uno solo dei due).</summary>
	public const string ApiKeyValidatedClaimType = "ApiKeyValidated";

	/// <summary>Policy di rate limiting sull'endpoint di login.</summary>
	public const string LoginRateLimitPolicy = "login";
}

/// <summary>Opzioni dello schema API key: l'elenco delle chiavi valide.</summary>
public class ApiKeySchemeOptions : AuthenticationSchemeOptions
{
	/// <summary>API key ammesse, confrontate in modo ordinale (case-sensitive).</summary>
	public HashSet<string> ValidKeys { get; set; } = new(StringComparer.Ordinal);
}

/// <summary>Handler ASP.NET che autentica via header <c>X-Api-Key</c> in tempo costante; l'identità finale (ruolo, payload utente) arriva poi dal middleware JWT.</summary>
public class ApiKeyHandler : AuthenticationHandler<ApiKeySchemeOptions>
{
	/// <summary>Inizializza l'handler dello schema API key.</summary>
	public ApiKeyHandler(
		IOptionsMonitor<ApiKeySchemeOptions> options,
		ILoggerFactory logger,
		UrlEncoder encoder)
		: base(options, logger, encoder)
	{
	}

	/// <summary>Valida la richiesta corrente controllando presenza e correttezza della API key.</summary>
	protected override Task<AuthenticateResult> HandleAuthenticateAsync()
	{
		// Le OPTIONS (preflight CORS) passano sempre: NoResult() lascia decidere al middleware CORS,
		// senza marcare come autenticata una richiesta che non ha presentato nessuna chiave.
		if (Request.Method == HttpMethods.Options)
			return Task.FromResult(AuthenticateResult.NoResult());

		var apiKey = Request.Headers[SecurityDefaults.ApiKeyHeaderName].FirstOrDefault();
		if (string.IsNullOrEmpty(apiKey))
			return Task.FromResult(AuthenticateResult.Fail("Header " + SecurityDefaults.ApiKeyHeaderName + " mancante."));

		if (!IsValidApiKey(apiKey.Trim()))
			return Task.FromResult(AuthenticateResult.Fail("API key non valida."));

		// Identità minima: certifica solo il client, non un utente. Il JWT Bearer (se attivo)
		// aggiunge l'identità utente in seguito.
		var identity = new ClaimsIdentity(Scheme.Name);
		identity.AddClaim(new Claim(SecurityDefaults.ApiKeyValidatedClaimType, "true"));
		var principal = new ClaimsPrincipal(identity);
		var authTicket = new AuthenticationTicket(principal, Scheme.Name);

		return Task.FromResult(AuthenticateResult.Success(authTicket));
	}

	/// <summary>Confronta in tempo costante contro TUTTE le chiavi, senza uscita anticipata al primo match: un'uscita anticipata reintrodurrebbe una dipendenza temporale dal numero di chiavi.</summary>
	private bool IsValidApiKey(string presented)
	{
		var presentedBytes = Encoding.UTF8.GetBytes(presented);
		var match = false;
		foreach (var key in Options.ValidKeys)
		{
			if (CryptographicOperations.FixedTimeEquals(presentedBytes, Encoding.UTF8.GetBytes(key)))
				match = true;
		}
		return match;
	}

	/// <summary>Challenge ProblemDetails 401 quando la API key manca o non è valida (403 sarebbe per identità nota ma permessi insufficienti).</summary>
	protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
	{
		Response.StatusCode = 401;

		var problemDetailsService = Context.RequestServices.GetRequiredService<IProblemDetailsService>();
		await problemDetailsService.WriteAsync(new ProblemDetailsContext
		{
			HttpContext = Context,
			ProblemDetails = new ProblemDetails
			{
				Status = 401,
				Title = "Unauthorized",
				Detail = "API key non valida o mancante."
			}
		});
	}
}
