#!/usr/bin/env bash
# =============================================================================
# br1-config.sh — Lettura della configurazione condivisa (da "sourcare", non eseguire).
#
# Un solo posto legge global-settings.json (+ override global-settings.local.json) e
# ne ricava le variabili che servono a Docker Compose. Lo usano deploy.sh e
# scripts/test/public-test.sh, così la logica di merge e lo slug del progetto non
# vengono duplicati.
#
# Uso (chiamare con la working directory sulla root del repo):
#   cd "$ROOT"
#   source scripts/lib/br1-config.sh
#   br1_load_config
#
# Dopo la chiamata sono esportate:
#   BR1_SETTINGS_FILE   file effettivo da montare nei container (base + .local merge + ApiKey
#                       effimero se assente), path relativo
#   COMPOSE_PROJECT_NAME  slug di project.name
#   FRONTEND_PORT         porta host del frontend
#   EXPOSE_BACKEND        yes|no (da backend.public)
#   BACKEND_PORT          porta host del backend (se esposto)
#   FRONTEND_BASE_URL     https://<hostname> (se impostato)
#   NG_ALLOWED_HOSTS      hostname consentito
#   BR1_PROJECT_JSON      global-settings.json minificato (project/Localization/site, NO segreti),
#                         build arg per iniettare l'identità e la config nel bundle frontend
#
# Path RELATIVI di proposito: Node li risolve dalla cwd (la root del repo) e
# docker-compose risolve BR1_SETTINGS_FILE rispetto al file compose. Evita anche i
# problemi di traduzione path di Git Bash su Windows. Richiede: node. Ritorna 1 se il merge fallisce.
# =============================================================================

br1_load_config() {
    local effective="./.br1-settings.effective.json"

    # Config EFFETTIVA = global-settings.json + override opzionale global-settings.local.json,
    # con un ApiKey EFFIMERO generato se manca. Il file .local è gitignorato: ci metti i SEGRETI
    # REALI di produzione; senza .local (CI, primo avvio) lo stack parte comunque perché qui
    # generiamo una Security.ApiKeys usa-e-getta — così git resta senza segreti ma il template
    # parte subito. SecretKey NON viene toccata: lasciarla vuota disabilita il login (scelta del
    # progetto). Il merge è profondo (gli array si sostituiscono).
    node --input-type=module --eval "
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => { if (!isObj(a) || !isObj(b)) return b === undefined ? a : b; const o = { ...a }; for (const k of Object.keys(b)) o[k] = isObj(o[k]) && isObj(b[k]) ? merge(o[k], b[k]) : b[k]; return o; };
let cfg = JSON.parse(readFileSync('global-settings.json', 'utf-8'));
if (existsSync('global-settings.local.json'))
    cfg = merge(cfg, JSON.parse(readFileSync('global-settings.local.json', 'utf-8')));
// ApiKey effimero se assente: backend e SSR devono averne uno coincidente (montano lo stesso
// file), altrimenti il frontend va in crash all'avvio (assertRequiredEnv su Security.ApiKeys[0]).
cfg.Security = isObj(cfg.Security) ? cfg.Security : {};
const keys = cfg.Security.ApiKeys;
if (!Array.isArray(keys) || keys.length === 0 || !keys[0])
    cfg.Security.ApiKeys = [randomBytes(32).toString('base64')];
writeFileSync('.br1-settings.effective.json', JSON.stringify(cfg, null, 2) + '\n');
" || return 1

    # Montato nei container al posto del file base (un solo file per backend e SSR).
    export BR1_SETTINGS_FILE="$effective"

    local _line
    while IFS= read -r _line; do
        [[ -z "$_line" ]] && continue
        export "${_line%%=*}=${_line#*=}"
    done < <(BR1_EFFECTIVE="$effective" node --input-type=module --eval "
import { readFileSync } from 'fs';
const s = JSON.parse(readFileSync(process.env.BR1_EFFECTIVE, 'utf-8'));
const slugify = n => String(n).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+\$/g, '');
const h = (s.frontend?.hostname || '').trim();
const langs = Array.isArray(s.Localization?.SupportedLanguages) ? s.Localization.SupportedLanguages : [];
process.stdout.write([
    'COMPOSE_PROJECT_NAME=' + slugify(s.project?.name || 'app'),
    'FRONTEND_PORT=' + String(s.frontend?.port || 3000),
    'EXPOSE_BACKEND=' + (s.backend?.public ? 'yes' : 'no'),
    'BACKEND_PORT=' + String(s.backend?.publicPort || ''),
    'FRONTEND_BASE_URL=' + (h ? 'https://' + h : ''),
    'NG_ALLOWED_HOSTS=' + h,
].join('\n') + '\n');
")

    # Config di PROGETTO (project/Localization/site) minificata per il build del frontend.
    # È global-settings.json grezzo: NON contiene segreti (quelli sono in .local, non qui),
    # quindi è sicuro passarlo come build ARG. generate-statics lo legge da BR1_PROJECT_JSON.
    export BR1_PROJECT_JSON="$(node --input-type=module --eval "
import { readFileSync } from 'fs';
process.stdout.write(JSON.stringify(JSON.parse(readFileSync('global-settings.json', 'utf-8'))));
")"
}
