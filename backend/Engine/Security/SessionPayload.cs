using System.Security.Claims;
using System.Text.Json;

namespace Backend.Security;

/// <summary>Trasporta un payload di sessione tipizzato dal progetto dentro il JWT come unico claim JSON ("session"); la FORMA (es. <c>SessionInfo</c>) va rispecchiata a mano in <c>session.dto.ts</c>. Il JWT è leggibile dal client: solo dati pubblici/identificativi.</summary>
public static class SessionPayload
{
    /// <summary>camelCase (idiomatico TypeScript), case-insensitive in lettura.</summary>
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Crea il claim "session"; da passare a <c>AuthService.GenerateToken</c> tra gli <c>additionalClaims</c>.</summary>
    public static Claim Claim<T>(T value) =>
        new(SecurityDefaults.SessionClaimType, JsonSerializer.Serialize(value, Json));

    /// <summary>Rilegge il payload dal token corrente, o <c>default</c> se assente o non deserializzabile.</summary>
    public static T? GetSession<T>(this ClaimsPrincipal user)
    {
        var raw = user.FindFirst(SecurityDefaults.SessionClaimType)?.Value;
        if (string.IsNullOrEmpty(raw)) return default;
        try { return JsonSerializer.Deserialize<T>(raw, Json); }
        catch (JsonException) { return default; }
    }
}
