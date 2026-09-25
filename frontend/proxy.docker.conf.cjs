// Proxy del dev server Angular (dev in Docker, backend sul container 'backend:8080').
// La x-api-key viene letta da global-settings.json — stessa sorgente di verità
// usata dal backend e dal Node SSR — così non resta hardcodata e disallineata.
// La lettura della chiave è condivisa con proxy.local.conf.cjs: vedi proxy.api-key.cjs.
const { readApiKey } = require('./proxy.api-key.cjs');
// Backend spento o in timeout → 502/504 come in produzione, non il 500 di Vite: vedi proxy.gateway-error.cjs.
const { gatewayErrors } = require('./proxy.gateway-error.cjs');

module.exports = {
    '/api': {
        target: 'http://backend:8080',
        secure: false,
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
        headers: { 'x-api-key': readApiKey() },
        configure: gatewayErrors,
    },
};
