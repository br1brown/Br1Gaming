namespace Backend.Models;

/// <summary>
/// Registro esplicito dei generatori disponibili.
/// Per aggiungere un nuovo generatore: aggiungere qui l'entry e creare il JSON in data/generators/.
/// </summary>
public static class GeneratorRegistry
{
    public static readonly GeneratorEntry Incel = new("incel", "Generatore Incel");
    public static readonly GeneratorEntry Auto = new("auto", "Generatore Auto");
    public static readonly GeneratorEntry Antiveg = new("antiveg", "Generatore Antiveg");
    public static readonly GeneratorEntry Locali = new("locali", "Generatore Nomi Bar");
    public static readonly GeneratorEntry Mbeb = new("mbeb", "Generatore Mbeb");

    /// <summary>Tutti i generatori registrati, nell'ordine di visualizzazione.</summary>
    public static readonly GeneratorEntry[] All = [Incel, Auto, Antiveg, Locali, Mbeb];

    /// <summary>Verifica se uno slug corrisponde a un generatore registrato.</summary>
    public static bool IsValid(string slug) =>
        Array.Exists(All, e => e.Slug == slug);

    /// <summary>Restituisce l'entry per slug, o null se non registrato.</summary>
    public static GeneratorEntry? Find(string slug) =>
        Array.Find(All, e => e.Slug == slug);
}

public record GeneratorEntry(string Slug, string DisplayName);
