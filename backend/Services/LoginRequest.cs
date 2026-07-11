namespace Backend.Services;

/// <summary>Body JSON della richiesta di login.</summary>
/// <param name="Username">Nome utente fornito dal client.</param>
/// <param name="Pwd">Password in chiaro inviata dal client.</param>
public record LoginRequest(string? Username, string? Pwd);

/// <summary>Esito positivo del login esposto al client (gli errori escono come <see cref="Backend.Models.UnauthorizedException"/> → ProblemDetails).</summary>
/// <param name="Valid"><see langword="true"/> se le credenziali sono valide e il token e' stato emesso.</param>
/// <param name="Token">Token JWT serializzato.</param>
public record LoginResult(bool Valid, string? Token = null);
