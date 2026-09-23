# Security Policy

## Segnalare una vulnerabilità

Se trovi una vulnerabilità di sicurezza in Br1WebEngine, **non segnalarla con una issue pubblica**.

Scrivi a **br1brown@hotmail.it** con:
- Descrizione della vulnerabilità
- Passi per riprodurla (se applicabile)
- Impatto potenziale stimato
- Eventuale fix suggerito (opzionale)

La segnalazione verrà esaminata e, se confermata, sarà menzionata nelle note di rilascio (con credito, se desiderato).

---

## Funzionalità di sicurezza incluse nel template

Il template include una pipeline di sicurezza pre-cablata. I progetti che derivano da Br1WebEngine la ereditano automaticamente: gli interruttori stanno in `global-settings.json` (`Features`), i segreti in `global-settings.local.json`.

### Backend

- **API Key** obbligatoria su tutti gli endpoint tranne `/health`
- **JWT** opzionale: attivato da `Features.Login`/`PublicLogin` in `global-settings.json`, con `Security.Token.SecretKey` come requisito; login spento, nessun middleware viene caricato. Le credenziali demo di `AccountService` sono rifiutate in ogni ambiente diverso da Development
- **CORS** con origini configurabili
- **Rate limiting** (default, configurabile in `Security.ApiConfig.RateLimiting`): 500 chiamate/min globali per IP, 5/min sull'endpoint di login
- **Gestione errori strutturata**: le eccezioni escono come ProblemDetails RFC 9457, senza stack trace
- **Upload senza posizione**: `POST /blob/up` e `PUT /blob/{slug}` tolgono da JPEG, PNG e WebP i metadati di posizione (GPS dell'EXIF, XMP, IPTC, dati in coda al file) senza ricodificare i pixel; un file di quei formati con struttura illeggibile è rifiutato (400) e non viene salvato. Il resto dell'EXIF (seriale del dispositivo, data di scatto) resta; HEIC, AVIF, TIFF e gli altri formati passano invariati
- **Security headers** applicati anche dal backend quando esposto (`backend.public`): legge gli stessi header del frontend (da `security-headers.json`) e li applica a tutte le risposte, così l'esposizione diretta è sicura a prescindere dal reverse proxy. Salta `Content-Security-Policy` (serve JSON e nient'altro, e sul JSON la CSP non ha effetto nel browser)

> Gli header di sicurezza rivolti al browser sono definiti **una volta** in `security-headers.json` (file del template, uguale per ogni progetto, che il figlio non gestisce) e condivisi dai due layer. Nel default il backend è interno alla rete Docker e parla col Node SSR e con nessun altro: è il frontend a proteggere il browser; ma se esponi il backend, anche lui applica gli stessi header.

### Frontend

- **Security headers** applicati dal Node SSR su ogni risposta (è il layer rivolto al browser), letti da `security-headers.json`: `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` restrittiva e **CSP con nonce per-request** sull'HTML in produzione (il placeholder `{NONCE_PLACEHOLDER}` viene sostituito a ogni risposta in `script-src` e `style-src-elem`; `style-src-attr` resta su `'unsafe-inline'`, necessario ai binding `[style.x]` di Angular). Il Node SSR verifica lo sha256 di `security-headers.json` all'avvio e non parte se il file è stato modificato a mano; le estensioni passano da `security-headers.override.json`
- **XSS nel Markdown**: qualsiasi HTML raw nel sorgente viene ignorato dal renderer
- **Path traversal** bloccato nel serving dei file (`/api/blob/{slug}`, `/assets/legal/*`)
- **JSON-LD**: i dati strutturati sono generati lato server da campi controllati — nessun input utente raggiunge il blocco `<script>`
- **Tag lingua**: `Localization` in `global-settings.json` è normalizzata al build con `Intl.Locale`: un tag malformato viene scartato, e senza tag validi resta la lingua di default

---

## Checklist per il deploy in produzione

Prima di esporre un progetto derivato da questo template:

- Usa HTTPS (reverse proxy: Nginx, Caddy, Traefik o il proxy del provider)
- Imposta `Security.ApiConfig.Keys` con chiavi robuste — non usare quelle di esempio
- Con il login acceso (`Features.Login`/`PublicLogin`), `Security.Token.SecretKey` deve avere almeno 32 byte UTF-8, niente spazi o a capo ai bordi, e non essere il segnaposto dell'esempio (`openssl rand -base64 48`); altrimenti il backend non si avvia e il deploy si ferma. Con il login spento resta inerte
- Abilita `Security.BehindProxy: true` se stai usando un reverse proxy (necessario per il rate limiting per IP reale)
- Configura `Security.CorsOrigins` con i domini del tuo frontend
- Aggiorna le dipendenze regolarmente: `npm audit`, `dotnet list package --outdated --vulnerable`

---

## Versioni supportate

| Versione | Supporto |
|---|---|
| Latest (`main`) | Sì |
| Versioni precedenti | Best effort |

---

## Dipendenze principali

- **Angular 21** — aggiornato regolarmente
- **ASP.NET Core 9** — supporto LTS
- **Bootstrap 5** — stabile

Le versioni esatte si trovano in `package.json` e nel file `.csproj` del backend.
