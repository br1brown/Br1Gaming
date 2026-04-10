// Proxy del dev server Angular (sviluppo locale, backend su localhost:5000).
// La x-api-key viene letta da global-settings.json + override global-settings.local.json
// (i segreti) — stessa sorgente di verità e stesso deep-merge del backend e del Node SSR,
// così non resta hardcodata e disallineata. In dev locale la chiave vive in .local.json.
// La lettura della chiave è condivisa con proxy.docker.conf.cjs: vedi proxy.api-key.cjs.
const { readApiKey } = require('./proxy.api-key.cjs');

module.exports = {
    '/api': {
        target: 'http://localhost:5000',
        secure: false,
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
        headers: { 'x-api-key': readApiKey() },
    },
};
