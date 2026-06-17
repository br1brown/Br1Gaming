using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Backend.Tasks;

// Sottosistema Task in background (un solo file): contratto della coda, implementazione su Channel
// e hosted service che la consuma. Un endpoint accoda e risponde subito (202); il worker esegue
// fuori dalla richiesta HTTP, ciascun task nel proprio scope DI.

/// <summary>
/// Coda di lavoro in background generica: un endpoint accoda un task e torna subito (202), il task
/// gira fuori dalla richiesta HTTP in <see cref="BackgroundTaskHostedService"/>.
/// </summary>
/// <remarks>
/// È lo stesso pattern dell'invio email (coda <see cref="System.Threading.Channels.Channel{T}"/> + hosted service), ma generico.
/// Evita l'anti-pattern <c>Task.Run</c> nel controller: lì lo scope DI viene distrutto a fine
/// richiesta, le eccezioni si perdono e non c'è stop pulito allo shutdown. Il task riceve un
/// <see cref="IServiceProvider"/> già "scopato" per risolvere i servizi scoped (store/DbContext).
/// </remarks>
public interface IBackgroundTaskQueue
{
    /// <summary>
    /// Accoda un'unità di lavoro. Ritorna <see langword="false"/> se la coda è piena (backpressure):
    /// il chiamante può tradurlo in 503. Non blocca.
    /// </summary>
    /// <param name="work">
    /// Il lavoro da eseguire: riceve un <see cref="IServiceProvider"/> con scope proprio e il
    /// <see cref="CancellationToken"/> di shutdown dell'host.
    /// </param>
    bool TryEnqueue(Func<IServiceProvider, CancellationToken, Task> work);
}

/// <summary>
/// Implementazione di <see cref="IBackgroundTaskQueue"/> su <see cref="Channel{T}"/> limitato.
/// Registrata come singleton; l'hosted service ne legge lo stream.
/// </summary>
internal sealed class ChannelBackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly Channel<Func<IServiceProvider, CancellationToken, Task>> _channel =
        Channel.CreateBounded<Func<IServiceProvider, CancellationToken, Task>>(new BoundedChannelOptions(1000)
        {
            // Bounded + Wait: TryWrite ritorna false quando è piena (non blocca mai il chiamante).
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true
        });

    /// <inheritdoc />
    public bool TryEnqueue(Func<IServiceProvider, CancellationToken, Task> work) => _channel.Writer.TryWrite(work);

    /// <summary>Stream dei task accodati, consumato dall'hosted service.</summary>
    public ChannelReader<Func<IServiceProvider, CancellationToken, Task>> Reader => _channel.Reader;
}

/// <summary>
/// Servizio in background che consuma la <see cref="ChannelBackgroundTaskQueue"/> ed esegue i task,
/// ciascuno nel proprio scope DI. Rispetta il <c>CancellationToken</c> di shutdown per uno stop pulito.
/// </summary>
internal sealed class BackgroundTaskHostedService : BackgroundService
{
    private readonly ChannelBackgroundTaskQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BackgroundTaskHostedService> _logger;

    /// <summary>Inietta la coda, la factory di scope e il logger.</summary>
    public BackgroundTaskHostedService(
        ChannelBackgroundTaskQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<BackgroundTaskHostedService> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var work in _queue.Reader.ReadAllAsync(stoppingToken))
            {
                // Scope per task: i servizi scoped (store/DbContext) sono validi e rilasciati a fine
                // task; i singleton (INotificationStream, IEmailQueue, IDeliveryService) restano ok.
                using var scope = _scopeFactory.CreateScope();
                try
                {
                    await work(scope.ServiceProvider, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break; // shutdown durante un task: stop pulito
                }
                catch (Exception ex)
                {
                    // Un task fallito non deve abbattere il worker: log e si prosegue col prossimo.
                    _logger.LogError(ex, "Task in background fallito.");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutdown a coda vuota: ReadAllAsync lancia OCE dall'enumeratore. Stop pulito, niente rumore.
        }
    }
}

/// <summary>Registrazione DI della coda di task in background del template.</summary>
public static class BackgroundTaskExtensions
{
    /// <summary>Registra la coda generica di task in background e il relativo hosted service.</summary>
    public static IServiceCollection AddTemplateBackgroundTasks(this IServiceCollection services)
    {
        services.AddSingleton<ChannelBackgroundTaskQueue>();
        services.AddSingleton<IBackgroundTaskQueue>(sp => sp.GetRequiredService<ChannelBackgroundTaskQueue>());
        services.AddHostedService<BackgroundTaskHostedService>();
        return services;
    }
}
