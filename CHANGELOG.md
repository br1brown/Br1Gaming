# Changelog

Storia delle modifiche del **template**. Le versioni qui descrivono l'evoluzione dell'Engine
e dell'infrastruttura; la versione del *sito* che ne deriva è separata e vive in
`project.version` dentro `global-settings.json` (fonte unica, iniettata nel frontend).

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [2.0.0] — 2026-06-08

Revisione maggiore. Questo è il primo changelog: la voce qui sotto riassume **tutto** ciò che
cambia rispetto alla baseline 1.0.0. Leggi prima la sezione **"Richiede un'azione"**.

### ⚠️ Richiede un'azione (breaking)
- **Angular 19 → 21, ora `zoneless`** (rimosso `zone.js`). Dopo l'aggiornamento: `cd frontend && npm ci`.
  Se nel tuo dominio usavi `NgZone.runOutsideAngular` / `ngZone.run`, non servono più: la change
  detection è guidata dai signal.
- **Configurazione divisa in 3 file per proprietario**:
  - `global-settings.json` (**committabile, del progetto**): `project` (nome, versione), `Localization`
    (lingue), `site` (descrizione, tema, smoke — solo identità/estetica), `Custom`. Versionabile dal figlio.
  - `global-settings.local.json` (**gitignored**): pubblicazione e segreti — `frontend` (hostname, porta),
    `backend`, `Security` (ApiKeys, CorsOrigins, BehindProxy, SecretKey).
  - `security-headers.json` (**del template**): header fissi.

  Per un nuovo progetto: `node setup.mjs "Nome Progetto"` (imposta il nome nel file di progetto e crea
  il `.local` coi segreti generati).
- **Identità/estetica del sito fuori da `site.ts`**: descrizione, tema ed effetto smoke vivono in
  `global-settings.json` (sezione `site`), iniettati nel frontend al build via `environment.ts`.
  In `site.ts` resta tutta la **struttura e il comportamento**: pagine, menu, `pageForAuthGuard`,
  gli slot `legalPages` (l'Engine costruisce da solo il nodo `/policy/*` dalle pagine valorizzate;
  slot omesso = pagina assente; lo slot `cookie` è obbligatorio se il sito usa cookie, altrimenti
  errore al build), il comportamento della shell
  (`shell`: `showNav`/`showFooter`/`fixedTopHeader`/`showBrandIconInHeader`/`showLoginInHeader`/`forcedLightPanel`),
  `isWebApp` (PWA) e `onlyPlainImage` (preview social). **[azione]** se avevi personalizzato il blocco
  `config` in `site.ts`: porta descrizione/tema/smoke in `global-settings.json → site`, i flag di
  comportamento in `shell`/`isWebApp`/`onlyPlainImage`.
- **Nome e versione dell'app** vivono in `global-settings.json` (`project.name`/`project.version`),
  iniettati nel frontend al build. `setup.mjs` rinomina anche gli identificatori generici "app"
  (soluzione `.sln`, nomi npm/SW) col nome del prodotto.
- **`deploy.sh` cambiato**: non esiste più `--dev` (lo sviluppo locale è Angular dev server +
  Visual Studio, non Docker); nuovi flag `--frontend` / `--backend` per pubblicare i due servizi
  in modo indipendente.

### Aggiunto
- **Pubblicazione disaccoppiata**: `./deploy.sh --frontend` / `--backend` (default: entrambi);
  backend privato o pubblico secondo `backend.public`.
- **Merge profondo** in `deploy.sh` (`global-settings.json` + `.local`) + iniezione della sola config
  di progetto (no segreti) nel build frontend via l'ARG `BR1_PROJECT_JSON`.
- **`backup.sh`**: backup dei volumi dati (uploads, db) con retention, pronto per cron.
- **Guard segreti** in `deploy.sh`: blocca la pubblicazione se restano segreti di default o troppo deboli.
- **Compressione gzip** automatica di tutte le risposte SSR e **graceful shutdown** del Node SSR
  (SIGTERM/SIGINT: drena le connessioni in volo prima di uscire).
- **`llms.txt`** (indice per crawler AI) e **`security.txt`** (RFC 9116, servito su `/.well-known/`),
  generati al build.
- **`apiErrorInterceptor`**: la notifica degli errori HTTP è centralizzata in un interceptor; il
  client API resta puro (propaga un `ApiError` tipizzato), opt-out con `{ silent: true }`.
- **`ShareService` puro**: i metodi ritornano un esito (`ShareResult`), il toast lo mostra il
  componente (o l'helper `shareResultNotice`).
- **`security-headers.json`**: gli header di sicurezza fissi del template (X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy, CSP) vivono in un file
  separato, template-owned, letto da backend e Node SSR. Sono uguali per ogni progetto: il figlio
  non li scrive né può cancellarli. In `global-settings` resta solo la sicurezza del progetto
  (`ApiKeys`, `CorsOrigins`, `BehindProxy`, `Token`).
- **gitleaks** in CI (secret scanning) + allowlist `.gitleaks.toml`.
- **`.editorconfig`** per formattazione coerente tra editor.
- Libreria condivisa `scripts/lib/br1-config.sh` (lettura config) e harness `scripts/test/public-test.sh`
  (stack dietro reverse proxy per i test a11y/Lighthouse).

### Cambiato
- **Security headers**: HSTS (`Strict-Transport-Security`) e `Permissions-Policy` con `browsing-topics=()`.
- **og:image preview firmate** con chiave derivata dall'API key segreta (non più da `appName:version`,
  che sono pubblici e permettevano di forgiare le anteprime).
- **Cookie** scritti con flag `Secure` automatico su HTTPS.
- **`allowedHosts` fail-closed**: senza hostname configurato il Node SSR accetta solo gli host locali
  e rifiuta il traffico reale con 421, invece di accettare qualsiasi `Host`.
- **`deploy.sh` riscritto e semplificato**: la build è il gate (se non compila, la produzione resta
  intatta); preflight isolato leggero (`docker compose up -d --wait` su porte effimere, via gli
  HEALTHCHECK dei Dockerfile) prima dello swap; i conflitti di porta vengono solo **segnalati**, mai
  con chiusura automatica di container.
- **Notifiche fuori dai servizi**: i servizi fanno il loro lavoro e restituiscono un esito; la
  notifica è del componente che scatena l'azione.
- **Data di ultima modifica esplicita**: `<lastmod>` della sitemap e `og:updated_time` ora vengono
  da `project.lastModified` in `global-settings.json` (formato `GG/MM/AAAA`), non più dall'ultimo
  commit git — che li faceva cambiare a ogni deploy anche senza modifiche reali ai contenuti
  (segnale `<lastmod>` inaffidabile). Si bumpa a mano; fallback alla data del build se assente.
- **Descrizione del sito per-lingua**: `site.description` in `global-settings.json` è ora una mappa
  `{ it, en, … }` invece di una singola stringa, così footer e JSON-LD seguono la lingua corrente
  (prima erano sempre in lingua default). I file statici usano la lingua default, l'SSR localizza
  per richiesta. Una stringa singola è ancora accettata (normalizzata sulla lingua default).
- Documentazione (`README`, `DOCKER_README`, `backend/README`, `frontend/README`) riallineata allo
  stato attuale.

### Rimosso
- **`zone.js`** e i workaround `NgZone` interni all'Engine.
- **OpenTelemetry** (osservabilità a 3 pilastri: trace, metriche, log): superflua per il template.
- **Test unitari e runner Karma/Jasmine**: il template non porta i propri test ai progetti figli.
  La qualità resta presidiata dai gate di **norma**: lint, type-check, completezza i18n, dipendenze
  circolari, accessibilità WCAG (a11y) e budget Lighthouse — in CI e nel git hook pre-push.
- **Dev-via-Docker** (`docker-compose.override.yml`): lo sviluppo locale usa Angular dev server +
  Visual Studio.

## [1.0.0]
- Baseline iniziale del template: DSL `site.ts`, SSR Angular + Node, sicurezza (API key,
  JWT opzionale, CORS, rate limiting, ProblemDetails), i18n, tema OKLCH/WCAG, PWA, consenso
  cookie GDPR, image CDN `/cdn-cgi`. Stack Angular 19 (con `zone.js` e test Karma/Jasmine),
  osservabilità OpenTelemetry, deploy blue/green.
