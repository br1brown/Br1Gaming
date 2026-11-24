using System.Security.Cryptography;

namespace Backend.Security;

/// <summary>Hash e verifica delle password con PBKDF2-HMACSHA256, nel formato <c>{iterazioni}.{saltBase64}.{hashBase64}</c>.
/// Le iterazioni viaggiano con l'hash: cambiarle non invalida le password salvate, <see cref="NeedsRehash"/> dice quali riscrivere.
/// Uno script esterno che scrive hash nello stesso database deve produrre lo stesso formato.</summary>
public static class PasswordHasher
{
    private const int SaltSize = 16;
    private const int HashSize = 32;

    /// <summary>Iterazioni dei nuovi hash (OWASP per PBKDF2-HMAC-SHA256). Gli hash con meno iterazioni restano validi:
    /// <see cref="NeedsRehash"/> li segnala al primo login riuscito.</summary>
    public const int DefaultIterations = 600_000;

    /// <summary>Tetto alle iterazioni lette da un hash salvato: un valore enorme (un record manomesso) bloccherebbe il login
    /// per ore. Oltre il tetto l'hash non è valido (<see cref="Verify"/> è <c>false</c>), mai un calcolo infinito.</summary>
    public const int MaxIterations = 10_000_000;

    /// <summary>Genera un hash nuovo (sale casuale) per la password data.</summary>
    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, DefaultIterations, HashAlgorithmName.SHA256, HashSize);
        return $"{DefaultIterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    /// <summary>Verifica una password contro un hash prodotto da <see cref="Hash"/>, con confronto a tempo costante.
    /// <c>false</c> (non un'eccezione) su un formato non valido.</summary>
    public static bool Verify(string password, string encodedHash)
    {
        if (!TryParse(encodedHash, out var iterations, out var salt, out var expected)) return false;
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    /// <summary>True se l'hash è valido ma fatto con meno iterazioni di quelle correnti: al prossimo login riuscito conviene
    /// riscriverlo con <see cref="Hash"/>.</summary>
    public static bool NeedsRehash(string encodedHash) =>
        TryParse(encodedHash, out var iterations, out _, out _) && iterations < DefaultIterations;

    private static bool TryParse(string encodedHash, out int iterations, out byte[] salt, out byte[] hash)
    {
        iterations = 0;
        salt = [];
        hash = [];
        var parts = encodedHash.Split('.', 3);
        if (parts.Length != 3 || !int.TryParse(parts[0], out iterations) || iterations <= 0 || iterations > MaxIterations) return false;
        try
        {
            salt = Convert.FromBase64String(parts[1]);
            hash = Convert.FromBase64String(parts[2]);
        }
        catch (FormatException)
        {
            return false;
        }
        return salt.Length > 0 && hash.Length > 0;
    }
}
