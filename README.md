# 🚀 Br1WebEngine

<div align="center">
  <strong>Il template applicativo definitivo. Pragmatismo sulla purezza, velocità sul boilerplate.</strong>
</div>

<br/>

Br1WebEngine non è un semplice template: è un **patto contro il boilerplate**. Nasce per azzerare le settimane tipicamente spese per configurare routing, SEO, SSR, CORS, Rate Limiting, JWT e Gestione Errori all'inizio di un nuovo progetto.

**Stack:** Angular 21 (standalone, **zoneless**) · ASP.NET Core (.NET 9) · Node 24 SSR · Docker. Tutto orchestrato da un unico file di configurazione.

---

## 📚 Mappa della documentazione

Per orientarsi nel progetto: ogni documento ha uno scopo preciso.

| Documento | A cosa serve |
| :--- | :--- |
| **README.md** (questo) | Panoramica, architettura, **dove mettere le mani**, avvio rapido e la **vetrina della demo**: gli esempi del template vivono qui. |
| [frontend/README.md](frontend/README.md) | **Direttive di implementazione** del frontend per i progetti figli: DSL `site.ts`, SSR, servizi (API, tema, i18n, cookie, share, QR…), directive Angular, SEO. |
| [backend/README.md](backend/README.md) | **Direttive di implementazione** del backend per i progetti figli: Engine di sicurezza, eccezioni→`ProblemDetails`, `FileContentStore`, login JWT. |
| [DOCKER_README.md](DOCKER_README.md) | Setup Docker, configurazione `global-settings(.local).json`, pubblicazione, backup dei volumi. |
| [CHANGELOG.md](CHANGELOG.md) | Cosa cambia nel template tra una versione e l'altra. |

---

## 🧭 La Filosofia: Pragmatismo > Purezza

L'industria è spesso ossessionata dall'esasperazione architetturale (Clean Architecture forzate, CQRS o Redux ovunque). Questo Engine prende una posizione netta: il codice è progettato per essere **robusto come un prodotto Enterprise, ma agile come uno script**.

| Quello che si evita ❌ | Quello che si ottiene con Br1WebEngine ✅ |
| :--- | :--- |
| Configurare N file per il routing e la SEO | Un singolo file DSL (`site.ts`) gestisce rotte, menu e meta-tag. |
| Dimenticare la sicurezza sugli endpoint | Tutti gli endpoint ereditano Rate Limiter e CORS in automatico. |
| Configurare DB relazionali per testare | `FileContentStore` usa JSON in RAM con localizzazione integrata. |
| Leak di stack trace in produzione | Middleware globale per errori `RFC 9457` Problem Details. |
| Redux boilerplate per il frontend | Uso nativo di `Signals` e `withFetch` di Angular 21 (zoneless). |

---

## 🏗️ Architettura del Sistema

I due progetti (Frontend e Backend) sono totalmente disaccoppiati, ma condividono la stessa filosofia: **Nascondere la noia nell'Engine, esporre solo il Dominio**.

```text
┌──────────────────────────────────────────────────────┐
│  Frontend — Node SSR (Angular 21 + Express)          │
│  porta 3000                                          │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Angular SSR  │  │/api/* proxy│  │/cdn-cgi/*    │  │
│  │  (pagine)    │  │ → backend  │  │ Sharp+OGimage│  │
│  └──────────────┘  └────────────┘  └──────────────┘  │
└───────────────────────────┬──────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────┐
│  Backend (ASP.NET Core 9)                    │
│  porta 8080                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Base API │ │ Auth API │ │ Protected API│  │
│  │(api key) │ │(transito)│ │  (riservato) │  │
│  └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────────────────────────────────────┐│
│  │ Security: API Key + JWT + CORS + Rate    ││
│  │ Limiting + Security Headers              ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### Struttura delle cartelle

```text
backend/                Web API ASP.NET Core (.NET 9)
├── Engine/             ⚙️  Engine: sicurezza, errori, base controller, JWT — INTOCCABILE
├── Controllers/        thin controller: niente logica, delega ai Services
├── Services/           logica di business
├── Store/              IContentStore e implementazioni: il confine verso la persistenza
├── data/               "database" JSON localizzato (letto dal FileContentStore)
├── db/                 mount point del volume db-data (riservato al DB futuro)
└── uploads/            file caricati via BlobController (volume uploads-data)

frontend/src/app/       Angular 21 (standalone, zoneless)
├── core/engine/        ⚙️  Engine: DSL, SSR, servizi infrastrutturali — INTOCCABILE
├── site.ts             il DSL strutturale: pagine, rotte, menu, SEO per-pagina
├── pages/              schermate intere (estendono PageBaseComponent)
└── components/         UI riusabile ("stupida": riceve input(), emette output())
```

**Le due regole d'oro.** Nel backend si eredita sempre dalle basi `Engine*` invece che da `ControllerBase` di ASP.NET: forniscono gratis API key, rate limiter, CORS e `ProblemDetails`. Nel frontend si lavora con binding dichiarativi e signal, lasciando intatta l'idratazione SSR. Tutto ciò che è marcato **INTOCCABILE** è l'Engine: nei figli si aggiorna da solo col merge dal template (vedi sotto).

### 🔄 Template vivo: nascita e aggiornamento dei progetti figli

Il confine **Engine (intoccabile) / Dominio (del progetto)** non è solo stile: è ciò che permette ai
progetti derivati di **ricevere gli aggiornamenti dell'infrastruttura via git**, toccando solo il
proprio dominio. La regola pratica: non si modifica l'Engine; i comportamenti si cambiano per
**configurazione** (`global-settings.local.json`, `site.ts`, sezione `Custom`) o per **estensione**
(sottoclassi dei controller `Engine*`, nuovi servizi).

**Nascita.** Un figlio è un **vero discendente git** del template: si clona questo repository, si
punta `origin` al repo del nuovo progetto e si tiene il template come secondo remote
(`git remote add template <url-del-template>`); poi `node setup.mjs "Nome Progetto"` battezza il
progetto. La storia git è ciò che tiene il figlio collegato al template e gli porta gli aggiornamenti: conservala fin dalla clonazione.

**Aggiornamento.** Non è il `git pull` del figlio (quello parla con `origin`): è un merge dal
template — `git fetch template && git merge template/main`. Regola d'oro sui conflitti: sui path
dell'**Engine e dello scaffold vince sempre il template** (`git checkout template/main -- <path>`),
sul **dominio vince il figlio**. Sui path engine prendi sempre la versione del template anche quando la tua compilerebbe: così git registra l'aggiornamento come davvero integrato e i merge futuri continuano a portare le novità.

**Il confine in pratica — chi possiede cosa.** "Engine e scaffold" nei conflitti significa:

| Proprietà | Path | Al merge |
| :--- | :--- | :--- |
| **Engine** | `backend/Engine/`, `frontend/src/app/core/engine/`, `frontend/src/styles/engine/`, `frontend/src/assets/i18n/basic.*.json` | vince il template |
| **Scaffold** (infrastruttura e documentazione del template fuori dall'Engine) | `scripts/`, `deploy.sh`, `backup.sh`, `docker-compose*.yml`, `.github/workflows/`, `.nvmrc`, `global.json`, `setup.mjs`, `global-settings.schema.json`, `security-headers.json`*, `CHANGELOG.md`, `DOCKER_README.md`, `backend/README.md`, `frontend/README.md`, `backend/backend.csproj`, i due `Dockerfile`, `frontend/proxy*.cjs`, `frontend/tsconfig.json`, `frontend/eslint.config.mjs`, `main.ts`/`main.server.ts`, `app.config.ts`/`app.config.server.ts` | vince il template |
| **Condivisi con punti di contatto** (il template li evolve; il figlio tocca solo i punti indicati) | `backend/Program.cs` (solo il blocco "SERVIZI APPLICATIVI"), `frontend/angular.json` (assets/styles del progetto, budget, `allowedCommonJsDependencies`), `frontend/package.json` (dipendenze del progetto), `backend/Resources/*.resx` (chiavi aggiunte), `.gitignore`/`.dockerignore` (righe aggiunte) | si fondono riga per riga |
| **Dominio** (la demo riusata + il codice del progetto) | `backend/Controllers|Services|Models|Store|Validation|data`, `site.ts`, `pages/`, `components/`, `core/services` e `core/dto`, `assets/` (i18n `addon`, legal, files), `styles.scss` + `styles/app/` (gli stili del progetto, non `styles/engine/`), `public/`, `global-settings.json`, la `.sln` rinominata | vince il figlio |

\* `security-headers.json`: unica eccezione, l'override documentato nella `_nota` (vedi sopra).

**Documenti.** Nel figlio si elimina solo **questo README** (è la vetrina del template, non del
prodotto). Il resto della documentazione **resta e si aggiorna dal template** — al merge vince il
template, come per l'Engine: il `CHANGELOG.md` dice al figlio cosa è cambiato nel template tra una
versione e l'altra; `backend/README.md`, `frontend/README.md` e `DOCKER_README.md` sono le
direttive di sviluppo — dicono cosa si modifica e quali strumenti si hanno a disposizione. Non si
adattano nel figlio: la documentazione del prodotto, se serve, è un file suo.

### 🧭 Dove mettere le mani

Regola generale: il **Dominio** si modifica; l'**Engine** (`backend/Engine/`, `frontend/src/app/core/engine/`) resta com'è e si aggiorna da solo col merge dal template (vedi *Template vivo*). Modificare il Dominio vuol dire riusarne i file demo: si svuotano e si riempiono col proprio contenuto, mantenendo nomi e posti.

**Pagine, rotte e navigazione.** Tutto il frontend parte da un unico file, `frontend/src/app/site.ts`: lì dichiari le pagine e l'Engine genera da sé rotte, voci di menu, sitemap e meta-tag SEO. Nello stesso file imposti anche la pagina di login, le pagine legali (privacy, cookie, termini) e l'aspetto della shell (navbar, footer). L'identità e l'estetica del sito (nome, versione, lingue, descrizione, **colore del tema**, effetto smoke) non stanno qui: vivono in `global-settings.json` e vengono iniettate al build. Il componente di una pagina sta in `frontend/src/app/pages/<nome>/` (estende `PageBaseComponent`); i pezzi di UI riusabili in `frontend/src/app/components/`. Il dettaglio di ogni opzione è in [frontend/README.md](frontend/README.md).

**Contenuti e testi.** I testi legali (privacy, cookie, termini) sono Markdown in `frontend/src/assets/legal/`; le traduzioni del progetto in `frontend/src/assets/i18n/addon.*.json`; i dati del profilo aziendale e simili in `backend/data/*.json`.

**Backend: API e logica.** Un nuovo endpoint è un controller in `backend/Controllers/` che eredita `EngineApiController` (pubblico) o `EngineProtectedController` (richiede login); la logica di business va nei `backend/Services/`. Per un nuovo tipo di errore: una sottoclasse di `ApiException` più la chiave nei `Resources/*.resx`. Per cambiare lo storage: una nuova implementazione di `IContentStore`.

**Configurazione e segreti — tre file, per proprietario.**
- `global-settings.json` (**committabile, del progetto**): identità ed estetica del sito — nome e versione, lingue, descrizione, colore del tema, effetto smoke. Include la sezione `Custom` per valori liberi di progetto (feature flag, ID analytics…), leggibili da backend, SSR e frontend.
- `global-settings.local.json` (**gitignored**): pubblicazione e segreti del singolo ambiente — hostname e porte, chiavi API, origini CORS, chiave di firma JWT.
- `security-headers.json` (**del template, non toccare**): header di sicurezza fissi. "Non toccare" vale per il concetto, non in assoluto: se il progetto richiede un'estensione (es. domini extra in CSP per un servizio di mappe), l'override eccezionale si fa modificando il file e annotandolo nella `_nota` interna — e a ogni aggiornamento dal template l'override va rifatto a mano.

**Login e sessione.** La forma del payload di sessione si cambia in due posti speculari: `backend/Models/SessionInfo.cs` e `frontend/src/app/core/dto/session.dto.ts`. I cookie si registrano in `frontend/src/app/core/services/cookie-registry.ts`.

> Questo è solo l'**indice** (*dove* andare). Il **come** passo-passo vive nelle sezioni **"Developer Journey"** di [frontend/README.md](frontend/README.md) e [backend/README.md](backend/README.md): front-end e back-end sono disaccoppiati, ognuno si documenta da sé.

### Route SSR speciali del Frontend

Il Node SSR del frontend gestisce oltre alle pagine Angular anche alcune route infrastrutturali:

| Route | Cosa fa |
| :--- | :--- |
| `/api/*` | Reverse proxy verso il backend (inietta l'API key lato server) |
| `/cdn-cgi/asset` | Image processing con Sharp: resize, conversione formato, cache su disco |
| `/cdn-cgi/preview` | Generazione og:image dinamica (preview OpenGraph cifrata, AES-GCM) |
| `/api/blob/:slug` | Serve (via proxy `/api`) i file caricati dall'applicazione dal volume `/app/uploads` del backend |
| `/assets/legal/*` | Serve i Markdown legali (privacy, cookie, termini) con guard anti path-traversal |
| `/assets/files/*` | **Bloccata** (404): i file sorgente degli asset si servono solo via `/cdn-cgi/asset` |
| `/.well-known/security.txt` | Contatto di sicurezza RFC 9116 (generato al build da `generate-statics.ts`) |

> Il Node SSR applica anche, in automatico, **compressione gzip** su tutte le risposte testuali e un **graceful shutdown** su SIGTERM/SIGINT (drena le connessioni prima di uscire). I file statici SEO (`sitemap.xml`, `robots.txt`, `llms.txt`, `security.txt`) sono generati al build.

---

## 💡 Cosa ottieni di fabbrica

Senza scrivere codice infrastrutturale, il template fornisce già:

- **SEO e social**: tag OpenGraph e JSON-LD per pagina, SSR granulare guidato da `site.ts`, più `sitemap.xml`, `robots.txt` e anteprime `og:image` dinamiche.
- **Sicurezza by-design**: protezione attiva contro Stored XSS (file isolati e markdown sanificato), rate limiting, CORS, API key, header di sicurezza (incluso HSTS subdomains); prevenzione Host Header Injection e script di deploy fail-fast sui segreti. Errori API standardizzati in `ProblemDetails` (RFC 9457) senza leak di stack trace.
- **Pronto all'uso**: routing, navigazione, i18n, PWA, consenso cookie e pagine legali già funzionanti — si parte direttamente dalla logica di dominio.
- **Menu Multilivello**: supporto nativo a navigazione ricorsiva sia nella Navbar (con flyout desktop che evita di uscire dallo schermo e accordion su mobile) sia nel Footer. Basta annidare i gruppi in `site.ts`.
- **Notifiche realtime**: canale server→client via SSE (`INotificationStream` / `NotificationStreamService`) per spingere notifiche ai client connessi — targeting per broadcast/connessione/gruppo, indipendente dal login, payload non solo testuale. Dettagli in [backend](backend/README.md) e [frontend](frontend/README.md).
- **Task in background e delivery**: coda generica in-memory (`IBackgroundTaskQueue` + hosted service, scope DI per task) per il pattern "POST risponde subito `202` → lavoro lungo → notifica a fine task", con un `IDeliveryService` che di **default consegna solo realtime** (niente email a sorpresa se l'utente è offline) e, su richiesta con `Auto`, aggiunge il **fallback email** quando il destinatario non è connesso.

---

## 🎬 La demo del template (la vetrina)

Tutto ciò che il template mostra "di fabbrica" è **demo**: esiste per far vedere il giro completo (UI → servizi → API → store) e il progetto figlio la **riusa, non la cancella** — tiene la struttura (file, servizi, endpoint) e ne cambia il contenuto. La regola di lettura è semplice: ciò che non va modificato sta nell'Engine; tutto il resto sta nel template proprio perché il figlio lo faccia suo. Il catalogo degli esempi vive qui, non nei README di progetto: quelli sono direttive di implementazione e documentano solo ciò che i figli ereditano e usano.

> **Riusare o partire puliti — lo decidi al `setup`.** La cerimonia di init (`node setup.mjs "Nome"`) chiede `[s/N]`:
> - **`N` → riusi la demo** (la via descritta qui sopra): tieni struttura, file, servizi ed endpoint e ne cambi il contenuto. La demo resta un esempio vivo finché vuoi.
> - **`s` → parti pulito** (*eject*): il setup rimuove la demo (pagina Social, home svuotata, `addon` azzerati, controller backend ridotti al solo profilo), elimina **questa vetrina** e fa un commit `init <Nome>`. Resta lo scheletro Home + pagine legali, login spento, pronto a crescere.
>
> In entrambi i casi l'**Engine resta intatto**: cambia solo *da dove* parte il tuo dominio — demo riusabile o foglio bianco. La demo non è un peso da subire: è il banco di prova del template (esercita ogni feature) e, finché la tieni, il tuo esempio di riferimento.

### La home (`frontend/src/app/pages/home/`)

Una pagina-vetrina che esercita i componenti e i servizi dell'Engine, sezione per sezione:

| Sezione | Cosa fa vedere |
| :--- | :--- |
| **Azioni** | Componenti autonomi di azione (copia, condivisione, sintesi vocale, download, stampa, PDF) e di contatto (mail, telefono, WhatsApp, Telegram, social) |
| **Generatori** | Anteprima Markdown live (pipe `markdown`) e generazione immagini da testo (`[appImgRender]`) con menu contestuale custom (`[appContextMenu]`) |
| **QR Code** | QR multi-formato: testo, WhatsApp, email, Wi-Fi, bonifico SEPA (`[appQrContent]`) |
| **Notifiche** | Modali alert / conferma / form di `NotificationService` |
| **Sistema** | Palette tema OKLCH a runtime, i18n, chiamata API con filtro (`GET /social`), asset resolver con resize server-side |

Due dettagli da non perdere:
- **La demo si auto-documenta:** entrando col login demo (`admin` / `Password1!`) ogni sezione mostra accanto lo snippet di codice che la implementa.
- **Idratazione incrementale dal vivo:** le sezioni sotto la piega (QR, Notifiche, Sistema) sono blocchi `@defer (hydrate on viewport)` — il pattern documentato in [frontend/README.md](frontend/README.md), qui in funzione.

### I controller demo (`backend/Controllers/`)

| Controller | Endpoint | Cosa fa vedere |
| :--- | :--- | :--- |
| `BaseController` | `GET /profile`, `GET /social[?nomi=...]`, `POST /notifications/demo/ping[?message=...]`, `POST /tasks/demo/import[?email=...]` | Lettura dal "DB" JSON localizzato (`FileContentStore`), un filtro di dominio d'esempio (se il client ha lo stream aperto — header `X-Connection-Id`, aggiunto in automatico dal frontend — consegna anche una notifica realtime via `IDeliveryService`, canale di default), il ping del canale realtime e la demo del pattern task-lungo → notifica/email (si tiene: cambia solo il contenuto dei JSON) |
| `AuthController` | `POST /auth/login` | Login demo a credenziali fisse → emissione JWT con payload di sessione |
| `ProtectedController` | `GET /ping` | Endpoint riservato: API key + JWT obbligatori |
| `BlobController` | `GET /blob/{slug}`, `POST /blob/up` | Upload/download di file sul volume persistente (è anche uno strumento di fabbrica: il contratto sta in [backend/README.md](backend/README.md)) |

Sono segnaposto anche i **dati demo** (`backend/data/irl.json`, `social.json`), i testi legali di esempio (`frontend/src/assets/legal/`) e le credenziali del login: i file restano dove sono e con lo stesso nome, il figlio ci scrive dentro i **propri** dati. Lo stesso vale per i pezzi facoltativi: quelli che il sito non espone si lasciano **non valorizzati** e l'Engine fa il resto — per esempio, senza social il `SiteService` lascia vuoto `profile.Social` e il footer di default nasconde da sé la sezione. Il blocco profilo del footer è la **parte legale** del sito e nei figli resta di default: se ne adatta l'estetica e si tolgono i pezzi facoltativi (i social), non le informazioni legali.

---

## 🧪 Test Suite Automatica

Il template include questi controlli di qualità, eseguiti automaticamente dalla CI (GitHub Actions) a ogni push e pull request:

| Controllo | Cosa verifica |
| :--- | :--- |
| `lint-check.sh` | Qualità del codice Angular (ESLint) |
| `i18n-check.sh` | Chiavi di traduzione mancanti o non usate |
| `tsc-check.sh` | Errori TypeScript (type safety) |
| `circular-deps-check.sh` | Dipendenze circolari tra moduli |
| `a11y-test.sh` | Conformità WCAG (accessibilità) |
| `lighthouse-test.sh` | Performance budget (Core Web Vitals) |

> Sono i controlli di **norma e qualità** che un progetto figlio deve rispettare (accessibilità, performance, traduzioni complete, niente dipendenze circolari, tipi corretti). I test unitari restano un'attività privata di ogni progetto: il template eredita ai figli solo questi controlli di norma e qualità.

Dove e come girano:
- **In CI:** automaticamente a ogni push e pull request (`.github/workflows/`). È il gate ufficiale.
- **On-demand, in locale:** `./scripts/test/run-all.sh` dalla root del progetto (i test live a11y/Lighthouse girano solo se è attivo un server da testare).

> **Nota sul deploy:** la rete di sicurezza di `deploy.sh` è semplice e mirata: il lint Angular gira dentro la build Docker (un errore blocca subito la build) e la pubblicazione (`docker compose up -d --wait`) avviene solo se i container diventano sani (HEALTHCHECK). La suite completa resta demandata alla CI. Vedi [DOCKER_README.md](DOCKER_README.md).

### Supply chain

Oltre alla qualità del codice, la CI sorveglia anche:
- **Pacchetti vulnerabili:** `npm audit` (frontend) e `dotnet list package --vulnerable` (backend) a ogni push/PR.
- **Segreti committati per sbaglio:** scansione **gitleaks** (rinforza l'architettura "segreti fuori da git").

---

## 🚀 Quick Start

Per i riferimenti completi si veda la **Mappa della documentazione** in cima a questo file. In breve: [frontend/README.md](frontend/README.md) e [backend/README.md](backend/README.md) per i due progetti, [DOCKER_README.md](DOCKER_README.md) per deploy e configurazione.

### Primo setup di un progetto figlio

```bash
node setup.mjs "Nome Progetto"
```
*Battezza il progetto: imposta `project.name` in `global-settings.json`, crea `global-settings.local.json` con porte e **API key generata**, rinomina gli identificatori npm/Service Worker e `App.sln`. La `SecretKey` JWT resta **vuota**: un figlio nasce col **login spento** e attivarlo è una scelta esplicita (chiave ≥32 char + verifica propria in `AuthController`). Dettagli in [DOCKER_README.md](DOCKER_README.md).*

Poi `setup.mjs` chiede conferma `[s/N]` per la **cerimonia "da template a progetto"** (distruttiva): rimuove la demo (pagina Social, home svuotata a placeholder, `addon.*.json` → `{}`, `BaseController`/`SiteService` minimi e `site.ts` riscritto allo scheletro Home + pagine legali, con **login spento di default** — coerente con `SecretKey` vuota — da riattivare quando imposti il segreto), elimina **questo README** (la vetrina del template), esegue i controlli statici (lint/tsc/i18n/cicli) come gate, **auto-cancella `setup.mjs`** e crea un commit locale `init <Nome>`. Rispondendo `N` resti sul template completo (demo inclusa) e puoi rilanciarlo quando sei pronto.

La versione Node di riferimento è dichiarata in `.nvmrc` (Node 24 LTS): con nvm basta `nvm install && nvm use`; la CI legge lo stesso file.

### Avvio Veloce in Locale

**Avvio Backend (.NET 9):**
```bash
cd backend
dotnet run
```
*Espone di default `/health`.*

**Avvio Frontend (Angular 21):**
```bash
cd frontend
npm install
npm run start
```
*Si connette automaticamente al backend sulla porta di default tramite proxy. In alternativa `./start-frontend-dev.sh` dalla root fa `npm install` + avvio in un colpo solo (con `BACKEND_ORIGIN` già impostato per l'SSR locale).*
