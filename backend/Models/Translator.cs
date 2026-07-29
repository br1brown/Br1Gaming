namespace Backend.Models;

/// <summary>Body della traduzione: il testo italiano da tradurre in "finto spagnolo".</summary>
/// <param name="Text">Testo italiano di partenza (può essere null/vuoto → risposta vuota).</param>
public sealed record TranslateRequestDto(string? Text);

/// <summary>Esito della traduzione.</summary>
/// <param name="Text">Testo tradotto in "finto spagnolo".</param>
public sealed record TranslateResultDto(string Text);
