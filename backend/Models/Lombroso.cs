namespace Backend.Models;

/// <summary>Verdetto del Lombroso Scanner per l'hash ricevuto.</summary>
/// <param name="Title">Titolo del "crimine" imputato.</param>
/// <param name="Desc">Falsa motivazione pseudo-antropometrica.</param>
public sealed record LombrosoVerdictDto(string Title, string Desc);
