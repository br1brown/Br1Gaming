using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Backend.Diagnostics;

/// <summary>Coda dedicata alle segnalazioni d'errore, separata da <c>IBackgroundTaskQueue</c>: un webhook lento (5 s di
/// timeout) non deve mettere in fila import, consegne ed email di dominio, e chi chiama <c>/diagnostics/ui-fault</c>
/// (API key, nessun login) non deve poter riempire la coda dei task veri. Limitata a 256 voci, la più vecchia cade
/// quando è piena: perdere un alert sotto tempesta è meglio che fermare il sito. Non blocca mai il chiamante.</summary>
public sealed class ErrorReportQueue
{
    private readonly Channel<ErrorReport> _channel = Channel.CreateBounded<ErrorReport>(new BoundedChannelOptions(256)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true,
    });

    /// <summary>Accoda la segnalazione; con la coda piena scarta la più vecchia.</summary>
    public void Enqueue(ErrorReport report) => _channel.Writer.TryWrite(report);

    internal ChannelReader<ErrorReport> Reader => _channel.Reader;
}

/// <summary>Consuma <see cref="ErrorReportQueue"/> con al massimo quattro invii in parallelo. Risolve
/// <see cref="IErrorReportingService"/> in uno scope per segnalazione, così l'<c>HttpClient</c> tipizzato non resta
/// prigioniero di un singleton (DNS del webhook stale, connessioni mai ruotate).</summary>
internal sealed class ErrorReportDispatcher : BackgroundService
{
    private const int MaxParallel = 4;
    private readonly ErrorReportQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ErrorReportDispatcher> _logger;

    /// <inheritdoc cref="ErrorReportDispatcher"/>
    public ErrorReportDispatcher(ErrorReportQueue queue, IServiceScopeFactory scopeFactory, ILogger<ErrorReportDispatcher> logger)
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
            await Parallel.ForEachAsync(
                _queue.Reader.ReadAllAsync(stoppingToken),
                new ParallelOptions { MaxDegreeOfParallelism = MaxParallel, CancellationToken = stoppingToken },
                async (report, ct) =>
                {
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();
                        await scope.ServiceProvider.GetRequiredService<IErrorReportingService>().ReportAsync(report, ct);
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested)
                    {
                        // Shutdown: niente rumore.
                    }
                    catch (Exception ex)
                    {
                        // ReportAsync non lancia per contratto; questa è la rete sotto la rete.
                        _logger.LogWarning(ex, "Segnalazione d'errore non inviata.");
                    }
                });
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutdown a coda vuota.
        }
    }
}
