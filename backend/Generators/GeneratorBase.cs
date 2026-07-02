
using System.Reflection;

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
    public virtual Frase? Apertura => null;

    /// <inheritdoc />
    public virtual Frase? Chiusura => null;

    /// <inheritdoc />
    public virtual List<Frase> Core => [];

    /// <inheritdoc />
    /// <remarks>Scoperti via reflection dai campi statici di tipo <see cref="Tag"/> che possiedono
    /// voci — stessa filosofia dell'auto-registrazione dei generatori: dichiarare = fatto. I tag
    /// nudi (alias, riferimenti) non contano. Calcolato una volta per istanza.</remarks>
    public virtual IReadOnlyList<Tag> Liste => _liste ??=
        [.. GetType().GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
            .Where(campo => campo.FieldType == typeof(Tag))
            .Select(campo => (Tag)campo.GetValue(null)!)
            .Where(tag => tag.HaVoci)];
    private IReadOnlyList<Tag>? _liste;

    /// <inheritdoc />
    /// <remarks>Le UNIONI (<see cref="Tag.Unione"/>): scoperte come le <see cref="Liste"/> dai campi
    /// statici, ma qui contano quelle che portano le chiavi-componenti (niente voci proprie).</remarks>
    public virtual IReadOnlyList<Tag> Composte => _composte ??=
        [.. GetType().GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
            .Where(campo => campo.FieldType == typeof(Tag))
            .Select(campo => (Tag)campo.GetValue(null)!)
            .Where(tag => tag.Componenti is not null)];
    private IReadOnlyList<Tag>? _composte;

    /// <summary>
    /// Innesto in una frase della generazione di un ALTRO generatore: <c>{Genera("locali")}</c> esegue
    /// il generatore dei bar e ne incolla il testo. Lo slug è validato al boot (esistenza + niente
    /// cicli tra generatori), quindi un refuso non arriva mai a runtime.
    /// </summary>
    /// <param name="slug">Lo slug del generatore da eseguire.</param>
    protected static Innesto Genera(string slug) => new(slug);

    /// <inheritdoc />
    public virtual List<Etichetta>? UniqueLabels => null;

    /// <inheritdoc />
    public virtual List<string>? ExclusiveGroups => null;

    /// <inheritdoc />
    public virtual IReadOnlyDictionary<string, IReadOnlyList<string>>? PolicyGroups => null;
}
