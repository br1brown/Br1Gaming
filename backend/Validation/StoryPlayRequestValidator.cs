using FluentValidation;
using Microsoft.Extensions.Localization;
using Backend.Models;

namespace Backend.Validation;

/// <summary>
/// Validator per <see cref="StoryPlayRequestDto"/>: limiti strutturali sul body del play.
/// </summary>
/// <remarks>
/// Tutti i campi sono opzionali (nessuno = start): qui si mettono solo tetti di sanità
/// su lunghezze e dimensioni — l'esistenza di scena e scelta la verifica il motore
/// narrativo, che risponde con le sue eccezioni.
/// </remarks>
public class StoryPlayRequestValidator : AbstractValidator<StoryPlayRequestDto>
{
    // Gli id di scena e scelta reali sono brevi ("tono_live", "A"): 64 è già abbondante.
    private const int MaxIdLength = 64;

    // Le storie usano una manciata di stat: un body con più di 32 voci non è un salvataggio.
    private const int MaxStatsEntries = 32;

    /// <summary>Regole di validazione del play, con messaggi localizzati via resx.</summary>
    public StoryPlayRequestValidator(IStringLocalizer<SharedResource> localizer)
    {
        RuleFor(x => x.SceneId)
            .MaximumLength(MaxIdLength).WithMessage(_ => localizer["play_id_length"].Value);

        RuleFor(x => x.ChoiceId)
            .MaximumLength(MaxIdLength).WithMessage(_ => localizer["play_id_length"].Value);

        RuleFor(x => x.Stats)
            .Must(stats => stats is null || stats.Count <= MaxStatsEntries)
            .WithMessage(_ => localizer["play_stats_too_many"].Value);
    }
}
