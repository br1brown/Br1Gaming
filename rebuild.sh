#!/usr/bin/env bash
# =============================================================================
# rebuild.sh — Deploy e rebuild produzione Br1WebEngine
#
# Uso:
#   ./rebuild.sh          Controlla .env, poi ricostruisce e riavvia
#   ./rebuild.sh --help   Mostra questo messaggio
#
# Prima installazione: cp .env.example .env, edita .env, poi ./rebuild.sh
# Per esporre il backend sull'host: imposta EXPOSE_BACKEND=yes in .env
# =============================================================================

set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    sed -n '2,10p' "$0" | sed 's/^# \?//'
    exit 0
fi

# ── Colori ─────────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
    BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
else
    BOLD=''; GREEN=''; YELLOW=''; RED=''; RESET=''
fi

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}!${RESET} $*"; }
fail() { echo -e "  ${RED}✗${RESET} $*" >&2; ERRORS=$(( ERRORS + 1 )); }

env_get() { grep -E "^${1}=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true; }

ERRORS=0

# ── Prerequisiti ───────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}Controllo prerequisiti...${RESET}"

command -v docker &>/dev/null      && ok "Docker trovato" || { echo -e "  ${RED}✗${RESET} Docker non trovato" >&2; exit 1; }
docker compose version &>/dev/null && ok "docker compose trovato" || { echo -e "  ${RED}✗${RESET} Plugin 'docker compose' non trovato" >&2; exit 1; }
[[ -f docker-compose.yml ]]        && ok "docker-compose.yml presente" || { echo -e "  ${RED}✗${RESET} docker-compose.yml non trovato — eseguire dalla root del progetto" >&2; exit 1; }

# ── Controllo .env ─────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}Controllo .env...${RESET}"

if [[ ! -f .env ]]; then
    echo -e "  ${RED}✗${RESET} File .env non trovato." >&2
    echo -e "    Crea il file di configurazione e riprova:" >&2
    echo -e "      cp .env.example .env" >&2
    echo -e "      # edita .env con i tuoi valori, poi:" >&2
    echo -e "      ./rebuild.sh" >&2
    exit 1
fi
ok ".env presente"

# Variabili obbligatorie e placeholder
PROJECT_NAME=$(env_get PROJECT_NAME)
FRONTEND_PORT=$(env_get FRONTEND_PORT)

[[ -z "$PROJECT_NAME" ]]          && fail "PROJECT_NAME non impostato in .env"
[[ "$PROJECT_NAME" == "CHANGE_ME" ]] && fail "PROJECT_NAME è ancora il placeholder 'CHANGE_ME'"
[[ -z "$FRONTEND_PORT" ]]         && fail "FRONTEND_PORT non impostato in .env"

[[ -n "$PROJECT_NAME" && "$PROJECT_NAME" != "CHANGE_ME" ]] && ok "PROJECT_NAME = $PROJECT_NAME"
[[ -n "$FRONTEND_PORT" ]] && ok "FRONTEND_PORT = $FRONTEND_PORT"

# Avvisi di sicurezza (non bloccanti)
JWT_SECRET=$(env_get Security__Token__SecretKey)
CORS=$(env_get Security__CorsOrigins__0)
EXPOSE=$(env_get EXPOSE_BACKEND)
API_URL=$(env_get API_URL)

if [[ -z "$JWT_SECRET" ]]; then
    warn "Security__Token__SecretKey non impostata — login JWT disabilitato (ok se non serve)"
elif [[ "$JWT_SECRET" == "CAMBIAMI_MIN_32_CHARS" ]]; then
    fail "Security__Token__SecretKey è ancora il placeholder. Impostare una chiave reale."
else
    ok "JWT SecretKey impostata"
fi

if [[ "$EXPOSE" == "yes" || -n "$API_URL" ]] && [[ -z "$CORS" ]]; then
    warn "Security__CorsOrigins__0 non impostata — il backend accetta richieste da qualunque dominio"
fi

# ── Blocca se ci sono errori ───────────────────────────────────────────────────
if (( ERRORS > 0 )); then
    echo
    echo -e "  ${RED}Trovati $ERRORS errori. Correggere .env prima di procedere.${RESET}" >&2
    exit 1
fi

# ── Determina comando compose ──────────────────────────────────────────────────
if [[ "$EXPOSE" == "yes" ]]; then
    if [[ ! -f docker-compose.backend-exposed.yml ]]; then
        warn "EXPOSE_BACKEND=yes ma docker-compose.backend-exposed.yml non trovato — procedo senza"
        COMPOSE="docker compose -f docker-compose.yml"
    else
        COMPOSE="docker compose -f docker-compose.yml -f docker-compose.backend-exposed.yml"
        ok "Backend esposto sull'host (porta $(env_get BACKEND_PORT))"
    fi
else
    COMPOSE="docker compose -f docker-compose.yml"
    ok "Backend interno alla rete Docker"
fi

# ── Deploy ─────────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}Avvio rebuild...${RESET}"
echo
$COMPOSE up -d --build
echo
echo -e "  ${GREEN}✓ Deploy completato.${RESET}"
echo
echo "  Logs:  docker compose -f docker-compose.yml logs -f"
echo "  Stato: docker compose -f docker-compose.yml ps"
echo
