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
├── data/               "database" JSON localizzato (letto dal FileContentStore)
├── db/                 mount point del volume db-data (riservato al DB futuro)
└── uploads/            file caricati via BlobController (volume uploads-data)

frontend/src/app/       Angular 21 (standalone, zoneless)
├── core/engine/        ⚙️  Engine: DSL, SSR, servizi infrastrutturali — INTOCCABILE
├── site.ts             il DSL strutturale: pagine, rotte, menu, SEO per-pagina
├── pages/              schermate intere (estendono PageBaseComponent)
└── components/         UI riusabile ("stupida": riceve input(), emette output())
```

**Le due regole d'oro.** Nel backend non si eredita mai da `ControllerBase` di ASP.NET: si usano le basi `Engine*`, che forniscono gratis API key, rate limiter, CORS e `ProblemDetails`. Nel frontend non si manipola il DOM a mano (rompe l'idratazione SSR): si usano binding dichiarativi e signal. Tutto ciò che è marcato **INTOCCABILE** è l'Engine: si aggiorna da solo col `git pull`.

### 🔄 Template vivo: aggiornamenti silenziosi per i progetti figli

Il confine **Engine (intoccabile) / Dominio (del progetto)** non è solo stile: è ciò che permette ai
progetti derivati di **ricevere gli aggiornamenti dell'infrastruttura con un `git pull`**,
senza conflitti, toccando solo il proprio dominio. La regola pratica: non si modifica
l'Engine; i comportamenti si cambiano per **configurazione** (`global-settings.local.json`,
`site.ts`, sezione `Custom`) o per **estensione** (sottoclassi dei controller `Engine*`,
nuovi servizi).

### 🧭 Dove mettere le mani

Regola generale: il **Dominio** si modifica; l'**Engine** (`backend/Engine/`, `frontend/src/app/core/engine/`) **non si tocca** — si aggiorna da solo col `git pull`.

**Pagine, rotte e navigazione.** Tutto il frontend parte da un unico file, `frontend/src/app/site.ts`: lì dichiari le pagine e l'Engine genera da sé rotte, voci di menu, sitemap e meta-tag SEO. Nello stesso file imposti anche la pagina di login, le pagine legali (privacy, cookie, termini) e l'aspetto della shell (navbar, footer). L'identità e l'estetica del sito (nome, versione, lingue, descrizione, **tema**, effetto smoke) non stanno qui: vivono in `global-settings.json` e vengono iniettate al build. Il componente di una pagina sta in `frontend/src/app/pages/<nome>/` (estende `PageBaseComponent`); i pezzi di UI riusabili in `frontend/src/app/components/`. Il dettaglio di ogni opzione è in [frontend/README.md](frontend/README.md).

**Contenuti e testi.** I testi legali (privacy, cookie, termini) sono Markdown in `frontend/src/assets/legal/`; le traduzioni del progetto in `frontend/src/assets/i18n/addon.*.json`; i dati del profilo aziendale e simili in `backend/data/*.json`.

**Backend: API e logica.** Un nuovo endpoint è un controller in `backend/Controllers/` che eredita `EngineApiController` (pubblico) o `EngineProtectedController` (richiede login); la logica di business va nei `backend/Services/`. Per un nuovo tipo di errore: una sottoclasse di `ApiException` più la chiave nei `Resources/*.resx`. Per cambiare lo storage: una nuova implementazione di `IContentStore`.

**Configurazione e segreti — tre file, per proprietario.**
- `global-settings.json` (**committabile, del progetto**): identità ed estetica del sito — nome e versione, lingue, descrizione, tema, effetto smoke. Include la sezione `Custom` per valori liberi di progetto (feature flag, ID analytics…), leggibili da backend, SSR e frontend.
- `global-settings.local.json` (**gitignored**): pubblicazione e segreti del singolo ambiente — hostname e porte, chiavi API, origini CORS, chiave di firma JWT.
- `security-headers.json` (**del template, non toccare**): header di sicurezza fissi.

**Login e sessione.** La forma del payload di sessione si cambia in due posti speculari: `backend/Models/SessionInfo.cs` e `frontend/src/app/core/dto/session.dto.ts`. I cookie si registrano in `frontend/src/app/core/services/cookie-registry.ts`.

> Questo è solo l'**indice** (*dove* andare). Il **come** passo-passo vive nelle sezioni **"Developer Journey"** di [frontend/README.md](frontend/README.md) e [backend/README.md](backend/README.md): front-end e back-end sono disaccoppiati, ognuno si documenta da sé.

### Route SSR speciali del Frontend

Il Node SSR del frontend gestisce oltre alle pagine Angular anche alcune route infrastrutturali:

| Route | Cosa fa |
| :--- | :--- |
| `/api/*` | Reverse proxy verso il backend (inietta l'API key lato server) |
| `/cdn-cgi/asset` | Image processing con Sharp: resize, conversione formato, cache su disco |
| `/cdn-cgi/preview` | Generazione og:image dinamica (preview OpenGraph firmata) |
| `/api/blob/:slug` | Serve (via proxy `/api`) i file caricati dall'applicazione dal volume `/app/uploads` del backend |
| `/assets/legal/*` | Serve i Markdown legali (privacy, cookie, termini) con guard anti path-traversal |
| `/assets/files/*` | **Bloccata** (403): i file sorgente degli asset si servono solo via `/cdn-cgi/asset` |
| `/.well-known/security.txt` | Contatto di sicurezza RFC 9116 (generato al build da `generate-statics.ts`) |

> Il Node SSR applica anche, in automatico, **compressione gzip** su tutte le risposte testuali e un **graceful shutdown** su SIGTERM/SIGINT (drena le connessioni prima di uscire). I file statici SEO (`sitemap.xml`, `robots.txt`, `llms.txt`, `security.txt`) sono generati al build.

---

## 💡 Cosa ottieni di fabbrica

Senza scrivere codice infrastrutturale, il template fornisce già:

- **SEO e social**: tag OpenGraph e JSON-LD per pagina, SSR granulare guidato da `site.ts`, più `sitemap.xml`, `robots.txt` e anteprime `og:image` dinamiche.
- **Sicurezza sugli endpoint**: rate limiting, CORS, API key e header di sicurezza ereditati da ogni controller; errori in formato `ProblemDetails` (RFC 9457) senza leak di stack trace.
- **Pronto all'uso**: routing, navigazione, i18n, PWA, consenso cookie e pagine legali già funzionanti — si parte direttamente dalla logica di dominio.
- **Menu Multilivello**: supporto nativo a navigazione ricorsiva sia nella Navbar (con flyout desktop che evita di uscire dallo schermo e accordion su mobile) sia nel Footer. Basta annidare i gruppi in `site.ts`.

---

## 🎬 La demo del template (la vetrina)

Tutto ciò che il template mostra "di fabbrica" è **demo**: esiste per far vedere il giro completo (UI → servizi → API → store) e va sostituito dal dominio del progetto figlio. Il catalogo degli esempi vive qui, non nei README di progetto: quelli sono direttive di implementazione e documentano solo ciò che i figli ereditano e usano.

### La home (`frontend/src/app/pages/home/`)

Una pagina-vetrina che esercita i componenti e i servizi dell'Engine, sezione per sezione:

| Sezione | Cosa fa vedere |
| :--- | :--- |
| **Azioni** | Componenti autonomi di azione (copia, condivisione, sintesi vocale, download, stampa, PDF) e di contatto (mail, telefono, WhatsApp, Telegram, social) |
| **Generatori** | Anteprima Markdown live (pipe `markdown`) e generazione immagini da testo (`[imgRender]`) con menu contestuale custom (`[appContextMenu]`) |
| **QR Code** | QR multi-formato: testo, WhatsApp, email, Wi-Fi, bonifico SEPA (`[qrContent]`) |
| **Notifiche** | Modali alert / conferma / form di `NotificationService` |
| **Sistema** | Palette tema OKLCH a runtime, i18n, chiamata API con filtro (`GET /social`), asset resolver con resize server-side |

Due dettagli da non perdere:
- **La demo si auto-documenta:** entrando col login demo (`admin` / `Password1!`) ogni sezione mostra accanto lo snippet di codice che la implementa.
- **Idratazione incrementale dal vivo:** le sezioni sotto la piega (QR, Notifiche, Sistema) sono blocchi `@defer (hydrate on viewport)` — il pattern documentato in [frontend/README.md](frontend/README.md), qui in funzione.

### I controller demo (`backend/Controllers/`)

| Controller | Endpoint | Cosa fa vedere |
| :--- | :--- | :--- |
| `BaseController` | `GET /profile`, `GET /social[?nomi=...]` | Lettura dal "DB" JSON localizzato (`FileContentStore`) e un filtro di dominio d'esempio |
| `AuthController` | `POST /auth/login` | Login demo a credenziali fisse → emissione JWT con payload di sessione |
| `ProtectedController` | `GET /ping` | Endpoint riservato: API key + JWT obbligatori |
| `BlobController` | `GET /blob/{slug}`, `POST /blob/up` | Upload/download di file sul volume persistente (è anche uno strumento di fabbrica: il contratto sta in [backend/README.md](backend/README.md)) |

Sono segnaposto da sostituire anche i **dati demo** (`backend/data/irl.json`, `social.json`), i testi legali di esempio (`frontend/src/assets/legal/`) e le credenziali del login.

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

> Sono i controlli di **norma e qualità** che un progetto figlio deve rispettare (accessibilità, performance, traduzioni complete, niente dipendenze circolari, tipi corretti). Non ci sono test unitari nel template: quelli restano un'attività privata, non vengono ereditati dai figli.

Dove e come girano:
- **In CI:** automaticamente a ogni push e pull request (`.github/workflows/`).
- **In locale, prima di ogni push:** si installa il git hook con `bash scripts/test/install-hooks.sh`; da quel momento gli stessi controlli girano prima di `git push` (i test live a11y/Lighthouse sono opt-in con `RUN_LIVE_TESTS=1 git push`).
- **On-demand, tutti in un colpo:** `./scripts/test/run-all.sh` dalla root del progetto.

> **Nota sul deploy:** `deploy.sh` **non** riesegue questa suite. La sua rete di sicurezza è semplice: il lint Angular gira dentro la build Docker (un errore blocca subito la build) e la pubblicazione (`docker compose up -d --wait`) avviene solo se i container diventano sani (HEALTHCHECK). La suite completa è demandata alla CI e al git hook pre-push. Vedi [DOCKER_README.md](DOCKER_README.md).

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
*Battezza il progetto: aggiorna `global-settings.json` e prepara i file locali. Dettagli in [DOCKER_README.md](DOCKER_README.md).*

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
