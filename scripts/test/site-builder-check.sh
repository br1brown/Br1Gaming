#!/usr/bin/env bash
# Invarianti statiche di SiteBuilder (Engine) tramite site-builder-invariants.ts

set -euo pipefail

if [[ -t 1 ]]; then
    GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
else
    GREEN=''; RED=''; RESET=''
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/../../frontend"
TSX_BIN="${FRONTEND_DIR}/node_modules/.bin/tsx"
# shellcheck source=scripts/lib/gh-summary.sh
source "${SCRIPT_DIR}/../lib/gh-summary.sh"

if ! command -v node >/dev/null 2>&1; then
    echo "  WARN Node.js non trovato — controllo invarianti SiteBuilder saltato"
    exit 2
fi

if [[ ! -x "$TSX_BIN" ]]; then
    echo "  WARN tsx non installato localmente (npm ci mancante) — controllo invarianti SiteBuilder saltato"
    exit 2
fi

if [[ ! -f "${FRONTEND_DIR}/src/environments/environment.ts" ]]; then
    echo "  WARN environment.ts non generato (esegui 'npm run generate:statics' in frontend/) — controllo saltato"
    exit 2
fi

cd "$FRONTEND_DIR"

INVARIANTS_LOG="$(mktemp)"
trap 'rm -f "$INVARIANTS_LOG"' EXIT

if "$TSX_BIN" src/app/core/engine/scripts/checks/site-builder-invariants.ts 2>&1 | tee "$INVARIANTS_LOG"; then
    echo -e "  ${GREEN}OK${RESET} Invarianti SiteBuilder rispettate"
    gh_summary_append "### 🧩 Invarianti SiteBuilder
✅ $(grep -F '[site-builder-check] OK' "$INVARIANTS_LOG" | sed 's/.*\] OK — //')"
else
    echo -e "  ${RED}ERR${RESET} Invarianti SiteBuilder violate" >&2
    gh_summary_append "### 🧩 Invarianti SiteBuilder
❌ Una o più invarianti violate

<details><summary>Dettaglio</summary>

\`\`\`
$(cat "$INVARIANTS_LOG")
\`\`\`

</details>"
    exit 1
fi
