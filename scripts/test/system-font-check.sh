#!/usr/bin/env bash
# =============================================================================
# system-font-check.sh  —  Test automatici sull'endpoint system-font (Vitest)
#
# Esegue `ng test` (builder @angular/build:unit-test, runner Vitest, ambiente
# jsdom — nessun browser reale necessario): copre `systemFontHandler` dal vivo
# (src/app/tests/system-font-endpoint.spec.ts) — reachability e adversarial
# (key/indice invalidi, path traversal, file assente su disco), mai il
# contenuto di un design system specifico né il contrasto WCAG di una
# palette, coperto dal vivo da scripts/test/live-audit.mjs (Pa11y).
#
# Utilizzo:
#   ./system-font-check.sh
#
# Exit code:
#   0  Tutti i test superati
#   1  Uno o più test falliti
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
# shellcheck source=scripts/lib/gh-summary.sh
source "${SCRIPT_DIR}/../lib/gh-summary.sh"

if ! command -v node >/dev/null 2>&1; then
    echo "  WARN Node.js non trovato — test endpoint system-font saltati"
    exit 2
fi

if [[ ! -f "$NG_BIN" ]]; then
    echo "  WARN Angular CLI non installato localmente (npm ci --include=dev mancante) — test saltati"
    exit 2
fi

cd "$FRONTEND_DIR"

# Il binario ng salta i pre-hook npm: il tema Sass (generated/_theme.scss) e gli statici si generano qui.
if ! npm run --silent generate:statics; then
    echo -e "  ${RED}ERR${RESET} generate:statics fallito" >&2
    exit 1
fi

TEST_LOG="$(mktemp)"
trap 'rm -f "$TEST_LOG"' EXIT

if node "$NG_BIN" test 2>&1 | tee "$TEST_LOG"; then
    echo -e "  ${GREEN}OK${RESET} Test endpoint system-font superati"
    gh_summary_append "### 🔤 Endpoint system-font (Vitest)
✅ Test superati"
else
    echo -e "  ${RED}ERR${RESET} Uno o più test endpoint system-font falliti" >&2
    gh_summary_append "### 🔤 Endpoint system-font (Vitest)
❌ Uno o più test falliti

<details><summary>Dettaglio (ultime 80 righe)</summary>

\`\`\`
$(tail -n 80 "$TEST_LOG")
\`\`\`

</details>"
    exit 1
fi
