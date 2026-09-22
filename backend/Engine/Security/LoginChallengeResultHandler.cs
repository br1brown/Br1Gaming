using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace Backend.Security;

/// <summary>Forza 401 (non 403) quando manca un JWT valido su una policy che combina API Key + JWT Bearer.</summary>
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
