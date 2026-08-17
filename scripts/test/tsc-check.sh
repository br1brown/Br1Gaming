#!/usr/bin/env bash
# =============================================================================
# tsc-check.sh  —  Type-check del frontend via build di produzione
#
# Esegue `ng build --configuration production` sul progetto Angular — la
# STESSA configurazione del job CI ("Compila frontend"), non tsc --noEmit
# puro. Motivo: tsc --noEmit compila solo i file .ts e non controlla i
# binding nei template (es. un input tipizzato come [appAssetWidth] con
# valore fuori whitelist) — quegli errori passano dal compilatore Angular
# reale, che entra in gioco solo con ng build. Uno script che gira `tsc`
# puro può quindi dare "OK" su un errore che rompe la build di produzione,
# e farlo emergere solo in CI.
# Side effect noto: ng build scrive in frontend/dist/app/ e non viene
# ripulito da questo script — come gli altri script di scripts/test/,
# assume un ambiente CI usa-e-getta (vedi run-all.sh); in locale un
# dist/ residuo resta lì finché non lo cancelli a mano, ma non interferisce
# con run successivi (ng build lo sovrascrive).
#
# Utilizzo:
#   ./tsc-check.sh
#
# Exit code:
#   0  Nessun errore di tipo/template
#   1  Uno o più errori di build
#   2  Node.js o Angular CLI locale non disponibili — test saltato
# =============================================================================

set -euo pipefail

if [[ -t 1 ]]; then
    GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
else
    GREEN=''; RED=''; RESET=''
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/../../frontend"
NG_BIN="${FRONTEND_DIR}/node_modules/@angular/cli/bin/ng.js"

if ! command -v node >/dev/null 2>&1; then
    echo "  WARN Node.js non trovato — controllo build saltato"
    exit 2
fi

if [[ ! -f "$NG_BIN" ]]; then
    echo "  WARN Angular CLI non installato localmente (npm ci --include=dev mancante) — controllo build saltato"
    exit 2
fi

cd "$FRONTEND_DIR"

if node "$NG_BIN" build --configuration production; then
    echo -e "  ${GREEN}OK${RESET} Build di produzione (type-check incluso) superata"
else
    echo -e "  ${RED}ERR${RESET} Build di produzione fallita" >&2
    exit 1
fi
