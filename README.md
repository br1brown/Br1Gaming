# 🚀 Br1WebEngine

<div align="center">
  <strong>Template applicativo base per progetti Web.</strong>
</div>

<br/>

Br1WebEngine si prende in carico la parte noiosa di ogni progetto web (routing, SEO, SSR, CORS, rate limiting, JWT, gestione degli errori), così parti dalla logica che ti interessa e non dall'ennesimo file di configurazione da riempire a mano.

Stack: Angular 21 (standalone, zoneless), ASP.NET Core (.NET 9), Node 24 SSR, Docker. Il tutto è guidato da un singolo file di configurazione; il resto è dettaglio.

## 💡 Funzionalità Integrate

Senza scrivere una riga di codice infrastrutturale, dalla scatola esce già tutto questo (sì, anche le cose che di norma rimandi a "dopo"):

- **Render ibrido & idratazione parziale**: SSR su Node/Express per la SEO, con `@defer (hydrate on viewport)` per idratare i blocchi pesanti quando arrivano in vista, e non un attimo prima — nessun flash della pagina.
- **SEO e social**: tag OpenGraph e JSON-LD per pagina (cinque tipi dichiarabili — articolo, FAQ, prodotto, evento, dato grezzo — statici da `site.ts` o presi dal contenuto), SSR granulare guidato da `site.ts`, più `sitemap.xml`, `robots.txt` e anteprime `og:image` dinamiche. Per un'attività fisica basta il sottotipo schema.org giusto (`LocalBusiness`, `Restaurant`, oltre 150 varianti): orari e indirizzo finiscono nel nodo corretto senza altro codice.
- **Sicurezza by-design**: protezione attiva contro Stored XSS (file isolati, markdown sanificato, JSON-LD inline escapato contro il breakout dal `<script>`), rate limiting, CORS, API key, header di sicurezza (incluso HSTS subdomains), upload persistenti (Blob Store); prevenzione Host Header Injection e script di deploy fail-fast sui segreti. Errori API standardizzati in `ProblemDetails` (RFC 9457) senza leak di stack trace.
- **Dati personali (GDPR)**: `GET`/`DELETE /me/data` già pronti e protetti da login per export e diritto all'oblio — l'Engine fornisce endpoint, autenticazione e risposta in JSON leggibile; il figlio implementa un'unica `IPersonalDataStore` che aggrega dai propri store di dominio. Dopo la cancellazione la sessione è revocata sul server: il vecchio JWT risponde `401`, non resta valido fino a scadenza. Le foto caricate (JPEG, PNG, WebP) perdono per strada GPS e metadati di posizione, e un'immagine malformata viene respinta invece di passare com'è.
- **Pronto all'uso**: routing, navigazione, i18n, PWA (manifest, meta-tag, robots.txt generato al build), consenso cookie e pagine legali già funzionanti — si parte dritti dalla logica di dominio.
- **Menu Multilivello**: supporto nativo a navigazione ricorsiva sia nella Navbar (con flyout desktop che evita di uscire dallo schermo e accordion su mobile) sia nel Footer. Basta annidare i gruppi in `nav.ts`.
- **Notifiche realtime**: canale server→client via SSE (`INotificationStream` / `NotificationStreamService`) per spingere notifiche ai client connessi — targeting per broadcast/connessione/gruppo, indipendente dal login, payload che non si ferma al testo. Dettagli in [backend](backend/README.md) e [frontend](frontend/README.md).
- **Task in background e delivery**: coda generica in-memory (`IBackgroundTaskQueue` + hosted service, scope DI per task) per il pattern "POST risponde subito `202` → lavoro lungo → notifica a fine task", con un `IDeliveryService` che di **default consegna in realtime e stop** (niente email a sorpresa se l'utente è offline) e, se lo chiedi con `Auto`, aggiunge il **fallback email** quando il destinatario non è connesso.
- **Integrazioni con servizi esterni**: schema pronto sia per chiamare API di terze parti (client HTTP tipizzato, URL/chiavi in configurazione, mai hardcoded) sia per ricevere webhook in ingresso (endpoint pubblico con verifica della firma sul body grezzo, elaborazione in background). Dettagli in [backend/README.md](backend/README.md).
- **Consenso cookie**: se il progetto usa GA4/Google Ads lato browser, la ricetta pronta per **Google Consent Mode v2** (obbligatorio in UE/UK) collega i quattro consensi già gestiti dal banner cookie senza codice morto finché non la attivi. Dettagli in [frontend/README.md](frontend/README.md) §"Google Consent Mode v2".
- **Tema derivato, non incollato**: dai un colore brand e la palette esce calcolata in OKLCH, con contrasto WCAG garantito su ogni superficie, e finisce compilata dentro Bootstrap al build: niente CSS del tema iniettato a runtime, niente lampo di colori sbagliati. Chi ha altri colori da rispettare li dichiara nel design system (`colori.sfondo` per la tinta di fondo, `colori.palette` per secondario, info e colori propri, ognuno con le sue `.btn-*`/`.text-*`/`.bg-*`). Otto design system pronti da estendere o copiare, se non hai voglia di partire da zero. Un font custom nella cartella montata su Docker diventa il font del sito senza toccare il CSS, e lo stesso file disegna le `og:image` generate al volo: l'anteprima social non stona mai col sito. Dettagli in [frontend/README.md](frontend/README.md), capitolo «Design system e tema».
- **Editor Markdown**: un campo di form (`app-markdown-editor`) con barra accessibile da tastiera, scorciatoie, annulla parola per parola, colori e anteprima presi dalla stessa pipeline che poi renderà il testo. Quello che vedi mentre scrivi è quello che esce, non una promessa.

---

## 📚 Mappa della documentazione

Un file, un mestiere. Così sai dove guardare prima di mettere mano al codice.

| Documento | A cosa serve |
| :--- | :--- |
| [QUICKSTART.md](QUICKSTART.md) | **Parti da qui se è la prima volta:** 3 comandi e sei in piedi, senza la teoria. |
| **README.md** (questo) | Panoramica, architettura, **dove mettere le mani**, avvio rapido e la **vetrina della demo**: gli esempi del template vivono qui. |
| [frontend/README.md](frontend/README.md) | **Direttive di implementazione** del frontend per i progetti figli: DSL `site.ts`, SSR, servizi (API, tema, i18n, cookie, share, QR…), directive Angular, SEO. |
| [backend/README.md](backend/README.md) | **Direttive di implementazione** del backend per i progetti figli: Engine di sicurezza, eccezioni→`ProblemDetails`, `FileContentStore`, login JWT. |
| [DOCKER_README.md](DOCKER_README.md) | Setup Docker, configurazione `global-settings(.local).json`, pubblicazione, backup dei volumi. |
| [RELEASE.md](RELEASE.md) | **Pubblicazione in produzione consigliata:** release artifact-based (immagini su GHCR via CI), la VPS scarica e basta — niente `git pull`, niente build in loco. |
| [AGENTS.md](AGENTS.md) | Regole trasversali e ricette pratiche per chi sviluppa — umano o assistente di coding. |
| [ENGINE.md](ENGINE.md) | Mappa dell'implementazione interna dell'Engine **non** citata per nome nei due README di dettaglio — dove trovarla e perché è fatta così, senza reverse engineering. |
| [CHANGELOG.md](CHANGELOG.md) | Cosa cambia nel template tra una versione e l'altra. |

---

## 🗺️ Mappa delle aree tecniche

La tabella sopra dice in che file cercare; questa dice per argomento, utile a chi arriva senza conoscere il progetto e vuole sapere subito cosa il template gli mette a disposizione, area per area.

| Area | Nel template | Approfondisci |
| :--- | :--- | :--- |
| **Integrazioni con servizi esterni** | Chiamare un'API terza (client HTTP tipizzato, config + segreti separati) e ricevere webhook (firma sul body grezzo, coda background) | [backend/README.md](backend/README.md) §8 |
| **Dati e persistenza** | `FileContentStore` (JSON in RAM, localizzato); nessun ORM/DB relazionale di default — è una scelta, il seam verso un DB reale (`IContentStore`) è già pronto | [backend/README.md](backend/README.md) §4 |
| **Cache e scalabilità multi-istanza** | `IMemoryCache` per-istanza; il seam verso un backplane distribuito (es. Redis) per notifiche, store e revoca delle sessioni (`ISessionRevocation`) è già segnalato per chi estende oltre la singola istanza. Il default regge un backend solo, anche dietro reverse proxy e con frontend altrove; non due istanze del backend dietro un bilanciatore | [backend/README.md](backend/README.md) §4, §6, «Logout e revoca della sessione» |
| **Sicurezza** | JWT opzionale (`Features.Login`/`PublicLogin`), ruoli via claim di sessione, revoca della sessione dal server (`ISessionRevocation`), rate limiting, CORS, header di sicurezza, XSS-hardening, segreti fuori da git | [backend/README.md](backend/README.md) §1 e «Sistema di Login e Sessioni JWT» |
| **Dati personali (GDPR)** | Export e diritto all'oblio (`GET`/`DELETE /me/data`) già cablati dietro login, export in JSON leggibile (upload e storico del registro); la `DELETE` anonimizza il registro e revoca la sessione; il figlio implementa un'unica `IPersonalDataStore` | [backend/README.md](backend/README.md) §9 |
| **Consenso cookie e GDPR** | Consenso a 4 categorie (Technical/TechnicalOptional/Analytics/Profiling), Global Privacy Control onorato in automatico, ricetta pronta per Google Consent Mode v2 (obbligatorio su GA4/Ads in UE/UK) — nessun tag caricato finché non lo attivi tu | [frontend/README.md](frontend/README.md) §"Google Consent Mode v2" |
| **Pagine legali** | Privacy, Cookie, Termini, Note legali, Accessibilità come slot di `site.ts`; pagine extra in `extra`; Markdown in una cartella per parte e un file per lingua, senza segnaposto: le parti di una funzione spenta non compaiono, l'identità chiude la pagina da sé, e il build si ferma su un file mancante o dal nome sbagliato | [frontend/README.md](frontend/README.md) §"Pagine legali (`legal`)" |
| **Asset e risorse** | Immagini (resize/formati server-side) e font centralizzati; CDN abilitata via whitelisting del dominio in CSP | [frontend/README.md](frontend/README.md) — sezioni AssetService, Font |
| **Bundling frontend** | Budget di produzione (`angular.json`, già gate CI in `ng build`), whitelist CommonJS, code-splitting per pagina/SDK via `import()` dinamico | [frontend/README.md](frontend/README.md) — sezione Bundling |
| **Configurazione applicativa** | Routing via DSL `site.ts`, i18n su entrambi i lati, errori uniformi (`ProblemDetails`), logging via property ambient `Logger` | [backend/README.md](backend/README.md) §2, «Dove mettere le mani» qui sopra |
| **Error reporting** | `IErrorReportingService`: un POST JSON verso un webhook a tua scelta per ogni bug vero o errore ≥500, spento finché non accendi `Features.ErrorReporting`, zero pacchetti NuGet in più | [backend/README.md](backend/README.md) §10 |
| **DevOps e deploy** | Docker Compose, pipeline CI (lint, i18n, tsc, cicli, a11y, Lighthouse, audit, gitleaks, CodeQL), health check | [DOCKER_README.md](DOCKER_README.md) |
| **Testing e qualità** | Gate automatici (lint/i18n/tsc/cicli/a11y/Lighthouse) in CI; unit/integration/E2E restano di ogni progetto figlio, per scelta di isolamento | «🧪 Test Suite Automatica» qui sotto |
| **Frontend specifico** | State via Signals nativi (no NgRx), Bootstrap 5 + libreria di componenti propria, SEO/JSON-LD automatico | [frontend/README.md](frontend/README.md) |
| **Manutenzione** | `npm audit` + vulnerabilità NuGet + gitleaks + CodeQL in CI; performance monitorata tramite gate Lighthouse | «Supply chain» qui sotto |

---

## 🧭 Approccio e Architettura

Filosofia in una riga: nascondere la complessità senza portarti via il controllo. La base è strutturata ma resta leggera, niente cattedrale di astrazioni da reggere a ogni avvio.

| Il grattacapo | Come lo chiude Br1WebEngine |
| :--- | :--- |
| Configurare N file per il routing e la SEO | Un DSL dichiarativo (`site.ts` + `pages/*.pages.ts`) gestisce rotte, menu e meta-tag. |
| Dimenticare la sicurezza sugli endpoint | Tutti gli endpoint ereditano Rate Limiter e CORS in automatico. |
| Configurare DB relazionali per testare | `FileContentStore` usa JSON in RAM con localizzazione integrata. |
| Leak di stack trace in produzione | Middleware globale per errori `RFC 9457` Problem Details. |
| Redux boilerplate per il frontend | Uso nativo di `Signals` e `withFetch` di Angular 21 (zoneless). |

---

## 🏗️ Architettura del Sistema

Frontend e backend vivono separati, ciascuno a casa propria, ma condividono la stessa filosofia: la parte noiosa (sicurezza, routing, errori, SSR) resta chiusa nell'Engine, mentre quello che il progetto figlio scrive e mostra, il Dominio, è quello che finisce in vetrina.

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
├── Store/              IContentStore/FileBlobStore e implementazioni: il confine verso la persistenza
├── data/               "database" JSON localizzato (letto dal FileContentStore)
├── db/                 volume db-data: SQLite (EF Core) per la proprietà dei file caricati
└── uploads/            file caricati via EngineBlobController (volume uploads-data)

frontend/src/app/       Angular 21 (standalone, zoneless)
├── core/engine/        ⚙️  Engine: DSL, SSR, servizi infrastrutturali — INTOCCABILE
├── site.ts             assembla le pagine dichiarate in pages/*.pages.ts: legal, shell, login/home
├── pages/              schermate (estendono PageBaseComponent) + dichiarazioni di rotta (*.pages.ts)
└── components/         UI riusabile ("stupida": riceve input(), emette output())
```

Le due regole d'oro: nel backend erediti sempre dalle basi `Engine*`, mai da `ControllerBase` di ASP.NET, che ti regalano API key, rate limiter, CORS e `ProblemDetails` senza che tu scriva una riga; nel frontend lavori con binding dichiarativi e signal, e l'idratazione SSR resta intatta. Ciò che porta il bollo INTOCCABILE è l'Engine: nei figli si aggiorna da sé col merge dal template (vedi sotto).

### 🔄 Template vivo: nascita e aggiornamento dei progetti figli

Nascita del figlio (innesto git, non clone), aggiornamento con `git merge template/main`, chi possiede cosa al merge (Engine, Scaffold, Dominio) e i file di Dominio a contratto fisso stanno in [AGENTS.md](AGENTS.md#template-vivo-nascita-e-aggiornamento-dei-progetti-figli), che nel figlio resta: questo README no, è la vetrina del template e la cerimonia di `setup.mjs` lo toglie.

### 🧭 Dove mettere le mani

Regola generale: il Dominio si tocca; l'Engine (i path della riga Engine qui sopra) resta com'è e si aggiorna da sé col merge dal template (vedi Template vivo). Mettere mano al Dominio vuol dire riusarne i file demo: li svuoti e li riempi col tuo contenuto, lasciando nomi e posizioni dove sono.

Le pagine, le rotte e la navigazione si dichiarano nei file di area `frontend/src/app/pages/*.pages.ts` (uno per gruppo tematico); `site.ts` li assembla e tiene per sé gli slot globali (login, pagine legali) e il design system attivo (`shell.designSystem`: tono, colori, navbar, footer, font); il menu vive in `nav.ts`. Da quelle dichiarazioni l'Engine genera da sé rotte, voci di menu, sitemap e meta-tag SEO. Identità del sito (nome, versione, lingue, descrizione), colore del brand (`site.colorTema`) e interruttori delle funzioni (`Features`) vivono in `global-settings.json` ed entrano nel build: tema compreso, compilato da `npm run generate:statics` prima di ogni `start`/`dev`/`build`. Il componente di una pagina sta in `frontend/src/app/pages/<nome>/` (estende `PageBaseComponent`); i pezzi di UI riusabili stanno in `frontend/src/app/components/`. Ogni opzione, voce per voce, è in [frontend/README.md](frontend/README.md).

I testi legali (privacy, cookie, termini…) sono Markdown in `frontend/src/assets/legal/<pagina>/<parte>/<lingua>.md`; le traduzioni del progetto stanno in `frontend/src/assets/i18n/addon.*.json`; l'identità del sito, cioè dati legali, social del brand e tipo entità, sta in `backend/data/identity.json` (servita dall'Engine su `GET /identity`).

Sul backend, un nuovo endpoint è un controller in `backend/Controllers/` che eredita `EngineApiController` (pubblico) o `EngineProtectedController` (chiede il login); la logica di business va nei `backend/Services/`. Per un nuovo tipo di errore serve una sottoclasse di `ApiException` più la chiave nei `Resources/*.resx`. Per cambiare lo storage serve una nuova implementazione di `IContentStore`.

Configurazione e segreti: tre file, uno per proprietario.
- `global-settings.json` (**committabile, del progetto**): identità del sito (nome e versione, lingue, descrizione), colore del brand e gli interruttori di `Features` (`Login` riservato, `PublicLogin`, `Mail`, `ErrorReporting`, `Forms`; chiave assente = spento). Il flag accende, la configurazione nel `.local` è il requisito: flag acceso senza configurazione e il backend non parte, configurazione senza flag e la funzione resta spenta. `Features` sta qui e da nessun'altra parte: nel `.local` ferma il build, in una variabile d'ambiente ferma il backend. Include la sezione `Custom` per valori liberi di progetto (varianti, ID analytics…), leggibili da backend, SSR e frontend.
- `global-settings.local.json` (**gitignored**): pubblicazione e segreti del singolo ambiente — hostname e porte, chiavi API, origini CORS, chiave di firma JWT (almeno 32 byte, requisito del login), configurazione di `Mail` ed `ErrorReporting`, il percorso del file coi fatti del server per la Privacy Policy (`frontend.hostingInfo`). Se manca nella copia di sviluppo del repository, lo scrive con chiavi generate il primo che parte fra `generate:statics` e il backend in Development (`node setup.mjs` lo scrive comunque): nessun passo a mano; in Docker e negli altri ambienti non si crea mai.
- `security-headers.json` (**del template, non toccare**): header di sicurezza fissi. Il Node SSR ne verifica lo sha256 all'avvio e si rifiuta di partire se è stato modificato a mano — per estendere la CSP (es. domini extra per un servizio di mappe) si usa `security-headers.override.json` (**committabile, del progetto**, radice, mai toccato dal template), non questo file. Vedi [frontend/README.md](frontend/README.md) §"Estendere la CSP".

Per il login e la sessione, la forma del payload si cambia in due posti speculari: `backend/Models/SessionInfo.cs` e `frontend/src/app/core/dto/session.dto.ts`. I cookie e le voci di Web Storage si registrano, con la stessa API gated dal consenso, in `frontend/src/app/core/services/cookie-registry.ts`.

> Questa è la mappa del dove, niente di più. Il come passo-passo vive nelle sezioni "Developer Journey" di [frontend/README.md](frontend/README.md) e [backend/README.md](backend/README.md): front-end e back-end sono disaccoppiati, ciascuno si racconta per conto suo.

### Route SSR speciali del Frontend

Il Node SSR del frontend gestisce, oltre alle pagine Angular, anche alcune route infrastrutturali:

| Route | Cosa fa |
| :--- | :--- |
| `/api/*` | Reverse proxy verso il backend (inietta l'API key lato server) |
| `/cdn-cgi/asset` | Image processing con Sharp: resize, conversione formato, cache su disco |
| `/cdn-cgi/preview` | Generazione og:image dinamica (preview OpenGraph cifrata, AES-GCM) |
| `/api/blob/:slug` | Serve (via proxy `/api`) i file caricati dall'applicazione dal volume `/app/uploads` del backend |
| `/assets/legal/*` | Serve i Markdown legali (privacy, cookie, termini) con guard anti path-traversal |
| `/assets/files/*` | **Bloccata** (404): i file sorgente degli asset si servono soltanto via `/cdn-cgi/asset` |
| `/.well-known/security.txt` | Contatto di sicurezza RFC 9116, generato al volo dall'identità del sito (`GET /identity`) |

> Il Node SSR applica anche, in automatico, la compressione gzip sulle risposte testuali (escluso lo stream di notifiche SSE, che resta non compresso così gli eventi arrivano subito al browser invece di restare nel buffer) e un graceful shutdown su SIGTERM/SIGINT che drena le connessioni prima di uscire. I file statici SEO (`robots.txt`) sono generati al build; `sitemap.xml`, `llms.txt` e `security.txt` invece sono endpoint generati al volo — i primi includono anche le pagine parametriche con `dynamicParams`, non enumerabili al build, il secondo legge il contatto dall'identità del sito, così resta aggiornato senza un redeploy.

---

## 🎬 La demo del template (la vetrina)

Tutto ciò che il template mostra "di fabbrica" è demo: esiste per far vedere il giro completo (UI, servizi, API, store), e il progetto figlio la riusa invece di rottamarla, tenendo la struttura (file, servizi, endpoint) e cambiandone il contenuto. La chiave di lettura è semplice: ciò che non si modifica sta nell'Engine, tutto il resto sta nel template apposta perché il figlio lo faccia suo. Il catalogo degli esempi abita qui, non nei README di progetto, che sono direttive di implementazione e raccontano ciò che i figli ereditano e usano, niente di più.

> Riusare o partire puliti: lo decidi al `setup`. La cerimonia di init (`node setup.mjs "Nome"`) chiede `[s/N]`:
> - **`N` → riusi la demo** (la via descritta qui sopra): tieni struttura, file, servizi ed endpoint e ne cambi il contenuto. La demo resta un esempio vivo finché vuoi.
> - **`s` → parti pulito** (eject): il setup rimuove la demo (galleria Social + store/SiteService, home svuotata, `addon` azzerati, `BaseController` ridotto a vuoto, `identity.json` azzerato a scheletro), elimina questa vetrina e fa un commit `init <Nome>`. Resta lo scheletro Home + pagine legali, l'identità servita dall'Engine, login spento, pronto a crescere.
>
> In entrambi i casi l'Engine resta intatto: cambia soltanto da dove parte il tuo dominio, demo riusabile o foglio bianco. Se la tieni, la demo continua a servire: è il banco di prova del template, perché esercita ogni feature, e resta il tuo esempio di riferimento finché ti serve.

### La home e la pagina demo (`frontend/src/app/pages/home/`, `frontend/src/app/pages/che-faccio/`)

La home porta l'hero e la Style Guide; la pagina demo (`/che-faccio`, `/en/what-i-do`) esercita i componenti e i servizi dell'Engine, sezione per sezione:

| Sezione | Cosa fa vedere |
| :--- | :--- |
| **Style Guide** | Catalogo visivo sempre presente (colori, tipografia, bottoni, badge, alert, form): a differenza delle sezioni sotto, **non è demo Dominio ma un componente Engine** (`app-style-guide`), pensato per chi valuta l'aspetto del sito (designer, Art Director) senza login né lettura di codice. Sopravvive anche a un `setup.mjs` "parti pulito" (eject). Non è il design system: quello (`DesignSystemPreset`, capitolo «Design system e tema» in `frontend/README.md`) decide l'aspetto, questa pagina lo mette in mostra |
| **Azioni** | Componenti autonomi di azione (copia, condivisione, sintesi vocale, download, stampa, PDF) e di contatto (mail, telefono, WhatsApp, Telegram, social) |
| **Generatori** | Editor Markdown (`app-markdown-editor`) con anteprima live (pipe `markdown`) e generazione immagini da testo (`[appImgRender]`) con menu contestuale custom (`[appContextMenu]`) |
| **QR Code** | QR multi-formato: testo, WhatsApp, email, Wi-Fi, bonifico SEPA (`[appQrContent]`) |
| **Notifiche** | Modali alert / conferma / form di `NotificationService` |
| **Sistema** | Palette tema OKLCH calcolata in build e compilata dentro Bootstrap, i18n, chiamata API con filtro (`GET /social`), asset resolver con resize server-side |

Due dettagli da non perdere:
- **La demo si auto-documenta:** entrando col login demo (`admin` / `Password1!`, accettato nell'ambiente Development e rifiutato in tutti gli altri) ogni sezione mostra accanto lo snippet di codice che la implementa.
- **Idratazione incrementale dal vivo:** le sezioni sotto la piega (QR, Notifiche, Sistema) sono blocchi `@defer (hydrate on viewport)`, il pattern documentato in [frontend/README.md](frontend/README.md), qui in funzione.

### I controller demo (`backend/Controllers/`)

| Controller | Endpoint | Cosa fa vedere |
| :--- | :--- | :--- |
| `BaseController` | `GET /social[?nomi=...]`, `POST /notifications/demo/ping[?message=...]`, `POST /tasks/demo/import[?email=...]` | La galleria social demo (filtro di dominio d'esempio: se il client ha lo stream attivo — header `X-Connection-Id` — consegna anche una notifica realtime via `IDeliveryService`, canale di default), il ping del canale realtime e la demo del pattern task-lungo → notifica/email |
| *(Engine)* `EngineIdentityController` | `GET /identity` | **Non è demo:** l'Engine serve l'identità del sito (legale + social brand + tipo entità) da `data/identity.json`, sorgente unica di footer, pagine legali e SEO. Il figlio riempie il file (o sostituisce `IIdentityStore` via DI); file assente → risposta `null` |
| `AuthController` | `POST /auth/login` | Login demo a credenziali fisse → emissione JWT con payload di sessione |
| `ProtectedController` | `GET /ping` | Endpoint riservato: API key + JWT obbligatori |
| *(Engine)* `EngineBlobController` | `GET /blob/{slug}`, `POST /blob/up`, `PUT /blob/{slug}`, `DELETE /blob/{slug}` | **Non è demo:** upload/download/sostituzione/cancellazione di file sul volume persistente, con proprietà tracciata su SQLite (`AppBlobStore`, EF Core) — contratto in [backend/README.md](backend/README.md) |

Sono segnaposto i dati demo (`backend/data/social.json`, galleria social) e le credenziali del login: i file restano dove sono e con lo stesso nome, il figlio ci scrive dentro i propri dati. I testi legali (`frontend/src/assets/legal/`) non sono segnaposto: descrivono i trattamenti che l'Engine fa davvero, e il figlio aggiunge i propri. L'identità del sito (`backend/data/identity.json`) è invece la parte non-demo: legale, social del brand e tipo entità in un unico file, servito dall'Engine su `GET /identity`. I pezzi facoltativi si lasciano non valorizzati e l'Engine fa il resto: senza social il footer nasconde da sé la sezione, senza identità (`identity.json` assente → `null`) footer e blocco legale spariscono del tutto. Il blocco identità del footer è la parte legale del sito: nei figli si adatta l'estetica e si tolgono i pezzi facoltativi, cioè i social, non le informazioni legali.

---

## 🧪 Test Suite Automatica

Sette controlli di qualità, zero da ricordare a mano: la CI (GitHub Actions) li esegue da sé sui push al branch di default del repo (es. `main`, `master`: letto a runtime da `github.event.repository.default_branch`, nessun nome cablato) e a `fix/**`, e sulle pull request verso il branch di default — solo per le parti toccate (backend, frontend, traduzioni, infrastruttura).

| Controllo | Cosa verifica |
| :--- | :--- |
| `lint-check.sh` | Qualità del codice Angular (ESLint) |
| `i18n-check.sh` | Chiavi di traduzione presenti in una lingua e assenti nelle altre (simmetria dei cataloghi `basic` e `addon`; l'uso delle chiavi non è controllato) |
| `tsc-check.sh` | Errori TypeScript (type safety) |
| `circular-deps-check.sh` | Dipendenze circolari tra moduli |
| `system-font-check.sh` | Endpoint system-font dal vivo (reachability e adversarial: key/indice invalidi, path traversal) |
| `site-builder-check.sh` | Invarianti statiche di SiteBuilder (audit paths, copertura sitemap) |
| `live-test.sh` | Conformità WCAG (Pa11y) + budget performance/best-practices/SEO (Lighthouse), un browser condiviso |

> Sono i controlli di norma e qualità che un progetto figlio deve rispettare (accessibilità, performance, traduzioni complete, niente dipendenze circolari, tipi corretti). I test unitari restano un'attività privata di ogni progetto: il template eredita ai figli questi controlli di norma e qualità, niente altro.

> C'è un'asimmetria frontend/backend, dichiarata esplicitamente qui: tutti e sette i controlli sopra sono frontend. Il backend .NET ha, in CI, la build Release e la scansione vulnerabilità NuGet (§ Supply chain sotto); niente lint (`dotnet format`/analyzer) né test automatico. Nella solution non c'è un progetto di test (`*.Tests.csproj`): se il progetto figlio ne aggiunge uno, il gate CI dei test backend va costruito da zero, perché non esiste un binario da attivare.

Dove e come girano:
- **In CI:** in automatico sui push al branch di default e a `fix/**` e sulle pull request, per le parti toccate; gli audit live girano sul branch di default e sulle pull request (`.github/workflows/`). È il gate ufficiale.
- **On-demand, in locale:** `./scripts/test/run-all.sh` dalla root del progetto (l'audit live Pa11y/Lighthouse gira soltanto se è attivo un server da testare).

> Nota sul deploy: due modelli di pubblicazione convivono. In produzione si usa il modello artifact-based: la CI builda le immagini a ogni tag e le pubblica su GHCR, la VPS le scarica e basta (niente `git pull`, niente build in loco). Vedi [RELEASE.md](RELEASE.md). Il modello source-based `scripts/deploy.sh` (build sulla macchina, poi swap se e quando i container diventano sani via HEALTHCHECK) resta comodo per test e sviluppo locale, ma è sconsigliato in produzione. La suite di test completa resta demandata alla CI. Vedi [DOCKER_README.md](DOCKER_README.md).

### Supply chain

Oltre alla qualità del codice, la CI tiene d'occhio anche:
- **Pacchetti vulnerabili:** `npm audit` (frontend) e `dotnet list package --vulnerable` (backend) a ogni push/PR.
- **Segreti committati per sbaglio:** scansione **gitleaks** (rinforza l'architettura "segreti fuori da git").
- **Pattern di vulnerabilità nel codice scritto qui** (injection, uso non sicuro di crypto, ecc.): **CodeQL** (`.github/workflows/CodeQL.yml`), su frontend e backend, a ogni push/PR e settimanalmente (query nuove trovano cose nuove anche su codice invariato). Risultati nel tab **Security → Code scanning** del repository. Workflow separato apposta: nessun file di test coinvolto, zero rischio di rompersi quando un figlio sostituisce la demo (vedi nota sopra sull'asimmetria unit/E2E).

---

## 🚀 Quick Start

Per il primo setup passo-passo (`setup.mjs` + Docker) vedi [QUICKSTART.md](QUICKSTART.md). Qui sotto l'alternativa per chi sviluppa in locale senza Docker; per i riferimenti completi vai alla Mappa della documentazione in cima a questo file.

### Avvio Veloce in Locale

La versione Node di riferimento è dichiarata in `.nvmrc` (Node 24 LTS): con nvm basta `nvm install && nvm use`; la CI legge lo stesso file.

Segreti di sviluppo: `global-settings.local.json` (gitignored) porta la `SecretKey` del login demo, acceso in `Features`, e la API key del proxy del dev server. Se manca, il primo dei due che parte lo crea con chiavi generate (`generate:statics` per il frontend, il backend in Development), come farebbe `setup.mjs`: nessun passo a mano.

**Avvio Backend (.NET 9):**
```bash
cd backend
dotnet run
```
Espone di default `/health`.

**Avvio Frontend (Angular 21):**
```bash
cd frontend
npm install
npm run start
```
Si connette in automatico al backend sulla porta di default tramite proxy. In alternativa `./start-frontend-dev.sh` dalla root fa `npm install` più avvio in un colpo unico (con `BACKEND_ORIGIN` già impostato per l'SSR locale).
