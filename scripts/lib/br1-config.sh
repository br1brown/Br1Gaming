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
#   BR1_PROJECT_JSON      global-settings.json minificato (project/Localization/site/Features/Custom, NO segreti),
#                         build arg per iniettare l'identità e la config nel bundle frontend
#
# Path RELATIVI di proposito: Node li risolve dalla cwd (la root del repo) e
# docker-compose risolve BR1_SETTINGS_FILE rispetto al file compose. Evita anche i
# problemi di traduzione path di Git Bash su Windows. Richiede: node. Ritorna 1 se il merge fallisce.
# =============================================================================

# br1_ensure_local_secrets — se manca global-settings.local.json, lo crea da zero GENERANDO
# i segreti (SecretKey/ApiConfig.Keys) ma lasciando VUOTI i valori che sono decisioni
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
# chiamante ti blocca finché non lo imposti tu. Niente sezione Mail: il mailer resta spento (anche per Features.Mail) finché
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
  _nota: 'Creato in automatico alla pubblicazione: le CHIAVI sono già generate. DEVI impostare frontend.hostname (il tuo dominio) — finché è vuoto il deploy si ferma di proposito (niente dominio reale, niente 421). Cambia frontend.port se hai altri progetti sulla stessa VPS. Per l\'invio email aggiungi una sezione Mail e accendi Features.Mail in global-settings.json.',
  frontend: { hostname: '', port: 3000 },
  backend: { public: false, publicPort: null },
  Security: {
    ApiConfig: { Keys: [b64(32)] },
    CorsOrigins: [],
    BehindProxy: true,
    Token: { SecretKey: b64(48) },
  },
};
writeFileSync('global-settings.local.json', JSON.stringify(cfg, null, 2) + '\n');
" || return 1
    return 0
}

br1_load_config() {
    local effective="./.br1-settings.effective.json"

    # Config EFFETTIVA = global-settings.json + .local (merge profondo, array sostituiti). Senza .local
    # (CI, primo avvio) genera valori usa-e-getta: ApiKey sempre, e la configurazione delle funzioni
    # accese in Features. Così git resta senza segreti e lo stack parte comunque.
    # Rifiuta Features nel .local (il build del frontend legge solo il file base: frontend e backend
    # si dividerebbero, stessa regola di generate-statics) e chiavi che differiscono solo per le
    # maiuscole nello stesso oggetto: .NET legge la configurazione senza distinguerle e si fermerebbe
    # all'avvio con un errore di chiave duplicata.
    node --input-type=module --eval "
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => { if (!isObj(a) || !isObj(b)) return b === undefined ? a : b; const o = { ...a }; for (const k of Object.keys(b)) o[k] = isObj(o[k]) && isObj(b[k]) ? merge(o[k], b[k]) : b[k]; return o; };
const fail = msg => { console.error('[br1-config] ' + msg); process.exit(1); };
let cfg = JSON.parse(readFileSync('global-settings.json', 'utf-8'));
if (existsSync('global-settings.local.json')) {
    const local = JSON.parse(readFileSync('global-settings.local.json', 'utf-8'));
    if (isObj(local) && Object.keys(local).some(k => k.toLowerCase() === 'features'))
        fail('Features sta in global-settings.local.json: va solo in global-settings.json.');
    cfg = merge(cfg, local);
}
const caseDup = (o, path) => {
    if (!isObj(o)) return;
    const seen = new Map();
    for (const k of Object.keys(o)) {
        const lk = k.toLowerCase();
        if (seen.has(lk)) fail('chiavi ' + path + seen.get(lk) + ' e ' + path + k + ' differiscono solo per le maiuscole (base + .local): il backend non le distingue. Tienine una sola, con la grafia di global-settings.json.');
        seen.set(lk, k);
        caseDup(o[k], path + k + '.');
    }
};
// ApiKey effimero se assente: backend e SSR devono averne uno coincidente (montano lo stesso
// file), altrimenti il frontend va in crash all'avvio (assertRequiredEnv su Security.ApiConfig.Keys[0]).
cfg.Security = isObj(cfg.Security) ? cfg.Security : {};
cfg.Security.ApiConfig = isObj(cfg.Security.ApiConfig) ? cfg.Security.ApiConfig : {};
const keys = cfg.Security.ApiConfig.Keys;
if (!Array.isArray(keys) || keys.length === 0 || !keys[0])
    cfg.Security.ApiConfig.Keys = [randomBytes(32).toString('base64')];
// Senza .local (CI, primo avvio) le funzioni dichiarate in Features non hanno la loro configurazione
// e il backend non partirebbe: valori usa-e-getta, come l'ApiKey. Mail e webhook puntano a indirizzi
// che non consegnano nulla. Al deploy .local esiste sempre (br1_ensure_local_secrets) e qui non si tocca.
if (!existsSync('global-settings.local.json')) {
    const f = isObj(cfg.Features) ? cfg.Features : {};
    if ((f.Login || f.PublicLogin) && !cfg.Security.Token?.SecretKey)
        cfg.Security.Token = { ...(cfg.Security.Token || {}), SecretKey: randomBytes(48).toString('base64') };
    if (f.Mail && !(cfg.Mail?.Host && cfg.Mail?.FromAddress))
        cfg.Mail = { ...(cfg.Mail || {}), Host: '127.0.0.1', FromAddress: 'ci@example.invalid' };
    if (f.ErrorReporting && !cfg.ErrorReporting?.WebhookUrl)
        cfg.ErrorReporting = { ...(cfg.ErrorReporting || {}), WebhookUrl: 'http://127.0.0.1:9/ci' };
}
// Dopo le chiavi aggiunte sopra: un 'security' minuscolo nel .local accanto al 'Security' creato qui è un doppione.
caseDup(cfg, '');
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
import { resolve } from 'path';
const s = JSON.parse(readFileSync(process.env.BR1_EFFECTIVE, 'utf-8'));
const slugify = n => String(n).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+\$/g, '');
const h = (s.frontend?.hostname || '').trim();
const hosting = (s.frontend?.hostingInfo || '').trim();
const langs = Array.isArray(s.Localization?.SupportedLanguages) ? s.Localization.SupportedLanguages : [];
process.stdout.write([
    'COMPOSE_PROJECT_NAME=' + slugify(s.project?.name || 'app'),
    'FRONTEND_PORT=' + String(s.frontend?.port || 3000),
    'EXPOSE_BACKEND=' + (s.backend?.public ? 'yes' : 'no'),
    'BACKEND_PORT=' + String(s.backend?.publicPort || ''),
    'FRONTEND_BASE_URL=' + (h ? 'https://' + h : ''),
    'NG_ALLOWED_HOSTS=' + h,
    'BEHIND_PROXY=' + (s.Security?.BehindProxy ? 'yes' : 'no'),
    // frontend.hostingInfo è relativo alla root del progetto (dove gira il deploy): assoluto per il mount.
    'BR1_HOSTING_INFO=' + (hosting ? resolve(hosting) : ''),
].join('\n') + '\n');
")

    # Un file dei fatti dell'installazione indicato ma assente: meglio fermarsi qui che far montare a
    # Docker una cartella vuota al suo posto.
    if [[ -n "${BR1_HOSTING_INFO:-}" && ! -f "$BR1_HOSTING_INFO" ]]; then
        echo "frontend.hostingInfo punta a $BR1_HOSTING_INFO, che non esiste." >&2
        return 1
    fi

    # Config di PROGETTO (project/Localization/site/Features/Custom) minificata per il build del frontend.
    # È global-settings.json grezzo: NON contiene segreti (quelli sono in .local, non qui),
    # quindi è sicuro passarlo come build ARG. generate-statics lo legge da BR1_PROJECT_JSON.
    export BR1_PROJECT_JSON="$(node --input-type=module --eval "
import { readFileSync } from 'fs';
process.stdout.write(JSON.stringify(JSON.parse(readFileSync('global-settings.json', 'utf-8'))));
")"
}

# br1_content_placeholder_warnings — promemoria di pre-lancio (una riga per warning, su stdout):
# project.name ancora il default "App", e (solo se check_identity=1) backend/data/identity.json
# ancora lo scheletro vuoto post-eject. Condivisa fra deploy.sh e deploy-release.sh così il
# controllo vive in un solo posto invece di essere duplicato come il guard sui segreti.
#
# Non bloccante di proposito: sono stati finali legittimi in alcuni casi (es. identity.json vuoto
# fa sparire da solo i dati d'identità da footer e pagine legali) — il chiamante decide come mostrarli (qui niente
# colori/UI, solo testo grezzo) e non li tratta mai come errori.
#
# check_identity=0 in deploy-release.sh: modello artifact-based, niente sorgente sulla VPS,
# backend/data/identity.json non esiste localmente e non è verificabile.
#
# Uso: br1_content_placeholder_warnings [check_identity=1|0]
br1_content_placeholder_warnings() {
    local check_identity="${1:-1}"
    CHECK_IDENTITY="$check_identity" node --input-type=module --eval "
import { readFileSync, existsSync } from 'fs';
const warns = [];
const settings = JSON.parse(readFileSync('global-settings.json', 'utf-8'));
if (String(settings.project?.name || '').trim() === 'App') {
  warns.push('project.name e ancora il default \"App\": personalizzalo in global-settings.json.');
}
if (process.env.CHECK_IDENTITY === '1') {
  const identityPath = 'backend/data/identity.json';
  if (existsSync(identityPath)) {
    try {
      const id = JSON.parse(readFileSync(identityPath, 'utf-8'));
      // Stessa regola del build (checkControllerIdentity), che nel build Docker del solo frontend non gira.
      const filled = v => typeof v === 'string' ? v.trim() !== '' : !!v && typeof v === 'object' && Object.values(v).some(x => typeof x === 'string' && x.trim() !== '');
      const tit = id.titolareDelTrattamento || {};
      const c = id.contatti || {};
      // L'identità di esempio del template (Esempio S.r.l., @esempio.it) non è un'identità: un figlio che
      // tiene la demo e cambia solo project.name la pubblicherebbe in footer, pagine legali e JSON-LD.
      if (/esempio\.it$/i.test(String(c.email || '')) || /^Esempio S\.r\.l\./i.test(String(id.ragioneSociale || ''))) {
        warns.push('backend/data/identity.json e ancora l identita di esempio del template (Esempio S.r.l., @esempio.it): finirebbe in footer, pagine legali, JSON-LD e security.txt. Sostituiscila con i dati veri.');
      }
      if (!(filled(id.ragioneSociale) || filled(tit.nome)) || ![c.email, c.pec, c.telefono, tit.email].some(filled)) {
        warns.push('backend/data/identity.json non ha nome e recapito del titolare del trattamento: la Privacy Policy composta dall Engine resta senza titolare (il build locale e la CI si fermano). Se la Privacy e un tuo testo (markdown nello slot), ignora.');
      }
    } catch {}
  }
}
process.stdout.write(warns.join('\n'));
"
}

# Rimuove le immagini del preflight ("-pf-*") e la build cache diventata orfana di conseguenza.
# Restano sempre vive altrimenti: sono taggate esplicitamente da compose, mai "dangling", quindi
# il prune standard non le tocca. Sicuro: verificato che `docker builder prune -f` lascia intatta
# la cache di QUALSIASI altra immagine ancora taggata sull'host (anche di progetti gemelli sulla
# stessa VPS) — rimuove solo la cache non più referenziata da nessuna immagine viva.
#
# Enumerate per NOME via wildcard (non dai servizi della run corrente): un deploy parziale
# (--frontend da solo) lascerebbe altrimenti un "-pf-backend" orfano di una run precedente.
# Rimozione per nome e non per ID: se pf e prod producono lo stesso digest (contenuto identico),
# `docker image rm <id>` fallisce perché l'ID è taggato in più repository — per nome invece
# stacca solo quel tag, l'immagine di produzione resta intatta.
br1_cleanup_preflight_images() {
    local name
    while IFS= read -r name; do
        [[ -n "$name" ]] && { docker image rm "$name" >/dev/null 2>&1 || true; }
    done < <(docker image ls --filter "reference=${COMPOSE_PROJECT_NAME}-pf-*" --format '{{.Repository}}:{{.Tag}}')
    docker builder prune -f >/dev/null 2>&1 || true
}

# Rimuove dal disco della VPS ogni tag locale di un'immagine di release DIVERSO da quello appena
# swappato in produzione (deploy-release.sh: qui non c'è preflight "-pf-*", vedi sopra, ma ogni
# deploy scarica/carica un nuovo tag versionato e quello vecchio non è mai "dangling" — resta
# taggato per sempre, il prune standard non lo tocca).
#
# Chiamata SOLO dopo lo swap riuscito: a quel punto il pull/load della versione corrente ha già
# funzionato in questa run, quindi non stiamo scommettendo sulla disponibilità futura di GHCR —
# se un domani un rollback la trova irraggiungibile (repo privata, login scaduto), si risolve
# l'autenticazione allora, oppure si usa `--from-files` con i .tar.gz della Release (che non
# passa da GHCR). Il server deve avere solo la versione giusta, non un archivio di tutte quelle
# passate: la CI le conserva già su GHCR e come allegato della Release.
#
# Argomenti: uno o più "repository:tag" (l'output di `docker compose config --images`, che
# risolve il riferimento reale rispettando l'eventuale override RELEASE_IMAGE_FRONTEND/BACKEND
# dei fork) — così non c'è un nome GHCR hardcoded qui che dovrebbe restare sincronizzato con
# quello (diverso) di ogni fork.
br1_cleanup_old_release_images() {
    local current repo tag name
    for current in "$@"; do
        repo="${current%:*}"
        tag="${current##*:}"
        while IFS= read -r name; do
            [[ -z "$name" || "$name" == "${repo}:${tag}" ]] && continue
            docker image rm "$name" >/dev/null 2>&1 || true
        done < <(docker image ls --filter "reference=${repo}" --format '{{.Repository}}:{{.Tag}}')
    done
}
