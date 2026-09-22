using Microsoft.Extensions.Localization;

// L'assembly si chiama "backend" (minuscolo) ma il root namespace è "Backend": senza questo
// attributo IStringLocalizer comporrebbe il prefisso risorse dal nome assembly e non troverebbe i .resx.
[assembly: RootNamespace("Backend")]

namespace Backend;

/// <summary>Tipo-ancora per <see cref="IStringLocalizer{T}"/>, senza logica: individua i .resx condivisi.</summary>
public sealed class SharedResource
{
}
