
using System.Reflection;

namespace Backend.Generators;

/// <summary>
/// La <b>base "blackbox"</b> di ogni generatore: chiude dentro di sé tutta la parte tecnologica del
/// motore (scoperta dei tag via reflection, default neutri per ogni membro di <see cref="IGenerator"/>,
/// aggancio a compilazione/validazione/composizione) ed espone all'autore una superficie minima e
/// documentata. Per scrivere un generatore si estende questa classe e si sovrascrive:
/// <list type="number">
///   <item><b>OBBLIGATORIO</b> — <see cref="Slug"/> (l'URL) e <see cref="Info"/> (nome, descrizione, ordine).</item>
///   <item><b>CONTENUTO</b> — quello che il generatore ha da dire: <see cref="Core"/> (le frasi), e a
///         piacere <see cref="Apertura"/>/<see cref="Chiusura"/>, <see cref="PhraseSettings"/> (min/max
///         frasi, separatori, soglia) e <see cref="Variant"/> (una scelta offerta prima di generare,
///         es. il segno; legge il dizionario d'ingresso passato a <c>GeneratorService.Generate</c>).</item>
///   <item><b>TAG INTERNI</b> — i propri <see cref="Tag"/> come campi statici della classe: dichiararli
///         È dichiarare le liste (li scopre <see cref="Liste"/>/<see cref="Composte"/> da soli).</item>
/// </list>
/// Tutto il resto (<see cref="ComposeWith"/>, <see cref="CoreRequired"/>, <see cref="UniqueLabels"/>,
/// <see cref="ExclusiveGroups"/>, <see cref="PolicyGroups"/>) è <b>avanzato e opzionale</b>: ha default
/// sensati e si tocca solo per composizioni/regole particolari. L'autore non vede né gestisce il motore.
/// </summary>
public abstract class GeneratorBase : IGenerator
{
    /// <inheritdoc />
    public abstract string Slug { get; }

    /// <inheritdoc />
    public abstract GeneratorInfo Info { get; }

    /// <inheritdoc />
    public virtual GeneratorVariant? Variant => null;

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
