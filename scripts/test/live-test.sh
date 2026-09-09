#!/usr/bin/env bash
# =============================================================================
# live-test.sh  —  Audit live: Pa11y (WCAG 2.1 AA) + Lighthouse (performance/
#                   best-practices/SEO) su un server in esecuzione, un browser condiviso.
#
# Wrapper attorno a live-audit.mjs: rileva dipendenze Chrome e gestisce l'exit code.
#
# Utilizzo:
#   ./live-test.sh BASE_URL [PATH ...]
#
# Esempi:
#   ./live-test.sh http://localhost:3000               # scoperta automatica via /health
#   ./live-test.sh http://app.localhost:8088 / /social  # solo i path indicati
#
# Variabili d'ambiente: vedi l'intestazione di live-audit.mjs (PUPPETEER_EXECUTABLE_PATH,
# A11Y_*, LH_TIMEOUT, LIGHTHOUSE_DYNAMIC_MAX).
#
# Exit code:
#   0  Nessuna violazione WCAG, tutti i budget Lighthouse rispettati
#   1  Una o più violazioni WCAG e/o pagine sotto budget
#   2  Dipendenze non disponibili, o path da auditare non scopribili — test saltato
# =============================================================================

set -euo pipefail

if [[ -t 1 ]]; then
    BOLD='\033[1m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
else
    BOLD=''; YELLOW=''; RED=''; RESET=''
fi

info() { echo -e "  ${BOLD}[info]${RESET} $*"; }
warn() { echo -e "  ${YELLOW}WARN${RESET} $*"; }
fail() { echo -e "  ${RED}ERR${RESET} $*" >&2; }

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

if [[ $# -lt 1 ]]; then
    echo "Uso: $0 BASE_URL [PATH ...]" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
    warn "Node.js non trovato — audit live saltato"
    exit 2
fi

# Rileva Chrome/Chromium
if [[ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]]; then
    for candidate in \
        "$(which google-chrome-stable 2>/dev/null || true)" \
        "$(which google-chrome       2>/dev/null || true)" \
        "$(which chromium-browser    2>/dev/null || true)" \
        "$(which chromium            2>/dev/null || true)"; do
        if [[ -n "$candidate" && -x "$candidate" ]]; then
            export PUPPETEER_EXECUTABLE_PATH="$candidate"
            break
        fi
    done
fi

if [[ -n "${PUPPETEER_EXECUTABLE_PATH:-}" ]]; then
    info "Chrome: ${PUPPETEER_EXECUTABLE_PATH}"
else
    warn "Chrome non trovato in PATH — verrà usato il browser bundled di Puppeteer (primo avvio lento)"
fi

node "${SCRIPT_DIR}/live-audit.mjs" "$@"
