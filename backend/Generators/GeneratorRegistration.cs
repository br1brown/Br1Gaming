using Backend.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Generators;

/// <summary>
/// Factory di registrazione dei generatori in DI, sullo stile delle <c>AddTemplate*()</c> dell'Engine
/// (es. <c>AddTemplateNotifications()</c>): incapsula il wiring così <c>Program.cs</c> resta una riga.
/// </summary>
public static class GeneratorRegistration
{
    /// <summary>
    /// Auto-registra come singleton ogni <see cref="IGenerator"/> concreto dell'assembly (stessa
    /// filosofia dell'auto-registrazione dei validator) e il <see cref="GeneratorService"/> che li
    /// indicizza per slug e tipo. Aggiungere un generatore = creare la classe, nient'altro da toccare.
    /// </summary>
    /// <param name="services">La collection dei servizi su cui registrare.</param>
    /// <returns>La stessa <paramref name="services"/>, per il chaining.</returns>
    public static IServiceCollection AddGenerators(this IServiceCollection services)
    {
        foreach (var generatorType in typeof(IGenerator).Assembly.GetTypes()
                     .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(IGenerator).IsAssignableFrom(t)))
            services.AddSingleton(typeof(IGenerator), generatorType);

        services.AddSingleton<GeneratorService>();
        return services;
    }
}
