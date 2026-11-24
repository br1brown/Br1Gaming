#!/usr/bin/env bash
# =============================================================================
# a11y-check.sh  —  Controlli di accessibilità su un server in esecuzione che Pa11y non fa:
#                   axe in tema chiaro e scuro, contrasto del focus da tastiera (1.4.11) e dialoghi
#                   (nome, X, Escape, focus di ritorno). Vedi a11y-checks.mjs.
#
# Utilizzo:  ./a11y-check.sh BASE_URL [PATH ...]
# Exit code: 0 ok · 1 violazioni · 2 dipendenze non disponibili (saltato)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi
if [[ $# -lt 1 ]]; then echo "Uso: $0 BASE_URL [PATH ...]" >&2; exit 1; fi
if ! command -v node >/dev/null 2>&1; then echo "  WARN Node.js non trovato — controllo saltato"; exit 2; fi

if [[ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]]; then
    for candidate in "$(which google-chrome-stable 2>/dev/null || true)" "$(which google-chrome 2>/dev/null || true)" \
                     "$(which chromium-browser 2>/dev/null || true)" "$(which chromium 2>/dev/null || true)"; do
        if [[ -n "$candidate" && -x "$candidate" ]]; then export PUPPETEER_EXECUTABLE_PATH="$candidate"; break; fi
    done
fi

node "${SCRIPT_DIR}/a11y-checks.mjs" "$@"
