#!/bin/sh
# Avvia il server Node SSR del frontend Angular.
PORT="${PORT:-3000}"
DIST_PATH="${DIST_PATH:-app}"

echo "[entrypoint] PORT=${PORT}"

# Refresh cache fontconfig: /app/fonts è già una cartella nota a fontconfig (vedi Dockerfile), ma
# è vuota al build — il volume del font custom si monta solo ora, all'avvio del container. Senza
# questo refresh fc-match/Sharp non troverebbero il font anche se il file c'è davvero: le immagini
# OG userebbero un fallback silenzioso, con le METRICHE (calcolate a parte dal parser TTF diretto
# di server-font-metrics.ts) disallineate dal font realmente disegnato. Silenzioso: fontconfig è già
# installato, questo comando non può mancare — se fallisce non è un problema di configurazione mancante.
fc-cache -f /app/fonts 2>&1 || true

exec node "/app/dist/${DIST_PATH}/server/server.mjs"
