using Backend.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Generators;

/// <summary>
/// Marcatore: un <see cref="IGenerator"/> che lo implementa NON viene auto-registrato da
/// <see cref="GeneratorRegistration.AddGenerators"/>, quindi non compare mai nel catalogo pubblico
/// (<c>GET /generators</c>) né è raggiungibile da <c>GeneratorService</c>. Serve a riusare tutta
/// l'infrastruttura di authoring (<see cref="GeneratorBase"/>, <see cref="Tag"/>, <see cref="Frase"/>,
/// <see cref="GeneratorVariant"/>, <see cref="RuntimeBuilder"/>, <see cref="Grammar.Composer"/>) per
/// contenuti che il motore compone ma che un servizio DEDICATO orchestra a modo suo — es.
/// <see cref="Services.LombrosoScanner"/>, che sceglie la <c>GeneratorVariant</c> dall'hash del client
/// invece che a caso. Il tipo va comunque istanziato e compilato a mano (<c>new(...)</c> +
/// <c>RuntimeBuilder.Build</c>): l'auto-discovery lo ignora, non lo sostituisce.
/// </summary>
public interface IHiddenGenerator : IGenerator;

/// <summary>
/// Factory di registrazione dei generatori in DI, sullo stile delle <c>AddTemplate*()</c> dell'Engine
/// (es. <c>AddTemplateNotifications()</c>): incapsula il wiring così <c>Program.cs</c> resta una riga.
/// </summary>
public static class GeneratorRegistration
{
    /// <summary>
    /// Auto-registra come singleton ogni <see cref="IGenerator"/> concreto dell'assembly — tranne quelli
    /// marcati <see cref="IHiddenGenerator"/> (vedi lì) — e il <see cref="GeneratorService"/> che li
    /// indicizza per slug e tipo. Aggiungere un generatore PUBBLICO = creare la classe, nient'altro da
    /// toccare; aggiungerne uno nascosto = farla implementare <see cref="IHiddenGenerator"/> e orchestrarla
    /// a mano altrove (mai tramite questo metodo).
    /// </summary>
    /// <param name="services">La collection dei servizi su cui registrare.</param>
    /// <returns>La stessa <paramref name="services"/>, per il chaining.</returns>
    public static IServiceCollection AddGenerators(this IServiceCollection services)
    {
        foreach (var generatorType in typeof(IGenerator).Assembly.GetTypes()
                     .Where(t => t is { IsClass: true, IsAbstract: false }
                                 && typeof(IGenerator).IsAssignableFrom(t)
                                 && !typeof(IHiddenGenerator).IsAssignableFrom(t)))
            services.AddSingleton(typeof(IGenerator), generatorType);

        services.AddSingleton<GeneratorService>();
        return services;
    }
}
