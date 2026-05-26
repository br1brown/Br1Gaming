#!/usr/bin/env bash
# =============================================================================
# public-test.sh — Alza lo stack dietro un reverse proxy nginx, come lo vedrebbe
#                  un visitatore esterno, e lo lascia acceso per i test live
#                  (a11y / Lighthouse). NON fa deploy in produzione.
#
# deploy.sh resta dedicato alla sola pubblicazione; questo harness di test vive qui.
# Lo usano la CI (job live-tests) e il git hook pre-push (RUN_LIVE_TESTS=1).
#
# Uso:
#   bash scripts/test/public-test.sh                 # alza lo stack su :8088 e lo lascia su
#   bash scripts/test/public-test.sh --down-after    # lo spegne alla fine
#   bash scripts/test/public-test.sh --public-port 9090
#   bash scripts/test/public-test.sh --no-cache
#
# Poi:
#   bash scripts/test/a11y-test.sh       http://localhost:8088
#   bash scripts/test/lighthouse-test.sh http://localhost:8088
#
# Teardown manuale:
#   COMPOSE_PROJECT_NAME=<slug> docker compose -f docker-compose.yml -f docker-compose.public-test.yml down
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

NO_CACHE=false
DOWN_AFTER=false
PUBLIC_HOST="localhost"
PUBLIC_PORT="8088"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-cache) NO_CACHE=true; shift ;;
        --down-after) DOWN_AFTER=true; shift ;;
        --public-host) PUBLIC_HOST="$2"; shift 2 ;;
        --public-port) PUBLIC_PORT="$2"; shift 2 ;;
        *) echo "  WARN opzione sconosciuta ignorata: $1" >&2; shift ;;
    esac
done

if [[ -t 1 ]]; then
    BOLD='\033[1m'; GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
else
    BOLD=''; GREEN=''; RED=''; RESET=''
fi
info() { echo -e "  ${BOLD}[info]${RESET} $*"; }
ok()   { echo -e "  ${GREEN}OK${RESET} $*"; }

command -v docker >/dev/null 2>&1 || { echo -e "  ${RED}ERR${RESET} Docker non trovato" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "  ${RED}ERR${RESET} Node.js non trovato" >&2; exit 1; }

# shellcheck source=scripts/lib/br1-config.sh
source "${ROOT}/scripts/lib/br1-config.sh"
br1_load_config || { echo -e "  ${RED}ERR${RESET} Lettura/merge della config fallito" >&2; exit 1; }

compose_files=(-f docker-compose.yml)
[[ "${EXPOSE_BACKEND:-no}" == "yes" && -f docker-compose.backend-exposed.yml ]] && compose_files+=(-f docker-compose.backend-exposed.yml)
compose_files+=(-f docker-compose.public-test.yml)

compose_test() {
    env \
        PUBLIC_TEST_PORT="${PUBLIC_PORT}" \
        PUBLIC_TEST_BASE_URL="http://${PUBLIC_HOST}:${PUBLIC_PORT}" \
        PUBLIC_TEST_ALLOWED_HOSTS="${PUBLIC_HOST}" \
        BACKEND_PORT="${BACKEND_PORT:-8080}" \
        docker compose "${compose_files[@]}" "$@"
}

# NB: deve uscire con 0 quando non c'è nulla da fare. Un `[[ ]] && {...}` qui
# ritornerebbe 1 con DOWN_AFTER=false e, girando sul trap EXIT come ultimo comando,
# farebbe terminare l'intero script con codice 1 anche a stack avviato correttamente.
cleanup() {
    if [[ "$DOWN_AFTER" == true ]]; then
        info "Arresto dello stack di test..."
        compose_test down
    fi
}
trap cleanup EXIT

echo
echo -e "${BOLD}Public test${RESET}"
info "URL pubblico: http://${PUBLIC_HOST}:${PUBLIC_PORT}"

if [[ "$NO_CACHE" == true ]]; then
    compose_test build --no-cache
else
    compose_test build
fi

# --wait usa gli HEALTHCHECK di frontend/backend; il proxy parte dopo il frontend.
compose_test up -d --wait --wait-timeout 120

# Verifica che il proxy pubblico risponda (è il punto d'ingresso dei test live).
for i in $(seq 1 30); do
    status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:${PUBLIC_PORT}/health" || true)"
    [[ "$status" == "200" ]] && break
    sleep 2
done
if [[ "${status:-}" == "200" ]]; then
    ok "Proxy pubblico raggiungibile (HTTP 200)"
else
    echo -e "  ${RED}ERR${RESET} Il proxy pubblico non risponde su /health" >&2
    compose_test logs --tail 20
    exit 1
fi

echo
ok "Stack di test pronto su http://${PUBLIC_HOST}:${PUBLIC_PORT}"
