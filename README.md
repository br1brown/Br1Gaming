# Br1WebEngine

**Un'engine personale e moderna per costruire siti web, basata su ASP.NET Core 9 e Angular 19.**

Br1WebEngine e' un template full-stack per siti content-driven e piccoli portali. L'idea e' avere una base gia' pronta in cui il frontend centralizza struttura, rotte, menu e sitemap, mentre il backend espone API, contenuti localizzati e una pipeline di sicurezza gia' cablata.

---

### Indice
- [Introduzione](#introduzione)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architettura del Progetto](#architettura-del-progetto)
- [API e Sicurezza](#api-e-sicurezza)
- [Operativita' e Configurazione](#operativita-e-configurazione)
- [Setup per lo Sviluppo Locale](#setup-per-lo-sviluppo-locale)
- [Deployment con Docker](#deployment-con-docker)
- [Operazioni Comuni](#operazioni-comuni)
- [Licenza](#licenza)

---

### Introduzione
Il repository separa chiaramente la parte riusabile del template da quella custom del progetto:

- il frontend descrive pagine, navigazione, branding e sitemap a partire da `frontend/src/app/site.ts`
- il backend mantiene una base condivisa in `backend/Engine/` e una zona di progetto per controller, servizi e contenuti
- Docker copre sviluppo e deploy senza cambiare layout del repository

Il target e' partire da una base solida e sostituire contenuti, pagine ed endpoint senza riscrivere ogni volta l'infrastruttura.

### Features
- **Backend API-first**: REST API in ASP.NET Core con storage file-based pronto all'uso.
- **Frontend moderno**: SPA/PWA Angular con configurazione del sito centralizzata.
- **Autenticazione**: API key sempre attive, JWT opzionale per le aree protette.
- **Localizzazione (i18n)**: Supporto multilingua sia lato frontend sia nei contenuti backend.
- **Gestione temi e contenuti**: branding, pagine legali, cookie banner e contenuti Markdown.
- **Script di utilita'**: generazione automatica di sitemap, meta tag e icone.

### Tech Stack
| Categoria | Tecnologia | Note |
|---|---|---|
| Backend | ASP.NET Core 9, C# | REST API, API key, JWT opzionale, ProblemDetails |
| Frontend | Angular 19, TypeScript, Bootstrap 5 | SPA/PWA, i18n, tema dinamico |
| Container | Docker, Docker Compose, Nginx | dev con hot reload, prod con frontend statico |
| Tooling | Node 22+, npm 10+ | script meta, sitemap e icone |

### Architettura del Progetto
La soluzione e' divisa in due blocchi principali:

- `backend`: API, sicurezza, servizi, storage e contenuti
- `frontend`: applicazione Angular, asset, traduzioni, script e configurazione del sito


```
┌──────────────────────────────────────────────┐
│  Frontend (Angular 19 + Nginx)               │
│  porta 80                                    │
│  ┌─────────────┐  ┌───────────────────────┐  │
│  │ Static SPA  │  │ /api/* → proxy backend│  │
│  └─────────────┘  └───────────────────────┘  │
└────────────────────────┬─────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────┐
│  Backend (ASP.NET Core 9)                    │
│  porta 8080                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Base API │ │ Auth API │ │ Protected API│  │
│  │ (aperto) │ │(transito)│ │  (riservato) │  │
│  └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────────────────────────────────────┐│
│  │ Security: API Key + JWT + CORS + Rate    ││
│  │ Limiting + Security Headers              ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

#### Struttura rapida
```text
Br1WebEngine/
|-- backend/
|   |-- Engine/        basi condivise del template
|   |-- Controllers/   endpoint concreti del progetto
|   |-- Services/      logica applicativa
|   |-- Store/         contratto storage + implementazioni
|   |-- Security/      pipeline di sicurezza
|   `-- data/          contenuti JSON del progetto
`-- frontend/
    |-- src/app/       pagine, layout, configurazione sito
    |-- src/assets/    i18n, file statici, pagine legali
    `-- scripts/       meta, sitemap, icone
```

### API e Sicurezza
#### API attuale
| Metodo | Path | Auth | Note |
|---|---|---|---|
| `GET` | `/api/profile` | API key | profilo aziendale localizzato |
| `GET` | `/api/social` | API key | filtro opzionale con `nomi` |
| `POST` | `/api/auth/login` | API key | placeholder, nel template risponde `valid = false` |
| `GET` | `/health` | nessuna | health check |

Le API protette stanno in `backend/Controllers/ProtectedController.cs` e diventano realmente utilizzabili solo quando configuri il JWT.

#### Tre controller, tre contesti di accesso
- `BaseController`: endpoint pubblici del progetto dietro API key
- `AuthController`: flussi di autenticazione; il login base e' solo un placeholder
- `Protected`: endpoint disponibili solo dopo autenticazione completa (API key + JWT)

Ogni controller eredita le configurazioni da un Controller per ognuno dei tre comportamenti 

#### Pipeline di sicurezza
Ogni richiesta attraversa una pipeline gia' pronta, registrata in `Program.cs` con `AddTemplateSecurity(...)`:

1. **Forwarded headers**: ricostruisce l'IP reale da `X-Forwarded-For` se `Security.BehindProxy = true`
2. **CORS**: gestisce origini consentite e preflight `OPTIONS`
3. **Rate limiting**: `100 req/min` globali per IP e `5 req/min` sulla route di login
4. **Security headers**: aggiunge gli header di sicurezza a ogni risposta
5. **API key**: richiede `X-Api-Key` dove previsto
6. **JWT Bearer**: si attiva solo se `Security.Token.SecretKey` e' valorizzata

Gli errori applicativi vengono normalizzati in `ProblemDetails` tramite `ApiExceptionHandler`, quindi le API restituiscono payload coerenti anche in caso di `404`, input invalidi o errori di decoding.

#### Persistenza e localizzazione
`IContentStore` astrae l'accesso ai dati.
Il template non impone un database: il file storage e' solo la base di partenza. 

L'implementazione pronta all'uso e' `FileContentStore`, che legge i contenuti da `backend/data/`.
La localizzazione e' gia' gestita a livello ricorsivo nei JSON, con fallback all'italiano, quindi puoi mantenere contenuti annidati senza duplicare struttura o endpoint.

### Operativita' e Configurazione
#### Gestione dei contenuti
La maggior parte dei contenuti testuali e' gestita tramite file, quindi puoi aggiornare il progetto senza ricompilare ogni volta:

- `backend/data/irl.json` : dati legali del sito
- `frontend/src/assets/i18n/`: traduzioni del progetto (`addon.*.json`)
- `frontend/src/assets/legal/`: privacy, cookie policy, termini di servizio e note legali
- `frontend/src/assets/file/` e `frontend/src/assets/mapping.json`: file statici e mapping degli asset

#### Configurazione del backend
Il file principale e' `backend/appsettings.json`. Le chiavi piu' importanti sono:

| Chiave | Effetto |
|---|---|
| `Security.ApiKeys` | chiavi API accettate |
| `Security.CorsOrigins` | origini consentite; vuoto = aperto |
| `Security.BehindProxy` | abilita `ForwardedHeaders` dietro reverse proxy |
| `Security.Token.SecretKey` | vuoto = login e JWT disabilitati |
| `Security.Token.ExpirationSeconds` | durata del token |
| `Security.Headers` | header di sicurezza aggiunti alle risposte |

#### Variabili runtime del frontend container
| Variabile | Effetto |
|---|---|
| `API_URL` | vuota = stesso host con proxy Nginx; valorizzata = backend remoto |
| `API_KEY` | API key iniettata a runtime nel frontend |

Se frontend e backend girano su host separati, devi allineare anche `Security__CorsOrigins__*` sul backend.

#### Script di utilita' del frontend
La cartella `frontend/scripts/` contiene gli script usati dal progetto:

- `npm run generate:site-meta`: genera i meta tag del sito
- `npm run generate:sitemap`: genera la sitemap a partire dalle rotte
- `npm run generate:icons`: rigenera le icone PWA da `favicon.png`
- `npm run build`: esegue la build production e lancia in automatico meta + sitemap

### Setup per lo Sviluppo Locale
#### Prerequisiti
- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js](https://nodejs.org/) 22 o superiore
- `npm` 10 o superiore
- [Angular CLI](https://angular.dev/tools/cli) opzionale, se vuoi usarla globalmente

### Operazioni Comuni
#### Aggiungere una pagina
1. Aggiungi un valore a `PageType` in `frontend/src/app/site.ts`.
2. Crea il componente sotto `frontend/src/app/pages/`.
3. Registra la pagina in `setSitePages(...)`.
4. Aggiungila alla navigazione se serve.
5. Inserisci le chiavi i18n in `addon.it.json` e `addon.en.json`.

#### Aggiungere un endpoint API
1. Scegli il controller giusto: `BaseController`, `AuthController` o `ProtectedController`.
2. Crea la logica in `backend/Services/` o in un servizio dedicato.
3. Se serve, usando `backend/Store/IContentStore.cs` estendi `FileContentStore`.
4. Esponi la chiamata lato frontend in `frontend/src/app/core/services/api.service.ts`.

#### Abilitare il login
1. Imposta `Security.Token.SecretKey` in `backend/appsettings.json` o via env var.
2. Implementa la validazione credenziali in `backend/Controllers/AuthController.cs`.
3. Emetti il token tramite `Auth.GenerateToken()`.

### Licenza
Questo progetto e' rilasciato sotto licenza MIT. Vedi [`LICENSE`](LICENSE).