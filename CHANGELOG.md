# Changelog

Storia delle modifiche del **template**. Le versioni qui descrivono l'evoluzione dell'Engine
e dell'infrastruttura; la versione del *sito* che ne deriva è separata e vive in
`project.version` dentro `global-settings.json` (fonte unica, iniettata nel frontend).

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [2.1.0] — 2026-06-10

Hardening da review completa del template: contratti async pronti per lo store DB, scala z-index
unificata con quella Bootstrap, idratazione incrementale sulla home demo, toolchain su Node 24.
Nessun breaking, nessuna azione richiesta.

### Added
- **Idratazione incrementale** (`withIncrementalHydration()` in `app.config.ts`): le sezioni
  below-fold della home demo usano `@defer (hydrate on viewport)` — contenuto sempre renderizzato
  dall'SSR (SEO invariata), idratazione solo quando la sezione entra nel viewport. È il pattern
  di riferimento per le pagine lunghe dei progetti figli.
- **Scala z-index del template** in `base.css` (`--z-cookie-banner`, `--z-fab`, `--z-skip-link`,
  `--z-cdk-overlay`): unico punto di verità, incastrato nei vuoti della scala Bootstrap. Prima il
  cookie banner (1050) e il back-to-top (1055) coincidevano con `modal-backdrop`/`modal`: un modale
  Bootstrap non li avrebbe coperti. Ora i widget persistenti stanno sotto offcanvas e modali.
- **`CancellationToken` lungo la catena dati** (`IContentStore` → `FileContentStore` → `SiteService`
  → controller → `FileUtils.ReadStaticFileAsync`): le letture si interrompono se il client abbandona
  la richiesta. Col parametro `= default` la firma è pronta per lo store DB senza breaking change.
- **`EngineJson.Web`**: opzioni `System.Text.Json` condivise del backend (un'istanza sola = cache
  dei metadata riusata; prima erano duplicate in `FileUtils` e `FileContentStore`).
- Utility **`.cursor-context-menu`** in `base.css`: la classe era già usata nella home demo ma mai
  definita; ora segnala col cursore la presenza del menu contestuale `[appContextMenu]`.
- **Zero warning, e blindati**: azzerati i 12 warning XML-doc del backend (costruttori delle
  eccezioni, `paramref`/`typeparamref` fuori scope) e il warning ESLint sull'alias di
  `appFitViewportMin`; la CI ora compila il backend con `-warnaserror`, così un figlio che
  eredita il template vede solo i *suoi* warning.

### Changed
- **Node 22 → 24 LTS** (`.nvmrc`, `frontend/Dockerfile`; la CI segue `.nvmrc`). Node 22 è in
  maintenance; Angular 21 supporta Node 24.
- **Login demo**: confronto di username e password **in tempo costante**
  (`CryptographicOperations.FixedTimeEquals`), come già per le API key. Le credenziali demo
  restano volutamente hardcoded nel controller: il login è opzionale e ogni figlio ha la
  propria sorgente di identità, un file o una config dedicati sarebbero scaffolding inutile.
- **Proxy dev Angular**: la lettura della `x-api-key` è unificata in `proxy.api-key.cjs`
  (prima duplicata tra `proxy.local.conf.cjs` e `proxy.docker.conf.cjs`).
- **Proxy SSR `/api`**: validazione fail-fast dell'origin backend — un URL malformato in
  configurazione produce un errore esplicito invece di errori criptici a ogni richiesta.
- **Teardown CI live-tests**: `COMPOSE_PROJECT_NAME` derivato da `global-settings.json` (stessa
  one-liner di `pre-push.sh`) invece che hardcoded `app` — il teardown resta corretto nei figli
  che rinominano `project.name`.
- `start-frontend-dev.sh`: `set -eu` — un `npm install` fallito non avvia più il dev server.

### Fixed
- `WriteIndented` rimosso dalle opzioni JSON usate solo in **de**serializzazione (configurazione
  morta che suggeriva un pretty-print inesistente).
- Ombre di `.surface-elevated`/`.fab` deduplicate nelle variabili `--shadowElevated` /
  `--shadowElevatedHover`.
- XML-doc backend: parametri non documentati e `cref` irrisolvibile in `FileContentStore`,
  carattere corrotto in un commento di `FileUtils`.
- Home demo: il badge hero diceva "Angular 19" — lo stack è Angular 21.
- `ALLOWED_WIDTHS` (`app.config.ts`): ripristinato l'ordine crescente (512 e 480 erano invertiti).
- **Cache immagini fuori dall'albero sorgenti** (`server-paths.ts`). La cache dei thumbnail
  WebP viveva in `src/assets/files/image-cache`, dentro l'albero sorvegliato da `ng serve`:
  ogni miniatura generata (es. cambiando width nell'asset resolver della home) scriveva lì,
  il watcher rilevava il file nuovo e **ricaricava la pagina**, azzerando lo stato del
  componente — sembrava che l'interazione "non prendesse". Stessa radice il fatto che thumbnail
  effimeri finissero copiati in `dist` al build (la pezza `clean:preview-cache`, ora rimossa).
  La cache è dato derivato, servito **solo** dagli handler Node (`/assets/files` è 404), quindi
  non ha motivo di stare sotto la web-root: ora vive in una cartella dedicata, di default nella
  temp di sistema isolata per progetto (hash del percorso asset), con override `IMAGE_CACHE_DIR`
  per un volume persistente in produzione. Pattern ereditato da ogni figlio senza configurazione.

### Documentazione
**Riorganizzazione per audience.** I README hanno ora due ruoli dichiarati (vedi la Mappa della
documentazione): il **README root** ospita la **vetrina della demo** — home e controller
dimostrativi, con cosa fa vedere ogni pezzo — perché gli esempi sono del template e i figli li
sostituiscono; `frontend/README.md` e `backend/README.md` sono **direttive di implementazione**
per i progetti figli e documentano solo strutture, strumenti di default e logica da seguire.
La tabella dei controller demo è uscita dal README backend (restano gli strumenti di fabbrica:
Blob e health check).

Audit completo codebase ↔ README (il template si spiega solo lì):
- **backend/README**: aggiunta la sezione **"Ordine della pipeline HTTP"** (era citata da
  `Program.cs` ma non esisteva); firma di `IContentStore` con `CancellationToken` negli esempi;
  nota su `EngineJson.Web` vs opzioni delle risposte API; scopo della cartella `db/` (mount del
  volume `db-data`, riservato al DB futuro); `GET /social` nella tabella dei controller.
- **frontend/README**: pattern dell'idratazione incrementale (`@defer (hydrate on viewport)`);
  regola "z-index e ombre solo via variabili" con la scala `--z-*`; flusso completo
  dell'`authGuard` (redirect con `returnPageType`/`reason=auth`, modale senza `loginPage`);
  nota sui proxy conf e su `proxy.api-key.cjs` nel Quick Start.
- **README root**: `setup.mjs` e `.nvmrc` nel Quick Start; `db/` e `uploads/` nell'albero delle
  cartelle; rotte SSR `/assets/legal/*` (servita con guard) e `/assets/files/*` (bloccata, 403)
  nella tabella delle route speciali.

## [2.0.1] — 2026-06-10

Fix mirati e una nuova directive, nessun breaking. Nessuna azione richiesta.

### Fixed
- **API key in dev locale (401 fantasma).** Backend (`Program.cs`), proxy dev (`proxy.local.conf.cjs`)
  e Node SSR (`server-env.ts`) ora **fondono `global-settings.local.json`** sopra `global-settings.json`,
  lo stesso deep-merge che `scripts/lib/br1-config.sh` fa in prod col file effettivo. Prima, in locale
  (Visual Studio + `ng serve`), il backend leggeva solo `global-settings.json` — privo di `Security` —
  quindi `ApiKeys` era vuoto e **ogni richiesta API rispondeva 401**, a meno di passare una env var
  `Security__ApiKeys__0`. Ora la chiave arriva dalla sorgente unica `global-settings.local.json` senza
  env var né deploy. In Docker/prod il `.local` non esiste (segreti già fusi nel file montato) → no-op.
- **Contrasto testo muted in tema scuro (WCAG 2.1 AA 1.4.3).** `--colorMutedText` / `.text-muted` era
  reso conforme 4.5:1 contro lo **sfondo pagina** (`baseDkHex`, L=0.140), ma vive su card/pannelli
  (`--colorSurface`, L=0.180, più chiaro) → contrasto reale 4.36:1. Ora `colorMutedTextDk` è calcolato
  contro la **superficie**: ≥4.5:1 sulle card e, essendo la base più scura, anche sulla pagina. In tema
  chiaro nulla cambia (lì la base resta il caso peggiore). Rilevato da pa11y nei live test.

### Added
- **Directive `appFitViewport`** (`core/engine/directives/`): porta l'altezza di un elemento a riempire
  il viewport senza creare scroll di pagina (mappe, giochi, dashboard a tutto schermo). Calcolo
  auto-adattivo (`innerHeight − resto della pagina`), `appFitViewportMin` per l'altezza minima.
  Vedi [frontend/README.md](frontend/README.md) → *Directive `appFitViewport`*.

### Note / avvertenze
- **`Custom` lato browser richiede SSR sulla rotta.** `inject(APP_CUSTOM)` si popola dal `TransferState`,
  emesso solo dall'SSR: su una rotta `renderMode: 'client'` (incluse le pagine `requiresAuth`) al
  caricamento diretto `APP_CUSTOM` è `{}`. Una pagina che legge `Custom` lato client va tenuta
  `renderMode: 'server'`. Documentato in `app-custom.ts` e [frontend/README.md](frontend/README.md).
- Promemoria: la CI pre-push **non** è un git hook versionato — va installata per-clone con
  `bash scripts/test/install-hooks.sh` (vedi [README.md](README.md)).

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
