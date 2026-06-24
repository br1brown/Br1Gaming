using Backend.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Stories;

/// <summary>
/// Factory di registrazione delle storie in DI, gemella di <c>AddGenerators()</c>: auto-registra
/// ogni <see cref="IStory"/> concreto dell'assembly e il <see cref="StoryService"/> che le indicizza.
/// Aggiungere una storia = creare la classe in <c>Stories/Catalog/</c>, nient'altro da toccare.
/// </summary>
public static class StoryRegistration
{
    /// <summary>
    /// Auto-registra come singleton ogni <see cref="IStory"/> concreto dell'assembly e il
    /// <see cref="StoryService"/> che ne espone catalogo e motore narrativo.
    /// </summary>
    /// <param name="services">La collection dei servizi su cui registrare.</param>
    /// <returns>La stessa <paramref name="services"/>, per il chaining.</returns>
    public static IServiceCollection AddStories(this IServiceCollection services)
    {
        foreach (var storyType in typeof(IStory).Assembly.GetTypes()
                     .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(IStory).IsAssignableFrom(t)))
            services.AddSingleton(typeof(IStory), storyType);

        services.AddSingleton<StoryService>();
        return services;
    }
}
