using Backend.Models;

namespace Backend.Generators;

/// <summary>
/// Base comune dei generatori: fornisce i default neutri per tutti i membri opzionali di
/// <see cref="IGenerator"/>. Una classe concreta deve fornire almeno <see cref="Slug"/> e
/// <see cref="Info"/>, e fa override solo dei contenuti che le appartengono.
/// </summary>
public abstract class GeneratorBase : IGenerator
{
    /// <inheritdoc />
    public abstract string Slug { get; }

    /// <inheritdoc />
    public abstract GeneratorInfo Info { get; }

    /// <inheritdoc />
    public virtual IReadOnlyList<string> ComposeWith => [];

    /// <inheritdoc />
    public virtual GenerationSettings? PhraseSettings => null;

    /// <inheritdoc />
    public virtual RequiredInjectData? CoreRequired => null;

    /// <inheritdoc />
    public virtual string? Apertura => null;

    /// <inheritdoc />
    public virtual string? Chiusura => null;

    /// <inheritdoc />
    public virtual List<ScoredItem> Core => [];

    /// <inheritdoc />
    public virtual Dictionary<string, List<ScoredItem>> FlatLists => [];

    /// <inheritdoc />
    public virtual List<string>? UniqueLabels => null;

    /// <inheritdoc />
    public virtual List<string>? ExclusiveGroups => null;
}
