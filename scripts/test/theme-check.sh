#!/usr/bin/env bash
# =============================================================================
# theme-check.sh  —  Test automatici del meccanismo dei design system (Vitest)
#
# Esegue `ng test` (builder @angular/build:unit-test, runner Vitest, ambiente
# jsdom — nessun browser reale necessario): `extendDesignSystem` (merge, catene
# di extend, ruoli custom, interruttore master, risoluzione font), con fixture
# sintetiche (src/app/tests/design-system-presets.spec.ts) — mai il contenuto
# di un design system specifico (editabile a piacere) né il contrasto WCAG di
# una palette, già coperto dal vivo da scripts/test/live-audit.mjs (Pa11y).
#
# Prima di questo script, la stessa verifica viveva SOLO in uno script
# manuale rieseguito a mano ogni volta che qualcuno toccava il motore colore —
# nessuna regressione automatica.
#
# Utilizzo:
#   ./theme-check.sh
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
    echo "  WARN Node.js non trovato — test tema/design-system saltati"
    exit 2
fi

if [[ ! -f "$NG_BIN" ]]; then
    echo "  WARN Angular CLI non installato localmente (npm ci --include=dev mancante) — test saltati"
    exit 2
fi

cd "$FRONTEND_DIR"

TEST_LOG="$(mktemp)"
trap 'rm -f "$TEST_LOG"' EXIT

if node "$NG_BIN" test 2>&1 | tee "$TEST_LOG"; then
    echo -e "  ${GREEN}OK${RESET} Test tema/design-system superati"
    gh_summary_append "### 🎨 Tema/design-system (Vitest)
✅ Test superati"
else
    echo -e "  ${RED}ERR${RESET} Uno o più test tema/design-system falliti" >&2
    gh_summary_append "### 🎨 Tema/design-system (Vitest)
❌ Uno o più test falliti

<details><summary>Dettaglio (ultime 80 righe)</summary>

\`\`\`
$(tail -n 80 "$TEST_LOG")
\`\`\`

</details>"
    exit 1
fi
