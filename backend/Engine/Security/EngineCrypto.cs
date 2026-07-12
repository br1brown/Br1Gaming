using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Backend.Models.Configuration;

namespace Backend.Security;

/// <summary>
/// Servizio "cappello" dell'engine per cifrare byte arbitrari con AES-256-GCM.
/// </summary>
/// <remarks>
/// Non e' legato a un caso d'uso specifico (es. l'export dati personali in
/// <see cref="Controllers.EngineDataPrivacyController"/>): qualunque parte dell'engine che debba
/// proteggere un payload la inietta e chiama <see cref="Encrypt"/>/<see cref="Decrypt"/>.
/// </remarks>
public interface IEngineCrypto
{
    /// <summary>Cifra <paramref name="plaintext"/>. Output: nonce (12 byte) ‖ ciphertext ‖ auth tag (16 byte).</summary>
    byte[] Encrypt(byte[] plaintext);

    /// <summary>Decifra un blob prodotto da <see cref="Encrypt"/>. Lancia se manomesso o troncato.</summary>
    byte[] Decrypt(byte[] blob);
}

/// <inheritdoc cref="IEngineCrypto"/>
public sealed class EngineCrypto : IEngineCrypto
{
    private const int NonceLength = 12;
    private const int TagLength = 16;

    private readonly byte[] _key;

    /// <summary>
    /// Deriva la chiave AES da <see cref="SecurityOptions.CryptoSecret"/> con un'etichetta fissa di
    /// domain-separation: anche riusando per errore lo stesso valore altrove, la chiave qui resta diversa.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// <see cref="SecurityOptions.CryptoSecret"/> e' vuota. Va valorizzata in
    /// <c>global-settings.local.json</c> — <c>setup.mjs</c> la genera gia' alla nascita del progetto
    /// (<c>openssl rand -base64 32</c> per chi la rigenera a mano).
    /// </exception>
    public EngineCrypto(IOptions<SecurityOptions> options)
    {
        var secret = options.Value.CryptoSecret;
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException(
                "EngineCrypto richiede Security.CryptoSecret valorizzata in global-settings.local.json. " +
                "Generarla con: openssl rand -base64 32.");

        _key = SHA256.HashData(Encoding.UTF8.GetBytes("br1-engine-crypto:" + secret));
    }

    /// <inheritdoc />
    public byte[] Encrypt(byte[] plaintext)
    {
        // Nonce casuale a ogni chiamata: mai deterministico, a differenza del gemello frontend
        // (PreviewCrypto) che lo deriva dal payload apposta per URL cacheable — qui il payload
        // e' spesso sensibile e due cifrature identiche non devono produrre lo stesso blob.
        var nonce = RandomNumberGenerator.GetBytes(NonceLength);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagLength];

        using (var aes = new AesGcm(_key, TagLength))
            aes.Encrypt(nonce, plaintext, ciphertext, tag);

        var blob = new byte[NonceLength + ciphertext.Length + TagLength];
        Buffer.BlockCopy(nonce, 0, blob, 0, NonceLength);
        Buffer.BlockCopy(ciphertext, 0, blob, NonceLength, ciphertext.Length);
        Buffer.BlockCopy(tag, 0, blob, NonceLength + ciphertext.Length, TagLength);
        return blob;
    }

    /// <inheritdoc />
    public byte[] Decrypt(byte[] blob)
    {
        if (blob.Length <= NonceLength + TagLength)
            throw new ArgumentException("Blob troppo corto per contenere nonce e auth tag AES-GCM.", nameof(blob));

        var nonce = blob.AsSpan(0, NonceLength);
        var tagStart = blob.Length - TagLength;
        var ciphertext = blob.AsSpan(NonceLength, tagStart - NonceLength);
        var tag = blob.AsSpan(tagStart, TagLength);

        var plaintext = new byte[ciphertext.Length];
        using (var aes = new AesGcm(_key, TagLength))
            aes.Decrypt(nonce, ciphertext, tag, plaintext);
        return plaintext;
    }
}
