#!/usr/bin/env bash
# =============================================================================
# br1-config.sh — Lettura della configurazione condivisa (da "sourcare", non eseguire).
#
# Un solo posto legge global-settings.json (+ override global-settings.local.json) e
# ne ricava le variabili che servono a Docker Compose. Lo usano scripts/deploy.sh e
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
#   BEHIND_PROXY          yes|no (da Security.BehindProxy)
#   BR1_PROJECT_JSON      global-settings.json minificato (project/Localization/site/Custom, NO segreti),
#                         build arg per iniettare l'identità e la config nel bundle frontend
#
# Path RELATIVI di proposito: Node li risolve dalla cwd (la root del repo) e
# docker-compose risolve BR1_SETTINGS_FILE rispetto al file compose. Evita anche i
# problemi di traduzione path di Git Bash su Windows. Richiede: node. Ritorna 1 se il merge fallisce.
# =============================================================================

# br1_ensure_local_secrets — se manca global-settings.local.json, lo crea da zero GENERANDO
# i segreti (SecretKey/ApiKeys/CryptoSecret) ma lasciando VUOTI i valori che sono decisioni
# dell'ambiente (frontend.hostname su tutti). Poi lascia proseguire il deploy.
#
# Da chiamare ESPLICITAMENTE dagli script di pubblicazione (scripts/deploy.sh/deploy-release.sh),
# NON da br1_load_config: i test (public-test.sh) devono restare senza .local, con l'ApiKey
# effimera in memoria: qui invece scriviamo un file su disco, cosa che vogliamo solo al deploy.
#
# Perché VUOTI e non i valori dell'example: i segreti (chiavi) sono boilerplate → li generiamo
# per comodità. Il dominio invece è una scelta consapevole: se lo riempissimo con un finto
# 'miodominio.it' il fail-closed sui valori vuoti (hostname mancante ⇒ deploy fermo, niente 421
# al dominio reale) perderebbe senso. Così le chiavi nascono pronte, ma sul dominio il guard del
# chiamante ti blocca finché non lo imposti tu. Niente sezione Mail: il mailer resta spento finché
# non la aggiungi (nessun host finto). La porta ha un default sensato (3000): cambiala se hai già
# un altro progetto su quella porta.
#
# Ritorna: 0 se il file c'era già o è stato creato; 1 su errore.
br1_ensure_local_secrets() {
    [[ -f global-settings.local.json ]] && return 0
    node --input-type=module --eval "
import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
const b64 = n => randomBytes(n).toString('base64');
const cfg = {
  '\$schema': './global-settings.schema.json',
  _nota: 'Creato in automatico alla pubblicazione: le CHIAVI sono già generate. DEVI impostare frontend.hostname (il tuo dominio) — finché è vuoto il deploy si ferma di proposito (niente dominio reale, niente 421). Cambia frontend.port se hai altri progetti sulla stessa VPS. Aggiungi una sezione Mail se ti serve l\'invio email.',
  frontend: { hostname: '', port: 3000 },
  backend: { public: false, publicPort: null },
  Security: {
    ApiKeys: [b64(32)],
    CorsOrigins: [],
    BehindProxy: true,
    Token: { SecretKey: b64(48) },
    CryptoSecret: b64(32),
  },
};
writeFileSync('global-settings.local.json', JSON.stringify(cfg, null, 2) + '\n');
" || return 1
    return 0
}

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
    'BEHIND_PROXY=' + (s.Security?.BehindProxy ? 'yes' : 'no'),
].join('\n') + '\n');
")

    # Config di PROGETTO (project/Localization/site/Custom) minificata per il build del frontend.
    # È global-settings.json grezzo: NON contiene segreti (quelli sono in .local, non qui),
    # quindi è sicuro passarlo come build ARG. generate-statics lo legge da BR1_PROJECT_JSON.
    export BR1_PROJECT_JSON="$(node --input-type=module --eval "
import { readFileSync } from 'fs';
process.stdout.write(JSON.stringify(JSON.parse(readFileSync('global-settings.json', 'utf-8'))));
")"
}
