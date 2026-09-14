using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace Backend.Security;

/// <summary>
/// Forza 401 (non 403) su una policy che combina API Key + JWT Bearer quando manca un JWT valido.
/// </summary>
/// <remarks>
/// <c>RequireLoginPolicy</c> combina due schemi (vedi <see cref="SecurityExtensions.AddTemplateSecurity"/>):
/// se manca solo il Bearer ma l'API Key è valida, ASP.NET Core considera comunque l'autenticazione
/// "riuscita" (basta che UNO schema tra quelli richiesti abbia successo) — il fallimento successivo
/// di <c>RequireRole</c> diventa quindi un fallimento di autorizzazione (403, "so chi sei ma non
/// puoi"), non di autenticazione (401, "non so chi sei"), anche senza alcun token Bearer presentato.
/// Questo handler intercetta solo quel caso: se la policy fallita porta lo schema JWT fra quelli
/// richiesti e il JWT specificamente non ha superato l'autenticazione, forza un Challenge (401)
/// invece del Forbid (403) di default. Non tocca policy che non usano JWT (nessun cambiamento per
/// <c>[Authorize]</c> senza policy, solo API Key), né un JWT valido ma con permessi insufficienti su
/// un requisito applicativo (quei 403 restano <c>ApiException</c> lanciate dai controller/store,
/// indipendenti da questa pipeline).
/// </remarks>
public sealed class LoginChallengeResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _default = new();

    /// <inheritdoc />
    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Forbidden && policy.AuthenticationSchemes.Contains(JwtBearerDefaults.AuthenticationScheme))
        {
            var jwtResult = await context.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
            if (!jwtResult.Succeeded)
            {
                await context.ChallengeAsync(JwtBearerDefaults.AuthenticationScheme);
                return;
            }
        }

        await _default.HandleAsync(next, context, policy, authorizeResult);
    }
}
