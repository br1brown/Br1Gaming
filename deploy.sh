#!/usr/bin/env bash
# =============================================================================
# deploy.sh - Pubblica Br1WebEngine in produzione (semplice e disaccoppiato).
#
# Uso:
#   ./deploy.sh                      Pubblica frontend + backend
#   ./deploy.sh --frontend           Pubblica solo il frontend
#   ./deploy.sh --backend            Pubblica solo il backend (privato o pubblico secondo config)
#   ./deploy.sh --no-cache           Forza la build Docker ignorando la cache
#   ./deploy.sh --help               Mostra questo messaggio
#
# Modello: leggi la config, controlla i segreti, poi un preflight isolato (build +
# avvio su porte effimere con --wait sugli HEALTHCHECK). Solo se la nuova build è SANA
# si fa lo swap in produzione: se non compila o non parte, il sito attuale resta intatto.
# I conflitti di porta vengono solo segnalati: nessun container viene fermato automaticamente.
#
# Backend privato vs pubblico: si decide con 'backend.public' in global-settings.json
# (true -> esposto sull'host tramite docker-compose.backend-exposed.yml).
#
# Sviluppo locale: usa lo script del frontend + Visual Studio per il backend
# (non c'è più un dev-via-Docker).
#
# Configurazione: tutto vive in global-settings.json (+ override global-settings.local.json).
# =============================================================================

set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Variabili di stato
NO_CACHE=false
DEPLOY_FRONTEND=false
DEPLOY_BACKEND=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --frontend) DEPLOY_FRONTEND=true; shift ;;
        --backend)  DEPLOY_BACKEND=true; shift ;;
        --no-cache) NO_CACHE=true; shift ;;
        *) echo "  WARN opzione sconosciuta ignorata: $1" >&2; shift ;;
    esac
done

# Default: se non specifichi nulla, pubblichi tutto.
if [[ "$DEPLOY_FRONTEND" == false && "$DEPLOY_BACKEND" == false ]]; then
    DEPLOY_FRONTEND=true
    DEPLOY_BACKEND=true
fi

if [[ -t 1 ]]; then
    BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
else
    BOLD=''; GREEN=''; YELLOW=''; RED=''; RESET=''
fi

info() { echo -e "  ${BOLD}[info]${RESET} $*"; }
ok()   { echo -e "  ${GREEN}OK${RESET} $*"; }
warn() { echo -e "  ${YELLOW}WARN${RESET} $*"; }
fail() { echo -e "  ${RED}ERR${RESET} $*" >&2; ERRORS=$((ERRORS + 1)); }

ERRORS=0

echo
echo -e "${BOLD}Prerequisiti${RESET}"
command -v docker >/dev/null 2>&1 && ok "Docker trovato" || { echo -e "  ${RED}ERR${RESET} Docker non trovato" >&2; exit 1; }
docker compose version >/dev/null 2>&1 && ok "docker compose trovato" || { echo -e "  ${RED}ERR${RESET} docker compose non trovato" >&2; exit 1; }
[[ -f docker-compose.yml ]] && ok "docker-compose.yml presente" || { echo -e "  ${RED}ERR${RESET} docker-compose.yml mancante" >&2; exit 1; }
command -v node >/dev/null 2>&1 && ok "Node.js trovato" || { echo -e "  ${RED}ERR${RESET} Node.js non trovato (richiesto per leggere global-settings.json)" >&2; exit 1; }
[[ -f global-settings.json ]] && ok "global-settings.json presente" || { echo -e "  ${RED}ERR${RESET} global-settings.json non trovato!" >&2; exit 1; }

echo
echo -e "${BOLD}Configurazione${RESET}"
# shellcheck source=scripts/lib/br1-config.sh
source "${ROOT}/scripts/lib/br1-config.sh"
br1_load_config || { echo -e "  ${RED}ERR${RESET} Lettura/merge di global-settings(.local).json fallito (JSON non valido?)" >&2; exit 1; }
ok "Configurazione letta (${BR1_SETTINGS_FILE})"

[[ -z "$COMPOSE_PROJECT_NAME" ]] && fail "COMPOSE_PROJECT_NAME non derivabile da global-settings.json (project.name)"
[[ -n "$COMPOSE_PROJECT_NAME" && ! "$COMPOSE_PROJECT_NAME" =~ ^[a-z0-9_-]+$ ]] && fail "COMPOSE_PROJECT_NAME contiene caratteri non validi (ammessi: a-z, 0-9, - e _)"
[[ -z "$FRONTEND_PORT" ]] && fail "FRONTEND_PORT non valido in global-settings.json (frontend.port)"
if [[ "${EXPOSE_BACKEND:-no}" == "yes" && -z "${BACKEND_PORT:-}" ]]; then
    fail "backend.public=true richiede backend.publicPort"
fi
if (( ERRORS > 0 )); then
    echo
    echo -e "  ${RED}ERR${RESET} Correggi la configurazione in global-settings.json prima di pubblicare" >&2
    exit 1
fi
ok "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}"
ok "FRONTEND_PORT=${FRONTEND_PORT}"

# File compose: base + (se il backend è pubblico) l'override che lo espone sull'host.
compose_files=(-f docker-compose.yml)
if [[ "${EXPOSE_BACKEND:-no}" == "yes" ]]; then
    if [[ -f docker-compose.backend-exposed.yml ]]; then
        compose_files+=(-f docker-compose.backend-exposed.yml)
        ok "Backend pubblico sulla porta host ${BACKEND_PORT}"
    else
        warn "backend.public=true ma docker-compose.backend-exposed.yml non trovato, continuo senza"
    fi
else
    ok "Backend privato (solo rete Docker interna)"
fi

# Servizi da pubblicare in base ai flag.
services=()
[[ "$DEPLOY_FRONTEND" == true ]] && services+=(frontend)
[[ "$DEPLOY_BACKEND" == true ]] && services+=(backend)
info "Pubblico: ${services[*]}"

# ── GUARD SEGRETI DI PRODUZIONE (automatico) ─────────────────────────────────
# Se hai lasciato i segreti segnaposto/deboli di default, ci fermiamo qui: non puoi
# pubblicare per sbaglio con la chiave di sviluppo.
echo
echo -e "${BOLD}Controllo segreti${RESET}"
_secret_errs="$(mktemp)"
if node --input-type=module --eval "
import { readFileSync } from 'fs';
const s = JSON.parse(readFileSync('${BR1_SETTINGS_FILE}','utf-8'));
const DEV = 'dev-only-change-me-chiave-di-sviluppo-min-32-byte';
const sk = String(s.Security?.Token?.SecretKey ?? '').trim();
const keys = Array.isArray(s.Security?.ApiKeys) ? s.Security.ApiKeys : [];
const errs = [];
if (sk) {
  if (sk === DEV) errs.push('Security.Token.SecretKey e ancora il segreto di sviluppo. Generane uno: openssl rand -base64 48');
  else if (sk.length < 32) errs.push('Security.Token.SecretKey e troppo corta (<32 caratteri). Generane una robusta: openssl rand -base64 48');
}
if (keys.length === 0) errs.push('Security.ApiKeys e vuoto: il frontend non puo autenticarsi col backend.');
for (const k of keys) {
  if (k === 'frontend') errs.push('Security.ApiKeys contiene la chiave segnaposto \"frontend\". Sostituiscila: openssl rand -base64 32');
  else if (String(k).length < 32) errs.push('Security.ApiKeys contiene una chiave troppo corta (<32 caratteri): ' + k);
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
" 2>"$_secret_errs"; then
    ok "Segreti di produzione validi"
else
    while IFS= read -r _err; do [[ -n "$_err" ]] && fail "$_err"; done < "$_secret_errs"
fi
rm -f "$_secret_errs"
if (( ERRORS > 0 )); then
    echo
    echo -e "  ${RED}ERR${RESET} Correggi i segreti in global-settings.local.json prima di pubblicare" >&2
    exit 1
fi

# ── CONTROLLO PORTE (solo avviso, nessuna chiusura automatica) ───────────────
echo
echo -e "${BOLD}Controllo porte${RESET}"
check_port() {
    local port="$1" conflicting project_label normalized
    conflicting=$(docker ps --format '{{.Names}}\t{{.Ports}}\t{{.Label "com.docker.compose.project"}}' \
        | grep -E ":${port}->" | head -n1 || true)
    if [[ -z "$conflicting" ]]; then
        ok "Porta ${port} libera"
        return
    fi
    project_label=$(printf '%s' "$conflicting" | awk -F'\t' '{print $3}')
    normalized=$(printf '%s' "$COMPOSE_PROJECT_NAME" | tr '[:upper:]' '[:lower:]')
    if [[ -n "$project_label" && "$project_label" == "$normalized" ]]; then
        ok "Porta ${port} in uso da questo stesso progetto (verrà aggiornato)"
    else
        warn "Porta ${port} occupata da '${project_label:-container esterno}'. Procedo comunque: se il bind fallisce, Docker lo segnala. Per liberarla: docker stop <container>."
    fi
}
[[ "$DEPLOY_FRONTEND" == true ]] && check_port "${FRONTEND_PORT}"
[[ "$DEPLOY_BACKEND" == true && "${EXPOSE_BACKEND:-no}" == "yes" && -n "${BACKEND_PORT:-}" ]] && check_port "${BACKEND_PORT}"

# ── BUILD + PREFLIGHT (la produzione non viene toccata finché la nuova build non è sana) ──
# Costruiamo e avviamo le NUOVE immagini in una copia isolata su porte effimere
# (FRONTEND_PORT=0/BACKEND_PORT=0: Docker assegna porte libere, niente collisioni con
# la produzione). `--wait` usa gli HEALTHCHECK dei Dockerfile: se la build non compila
# O non parte sana, ci fermiamo qui e il sito attuale resta intatto.
echo
echo -e "${BOLD}Build + preflight${RESET}"
preflight() {
    env COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME}-pf" FRONTEND_PORT=0 BACKEND_PORT=0 \
        docker compose "${compose_files[@]}" "$@"
}
preflight down -v >/dev/null 2>&1 || true
if [[ "$NO_CACHE" == true ]]; then
    preflight build --no-cache "${services[@]}"
else
    preflight build "${services[@]}"
fi
info "Avvio isolato delle nuove immagini e attesa che siano sane..."
if preflight up -d --wait --wait-timeout 120 "${services[@]}"; then
    ok "Nuova build sana (verificata in isolamento)"
    preflight down -v >/dev/null 2>&1 || true
else
    fail "La nuova build non è sana: la produzione NON è stata toccata"
    preflight logs --tail 20 || true
    preflight down -v >/dev/null 2>&1 || true
    exit 1
fi

# ── PUBBLICAZIONE (swap) ─────────────────────────────────────────────────────
# Le immagini sono già costruite e validate: lo swap riusa la cache (istantaneo) e
# `--wait` ricontrolla la salute sulle porte reali.
echo
echo -e "${BOLD}Pubblicazione${RESET}"
info "Sostituzione dei container di produzione..."
docker compose "${compose_files[@]}" up -d --wait --wait-timeout 120 "${services[@]}"
ok "Container avviati e sani"

echo
echo -e "${BOLD}Pulizia${RESET}"
docker image prune -f --filter "dangling=true" >/dev/null
ok "Immagini orfane rimosse"

echo
echo -e "  ${GREEN}OK${RESET} Pubblicazione completata (${services[*]})"
echo "  Log:   docker compose -f docker-compose.yml logs -f"
echo "  Stato: docker compose -f docker-compose.yml ps"
echo
