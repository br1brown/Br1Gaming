#!/usr/bin/env bash
# =============================================================================
# deploy-release.sh - Pubblica in produzione una RELEASE già pronta (immagini pre-costruite).
#
# Differenza da deploy.sh: NON compila nulla e NON serve il sorgente. Prende le immagini
# pre-costruite dalla CI (pull da GHCR oppure docker load dei .tar.gz allegati alla Release),
# le prova in isolamento su porte effimere (--wait sugli HEALTHCHECK) e SOLO se sono sane fa
# lo swap in produzione. Il modello è artifact-based: la VPS riceve un artefatto versionato,
# non un checkout git.
#
# Uso:
#   ./deploy-release.sh                     Pubblica frontend + backend (tag da release.env)
#   ./deploy-release.sh --frontend          Pubblica solo il frontend
#   ./deploy-release.sh --backend           Pubblica solo il backend
#   ./deploy-release.sh --tag 1.2.3         Forza una versione specifica
#   ./deploy-release.sh --from-files        Carica le immagini dai .tar.gz (docker load), non da GHCR
#   ./deploy-release.sh --from-ghcr         Forza il pull da GHCR anche se ci sono i .tar.gz
#   ./deploy-release.sh --images-dir DIR    Cartella dei .tar.gz delle immagini (default: qui)
#   ./deploy-release.sh --help              Mostra questo messaggio
#
# Come arrivano le immagini (due modi, entrambi ok):
#   A) da GHCR      -> docker compose pull (deploy incrementali; login se il registry è privato)
#   B) da file      -> docker load dei .tar.gz allegati alla Release (nessun registry né login)
# Default AUTOMATICO: se accanto allo script (o in --images-dir) ci sono i .tar.gz delle immagini
# li usa (B); altrimenti fa il pull da GHCR (A). Forzabile con --from-files / --from-ghcr.
#
# Versione delle immagini: presa da release.env (scritto dalla CI nel deploy bundle) oppure
# dalla variabile d'ambiente RELEASE_TAG, oppure --tag. Default: latest.
#
# Configurazione e segreti: come deploy.sh, tutto in global-settings.json (+ override
# global-settings.local.json con i segreti REALI di produzione). Le immagini sono generiche;
# la config viene MONTATA a runtime (non è baked, tranne identità/SEO congelati in build).
# =============================================================================

set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Risali fino alla root del progetto (dove sta docker-compose.yml): così lo script funziona
# sia da scripts/ nel repo, sia accanto al compose (deploy bundle), sia da un symlink.
while [[ "$ROOT" != "/" && ! -f "$ROOT/docker-compose.yml" ]]; do ROOT="$(dirname "$ROOT")"; done
cd "$ROOT"

# release.env: scritto dalla CI nel bundle (RELEASE_TAG + immagini di QUESTA release). Le
# variabili d'ambiente già presenti hanno la precedenza (non le sovrascriviamo).
if [[ -f release.env ]]; then
    while IFS='=' read -r _k _v; do
        [[ -z "$_k" || "$_k" == \#* ]] && continue
        [[ -z "${!_k:-}" ]] && export "$_k=$_v"
    done < release.env
fi

DEPLOY_FRONTEND=false
DEPLOY_BACKEND=false
SOURCE_MODE=auto            # auto | files | ghcr
IMAGES_DIR="."

while [[ $# -gt 0 ]]; do
    case "$1" in
        --frontend)   DEPLOY_FRONTEND=true; shift ;;
        --backend)    DEPLOY_BACKEND=true; shift ;;
        --tag)        export RELEASE_TAG="${2:?--tag richiede un valore, es. --tag 1.2.3}"; shift 2 ;;
        --from-files) SOURCE_MODE=files; shift ;;
        --from-ghcr)  SOURCE_MODE=ghcr; shift ;;
        --images-dir) IMAGES_DIR="${2:?--images-dir richiede un percorso}"; shift 2 ;;
        *) echo "  WARN opzione sconosciuta ignorata: $1" >&2; shift ;;
    esac
done

# Default: se non specifichi nulla, pubblichi tutto.
if [[ "$DEPLOY_FRONTEND" == false && "$DEPLOY_BACKEND" == false ]]; then
    DEPLOY_FRONTEND=true
    DEPLOY_BACKEND=true
fi

# Tag effettivo (esportato: docker-compose.release.yml lo sostituisce in ${RELEASE_TAG}).
export RELEASE_TAG="${RELEASE_TAG:-latest}"

if [[ -t 1 ]]; then
    BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
else
    BOLD=''; GREEN=''; YELLOW=''; RED=''; RESET=''
fi

info() { echo -e "  ${BOLD}[info]${RESET} $*"; }
ok()   { echo -e "  ${GREEN}OK${RESET} $*"; }
warn() { echo -e "  ${YELLOW}WARN${RESET} $*"; }
fail() { echo -e "  ${RED}ERR${RESET} $*" >&2; ERRORS=$((ERRORS + 1)); }

# Riavvia un servizio compose SOLO se è attualmente in esecuzione (restart, non rebuild).
# Riallinea all'ApiKey nuova il lato NON toccato da un deploy parziale (vedi fondo script).
restart_if_running() {
    local svc="$1" cid
    cid="$(docker compose "${compose_files[@]}" ps -q "$svc" 2>/dev/null || true)"
    if [[ -n "$cid" && "$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null)" == "true" ]]; then
        info "Riavvio '$svc' per riallineare la chiave..."
        if docker compose "${compose_files[@]}" restart "$svc" >/dev/null 2>&1; then
            ok "'$svc' riavviato: chiave riallineata"
        else
            warn "Riavvio di '$svc' fallito: riavvialo a mano ('docker compose ${compose_files[*]} restart $svc') per evitare 401"
        fi
    else
        info "'$svc' non in esecuzione: nessun riallineamento necessario"
    fi
}

ERRORS=0

echo
echo -e "${BOLD}Prerequisiti${RESET}"
command -v docker >/dev/null 2>&1 && ok "Docker trovato" || { echo -e "  ${RED}ERR${RESET} Docker non trovato" >&2; exit 1; }
docker compose version >/dev/null 2>&1 && ok "docker compose trovato" || { echo -e "  ${RED}ERR${RESET} docker compose non trovato" >&2; exit 1; }
[[ -f docker-compose.yml ]] && ok "docker-compose.yml presente" || { echo -e "  ${RED}ERR${RESET} docker-compose.yml mancante" >&2; exit 1; }
[[ -f docker-compose.release.yml ]] && ok "docker-compose.release.yml presente" || { echo -e "  ${RED}ERR${RESET} docker-compose.release.yml mancante (deploy bundle incompleto?)" >&2; exit 1; }
command -v node >/dev/null 2>&1 && ok "Node.js trovato" || { echo -e "  ${RED}ERR${RESET} Node.js non trovato (richiesto per leggere global-settings.json)" >&2; exit 1; }
[[ -f global-settings.json ]] && ok "global-settings.json presente" || { echo -e "  ${RED}ERR${RESET} global-settings.json non trovato!" >&2; exit 1; }

echo
echo -e "${BOLD}Configurazione${RESET}"
# shellcheck source=scripts/lib/br1-config.sh
source "${ROOT}/scripts/lib/br1-config.sh"

# Comodità: se non esiste global-settings.local.json lo creiamo con segreti VERI generati, ma
# con frontend.hostname VUOTO di proposito. Le chiavi sono boilerplate; il dominio è una scelta:
# lasciandolo vuoto il guard sotto ferma il deploy finché non lo imposti (niente 421 al dominio reale).
if [[ ! -f global-settings.local.json ]]; then
    if br1_ensure_local_secrets; then
        warn "global-settings.local.json non c'era: creato con SecretKey/ApiKeys/CryptoSecret generati e frontend.hostname VUOTO. Imposta il tuo dominio (e la porta se hai altri progetti sulla stessa VPS): il deploy si ferma finché il dominio è vuoto — di proposito."
    else
        fail "Creazione automatica di global-settings.local.json fallita"
    fi
fi

# Legge Security.ApiKeys[0] da un file JSON (vuoto se il file non c'è o è illeggibile).
_read_api_key() {
    [[ -f "$1" ]] || { printf ''; return 0; }
    BR1_KEYFILE="$1" node --input-type=module --eval "
import { readFileSync } from 'fs';
try { const s = JSON.parse(readFileSync(process.env.BR1_KEYFILE, 'utf-8')); process.stdout.write(String(s.Security?.ApiKeys?.[0] ?? '')); }
catch { process.stdout.write(''); }
" 2>/dev/null || true
}

# ApiKey ATTUALE (dei container in esecuzione): catturata PRIMA di rigenerare il file effective.
OLD_API_KEY="$(_read_api_key "./.br1-settings.effective.json")"

br1_load_config || { echo -e "  ${RED}ERR${RESET} Lettura/merge di global-settings(.local).json fallito (JSON non valido?)" >&2; exit 1; }
ok "Configurazione letta (${BR1_SETTINGS_FILE})"

# ApiKey NUOVA (dopo la rigenerazione). Se differisce, il lato non deployato ma in esecuzione
# ha la chiave vecchia in cache e va riavviato per riallinearsi (vedi fondo script).
NEW_API_KEY="$(_read_api_key "$BR1_SETTINGS_FILE")"
KEY_CHANGED=false
[[ "$OLD_API_KEY" != "$NEW_API_KEY" ]] && KEY_CHANGED=true

[[ -z "$COMPOSE_PROJECT_NAME" ]] && fail "COMPOSE_PROJECT_NAME non derivabile da global-settings.json (project.name)"
[[ -n "$COMPOSE_PROJECT_NAME" && ! "$COMPOSE_PROJECT_NAME" =~ ^[a-z0-9_-]+$ ]] && fail "COMPOSE_PROJECT_NAME contiene caratteri non validi (ammessi: a-z, 0-9, - e _)"
[[ -z "$FRONTEND_PORT" ]] && fail "FRONTEND_PORT non valido in global-settings.json (frontend.port)"
if [[ "${EXPOSE_BACKEND:-no}" == "yes" && -z "${BACKEND_PORT:-}" ]]; then
    fail "backend.public=true richiede backend.publicPort"
fi
# Hostname obbligatorio quando pubblichi il frontend: senza, l'SSR è fail-closed e risponde 421
# al dominio reale. In modalità release DEVE anche combaciare col FRONTEND_BASE_URL usato dalla
# CI (i canonical/sitemap sono baked nell'immagine): se differiscono, il sito è raggiungibile ma
# con URL SEO sbagliati.
if [[ "$DEPLOY_FRONTEND" == true && -z "${FRONTEND_BASE_URL:-}" ]]; then
    fail "frontend.hostname non impostato in global-settings.local.json: il sito risponderebbe 421 al dominio reale. Imposta es. \"frontend\": { \"hostname\": \"miodominio.it\" } (stesso dominio del repository variable FRONTEND_BASE_URL usato dalla CI)."
fi
if (( ERRORS > 0 )); then
    echo
    echo -e "  ${RED}ERR${RESET} Correggi la configurazione in global-settings.json prima di pubblicare" >&2
    exit 1
fi
ok "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}"
ok "FRONTEND_PORT=${FRONTEND_PORT}"
ok "Versione immagini: RELEASE_TAG=${RELEASE_TAG}"
if [[ "$DEPLOY_BACKEND" == true && "${BEHIND_PROXY:-no}" != "yes" ]]; then
    warn "Security.BehindProxy non è true: dietro un reverse proxy il rate limiter conterà tutti gli utenti come un solo IP. Imposta \"Security\": { \"BehindProxy\": true } in global-settings.local.json."
fi

# File compose: base + override di release (immagini) + (se il backend è pubblico) l'esposizione.
compose_files=(-f docker-compose.yml -f docker-compose.release.yml)
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
info "Pubblico: ${services[*]} (tag ${RELEASE_TAG})"

# ── GUARD SEGRETI DI PRODUZIONE (automatico) ─────────────────────────────────
# Come deploy.sh: se hai lasciato i segreti segnaposto/deboli, ci fermiamo qui.
echo
echo -e "${BOLD}Controllo segreti${RESET}"
_secret_errs="$(mktemp)"
if node --input-type=module --eval "
import { readFileSync } from 'fs';
const s = JSON.parse(readFileSync('${BR1_SETTINGS_FILE}','utf-8'));
const DEV = 'dev-only-change-me-chiave-di-sviluppo-min-32-byte';
const sk = String(s.Security?.Token?.SecretKey ?? '').trim();
const keys = Array.isArray(s.Security?.ApiKeys) ? s.Security.ApiKeys : [];
const cryptoSecret = String(s.Security?.CryptoSecret ?? '').trim();
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
if (cryptoSecret === 'INCOLLA-QUI-openssl-rand-base64-32') errs.push('Security.CryptoSecret e ancora il segnaposto dell\'esempio. Generane uno: openssl rand -base64 32');
else if (cryptoSecret && cryptoSecret.length < 32) errs.push('Security.CryptoSecret e troppo corta (<32 caratteri). Generane una robusta: openssl rand -base64 32');
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

# ── ACQUISIZIONE IMMAGINI (da GHCR o da file .tar.gz) ────────────────────────
# Due modi, stessa destinazione: le immagini finiscono nel docker locale col nome che
# docker-compose.release.yml si aspetta, così preflight e swap non fanno alcun pull.
#   - da file: docker load dei .tar.gz (nessun registry né login). I file sono quelli
#     allegati alla Release ('<svc>-image-<tag>.tar.gz'), scaricati/scp accanto allo script.
#   - da GHCR: docker compose pull (login 'docker login ghcr.io' se il registry è privato).
# In 'auto' usiamo i file se presenti, altrimenti GHCR.

# Cerca il .tar.gz dell'immagine di un servizio in IMAGES_DIR (prima quello del tag esatto).
_image_tar_for() {
    local svc="$1" exact
    exact="${IMAGES_DIR}/${svc}-image-${RELEASE_TAG}.tar.gz"
    if [[ -f "$exact" ]]; then printf '%s' "$exact"; return 0; fi
    ls -1 "${IMAGES_DIR}/${svc}-image-"*.tar.gz 2>/dev/null | head -n1 || true
}

# Risolvi 'auto': file se c'è ALMENO un tar per i servizi richiesti, altrimenti GHCR.
if [[ "$SOURCE_MODE" == auto ]]; then
    SOURCE_MODE=ghcr
    for _svc in "${services[@]}"; do
        [[ -n "$(_image_tar_for "$_svc")" ]] && { SOURCE_MODE=files; break; }
    done
fi

echo
echo -e "${BOLD}Acquisizione immagini${RESET}"
if [[ "$SOURCE_MODE" == files ]]; then
    info "Modalità 'da file': docker load dei .tar.gz in ${IMAGES_DIR} (nessun registry)"
    for _svc in "${services[@]}"; do
        _tar="$(_image_tar_for "$_svc")"
        if [[ -z "$_tar" ]]; then
            fail "Immagine per '${_svc}' non trovata in ${IMAGES_DIR} (${_svc}-image-*.tar.gz). Scaricala dalla Release o usa --from-ghcr."
            exit 1
        fi
        info "docker load '${_svc}' da ${_tar}"
        if gzip -dc "$_tar" | docker load; then
            ok "'${_svc}' caricata"
        else
            fail "docker load di '${_svc}' fallito (${_tar})"
            exit 1
        fi
    done
    ok "Immagini caricate dai file (tag ${RELEASE_TAG})"
else
    info "Modalità 'da GHCR': docker compose pull"
    if docker compose "${compose_files[@]}" pull "${services[@]}"; then
        ok "Immagini scaricate (tag ${RELEASE_TAG})"
    else
        fail "Pull fallito: verifica RELEASE_TAG=${RELEASE_TAG}, la connettività o l'accesso a GHCR (docker login ghcr.io se privato). In alternativa scarica i .tar.gz dalla Release e usa --from-files."
        exit 1
    fi
fi

# ── PREFLIGHT (la produzione non viene toccata finché le immagini non sono sane) ──
# Avviamo le NUOVE immagini in una copia isolata su porte effimere (FRONTEND_PORT=0/
# BACKEND_PORT=0). `--wait` usa gli HEALTHCHECK: se non partono sane, ci fermiamo e il
# sito attuale resta intatto. Nessuna build: le immagini sono già quelle appena scaricate.
echo
echo -e "${BOLD}Preflight${RESET}"
preflight() {
    env COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME}-pf" FRONTEND_PORT=0 BACKEND_PORT=0 \
        docker compose "${compose_files[@]}" "$@"
}
preflight down -v >/dev/null 2>&1 || true
info "Avvio isolato delle nuove immagini e attesa che siano sane..."
if preflight up -d --wait --wait-timeout 120 "${services[@]}"; then
    ok "Nuove immagini sane (verificate in isolamento)"
    preflight down -v >/dev/null 2>&1 || true
else
    fail "Le nuove immagini non sono sane: la produzione NON è stata toccata"
    preflight logs --tail 20 || true
    preflight down -v >/dev/null 2>&1 || true
    exit 1
fi

# ── PUBBLICAZIONE (swap) ─────────────────────────────────────────────────────
echo
echo -e "${BOLD}Pubblicazione${RESET}"
info "Sostituzione dei container di produzione con le immagini ${RELEASE_TAG}..."
docker compose "${compose_files[@]}" up -d --wait --wait-timeout 120 "${services[@]}"
ok "Container avviati e sani"

echo
echo -e "${BOLD}Pulizia${RESET}"
docker image prune -f --filter "dangling=true" >/dev/null
ok "Immagini orfane rimosse"

# ── COERENZA CHIAVE FRONTEND↔BACKEND (deploy parziale + ApiKey ruotata) ──────
# Identica a deploy.sh: se la chiave è cambiata e hai deployato UN SOLO lato, l'altro (in
# esecuzione) ha ancora la chiave vecchia in cache → 401. Il file è montato: basta un restart.
if [[ "$KEY_CHANGED" == true ]]; then
    echo
    echo -e "${BOLD}Coerenza frontend↔backend${RESET}"
    info "ApiKey cambiata rispetto al deploy precedente: riallineo i lati non deployati"
    [[ "$DEPLOY_FRONTEND" == false ]] && restart_if_running frontend
    [[ "$DEPLOY_BACKEND"  == false ]] && restart_if_running backend
fi

echo
echo -e "  ${GREEN}OK${RESET} Pubblicazione completata (${services[*]} @ ${RELEASE_TAG})"
echo "  Log:   docker compose ${compose_files[*]} logs -f"
