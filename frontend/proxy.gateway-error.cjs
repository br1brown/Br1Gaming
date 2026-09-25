// Senza questo, Vite risponde 500 anche a backend spento/lento: stessa mappa 502/504 del proxy SSR di produzione, per vedere in dev la pagina d'errore che vede l'utente.
function gatewayErrors(proxy) {
    proxy.on('error', (err, _req, res) => {
        if (typeof res.writeHead !== 'function' || res.headersSent || res.writableEnded) return; // socket (WS) o risposta già partita
        const isTimeout = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
        const status = isTimeout ? 504 : 502;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status,
            title: isTimeout ? 'Gateway Timeout' : 'Bad Gateway',
            detail: isTimeout ? 'Il backend non ha risposto in tempo.' : 'Il backend non è raggiungibile.',
        }));
    });
}

module.exports = { gatewayErrors };
