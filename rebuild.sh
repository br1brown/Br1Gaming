#!/usr/bin/env bash
# =============================================================================
# rebuild.sh — Deploy e rebuild produzione Br1WebEngine
#
# Uso:
#   ./rebuild.sh          Controlla .env, poi ricostruisce e riavvia
#   ./rebuild.sh --help   Mostra questo messaggio
#
# Prima installazione: cp .env.example .env, edita .env, poi ./rebuild.sh
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

env_get() {
    local key="$1"
    local line

    line=$(grep -E "^[[:space:]]*${key}=" .env 2>/dev/null | tail -n 1 || true)
    line="${line#*=}"

    if [[ "$line" =~ ^\"(.*)\"$ ]]; then
        printf '%s\n' "${BASH_REMATCH[1]}"
        return
    fi

    if [[ "$line" =~ ^\'(.*)\'$ ]]; then
        printf '%s\n' "${BASH_REMATCH[1]}"
        return
    fi

    printf '%s\n' "$line"
}

ERRORS=0

# ── Prerequisiti ───────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}Controllo prerequisiti...${RESET}"

command -v docker &>/dev/null      && ok "Docker trovato" || { echo -e "  ${RED}✗${RESET} Docker non trovato" >&2; exit 1; }
docker compose version &>/dev/null && ok "docker compose trovato" || { echo -e "  ${RED}✗${RESET} Plugin 'docker compose' non trovato" >&2; exit 1; }
[[ -f docker-compose.yml ]]        && ok "docker-compose.yml presente" || { echo -e "  ${RED}✗${RESET} docker-compose.yml non trovato — eseguire dalla root del progetto" >&2; exit 1; }

# ── Legge .env ────────────────────────────────────────────────────────────────
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

PROJECT_NAME="$(env_get PROJECT_NAME)"
FRONTEND_PORT="$(env_get FRONTEND_PORT)"
BACKEND_PORT="$(env_get BACKEND_PORT)"
EXPOSE_BACKEND="$(env_get EXPOSE_BACKEND)"
SITEMAP_BASE_URL="$(env_get SITEMAP_BASE_URL)"
SECURITY_BEHIND_PROXY="$(env_get Security__BehindProxy)"

# ── Validazione variabili obbligatorie ─────────────────────────────────────────
[[ -z "$PROJECT_NAME" ]]             && fail "PROJECT_NAME non impostato in .env"
[[ "$PROJECT_NAME" == "CHANGE_ME" ]] && fail "PROJECT_NAME è ancora il placeholder 'CHANGE_ME'"
[[ -n "$PROJECT_NAME" && ! "$PROJECT_NAME" =~ ^[a-z0-9_-]+$ ]] && fail "PROJECT_NAME contiene caratteri non validi (usare solo lowercase, numeri, - e _)"

[[ -z "$FRONTEND_PORT" ]]            && fail "FRONTEND_PORT non impostato in .env"

# Se vuoi esporre il backend, la porta diventa obbligatoria per evitare conflitti tra progetti
if [[ "${EXPOSE_BACKEND:-no}" == "yes" && -z "$BACKEND_PORT" ]]; then
    fail "EXPOSE_BACKEND=yes richiede che BACKEND_PORT sia definita in .env"
fi

[[ -n "$PROJECT_NAME" && "$PROJECT_NAME" != "CHANGE_ME" ]] && ok "PROJECT_NAME = $PROJECT_NAME"
[[ -n "$PROJECT_NAME" && "$PROJECT_NAME" != "CHANGE_ME" ]] && ok "PROJECT_NAME = $PROJECT_NAME"
[[ -n "$FRONTEND_PORT" ]]                                  && ok "FRONTEND_PORT = $FRONTEND_PORT"

if (( ERRORS > 0 )); then
    echo
    echo -e "  ${RED}Trovati $ERRORS errori. Correggere .env prima di procedere.${RESET}" >&2
    exit 1
fi

# ── Esposizione backend ────────────────────────────────────────────────────────
if [[ -z "$EXPOSE_BACKEND" ]]; then
    echo
    read -rp "  Esporre la porta backend sull'host? [s/N]: " _reply
    if [[ "$_reply" =~ ^[SsYy]$ ]]; then
        EXPOSE_BACKEND=yes
        echo "EXPOSE_BACKEND=yes" >> .env
    else
        EXPOSE_BACKEND=no
        echo "EXPOSE_BACKEND=no" >> .env
    fi
fi

# ── BehindProxy ────────────────────────────────────────────────────────────────
# Necessario affinché il rate limiter del backend veda l'IP reale del client
# invece dell'IP del container frontend.
# Impostare a true se c'è un reverse proxy davanti (NPM, Nginx, Cloudflare, ecc.).
if [[ -z "$SECURITY_BEHIND_PROXY" ]]; then
    echo
    read -rp "  C'è un reverse proxy davanti (NPM, Nginx, Cloudflare...)? [S/n]: " _reply
    if [[ "$_reply" =~ ^[Nn]$ ]]; then
        SECURITY_BEHIND_PROXY=false
        echo "Security__BehindProxy=false" >> .env
        ok "Security__BehindProxy=false"
    else
        SECURITY_BEHIND_PROXY=true
        echo "Security__BehindProxy=true" >> .env
        ok "Security__BehindProxy=true"
    fi
fi

# ── Sitemap ────────────────────────────────────────────────────────────────────
# SITEMAP_BASE_URL è un build arg Docker: viene letto da generate-statics.ts
# durante npm run build per generare sitemap.xml con URL corretti.
# Se manca, la build procede ma la sitemap usa https://example.com.
if [[ -z "$SITEMAP_BASE_URL" ]]; then
    warn "SITEMAP_BASE_URL non impostato — sitemap.xml userà https://example.com"
    warn "Impostare SITEMAP_BASE_URL=https://tuodominio.it in .env per la produzione"
else
    ok "SITEMAP_BASE_URL = $SITEMAP_BASE_URL"
fi

# ── Determina comando compose ──────────────────────────────────────────────────
if [[ "$EXPOSE_BACKEND" == "yes" ]]; then
    if [[ ! -f docker-compose.backend-exposed.yml ]]; then
        warn "EXPOSE_BACKEND=yes ma docker-compose.backend-exposed.yml non trovato — procedo senza"
        COMPOSE="docker compose -f docker-compose.yml"
    else
		COMPOSE="docker compose -f docker-compose.yml -f docker-compose.backend-exposed.yml"
		ok "Backend esposto sull'host (porta $BACKEND_PORT)"
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
