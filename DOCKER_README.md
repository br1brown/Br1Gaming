# Br1WebEngine - Docker Setup

Guida operativa per eseguire Br1WebEngine con Docker. Per architettura completa, DSL frontend e personalizzazione del progetto, vedi anche [README.md](README.md).

## Modello d'uso

Il template Docker e' progettato per essere riusabile su piu' progetti sulla stessa VPS. Ogni progetto derivato dal template viene eseguito in una propria cartella con un proprio `global-settings.json` e una propria porta.

### Inizializzazione (una volta, alla nascita del progetto)

La configurazione è divisa in quattro file per proprietario (i primi tre validati da `global-settings.schema.json` per l'autocomplete):

- **`global-settings.json`** — del **progetto**, committabile: identità e aspetto (`project`, `Localization`, `site`, `Features`, `Custom`).
- **`global-settings.local.json`** — **gitignored**: pubblicazione e segreti del singolo ambiente (`frontend`, `backend`, `Security`, `Mail`, `ErrorReporting`).
- **`security-headers.json`** — del **template**, non si tocca: header di sicurezza fissi. Il Node SSR ne verifica lo sha256 all'avvio e si rifiuta di partire se è stato modificato a mano.
- **`security-headers.override.json`** — del **progetto**, committabile: estensioni dichiarative alla CSP (nuovi domini in `connect-src`/`img-src`/`frame-src`/...), senza toccare il file del template. Vedi [frontend/README.md](frontend/README.md) §"Estendere la CSP".

`scripts/deploy.sh` fonde i primi due e monta il risultato; backend e Node SSR lo leggono. La scorciatoia `node setup.mjs "Nome Progetto"` imposta il nome nel file di progetto e scrive il `.local` coi segreti generati.

### Avvio di un progetto derivato

Per il percorso guidato passo-passo vedi [QUICKSTART.md](QUICKSTART.md). Il meccanismo sotto: `./scripts/deploy.sh` legge `global-settings.json`, verifica la configurazione e avvia i container. Il file viene montato read-only in entrambi i container (`/app/global-settings.json:ro`): cambiare il file e rieseguire il deploy è sufficiente per applicare la configurazione a tutti i livelli.

> Produzione vs test: `./scripts/deploy.sh` builda le immagini sulla macchina dove lo lanci, comodo per lo sviluppo locale e i test, ma sconsigliato in produzione. Per la produzione il modello consigliato è artifact-based: la CI builda le immagini a ogni tag e le pubblica su GHCR, la VPS le scarica con `./scripts/deploy-release.sh`. Niente sorgente, niente `git pull`, niente build in loco. Guida completa in [RELEASE.md](RELEASE.md).

### Esposizione dei servizi

- Ogni progetto espone il frontend su una porta host dedicata (`frontend.port`, es. `http://IP:3000`, `http://IP:3001`)
- Il backend puo' essere esposto impostando `backend.public: true` (richiede `docker-compose.backend-exposed.yml`)
- Frontend e backend comunicano sempre tramite rete Docker interna
- **Una istanza di backend per progetto.** Notifiche realtime, cache e revoca delle sessioni (`ISessionRevocation`, che respinge i JWT dopo la cancellazione dell'account) vivono nella memoria del processo backend. Un reverse proxy davanti, o il frontend su un'altra macchina, non cambiano nulla: la revoca sta dove si validano i token. Due istanze del backend dietro un bilanciatore invece non si vedono fra loro: prima di scalare così vanno sostituite con un backplane condiviso (Redis) le implementazioni in memoria, vedi [backend/README.md](backend/README.md) «Sostituire un servizio dell'Engine». Un server più grande è la strada prevista
- Davanti alle porte di solito c'è un reverse proxy della VPS (Nginx, Caddy…) che instrada per hostname. Il suo access log registra l'IP di ogni richiesta: è un dato di navigazione della Privacy Policy. I fatti del server (fornitore, paese, CDN, reverse proxy, log e loro durata, compresi quelli dei container, che il compose ruota per dimensione, `max-size` 10m e `max-file` 3, e che quindi si dichiarano senza `conservazioneGiorni`: la Privacy dice che hanno dimensione limitata e ruotano) vanno in un file JSON per server, fuori dai progetti (es. `/home/deploy/hosting.json`, modello in `hosting-info.example.json`), e ogni progetto lo indica in `global-settings.local.json` con `frontend.hostingInfo` (relativo alla root del progetto, es. `../hosting.json`). Il deploy lo monta in sola lettura nel frontend e si ferma se il file non c'è; la Privacy di ogni sito genera da lì la sezione "Dati di navigazione". Cambi la rotazione di Nginx (`rotate` in `/etc/logrotate.d/nginx`)? Aggiorni `conservazioneGiorni` in quel file e riavvii i frontend.

### Esempio: due progetti sulla stessa VPS

```text
/home/deploy/progetto-a/global-settings.json   →  project.name "Progetto A"  frontend.port 3000
/home/deploy/progetto-b/global-settings.json   →  project.name "Progetto B"  frontend.port 3001
```

Risultato:
- `http://IP:3000` → progetto-a
- `http://IP:3001` → progetto-b
- `COMPOSE_PROJECT_NAME` è derivato slugificando `project.name` (`Progetto A` → `progetto-a`)
- Volumi separati: `progetto-a_uploads-data`, `progetto-b_uploads-data` (naming automatico Docker Compose)
- Nessun conflitto di container

## File Compose

- **`docker-compose.yml`** — base: servizi, build, rete, volumi.
- **`docker-compose.release.yml`** — override di **produzione**: usa immagini pre-costruite da GHCR (`image:`) invece di ricostruire da sorgente (`build:`). Lo usa `./scripts/deploy-release.sh` (vedi [RELEASE.md](RELEASE.md)).
- **`docker-compose.backend-exposed.yml`** — opzionale: espone il backend verso l'host su `BACKEND_PORT` (quando `backend.public: true`)
- **`docker-compose.public-test.yml`** — overlay per simulare un reverse proxy pubblico davanti al frontend SSR (usato dai test a11y/Lighthouse via `scripts/test/public-test.sh`). Indicizzazione lasciata attiva (il test SEO/Lighthouse misura la pagina reale); per un'anteprima non-indicizzabile avviala con `PUBLIC_TEST_NOINDEX=true`

> Lo sviluppo locale non passa da Docker: si usa lo script del frontend (Angular dev server) + Visual Studio per il backend.

## Configurazione

Due file da modificare (il terzo, `security-headers.json`, è del template). Le chiavi e i vincoli
sono documentati in `global-settings.schema.json`: l'editor offre autocomplete e validazione.

> **Scorciatoia:** `node setup.mjs "Nome Progetto"` imposta il nome nel file di progetto e scrive
> `global-settings.local.json` coi **segreti già generati** (SecretKey JWT, API key), e spegne tutte le `Features` in `global-settings.json`.
> A mano: `cp global-settings.local.example.json global-settings.local.json` poi
> `openssl rand -base64 48` (SecretKey) e `openssl rand -base64 32` (ApiKey).

Al deploy, `scripts/deploy.sh` fonde `global-settings.local.json` sopra `global-settings.json` (merge
profondo; gli array come `ApiConfig.Keys`/`SupportedLanguages` vengono sostituiti), genera
`.br1-settings.effective.json` (gitignorato) e monta quello nei container. L'intero
`global-settings.json` del progetto (`project`/`Localization`/`site`/`Features`/`Custom`, senza segreti) viene
passato anche al build del frontend come ARG `BR1_PROJECT_JSON` e iniettato in `environment.ts`.
Da questo stesso JSON il generatore di file statici (`generate-statics.ts`) ricava lingua di default e
lingue supportate (sezione `Localization`) per SEO e `environment.ts`: non servono build-arg dedicati.

> Manca `global-settings.local.json`? Gli script di pubblicazione (`scripts/deploy.sh`,
> `scripts/deploy-release.sh`) lo generano da sé con i segreti (`SecretKey`/`ApiConfig.Keys`)
> ma lasciando `frontend.hostname` vuoto di proposito: le chiavi sono boilerplate, il dominio è una
> tua scelta consapevole. Il deploy si ferma finché non imposti il dominio (fail-closed:
> niente dominio ⇒ niente 421 al dominio reale), e la porta se hai altri progetti sulla stessa VPS.
> Il mailer resta spento finché non accendi `Features.Mail` e aggiungi la sezione `Mail`. Niente valori finti che aggirerebbero i
> controlli. (Nei test/CI invece si resta senza `.local`: `scripts/lib/br1-config.sh` usa una API key
> effimera, più valori usa-e-getta (SecretKey, Mail, WebhookUrl) per le funzioni accese in `Features`, senza scrivere file.)

### `global-settings.json` — progetto (committabile)

| Chiave | Default | Descrizione |
|---|---|---|
| `project.name` | `App` | Nome dell'app; mostrato in UI/manifest e slugificato in `COMPOSE_PROJECT_NAME` |
| `project.version` | `1.0.0` | Versione dell'app: meta `app-version`, manifest, rilevamento aggiornamenti |
| `project.lastModified` | data del build | Ultima modifica contenuti (`GG/MM/AAAA`): `<lastmod>` sitemap + `og:updated_time`. Bumpala a mano |
| `Localization.DefaultLanguage` | `it` | Lingua di default: tag BCP-47 valido e **incluso in `SupportedLanguages`** |
| `Localization.SupportedLanguages` | `["it","en"]` | Lingue supportate (tag BCP-47, almeno 1 elemento; deve includere `DefaultLanguage`) |
| `site.description` | — | Descrizione per-lingua `{ it, en, … }` (SEO, footer, social); build usa la lingua default, SSR localizza |
| `site.colorTema` | — | Colore del brand (hex), l'unico colore in questo file: da lui la build calcola la palette OKLCH e la compila dentro Bootstrap. Tinta di fondo (`colori.sfondo`) e colori aggiuntivi (`colori.palette`) sono del design system attivo |
| `Custom` | `{}` | Valori liberi leggibili da backend (`IConfiguration["Custom:..."]`) e Node SSR (`getBr1Settings().Custom`) |
| `Features.*` | `false` | Interruttori booleani: `Login` (riservato agli amministratori), `PublicLogin` (link in navbar e parte `login` nella Privacy Policy, vince su `Login`), `Mail`, `ErrorReporting`, `Forms`. Vivono qui e in nessun altro file: il frontend li compila, il server SSR esce se il file montato diverge da quelli compilati, il backend non parte con una qualunque chiave `Features`/`Features__*` da variabili d'ambiente o riga di comando (qualunque valore), il deploy si ferma con `Features` nel `.local`. Chiave sconosciuta, maiuscole diverse o valore non booleano fermano il build. Acceso senza configurazione nel `.local` = backend e deploy si fermano; configurazione senza flag = funzione spenta |

> Struttura e aspetto (`navbar`, `footer`, `breadcrumb`, `tono`, `movimento`, `og`, l'effetto `smoke`, i colori `colori.sfondo`/`colori.palette`, il font) non stanno in `global-settings.json`: sono campi del design system attivo (`DesignSystemPreset`, `frontend/src/app/core/engine/design-system-presets.ts`), scelto o esteso in `frontend/src/app/site.ts` (`shell.designSystem`); vedi [frontend/README.md](frontend/README.md), capitolo «Design system e tema». Sono flag di `site.ts`, non estetici, `shell.showNotifications` e `isWebApp`; il link di login in navbar lo decide `Features.PublicLogin` in `global-settings.json`. L'icona di brand nella navbar è `ShellNavResolver.brandIcon` in `nav.ts`, dato risolto a runtime (SE mostrarla lo decide `navbar.icona` del design system). Tema e font si compilano al build: un cambio al design system vuole un nuovo build (o, in sviluppo, il riavvio del dev server).

### `global-settings.local.json` — pubblicazione + segreti (gitignored)

| Chiave | Default | Descrizione |
|---|---|---|
| `frontend.hostname` | `""` | Dominio pubblico senza schema. Deriva `FRONTEND_BASE_URL` e `NG_ALLOWED_HOSTS`. Senza hostname (né `NG_ALLOWED_HOSTS`) il Node SSR accetta gli host locali e nessun altro, ed è **fail-closed**: in produzione il traffico reale viene rifiutato con **421 Misdirected Request**. Per più domini, imposta direttamente `NG_ALLOWED_HOSTS` (vedi sotto) |
| `frontend.port` | `3000` | Porta host del frontend |
| `frontend.hostingInfo` | `""` | Percorso del file JSON coi fatti del server (hosting, CDN, reverse proxy, log), relativo alla root del progetto o assoluto: la Privacy Policy ne genera la sezione "Dati di navigazione". Vuoto = testo generico; indicato ma assente o non valido = il deploy e il frontend si fermano. Schema in `frontend/src/app/core/engine/legal/hosting-info.schema.json`, modello in `hosting-info.example.json` |
| `backend.public` | `false` | `true` espone il backend sull'host (richiede `docker-compose.backend-exposed.yml`) |
| `backend.publicPort` | `null` | Porta host del backend, con `public: true` |
| `Security.ApiConfig.Keys` | — | Chiavi API del backend (header `X-Api-Key`); il frontend usa `[0]`. In produzione almeno 32 caratteri ciascuna (il deploy lo verifica) |
| `Security.ApiConfig.RateLimiting.*` | vedi [backend/README.md](backend/README.md) | Soglie del rate limiter (globale, login) ed `Enabled` per disattivarlo |
| `Security.CorsOrigins` | `[]` | Origini CORS ammesse |
| `Security.BehindProxy` | `false` | `true` quando si è dietro un reverse proxy (legge `X-Forwarded-For`) |
| `Security.Token.SecretKey` | `""` | Segreto JWT: almeno 32 byte UTF-8, senza spazi o a capo ai bordi (rifiutata, non ripulita), diverso dal segnaposto dell'esempio. Requisito del login, che si accende con `Features.Login`/`PublicLogin`; stessa regola nel backend e negli script di deploy |
| `Security.Token.ExpirationSeconds` | `3000` | Durata dei JWT emessi (minimo 60) |
| `Mail.*` | — | Config SMTP del mailer (`Host`, `Port`, `Security`, `FromAddress`, `FromName`, `Username`, `Password`, più i tuning `TimeoutSeconds`/`MaxAttachmentBytes`/`VerifyRecipientDomain`): contiene segreti, vive qui. Requisito di `Features.Mail`: il mailer si accende con il flag più `Host`+`FromAddress`; spento, ogni invio risponde `503`. L'esempio (`global-settings.local.example.json`) include già un blocco SMTP, inerte finché `Features.Mail` è spento. Dettaglio dei campi in [backend/README.md](backend/README.md) (sezione Mailer) |
| `ErrorReporting.WebhookUrl` | `""` | URL di un webhook generico (POST JSON) a cui l'Engine segnala ogni bug vero o errore ≥500. Requisito di `Features.ErrorReporting`: senza il flag nessuna chiamata uscente. Nessun SDK di vendor: se punti più progetti sulla stessa VPS allo stesso webhook, il payload porta `project` per distinguerli. Dettaglio in [backend/README.md](backend/README.md) (sezione Error Reporting) |

> Header di sicurezza in `security-headers.json`. Gli header fissi rivolti al browser
> (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy, CSP) sono
> uguali per ogni progetto: vivono in `security-headers.json` (file del template, montato in
> entrambi i container e letto da backend e Node SSR). Appartiene al template, non al progetto figlio: lo riceve e lo aggiorna col merge dal template, l'unica
> eccezione è l'override documentato nella `_nota` del file (vedi il README principale). In
> `global-settings` resta la sicurezza del progetto e nient'altro: `ApiConfig`, `CorsOrigins`, `BehindProxy`, `Token`.

`BACKEND_ORIGIN` (`http://backend:8080`) resta una variabile d'ambiente del compose: è l'indirizzo Docker-interno del backend, non una scelta di configurazione utente. Stesso trattamento, direzione opposta, per `Frontend__Origin` (`http://frontend:3000`, sezione `Frontend` del backend, convenzione .NET `Frontend:Origin`): l'indirizzo Docker-interno del frontend, che serve a `SitemapNotifier` per invalidare la cache di `/sitemap.xml` dopo una scrittura su un catalogo `dynamicParams` (dettaglio in [backend/README.md](backend/README.md)).

### Variabili d'ambiente del frontend SSR (opzionali)

Variabili lette al boot dal container Node frontend (`frontend/src/app/core/engine/server/server-env.ts`). Non stanno in `global-settings.json`: si impostano nell'ambiente del container quando servono, altrimenti valgono i default.

| Chiave | Default | Descrizione |
|---|---|---|
| `TRUST_PROXY` | `loopback, linklocal, uniquelocal` | Valore di Express `trust proxy`: `true`/`false`, un numero di hop, o una lista di reti/nomi (interpretati, non passati come stringa: `true` è il booleano). Lista ristretta (subnet private) per evitare lo spoofing di `X-Forwarded-Host`/`X-Forwarded-For` e il bypass dell'allowlist |
| `PROXY_TIMEOUT_MS` | `30000` | Timeout (ms) delle chiamate proxy `/api/*` verso il backend |
| `PREVIEW_CRYPTO_SECRET` | `""` | Chiave AES-GCM per cifrare i payload og:image di `/cdn-cgi/preview`. Se vuota, la chiave ricade sull'**API key server-side** (`Security.ApiConfig.Keys[0]`, un segreto → i blob restano non falsificabili) e, in sua assenza, su `appName:version`. Impostala per disaccoppiare la firma delle anteprime dalla rotazione delle API key |
| `NG_ALLOWED_HOSTS` | — | Allowlist host SSR, lista separata da virgole. **Ha precedenza su `frontend.hostname`** (utile per multi-dominio). Se né questa né l'hostname sono valorizzati, fallback fail-closed agli host locali → gli host reali ricevono `421` |
| `IMAGE_CACHE_DIR` | `<temp di sistema>/…` | Cartella dei thumbnail di `/cdn-cgi/asset` e `/cdn-cgi/preview`. Default nella temp (isolata per progetto), e per questo **effimera**: riparte fredda a ogni riavvio. Per una cache **calda tra i deploy**, monta un volume persistente e puntalo qui (dettaglio in [frontend/README.md](frontend/README.md)) |
| `IMAGE_CACHE_MAX_MB` | `500` | Cap della cache immagini su disco; oltre la soglia uno sweep LRU ogni 6 ore la riporta al 90% del cap |
| `IMAGE_JOBS_MAX` | `max(2, CPU disponibili)` | Tetto di concorrenza sui job `sharp` (decode/resize) di `/cdn-cgi/asset` e `/cdn-cgi/preview` — indipendente dal cap di dimensione sopra. I job eccedenti aspettano in una coda FIFO interna (non bounded, nessun timeout): su cache fredda con tante immagini nella stessa pagina, un ritardo di caricamento silenzioso invece di un errore. Dettaglio in [frontend/README.md](frontend/README.md) |
| `SEO_NOINDEX` | `false` | Se `true` (`1`/`yes`/`on`), rende l'intero deploy **non indicizzabile**: `X-Robots-Tag: noindex, nofollow` su ogni risposta + `robots.txt` dinamico `Disallow: /`. Per staging/anteprima dietro lo stesso reverse proxy della produzione. **Lascialo spento in produzione (default).** Su un deploy si imposta come passthrough prima del comando: `export SEO_NOINDEX=true; ./scripts/deploy.sh` (stessa convenzione di `Mail__Password`). L'overlay `docker-compose.public-test.yml` lo lascia spento (così il test SEO/Lighthouse è significativo); per un'anteprima non indicizzabile avviala con `PUBLIC_TEST_NOINDEX=true` |
| `FONTS_DIR` | `/app/fonts` | Cartella in cui il server cerca i file dei font custom dichiarati in `font.principale`/`font.aggiuntivi` del design system attivo (vedi sotto). Il default coincide già col mount point Docker; da impostare per uno sviluppo locale con un percorso diverso |
| `SITEMAP_CACHE_TTL_MS` | `604800000` (7 giorni) | TTL della cache in-process di `/sitemap.xml` per le pagine con `dynamicParams`. Alto perché non è il meccanismo primario di aggiornamento: l'invalidazione vera arriva on-demand dal backend (`SitemapNotifier`, `POST /internal/revalidate-sitemap`) dopo una scrittura su un catalogo dinamico — questo TTL è il fallback se quella notifica si perde. Dettaglio in [frontend/README.md](frontend/README.md) |

### Variabili d'ambiente del backend (opzionali)

Stessa logica del frontend sopra: non stanno in `global-settings.json`, si impostano nell'ambiente del container quando serve, altrimenti valgono i default.

| Chiave | Default | Descrizione |
|---|---|---|
| `BLOB_WEBOPT_CACHE_MAX_MB` | `500` | Cap della `MemoryCache` in-process che tiene i blob ridimensionati/riconvertiti al volo (`GET /blob/{slug}?webopt=true`) — dedicata, separata dalla `IMemoryCache` condivisa usata per i JSON di config. Superato il tetto, l'eviction è automatica (nativa di `MemoryCache`, non uno sweep a orario come `IMAGE_CACHE_MAX_MB`). Dettaglio in [backend/README.md](backend/README.md) § `EngineBlobController` |

### Font custom (opzionale)

Il container frontend ha già installati gli 11 font del catalogo `SystemFont` (Roboto, Noto, Liberation, DejaVu, Open Sans, JetBrains Mono e varianti): un `SystemFont` in `font.principale` funziona senza file da montare. In sviluppo su Windows, fuori dal container, quei font non sono installati: le URL `/cdn-cgi/font/<Nome>/…` rispondono 404 e il browser usa il font di ripiego, com'è normale.

Per un font tuo metti il file in `./fonts` (host, accanto a `global-settings.json`), poi dichiaralo come `font.principale` nel patch di `extendDesignSystem` del design system attivo: un `CustomFontDef` pieno, scritto lì direttamente (`{ key, family, faces }`, `faces` almeno la regular): `font: { principale: { key: 'brand', family: 'MiaFont', faces: [{ file: 'MiaFont.woff2', weight: 400, style: 'normal' }] } }`. `file` è un nome nudo (`.ttf`, `.otf`, `.woff`, `.woff2`), senza cartelle. `docker-compose.yml` monta quella cartella read-only su `/app/fonts`. Senza font in `font.principale` resta lo stack di font di sistema; un file dichiarato ma assente dalla cartella lascia il font di ripiego e una riga informativa nel log.

Il font vale per il sito e per le immagini Open Graph (`/cdn-cgi/preview`): per le immagini il server chiede a `fc-scan` il nome REALE che fontconfig assegna al file (non per forza uguale a `family`, che è l'etichetta `@font-face` per il browser), altrimenti Sharp/librsvg ripiegherebbero in silenzio sul font di sistema pur avendo il file corretto sotto mano. Nome e metriche del font si leggono una volta per processo: dopo aver sostituito un file nella cartella, riavvia il container frontend. Per un percorso host diverso da `./fonts`: `export BR1_FONTS_DIR=/percorso/font; ./scripts/deploy.sh`. Dettagli (`font.aggiuntivi`, `og.testo` per personalizzare l'immagine OG) in [frontend/README.md](frontend/README.md), capitolo «Design system e tema».

## Sviluppo locale

Lo sviluppo non passa da Docker. `global-settings.local.json` (`SecretKey` per il login demo acceso in `Features`, API key per il proxy del dev server) lo genera `setup.mjs`, e se manca lo crea da sé il primo che parte fra `generate:statics` e il backend in Development. Si avviano i due progetti separatamente:

```bash
# Backend (.NET 9)
cd backend && dotnet run        # oppure Visual Studio

# Frontend (Angular 21)
cd frontend && npm install && npm run start
```

Il frontend si connette al backend tramite proxy. `npm run start` (come `dev`, `build` e `watch`) esegue prima `npm run generate:statics`, che compila il tema e l'elenco dei testi legali: un `ng serve` lanciato a mano vuole prima quel comando. Il tema si compila all'avvio: cambiato il design system, `site.colorTema` o i file in `src/assets/legal/`, riavvia il dev server. Docker resta per la pubblicazione e per i test simili alla produzione.

## Pubblicazione (`scripts/deploy.sh`)

> In produzione il modello consigliato è artifact-based (`scripts/deploy-release.sh`: la CI builda le immagini, la VPS le scarica; vedi [RELEASE.md](RELEASE.md)). `scripts/deploy.sh` qui sotto è source-based (builda sulla macchina): ottimo per test e sviluppo locale. I due condividono preflight, guard e swap; cambia chi costruisce le immagini.

```bash
# Configurare global-settings.local.json con i valori del progetto, poi:
# (se manca, lo script lo genera con le chiavi e hostname VUOTO: imposti tu il dominio)
./scripts/deploy.sh                # pubblica frontend + backend
./scripts/deploy.sh --frontend     # il frontend e basta
./scripts/deploy.sh --backend      # il backend e basta
./scripts/deploy.sh --no-cache     # rebuild immagini ignorando la cache Docker (combinabile coi flag sopra)
```

In produzione:

- **Frontend** su `http://localhost:FRONTEND_PORT`
- **Backend** privato per default (per esporlo: `backend.public: true` in `global-settings.local.json`)

Frontend e backend sono disaccoppiati: puoi pubblicarli insieme o uno alla volta (anche su VPS diverse). Il backend è privato o pubblico secondo `backend.public`.

> Guard segreti (automatico): al deploy `scripts/deploy.sh` verifica che non siano rimasti i segreti segnaposto/deboli di default. Col login acceso (come il backend), se `Security.Token.SecretKey` è ancora il segnaposto dell'esempio, ha spazi o a capo ai bordi o è sotto i 32 byte UTF-8, o se `Security.ApiConfig.Keys` contiene `frontend` / chiavi < 32 caratteri, il deploy si ferma con un messaggio esplicito (e il comando `openssl` per generarne uno sicuro). I segreti si generano con `openssl rand -base64 48` (JWT) e `openssl rand -base64 32` (API key). Si ferma anche se una funzione è accesa in `Features` senza la sua configurazione (`SecretKey`, `Mail.Host`/`FromAddress`, `ErrorReporting.WebhookUrl`).

> Guard pubblicazione (automatico): due errori silenziosi tipici dietro reverse proxy, intercettati prima della build:
> - **`frontend.hostname` mancante** → il deploy si ferma. Senza hostname l'SSR è fail-closed e risponderebbe 421 al dominio reale (e sitemap/canonical/og userebbero `example.com`); insidioso perché l'healthcheck del preflight gira su `localhost` e passerebbe: il deploy sembrerebbe riuscito mentre il sito è irraggiungibile dal dominio vero.
> - **`Security.BehindProxy` non `true`** → avviso non bloccante: dietro nginx il rate limiter conterebbe tutti gli utenti come un unico IP (l'IP del proxy), condividendo lo stesso budget di 500 req/min. Impostalo a `true` se usi un proxy; ignora l'avviso se esponi il sito senza proxy.

> Checklist di pre-lancio (automatico, non bloccante): promemoria incorporati nello script invece che in un documento a parte — un file che nessuno riapre non serve a niente il giorno del deploy vero. Avvisa (senza fermarsi) se `project.name` è ancora il default `"App"`, e se `backend/data/identity.json` è ancora lo scheletro vuoto lasciato da `setup.mjs` → eject (footer, pagine legali e JSON-LD restano vuoti finché non lo compili — o è una scelta consapevole, in tal caso ignoralo). `deploy-release.sh` verifica `project.name` e basta: nel modello artifact-based non c'è sorgente sulla VPS, `identity.json` non è lì da controllare.

> Password SMTP fuori dal disco: `docker-compose.yml` dichiara un passthrough `Mail__Password` (convenzione .NET: `Mail:Password`). Esportandola nell'ambiente prima del deploy (`export Mail__Password='...'; ./scripts/deploy.sh`), il backend la legge con precedenza sul JSON montato e la password non finisce mai nel file su disco. Se la variabile non è impostata vale il valore (eventuale) di `Mail.Password` nel `.local`.

Il frontend gira su Node SSR: serve l'app Angular e proxya `/api/*` al backend sulla rete Docker interna, iniettando l'API key lato server.

Come funziona `scripts/deploy.sh`, in breve:
1. **Build + preflight isolato**: costruisce le nuove immagini (incluso `npm run lint`) e le avvia in una **copia usa-e-getta su porte effimere** (`FRONTEND_PORT=0`/`BACKEND_PORT=0`: niente collisioni con la produzione), attendendo che diventino **sane** tramite gli HEALTHCHECK dei Dockerfile (`--wait`). Se la build non compila **o** non parte sana, ci si ferma qui e il sito attuale **resta intatto**.
2. **Swap**: se il preflight è verde, e in nessun altro caso, `docker compose up -d --wait` sostituisce i container di produzione (immagini riusate dalla cache, ricontrollo salute sulle porte reali). È un blue/green leggero: zero-downtime se la nuova build parte male.
3. **Porte**: se una porta è occupata da un altro progetto, `scripts/deploy.sh` lo **segnala** soltanto e prosegue (è Docker a riportare l'eventuale errore di bind). Nessun container viene fermato automaticamente.

La suite di qualità (lint, i18n, type checking, dipendenze circolari, accessibilità WCAG, Lighthouse) non è rieseguita da `scripts/deploy.sh`: gira in CI (push al branch di default del repo e a `fix/**`, pull request). In locale, on-demand: `./scripts/test/run-all.sh`.

## Test pubblico dietro reverse proxy

Per riprodurre in locale la catena reale `browser -> reverse proxy -> frontend SSR -> backend` usa l'overlay dedicato:

```bash
docker compose -f docker-compose.yml -f docker-compose.public-test.yml up -d --build
```

URL di test predefinito:

- `http://localhost:8088`

Cosa simula:

- browser che parla con un hostname pubblico
- reverse proxy che inoltra `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` e `X-Forwarded-Port`
- frontend SSR che valida l'host autorizzato
- proxy `/api/*` del frontend verso il backend interno Docker

Smoke test utili:

```bash
curl -i http://localhost:8088/health
curl -i http://localhost:8088/
curl -i http://localhost:8088/api/health
```

Script pronto (alza lo stack dietro il proxy e lo lascia su):

```bash
bash scripts/test/public-test.sh
# poi, con lo stack ancora su:
bash scripts/test/live-test.sh http://localhost:8088
```

Per cambiare dominio/porta simulati senza toccare i file:

```bash
PUBLIC_TEST_PORT=9090 \
PUBLIC_TEST_BASE_URL=http://miosito.localhost:9090 \
PUBLIC_TEST_ALLOWED_HOSTS=miosito.localhost \
docker compose -f docker-compose.yml -f docker-compose.public-test.yml up -d --build
```

In alternativa, `public-test.sh` espone gli stessi parametri come flag (più comodo delle env var `PUBLIC_TEST_*`):

```bash
bash scripts/test/public-test.sh --public-host miosito.localhost --public-port 9090 --no-cache --down-after
```

- `--public-host` (default `localhost`) e `--public-port` (default `8088`) impostano host/porta simulati
- `--no-cache` ricostruisce le immagini da zero
- `--down-after` spegne lo stack al termine

Per verificare che il problema sia l'host check SSR, si prova intenzionalmente un host non autorizzato:

```bash
curl -i http://127.0.0.1:8088/avventura/poveri-maschi -H "Host: host-sbagliato.localhost"
```

In quel caso il frontend dovrebbe loggare il rifiuto dell'host e smettere di trattare la chiamata come pubblica e valida.

### Esporre il backend

Imposta `backend.public: true` (e `backend.publicPort`) in `global-settings.local.json`. `scripts/deploy.sh` ne deriva l'esposizione e applica l'overlay `docker-compose.backend-exposed.yml`.

Nota: la porta pubblicata riguarda la porta sull'host e nient'altro. Il container backend continua ad ascoltare internamente su `8080`: l'overlay `docker-compose.backend-exposed.yml` mappa `publicPort:8080`.

### Controlli all'avvio

`scripts/deploy.sh` verifica che `COMPOSE_PROJECT_NAME` e `FRONTEND_PORT` siano impostati prima di avviare Docker.
Lo script esegue anche un controllo intelligente sulle porte: legge le etichette (`com.docker.compose.project`) dei container Docker per capire se una porta occupata appartiene allo stesso progetto (che sta per essere aggiornato) o a un altro progetto, prevenendo conflitti incrociati.
Con `--no-cache` forza la ricostruzione delle immagini partendo da zero.

## Backup dei dati (`scripts/backup.sh`)

I dati che sopravvivono ai deploy vivono in due volumi Docker: `<progetto>_uploads-data` (file caricati) e `<progetto>_db-data`. Lo script `scripts/backup.sh` ne produce archivi `.tar.gz` datati con retention automatica.

> Consistenza: un `tar` a caldo del volume, non un dump. Lo script monta il volume read-only e lo comprime mentre i container restano in esecuzione, senza stop, senza flush. Per `uploads-data` va bene così: gli slug sono immutabili, un file caricato non viene mai riscritto (vedi backend/README.md § BlobStore). Per `db-data` (il database SQLite `app.db` con la proprietà dei file caricati, più le entità che il progetto aggiunge ad `AppDbContext`) un `tar` a caldo copia il file anche durante una scrittura: con le scritture rare del template (upload e cancellazioni) il rischio è basso, ma la copia non è transazionalmente garantita. Per una copia coerente serve lo strumento nativo del database (`sqlite3 app.db ".backup …"`, o `pg_dump` se il progetto passa a PostgreSQL) al posto del `tar` grezzo su quel volume.

```bash
./scripts/backup.sh                  # backup in ./backups, tiene i 14 archivi più recenti (per volume)
RETENTION=30 ./scripts/backup.sh     # cambia quanti archivi tenere (è un conteggio, non giorni)
BACKUP_DIR=/mnt/dati ./scripts/backup.sh
```

Pianificalo via cron (la cartella `backups/` è gitignorata):

```bash
0 3 * * * cd /percorso/progetto && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Ripristino di un volume da un archivio (sovrascrive i dati):

```bash
docker run --rm -v <progetto>_uploads-data:/data -v "$PWD/backups":/b alpine \
  sh -c 'rm -rf /data/* && tar xzf /b/uploads-data-AAAAmmGG-HHMMSS.tar.gz -C /data'
```

## Comandi utili

```bash
# Avvia (o riavvia) dopo un ./scripts/deploy.sh già fatto: il compose vuole il file effettivo
# (base + .local fusi) che lo script scrive; il solo global-settings.json non ha le chiavi.
BR1_SETTINGS_FILE=./.br1-settings.effective.json docker compose up -d

# Ferma i servizi
docker compose down

# Ferma e rimuovi anche i volumi
docker compose down -v

# Logs frontend
docker compose logs -f frontend

# Logs backend
docker compose logs -f backend

# Shell nel frontend
docker compose exec frontend sh

# Shell nel backend
docker compose exec backend sh
```

## Dev vs Prod

| | Dev (locale, no Docker) | Prod (Docker) |
|---|---|---|
| Frontend | `npm run start` (Angular dev server) | Node SSR su `FRONTEND_PORT` |
| Backend | `dotnet run` / Visual Studio | ASP.NET Core Production su `8080` (interno o esposto) |
| Avvio | due processi separati | `./scripts/deploy.sh` (build locale) — in prod meglio `./deploy-release.sh` da release ([RELEASE.md](RELEASE.md)) |

## Nota pratica

Lo sviluppo quotidiano si fa con Visual Studio (backend) e Angular CLI (frontend); Docker non è obbligatorio. Docker resta utile per:

- pubblicazione: `scripts/deploy.sh` (build locale) o, consigliato in prod, release artifact-based ([RELEASE.md](RELEASE.md))
- test della configurazione container
- ambienti simili alla produzione (`scripts/test/public-test.sh`)
