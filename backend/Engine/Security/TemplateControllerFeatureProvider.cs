using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;
using Backend.Controllers;

namespace Backend.Security;

/// <summary>Esclude dalla discovery i controller che dipendono dal login (Auth/Protected) quando il login è disabilitato in config, prima che ASP.NET costruisca la tabella degli endpoint.</summary>
public sealed class TemplateControllerFeatureProvider : IApplicationFeatureProvider<ControllerFeature>
{
    private readonly bool _loginEnabled;

    /// <summary>True se i controller dipendenti dal login restano esposti, false se vanno esclusi.</summary>
    public TemplateControllerFeatureProvider(bool loginEnabled)
    {
        _loginEnabled = loginEnabled;
    }

    /// <summary>Rimuove dalla feature i controller non validi per la configurazione di sicurezza corrente.</summary>
    public void PopulateFeature(
        IEnumerable<ApplicationPart> parts,
        ControllerFeature feature)
    {
        _ = parts;

        if (_loginEnabled)
            return;

        RemoveControllersDerivedFrom<EngineAuthController>(feature);
        RemoveControllersDerivedFrom<EngineProtectedController>(feature);
    }

    private static void RemoveControllersDerivedFrom<TControllerBase>(ControllerFeature feature)
        where TControllerBase : ControllerBase
    {
        // .ToArray(): non si può iterare e modificare la stessa collezione.
        var toRemove = feature.Controllers
            .Where(controller => typeof(TControllerBase).IsAssignableFrom(controller.AsType()))
            .ToArray();

        foreach (var controller in toRemove)
            feature.Controllers.Remove(controller);
    }
}
