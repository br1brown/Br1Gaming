# Br1WebEngine - Docker Setup

Guida operativa per eseguire Br1WebEngine con Docker. Per architettura completa, DSL frontend e personalizzazione del progetto, vedi anche [README.md](README.md).

## Modello di utilizzo

Il template Docker e' progettato per essere **riusabile su piu' progetti sulla stessa VPS**. Ogni progetto derivato dal template viene eseguito in una propria cartella con un proprio `global-settings.json` e una propria porta.

### Inizializzazione (una sola volta dopo la clonazione)

La configurazione è divisa in tre file per **proprietario** (tutti validati da `global-settings.schema.json` per l'autocomplete):

- **`global-settings.json`** — del **progetto**, committabile: identità e aspetto (`project`, `Localization`, `site`, `Custom`).
- **`global-settings.local.json`** — **gitignored**: pubblicazione e segreti del singolo ambiente (`frontend`, `backend`, `Security`).
- **`security-headers.json`** — del **template**, non si tocca: header di sicurezza fissi.

`deploy.sh` fonde i primi due e monta il risultato; backend e Node SSR lo leggono. La scorciatoia `node setup.mjs "Nome Progetto"` imposta il nome nel file di progetto e crea il `.local` coi segreti generati.

### Avvio di un progetto derivato

```bash
# Edita global-settings.json, poi:
./deploy.sh
```

`deploy.sh` legge `global-settings.json`, verifica la configurazione e avvia i container. Il file viene montato in entrambi i container in sola lettura (`/app/global-settings.json:ro`): cambiare il file e rieseguire il deploy è sufficiente per applicare la configurazione a tutti i livelli.

### Esposizione dei servizi

- Ogni progetto espone il frontend su una porta host dedicata (`frontend.port`, es. `http://IP:3000`, `http://IP:3001`)
- Il backend puo' essere esposto impostando `backend.public: true` (richiede `docker-compose.backend-exposed.yml`)
- Frontend e backend comunicano sempre tramite rete Docker interna

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

- **`docker-compose.yml`** — base: servizi, build, rete, volumi. Usato in produzione.
- **`docker-compose.backend-exposed.yml`** — opzionale: espone il backend verso l'host su `BACKEND_PORT` (quando `backend.public: true`)
- **`docker-compose.public-test.yml`** — overlay per simulare un reverse proxy pubblico davanti al frontend SSR (usato dai test a11y/Lighthouse via `scripts/test/public-test.sh`)

> Lo sviluppo locale non passa da Docker: si usa lo script del frontend (Angular dev server) + Visual Studio per il backend.

## Configurazione

Due file da modificare (il terzo, `security-headers.json`, è del template). Le chiavi e i vincoli
sono documentati in `global-settings.schema.json`, quindi l'editor offre autocomplete e validazione.

> **Scorciatoia:** `node setup.mjs "Nome Progetto"` imposta il nome nel file di progetto e crea
> `global-settings.local.json` coi **segreti già generati** (SecretKey JWT + API key).
> A mano: `cp global-settings.local.example.json global-settings.local.json` poi
> `openssl rand -base64 48` (SecretKey) e `openssl rand -base64 32` (ApiKey).

Al deploy, `deploy.sh` **fonde** `global-settings.local.json` sopra `global-settings.json` (merge
profondo; gli array come `ApiKeys`/`SupportedLanguages` vengono sostituiti), genera
`.br1-settings.effective.json` (gitignorato) e monta **quello** nei container. La sezione `site`
(identità/aspetto, senza segreti) viene inoltre passata al build del frontend come ARG
`BR1_PROJECT_JSON` e iniettata in `environment.ts`.

### `global-settings.json` — progetto (committabile)

| Chiave | Default | Descrizione |
|---|---|---|
| `project.name` | `App` | Nome dell'app; mostrato in UI/manifest e slugificato in `COMPOSE_PROJECT_NAME` |
| `project.version` | `1.0.0` | Versione dell'app: meta `app-version`, manifest, rilevamento aggiornamenti |
| `project.lastModified` | data del build | Ultima modifica contenuti (`GG/MM/AAAA`): `<lastmod>` sitemap + `og:updated_time`. Bumpala a mano |
| `Localization.DefaultLanguage` | `it` | Lingua di default (tag BCP-47) |
| `Localization.SupportedLanguages` | `["it","en"]` | Lingue supportate |
| `site.description` | — | Descrizione per-lingua `{ it, en, … }` (SEO, footer, social); build usa la lingua default, SSR localizza |
| `site.colorTema` | — | Colore tema (hex): palette OKLCH + tono testo |
| `site.smoke` | — | Effetto particellare di sfondo (ometti/`enable:false` per disattivarlo) |
| `Custom` | `{}` | Valori liberi leggibili da backend (`IConfiguration["Custom:..."]`) e Node SSR (`getBr1Settings().Custom`) |

> I flag di **comportamento** (`showNav`, `showFooter`, `fixedTopHeader`, `showBrandIconInHeader`, `showLoginInHeader`, `forcedLightPanel`, `isWebApp`, `onlyPlainImage`) non stanno in `global-settings.json`: sono struttura e vivono in `frontend/src/app/site.ts` (`shell` / `isWebApp` / `onlyPlainImage`).

### `global-settings.local.json` — pubblicazione + segreti (gitignored)

| Chiave | Default | Descrizione |
|---|---|---|
| `frontend.hostname` | `""` | Dominio pubblico senza schema. Deriva `FRONTEND_BASE_URL` e `NG_ALLOWED_HOSTS` |
| `frontend.port` | `3000` | Porta host del frontend |
| `backend.public` | `false` | `true` espone il backend sull'host (richiede `docker-compose.backend-exposed.yml`) |
| `backend.publicPort` | `null` | Porta host del backend, solo se `public: true` |
| `Security.ApiKeys` | — | Chiavi API del backend (header `X-Api-Key`); il frontend usa `[0]`. In prod ≥32 char |
| `Security.CorsOrigins` | `[]` | Origini CORS ammesse |
| `Security.BehindProxy` | `false` | `true` quando si è dietro un reverse proxy (legge `X-Forwarded-For`) |
| `Security.Token.SecretKey` | `""` | Segreto JWT (≥32 char): se valorizzato attiva il login. Vuoto = login disabilitato |
| `Security.Token.ExpirationSeconds` | `3000` | Durata dei JWT emessi |

> **Header di sicurezza in `security-headers.json`.** Gli header fissi rivolti al browser
> (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy, CSP) sono
> uguali per ogni progetto: vivono in `security-headers.json` (file del template, montato in
> entrambi i container e letto da backend e Node SSR). **Non è roba del progetto figlio**, che
> non deve scriverla né rischiare di cancellarla; si aggiorna col `git pull`. In `global-settings`
> resta solo la sicurezza *del progetto*: `ApiKeys`, `CorsOrigins`, `BehindProxy`, `Token`.

`BACKEND_ORIGIN` (`http://backend:8080`) resta una variabile d'ambiente del compose: è l'indirizzo Docker-interno del backend, non una scelta di configurazione utente.

## Sviluppo locale

Lo sviluppo non passa da Docker. Si avviano i due progetti separatamente:

```bash
# Backend (.NET 9)
cd backend && dotnet run        # oppure Visual Studio

# Frontend (Angular 21)
cd frontend && npm install && npm run start
```

Il frontend si connette al backend tramite proxy. Docker resta per la pubblicazione e per i test simili alla produzione.

## Pubblicazione (`deploy.sh`)

```bash
# Configurare global-settings.local.json con i valori del progetto, poi:
./deploy.sh                # pubblica frontend + backend
./deploy.sh --frontend     # solo il frontend
./deploy.sh --backend      # solo il backend
```

In produzione:

- **Frontend** su `http://localhost:FRONTEND_PORT`
- **Backend** privato per default (per esporlo: `backend.public: true` in `global-settings.json`)

Frontend e backend sono **disaccoppiati**: puoi pubblicarli insieme o uno alla volta (anche su VPS diverse). Il backend è privato o pubblico secondo `backend.public`.

> **Guard segreti (automatico):** al deploy `deploy.sh` verifica che non siano rimasti i segreti segnaposto/deboli di default. Se `Security.Token.SecretKey` è ancora la chiave di sviluppo o è < 32 caratteri, o se `Security.ApiKeys` contiene `frontend` / chiavi < 32 caratteri, il deploy si ferma con un messaggio esplicito (e il comando `openssl` per generarne uno sicuro). I segreti si generano con `openssl rand -base64 48` (JWT) e `openssl rand -base64 32` (API key).

Il frontend gira su Node SSR: serve l'app Angular e proxya `/api/*` al backend sulla rete Docker interna, iniettando l'API key lato server.

Come funziona `deploy.sh`, in breve:
1. **Build + preflight isolato**: costruisce le nuove immagini (incluso `npm run lint`) e le avvia in una **copia usa-e-getta su porte effimere** (`FRONTEND_PORT=0`/`BACKEND_PORT=0`: niente collisioni con la produzione), attendendo che diventino **sane** tramite gli HEALTHCHECK dei Dockerfile (`--wait`). Se la build non compila **o** non parte sana, ci si ferma qui e il sito attuale **resta intatto**.
2. **Swap**: solo se il preflight è verde, `docker compose up -d --wait` sostituisce i container di produzione (immagini riusate dalla cache, ricontrollo salute sulle porte reali). È un blue/green leggero: zero-downtime se la nuova build parte male.
3. **Porte**: se una porta è occupata da un altro progetto, `deploy.sh` lo **segnala** soltanto e prosegue (è Docker a riportare l'eventuale errore di bind). Nessun container viene fermato automaticamente.

La suite di qualità (lint, i18n, type checking, dipendenze circolari, accessibilità WCAG, Lighthouse) **non** è rieseguita da `deploy.sh`: gira in CI a ogni push/PR e nel git hook pre-push. In locale: `./scripts/test/run-all.sh`.

## Test pubblico dietro reverse proxy

Per riprodurre in locale la catena reale `browser -> reverse proxy -> frontend SSR -> backend` usa l'overlay dedicato:

```bash
docker compose -f docker-compose.yml -f docker-compose.public-test.yml up -d --build
```

URL di test predefinito:

- `http://localhost:8088`

Cosa simula davvero:

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

Script pronto (alza lo stack dietro il proxy e ci fa girare a11y/Lighthouse):

```bash
bash scripts/test/public-test.sh --down-after
```

Per cambiare dominio/porta simulati senza toccare i file:

```bash
PUBLIC_TEST_PORT=9090 \
PUBLIC_TEST_BASE_URL=http://miosito.localhost:9090 \
PUBLIC_TEST_ALLOWED_HOSTS=miosito.localhost \
docker compose -f docker-compose.yml -f docker-compose.public-test.yml up -d --build
```

Per verificare che il problema sia davvero l'host check SSR, si prova intenzionalmente un host non autorizzato:

```bash
curl -i http://127.0.0.1:8088/avventura/poveri-maschi -H "Host: host-sbagliato.localhost"
```

In quel caso il frontend dovrebbe loggare il rifiuto dell'host e smettere di comportarsi come se fosse una richiesta pubblica valida.

### Esporre il backend

Imposta `backend.public: true` (e `backend.publicPort`) in `global-settings.json`. `deploy.sh` ne deriva l'esposizione e applica l'overlay `docker-compose.backend-exposed.yml`.

Nota: la porta pubblicata controlla solo la porta sull'host. Il container backend continua ad ascoltare internamente su `8080`, quindi l'overlay `docker-compose.backend-exposed.yml` mappa `publicPort:8080`.

### Controlli all'avvio

`deploy.sh` verifica che `COMPOSE_PROJECT_NAME` e `FRONTEND_PORT` siano impostati prima di avviare Docker.
Lo script esegue anche un controllo intelligente sulle porte: legge le etichette (`com.docker.compose.project`) dei container Docker per capire se una porta occupata appartiene allo stesso progetto (che sta per essere aggiornato) o a un altro progetto, prevenendo conflitti incrociati.
Con `--no-cache` forza la ricostruzione delle immagini partendo da zero.

## Backup dei dati (`backup.sh`)

I dati che sopravvivono ai deploy vivono in due volumi Docker: `<progetto>_uploads-data` (file caricati) e `<progetto>_db-data`. Lo script `backup.sh` ne crea archivi `.tar.gz` datati con retention automatica.

```bash
./backup.sh                  # backup in ./backups, tiene gli ultimi 14
RETENTION=30 ./backup.sh     # cambia la retention
BACKUP_DIR=/mnt/dati ./backup.sh
```

Pianificalo via cron (la cartella `backups/` è gitignorata):

```bash
0 3 * * * cd /percorso/progetto && ./backup.sh >> backups/backup.log 2>&1
```

Ripristino di un volume da un archivio (**sovrascrive i dati**):

```bash
docker run --rm -v <progetto>_uploads-data:/data -v "$PWD/backups":/b alpine \
  sh -c 'rm -rf /data/* && tar xzf /b/uploads-data-AAAAmmGG-HHMMSS.tar.gz -C /data'
```

## Comandi utili

```bash
# Avvia in background
docker compose up --build -d

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
| Avvio | due processi separati | `./deploy.sh` |

## Nota pratica

Lo sviluppo quotidiano si fa con Visual Studio (backend) e Angular CLI (frontend); Docker non è obbligatorio. Docker resta utile per:

- pubblicazione (`deploy.sh`)
- test della configurazione container
- ambienti simili alla produzione (`scripts/test/public-test.sh`)
