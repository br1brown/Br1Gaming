# Changelog

Cosa cambia nel template tra una versione e l'altra. Per un figlio: cosa aspettarsi al merge dal template.

### Modali: cambio pagina, focus e chiusura durante l'apertura

Emersi provando le modali di Agnese (libreria immagini, selettore foto) su casi reali.

- **La modale si chiude a `NavigationEnd`, non più a `NavigationStart`**: il guard delle modifiche non salvate può ancora annullare la navigazione, e ora chiede dentro la modale aperta. Prima la modale spariva subito, e con "Annulla" il suo contenuto era già perso.
- **Chiusura durante l'apertura**: Bootstrap ignora `hide()` finché la modale non ha finito di aprirsi; un cambio pagina (o `close()`) in quella finestra la lasciava aperta sulla pagina nuova, senza più modo di chiuderla. Ora si chiude appena aperta.
- **`initialFocus: 'none'`**: a fine apertura Bootstrap sposta il focus sulla modale, togliendolo al contenuto; ora torna dove il contenuto l'aveva messo, o sul suo `[autofocus]` se ci aveva provato a modale ancora nascosta.
- **Focus dopo un popup SweetAlert in una modale**: se alla chiusura il focus da restituire manca (dopo un clic resta su `<body>`), torna alla modale, così Escape la chiude ancora.

**Al merge**: nessuno. Chi usa `initialFocus: 'none'` può mettere `autofocus` sull'elemento che deve ricevere il focus.

### Muro senza ombre fra le barre, SweetAlert dentro le modali, ciclo di import in dev

- **Navbar e footer senza ombra su `navbar.superficie: 'body'`**: nuovi token `--shadowNavbar`/`--shadowFooter` (da `elevazione`), `none` quando le barre stanno sulla superficie della pagina — su Muro navbar, contenuto e footer sono un'unica superficie. `--shadowBarDown`/`--shadowBarUp` restano per le fasce sopra il contenuto (cookie, offline).
- **SweetAlert dentro una modale Bootstrap**: `confirm`/`choose`/`toast`/… chiamati da un contenuto di `notify.modal` montano il popup dentro la modale aperta (`target`), così il focus trap di Bootstrap non gli strappa il focus. Escape su un toast chiude solo il toast; chiuso, il toast ridà il focus a dove era prima.
- **Durata delle modali da `movimento`**: fade e ingresso di `.modal`/`.modal-backdrop` seguono `--movimentoPannello` (con `fermo` aprono e chiudono subito); `prefers-reduced-motion` resta di Bootstrap. Il lightbox perde la sua animazione d'ingresso: usa quella della modale.
- **`FooterField` in `footer-field.ts`** (modulo foglia, riesportato da `footer-content.ts`): `legal-pages.ts` lo legge al caricamento e, dentro il ciclo `footer-content → icon → appearance.service → site.ts → siteBuilder → legal-pages`, nel dev server SSR di Vite lo trovava `undefined` (ogni pagina in 500). `circular-deps.mjs` ora simula il caricamento anche partendo da ogni modulo, non solo da `main.ts`/`main.server.ts`: questo ciclo lo avrebbe segnalato.

**Al merge**: nessuno. Chi importa `FooterField` da `footer-content` continua a funzionare.

### Primitive che i figli riscrivevano: dialog, modifiche non salvate, tempo relativo, meno movimento, mappe, sollevamento, lingua della voce

Ricognizione sui tre progetti derivati: dieci cose che ciascuno aveva riscritto per sé (spesso due volte nello stesso progetto) perché l'Engine non le esponeva. Ora le espone, e i figli le delegano.

- **`NotificationService.modal(componente | ng-template, { returnFocusTo, inputs, canClose, escape, ariaLabel, dialogClass, bare, initialFocus })`**: modale che ospita un componente, sulla Modal di Bootstrap (focus trap, Escape, click fuori, scroll bloccato, accessibilità della libreria), montata sul `body`. `canClose` la tiene aperta se l'utente annulla; `afterClosed` risolve alla chiusura, anche per cambio pagina. Sta in `NotificationService` perché tutto ciò che è dialogico passa da lì senza che il chiamante sappia la libreria: SweetAlert mostra un solo popup alla volta, quindi un contenuto che a sua volta chiama `confirm` o `toast` va in una modale Bootstrap. `ImageLightboxService` ora ci si appoggia; `Overlay.create()` scritto a mano non serve più a nessuno.
- **`LeaveGuardService`** (nuovo, `core/engine/services/leave-guard.service.ts`) + **`leaveGuard`** (`canDeactivate` su ogni rotta foglia, in `routing.ts`): un editor si registra con `{ dirty, confirm }` e qualunque navigazione che lascia la pagina — link della navbar compresi, irraggiungibili da un guard di Dominio — e la chiusura della scheda (`beforeunload`) chiedono prima cosa fare. Senza registrati non costa nulla.
- **`LocaleFormatter.relativeTime(data, now?)`**: "2 ore fa" / "ieri" / "in 3 giorni" / "adesso" da `Intl.RelativeTimeFormat` nel locale corrente, invece delle stringhe italiane a mano.
- **`injectPrefersReducedMotion()`** (`breakpoints.ts`): la preferenza "meno movimento" come signal aggiornato al cambio, `false` in SSR — per chi anima in JS; per il CSS resta la media query.
- **`ContactUrl.maps(query)`**: ricerca Google Maps di un indirizzo, stesso formato che ogni figlio ricopiava.
- **`.lift-on-hover`** (`_utilities.scss`): sollevamento di una card/tile cliccabile — focus-visible sempre, hover solo con puntatore (`hover: hover`, niente stato "incollato" su touch), fermo con "meno movimento", ombra e durata dal design system. Sostituisce sette copie di `:hover { transform: translateY(...) }` nei figli.
- **`SpeechService.speak(text, { lang })`** e input `lang` su `app-speech-action`: un testo in lingua straniera si legge con la sua voce (`es-ES`), senza un servizio TTS parallelo nel progetto.
- **`detectSocialKey`** esportata da `social-link.component.ts`: chi riconosce una piattaforma da un URL usa i pattern dell'Engine, non una copia. **Spreaker** in `SOCIAL_MAP` (`fa-podcast`, giallo del logo).
- Pagina d'errore: via dallo switch i casi 401/403/404 che mappavano su se stessi (la coppia `errore{codice}Titolo/Descrizione` di default è già quella); restano solo offline e 502/503/504, gli unici che deviano dallo schema.

**Al merge**: additivo. `ImageLightboxOverlayComponent` non ha più `focusClose()`/`closeBtn`/`cdkTrapFocus` (focus e trap li dà la modale): solo chi lo montava da sé, fuori da `ImageLightboxService`, deve adeguarsi. Chi ospita un componente in una modale con `notify.modal` toglie `role="dialog"`/`aria-modal`/`cdkTrapFocus` dal proprio markup: li porta la modale.

### Navbar: aggancio sticky con soglia, chiusura di dropdown/menu condivisa, menu mobile `inert`

La navbar `fissa` restava `position: fixed` anche quando cresceva (zoom alto, più righe): sempre sopra il contenuto, arrivando a coprirlo — un problema di leggibilità (WCAG 1.4.10 reflow, 2.4.11 focus non ostruito), non solo estetico. La chiusura di dropdown e menu mobile duplicava inoltre lo stesso listener (`document:click`/`document:keydown.escape`) in più componenti, senza gestire la sovrapposizione: un dropdown aperto dentro il menu mobile, Escape doveva chiudere solo lui, non tutto insieme.

- **Sticky con soglia**: `navbar.fissa` (nome invariato) usa ora `position: sticky`, non più `fixed-top`; oltre `MAX_STICKY_VIEWPORT_SHARE` (20% dell'altezza visibile) la barra torna nel flusso invece di continuare a coprire il contenuto sottostante.
- **`injectDismiss`** (nuovo, `core/engine/dismiss.ts`): pila di pannelli per `Document`, un solo listener `keydown`/`click` condiviso invece di uno per componente. Escape chiude solo il pannello più in cima alla pila — un dropdown dentro il menu mobile si chiude da solo, il menu resta aperto — e ridà il focus al trigger (`preventScroll`, con uno `scrollIntoView` solo se il trigger è davvero fuori schermo). Sostituisce i listener scritti a mano in navbar e nel campanello notifiche.
- **`NavMenuState`** (nuovo, provider component-scoped su `NavbarComponent`): un contatore che richiude gli accordion `nav-submenu` annidati quando la navbar chiude tutto; consumato con `{ optional: true }`, un submenu fuori da una navbar continua a funzionare da solo.
- Il menu mobile aperto rende `inert` i fratelli dello shell (contenuto pagina, footer) e sposta il focus sulla prima voce: prima il focus restava raggiungibile dietro l'overlay.
- `<header>` semantico introdotto attorno a `<nav>`. L'overflow "Altro" ora sottrae il padding reale di `.shell-line` invece di un valore stimato.

**Al merge**: nessuno, `navbar.fissa` ha lo stesso nome e lo stesso significato di prima.

### Nuovi componenti di stato: caricamento, vuoto, avanzamento pagina, offline

Quattro situazioni ricorrenti (un'azione in corso, una lista vuota, una navigazione lenta, la rete che cade) avevano ciascuna un markup scritto a mano in ogni punto che le incontrava — o, per la navigazione lenta, nessun segnale affatto: con `contentLoader` risolto prima del cambio pagina, un clic su una rotta con un'API lenta non dava alcun feedback finché la nuova pagina non appariva di colpo.

- **`BusyIconComponent`** (`core/engine/components/busy-icon/`): stesso box fisso per il glifo e lo spinner (`[busy]`), evita il riflusso quando i due si alternano. Riusato dagli otto componenti azione (copy/share/speech/download/print/pdf/like) più login-form e upload-form, al posto di un `@if(loading){spinner}@else{icona}` ripetuto in ognuno.
- **`EmptyStateComponent`** (`core/engine/components/empty-state/`): icona+titolo+testo+azione proiettata, `role="status"`, variante compatta per contesti stretti (es. dentro un dropdown) — applica la regola "mai un'area bianca" già in AGENTS.md al caso, prima scoperto, della lista vuota.
- **`NavProgressComponent`** (nuovo, montato in `app.component.html`): barra di avanzamento sottile durante la navigazione, soglia 150ms (una navigazione più rapida non la mostra, niente flicker), `aria-busy` su `<main>`, rispetta `prefers-reduced-motion`, gestisce `NavigationCancel`/`NavigationError`.
- **`OfflineBannerComponent`** (nuovo, montato in `app.component.html`): fascia "Sei offline"/"Connessione ripristinata" dagli eventi browser `online`/`offline`, sempre presente nel DOM con `role="status"` (l'annuncio allo screen reader non dipende dal momento in cui compare), icona+testo — mai il solo colore (WCAG 1.4.1). Scrive `--bottomBarOffset` per non far finire back-to-top e il pulsante di riapertura cookie sotto la fascia.
- Offline (l'utente non ha rete) e backend irraggiungibile (voce sotto sulla pagina di errore) restano distinti: l'interceptor HTTP non mostra più una modale ridondante quando uno dei due lo dice già da sé.

**Al merge**: additivo, nessuna azione richiesta.

### Pagina di errore: offline, servizio non disponibile, e un "Riprova" vero

La pagina d'errore era generica (un solo messaggio per qualunque codice) e non distingueva "non c'è rete" da "il backend è giù": due situazioni con causa e rimedio diversi meritano un testo diverso, e la seconda un modo per ritentare senza ricaricare la pagina intera a mano.

- `ErrorComponent` (`pages/error/`) distingue ora `offline` (status 0, `navigator.onLine === false`) da `502`/`503`/`504` ("servizio non disponibile", stesso messaggio per i tre: per l'utente è un caso solo, non "gateway non valido" — coerente con `overrideKeysFor` dell'interceptor). Bottone "Riprova" che rilancia il resolver della rotta originale, letta da un query param `retry` validato (deve iniziare per `/`, non `//`: niente redirect fuori sito via query param manomesso).
- La lingua della rotta d'errore (che non è per-lingua, quindi senza `route.data.lang`) si deduce dal primo segmento dell'URL.
- Nuove chiavi i18n `erroreOffline*`/`erroreIrraggiungibile*`/`erroreServizio*`/`riprovaAzione` in `basic.*.json`.
- **`SsrBackendUnconfiguredError`** (nuova sottoclasse di `ApiError`, `base-api.service.ts`): un SSR senza `BACKEND_ORIGIN` configurato (CI, `ng serve` senza backend) lanciava un `ApiError(0, ...)` indistinguibile da un vero errore di rete — i resolver lo trattavano come "servizio non disponibile" e redirigevano a `/error/offline` anche quando non c'era nessun problema di disponibilità reale, solo un ambiente senza backend. Ora è un caso a parte, escluso esplicitamente da `content.resolver.ts`.
- **`proxy.gateway-error.cjs`** (nuovo, dev): con backend spento o lento, il proxy di `ng serve` rispondeva 500 generico di Vite; ora risponde 502/504 con lo stesso schema del proxy SSR di produzione — la pagina d'errore vista in sviluppo è la stessa vista dall'utente reale.

**Al merge**: nessuno.

### Scadenza della sessione: un avviso, non un silenzio

`TokenService` scartava il token scaduto senza dirlo a nessuno: una pagina `requiresAuth` restava con contenuto vecchio in vista finché l'utente non ci cliccava sopra e scopriva il redirect al login.

- **`SessionExpiryNoticeService`** (nuovo, attivato una volta nell'app initializer): un toast 2 minuti prima della scadenza (nessun avviso se la vita residua è già sotto quella soglia: un token di sviluppo breve, o una sessione ripristinata all'ultimo, non lo mostra), un secondo toast alla scadenza effettiva con lo stesso redirect al login già usato dal guard (`returnPageType`/`reason: 'auth'`), così il login riporta alla pagina di partenza. Un logout volontario (token tolto prima della scadenza) non genera nulla.
- Nuove chiavi `sessioneScadeTraAvviso`/`sessioneScadutaAvviso`.

**Al merge**: additivo.

### Form: errore visibile solo dopo il tocco, segnaposto per un'immagine rotta

- **`FieldErrorDirective`** (nuova, `[appFieldError]`): collega `.is-invalid`/`aria-invalid`/`aria-describedby` allo stato reale del controllo (`NgControl`), visibile solo quando il campo è stato toccato o il form inviato (WCAG 3.3.1/4.1.2) — prima ogni form gestiva `[class.is-invalid]` a mano, con lo stesso rischio di mostrare un errore su un campo appena apparso. `login-form.component.html` adottata come primo consumer.
- **`ImgFallbackDirective`** (nuova, `img[appImgFallback]`): su un `<img src>` diretto, un fallimento di carico mostra un segnaposto (SVG inline, `data:` — non può fallire a sua volta) invece dell'icona rotta del browser; niente segnaposto su un'immagine decorativa (`alt=""`), stessa regola di `AssetDirective`.
- `UploadFormComponent`: lista dei file scelti (nome+peso, scrollabile oltre 6), errore di campo distinto da errore di form, dropzone ora un `<label>` (click, tastiera, drag: WCAG 2.5.7, tre vie di attivazione).
- `LinkBadgeComponent`: `target="_blank"` ora solo per un vero link `http(s)` — prima ogni badge apriva in nuova scheda anche per `mailto:`/`tel:`, falso ("si apre in una nuova scheda" non era vero per quei link).

**Al merge**: additivo.

### Icone social: pastiglie fedeli alle linee guida dei brand

Ogni pastiglia social era monocolore (sfondo = colore brand, glifo bianco o nero per contrasto): per diversi brand è visivamente sbagliato rispetto alle linee guida ufficiali (es. il sorriso di Amazon non va su arancio pieno, la "G" di Google è vietata in un colore diverso dall'originale).

- `SOCIAL_MAP` (`social-link.component.ts`) passa da `{icon, color}` a `{icon, color, fg, mode, image}`, con la fonte (e la data di verifica) annotata voce per voce. `mode: 'disc'` per i loghi già "disco col marchio ritagliato" (Telegram, Spotify, GitHub, Skype: in `glyph` risulterebbero in negativo); `image` per un logo che va sempre a colori (Google). `IconComponent`/`LinkBadgeComponent` guadagnano `mode`/`image` (additivi) per propagare la stessa composizione.
- Nuova `brandColors()` esportata, riusata da `whatsapp-contact`/`telegram-contact` per non duplicare i colori brand.
- **Fix**: `IconComponent` e `LinkBadgeComponent` calcolavano ciascuno per sé "quale testo è leggibile su questo sfondo", con due regex diverse — quella di `LinkBadgeComponent` accettava solo l'hex a 6 cifre, non a 3, fallendo in silenzio (nessun calcolo di contrasto) su un colore corto. Unificato in `readableForegroundColor` (esportata da `icon.component.ts`), usata da entrambi.

**Al merge**: additivo, nessun rename di input esistenti.

### Tema: densità regolabile, ombra delle barre agganciate, contrasto rinforzato

- **Nuovo asse `densita`** (`'compatta' | 'normale' | 'ariosa'`, default `'normale'`, gruppo `aspetto` del design system): governa il respiro di `<main>`, `.content-panel`, `.shell-line` — prima fisso.
- **`elevazione` estesa** con `ombraBarraGiu`/`ombraBarraSu` (→ `--shadowBarDown`/`--shadowBarUp`): le barre agganciate a un bordo (navbar sotto, footer/fasce in fondo sopra) derivano l'ombra dallo stesso asse delle superfici sollevate, non più un valore fisso.
- **Contrasto**: `--bs-form-invalid-color`/`--bs-form-valid-color` mappati sull'emphasis (il pieno danger/success scende sotto 4.5:1 come testo); nuove regole `forced-colors: active` per bordi/contorni dove badge/FAB/superfici elevate perdono il confine quando Windows high-contrast azzera sfondi e ombre; gating `(hover: hover)` su `.fab:hover`/`.shake-on-hover`/`.zoom-on-hover` per non lasciare lo stato hover "incollato" su touch.
- **Fallback font metric-matched** (CLS): `@font-face` locale con `ascent/descent/line-gap-override`/`size-adjust` calcolati dai font reali installati, `null` (nessun fallback scritto) se non calcolabile — comportamento invariato in quel caso.
- Token derivati direttamente da Bootstrap (`--space-*`, `--fs-sm`, `--z-navbar`/`--z-cookie-banner`/`--z-mobile-nav-overlay`) invece di essere ricopiati a mano in `_tokens.scss`: elimina un rischio di divergenza reale, non solo teorico.
- Preload della faccia regolare del font principale (`<link rel="preload" as="font">`, generato/rigenerato a ogni build): anticipa il FOUT di `font-display: swap`.
- **Fix**: il fallback CSS di `box-shadow` sul dropdown navbar (`var(--shadowElevated, ...)`) non corrispondeva più al default effettivo — si vedeva solo se il custom property fosse mancato.
- **Fix**: `--larghezzaColonne` (rientro del pannello contenuti) si derivava con una regex sulla stringa di classi Bootstrap (`offset-lg-N`), con fallback silenzioso a `0` se il pattern non avesse combaciato — in contrasto con la regola "una chiave sbagliata ferma il build" applicata altrove nello stesso file. Sostituito con un campo esplicito, `CONTENT_WIDTH_OFFSET_LG`.

**Al merge**: additivo.

### Piccole correzioni

- **Footer, doppio rimpicciolimento**: la riga "small print" (copyright + tagline) fissava `--fs-xs` (12px) sul contenitore E portava anche la classe Bootstrap `small` (0.875em, relativa) sui singoli paragrafi — le due si moltiplicavano a 10.5px. Tolto il `small` ridondante.
- **Falso allarme i18n**: `ShellNavService` calcola il testo di default del footer chiamando `translate()` prima che `setInitialLanguage()` carichi il primo catalogo (ordine dell'app initializer) — ogni chiave, in quell'istante, risultava "non trovata" e finiva loggata come tale a ogni avvio. `TranslateService.translate()` non avvisa più se il catalogo è ancora vuoto, solo se una chiave manca da un catalogo davvero caricato.
- **API deprecata**: `api-error.interceptor.ts` usava `router.getCurrentNavigation()`, deprecato dalla 20.2 (il repo è su Angular 21.2) in favore del signal `currentNavigation` — stessa identica semantica (non-null durante la navigazione, null da idle).

**Al merge**: nessuno.

### Audit dell'Engine intero: API key sempre richiesta, DoS a basso costo chiusi, cookie di terzi, deploy e release

Correzioni da una revisione completa (backend, server SSR, runtime Angular, scaffold), eseguita e non solo letta. Nessuna funzione nuova.

**Backend**
- **`RequireLogin` esige davvero API key e JWT**: la policy richiede il claim `ApiKeyValidated` di `ApiKeyHandler`; prima un Bearer da solo passava su upload, delete e `/me/data` (ASP.NET fonde i principal e "autenticato" valeva con uno dei due schemi). Senza `X-Api-Key` ora 403.
- **`BehindProxy` fida anche loopback**: nginx sulla stessa macchina (`127.0.0.1`) non finiva nelle reti fidate e il rate limiter metteva tutti i visitatori in un bucket solo.
- **`?webopt=true` con tetto di concorrenza** (una decodifica per core): il limite sui megapixel proteggeva la singola richiesta, non la somma; quattro richieste parallele su un PNG da 36 MP portavano il processo a 900 MB.
- **Segnalazioni d'errore su coda propria** (`ErrorReportQueue` + `ErrorReportDispatcher`, 256 voci, 4 invii paralleli, drop della più vecchia): prima condividevano l'unico worker seriale con import, consegne ed email, e un webhook lento più tre `ui-fault` ritardavano tutto di quindici secondi. Payload dal browser troncato (`message` 1000, `exceptionType` 200) e `path` accettato solo relativo.
- **Blob**: estensione dell'upload validata (1–16 alfanumerici, altrimenti 400: prima una da 300 caratteri dava un 500 col path assoluto nel report); `PUT` su slug inesistente → 404 (prima creava un blob nuovo con 200); copia interrotta → file parziale rimosso. Header di sicurezza applicati anche ai 429 (il blocco sta ora prima del rate limiter); CORS ammette `X-Connection-Id`.
- **Pacchetti**: EF Core Sqlite/Design 9.0.20 (la 9.0.9 portava `SQLitePCLRaw` con avviso High), JwtBearer 9.0.20, SkiaSharp 3.119.4. `dotnet list package --vulnerable` pulito.

**Server SSR**
- `/cdn-cgi/asset`: l'`id` entra nel nome del file di cache solo se innocuo, altrimenti il suo hash (come og-preview), più guardia che il file resti in `cacheDir`; `id` non stringa → 400. La mappa degli asset è senza prototipo (`constructor`/`__proto__` davano 500).
- Proxy `/api`: se il backend cade a header già inviati la risposta al client viene chiusa (prima restava appesa fino al suo timeout); gli stream SSE non subiscono `PROXY_TIMEOUT_MS`, che è un timeout di inattività.
- L'host canonico di `FRONTEND_BASE_URL` entra sempre in `allowedHosts`: con `www.` nel base URL e `frontend.hostname` senza, ogni richiesta finiva 301 → 421.
- `TRUST_PROXY` interpretato (`true`/`false`, numero, lista): la stringa `true` faceva lanciare Express all'avvio, con exit code 0.
- og:image: il fallback sulla favicon esce `no-store` (prima `immutable` per un anno: un errore transitorio faceva cachare ai crawler la favicon come anteprima).
- `@angular/*` 21.2.24 (`platform-server` 21.2.20 aveva un avviso High: XSS in SSR e SSRF). `npm audit` pulito.

**Runtime Angular**
- `NotificationService` passa titoli e messaggi a SweetAlert2 come testo (`titleText`/`text`), non come HTML: un `message` di notifica o un `detail` del backend non può più iniettare markup nei toast e nelle modali.
- Cookie di terza parte (`provider` valorizzato): nome fisico = nome reale (`_ga`), non `analytics__ga`; la Cookie Policy elencava un cookie inesistente e la revoca cancellava quello sbagliato. La cancellazione prova anche i `Domain` del sito e dei suoi genitori (best-effort: il gate resta non caricare l'SDK prima del consenso).
- Un 401 su una chiamata con `Authorization` cancella il token nel client: dopo la revoca lato server (`DELETE /me/data`, logout con effetto sul server) navbar e guard non restano convinti di una sessione che non c'è più.
- `requiresAuth` su una pagina contenitore vale per i figli (SSR spento, fuori sitemap, noindex): prima il guard c'era ma i figli restavano server-rendered e indicizzabili.
- Upload: l'`<input type="file">` è `visually-hidden`, non `d-none`: raggiungibile da tastiera. Meta `robots` di una pagina indicizzabile ripristinato al valore di `index.html` invece di rimosso.
- `notify.interact` tolto dal README: non esiste. `core/services/cookie-registry.ts` e `pages/error/error.component.ts` aggiunti ai file a contratto fisso: l'Engine li importa per path.

**Scaffold, deploy, release**
- I guard del deploy rifiutano i segnaposto dell'example (`INCOLLA-QUI-…` in API key, `SecretKey`, `Mail.Password`; `frontend.hostname` `miodominio.it`/`example.com`): la API key dell'example è lunga 34 caratteri e passava il minimo di 32. La chiave troppo corta non viene più stampata nel messaggio. Un `security-headers.override.json` che è una directory (bind mount su file assente) ferma il deploy.
- Il bundle di release porta anche `security-headers.override.json`, `scripts/backup.sh` e `hosting-info.example.json`; la release parte solo se «Controlli Automatici di Tutto» è verde sul commit del tag (`actions: read`).
- `docker compose up --build -d` "a mano" non è mai stato equivalente a `deploy.sh` (il compose non fonde il `.local`): QUICKSTART e DOCKER_README lo dicono.
- `identity.json` demo neutra (Esempio S.r.l., `info@esempio.it`) al posto del testo volgare, e il pre-lancio avvisa finché è quella.
- `.gitattributes merge=ours` funziona solo con `git config merge.ours.driver true`: lo imposta `setup.mjs` e lo dice QUICKSTART. `setup.mjs` non si auto-cancella più (ogni merge dal template che lo toccava andava in conflitto modify/delete) ed è idempotente: a eject fatto non fa nulla.
- La sezione «Template vivo» (nascita, merge, chi possiede cosa, contratto fisso) è in AGENTS.md, che nel figlio resta; il README, che l'eject toglie, rimanda lì. `i18n-check` descritto per quel che fa (simmetria fra lingue).

**Al merge**: un client che chiamava gli endpoint protetti col solo Bearer deve mandare anche `X-Api-Key` (il frontend del template lo fa già via proxy). Chi ha `TRUST_PROXY=true` in ambiente ora ottiene il booleano. Un figlio con `setup.mjs` già cancellato dall'eject lo riprende dal template al merge (modify/delete: `git checkout template/main -- setup.mjs`), e da lì il conflitto non si ripresenta. Chi aveva registrato cookie di terza parte con `provider` vede il nome reale in Cookie Policy. `IErrorReportingService` non cambia; chi accodava segnalazioni proprie su `BackgroundQueue` può passare a `ErrorReportQueue`.

### Revisione del tema compilato e della conformità legale: revoca della sessione, fatti legali ridotti, palette degenerata, `.local` generato in sviluppo

Correzioni alle criticità emerse rivedendo la release precedente. Nessuna nuova funzione: chiusure di ciò che era promesso a metà.

- **`DELETE /me/data` revoca la sessione** (`Engine/Security/SessionRevocation.cs`). Prima il JWT restava valido fino a scadenza e il CHANGELOG delegava al client lo scarto del token: un upload con il vecchio token registrava di nuovo l'id reale. Ora, dopo `EraseAsync`, ogni token della stessa sessione (claim `session`) emesso prima (claim `loginTime`, scritto da `AuthService`) è respinto con `401` dal middleware JWT (`JwtBearerEvents.OnTokenValidated`). Interfaccia `ISessionRevocation`, default `MemorySessionRevocation` registrato con `TryAddSingleton` (`IMemoryCache`, una voce per la durata di un token, `Security.Token.ExpirationSeconds`): vive nel backend, quindi vale con frontend su un altro server e dietro reverse proxy; un riavvio lo perde e due istanze del backend non si vedono, lì un progetto registra la propria implementazione in `Program.cs`, come per `IIdentityStore`. Il payload di sessione deve restare deterministico per utente: è già il contratto (solo dati identificativi) e ora è anche la chiave della revoca.
- **`GET /me/data` esporta anche lo storico**: `{ "data": { "upload": [...], "storico": [{ "slug", "caricato", "caricatoIl", "cancellatoIl", "cancellato" }] } }`. Prima solo gli slug ancora presenti, mentre la `DELETE` anonimizzava anche chi aveva caricato e cancellato cosa e quando: ciò che si considera dato personale da cancellare si deve poter esportare (art. 15). Nuovo `BlobOwnershipRegistry.GetHistoryAsync` e record `BlobHistoryEntry`.
- **Fatti legali ridotti a ciò che l'informativa scrive** (`LegalFacts`, `computeLegalFacts`): `/internal/legal-facts` e il `TransferState` di ogni pagina rispondevano con `limiteRichieste.attivo` (cioè "il rate limiting è spento", che il testo non dice mai), la finestra dei login anche a login spento e i campi dei log applicativi che il testo non usa. Ora `limiteRichiesteSecondi` è un solo numero (la finestra più lunga, quella dei login solo col login acceso) o `null` se spento, e dei log applicativi restano tipo e conservazione. `renderNavigationData(facts, t, lang)` perde il parametro `loginAttivo` (già deciso lato server). Corretta anche la frase "IP reso anonimo": ora vale se lo è in ogni log che l'IP lo salva, non in ogni log.
- **Palette degenerata ferma il build** (`paletteDegenerata` in `scripts/build/theme-scss.ts`, usata da `generate:statics`): con superfici `fusione` (o `sfondo`/`vividezza` alti) e un brand a luminanza media le cinque superfici collassavano su un colore solo e testo, link e fill del primario finivano tutti sul bianco o sul nero, con una ventina di `console.warn` e nessun errore. Ora il build si ferma con un errore che nomina brand e superfici; i ripieghi di contrasto residui escono in una riga aggregata invece che uno per token. `site.colorTema` è validato prima di calcolare la palette (prima un valore non esadecimale produceva `#NaNNaNNaN` in `_theme.scss` e un errore Sass senza spiegazione). Testo del CHANGELOG precedente e del README corretto: 4.8:1 è l'obiettivo, 4.5:1 (AA) la garanzia nei ripieghi.
- **`npm test` a mano** ha il pre-hook `pretest` (`generate:statics`): su un checkout pulito mancava `generated/_theme.scss` e Sass falliva.
- **`global-settings.local.json` generato da sé in sviluppo**: su un clone fresco `cd backend && dotnet run` si fermava, perché il template ha `Features.PublicLogin` acceso per la demo e senza `SecretKey` il login non parte; il proxy del dev server, a sua volta, vuole la API key. Ora, nella copia di sviluppo del repository (file base nella root, non nel container), il primo che parte fra `generate:statics` (`scripts/config/local-settings.ts`) e il backend in Development (`Engine/LocalSettingsFile.cs`) scrive il file con le stesse chiavi generate di `setup.mjs`, e l'altro lo trova. In Docker e negli altri ambienti niente cambia: il file non si crea e un login acceso senza `SecretKey` ferma l'avvio come prima.
- `global-settings.types.ts` rigenerato dallo schema (solo il commento di `SecretKey`, la CI lo segnalava).

**Al merge**: `AppPersonalDataStore.ExportAsync` e `BlobOwnershipRegistry` (Dominio) cambiano nel template: chi li ha personalizzati riprende `GetHistoryAsync` e la chiave `storico` se vuole l'export completo, altrimenti tiene i suoi. Codice di progetto che leggeva `LegalFacts.limiteRichieste` o chiamava `renderNavigationData` con quattro argomenti si adegua. Un design system che oggi produce la raffica di avvisi sulla palette ora ferma `generate:statics`: cambia brand o superfici come dice il messaggio.

### Tema compilato in build: Bootstrap da sorgente, contrasto garantito per tono

Prima i colori arrivavano a runtime: `AppearanceService.buildThemeStyleTag()` iniettava un `<style id="theme-init">` con le variabili dei due toni e l'Engine ridichiarava a mano parte delle variabili di Bootstrap (bottoni, hover, subtle). Ora il tema è compilato in build e a runtime non si scrive CSS di colore.

- `npm run generate:statics` (pre-hook di `start`, `start:docker`, `dev`, `build` e ora anche `watch`) calcola la palette da `site.colorTema` e dal design system attivo e scrive `src/styles/engine/generated/_theme.scss` (solo dati Sass, gitignored). `src/styles/engine/bootstrap.scss` compila Bootstrap 5.3 da sorgente con quei valori; `angular.json` carica quel file al posto di `bootstrap.min.css`.
- L'Engine calcola solo gli input che Bootstrap si aspetta già validi (primary, link, testo, titoli, superfici, bordo, navbar), tarati WCAG sulle superfici reali; Bootstrap deriva il resto (subtle/emphasis, hover/active dei bottoni, testo sopra i fill con `color-contrast`, focus, stati attivi).
- Una chiave mancante in `_theme.scss` ferma Sass con un errore esplicito (`lib.required`), mai un ripiego sul blu di Bootstrap; se il file manca del tutto, l'errore indica `npm run generate:statics`.
- Il tono è solo l'attributo `data-bs-theme` (su `<html>` e sul pannello, da `tono.pannello`). I token sono emessi dentro `[data-bs-theme="light"]`/`[data-bs-theme="dark"]`: un sottoalbero col proprio tono (pannello chiaro in pagina scura) riceve i suoi valori, compresi focus ring, immagini di checkbox/radio/switch e cursore del range. Gli overlay CDK (menu contestuale, lightbox) prendono il tono della pagina, non quello del pannello.
- `bootstrap` fissato a `~5.3.3` (era `^5.3.3`): la compilazione da sorgente dipende dai nomi interni di Bootstrap.
- CI: `generate:statics` gira prima di lint, tipi e test; `tsc-check.sh` e `theme-check.sh` lo lanciano da sé.
- **Garanzie di contrasto (WCAG 2.1)**:
  - testo, titoli, link, testo secondario e `--colorPrimaryFg` (≥4.8:1) tarati su tutte e cinque le superfici del tono (base, card, surface-hover, muted, subtle/tertiary); bordo della superficie ≥3:1. Con superfici così vivide che nessun colore reggerebbe su tutte, lo scarto fra le superfici si riduce fino a farle coincidere;
  - `*-text-emphasis` di ogni colore di tema regge 4.5:1 sul proprio subtle e su tutte le superfici (ripiego su nero o bianco; se neanche quello basta, `@warn` in build con colore e tono);
  - polarità reale per tono: con superfici vivide il tono "scuro" di un brand chiaro ha fondo chiaro e usa le derivazioni per fondo chiaro, compresi bordo traslucido (cornice del pannello, dropdown, modali) e hover dei link;
  - testo navbar ≥4.5:1 sullo sfondo navbar; il bordo navbar è decorativo;
  - success/info/warning/danger come testo usano la variante emphasis (`.text-info` sul bianco faceva 1.6:1); i bordi `.border-success/-info/-warning/-danger` restano il colore pieno;
  - stampa: testo, titoli, pannello e card neri su bianco con qualunque tono a schermo, link compresi;
  - skip-link: `--colorPrimaryText` su `--colorPrimary`.
- `--colorInfo`/`--colorInfoText` sempre emessi: l'`info` di `colori.palette` se c'è, altrimenti quello di Bootstrap.
- `AppearanceService`: `colorTemaText()`/`colorPrimaryText()`/`colorSecondaryText()` coincidono con le variabili CSS omonime (tono chiaro); nuovi statici `getFillTextColor` (stesso algoritmo di `color-contrast()` di Bootstrap) e `computePaletteCached`; nuovo `siteOverrides(cfg)`, unica fonte degli override del design system per client, SSR, og:image e build.

Nomi CSS e API cambiati:

| Prima | Ora |
|---|---|
| `--color<Nome>Lt` / `--color<Nome>Dk` | `--color<Nome>`, valorizzato dentro `[data-bs-theme]` |
| `--colorPrimaryRgb`, `--colorSecondaryRgb` | `--bs-primary-rgb`, `--bs-secondary-rgb` |
| `--colorHeadingRgb` | `--bs-emphasis-color-rgb` |
| `--colorSurfaceTextRgb*` | `--bs-body-color-rgb` |
| `--colorLinkRgb*` | `--bs-link-color-rgb` |
| `--colorPrimaryFgRgb` | `--colorPrimaryFg` o `.text-primary` |
| `--colorPrimaryBgSubtle` / `--colorPrimaryBorderSubtle` / `--colorPrimaryTextEmphasis` (idem Secondary) | `--bs-primary-bg-subtle` / `--bs-primary-border-subtle` / `--bs-primary-text-emphasis` (idem secondary) |
| `--hoverBg`, `--hoverBorder`, `--activeBg`, `--activeBorder` | nessuno: hover e active li compila Bootstrap |
| `--bs-btn-*` ridichiarate a mano | classi Bootstrap (`.btn-primary`, `.btn-outline-*`…) |
| `.panel-light`/`.panel-dark` fissano i colori | il pannello prende i colori dal suo `data-bs-theme`; le due classi restano solo come aggancio |
| `--colorLink: currentColor` nel pannello | i link hanno il colore link del tono anche nel pannello |
| attributo `data-theme-tone`, `data-bs-theme` sulla navbar | nessuno: il tono è `data-bs-theme` su `<html>` e sul pannello |
| `AppearanceService.buildThemeStyleTag()`, `<style id="theme-init">`, `hexToRgbTriplet`, `lib.shade` | nessuno |
| `PaletteTokens`: triple RGB, testi sopra i fill, `subtlePrimary/Secondary/Info`, `colorInfoLt/Dk` | `colorInfo` campo unico; il resto lo deriva Bootstrap |

**Al merge**: `ng serve` lanciato a mano richiede prima `npm run generate:statics` (`npm run dev`/`start` lo fanno da sé); cambiare design system o `colorTema` con il server acceso richiede un riavvio. Negli stili di progetto sostituisci i nomi della tabella (cerca `Lt`, `Dk`, `Rgb`, `--hover`, `--active`, `--bs-btn-`, `data-theme-tone`). Ordine dei nomi da usare: classi Bootstrap, poi variabili `--bs-*`, poi i token `--color*` dell'Engine per i ruoli che Bootstrap non ha (`--colorSurface`, `--colorSurfaceHover`, `--colorNavBg/Text/Border`, `--colorTema`/`--colorTemaText`, `--colorPrimaryFg`, `--color<Nome>`/`--color<Nome>Text`). `--tone-<colore>-*` e `--tone-form-*` sono interni.

### Design system a gruppi e configurazione risolta `config.aspetto`

`DesignSystemPreset` passa da una trentina di campi piatti a gruppi per area, e `SiteConfig` perde i campi piatti dell'aspetto: il design system risolto (default compresi) sta in `ContestoSito.config.aspetto` (anche `inject(SITE_CONFIG).aspetto`), con gli stessi gruppi e nomi del preset. Un nome vecchio è un errore di `tsc`, senza messaggio di migrazione.

| Prima (`DesignSystemPreset` e `SiteConfig`) | Ora |
|---|---|
| `forceThemeTone`, `panelSurface` | `tono.forza`, `tono.pannello` |
| `superfici`, `colorBackground` | `colori.superfici`, `colori.sfondo` |
| `colorSecondary`, `colorInfo`, `customPalette` | `colori.palette.secondary`, `colori.palette.info`, altri nomi in `colori.palette` |
| `pageFade: false` | `movimento: 'fermo'` |
| `movimento` (durata) + `pulsazioneAttiva` | `movimento` (`'fermo'`\|`'scatto'`\|`'svelto'`\|`'morbido'`) |
| `showNav`, `fixedTopHeader`, `navSurface`, `showBrandIcon` | `navbar.show`, `navbar.fissa`, `navbar.superficie`, `navbar.icona` |
| `showFooter` | `footer.show` |
| `showBreadcrumb`, `breadcrumbStile`, `breadcrumbMaxItems` | `breadcrumb.show`, `breadcrumb.stile`, `breadcrumb.maxVoci` |
| `backToTopSoglia`, `cookieReopenStile` | `fab.tornaSuSoglia`, `fab.cookie` |
| `contentWidth` | `larghezza` |
| `lightboxBordiArrotondati` | `lightboxArrotondato` |
| `defaultFont`, `addonFonts` | `font.principale`, `font.aggiuntivi` (anche in `resolveFonts({ principale, aggiuntivi })`) |
| `ogImagePlain` | `og.soloSfondo` |
| `ogTextTransform` (riceveva `defaultFont`) | `og.testo` (riceve `font`) |
| `ContestoSito.config.<campo>` (≈30 campi piatti dell'aspetto) | `ContestoSito.config.aspetto.<gruppo>.<campo>` |
| `BreadcrumbComponent` input `forceShow` (tri-stato) | input `show: boolean` (default `false`) |

- **Rimossi senza sostituto**: `colorText`, `separazioneSuperfici`, `mutezzaSecondario`, `hoverIntensity` (hover e active li deriva Bootstrap), `footerIdentita` (i social del footer di serie compaiono se l'identità li ha; per toglierli si compone il footer in `nav.ts`). Da `SiteConfig` spariscono anche `backgroundVividness` e `designSystem`; restano fuori da `aspetto` `colorTema`, `fonts`, `customFontsCatalog`, `errorChrome`, `appName`, `showNotifications`, `showLoginInHeader`, `legalPages`, `cookiePolicy`.
- **Derivati in `aspetto`**: `aspetto.pannello` (da `colori.superfici`), `aspetto.transizioni` (vero tranne con `'fermo'`), `aspetto.pulsazione` (`'assente'`|`'lieve'`|`'marcata'`), `aspetto.colori.vividezza`; `aspetto.smoke` è nella forma risolta. Facoltativi solo `tono.forza`, `colori.sfondo`, `font.principale`, `og.testo`.
- **`movimento: 'fermo'`** spegne anche le View Transitions fra pagine (prima sempre attive), i fade d'ingresso (anche nei ruoli), le aperture (0s) e l'alone dei toggle attivi.
- **Patch**: dentro un gruppo si fonde campo per campo con la base, anche per `colori.palette` e per ogni ruolo di `ruoloPagina`; `undefined` significa "non specificato" e lascia il valore della base; `font.aggiuntivi` sostituisce quello della base; una voce di palette ereditata non si toglie. Un campo sbagliato o un valore fuori elenco è errore di `tsc` anche nella patch-funzione `(risolto) => patch`.
- **Validazione più stretta** (`validateDesignSystemPreset`, a ogni resolve in `buildSite` e in `generate:statics`, messaggi in italiano): valori fuori elenco con l'elenco ammesso, booleani non booleani, `og.testo` non funzione, `smoke.opacity` non finita o fuori 0–1, campi sconosciuti (radice, gruppo, ruolo), `ruoloPagina.naked`, font non validi (`font.principale` stringa che non è una voce di `SystemFont`; in `CustomFontDef`: `faces[].file` solo nome file `.ttf/.otf/.woff/.woff2`, `weight` 400 o 700, `family` senza `" \ ; { } < >` né a capo).
- **Nomi in `colori.palette` solo camelCase ASCII** (`^[a-z][a-zA-Z0-9]*$`): `oroChiaro` sì, `oro-chiaro`/`OroChiaro`/`rosé` no. Rifiutati anche i colori di tema di Bootstrap tranne `secondary` e `info`, i nomi della mappa `$colors`, i nomi che collidono con classi Bootstrap (`sm`, `center`, `bgPrimary`…), con variabili `--bs-*` esistenti (`borderWidth`…) o con i 22 token del tema (`surface`, `navBg`…), i suffissi `-rgb`/`-subtle`/`-emphasis`, due voci che producono la stessa classe o lo stesso token. Le classi restano in kebab-case (`oroChiaro` → `.btn-oro-chiaro`), le variabili in PascalCase (`--colorOroChiaro`).
- **Ruoli di pagina: un ruolo può solo spegnere** (breaking). Prima il ruolo vinceva sul design system in entrambe le direzioni; ora conta il design system risolto e un ruolo che non nomina un campo lo segue. Un ruolo non accende più ciò che il design system lascia spento: `showBreadcrumb: true` senza `breadcrumb.show: true`, `showPanel` con superfici senza pannello (`distinte`, `tenue`, `fusione`), `pageFade` con `movimento: 'fermo'`, `showSmoke` senza `smoke.enable`, `showNav`/`showFooter`/`showBrandIcon` con il gruppo spento. `fitViewport` resta deciso dal ruolo.
- **`naked`**: pagina nuda anche senza breadcrumb né smoke; non si personalizza (`ruoloPagina.naked` è un errore di validazione).
- **Preset condivisi di proprietà Engine**: `components/shared/design-systems/engine/` (aria, carta, giorno, notte, lanterna, ombra, lavagna, muro) al merge segue il template; per personalizzarli si estendono con `extendDesignSystem` o si copiano in un file di progetto.

**Al merge**: riscrivi i design system di progetto con i gruppi della tabella (anche nella patch-funzione); nomi di palette kebab → camelCase; codice che leggeva `ContestoSito.config.<campo>` dell'aspetto → `ContestoSito.config.aspetto.<gruppo>.<campo>`; `<app-breadcrumb [forceShow]>` → `[show]`. Un ruolo che accendeva breadcrumb, pannello, smoke o fade contro il design system va accompagnato dall'accensione nel design system (poi gli altri ruoli la spengono). Se avevi modificato un preset in `design-systems/engine/`, sposta le modifiche in un tuo design system che lo estende.

### og:image e font: misura del testo nel font che lo disegna

- Le larghezze dei caratteri (a capo e dimensione del badge) si leggono dai font reali in TTF, OTF, WOFF e WOFF2 (cmap formato 4 o 12) per ASCII, Latin-1, Latin Extended-A e `– — ‘ ’ ‚ “ ” „ • … €`, per ogni font di sistema e ogni font custom del catalogo (`font.principale`, `font.aggiuntivi`). Prima: solo il font custom attivo, solo la prima faccia. Il testo si misura nel font che lo disegna, compreso quello scelto da `og.testo` (prima si misurava sempre nel font del sito).
- Testo misurato e disegnato in NFC; i caratteri invisibili contano zero. Un carattere fuori tabella conta come la sua lettera base, altrimenti un em pieno: nel dubbio il testo va a capo invece di uscire dal badge.
- Grassetto: rapporto reale se `faces` dichiara una faccia 700, altrimenti la stima del grassetto sintetico di fontconfig; il regular si misura dalla faccia più vicina a 400 in stile normale, qualunque sia l'ordine di `faces`.
- Fallback: tabelle integrate (solo ASCII) senza font di sistema installati (dev fuori dal container) o con un font illeggibile; un font custom illeggibile si misura come Liberation. Decompressione WOFF/WOFF2 con tetto a 32 MB.
- Log all'avvio: una riga informativa se nessun font di sistema è installato, altrimenti un warn per ogni font che ripiega; file custom assente → riga informativa, corrotto → warn col motivo. Metriche lette una volta per processo: sostituito un file in `fonts/`, riavvia il server.
- `og.testo` accetta come `font` qualunque `SystemFont` o un font custom del catalogo (confronto per `key`); prima solo il font del sito o una voce di `addonFonts`. Un valore non valido si ignora con un avviso nel log, una volta per valore distinto.
- API: `PreviewSvgOptions.fontFamily` e `TitleBadgeOptions.fontFamily` (stringa) → `font` (`FontChoice`); nuovo `PreviewBuilder.fontPrincipale()`; `FontMetrics.measure` accetta la `key` del font; `customFontServerStack` (da `custom-font-detect.ts`) e `customFontWebStack` rimosse; `systemUiFonts` non più esportata; nuove `closestFace()` e `choiceKey()` in `font-system.ts`.

**Al merge**: codice di progetto che passava `fontFamily` a `PreviewBuilder` passa `font`; chi importava `customFontServerStack`, `customFontWebStack` o `systemUiFonts` usa `serverStackForChoice`/`resolveFonts`.

### Editor Markdown (`MarkdownEditorComponent`)

- Nuovo componente Engine `app-markdown-editor` (`core/engine/components/markdown-editor/`): campo di form per un testo che poi passa da `| markdown`, con `[(ngModel)]` o `formControlName` e stato disabled. Input: `inputId` (per `<label for>`), `ariaLabel`, `placeholder`, `rows` (default 8), `labels` (`MarkdownEditorLabels`, stessa forma di `UploadFormComponent.labels`).
- Colora la scrittura con il lexer della pipeline che renderà il testo (`MarkdownPipe.lex()`) e con la stessa regola sugli URL non sicuri; anteprima con l'output reale della `MarkdownPipe`.
- Barra accessibile (`role="toolbar"`, un solo Tab stop, frecce/Home/Fine): annulla, ripeti, grassetto, corsivo, titolo, sottotitolo, elenchi puntato e numerato, link, anteprima. Scorciatoie Ctrl/Cmd+Z, Y (o Maiusc+Z), B, I, K.
- Invio negli elenchi continua, risale di livello o chiude l'elenco e rinumera gli elenchi numerati; cronologia propria (una parola per passo, massimo 200 passi).
- Etichette nelle chiavi `mdEditor*` di `basic.*.json`, sovrascrivibili in `addon.*.json`.

Additivo, niente da fare al merge.

### Un solo caricamento del contenuto per pagina

`PageBaseComponent` rieseguiva il caricamento del contenuto nel browser con un `resource()` anche al montaggio della pagina, oltre al resolver del router: ogni pagina con `contentLoader` (e ogni pagina legale) scaricava il contenuto due volte. Il `resource()` è rimosso: il contenuto arriva solo dal resolver (`contentByResolve`), in SSR, all'idratazione e a ogni navigazione. Il cambio lingua naviga alla rotta dell'altra lingua (nuova istanza, il resolver riparte) e il cambio di un parametro fa rieseguire il resolver.

**Al merge**: niente da fare, salvo codice di progetto che si appoggiava al ricaricamento del componente fuori dal router (non previsto dal contratto).

### Conformità legale: pagine legali dell'Engine, `Features`, cookie banner, Privacy Policy, dati personali

- **Pagine legali rifatte (breaking, `site.ts`)**. La sezione `legal` funziona come `homePage`/`loginPage`: uno slot per pagina standard (`privacy`, `cookie`, `termsOfService`, `legalNotice`, `accessibility`), valorizzato con un `PageType` del progetto (nome libero) o con `{ page, updated: Date }`. Rotta (`/policy/<segmento>`, per lingua: vedi sotto), titolo e markdown li decide lo slot.
  - `privacy` obbligatorio; `cookie` obbligatorio con voci in `COOKIE_MAP` o `isWebApp: true`, e senza cookie la pagina non viene creata anche con lo slot valorizzato; slot assente = pagina non creata.
  - `updated` (formattata in UTC) compare sotto il titolo e finisce in `og:updated_time` e `dateModified`.
  - Pagine in più in `legal.extra` (`page`, `path`, `titleKey`, `descriptionKey`, `markdown`, `updated?`), chiavi i18n in `addon.*.json`, testo in un file per lingua `assets/legal/<markdown>.<lingua>.md`.
  - **Markdown sostitutivo**: `markdown: 'nome'` nella forma oggetto di uno slot standard fa della pagina il file `assets/legal/<nome>.<lingua>.md` (es. la Privacy Policy del proprio legale), senza parti, dati di navigazione generati, stato di accessibilità né identità; rotta, titolo, data e footer restano dell'Engine, e nella Cookie Policy anche l'elenco cookie (dopo il testo) e il pannello delle preferenze. `markdown` è un nome di file `[A-Za-z0-9_-]`, unico fra le pagine legali senza distinzione di maiuscole.
  - Una pagina dichiarata a mano in `pages` con lo stesso `PageType` vince: l'Engine non la crea né ne carica i testi.
  - Spariscono le chiavi `legalPages` e `cookiePolicy` di `site.ts` (in `SiteConfig` restano, derivate dagli slot), `STANDARD_LEGAL_PAGES`, `LegalPageConfig` con i 4 interruttori per pagina e `pages/policy/legal.pages.ts`. Le voci di `SiteConfig.legalPages` (`LegalPageSpec`) hanno `page` al posto di `pageType`.

  **Al merge**: dichiara gli ID legali nel `PageType` (la demo usa `legal.privacy`, `legal.cookie`, `legal.tos`, `legal.notice`, `legal.accessibility`), sostituisci `legalPages`/`cookiePolicy` con la sezione `legal`, cancella `pages/policy/legal.pages.ts`; in `nav.ts` un `spec.pageType` su `ContestoSito.config.legalPages` diventa `spec.page`.
- **`Features` in `global-settings.json` (breaking per chi ha login, mail o webhook)**. Committato e senza segreti, cinque booleani, voce assente = spenta:
  ```json
  "Features": { "Login": false, "PublicLogin": false, "Mail": false, "ErrorReporting": false, "Forms": false }
  ```
  - **Il flag è l'interruttore, la configurazione nel `.local` il requisito.** Configurazione presente con flag spento = funzione spenta; flag acceso senza configurazione = il backend non parte (`FeaturesOptions`).
  - **`Login`**: login riservato agli amministratori (pagina noindex e fuori sitemap, niente link in navbar, niente sezione nella Privacy Policy). **`PublicLogin`**: link in navbar e parte `login` della Privacy Policy; vince su `Login`. Sostituisce `loginPage: { page, showInHeader }`: `loginPage` torna un `PageType` nudo (`LoginPageConfig` rimosso). Entrambi spenti = pagina di login non creata.
  - **`Mail`** richiede `Mail.Host` + `Mail.FromAddress`; **`ErrorReporting`** richiede `ErrorReporting.WebhookUrl`; **`Forms`** accende solo la parte `form` della Privacy Policy.
  - Frontend: flag compilati in `environment.features`. `ClientErrorReportingService` (errori del browser verso il backend) è registrato solo con `Features.ErrorReporting` acceso; prima era sempre registrato.
  - Backend: `SecurityOptions.LoginEnabled` riflette i flag, `HasSecretKey` dice solo se la chiave c'è. `IEngineMailer.IsEnabled`/`IErrorReportingService.IsEnabled` = flag acceso e configurazione presente. Mailer spento → invio diretto 503 (`MailNotConfiguredException`, `error_mail_disabled`); `DeliveryService` non accoda email e registra il mancato recapito.
  - **`Security.Token.SecretKey`** (con login acceso): almeno 32 byte UTF-8, niente spazi o a capo iniziali o finali (rifiutata, non tolta in silenzio), diversa dal segnaposto di `global-settings.local.example.json`. Stessa regola nel backend all'avvio e negli script di deploy, che prima toglievano gli spazi e contavano caratteri.
  - **Frontend e backend non possono credere cose diverse**:
    - `generate:statics` si ferma su chiavi sconosciute o con maiuscole diverse, valori non booleani, `Features` nel `.local`, login acceso senza `loginPage` in `site.ts`;
    - `br1_load_config` (deploy) si ferma se il `.local` contiene `Features` o se base e `.local` uniti hanno chiavi che differiscono solo per le maiuscole (il backend non le distingue);
    - il server SSR (`server.mjs` avviato come processo principale, non `ng serve`) rilegge `Features` dal file montato come lo legge il backend ed esce con codice 1 se non coincide con quello compilato;
    - il backend non parte con un flag acceso senza la sua configurazione, con una `SecretKey` non valida, o con qualunque chiave `Features`/`Features:*` da variabili d'ambiente o riga di comando, qualunque sia il valore;
    - `deploy.sh` e `deploy-release.sh` ripetono i controlli prima di pubblicare.
  - I controlli di avvio del server SSR (compreso `assertRequiredEnv`) escono con codice 1: prima il gestore globale di `@angular/ssr` li intercettava e il processo usciva con 0.
  - `setup.mjs` genera `SecretKey` e `ApiConfig.Keys` e mette tutti i `Features` a `false`; senza `.local` (CI) `br1_load_config` genera valori usa-e-getta per le funzioni accese.
  - Credenziali demo di `AccountService` rifiutate in ogni ambiente tranne Development (prima solo in Production: Staging le accettava).

  **Al merge**: aggiungi `Features` con ciò che usi (login in navbar → `PublicLogin`, altrimenti `Login`; `Mail`/`ErrorReporting` se avevi la loro sezione nel `.local`, che senza flag resta inerte; `Forms` se il sito raccoglie dati da form); togli `Features` dal `.local` e da ogni variabile d'ambiente `Features__*`; porta `loginPage` alla forma nuda; codice di progetto che leggeva `LoginEnabled` come "c'è la chiave" passa a `HasSecretKey`; controlla che la `SecretKey` non abbia spazi ai bordi; in Staging servono credenziali vere in `AccountService`.
- **`Security.CryptoSecret` e `IEngineCrypto` rimossi** (`EngineCrypto`, la proprietà `Crypto` di `EngineApiController`, la chiave nello schema, nell'esempio `.local`, in `setup.mjs` e negli script di deploy): l'unico uso dell'Engine era l'export dei dati personali, ora in chiaro (sotto).

  **Al merge**: togli `Security.CryptoSecret` dal `.local` (lo schema non la prevede più); il codice di progetto che usava `Crypto`/`IEngineCrypto` porta una propria implementazione.
- **Markdown legali a pezzi, senza segnaposto (breaking per chi ha markdown legali propri)**. Ogni pagina è una cartella `assets/legal/<slug>/` con una sottocartella per parte, che contiene solo i file di lingua: `<slug>/<parte>/<lingua>.md` (es. `privacy/intro/it.md`, `privacy/login/en.md`). Le parti si concatenano in ordine fisso:
  - `intro` (obbligatoria, apre con `# Titolo`; BOM e righe vuote iniziali tollerati);
  - nella Privacy, ambito e dati di navigazione generati dall'Engine (sotto);
  - l'elenco cookie per categoria (solo Cookie Policy);
  - le parti per funzione, presenti solo se la funzione è attiva: nella privacy `login` (`Features.PublicLogin`), `form`, `mail`, `errorReporting` (`Features.Forms`/`Mail`/`ErrorReporting`), `analytics`, `profiling` (voci di quella categoria in `COOKIE_MAP`), `cookiePolicy` (la Cookie Policy esiste); nella cookie `tracking` (Analytics o Profilazione);
  - nella Dichiarazione di accessibilità, lo stato di conformità (sotto);
  - `outro` (facoltativa); nella Cookie Policy poi pannello preferenze e guida ai browser;
  - sempre ultima, la sezione identità resa dall'Engine; senza dati d'identità non compare, titolo compreso.

  Una variante facoltativa `<slug>/<parte>/off/<lingua>.md` (es. `privacy/mail/off/it.md`) prende il posto della parte a funzione spenta. Le pagine `extra` sono un file per lingua (sopra), senza parti né identità. Spariscono tutti i tag (`{{companyProfile}}`, `{{ragioneSociale}}`, `{{partitaIva}}`, `{{codiceFiscale}}`, `{{cookieList}}`, `{{cookieCategories}}`).
  - **Controlli di build** (`legal-check` in `generate:statics`): cartella o file dal nome non previsto; `intro` mancante in una lingua o che non apre con `# `; parte mancante per una funzione accesa; file facoltativo (`outro`, `off`, parte a funzione spenta) presente in una lingua del sito ma non in tutte; file `markdown` mancante in una lingua o che non apre con `# `; link `policy:` a uno slot che non esiste; con la Privacy composta, un titolare senza nome o recapito in `backend/data/identity.json` (`ragioneSociale` o `titolareDelTrattamento.nome`, più email, PEC o telefono). Il resto di `assets/legal/` (altri Markdown, allegati, cartelle) è del progetto e il build non lo guarda. Ignorati i file che iniziano con un punto, `Thumbs.db`, `desktop.ini`, `*~`, `*.swp`, `*.bak`. Lingue controllate = quelle servite dal sito.
  - **Caricamento**: il build scrive in `environment.legalFiles` quali file esistono per pagina e il resolver chiede solo quelli; i testi letti in SSR passano al browser in `TransferState` e l'idratazione non li riscarica. L'SSR del build servito legge da disco, `ng serve` via HTTP; `/assets/legal/*` è protetto dal path traversal. Un file aggiunto dopo l'ultimo `generate:statics` non si vede fino al riavvio.

  **Al merge**: i markdown standard del template arrivano nelle cartelle nuove; un figlio con testi propri li sposta in `<slug>/intro/<lingua>.md` (più `<slug>/outro/<lingua>.md` se serve), porta il testo di una pagina `extra` in `<markdown>.<lingua>.md`, cancella i vecchi file sciolti (`privacy.it.md`, `TOS.en.md`…), che non vengono più letti e che nessun controllo segnala (un proprio testo del legale si tiene dichiarandolo: `privacy: { page, markdown: 'privacy' }`), apre l'intro con `# Titolo`, divide le parti condizionali in `<slug>/<parte>/<lingua>.md` e toglie segnaposto e rimandi ai recapiti (ora sezione finale).
- **Dichiarazione di accessibilità senza segnaposto**. I segnaposto editoriali `_[…]_` spariscono, insieme al testo sul regime della Pubblica Amministrazione (Legge 4/2004, AgID). Lo stato di conformità lo scrive l'Engine (`AccessibilityStatementComponent`, chiavi `acc*` di `basic.*.json`) dai contenuti non accessibili noti dichiarati nello slot: `accessibility: { page, updated?, nonAccessibili: [{ descrizioneKey, motivo, alternativaKey? }] }`, testi in `addon.*.json`. Senza voci il testo pieno (progettato per WCAG 2.1 AA, European Accessibility Act), con voci il testo sulle criticità seguito dall'elenco. `accessibility/intro/` tiene titolo e una frase, `accessibility/outro/` redazione e segnalazioni.

  **Al merge**: i testi scritti nei segnaposto vanno in `accessibility/intro/`/`outro/` o diventano voci di `nonAccessibili`.
- **Identità delle pagine legali per pagina (breaking per chi usava `app-identity-render`)**. La sezione in coda mostra i campi che servono a quella pagina, fissati nella ricetta (`LegalRecipe.identity: { titleKey, fields: FooterField[] }`): Privacy e Cookie il titolare (art. 13 GDPR), Termini identità e contatti del gestore, Note legali l'identità completa (REA, capitale, liquidazione), Accessibilità i soli contatti. Prima ogni pagina mostrava tutto, capitale sociale compreso. `app-identity-render` e `hasIdentityContent` sono rimossi: `PolicyComponent` risolve i campi con `resolveFooterFields` (nuovo, in `footer-content.ts`) e li elenca con un `@for`, contatti coi componenti del footer.
- **Link nei testi legali**. Il GDPR è linkato su EUR-Lex nella lingua del file; il reclamo nella Privacy Policy si rivolge all'autorità di controllo del Paese dell'utente (art. 77 GDPR) invece di linkare il Garante italiano anche nella versione inglese. I rimandi alla Cookie Policy sono link: `[Cookie Policy](policy:cookie)` si risolve nel percorso dello slot nella lingua corrente (resta testo se la pagina non esiste; uno slot sbagliato ferma il build).

  **Al merge**: testi legali propri con link a pagine in un'altra lingua vanno riallineati allo stesso criterio.
- **Dati di navigazione dai fatti dell'installazione**. La sezione "Dati di navigazione" della Privacy la genera l'Engine (`renderNavigationData`, chiavi `nav*` di `basic.*.json`) da un file JSON per server, indicato da `frontend.hostingInfo` in `global-settings.local.json` (relativo alla cartella di `global-settings.json` o assoluto; schema `core/engine/legal/hosting-info.schema.json`, esempio `hosting-info.example.json`): fornitore e paese dell'hosting, CDN, reverse proxy, log (accessi, errori, applicazione) con i campi salvati e la conservazione reale (in giorni dove una rotazione a tempo la garantisce, altrimenti "a dimensione limitata, a rotazione", come i log dei container), e una sezione `backend` per il server delle API se gira altrove. Dalla configurazione l'Engine aggiunge l'ambito (il sito coperto, da `frontend.hostname`) e per quanto l'IP resta in memoria per il limite di richieste (la finestra più lunga di `Security.ApiConfig.RateLimiting`, quella dei login solo col login acceso; la frase sparisce con `Enabled: false`). Le soglie non entrano nel testo, né una CDN dichiarata assente. Ogni campo è facoltativo; un paese fuori dallo SEE vuole le garanzie del trasferimento. L'SSR lo legge e valida all'avvio (indicato ma assente o non valido = non parte), `br1_load_config` lo risolve e il compose lo monta in `/app/hosting-info.json` (`HOSTING_INFO_PATH`, `/dev/null` se non configurato). `privacy/intro/` tiene solo titolo e premessa: il titolo "Dati trattati e finalità" lo scrive l'Engine.

  **Al merge**: togli dai tuoi `privacy/intro/<lingua>.md` il titolo "Dati trattati e finalità" e la sezione "Dati di navigazione" (li genera l'Engine) e, in produzione, crea il file del server e indicalo in `frontend.hostingInfo`.
- **Dati di navigazione anche senza SSR**. `TransferState` porta i fatti alla pagina solo se questa è stata renderizzata dal server: sulle pagine `requiresAuth` (mai renderizzate dal server) non arrivano mai, e se una di quelle è la prima della sessione la Privacy aperta da lì mostrava il testo generico anche con `frontend.hostingInfo` configurato. `computeLegalFacts()` (`server-env.ts`) è ora la fonte unica, condivisa dal provider Angular e dal nuovo endpoint `/internal/legal-facts`: `PolicyComponent`, quando i fatti dal provider sono `null`, lo interroga una volta sola prima di ricadere sul testo generico.
- **Privacy Policy sul modello dell'informativa del Garante**. Dati di navigazione con la formulazione del Garante (acquisiti dai sistemi preposti al funzionamento del sito, impliciti nei protocolli di Internet: IP, URI/URL, orario, metodo, dimensione e stato della risposta, ambiente dell'utente); legittimo interesse concreto per ogni trattamento che lo usa (difesa da abusi e attacchi, protezione degli account, correzione degli errori); conservazione per criterio (log tecnici a dimensione limitata e rotazione, salvo accertamento di reati), perché i log del server, reverse proxy compreso, contengono l'IP; i diritti aggiungono tempi di risposta e verifica dell'identità (art. 12), il caso dei dati non riferibili a una persona (art. 11) e il ricorso all'autorità giudiziaria (art. 79).

  **Al merge**: se hai un reverse proxy (Nginx registra l'IP di serie), dichiara i suoi log e la loro durata nel file di `frontend.hostingInfo`.
- **`PolicyComponent` nell'Engine**: da `pages/policy/` a `core/engine/pages/policy/`, perché porta la composizione delle pagine legali (dati di navigazione, stato di accessibilità, identità, link `policy:`).

  **Al merge**: cancella `pages/policy/` dal progetto (la versione del template sta sotto l'Engine).
- **Path delle pagine legali per lingua**. Come il `path` delle pagine: di serie `termini`/`terms` e `accessibilita`/`accessibility` (prima fissi in italiano anche sotto `/en/`), `privacy`, `cookie` e `legal` uguali ovunque. Slot in forma oggetto e voci `extra` accettano `path` come stringa o `{ lingua: segmento }`, fuso sopra quello dell'Engine; una lingua che nessuno nomina usa il segmento inglese. Le URL inglesi `/en/policy/termini` e `/en/policy/accessibilita` diventano `/en/policy/terms` e `/en/policy/accessibility` (pagine `noindex`: link interni e sitemap seguono da soli).
- **Cookie banner**:
  - Rifiuta, Accetta e Salva scelte sono tutti `btn-primary`, con pari evidenza come chiedono le Linee guida cookie del Garante del 10/06/2021 (prima con una sola categoria Accetta era verde e Rifiuta aveva solo il bordo).
  - Aggiunta la X di chiusura, che equivale a Rifiuta tutto, con la frase che lo spiega in `introBannerCookie`, ora sempre il testo del banner (`testoBannerCookie` rimossa).
  - Lo switch dei tecnici non obbligatori parte spento: uno switch già attivo non è consenso valido (sentenza CGUE Planet49).
  - GPC rifiuta solo Analytics e Profilazione, mai i tecnici, e non sovrascrive una scelta già salvata. L'avviso GPC compare solo per le categorie che il segnale tiene davvero spente e nomina solo quelle (nuove chiavi `gpcRilevatoAnalyticsBannerCookie`, `gpcRilevatoProfilazioneBannerCookie`).
  - `bearerToken` compare nella Cookie Policy anche con il login riservato.
- **Privacy Policy** (`assets/legal/privacy/`) riscritta secondo l'art. 13 GDPR, con solo i trattamenti che l'Engine di serie fa davvero:
  - titolo e premessa (`intro`); dati di navigazione e limite di richieste li genera l'Engine (sopra);
  - login, form, email, segnalazioni errori, statistiche e profilazione (una parte ciascuno, con base giuridica e conferimento);
  - titolare, hosting e fornitori delle funzioni attive come responsabili del trattamento (art. 28), nessuna decisione automatizzata, diritti, reclamo all'autorità di controllo del Paese dell'utente e ricorso al giudice (`outro`).

  Prima dichiarava di non raccogliere dati personali. **Un figlio aggiunge a mano solo il resto**: fornitori extra-UE, contenuti incorporati, trattamenti propri del dominio.
- **`GET /me/data`** restituisce JSON leggibile, `{ "data": { "upload": ["slug", …] } }` o `{ "data": null }`, invece del blob cifrato con `Security.CryptoSecret` che l'interessato non poteva aprire (artt. 15.3 e 20 GDPR); riservatezza affidata a HTTPS e login.
- **`DELETE /me/data`**: in un'unica transazione sostituisce l'id dell'utente nel registro `BlobOwnership` (proprietario e autore delle cancellazioni) con un id `anonimo-<guid>`, uno per cancellazione, poi cancella l'account (`AccountService.DeleteAccountAsync`). I file restano e la Privacy Policy lo dice. Il JWT resta valido fino a scadenza e un upload fatto con quel token registrerebbe di nuovo l'id reale: il client scarta il token alla risposta 204 (il frontend del template non chiama `/me/data`; chi lo espone gestisce il logout).
- **Upload senza posizione**: upload e sostituzione (`POST /blob/up`, `PUT /blob/{slug}`) passano da `ImageLocationScrubber`, senza ricodifica (pixel, profilo ICC e orientamento intatti):
  - JPEG: svuota il GPS dell'EXIF; scarta XMP ed XMP esteso, APP13 (Photoshop/IPTC) e APP2 MPF; tronca ciò che segue l'immagine principale (video Motion Photo, immagini secondarie, gain map Ultra HDR);
  - PNG: svuota il GPS dell'`eXIf`; scarta i chunk di testo con XMP o profili raw exif/xmp/iptc; tronca dopo IEND;
  - WebP: svuota il GPS dell'EXIF; scarta il chunk XMP (e il flag in VP8X); tronca oltre il RIFF;
  - resta il resto dell'EXIF (seriale del dispositivo, proprietario, data di scatto); HEIC, AVIF, TIFF e ogni altro formato passano invariati;
  - un file riconosciuto come JPEG, PNG o WebP la cui struttura non si legge fino in fondo è rifiutato con 400 `error_invalid_image` e non viene salvato; oltre ~2 GB → 413.

  **Al merge**: un client che carica immagini gestisce il 400 `error_invalid_image`; gli upload già presenti non vengono ripuliti.
- **`setup.mjs`**: il figlio nasce con `legal: { privacy }`, col footer di serie dell'Engine (P.IVA, dati societari, social), che prima veniva sostituito da un resolver vuoto, con tutti i `Features` spenti e la `SecretKey` già generata.
- **Testi e chiavi i18n**:
  - descrizione di `consent_log`: ultima scelta salvata sul dispositivo, non un registro probatorio;
  - descrizione della categoria Analytics: tolto "anonima";
  - GPC presentato come rifiuto, non come "non vendere";
  - rimosse da `basic.*.json`: `testoBannerCookie`, `privacyPolicyTitolo`, `privacyPolicyIntestazione`, `cookiePolicyTitolo`, `cookiePolicyIntestazione`, `datiPersonaliPolicy`, `sicurezzaPolicy`, `cosaSonoCookie`, `comeLiUsiamoCookie`, `controlloCookie`, `modifichePolicy`, `nomeListaCookie`, `categoriaListaCookie`, `descrizioneListaCookie`; aggiunte `gestoreSitoPolicy`, `gpcRilevatoAnalyticsBannerCookie`, `gpcRilevatoProfilazioneBannerCookie` e, nei `.resx` del backend, `error_invalid_image`.

  **Al merge**: le sovrascritture in `addon.*.json` delle chiavi rimosse restano orfane: toglile.
- **`.github`**: eliminato `copilot-instructions.md` (regole Azure estranee al progetto); template di PR e issue e `SECURITY.md` citano `Features.Login`/`Features.PublicLogin` al posto di `LoginEnabled`.

### Configurazione Media e Notifiche (global-settings.json)

Rimosse configurazioni hardcoded da backend e frontend.
- **Media**: `EngineBlobController` ora accetta un `size` e lo valida contro `ALLOWED_WIDTHS` (`asset-config.ts`, whitelist fissa dell'Engine, rispecchiata lato C# in `EngineBlobController.AllowedWebOptSizes` — non una scelta per-progetto, un figlio non ha motivo di volere le sue larghezze). Se la dimensione richiesta è mancante o fuori whitelist, effettua un log di warning e usa la dimensione mediana, non ricadendo forzatamente sulla dimensione massima. Introdotta `Media.WebOptQuality` nello schema (questa sì per-progetto: qualità WebP della variante ottimizzata).
- **Notifiche SSE**: introdotti `Notifications.HeartbeatSeconds` (default 25s) e `Notifications.ReconnectDelaySeconds` (default 5s) nello schema. `EngineNotificationStreamController` ora usa questi valori.

### Frontend: Layout Navbar e Meta Tag

- **Navbar Overflow Fix**: il ricalcolo dell'overflow in `navbar.component.ts` ora usa un `ResizeObserver` che osserva esplicitamente il brand, il menu utente e il selettore lingua. Inoltre, attende `document.fonts.ready` prima del primo calcolo: questo risolve i bug storici in cui il menu ad overflow si calcolava male prima che il font custom (più largo o più stretto) venisse caricato.
- **Telephone Meta Tag**: aggiunto `<meta name="format-detection" content="telephone=no">` in `index.html`. Questo blocca iOS Safari/Chrome dal trasformare falsi positivi lunghi (es. P.IVA o CF) in link cliccabili azzurri che rompono la UI. I veri numeri di telefono restano pienamente supportati tramite markup esplicito (`<a href="tel:...">`) generato dai componenti (es. `ContactUrl.phone`).

### UX Aggiornamenti PWA (VersionCheckService)

- Aggiunto hook `onVersionUpdateAvailable(apply: () => void)` al `SiteConfig` (configurabile in `siteBuilder.ts`). Permette a un progetto figlio di deviare il comportamento di aggiornamento di default (un `window.confirm` bloccante con hard reload forzato) e implementare una UX non invasiva o differita, essenziale per app con sessioni di inserimento dati lunghe.
- L'hook cattura eventuali errori silenziosi (fallback sul dialog di default) per non perdere la traccia degli aggiornamenti in caso di bug.
- Aggiunto intervallo configurabile `versionCheckIntervalMs`.

### Breadcrumb: Troncamento Intelligente e Titolo Pagina

- **Breadcrumb**: Aggiunto il troncamento intermedio intelligente in `BreadcrumbComponent`. Se la soglia viene superata, mantiene il primo elemento, gli ultimi due e sostituisce gli intermedi con un'ellissi (`...`).
- Aggiunta `breadcrumbMaxItems` in `SiteConfig` (gestito anche in `DesignSystemPreset`). Il default globale in `siteBuilder.ts` rimane `4`, attivando questa nuova "cosa fica" automaticamente su tutti i progetti.
- **SiteBuilder**: Introdotto `formatBrowserTitle(pageTitle, appName)` per sovrascrivere il formato del tag `<title>` e `og:title`.

### Identity: Riconoscimento e Contenuti Legali

- **Legali**: Le pagine Privacy e TOS ora espongono in fondo la variabile testuale `{{companyProfile}}` per il "Titolare del trattamento" / "Website owner".
- Spostata la logica regex degli orari (`isHm`) nel più robusto `isValidOpeningInterval` esposto in `identity-format.ts`.


### `ImgBuilderService` (pill/caption): sfondo di default allineato all'og:image, colore brand nudo invece di `colorPrimary`

Confrontando a parità di sito lo sfondo dell'og:image (`PreviewBuilder`, già `colorTema` nudo — vedi voce precedente) con quello di default di `ImgBuilderService.buildPillCanvas`/`buildCaptionCanvas`/`buildFittedCaptionCanvas` (pill/caption su una foto), i due potevano divergere: `roleColors()` (nessun `colorRole` esplicito) ricadeva su `colorPrimary`, che è `colorTema` scurito in OKLCH finché non raggiunge 4.5:1 di contrasto su una pagina chiara — pensato per bottoni/CTA, non per rappresentare il brand in un'immagine a piena superficie. Con un brand già scuro (es. `#131e55`, `#8E162B`) `colorPrimary` coincide con `colorTema` e la differenza passa inosservata; con un brand chiaro (es. `#f2c14e`) diverge vistosamente (`#946700`, un marrone). Stesso principio già scelto per l'og:image: il colore scritto in `global-settings.json` è sempre quello che appare, senza scurimenti impliciti da spiegare.

- `roleColors()` (privato): nessun `colorRole` → ora `colorTema`/`colorTemaText` (il brand nudo), non più `colorPrimary`/`colorPrimaryText`. `colorRole: 'primary'|'secondary'` resta una scelta esplicita legittima per chi vuole invece il colore dei bottoni/CTA del sito (es. un badge pensato per intonarsi alla UI, non al brand puro) — comportamento invariato in quel caso.
- **Breaking silenzioso solo per un brand chiaro**: chi non passava mai `bgColor`/`scrimColor`/`colorRole` espliciti vede ora uno sfondo più chiaro/fedele al brand invece che scurito — nessun figlio con un brand scuro nota differenza.
- Verificato: `tsc --noEmit`, `eslint`, `ng test` (123/123) puliti; palette calcolata dal vivo per più `colorTema` (scuro, chiaro, un rosso scuro reale da un figlio) — nessuna anomalia, contrasto testo/sfondo sempre ampiamente sopra soglia AA.

### Fix: cifre "fuori stile" nelle immagini OG e nel testo del sito (due cause distinte, stesso sintomo); più respiro nella caption di `ImgBuilderService`

Segnalato da un figlio reale (card fotografiche con testo overlay): numeri come orari o gradi comparivano visibilmente diversi dal resto del testo — dimensione e peso incoerenti, come renderizzati da un altro font. Verificato con `tsc --noEmit`/`eslint`/`ng test` (123/123) puliti, e riprodotto/confermato dal vivo (non solo a tavolino): build SSR reale (`npm run build` + `node dist/app/server/server.mjs`), route `/cdn-cgi/preview` colpita con payload cifrati veri (`PreviewCrypto.encrypt`) pieni di cifre/simboli, output PNG ispezionato. Il primo giro di verifica (stack riordinato, sotto) sembrava sufficiente sulla carta; solo generando un numero consistente di immagini reali attraverso la pipeline vera è saltata fuori la causa server, distinta da quella browser.

- **Causa 1 (browser, es. Safari/iOS)**: `stack()` (`font-system.ts`) componeva ogni font-family CSS come `famiglia, EMOJI, generic-family` — l'emoji SUBITO dopo il font scelto. Apple Color Emoji porta anche glifi di fallback per ASCII/cifre: se il font di progetto (spesso un decorativo/manoscritto senza numerali) non copre un carattere, il browser lo pesca da lì prima ancora di provare la famiglia generica. Riordinato a `famiglia, generic-family, EMOJI`: un carattere mancante trova prima una resa coerente nella famiglia generica, l'emoji resta comunque raggiungibile in coda per i veri emoji. Riguarda `webStack`/`systemFontWebStack`/`customFontWebStack` — resa browser (pagina live, canvas di `ImgBuilderService`).
- **Causa 2 (server, immagini OG — la più seria delle due, riproducibile senza bisogno di Safari)**: `serverStack`/`serverStackForChoice` (consumati da `PreviewBuilder` per rasterizzare via Sharp+librsvg/Pango) riusavano la STESSA stringa del browser, EMOJI incluso. Lì l'ordine non conta: se sull'host di rendering è installato un font emoji reale (es. Noto Color Emoji — presente su molte distro anche senza che il progetto lo scelga), fontconfig risolve "Apple Color Emoji"/"Segoe UI Emoji" (nomi puramente browser, senza file reale) proprio su quello, e Pango — assegnando un font per singolo glifo tra i candidati della fallback chain risultante — può preferire i suoi glifi keycap (cifre e pochi simboli) a quelli corretti della famiglia richiesta, qualunque sia la posizione nello stack. Riprodotto in isolamento (stessa stringa, Sharp/librsvg diretto): cifre/simboli visibilmente diversi dal testo, l'ordine dei tre-quattro elementi non cambia nulla. Nuove `stackServer`/`systemFontServerStack`/`customFontServerFamilyStack` (font-system.ts): stesso stack ma **senza** l'emoji — un'immagine OG pre-renderizzata non ha comunque mai bisogno di un vero glifo emoji a colori. `serverStackForChoice`/`resolveFonts().serverStack`/`systemUiFonts().serverStack` aggiornati di conseguenza.
- `ImgBuilderService.buildCaption`/`buildFittedCaptionCanvas` (fascia scrim con testo sopra/sotto un'immagine): il padding di default orizzontale era `fontSize` (1×) e verticale `fontSize * 0.6` — a ridosso del bordo su righe già al limite di `maxTextW`, poco leggibile. Nuove costanti `CAPTION_PAD_H_RATIO` (1.25×) e `CAPTION_PAD_V_RATIO` (0.75×), usate da entrambi i metodi. Un `paddingH`/`paddingV` esplicito nelle opzioni resta invariato, come sempre. Verificato su ~100 combinazioni sintetiche (3 font reali × 3 larghezze canvas × testi con cifre, incluso un numero lungo senza spazi per forzare lo split carattere-per-carattere): nessuna eccezione/overflow, `paddingH` effettivo +25% garantito in ogni caso.

### og:image: lo sfondo della card testuale torna al colore brand nudo (`colorTema`), non più rinforzato a contrasto WCAG AAA

Lo sfondo passava per due scurimenti in sequenza: `colorPrimary` è già `colorTema` scurito in OKLCH finché non raggiunge 4.5:1 contro il fondo pagina chiaro (tarato per un bottone su pagina chiara, non per rappresentare il brand); `strongFillColor` lo scuriva UNA SECONDA VOLTA per arrivare a 7:1 (AAA) contro nero/bianco puro. Per un `colorTema` scuro la somma è quasi un no-op (parte già oltre soglia), ma per un `colorTema` chiaro i due scurimenti si sommano: un pastello finiva per diventare una card quasi nera, ben oltre quanto un solo passaggio giustificherebbe — riscontrato su più figli.

- `ImgBuilderService.strongFillColor` rimosso (era usato solo da `og-preview.ts`).
- `og-preview.ts`: `strongBgColor` (= `strongFillColor(sitePalette.colorPrimary)`) → `cardBgColor` (= `sitePalette.colorTema`, il brand così com'è), usato sia per la card testuale a schermo intero sia per lo sfondo del badge/chip nella variante con immagine. Il testo overlay resta comunque al contrasto migliore tra nero e bianco (`ImgBuilderService.getReadableTextColor`), la stessa funzione già usata per ogni altro testo su sfondo colorato del sito — nessuna soglia minima garantita (a differenza del 7:1 di prima), accettabile qui perché un brand color è quasi sempre chiaramente chiaro o scuro, raramente un grigio-colorato a metà scala.
- **Eccezione consapevole a "og:image segue sempre la palette del design system attivo"** (vedi voce sotto, `ogImageFollowsPaletteOverrides` rimosso): `colorTema`, a differenza di `colorPrimary`, non risponde a `secondary`/`background`/`text`/`info`/`customPalette`/`backgroundVividness` — la card ora non segue un eventuale override della palette su quell'asse specifico. Scelta deliberata a favore della leggibilità: il colore scritto in `global-settings.json` è sempre quello che appare, senza scurimenti impliciti da spiegare.
- `frontend/README.md` aggiornato (§"Generazione og:image: la rotta `/cdn-cgi/preview`").
- Verificato: `tsc --noEmit` pulito.

### Ruoli custom: registrazione con la propria chiave in `ruoloPagina`, non più `EngineRoleRegistry` (declaration merging)

Registrare un ruolo di pagina in più richiedeva TypeScript declaration merging (`declare module { interface EngineRoleRegistry { sidebar: unknown } }`) in un file separato — corretto (l'unico modo per un file di Dominio di allargare un tipo già usato nell'Engine, verificato anche il perché un `enum` non può sostituirlo: compila ma produce un riferimento `undefined` a runtime) ma percepito come cerimonioso per un'operazione concettualmente semplice. Sostituito con una registrazione a runtime, nello stesso posto in cui si descrive il comportamento del ruolo — il compromesso esplicito: un typo si scopre al boot (`buildSite()`), non più in editor.

- `EngineRoleRegistry` rimosso. `PageRole` è ora `'default' | 'legal' | 'error' | 'naked' | (string & {})` — l'IDE suggerisce comunque i 4 di serie in autocomplete, ma il compilatore accetta qualunque altra stringa senza controllo di tipo.
- Un ruolo nuovo si registra scrivendo la sua chiave in `ruoloPagina` nel patch di `extendDesignSystem` (es. `ruoloPagina: { sidebar: { showNav: false } }`) — la chiave stessa è la registrazione, nessuna dichiarazione a parte e nessun metodo builder.
- **Rete di sicurezza**: `buildSite()` valida ogni `layout.role` contro i 4 di serie più quelli presenti in `ruoloPagina` nel design system attivo (`assertRuoloConosciuto`, `siteBuilder.ts`) — un `layout.role` con un typo (mai type-checked dal compilatore, vedi sopra) fa fallire il build con un errore leggibile invece di ricadere silenziosamente sui default globali.
- **Breaking per chi aveva già usato `EngineRoleRegistry`** (nessun figlio reale a oggi): un `declare module { interface EngineRoleRegistry {...} }` esistente non ha più alcun effetto — va convertito in una chiave in `ruoloPagina` nel patch del design system.

### Design system: `extendDesignSystem` (oggetto piatto) è l'UNICA grammatica, gli 8 preset condivisi hanno nomi skeuomorfici, nessun kit di test dedicato

Un design system, condiviso dall'Engine o scritto per un progetto specifico, si costruisce sempre allo stesso modo: `extendDesignSystem(base, patch)`, un oggetto piatto — nessuna gerarchia a classi, nessun builder, nessun registro nominato scelto per stringa. Prima esistevano DUE grammatiche per lo stesso concetto (una riservata all'Engine: `DesignSystemBase`/`override get` raccolti in `DESIGN_SYSTEM_PRESETS`, scelto con `shell.designSystem: 'nome'`) — nella pratica nessun progetto usava la scorciatoia per nome (tutti passano una factory importata), e nessun preset erediterebbe mai da un altro preset: la garanzia che la gerarchia a classi offriva (il compilatore blocca un getter rinominato) non serviva a nessuno, mentre un oggetto letterale tipizzato `DesignSystemPreset` dà la stessa sicurezza senza `override`/costruttori.

- `DesignSystemBase` e le sue 8 sottoclassi, `DESIGN_SYSTEM_PRESETS`/`DesignSystemPresetName` rimossi: `shell.designSystem` è sempre un `DesignSystemFactory` importato, mai più un nome stringa. Nuovo `emptyDesignSystem` (`design-system-presets.ts`): il punto di partenza minimo per `extendDesignSystem`, nessun campo forzato.
- Gli 8 preset condivisi sono file in `components/shared/design-systems/engine/` — una sottocartella solo per separarli semanticamente dai design system di progetto (stessa `components/shared/design-systems/`), scritti con `extendDesignSystem(emptyDesignSystem, {...})`, la STESSA grammatica, nessun livello privilegiato. Rinominati da nomi tecnici (`adaptive`, `standard`, `locked-dark`, ...) a nomi **skeuomorfici**, la sensazione fisica del preset invece del valore dei suoi campi — stessa logica con cui `muro` (il caso che ha motivato `backgroundVividness`) era già chiamato così: `Aria` (`adaptive`, nessun campo forzato), `Carta` (`standard`, pannello sempre chiaro — il default), `Lavagna` (`adaptive-dark-panel`, pannello sempre scuro), `Notte` (`locked-dark`, tono fisso scuro), `Giorno` (`locked-light`, tono fisso chiaro), `Lanterna` (`locked-dark-accent-panel`, un bagliore chiaro nel buio), `Ombra` (`locked-light-accent-panel`, una macchia scura sul chiaro), `Muro` (invariato).
- **Fix**: `mergeDesignSystemPreset` (usata da `extendDesignSystem`) fondeva `ruoloPagina` solo sui 3 ruoli di serie (`default`/`legal`/`error`) — un ruolo custom mappato nel preset base spariva in silenzio al primo `extendDesignSystem`, nessun errore né warning. Ora fonde ogni ruolo presente da un lato o dall'altro, qualunque sia.
- **Rimosso il kit di test dedicato ai design system** (`design-systems.spec.ts` — auto-discovery WCAG/struttura via `import.meta.glob`, `demo.design-system.spec.ts`/`example.design-system.spec.ts`, `assertDesignSystemAccessible` in `core/engine/testing/design-system-testing.ts`, e infine anche `theme.service.spec.ts` — tutti scritti nella stessa sessione): testavano il CONTENUTO di file (demo, esempio, gli 8 preset condivisi) o rifacevano un contrasto-brand su decine di colori ipotetici, entrambi già coperti altrove — il contrasto WCAG di una palette specifica è una scelta estetica cambiabile in qualunque momento, non un invariante dell'Engine da proteggere con un test unitario, e l'audit live (`scripts/test/live-audit.mjs`, Pa11y WCAG 2.1 AA su ogni pagina scoperta della build reale) già verifica il colore effettivamente configurato end-to-end, non un campione sintetico. La correttezza STRUTTURALE di qualunque design system resta garantita a runtime da `validateDesignSystemPreset`, chiamata da `extendDesignSystem` a ogni resolve. `design-system-presets.spec.ts` resta l'UNICO file di test del frontend: riscritto per usare solo fixture sintetiche (`emptyDesignSystem`, letterali `DesignSystemPreset`), copre il MECCANISMO dell'Engine (merge, catene di extend, ruoli custom, master lock, font), mai il contenuto di un file specifico.
- Commenti in `design-system-presets.ts`/`siteBuilder.ts` sfoltiti a ≤3 righe (erano diventati un muro di prosa, es. `PageRole` superava le 30 righe): il dettaglio/perché resta in frontend/README.md, il commento inline resta un puntatore leggibile in hover/IntelliSense.
- `frontend/README.md`/`AGENTS.md` aggiornati: nessun riferimento a classi/registro/kit di test, ogni esempio importa un preset condiviso per nome di file (`components/shared/design-systems/engine/<nome>.design-system.ts`).
- **Breaking per chi avesse scritto `shell.designSystem: 'nome'` o una classe che estende `DesignSystemBase`** (nessun figlio reale a oggi): il nome stringa va sostituito con l'import della factory omonima (rinominata secondo la tabella sopra); una classe propria va riscritta come `extendDesignSystem(emptyDesignSystem, {...})` — stesso `DesignSystemPreset` risultante, cambia solo la sintassi.
- Verificato: `tsc --noEmit`, `eslint`, `ng test` puliti (65/65, 1 file spec). Dal vivo in browser: `/che-faccio` (ruolo custom `vetrina`) senza breadcrumb contro `/social-feed` (default) con breadcrumb, un design system custom scritto su due colpi (`extendDesignSystem(lanternaDesignSystem, {...})` con palette/font/ruolo propri) renderizzato correttamente, e un `layout.role` non registrato (`vetrina` su un design system che non lo mappa) che fa fallire il boot con l'errore atteso — la rete di sicurezza regge anche dopo il rename.

### `backgroundVividness: number` sostituito da `superfici: 'distinte' | 'fusione'` — un solo campo invece di due da tenere sincronizzati a mano

"Vividezza" (un numero 0-1) era un nome difficile da spiegare senza già conoscerne la matematica interna — e viveva come campo indipendente da `showPanel`, anche se nella pratica i due erano sempre la stessa decisione: se le superfici (pannello, navbar/footer, hover, bordi) diventano TUTTE il colore esatto del brand (`muro`), un pannello di un colore diverso vanificherebbe la fusione, uno dello stesso colore sarebbe indistinguibile dal resto — "nessun pannello" è la conseguenza sensata, non una seconda decisione da ricordarsi di allineare a mano (`muro.design-system.ts` doveva scrivere `backgroundVividness: VIVIDEZZA_PIENA` **e** `showPanel: false` separatamente).

- `DesignSystemPreset.backgroundVividness` rimosso, sostituito da `superfici?: 'distinte' | 'fusione'` — `'distinte'` (default): ogni superficie resta un grigio/nero/bianco appena tinto, ben separata dalle altre. `'fusione'`: tutte diventano il colore esatto del brand, un unico campo di colore continuo — E implica `showPanel: false` se non impostato esplicitamente (nuovo `effectiveShowPanel` in `siteBuilder.ts`, usato sia dal master lock sia dal default globale di `SiteConfig.showPanel`).
- Sotto il cofano la matematica non cambia: `superfici: 'fusione'` risolve nello stesso `backgroundVividness: 1` di sempre per `ThemeService.computePalette` (`SiteConfig.backgroundVividness`, il campo RISOLTO, resta un numero — nessun cambiamento per chi consuma quello, es. `og-preview.ts`/`generate-statics.ts`). `VIVIDEZZA_NEUTRA`/`VIVIDEZZA_PIENA` restano esportate da `design-system-presets.ts` come i due valori dietro le quinte, non più come API pubblica del preset.
- `validateDesignSystemPreset` perde il controllo di range su `backgroundVividness` (0-1): non serve più, `superfici` è un'unione a due stringhe — un valore diverso da `'distinte'`/`'fusione'` non è nemmeno esprimibile senza bypassare i tipi.
- `muro.design-system.ts`: `backgroundVividness: VIVIDEZZA_PIENA, showPanel: false` → `superfici: 'fusione'` (una riga invece di due).
- **Breaking per chi avesse scritto `backgroundVividness` in un proprio design system** (nessun figlio reale a oggi): il campo non esiste più su `DesignSystemPreset`. Migrazione: `backgroundVividness: 1` → `superfici: 'fusione'` (e puoi togliere un `showPanel: false` scritto a fianco, ora implicito); nessun valore intermedio (`0.3`, ecc.) è più esprimibile — nessun caso reale l'ha mai usato.
- Verificato: `tsc --noEmit` pulito.

### `ogImageFollowsPaletteOverrides` rimosso: l'og:image segue sempre la palette del design system attivo

Il toggle esisteva per tornare a un calcolo "neutro" (solo `colorTema`, nessun override) invece di ereditare l'intera palette del sito — ma nessun preset condiviso lo aveva mai impostato a `false`, e la card di anteprima social è una decisione di sito quanto qualunque altro colore: non ha senso che possa scostarsi dal resto della UI. Rimosso in favore di un unico comportamento, sempre attivo.

- `DesignSystemPreset.ogImageFollowsPaletteOverrides` e `SiteConfig.ogImageFollowsPaletteOverrides` rimossi. `og-preview.ts` calcola `sitePalette` sempre con tutti gli override (secondario/sfondo/testo/info/customPalette/vividezza), senza più il ramo "neutro".
- `ogImagePlain` (se l'og:image mostra solo lo sfondo senza scritte) resta invariato — è una decisione indipendente, non legata alla palette.
- **Breaking per chi avesse scritto `ogImageFollowsPaletteOverrides: false`** (nessun figlio reale a oggi): il campo non esiste più, l'og:image eredita sempre la palette del design system attivo.
- Verificato: `tsc --noEmit` pulito.

### Aspetto e struttura del sito: dal JSON e da flag sparsi in `site.ts` a un design system con ruoli di pagina

L'estetica (colori, smoke) viveva in `global-settings.json` (`site.colorSecondary`/`colorBackground`/`colorText`/`colorInfo`/`site.smoke`); la struttura per pagina (nav/footer/pannello/breadcrumb/fade) viveva come flag sparsi — `layout.showNav`/`showFooter`/`showPanel`/`fitViewport`/`showSmoke`/`showBreadcrumb`/`pageFade` per singola pagina, `shell.showNav`/`showFooter`/`showPanel`/`showBreadcrumb`/`fixedTopHeader`/`panelForcedLight`/`pageFade` a livello di sito. Due fonti di verità per lo stesso concetto (pagina e sito potevano scostarsi in modi non sempre prevedibili), e un colore di progetto in un file JSON separato da tutto il resto dell'aspetto. Riunito in un solo posto: il design system attivo decide COME appare il sito, la pagina dichiara solo CHE COSA è.

- `global-settings.json`/schema: `site.colorSecondary`/`colorBackground`/`colorText`/`colorInfo`/`site.smoke` rimossi — `site` resta solo `description`+`colorTema`, l'unica identità/estetica minima di progetto. Tutto il resto è un campo di `DesignSystemPreset` (`design-system-presets.ts`, nuovo file, estratto da `siteBuilder.ts`).
- `siteBuilder.ts`: `ShellFlags` rinominato `RouteChrome` (`SHELL_DATA_KEY` → `CHROME_DATA_KEY`); `LeafPageInput.layout` perde tutti i flag di rendering, sostituiti da un solo `role?: PageRole`; `SiteShellConfig` perde gli stessi flag a livello di sito, sostituiti da `designSystem?: DesignSystemFactory`. Ogni ruolo (`SpecRuoloPagina`) decide nav/footer/pannello/fitViewport/smoke/breadcrumb/fade/icona di brand, con un interruttore MASTER sul campo globale omonimo del design system quando esplicitamente `false` — vedi frontend/README.md §"Ruoli di Pagina".
- `ShellNavResolver.brandIcon`: prima `boolean | string` (decideva sia QUALE icona sia SE mostrarla); ora solo `string` (QUALE) — SE mostrarla è `DesignSystemPreset.showBrandIcon`/`ruoloPagina.<ruolo>.showBrandIcon`, stessa regola di nav/footer/pannello.
- **Breaking, tocca ogni pagina/sito esistente**: un `layout.showNav`/`shell.pageFade`/`shell.panelForcedLight`/... in `site.ts` non compila più. Migrazione: sposta quei valori in un `ruoloPagina` (per ruolo di pagina) o in un campo diretto del design system (per l'intero sito) — vedi frontend/README.md §"Ruoli di Pagina"/§"Preset di Design System".
- Verificato: `tsc --noEmit` pulito su tutto il repo.

### Font: da file dedicato (`font-config.ts`) a campo del design system attivo

Il font era l'ultimo pezzo di estetica rimasto fuori dal design system: `frontend/src/styles/font-config.ts` esportava `siteFonts` (`webDefault`/`serverDefault`/`custom`), tenuto in un file di progetto separato apposta "per non generare conflitti di merge quando il template aggiorna il catalogo" — ma la tipografia è una decisione estetica come colore/pannello/nav, non merita un file a sé quando tutto il resto vive già nel design system.

- `font-config.ts` rimosso. `DesignSystemPreset` guadagna `webFont`/`serverFont`/`customFont` (i cataloghi `WEB_FONTS`/`ServerFont` in `font-system.ts` restano invariati); `siteBuilder.ts` risolve una volta sola in `ContestoSito.config.fonts` (`ResolvedFonts`), unica fonte per `ThemeService`/`server.ts`/`ImgBuilderService`/`PreviewBuilder`.
- `customFont` sostituisce ora ENTRAMBI `webFont`/`serverFont` senza un fallback intermedio sul font di sistema: prima un font custom si aggiungeva IN TESTA allo stack col default ancora presente come ripiego; ora, se il file dichiarato manca, il fallback salta dritto alla famiglia generica (sans-serif/emoji) — un font custom sostituisce la scelta, non si affianca a un default.
- **Breaking per chi avesse editato `font-config.ts`**: il file non esiste più. Migrazione: sposta `webDefault`/`serverDefault`/`custom` nel patch di `extendDesignSystem` del proprio design system (`webFont`/`serverFont`/`customFont`).
- Verificato: `tsc --noEmit` pulito.

### OG image: un font custom con family diversa dal nome interno fontconfig non ripiegava più in silenzio sul font di sistema

Sharp/librsvg (il motore che disegna le anteprime social) risolvono i font tramite fontconfig, che indicizza ogni font con un proprio nome interno — non necessariamente uguale alla `family` scelta in `customFont: { family, file }` (quella stringa è solo l'etichetta `@font-face` per il browser, legata all'URL del file). Se le due stringhe non coincidevano, l'SVG chiedeva a fontconfig un nome che non esisteva e ripiegava in silenzio sul font di sistema, pur avendo il file corretto sotto mano — nessun errore, solo un'anteprima social col font sbagliato.

- `custom-font-detect.ts`: nuovo `customFontServerFamily` (esegue `fc-scan --format '%{family[0]}\n'` sul file per leggere il nome REALE che fontconfig usa; `null` se `fc-scan` non è installato, es. `ng serve` locale su Windows) e `customFontServerStack` (come `config.fonts.serverStack` ma con la family sostituita da quella reale, se trovata). `preview-builder.ts` usa ora questo stack al posto di quello generico.
- Nessun cambiamento per chi non usa `customFont`, né per chi lo usa già con `family` coincidente col nome interno del font.
- Verificato: `tsc --noEmit` pulito.

### Footer: builder esteso oltre i link (`addField`/`addText`/`addSocialLink`/`addCustom`), `itemClass` su ogni voce

Il footer condivideva lo stesso builder dell'header (`addPage`/`addLink`/`addGroup`) — sufficiente per un menu di link, ma un footer istituzionale porta anche dati di identità (P.IVA, sede legale, orari...), testo libero, e contenuto arbitrario di progetto: prima andavano forzati dentro un `addLink` innaturale, o scritti a mano fuori dal builder.

- Nuovo `FooterSectionBuilder`/`FooterGroupBuilder` (`shell-nav.ts`): dentro un gruppo, oltre ad `addPage`/`addLink`/`addGroup`, si aggiungono `addField(FooterField.<Campo>, {itemClass?})` (nuovo enum `FooterField` in nuovo `footer-content.ts` — 19 campi da `Identity`, es. `PartitaIva`/`CodiceFiscale`/`SedeLegale`/`OpeningHours`; auto-nascosto se l'identità del sito non valorizza quel campo — "l'Engine possiede per intero la forma di `Identity`, il figlio non deve conoscere né la chiave di traduzione né la forma esatta"), `addText(label, value, {itemClass?, kind?, skipEmptyValue?})` (coppia libera, il `value` non è mai tradotto — è un dato), `addSocialLink(url, label?, {itemClass?, authOnly?})` (deliberatamente NON un `FooterField`: quali profili social mostrare è una scelta di progetto, mai dedotta in blocco da `identity.social`), `addCustom(component, {inputs?, itemClass?, authOnly?, key?})` (escape hatch via `NgComponentOutlet`, stesso ruolo di `kind: 'raw'` in `structured-data.ts`).
- Nuovo `FooterSectionBuilder.hideLegalStrip()`: spegne la striscia automatica delle pagine legali in `footer.component.ts`, per chi preferisce inserirle a mano in un gruppo custom.
- Nuovo `itemClass?` opzionale su OGNI voce di nav/footer (header incluso): una classe in più sul contenitore della singola voce, che si aggiunge allo stile di default senza sostituirlo.
- `ShellNavContext` guadagna `identity: Identity | null`, passato anche al resolver del footer (prima solo lingua/login) — permette a `nav.ts` di filtrare `identity.social` da sé (es. solo LinkedIn) invece di mostrarli tutti.
- **Fix, 2 bug reali in `shell-nav.service.ts`**: l'`effect` che ririsolve nav/footer/brandIcon era agganciato solo a lingua+login — su idratazione, `loading()` poteva leggere `false` un istante prima che `identity()` riflettesse il valore vero, congelando il footer con `identity: null` per sempre; ora l'effect include anche `identity() !== null`. `TransferState.set(...)` veniva chiamato anche dal browser (non solo da SSR), armando stato residuo per il resolve successivo; ora guardato da `if (!isBrowser)`.
- Nuova validazione dev-only `validateFooterBreadth` (avviso oltre 6 gruppi/50 voci totali, citando le linee guida UXPin sul footer design) accanto a `validateFooterDepth` (stesso tetto di profondità dell'header, duplicato apposta per non far dipendere l'header dai tipi del footer).
- **Breaking per chi avesse un resolver footer personalizzato**: il tipo del builder passato al resolver è cambiato (`FooterSectionBuilder` invece del `NavSectionBuilder` condiviso con l'header) — `addPage`/`addLink`/`addGroup` restano identici, le nuove funzioni sono in più.
- Verificato: `tsc --noEmit` pulito.

### Navbar: dropdown con altezza calcolata, tasto Escape, e due bug di overflow risolti

Il dropdown della navbar aveva più problemi trovati testando dal vivo: un sottomenu flyout invisibile o tagliato dall'overflow del pannello padre, uno scrollbar verticale spuria quando il flyout non ci stava, un pannello che poteva uscire dal viewport verso il basso senza scroll, e nessun modo da tastiera di richiuderlo con Escape (pattern ARIA menu-button).

- `_dropdown.scss`/`_submenu.scss`: `.navbar .dropdown-menu:has(.dropdown-submenu:hover, :focus-within, .expanded) { overflow: visible; }` — risolve overflow-x e overflow-y insieme (CSS non permette di tagliare un asse e lasciare libero l'altro sullo stesso elemento): quando un flyout di terzo livello è attivo, il pannello padre torna visibile invece di tagliarlo o generare uno scrollbar spuria.
- `nav-dropdown.component.ts`: nuovo `updateMaxHeight()` calcola lo spazio reale sotto il toggle (`window.innerHeight - rect.bottom - 16px`, minimo 160px) e imposta `--dropdown-max-height` all'apertura — un pannello lungo scrolla invece di uscire dal viewport.
- `min-width: min(18rem, 90vw)` / `max-width: min(28rem, 90vw)` sul pannello (prima solo `width: auto` + `white-space: normal`, che non allarga un pannello shrink-to-fit) — una voce con testo lungo va a capo invece di allargare il pannello a dismisura o tagliare il testo.
- `navbar.component.ts`: nuovo listener `(document:keydown.escape)` chiude qualunque dropdown di nav/lingua aperto e restituisce il focus al suo toggle (pattern ARIA menu-button) — senza `stopPropagation`, così un Escape che serve anche ad altro (es. chiudere una modale) continua a propagarsi.
- `outline: none` rimosso dal focus della voce dropdown (violava WCAG 2.4.7 — indicatore di focus da tastiera sempre visibile).
- Verificato dal vivo in browser durante lo sviluppo (flyout visibile, niente scrollbar spuria, pannello lungo scrolla, Escape chiude e restituisce il focus); `tsc --noEmit` pulito.

### `UserNavComponent`/`LoginFormComponent` passano da Engine a Dominio; `BaseLoginFormComponent` per personalizzare il login senza riscrivere submit/loading/errori

`user-nav.component.ts` e la variante base di `login-form.component.ts` vivevano in `core/engine/components/` — codice Engine, quindi in teoria "non da modificare", ma in pratica i due punti dove un progetto ha quasi sempre bisogno di intervenire (un avatar diverso, un campo username visibile invece che nascosto). Spostati in `components/shared/` (Dominio) come "contratto fisso" — path e selettore garantiti stabili (`navbar.component.ts` li importa per nome esatto), il contenuto è libero di cambiare.

- `components/shared/user-nav/`: spostato verbatim da `core/engine/components/user-nav/` (nessuna logica cambiata, solo il percorso).
- Nuovo `BaseLoginFormComponent` (astratto, `core/engine/components/base/`) accentra `AuthService`/`TranslateService`, il form reattivo (`username`/`password`), `isLoading`/`errorMessage`, `onSubmit()` e l'output `loggedIn` — un progetto che vuole un markup diverso (es. campo username visibile, come la nuova variante in `components/shared/login-form/`) scrive solo il proprio template, non riscrive submit/loading/errori. `core/engine/components/login-form/` (il default Engine) ora estende questa base; `pages/login/login.component.ts` consuma la variante di Dominio.
- Nuovo `identity-format.ts`: `hasText`/`formatAddress`/`formatCurrency`/`countryName`/`BadgeTone` estratti da `identity-render.component.ts` (che li importa invece di ridichiararli) — servono anche a `footer-content.ts` (`addField`, sopra), che formatta un indirizzo o una valuta esattamente come `app-identity-render`, non con una seconda implementazione copiata a mano.
- **Breaking per chi avesse importato `UserNavComponent` dal vecchio percorso Engine**: `core/engine/components/user-nav/` non esiste più, il percorso è `components/shared/user-nav/`.
- Verificato: `tsc --noEmit` pulito.

### "Design System Gallery" rinominato "Style Guide" — libera il nome per il vero `DesignSystemPreset`

Il catalogo visivo di colori/tipografia/bottoni/badge/alert/form si chiamava `design-system-gallery`/`app-design-system-gallery` — un nome che, dopo aver introdotto il vero concetto di design system (`DesignSystemPreset`, sopra), avrebbe generato confusione fra "la pagina che mostra i colori" e "il sistema che li decide". Nessun cambiamento di contenuto o comportamento, solo il nome.

- `design-system-gallery.component.ts`/`.html` rimossi, sostituiti da `style-guide.component.ts`/`.html` (stesso contenuto). Selettore `app-design-system-gallery` → `app-style-guide`.
- i18n rimossa dal componente (12 chiavi tolte da `basic.it.json`/`basic.en.json`): un catalogo di nomi di classi Bootstrap non è contenuto utente da tradurre, e il suo pubblico (chi implementa o fa design review) legge comunque una sola versione.
- Verificato: `tsc --noEmit` pulito, i18n-check pulito (nessuna chiave orfana).

### Docs: limiti e comportamenti impliciti di feature già esistenti (lightbox, blob, notifiche, error reporting, og:image, cache immagini, ImgBuilderService), fix di un esempio `ogImage` obsoleto

Diverse feature dell'Engine hanno un comportamento con un costo o un limite reale (richieste di rete aggiuntive, tetti impliciti, fallback silenziosi) che viveva solo come commento nel codice sorgente, mai risalito alla documentazione consumabile — trovato ripartendo da una domanda su un caso specifico (il lightbox immagini) e poi verificato più in ampiezza sull'intero Engine.

- Nuova sezione `ENGINE.md` § "Limiti e comportamenti impliciti": indice rapido di sette comportamenti non ovvi, ciascuno con il link al README dove ora vive il dettaglio pieno.
- `frontend/README.md`: risoluzione sempre massima (1920px) del lightbox indipendentemente dalla width della miniatura, apertura programmatica di `ImageLightboxService`; nuova sezione `OgImageRef: asset statico o blob dinamico` (feature `{ blobGuid }` esistente ma finora non documentata affatto, col relativo costo — doppio fetch di fallback, doppia decodifica `sharp` — se l'originale supera il tetto di decodifica del blob storage); tetto di concorrenza `IMAGE_JOBS_MAX` sui job `sharp` (mai citato, nemmeno in `DOCKER_README.md`); clamp dimensionale silenzioso e canvas "tainted" su CORS mancante in `ImgBuilderService`.
- `backend/README.md`: tetto di 40 megapixel su `GET /blob/{slug}?webopt=true`, indipendente da `MaxUploadSizeBytes`; buffer per-connessione delle notifiche SSE (100 messaggi, `DropOldest`) e perché `Publish()` ritorna comunque `true` su uno scarto silenzioso; assenza di throttling/deduplica nell'error reporting (server e client) e `BackgroundQueue.TryEnqueue` non controllato nei due punti in cui l'Engine stesso accoda una segnalazione.
- **Fix**: l'esempio di `otherSEO` in `frontend/README.md` usava ancora `ogImage: 'og-cover'` (stringa nuda) — non compila più da quando `OgImageRef` è diventato `{ id } | { blobGuid } | false`. Sostituito con `{ id: 'og-cover' }`, scoperto proprio scrivendo la nuova sezione su `blobGuid`.
- Verificato: ogni comportamento aggiunto confrontato riga per riga col codice sorgente citato prima di scriverlo (non solo il finding di un agente di ricerca); grep mirato sui cinque file di documentazione per confermare l'assenza prima dell'aggiunta, evitando duplicati.

### Fix: pulsante di chiusura del lightbox tagliato fuori dal viewport su immagini alte

Il pulsante era posizionato 2.75rem sopra l'immagine: con un'immagine verticale o una finestra bassa (poco spazio libero sopra il contenuto centrato), finiva quasi del tutto fuori dal viewport invece che solo più vicino al bordo.

- Il pulsante resta ora sempre sovrapposto dentro l'angolo in alto a destra dell'immagine, come già accadeva solo sotto i 480px — rimossa la media query, unico comportamento per ogni dimensione.
- Verificato dal vivo: riprodotto il taglio con una finestra bassa (550px), confermato risolto dopo il fix; nessuna regressione a dimensione normale.

### `Security.ApiConfig`: chiavi API e rate limiting raggruppati, soglie non più hardcoded nell'Engine

Le chiavi API e le soglie del rate limiter erano due proprietà indipendenti direttamente sotto `Security` — le seconde, per giunta, costanti scritte in `Engine/Security/SecurityExtensions.cs`: per cambiarle un figlio doveva modificare un file dell'Engine, perdendo l'edit al primo merge dall'upstream. Concettualmente sono la stessa cosa (chi entra nell'API e quanto può chiamarla), ora raggruppate in un unico `Security.ApiConfig`.

- **Breaking**: `Security.ApiKeys` è ora `Security.ApiConfig.Keys`. Migrazione: sposta l'array dentro un nuovo oggetto `ApiConfig` in `global-settings.local.json` (e nell'example) — `setup.mjs`, `scripts/deploy.sh`/`deploy-release.sh` e `scripts/lib/br1-config.sh` generano già la forma nuova.
- Nuova `Security.ApiConfig.RateLimiting`: `Global.PermitLimit`/`WindowSeconds` per la soglia generale, `Login.PermitLimit`/`WindowSeconds` per `POST /auth/login`, `Enabled: false` per disattivare del tutto l'enforcement (le policy restano registrate — `[EnableRateLimiting("login")]` continua a risolvere — solo senza effetto pratico: pensato per chi ha già un WAF/reverse proxy che applica le proprie soglie a monte). Senza questa sezione in config, i default sono 500 req/min globali e 5 req/min sul login, enforcement attivo — il tetto globale è più alto di quanto sembri necessario di primo acchito apposta: una singola pagina con una decina di immagini dinamiche (`GET /blob/{slug}`) più le chiamate API di corredo può avvicinarsi rapidamente a un tetto stretto anche per una sessione di navigazione normale, non solo per abuso.
- `AddTemplateSecurity` (`Program.cs`) accetta ora un `Action<RateLimiterOptions>` opzionale, invocato per ultimo dentro `AddRateLimiter`: un progetto che vuole andare oltre i due numeri (partizionare per utente invece che per IP, un algoritmo diverso, policy aggiuntive per un proprio endpoint) riceve le stesse `RateLimiterOptions` e può aggiungervi o sovrascriverne membri, senza toccare l'Engine.
- Verificato: `dotnet build` backend pulito, `tsc --noEmit` frontend pulito. Dal vivo con curl: API key letta dal nuovo percorso (200 con chiave valida, 401 senza); soglia globale abbassata a 2-3/min → 429 dalla richiesta successiva al limite; `Enabled: false` → nessun 429 né sulla soglia globale né su quella di login, anche molto oltre i default; nessuna sezione `ApiConfig.RateLimiting` in config → comportamento di sempre invariato.

### Storage blob: da implementazione di Dominio a `FileBlobStore`/`EngineBlobController` dell'Engine, con proprietà tracciata (EF Core/SQLite)

Il vecchio `BlobStore`/`BlobController` viveva nel Dominio (`Store/`, `Controllers/`), un file di progetto che ogni figlio possedeva e modificava direttamente — ma lo storage binario è I/O generico con un'unica implementazione plausibile, non una forma specifica di progetto come `IContentStore`: teneva il figlio a carico di un pezzo che non doveva scegliere, e senza nessun controllo su CHI potesse cancellare cosa.

- Nuovo `FileBlobStore` (Engine, `Engine/Blob/Blob.cs`): classe concreta (non interfaccia, YAGNI — un'interfaccia sarebbe cerimonia senza un secondo storage reale all'orizzonte), metodi `virtual`: `SaveAsync`/`GetInfoAsync`/`OpenReadAsync`/`DeleteAsync`/`ReplaceAsync`, più `MaxUploadSizeBytes` (proprietà, non config: un progetto può cambiare il numero o l'intera logica di calcolo — per ruolo utente, piano dell'account...). `EngineBlobController` (Engine, `sealed`) espone `GET`/`POST up`/`PUT {slug}`/`DELETE {slug}` su `/blob`: nessun controller di dominio da scrivere, nessuna sottoclasse per servire altri binari.
- `Store/AppBlobStore.cs` (di progetto, come `AppIdentityStore.cs`) estende `FileBlobStore`: passthrough di base su tutto, override mirati dove serve. Aggiunge il controllo di proprietà sulla `DELETE`/sostituzione: solo chi ha caricato lo slug (o un utente con ruolo `admin`) può cancellarlo, tracciato da nuovo `BlobOwnershipRegistry` su nuovo `AppDbContext` — EF Core, SQLite (`db/app.db`, cartella separata da `uploads/` apposta). Uno slug senza proprietario registrato (caricato prima che il registro esistesse) non blocca nessuno, permissivo di default.
- "Modifica" = `ReplaceAsync` (salva il nuovo, poi cancella il vecchio): lo slug resta immutabile per non rompere `Cache-Control: immutable` sulla `GET`. Cancellazione in due passi separati (autorizzazione senza effetti collaterali, poi commit database e SOLO SE il file esiste davvero cancellazione fisica) — mai una riga "cancellato" per un'operazione che di fatto non ha fatto nulla, mai il file sparito prima che il database lo sappia. Un file orfano dopo un crash fra i due passi viene ripulito da `AppBlobStore.CleanupOrphanedFilesAsync()`, uno sweep all'avvio.
- `MaxUploadSizeBytes` essendo ora runtime (non più un `[RequestSizeLimit]` fisso a compile-time) da solo non basta: il tetto di default del server (Kestrel/IIS, ~28-30 MB) rifiuterebbe comunque la request con un errore generico prima che il controllo puntuale scatti. Nuovo `DynamicUploadSizeLimitFilter` alza il tetto del server al valore corrente prima del model binding (con un margine per l'overhead multipart) e, se il client dichiara già un `Content-Length` chiaramente eccessivo, risponde subito con un 413 strutturato/localizzato senza nemmeno iniziare a leggere il body.
- `RequireLogin` combina API Key + JWT Bearer sulla stessa policy: una richiesta senza alcun Bearer (ma con API key valida) risultava comunque "autenticata" per ASP.NET Core — basta che UNO dei due schemi abbia successo — quindi il fallimento del requisito sul ruolo diventava un 403 invece di un 401, anche senza aver presentato nessun token. Nuovo `LoginChallengeResultHandler` (Engine) forza 401 quando specificamente il JWT non ha superato l'autenticazione; un token valido ma senza il ruolo richiesto resta correttamente 403.
- **Breaking per ogni figlio che aveva esteso `Store/BlobStore.cs`/`Controllers/BlobController.cs`:** entrambi i file sono rimossi. Migrazione: sposta le tue validazioni/override in `Store/AppBlobStore.cs` (già presente, stesso pattern di `AppIdentityStore.cs`); se sovrascrivevi solo il limite di dimensione via `[RequestSizeLimit]`, sovrascrivi ora `MaxUploadSizeBytes`.
- Verificato: `dotnet build` backend pulito (0 warning, 0 errori). Dal vivo con curl contro un'istanza reale: upload/get/put(replace)/delete nel percorso normale; ownership negata per un non-proprietario su delete e su replace (JWT forgiato per un utente inesistente, nessun secondo account demo disponibile) e concessa per un admin, senza orfani lasciati sul tentativo negato; upload a 35/50/60 MB per verificare il margine sul tetto del server e il 413 anticipato; sweep degli orfani su un caso simulato, un file davvero non tracciato (sopravvive) e una cancellazione normale (non lascia nulla); 401 senza Bearer su upload/delete, 403 invariato su un JWT valido ma senza i permessi giusti.

### Lightbox per immagini (CDK Overlay, WAI-ARIA)

Un'immagine a piena risoluzione non aveva modo di aprirsi ingrandita se non navigandoci sopra o aprendola in un'altra scheda.

- `ImageLightboxService` (Engine, CDK Overlay: backdrop, scroll block, chiusura su Escape/backdrop-click, focus trap e ripristino) apribile da due punti: `[appAssetLightbox]="true"` su `AssetDirective` (per un `[appAsset]` risolto da `AssetService`) e `[appLightbox]="miaBlob()"` su nuova `LightboxDirective` (per un `Blob` locale, es. un canvas — l'opt-in è la presenza stessa del `Blob`, niente flag separato). Entrambe condividono l'attivazione (cursore/tabindex/role/tastiera) via nuova `LightboxActivatable`, così un fix di accessibilità su una vale anche per l'altra.
- `role="button"` sull'`<img>` (necessario per l'attivazione da tastiera) fa calcolare il nome accessibile con l'algoritmo generico invece di quello specifico di `<img>`: `alt` da solo smette di contare. `LightboxActivatable` specchia `alt` su `aria-label` quando l'affordance è attiva — trovato da un fallimento CI reale (pa11y, WCAG2AA.4_1_2/H91.Img.Name) dopo il merge iniziale, non in review.
- Verificato: build di produzione frontend (type-check incluso); dal vivo in browser su entrambi i punti di attivazione (apre, Escape chiude, focus torna); pa11y in locale sulla stessa pagina che aveva fallito in CI — riprodotto l'errore rimuovendo temporaneamente l'`aria-label` (stesso identico messaggio), confermato sparito col fix.

### Icona di brand in navbar e `og:image`/`twitter:image` da un blob dinamico

Il flag statico `showBrandIconInHeader` (booleano fisso in `site.ts`, build-time) non lasciava spazio per un'icona diversa dal favicon calcolata a runtime, né per un'immagine di anteprima social diversa da un asset compilato nel bundle — utile per un contenuto dinamico (un articolo, un progetto) che porta la propria immagine senza che nulla vada registrato a build time.

- `showBrandIconInHeader` **rimosso**, sostituito da `ShellNavResolver.brandIcon` (nuovo campo opzionale, risolto a runtime insieme a `header`/`footer`): `true`/assente → `favIcon` di sempre, `false` → nessuna icona, una stringa → chiave `mapping.json` o GUID di un blob, stessa risoluzione "mapping poi blob" già usata da `cdn-asset.ts`.
- Nuovo `OgImageRef` (`{ id?, blobGuid? }`) per `og:image`/`twitter:image`: `id` resta un asset statico, `blobGuid` risolve a runtime da `og-preview.ts` via `GET blob/{guid}`. Nuovo hook `SiteConfig.resolveBlobImageUrl` (default: convenzione `blob/{guid}?webopt=true`) — un figlio con un endpoint blob diverso sovrascrive solo questo, l'Engine non assume mai la forma dell'URL.
- **Breaking per ogni figlio con `showBrandIconInHeader` in `site.ts`:** al merge, la proprietà non esiste più. Migrazione: se serve un'icona diversa dal favicon, dichiara `brandIcon` in `nav.ts`; se bastava il comportamento di sempre, basta rimuovere la riga.
- Verificato: build di produzione frontend (type-check incluso).

### `OpeningHours`: sempre da codice, mai nello schema di `identity.json`

Orari operativi cambiano per motivi stagionali/di festività più spesso di quanto sia ragionevole legarli a un deploy — restava comunque un campo dello schema, valorizzabile a mano nel file.

- `openingHours` rimosso da `identity.schema.json` (e dal file demo `identity.json`, che lo aveva ancora popolato — violava lo schema aggiornato). Resta un campo di `SiteIdentity` in C#: si valorizza sempre via `AppIdentityStore.ComposeIdentityAsync` (già il punto documentato per comporre l'identità da fonti diverse dal file).
- Verificato: `dotnet build` backend pulito; JSON di schema e dati validati.

### `ExternalPageInput.requiresAuth` tipizzato a `never`

Il campo compilava su una pagina esterna ma non aveva alcun effetto: un link esterno non passa da `routing.ts` (nessun `canActivate` da applicare).

- `requiresAuth?: never` su `ExternalPageInput`: errore a compile-time invece di un flag silenziosamente ignorato. Per nascondere la voce a chi non è loggato resta `authOnly` su `addLink`.
- Verificato: `tsc --noEmit` pulito.

### `llms.txt`: da file generato al build a endpoint runtime, con pagine dinamiche (`dynamicParams`)

Come `sitemap.xml`, `llms.txt` generato a build time perdeva del tutto le pagine parametriche (i cataloghi dinamici) perché non enumerabili al build. È stato quindi promosso da asset statico a rotta dinamica.

- `public/llms.txt` **non è più generato da `generate-statics.ts`**: `llms.txt` è ora un endpoint (`GET /llms.txt`, `server/routes/dynamic-sitemap.ts`), montato nel Node SSR prima dello static handler. Ripete esattamente l'architettura collaudata per la sitemap: si unisce alle pagine statiche usando la stessa logica di `dynamicParams` interrogando il backend a runtime.
- **Condivisione cache e logica**: Usa la stessa cache e logica di invalidamento via `POST /internal/revalidate-sitemap` introdotta per la sitemap.
- **Breaking, solo se l'infrastruttura di deploy assume `llms.txt` come file statico**: stesso disclaimer di `sitemap.xml`. Un CDN che by-passa il Node SSR per file `.txt` potrebbe restituire 404 se non instradato correttamente.
- Verificato: build di produzione frontend e type-check puliti.


### Error tracking client-side: le eccezioni JS del browser arrivano allo stesso webhook di quelle server

`IErrorReportingService` (backend) segnalava già i bug lato API (§ voce precedente in questo stesso ambito, § 10 di `backend/README.md`) — ma un'eccezione JavaScript nel browser di un visitatore non passa da nessuna richiesta HTTP fallita, quindi non ci arrivava mai. Completa il meccanismo esistente sul lato che mancava, invece di costruirne uno separato.

- **Backend**: nuovo `EngineClientErrorController` (`POST diagnostics/ui-fault`, sola API Key — funziona anche per visitatori anonimi, stesso schema di `EngineNotificationStreamController`). Accoda a `IErrorReportingService.ReportAsync` esattamente come `ApiExceptionHandler` fa per i bug server. `ErrorReport` ha un nuovo campo opzionale `Source` (`"server"` default, `"client"` per questo endpoint) per distinguere le due fonti nello stesso canale — nessuna rottura per chi già consuma `ErrorReport`/`EngineErrorReporting`, è additivo.
- **Frontend**: nuovo `ClientErrorReportingService`, `ErrorHandler` globale registrato in `app.config.ts`. Copre sia gli errori che Angular già traccia sia — punto rilevante per un'app **zoneless** come questa, verificato dal vivo: senza `zone.js` un `ErrorHandler` da solo non riceve un errore da un `setTimeout` nudo o un listener DOM aggiunto a mano — quelli fuori da un contesto Angular, tramite `window.addEventListener('error'/'unhandledrejection')`. Spento in sviluppo, nessuna destinazione se il webhook backend non è configurato.
- Non breaking, additivo, zero-config per i figli.
- **Verificato**: `tsc --noEmit` pulito, build di produzione completa (browser + server); test dal vivo in Chromium sulla build di produzione — un errore fuori da un contesto Angular (che senza i listener `window` sarebbe passato inosservato, confermato) genera correttamente una `POST diagnostics/ui-fault` con `message`/`exceptionType`/`path`/`stackTrace`. Lato backend, `dotnet build` pulito (0 warning, 0 errori) e test end-to-end dal vivo (`dotnet run` + un webhook fittizio locale): la richiesta del browser arriva a `EngineClientErrorController`, viene accodata e il webhook riceve il JSON atteso con `source: "client"`; verificati anche il 401 senza API key e i fallback (`"(nessun messaggio)"`/`"ClientError"`) su un payload vuoto.

### Nuovo `WebVitalsService`: Core Web Vitals reali, raccolte ma senza destinazione di default

Il template misurava tanto (Lighthouse/pa11y in CI, contrasto WCAG calcolato) ma nulla di com'è davvero l'esperienza per chi visita il sito — solo audit sintetici, mai un utente reale con la sua connessione. `WebVitalsService` chiude questo buco lato Engine, senza decidere nulla che non gli spetti.

- Raccoglie LCP, INP, CLS, FCP, TTFB via la libreria `web-vitals` (zero dipendenze proprie). `init()` chiamato da `app.component.ts` accanto a `VersionCheckService.init()` — stesso punto, stesso pattern.
- Deliberatamente **senza destinazione di rete di default**: dove mandare questi dati (endpoint proprio, GA4, altro RUM) è una scelta di progetto, non dell'Engine. Zero chiamate in uscita aggiunte: le metriche finiscono in un signal (`metrics()`) osservabile con un `effect()` per chi vuole spedirle altrove, e in console (`console.debug`) solo in sviluppo.
- Non breaking, additivo: nessun figlio deve toccare nulla per riceverlo al merge — se nessuno legge `metrics()`, il servizio non fa altro che ascoltare eventi già emessi dal browser.
- Verificato: `tsc --noEmit` pulito, build di produzione completa (bundle browser + server) senza errori.

### `ImgBuilderService`: `drawImageCroppedTop` riassorbito in `drawImageFit` come terzo `fit: 'cropTop'`

Nello stesso giro che ha tolto lo sfondo sfocato da `'fittedCaption'` (voce sotto), il ritaglio-dal-basso era finito in un metodo a sé (`drawImageCroppedTop`), chiamato da `buildFittedCaptionCanvas` con un proprio `fillRect` di sfondo scritto a mano — un secondo percorso di compositing immagine, parallelo a `drawImageBackground`/`drawImageFit` che già servono `'pill'`/`'caption'`. Nessun bug, ma due framework invece di uno per lo stesso servizio.

- `drawImageFit` prende ora un terzo `fit: 'cropTop'` (stessa logica che aveva `drawImageCroppedTop`, spostata dentro senza modifiche). `drawImageCroppedTop` rimosso.
- `buildFittedCaptionCanvas` disegna la zona immagine con lo stesso `drawImageBackground` di `'pill'`/`'caption'` (`{ fit: 'cropTop' }`), non più con un `fillRect` + chiamata a parte: un solo punto di compositing per tutto il servizio, `'fittedCaption'` sceglie solo un `fit` che gli altri stili non usano di default.
- Non breaking (`drawImageCroppedTop` era privato, nessun consumer esterno) e non cambia il risultato: stessa identica matematica, solo spostata. Verificato: `tsc --noEmit` pulito; ri-eseguita la batteria di verifica automatica (6 rapporti immagine × 3 risoluzioni native × 2 lunghezze testo, 36 combinazioni con confronto atteso/ottenuto sulle dimensioni) — 36/36 identiche a prima del refactor, pixel per pixel per costruzione.

### `ImgBuilderService`: `'fittedCaption'` non sfoca più l'immagine — due zone separate, immagine sempre nitida ed eventualmente ritagliata

Con testo molto lungo su un'immagine di rapporto standard, `canvasH` cresce oltre l'altezza naturale dell'immagine per far entrare tutto il testo a scala 1. Il comportamento di base (`'blurred'`+`'contain'`, un solo canvas condiviso fra immagine e fascia testo) lasciava sempre una quota di sfondo sfocato visibile per riempire lo scarto fra il riquadro nitido e il resto del canvas — spostabile (un primo tentativo, `foregroundAlign: 'top'`, l'ha spinta tutta sotto invece che divisa sopra/sotto) ma non eliminabile: la sfocatura restava comunque una scelta di ripiego, non quello che l'utente aveva caricato.

Ripensato da zero: **niente più sfondo sfocato in `'fittedCaption'`**, in nessun caso.

- `buildFittedCaptionCanvas` non condivide più un canvas unico fra immagine e testo: compone due zone indipendenti, immagine sopra e fascia testo sotto, con la stessa dissolvenza (scrim + fade) che `buildCaption` usa già in `position: 'bottom'` — non più una riga netta fra le due.
- L'immagine è sempre disegnata nitida e a piena larghezza. Se la sua altezza naturale supera il tetto (nuova opzione `FittedCaptionOptions.maxImageRatio`, frazione della larghezza canvas, default `0.6`) viene ritagliata dal basso — mai zoomata sui lati (a differenza di un `'cover'` su un canvas più alto, che dovrebbe sacrificare i lati di un'immagine larga), mai deformata. Se l'immagine è già più bassa del tetto, nessun ritaglio.
- La fascia testo è dimensionata sul solo contenuto reale (`fitTextBlocks`), non più sul tetto "60% di canvasH" pensato per il vecchio canvas condiviso: niente più spazio vuoto sprecato intorno al testo.
- **Breaking, ma senza consumer reali** (verificato su tutto l'albero + figli, `'fittedCaption'` non aveva ancora un caller reale): `ImageCanvasOptions.foregroundAlign` rimosso (introdotto e già superato nello stesso giro, l'approccio "contain centrato/ancorato" non esiste più). `FittedCaptionOptions.minImageRatio` sostituito da `maxImageRatio` (semantica opposta: non più una quota minima di immagine da lasciare visibile in un canvas condiviso, ma un tetto massimo alla zona immagine, ora indipendente). `imgOpts` per `'fittedCaption'` accetta solo `width`/`backdropColor` (`background`/`foreground`/`fit`/`insetHeightRatio` non si applicano più: l'unico modo in cui questo stile mostra un'immagine, ora, è questo). Rimosso anche `ImgBuilderService.fitCaptionHeight` (pubblico ma senza consumer esterni, mai documentato in questo README): la sua logica non serve più a `'fittedCaption'`, che misura la fascia testo per conto proprio.
- Verificato: `tsc --noEmit` pulito sul frontend del template; batteria di rendering dal vivo in browser su 7 rapporti immagine (da 21:9 a 9:16) × 3 lunghezze di testo (corto/medio/lungo, con e senza sottotitolo) — 21 combinazioni, zero errori, testo mai troncato, nessuna immagine deformata o sfocata; sanity check su `style: 'plain'` (nessuna immagine coinvolta) per escludere regressioni sugli stili che non passano da questo percorso.

### `ImgBuilderService`: un solo `buildCanvas`/`buildBlob`/`buildFile` per stile — e `'fittedCaption'`, mai più ellissi sul testo generato

Partito da un problema di Dominio (Br1Gaming: senza sapere a priori quanto testo arriverà da un generatore, l'ellissi di troncamento del comportamento di base è inaccettabile — meglio far crescere il canvas) risolto lì con un servizio di progetto a parte (`ShareCardService`) che duplicava a mano un dettaglio interno dell'Engine (il tetto "60% di canvasH" di `buildCaption`) e ri-misurava il testo su un canvas temporaneo indipendente con un margine di sicurezza per assorbire lo scarto tra le due misure.

Portata nell'Engine, la stessa capacità è passata per due forme prima di questa: prima un flag `autoFit` su `buildCanvasWithCaption` (stesso metodo, due comportamenti secondo il flag — un'eccezione al resto del file, dove ogni stile di overlay è già un metodo a sé: `buildCanvasWithPill` accanto a `buildCanvasWithCaption`, mai un flag `style` su un metodo unico), poi un metodo a sé (`buildCanvasWithFittedCaption`) coerente con quel pattern ma che portava a 12 metodi pubblici quasi identici (4 stili × canvas/blob/file, la parte blob/file 100% boilerplate ripetuto ad ogni stile). Fermata qui:

- **Breaking**: `buildCanvas`/`buildBlob`/`buildFile` prendono ora un solo argomento `spec: ImgBuildSpec`, un discriminated union su `style: 'plain' | 'pill' | 'caption' | 'fittedCaption'` — non più `buildCanvas(text, opts)` ma `buildCanvas({ style: 'plain', text, opts })`. `buildCanvasWithPill`/`buildBlobWithPill`/`buildFileWithPill`/`buildCanvasWithCaption`/`buildBlobWithCaption`/`buildFileWithCaption` **rimossi**: stesso risultato con `buildCanvas({ style: 'pill'|'caption', ... })`. Nessun figlio usava ancora `...WithPill`/`buildBlobWith*`/`buildFileWith*` al momento di questo cambio (verificato su tutto l'albero + tutti i figli): la migrazione tocca un solo call site reale, il modulo passa da 12 metodi pubblici quasi identici a 3 (`buildCanvas`/`buildBlob`/`buildFile`) più le implementazioni per stile, ora private.
- Nuovo stile `'fittedCaption'`: come `'caption'`, ma calcola da sé altezza canvas e `maxLines` perché `text`/`subtitle` entrino SEMPRE per intero, mai troncati con ellissi (`imgOpts.height`, se presente, ignorato). Il canvas può divergere dal rapporto naturale dell'immagine: `background`/`foreground` diventano `'blurred'`/`'contain'` di default (sovrascrivibili) perché l'immagine di base non venga mai ritagliata dal `'cover'` di base. Nuova opzione `minImageRatio` (default 0.15) per lasciare comunque visibile una quota minima di immagine sopra la fascia di testo.
- Nuovo `ImgBuilderService.fitCaptionHeight` (statico, puro, SSR-safe): passa per `fitTextBlocks` (altezza infinita, scala fissa a 1) invece di ricalcolare `blockHeight` a mano — stesso identico percorso che usa `buildCaption` per il blocco titolo, sincronizzati per costruzione invece che per copia-incolla della formula. Nessun margine di sicurezza: chi chiama `'fittedCaption'` misura con un `ctx` temporaneo ma con lo stesso font che disegnerà poi il risultato finale, e `ctx.measureText` non dipende dalle dimensioni del canvas, quindi la misura è già esatta.
- Verificato: `tsc --noEmit` pulito; verifica isolata della sola logica pura (`wrapText`/`fitTextBlocks`/`fitCaptionHeight`/`buildCaption`, nessun DOM) su tre lunghezze di testo crescenti — nessuna ellissi, `canvasH` cresce monotono; verifica dal vivo in browser di tutti e quattro gli `style` via `ImgBuilderService` iniettato — nessun errore, dimensioni attese per ciascuno.

### CSP: stili scartati in silenzio su bootstrap client-only e import "nudi" — nonce propagato, workaround WebKit

Portati dal Dominio di due figli (Br1Gaming, agnese) dopo che ciascuno aveva trovato lo stesso problema da un lato diverso: Angular applica il nonce CSP agli `<style>` di encapsulation solo quando li crea lui **e** solo quando `CSP_NONCE` è iniettabile — cosa che non succede né sul bootstrap che avviene interamente nel browser (rotte `RenderMode.Client`, jolly `/error/**`, pagine `requiresAuth`, navigazioni client-side successive a un componente lazy), né per pacchetti terzi che iniettano CSS via `<style>` scritto a mano (senza nonce). In entrambi i casi il browser scarta l'elemento in silenzio sotto `style-src-elem 'nonce-...'`: niente errore in console, solo UI rotta (modali SweetAlert2 in fondo alla pagina invece che in overlay, contrasto navbar sotto soglia AA nelle pagine client-only).

- Nuovo `injectCspNonceIntoAppRoot` (`server/csp.ts`): Transform che inietta `ngCspNonce="<nonce>"` sul tag `<app-root` mentre la risposta scorre in streaming, così anche il bootstrap client-only trova un nonce valido (letto da Angular via il fallback di default di `CSP_NONCE`). `server.ts` lo applica allo stream SSR quando è presente un nonce.
- `theme.service.ts`: `_ensureCustomFontFace` crea il proprio `<style>` via `createElement` (non Renderer2, quindi fuori dall'auto-nonce di Angular) — ora inietta esplicitamente il nonce da `CSP_NONCE` (opzionale, nessun cambiamento quando non c'è un contesto CSP).
- `_bootstrap-theme.scss`: `--bs-navbar-brand-color`/`--bs-navbar-brand-hover-color` sovrascritti in `.navbar.theme-bg` a livello di CSS globale (non scoped component-style) — rete di sicurezza per le pagine client-only dove lo scoped style di Bootstrap verrebbe comunque scartato: contrasto garantito anche lì.
- `notification.service.ts`: l'import bare `sweetalert2` (`dist/sweetalert2.all.js`) inietta il proprio CSS base via `<style>` **senza nonce** — scartato in silenzio, la modale perdeva `position:fixed` e appariva in fondo alla pagina. Si importa ora `sweetalert2/dist/sweetalert2.esm.js` (stesso JS, niente auto-injection) e il CSS base va staticamente in `angular.json` → `styles` (nuovo `sweetalert2-esm.d.ts` per i tipi, assenti su quell'entry point).
- Non breaking: nessun contratto di Dominio cambia. Un figlio con questa stessa classe di sintomi (stili scoped che spariscono solo su rotte client-only, o modali/dropdown di librerie terze fuori posto) la eredita gratis al merge.
- **Workaround WebKit iOS valutato e scartato**: un fix distinto per elementi `position:fixed` comparsi dopo il primo paint (banner cookie, modale SweetAlert2), trovato nello stesso giro di debug di un figlio, era stato tenuto fuori di proposito (`patches/webkit-fixed-position-reflow.patch`, mai applicato) perché non era chiaro se fosse un bug di compositing separato o solo un altro sintomo del bug CSP sopra. Verificato su device reale dopo questo fix: il sintomo non si ripresenta, era davvero solo quello — patch rimossa dal repo, nessun workaround aggiuntivo necessario.
- Verificato: `tsc --noEmit` pulito sul frontend del template.

### `backend.csproj`: `data/*.md` ora copiati in `/publish` (non solo i `.json`)

Portato dal Dominio di un figlio (agnese) che ci era incappato con dei markdown di contenuto sotto `data/`. `data/*.json` è già un item `Content` di default (SDK `Sdk.Web`), quindi `<Content Update="data\**\*">` gli basta — ma un `.md` non lo è: l'SDK lo classifica `None` di default, quindi quello stesso `<Content Update>` non trovava nulla su cui operare e restava un no-op silenzioso (verificato con `dotnet msbuild -getItem:None`). Il sintomo compariva solo nell'immagine Docker (assente da `/publish`), non in `dotnet run` locale dove `ContentRootPath` coincide con l'albero sorgente — da qui il ritardo prima di notarlo.

- Aggiunto `<None Update="data\**\*" CopyToOutputDirectory="PreserveNewest" />` accanto al `<Content Update>` esistente: copre l'item type che i `.md` hanno davvero. No-op per i figli che sotto `data/` hanno solo `.json`.
- Non breaking, additivo.

### Permissions-Policy: estensione dichiarativa via `security-headers.override.json`

Il fix precedente (hash-check su `security-headers.json` + `security-headers.override.json` per la CSP) copriva solo metà del problema: la stessa `_nota` che sanciva l'override manuale della CSP sanciva anche quello della `Permissions-Policy` (es. `geolocation=(self)` per una pagina con mappa/GPS), ma il meccanismo nuovo non aveva un equivalente per quella — un figlio che ne avesse bisogno restava senza alternativa se non tornare a editare il file a mano, vanificando l'hash-check.

- `security-headers.override.json` supporta ora anche una sezione `permissionsPolicy` (accanto a `csp`): ogni chiave è una feature (es. `geolocation`, `camera`, `microphone`), i valori vengono **aggiunti** — mai sostituiti — a quelli già presenti nel template (`extendPermissionsPolicy`, nuovo `server/permissions-policy.ts`, stesso design di `csp.ts`).
- `security-headers.json`: `_nota` aggiornata per menzionare anche questo percorso; il contenuto cambia (solo testo) quindi `EXPECTED_TEMPLATE_SHA256` in `security-headers.ts` è stato ricalcolato — un figlio già allineato al template precedente vedrà un conflitto sha256 al prossimo merge finché non aggiorna anche questo file dal merge stesso.
- `frontend/README.md` nuova sezione §"Estendere la Permissions-Policy" accanto a §"Estendere la CSP".
- Verificato: build di produzione frontend pulita, type-check incluso.

### Ripristinato (di nuovo) il fail-closed sulle credenziali demo in Production

Revisione a più angoli (correttezza, comportamento rimosso, tracciamento cross-file) sul diff pendente prima del merge: il blocco che rifiuta in Production il login con le credenziali demo del template (`admin`/`Password1!`) era di nuovo assente da `AccountService.ValidateCredentialsAsync` — stessa regressione già trovata e corretta in una review precedente (vedi voce più sotto), con lo stesso segnale a tradirla: `_env` tornato un campo scritto e mai più letto.

- Ripristinato il blocco `if (_env.IsProduction() && validUsername == "admin" && validPassword == "Password1!") throw new UnauthorizedException();`, identico alla correzione precedente.
- A differenza della volta scorsa, presa in review prima del merge: nessuna finestra di esposizione reale in questo giro, ma la stessa classe di errore ripresentatasi due volte in poco tempo.
- **Causa radice della rimozione, trovata a posteriori**: `backend/Properties/launchSettings.json` non impostava mai `ASPNETCORE_ENVIRONMENT` — senza quella variabile .NET ricade su `Production` di default (non su `Development`), quindi sia `dotnet run` sia il debug da Visual Studio avviavano il backend già "in produzione", e il fail-closed rifiutava il login demo anche con la password corretta. Non un problema del controllo, ma dell'ambiente locale: chi lo aveva tolto stava probabilmente solo cercando di far funzionare il login in sviluppo. Aggiunto `"ASPNETCORE_ENVIRONMENT": "Development"` al profilo `backend` di `launchSettings.json`: ora il login demo funziona in locale (`dotnet run`/Visual Studio) e resta bloccato nella vera Production (Docker, `ASPNETCORE_ENVIRONMENT=Production` fissato nel `Dockerfile`).
- Verificato: `dotnet build` backend (0 warning, 0 errori).

### CSP: `security-headers.json` intoccabile — hash-check all'avvio, `security-headers.override.json` per le estensioni

L'unica modifica di progetto attesa in `security-headers.json` era, per esplicita `_nota` del file, l'estensione della CSP (es. whitelistare Mapbox o Google Consent Mode) — ma editare a mano un file "del template, si aggiorna col merge" è esattamente il tipo di divergenza silenziosa che quella nota avrebbe dovuto prevenire: al primo merge dall'upstream l'edit locale va perso o in conflitto, senza che nessuno se ne accorga finché la CSP in produzione non si comporta in modo inatteso. In parallelo, `style-src` porta `'unsafe-inline'` (Angular usa `[style.x]` bindings ovunque, i nonce non lo coprono) senza modo di sapere, prima di provare a toglierlo, cosa si romperebbe davvero.

- Il Node SSR verifica ora lo sha256 di `security-headers.json` all'avvio (`EXPECTED_TEMPLATE_SHA256` in `security-headers.ts`) e si rifiuta di partire se il contenuto su disco non combacia — il file diventa così davvero intoccabile, non solo per convenzione documentata.
- Le estensioni CSP di progetto vanno ora in un nuovo `security-headers.override.json` alla radice (committabile, non un segreto, mai toccato dal template): un oggetto `{ csp: { direttiva: [sorgenti...] } }`, le cui sorgenti vengono **aggiunte** — mai sostituite — a quelle già presenti nel template (`extendCsp`, nuovo `server/csp.ts`). Stessa logica di ricerca (env var → cwd → `../cwd`) degli altri file di config; assente di default, nessuna estensione.
- `docker-compose.yml`/`App.sln` aggiornati per montare/listare il nuovo file; `AGENTS.md` §"Google Consent Mode v2" e `frontend/README.md` §"Estendere la CSP" riscritti per la nuova procedura.
- **Breaking per ogni figlio che aveva già esteso `security-headers.json` a mano** (es. Mapbox, Google Consent Mode): al merge, il Node SSR si rifiuta di avviarsi (hash non combaciante). Migrazione: sposta le direttive aggiunte in `security-headers.override.json` nella nuova forma a oggetto, poi ripristina `security-headers.json` alla versione del template.
- Verificato: `dotnet build` backend pulito; build di produzione frontend (type-check incluso), lint, i18n-check e dipendenze circolari puliti; nuovo `site-builder-check.sh` verde (hash incluso).

### `X-Request-Id`: correlazione SSR ↔ backend

Un bug che attraversa SSR e backend (es. un 500 dal proxy `/api`) non aveva un modo di collegare la riga di log Node con quella .NET della stessa richiesta, se non incrociando i timestamp a mano.

- Ogni richiesta SSR riceve ora un `X-Request-Id` (riusato dal reverse proxy a monte se presente e ben formato — alfanumerico + `.-_`, max 128 caratteri — altrimenti generato con `randomUUID()`), riflesso in risposta e propagato al backend dal proxy `/api/*`.
- Il backend lo promuove a `TraceIdentifier` (nuovo middleware, per primo nella pipeline — tabella aggiornata in `backend/README.md` §"Ordine della pipeline HTTP") e lo aggiunge a ogni `ProblemDetails` via `CustomizeProblemDetails`. Un log SSR e un log .NET della stessa richiesta condividono così lo stesso id.
- Verificato: `dotnet build` backend pulito; build di produzione frontend pulita.

### `security.txt`: da file generato al build a endpoint runtime (RFC 9116)

Stesso limite architetturale già risolto per `sitemap.xml`: `security.txt` era generato una volta al build da `generate-statics.ts`, con `Contact` fisso sull'URL del sito — un dato di identità (email/telefono), non di build, che restava disallineato finché non si rifaceva un build.

- `public/security.txt` non è più generato: `/.well-known/security.txt` è ora un endpoint (`routes/dynamic-security-txt.ts`), che legge `Contact` da `GET /identity` a ogni richiesta — nessuna cache, traffico atteso basso (crawler di sicurezza, non utenti).
- Nessun contatto configurato in identità (email/telefono assenti) → 404: un security.txt senza un modo reale di raggiungere qualcuno sarebbe peggio che non pubblicarlo.
- Verificato: build di produzione frontend pulita.

### Breadcrumb: nuovo componente UI + `BreadcrumbList` JSON-LD condiviso

Il JSON-LD emetteva già un `BreadcrumbList` per ogni pagina non-root, ma non esisteva alcun breadcrumb visibile nella UI — due gerarchie che avrebbero rischiato di divergere se implementate separatamente.

- Nuovo `BreadcrumbService` (`services/breadcrumb.ts`): risale l'albero di `ContestoSito.pages` dal `PageType` corrente, con un fallback per rotte piatte con slash nel path (avvisa in dev se un prefisso resta senza pagina dichiarata corrispondente). `resolveBreadcrumb` (opzionale, `site.ts`) permette di sovrascrivere il trail per un `PageType` specifico.
- Nuovo `app-breadcrumb` (`components/breadcrumb/`), montato nello shell (`app.component.html`): visibilità di default "intelligente" (compare da solo solo oltre due livelli reali), gate su un nuovo `showBreadcrumb` — stesso pattern di `showNav`/`showFooter`: **globale** (`site.ts`) prima, **per-pagina** (`layout.showBreadcrumb`) poi, mai il contrario.
- Adapter condiviso `toJsonLdTrail` (`services/breadcrumb-jsonld.ts`): stesso trail alla base sia della UI sia del `BreadcrumbList` JSON-LD in `PageMetaService`, le due gerarchie non possono più divergere.
- Nuove chiavi i18n `breadcrumbNav`/`breadcrumbHome` (`basic.*.json`, Engine).
- Verificato: build di produzione frontend (type-check incluso), lint, i18n-check e dipendenze circolari puliti.

### Upload multiplo di file (`[multiple]`, `ApiService.uploadBlobs`)

`UploadFormComponent` accettava un solo file per selezione; un progetto che vuole caricare una galleria doveva reimplementare da zero drag-and-drop e validazione per il caso multiplo.

- `UploadFormComponent`: nuovo input `[multiple]` (default `false`, comportamento singolo invariato); emette ora sempre `filesConfirmed`/`filesSelected` (`File[]`, anche con un solo file) al posto di `fileConfirmed`/`fileSelected` (`File`).
- Nuovo `labels` (`UploadFormLabels`, opzionale): override dei testi del form campo per campo, senza toccare i cataloghi i18n.
- Nuovo `ApiService.uploadBlobs(files)`: carica in sequenza (l'endpoint `/blob/up` accetta un `IFormFile` alla volta) e restituisce gli slug nello stesso ordine di `files`; un fallimento a metà propaga l'errore senza rollback dei file già caricati (nessuna DELETE esposta oggi su `/blob`).
- **Breaking per ogni consumer di `app-upload-form`:** `(fileConfirmed)`/`(fileSelected)` non esistono più, vanno rinominati in `(filesConfirmed)`/`(filesSelected)` e il gestore adattato a un array (`[file] = files` per il caso singolo).
- Verificato: build di produzione frontend (type-check incluso), lint, i18n-check puliti.

### Cache server-side per il resize on-demand dei blob (`BoundedByteCache`)

`GET /blob/{slug}?webopt=true` rifaceva decode+resize+encode SkiaSharp a ogni richiesta non già coperta dall'ETag/304 del client — cioè per il primo visitatore di ogni slug, e per ogni client dietro una cache condivisa che non rispetta `Cache-Control`.

- Nuovo `BoundedByteCache` (`Engine/BoundedByteCache.cs`): `MemoryCache` in-process dedicata, chiave = `slug`, popolata al primo miss e servita as-is sui successivi. Separata dalla `IMemoryCache` condivisa (JSON di config): un `byte[]` di immagine è ordini di grandezza più pesante, con un proprio `SizeLimit` (`BLOB_WEBOPT_CACHE_MAX_MB`, default 500 MB — nuova variabile d'ambiente, vedi `DOCKER_README.md`); superato il limite, eviction automatica.
- Coalescing sulle richieste concorrenti allo stesso slug non ancora in cache: `GetOrCreateAsync` tiene un `Lazy<Task<byte[]>>` per chiave, non il `Task` nudo — trovato in review che `ConcurrentDictionary.GetOrAdd` da solo non garantisce l'esecuzione singola del proprio value-factory sotto contesa: con un `Task` nudo, due richieste arrivate nella stessa finestra di miss avrebbero potuto avviare due resize in parallelo invece di condividerne uno, contraddicendo la garanzia di coalescing documentata a fianco.
- `BlobController.Get` ora `async`, legge/scrive la cache attorno a `ResizeImageForWeb`.
- Verificato: `dotnet build` backend pulito (0 warning, 0 errori).

### `og:image`: layout ridisegnato secondo le linee guida social 2026

- Card testuale e variante con immagine condividono ora una disciplina comune: favicon piccola in alto a sinistra come marchio d'identità **senza** il nome app ripetuto accanto (i crawler social lo mostrano già nel proprio chrome UI — ripeterlo nell'immagine è ridondante), safe-zone di 80px, headline pesante nei due terzi superiori, subline opzionale troncata a una riga.
- Sfondo della card testuale rinforzato a contrasto WCAG AAA contro il testo overlay (`ImgBuilderService.strongFillColor`), non più il colore brand nudo.
- `sitePalette`/`strongBgColor` (`og-preview.ts`) calcolati una volta al load del modulo invece che a ogni richiesta, incluse quelle servite dalla cache su disco.
- Verificato: build di produzione frontend (type-check incluso) pulita.

### JSON-LD: campi opzionali dell'identità dietro un flag esplicito per campo

Il nodo brand (`Organization`/`Person`) del JSON-LD includeva sempre `address`/`contactPoint` (email, telefono) se presenti in `identity.json` — dati potenzialmente personali, esposti in un formato pensato apposta per essere estratto in automatico da bot di scraping, non solo dai crawler dei motori di ricerca.

- Nuovo `jsonld` (`site.ts`, `{ email, telefono, indirizzo, partitaIva, codiceFiscale }`): un flag per campo, default `false` — eccetto `partitaIva` (`true`): identificativo puramente numerico, verificabile pubblicamente su VIES a prescindere, l'unico che Google raccomanda esplicitamente. `codiceFiscale` resta `false` di default: per una ditta individuale codifica data e luogo di nascita della persona fisica dietro l'attività, e l'Engine non sa distinguere quel caso da una vera società.
- `legalName`/`sameAs` non sono in questa lista: escono comunque identici da `name` (sempre presente) o sono URL già pubblicati altrove (footer) — un flag lì non nasconderebbe nulla.
- Footer e pagine legali (`identity-render`) restano sempre visibili se i campi di `identity` sono valorizzati, **indipendentemente** da questi flag: riguardano solo l'esposizione nel JSON-LD pubblico.
- Verificato: `dotnet build` backend pulito; build di produzione frontend pulita.

### Audit live (Pa11y + Lighthouse) consolidati in un solo script, campionati per componente dinamico

`a11y-test.sh` e `lighthouse-test.sh` giravano come due script separati con `continue-on-error` in CI (per farli girare entrambi anche se uno falliva) e un campione unico su tutte le pagine dinamiche mescolate insieme — un `pageType` con molte entità avrebbe "rubato" campione a uno con poche.

- I due script sono sostituiti da un solo `live-test.sh` + `live-audit.mjs`: un browser Puppeteer condiviso, fail-closed nativo (niente più `continue-on-error` a livello di step CI per farli girare entrambi comunque).
- Nuovo `GET /internal/dynamic-audit-paths` (`dynamic-sitemap.ts`): le pagine `dynamicParams` raggruppate per `pageType`, sola lingua di default. `live-audit.mjs`/`discover-audit-paths.cjs` campionano **ogni gruppo indipendentemente** (Pa11y fino a 100 istanze per gruppo, Lighthouse fino a 5 — seriale e costoso per pagina, un campione più piccolo basta perché le istanze di uno stesso `pageType` condividono template).
- Gli audit live restano alla sola lingua di default (nuova invariante verificata in CI, sotto): le varianti-lingua di una stessa pagina condividono template e markup, un audit strutturale/di performance darebbe lo stesso esito in ogni lingua.
- Nuovo `site-builder-check.sh` (`scripts/checks/site-builder-invariants.ts`): verifica in CI, senza alzare un server, che `auditPaths` non includa varianti non-default né duplicati, che la sitemap copra ogni lingua configurata, e l'hash di `security-headers.json` — un fallimento qui è un difetto dell'Engine da scoprire prima del deploy, non durante.
- `pa11y.json`: aggiunti i runner `axe`+`htmlcs` (prima solo il default); `lighthouse.json` non porta più la propria categoria `accessibility` (80), ridondante con la copertura WCAG di pa11y.
- `/health` rinomina `a11yPaths` → `auditPaths` (alimenta anche Lighthouse, non solo l'accessibilità) e aggiunge `imageCache` (contatori hit/miss della cache disco di `/cdn-cgi/asset`/`/cdn-cgi/preview`).
- **Breaking per ogni script/tool esterno che chiamava `a11y-test.sh`/`lighthouse-test.sh` o leggeva `a11yPaths` da `/health`:** rinominati rispettivamente in `live-test.sh` e `auditPaths`.
- Verificato: `site-builder-check.sh` verde in locale (9 auditPaths, sitemap su 2 lingue, hash security-headers corretto); build di produzione frontend pulita.

### CI: Job Summary su GitHub Actions, CodeQL, cache Docker per i test live

- Nuovo `scripts/lib/gh-summary.sh` (`gh_summary_append`): scrive nel Job Summary di GitHub Actions invece di lasciare l'esito (pacchetti vulnerabili, secret scanning) sepolto nel log dello step — no-op fuori da GitHub Actions.
- Nuovo workflow separato `CodeQL.yml`: analisi statica di sicurezza (SAST) su frontend e backend, a ogni push/PR e settimanalmente. A sé (non nel workflow di test principale) apposta: nessun file di test coinvolto, zero rischio di rompersi quando un figlio sostituisce la demo.
- Il job `live-tests` pre-scalda la cache Docker (buildx, cache GitHub Actions) di backend e frontend in parallelo prima di alzare lo stack — gli step successivi partono da immagini già pronte invece di ricostruirle.
- Azioni GitHub bumpate (`checkout`/`setup-dotnet` v4→v5, `setup-node` v4→v6).
- Verificato: sintassi YAML validata.

### Fix: colore dei link in un subtheme Bootstrap nidificato ricadeva sul blu di stock

`--bs-link-color`/`--bs-link-hover-color` (hex) erano ponte-ate nel subtheme bridge, ma Bootstrap usa davvero le varianti `-rgb` per il colore effettivo dei link (`a { color: rgba(var(--bs-link-color-rgb), ...) }`) e per il loro hover — senza quelle, un subtheme `[data-bs-theme]` nidificato (es. pannello forzato in chiaro dentro una pagina scura) ricadeva silenziosamente sul blu di default di Bootstrap (`#0d6efd`) invece del colore brand.

- Nuove `--colorLinkRgbLt`/`Dk` e `--colorLinkHoverRgbLt`/`Dk` (triplette RGB, `ThemeService`), ponte-ate anche loro nella mixin `theme-bridge` (`_lib.scss`) come `--bs-link-color-rgb`/`--bs-link-hover-color-rgb`.
- Nuovi `ThemeService.colorSecondary`/`.colorSecondaryText` (signal): variante muted del brand, esposti come le altre variabili di palette.
- Verificato: build di produzione frontend pulita.

### Fix: bootstrap dell'app fallito → schermata di errore minimale, non pagina bianca

Se `bootstrapApplication` fallisce (es. un `appInitializer` che lancia), l'albero dei componenti Angular non esiste mai — quindi nemmeno `ErrorComponent`/il router: `<app-root>` restava vuoto, senza alcun feedback per l'utente.

- `main.ts`: il `.catch` di `bootstrapApplication` ora renderizza un messaggio minimale via `document.body.innerHTML` — markup puro, senza dipendere da `TranslateService` (che può essere proprio la causa del fallimento) né da Angular, che qui non è mai partito. Stile via classi Bootstrap (già nel bundle CSS) per restare coerente col tema chiaro/scuro impostato da `theme-init.js` prima di questo script. Bilingue (IT/EN) su `navigator.language`, non su `TranslateService`.
- Verificato: build di produzione frontend pulita.

### `setup.mjs` (eject): rimozione della demo via marcatori, non più pattern-matching testuale

`ejectDemo()` rimuoveva i blocchi demo di `Program.cs`/`api.service.ts` cercando la stringa esatta di codice/commenti da cancellare: un refactoring successivo di quel codice (rinominare una variabile, riformattare un commento) rompeva silenziosamente l'eject senza che nessun test se ne accorgesse finché qualcuno non lo eseguiva davvero.

- Nuovi marcatori `// <DEMO_BLOCK_START>`/`// <DEMO_BLOCK_END>` attorno al codice demo in `Program.cs` e `api.service.ts`: `ejectDemo()` rimuove tutto ciò che sta fra i due marcatori con una singola regex, indipendente dal contenuto esatto. Un avviso esplicito (non un errore fatale) se i marcatori non si trovano più, invece di un eject silenziosamente incompleto.
- Verificato: `dotnet build` backend pulito; build di produzione frontend pulita.

### Menu header/footer: da `site.ts` (build-time) a `nav.ts` (dato, risolto a runtime)

`headerNav`/`footerNav` vivevano dentro `buildSite()`, eseguiti una volta sola, in modo sincrono, al caricamento del modulo — insieme a `PageType`/`pageMap`/`routes`, che DEVONO restare così (Angular vuole `routes` statico al bootstrap). Ma quali voci mostrare in header/footer, in che ordine, con che etichetta, non è struttura del sito: è un dato, potenzialmente diverso per utente loggato o gestito da un pannello admin — e la forma sincrona non lasciava spazio per collegarlo a un'API.

- `SiteDefinition.headerNav`/`footerNav` **rimossi**. Il menu si dichiara ora in un nuovo file `frontend/src/app/nav.ts` (parallelo ad `app.pages.ts`), come `ShellNavResolver` (tipo esportato da nuovo `core/engine/shell-nav.ts`): stesso builder `addPage`/`addLink`/`addGroup` di prima, ma la callback può essere `async` — un progetto che vuole un menu dipendente da un'API scrive una callback che fa `await` (fetch, `inject(ApiService)` dentro la callback compreso) e usa `addPage(pageType, { params, label })` per un'etichetta libera per istanza (es. "preferiti" con lo stesso `PageType` e `:slug` diversi, un nome prodotto al posto del titolo generico della pagina). `addLink` resta per URL esterni (avviso in dev-mode se usato con un path interno).
- Nuovo `ShellNavService` (Engine, `providedIn: 'root'`): risolve `header`/`footer` UNA volta sola, condivisa da `NavbarComponent` e `FooterComponent` (prima erano due letture indipendenti della stessa `Map` precalcolata — con un resolver che può chiamare un'API, farlo due volte sarebbe stato sbagliato). Il resolver effettivo arriva da un nuovo token `SHELL_NAV_RESOLVER`, fornito da `nav.ts` in `app.config.ts` (default Engine: nessuna voce, innocuo se non fornito — stesso pattern di `LEGAL_FILE_READER`).
- Risoluzione attesa da un `provideAppInitializer` (bootstrap, sia SSR che browser) **prima** che qualunque componente si costruisca: `NavbarComponent` legge il menu anche in un field initializer sincrono (`altroDropdownIndex`), deve già essere pronto al primo render. Cambio lingua (client): ri-risolve in automatico, reattivo. `TransferState` evita il doppio fetch fra SSR e idratazione (stesso pattern di `LOCALE_CONFIG`).
- Verificato end-to-end: un resolver `async` di prova (footer coi primi 10 social presi da un vero endpoint via `inject(ApiService)`) ha funzionato al primo colpo in Docker, nessun crash, nessun doppio fetch — poi ripristinato alla dichiarazione statica di demo.
- **Breaking per ogni figlio con `headerNav`/`footerNav` in `site.ts`:** al merge, `buildSite({ headerNav: ..., footerNav: ... })` non compila più (proprietà sconosciute). Migrazione: sposta il corpo delle due callback in un nuovo `nav.ts` come `ShellNavResolver.header`/`.footer` (stessa sintassi `addPage`/`addLink`/`addGroup`, invariata), collega il resolver in `app.config.ts` con `{ provide: SHELL_NAV_RESOLVER, useValue: navResolver }`. `setup.mjs` (eject) aggiornato di conseguenza: scrive anche uno scheletro `nav.ts` vuoto.
- **Fix collaterale trovato testando in Docker**: `NavbarComponent.recomputeOverflow()` chiamava `isDesktopViewport()` (solo-browser per contratto) da un `effect()` mai guardato per SSR — prima "vinceva la gara" con la serializzazione della risposta, il ritardo del nuovo `provideAppInitializer` gli ha dato il tempo di scattare in SSR, `ReferenceError: window is not defined`, l'intero render andava in crash. Aggiunta la guardia `isPlatformBrowser` che il resto dei componenti già usava per lo stesso motivo.
- **Fix collaterale nel setup.mjs (eject)**: lo scheletro minimo generato aveva già due gap indipendenti da questa modifica, trovati testando l'eject end-to-end (build su copia scartabile): un blocco che ripuliva un `case Social` in un `content.resolver.ts` che non esiste più a quel path da una sessione precedente (spostato in Engine, rimosso), e nessuna cancellazione di `app.pages.ts`/`pages/che-faccio` — dopo l'eject, `app.pages.ts` restava con un import morto verso `./social/social.component` (cancellato), build rotta. Aggiunta anche la riscrittura di `pages/policy/legal.pages.ts` a scheletro vuoto (già presente come gap scorrelato): senza, il `PageType` ristretto del nuovo `site.ts` minimale non tornava più coi suoi `pageType` letterali.
- Verificato: build di produzione frontend (type-check incluso), lint, i18n-check e circular-deps-check puliti; `dotnet build` backend pulito; eject (`setup.mjs`) testato end-to-end su una copia scartabile del repo, build pulita fino in fondo.

### `sitemap.xml`: da file generato al build a endpoint runtime, con pagine dinamiche (`dynamicParams`)

Il builder poteva enumerare solo le pagine dichiarate staticamente in `site.ts`: una rotta parametrica con un solo `PageType`/componente per N elementi di un catalogo backend (es. `/prodotti/:slug`) non aveva mai un momento di build in cui elencare gli slug reali, e restava fuori da `sitemap.xml` — un limite architetturale noto, non solo un buco di copertura.

- `public/sitemap.xml` **non è più generato da `generate-statics.ts`**: `sitemap.xml` è ora un endpoint (`GET /sitemap.xml`, `server/routes/dynamic-sitemap.ts`), montato nel Node SSR prima dello static handler. Stessi calcoli di prima (ora in `services/sitemap-xml.ts`, condiviso) più l'espansione delle pagine con `dynamicParams` dichiarato (nuovo campo opzionale di `LeafPageInput`: una funzione che recupera dal backend l'albero `SlugNode[]` degli slug accettati per una rotta con `:segmenti`).
- Cache in-process con TTL (default 7 giorni, `SITEMAP_CACHE_TTL_MS`) invalidata on-demand dal backend: nuovo `SitemapNotifier` (Engine, backend) fa un `POST /internal/revalidate-sitemap` dopo una scrittura su un catalogo `dynamicParams` — un figlio lo richiama con `Sitemap.NotifyChangedAsync()` dai propri controller (proprietà ambient su `EngineApiController`, stesso schema di `Delivery`/`Crypto`). Spento finché `Frontend.Origin` non è configurato (nuova `FrontendOptions`, sezione `Frontend` di `global-settings.json`); `docker-compose.yml` del template la valorizza già (`Frontend__Origin=http://frontend:3000`).
- `<priority>`/`<changefreq>` **rimossi**: Google li ignora da anni, restavano solo peso morto. `<lastmod>` non fa più fallback su `project.lastModified` (una data identica su ogni URL, segnale che Google finisce per ignorare come inattendibile): ora è emesso solo dove verificabile per-entità (`SlugNode.lastModified` sul nodo foglia di una pagina dinamica) e **omesso** altrove — anche per le pagine statiche, che prima lo portavano sempre.
- **Breaking, solo se l'infrastruttura di deploy assume `sitemap.xml` come file statico**: un reverse proxy/CDN con una regola dedicata per servire `/sitemap.xml` direttamente da `public/` (bypassando il Node SSR), o una cache "immutabile" su tutto `public/**`, smette di funzionare — il file non esiste più, la richiesta va al Node SSR. Il template stesso non ha questo problema (`public/` non è mai stata esposta direttamente, sempre servita dal Node SSR), ma un figlio con un'infrastruttura di deploy personalizzata va verificato.
- Verificato: `dotnet build` backend (0 warning, 0 errori); build di produzione frontend (type-check incluso), lint, i18n-check e circular-deps-check puliti.

### `ContentResolver`: switch centralizzato sostituito da `contentLoader` per pagina

`ContentResolver.loadResolved()` era un file di Dominio "a contratto fisso": ogni pagina con dati SEO-critici al primo render richiedeva un nuovo `case` nel suo switch — un file unico che ogni figlio doveva estendere a mano, e che l'Engine importava per path/nome nonostante vivesse nel Dominio (l'unica voce di quel tipo nell'elenco "Dominio a contratto fisso").

- `contentLoader` (nuovo campo opzionale di `LeafPageInput`, stesso posto di `dynamicParams` in `pages/*.pages.ts`): ogni pagina porta la propria logica di fetch, invece di un `case` in un file condiviso.
- `ContentResolver` è ora generico (zero `PageType` conosciuti, gestisce solo le pagine legali in modo trasversale) e si è **spostato da `pages/content.resolver.ts` (Dominio) a `core/engine/pages/content.resolver.ts` (Engine)** — non è più un file di Dominio "a contratto fisso": rimosso dall'elenco in README.md.
- **Breaking per ogni figlio che ha aggiunto `case` al vecchio switch:** al merge, `pages/content.resolver.ts` del figlio confligge con la rimozione del file (o resta silenziosamente non importato da nulla, se il conflitto si risolve prendendo la versione del template). Migrazione: sposta la logica di ogni `case` in un `contentLoader` sulla rispettiva pagina in `pages/*.pages.ts` — vedi la ricetta in [AGENTS.md](AGENTS.md#aggiungere-una-pagina) e §"Developer Journey" in [frontend/README.md](frontend/README.md).
- Verificato: build di produzione frontend (type-check incluso), i18n-check e circular-deps-check puliti.

### Pagine legali standard: `noindex` di default

Le 5 pagine legali standard (privacy/cookie/termini/note legali/accessibilità) finivano nella sitemap e restavano indicizzabili come una pagina di contenuto qualunque — crawl budget speso su pagine di servizio che non portano traffico di ricerca.

- `buildPolicySection` (`legal/legal-pages.ts`) ora dichiara le pagine legali gestite dall'Engine con `otherSEO: { noindex: true }`: fuori da `sitemap.xml` e marcate `X-Robots-Tag: noindex, nofollow` a runtime, di default.
- **Breaking per i figli già live che le vogliono indicizzate** (raro, ma capita: alcuni preferiscono indicizzare la propria Privacy Policy): al merge, le 5 pagine legali standard spariscono dalla sitemap e diventano `noindex` silenziosamente. Chi le vuole indicizzate dichiara la pagina a mano in `pages` col proprio `PageType` e `otherSEO: { noindex: false }` (override standard: `filterManagedLegalPages` esclude dall'auto-gestione ogni `PageType` già dichiarato dal figlio).
- Verificato: build di produzione frontend (type-check incluso) pulita.

### `path` per-lingua in `site.ts` (URL localizzati non solo prefissati)

Con più lingue configurate, il `path` di una pagina interna era sempre lo stesso segmento sotto ogni prefisso (`/en/chi-siamo`, mai `/en/about-us`) — un limite esplicitamente documentato come "non supportato oggi" in frontend/README.md.

- `BasePageInput.path` accetta ora, oltre alla stringa (comportamento storico, resta il default), un oggetto `{ tagLingua: segmento }` (es. `{ it: 'chi-siamo', en: 'about-us' }`): un segmento diverso per lingua. Una lingua del sito senza una propria chiave ricade sul segmento della lingua di default.
- Nuovo `resolvePagePath()` (`siteBuilder.ts`), unico punto di risoluzione, usato sia da `routing.ts` (rotta Angular reale) sia da `processPages()` (menu/sitemap/hreflang): le due chiamate producono per costruzione lo stesso path per la stessa pagina+lingua.
- Link a una voce concreta di una rotta parametrica (`NavItemOptions.params`/`appPageParams`) e query string separate dal path (`NavItemOptions.queryParams`/`appPageQueryParams`) — necessari per collegare in menu/link una singola entità di una pagina con `dynamicParams` senza ricostruire il path a mano.
- Fix: i tag `<link rel="alternate" hreflang>` che l'Engine emette automaticamente su ogni pagina (`PageMetaService`) risolvevano correttamente le lingue solo per un `PageType` senza `:segmenti` — su una pagina parametrica (es. `/social-feed/instagram`) puntavano al template letterale non risolto (`/social-feed/:slug`), individuato testando `dynamicParams` end-to-end in Docker. Stesso trattamento già applicato a `[appPage]`/`NavbarComponent` (`applyPathParams` sui param di rotta correnti); la logica di merge dei param (root→foglia) è ora condivisa (`mergeRouteParams` in `routing.ts`) invece che duplicata.
- Non breaking: chi non usa la forma a oggetto non nota differenze.
- Verificato: build di produzione frontend (type-check incluso), lint, i18n-check e circular-deps-check puliti; `dotnet build` backend pulito; stack Docker Compose completo (backend+frontend) testato end-to-end con test avversativi su sitemap.xml, hreflang, pagine dinamiche `dynamicParams` e path per-lingua.

### `.text-bg-primary`/`.text-bg-secondary`: testo bianco fisso invece del brand

Bootstrap compila `.text-bg-primary`/`.text-bg-secondary` con `color: #fff !important` fisso (contrastato contro il SUO grigio di default a build-time), ignorando `--colorPrimaryText`/`--colorSecondaryText` che ThemeService calcola apposta per lo sfondo brand runtime — un commento in `_bootstrap-theme.scss` assumeva (erroneamente) che le due cose coincidessero già. Su un brand con secondary chiaro/medio il bianco fisso scende sotto AA (verificato: 2.85:1 nel catalogo Design System di un figlio).

- `.text-bg-primary`/`.text-bg-secondary` ora usano `var(--colorPrimaryText)`/`var(--colorSecondaryText)` invece del bianco fisso di Bootstrap.
- Verificato: build di produzione frontend pulita.

### Catalogo Design System in home, spostato nell'Engine (sopravvive all'eject)

La home demo esercita ogni funzionalità dell'Engine, ma resta pensata per chi legge codice: niente di consultabile da chi valuta l'aspetto di un sito (designer, Art Director) senza login né lettura del sorgente — e comunque, essendo demo Dominio, sarebbe sparito del tutto con `setup.mjs` → eject, insieme al resto.

- Nuovo `app-design-system-gallery` (`core/engine/components/design-system-gallery/`): catalogo visivo sempre presente di colori, tipografia, bottoni, badge, alert e form — nessun gate di login, a differenza delle altre sezioni della home demo.
- Vive nell'Engine e non in `components/shared/**` (che è Dominio) apposta: sopravvive all'eject, `setup.mjs` monta il componente anche nella home minimale del progetto "pulito".
- Le sue stringhe i18n vivono in `basic.{lang}.json` (Engine, mai azzerato) invece che in `addon.{lang}.json` (Dominio, azzerato dall'eject), per lo stesso motivo.
- Verificato: build di produzione frontend (type-check incluso), lint, i18n-check e circular-deps-check puliti.

### Titolo del browser non tradotto sulle pagine d'errore

Le rotte `error/:errorCode` e `**` (routing.ts) impostavano una `title` nativa di Angular (`'erroreGenerico'`), mai passata dal servizio di traduzione: il tab del browser mostrava la chiave i18n grezza invece del testo ("erroreGenerico" anziché "Pagina non trovata | AppName"), a differenza di ogni altra pagina del sito.

- Rimossa la `title` statica dalle due rotte. `ErrorComponent` ora imposta `document.title` da sé (tradotto, stesso formato `"{titolo} | {appName}"` delle altre pagine), riusando il `Title` di `@angular/platform-browser` invece della `PageMetaService` completa (le pagine d'errore sono `noindex`, non serve canonical/OG/structured data).
- Verificato: build di produzione frontend, `/error/404` (wildcard) ed `/error/500` mostrano il titolo tradotto sia in italiano che in inglese.

### Falsi positivi intermittenti nel test di accessibilità (color-contrast in concorrenza)

`a11y-test.sh` con `A11Y_CONCURRENCY` di default (3) segnalava a intermittenza un contrasto ~1.09:1 su elementi di testo della navbar (dropdown di sezione, selettore lingua) — sempre lo stesso rapporto, su una pagina diversa a ogni run, anche in configurazioni dove il colore è verificabilmente corretto.

- Non è un bug dei colori: verificato leggendo `getComputedStyle` dal vivo sugli stessi elementi, in tema chiaro e scuro, senza mai riprodurre il problema. Riproducibile solo dentro pa11y, e solo con 3+ pagine auditate in parallelo nello stesso browser Puppeteer condiviso — con concorrenza 2 il problema non si è più presentato su multiple run ripetute.
- `A11Y_CONCURRENCY` di default abbassato da 3 a 2 in `a11y-test.sh`. Aggiunto anche un piccolo `wait` (400ms) in `pa11y.json` come margine extra dopo il caricamento, indipendente dalla causa reale ma innocuo.
- Verificato: `a11y-test.sh` su 3 progetti (template + 2 figli), più run ripetuti a concorrenza 2, sempre stabile.

### Error reporting via webhook (`IErrorReportingService`)

Un bug in produzione, di norma, lo scopri solo leggendo i log a mano. Serviva un modo per farsi avvisare senza dover installare l'SDK di un vendor specifico (Sentry e simili) solo per quello.

- Nuovo `IErrorReportingService` (`Engine/ErrorReporting/`): un `POST` JSON verso un webhook a scelta (`ErrorReporting.WebhookUrl` in `global-settings.local.json`, vuoto = spento) per ogni eccezione non applicativa (un bug vero) o applicativa con status ≥500 — mai un 4xx, traffico normale. Nessun pacchetto NuGet in più: solo `HttpClient` via `IHttpClientFactory`, stesso schema del mailer.
- Chiamato già da `ApiExceptionHandler`, non a mano: accodato su `IBackgroundTaskQueue` con uno snapshot immutabile (`ErrorReport`) costruito sincronamente — mai la `HttpContext` live dentro un task in background, che Kestrel ricicla subito dopo la risposta.
- Il payload porta `project` (da `project.name`): pensato per più progetti sulla stessa VPS che condividono un solo webhook/relay, restando comunque distinguibili.
- Deliberatamente un webhook generico, non un client nativo per un vendor specifico: a differenza di SMTP, il formato di ingestione di un APM (Sentry incluso) non è uno standard — legarlo dentro l'Engine vorrebbe dire far ereditare a ogni figlio il rischio che quel vendor cambi la sua API privata. Chi vuole un vendor specifico scrive un piccolo relay di traduzione fuori dal template, riusabile su tutti i propri progetti.
- Verificato: `dotnet build` (0 warning, 0 errori).

### Checklist di pre-lancio incorporata negli script di deploy

Un documento "cosa non dimenticare prima di andare live" è utile solo se qualcuno lo riapre il giorno del deploy vero — di norma non succede. Il promemoria vive quindi dentro lo script che lancia davvero la pubblicazione, accanto ai guard sui segreti già esistenti.

- Nuova `br1_content_placeholder_warnings` (`scripts/lib/br1-config.sh`), condivisa da `deploy.sh` e `deploy-release.sh`: avvisa, senza bloccare, se `project.name` è ancora il default `"App"` o se `backend/data/identity.json` è ancora lo scheletro vuoto lasciato dall'eject. `deploy-release.sh` verifica solo `project.name`: modello artifact-based, niente sorgente sulla VPS, `identity.json` non c'è da controllare.
- Non bloccante di proposito: sono stati finali legittimi in alcuni casi (`identity.json` vuoto nasconde da solo footer e blocco legale, vedi `README.md`).
- Verificato a mano contro dati segnaposto e dati reali del repo (nessun falso positivo/negativo).

### Cookie tecnici: separati in `Technical` (sempre esenti) e `TechnicalOptional` (PWA/SW, consenso vero)

La categoria `Technical` copriva due cose diverse sotto lo stesso nome: i cookie strettamente necessari (sessione, memoria del consenso), esenti da consenso per legge (art. 122 Codice Privacy / art. 5.3 ePrivacy), **e** il Service Worker/PWA built-in, che invece va oltre il minimo necessario (installabilità/offline) ed è tecnico ma non indispensabile. Il banner mostrava comunque uno switch su "Technical" per il caso PWA: uno switch su qualcosa di dichiarato esente per legge è un'incoerenza legale, non solo terminologica.

- Nuovo valore enum `ConsentCategory.TechnicalOptional`: il Service Worker (`ngsw-worker.js` in `ENGINE_COOKIE_MAP`) e gli eventuali cookie tecnici-ma-non-indispensabili di progetto ora vivono qui, con switch esplicito nel banner — stesso trattamento di Analytics/Profiling (proprio signal, propria voce `CONSENT_KEYS`/`CONSENT_COOKIE_MAP`, propria pulizia alla revoca).
- `Technical` resta solo per ciò che è davvero strettamente necessario: mai uno switch, solo un badge informativo ("Necessari" — prima "Obbligatorio"/"Required", cambiato per riflettere che l'utente non ha scelta, non che sia un obbligo generico). `isCategoryAccepted(Technical)` ora ritorna sempre `true`, senza condizioni: prima era legato a un signal che, per come `hasTechnicalCategory` è composto (bearerToken/cookie di progetto entrano in `_cm` per vie che quel computed non copre tutte), poteva in teoria bloccare in silenzio la scrittura di un cookie Technical built-in futuro — oggi non successo solo per l'incrocio di più guardie indipendenti (`TokenService`/`ESSENTIAL_ENGINE_STORAGE_KEYS`), non per garanzia esplicita.
- Nuovo `hasTechnicalCategory()` (banner/policy: "c'è qualcosa da dichiarare in Technical?") separato da `isTechnicalOptionalNeeded()` (banner: "serve un vero consenso in TechnicalOptional?") — prima un unico `isTechnicalNeeded()` confondeva le due domande.
- **Breaking per i figli con `COOKIE_MAP` proprio:** una voce che oggi usa `ConsentCategory.Technical` ma NON è strettamente necessaria (va oltre il minimo per erogare il servizio) va spostata a `ConsentCategory.TechnicalOptional` — altrimenti finisce dichiarata come esente per legge quando non lo è. Rinominata anche la chiave i18n `consentTechnicalDescrizioneListaCookie` → `consentTechnicalOptionalDescrizioneListaCookie`.
- Verificato: `dotnet build` non tocca quest'area (frontend-only); build di produzione frontend (type-check incluso) pulita.

### Identità: `titolareDelTrattamento` (GDPR art. 4.7) e `responsabileProtezioneDati`/DPO (GDPR art. 37)

Due nuovi campi opzionali di `SiteIdentity`, entrambi `LegalRole { Nome, Email }`, resi nel footer/pagine legali dallo stesso `IdentityRenderComponent` che già rende ragione sociale/sede/rappresentante legale. Nessun fallback automatico su nessuno dei due: nella maggior parte dei siti (P.IVA singola) il titolare coincide con l'azienda stessa, già esposta da `ragioneSociale`/`contatti.email` — ripeterlo sarebbe rumore; un DPO "presunto" per chi non ne ha uno inventerebbe una carica che non esiste (la designazione è obbligatoria solo per PA/monitoraggio sistematico/dati particolari su larga scala). Assenti ⇒ nessuna riga, come già per gli altri campi opzionali dell'identità.

- Email di entrambi i ruoli validata con lo stesso `ValidEmail` (`MailAddress`) già usato per `contatti.email`/`pec` — fail-fast su un valore presente ma malformato, coerente col resto del modello identità.
- `PolicyComponent`: la Cookie Policy interpola `{{companyProfile}}` con l'identità completa (nuova sezione "Titolare del trattamento"/"Data controller" in `cookie.it.md`/`cookie.en.md`).
- Nuovo `hasIdentityContent()` (esportato da `identity-render.component.ts`): l'identità può esistere (non `null`) ma avere ogni campo vuoto — la Cookie Policy ora monta `app-identity-render` solo se c'è davvero qualcosa da mostrare, invece di riservare uno spazio vuoto.
- **Fix collaterale**: nella colonna Contatti del footer, gli orari (fino a 7 righe) sommati a email/badge allungavano quella colonna molto più delle colonne societarie/legali accanto. Spostati in una colonna a sé.
- Verificato: `dotnet build` (0 warning, 0 errori); build di produzione frontend pulita.

### Footer: pagine legali auto-derivate in una fascia "small prints", non più una voce di `footerNav`

Le pagine legali (Privacy/Cookie/TOS/Note Legali/Accessibilità) erano dichiarate a mano in `site.ts` come un `addGroup` annidato dentro `footerNav` — una colonna della griglia di navigazione, alla pari di categorie di prodotto o sezioni del sito, quando concettualmente sono un'altra cosa (small prints istituzionali, pattern già usato da footer PA/Designers Italia).

- Nuovo `BuiltSite.getLegalFooterLinks(lang)` (`siteBuilder.ts`): risolve `config.legalPages` (privacy/cookie/tos/legal/accessibility, in quest'ordine fisso) direttamente in `NavLink[]`, senza bisogno di dichiararle in `footerNav`. Uno slot omesso o una pagina rimossa da `pages` sparisce da solo dalla fascia.
- Nuovo `app-footer-link-row` (`components/footer-link-row/`): riga orizzontale compatta senza titolo, condivisa da due consumer — la nuova fascia legale in `footer.component` e i link/pagine sciolti in cima a `footerNav` (fuori da un `addGroup`), che prima occupavano una colonna intera per un solo link. `FooterNavComponent` ora separa `groups()` (colonna a sé) da `standaloneLinks()` (riga compatta).
- Nuovo `.footer-nav-groups` (`_footer.scss`): griglia fluida `auto-fit`/`minmax(160px, 240px)` al posto delle colonne Bootstrap fisse (`col-lg-2`), centrata anche con un solo gruppo — la larghezza piena lasciava un gruppo singolo sbilanciato a sinistra.
- `site.ts`/`setup.mjs` (demo + eject): rimosso il gruppo `menuPolicy` da `footerNav`, `footerNav` ora contiene solo il link libero di progetto (GitHub).
- **Breaking per i figli che personalizzano `footerNav` in `site.ts`** (file di Dominio, non toccato dal merge): chi aveva copiato lo stesso pattern (`addGroup` con le pagine legali) può rimuoverlo — le pagine legali compaiono ora comunque, nella fascia dedicata. Non è un errore lasciarlo: risulterebbe solo duplicato (una volta nella fascia automatica, una volta nella colonna di `footerNav`).
- Verificato: build di produzione frontend (type-check incluso) pulita.

### Fix: guard/resolver potevano leggere la lingua sbagliata durante la navigazione

`PageBaseComponent` allinea `TranslateService.currentLang()` alla lingua della route solo al montaggio del componente — che avviene **dopo** la fase Guard e la fase Resolve di Angular Router. Un resolver che legge `currentLang()` come fallback (`content.resolver.ts`) o un guard che ne dipende poteva quindi trovare ancora la lingua precedente durante la navigazione, non quella della route appena richiesta. `authGuard` se n'era già accorto e leggeva `route.data['lang']` invece di `currentLang()`, ma solo per sé stesso — ogni nuovo guard/resolver avrebbe dovuto reimplementare lo stesso accorgimento a mano.

- Nuovo `languageSyncGuard` (`route-guards.ts`), applicato a **ogni** route in `routing.ts` (non solo quelle protette): allinea `currentLang()` alla lingua della route (`await translate.setLanguage(lang)`) prima che qualunque guard/resolver a valle giri. Angular Router completa l'intera fase Guard prima di iniziare Resolve, quindi basta un guard qualsiasi nell'array a garantire l'ordine.
- Verificato: build di produzione frontend (type-check incluso) pulita.

### Revisione di correttezza esaustiva, per aree, su tutto il repository

Cinque revisori paralleli, ciascuno su una fetta del repo (frontend Engine, frontend Dominio/Demo, backend Engine, backend Dominio/Demo, scripts/build/config/CI), con l'istruzione di trovare solo bug reali e concreti, non di stile, e di verificare ogni doc comment sospetto con `git log -p` prima di segnalarlo. Ogni finding riportato è stato riverificato a mano contro il sorgente reale prima di applicare un fix (il pattern che aveva già smascherato la regressione di `AccountService` sopra). Sei bug reali trovati e corretti:

- **`TranslateService.setLanguage()` (frontend Engine) — race condition sul cambio lingua.** Chiamato da più punti indipendenti (mount di ogni pagina, selettore lingua nella navbar, guard di login) senza alcuna guardia di sequenza: una chiamata più vecchia poteva risolversi *dopo* una più recente e sovrascrivere `currentLang`/`<html lang>`/i cataloghi caricati con uno stato non più coerente con l'URL corrente — riproducibile con un doppio click veloce sul selettore lingua, o una navigazione rapida durante un fetch lento. Aggiunto un token di sequenza (stesso pattern di `renderToken` in `img-render.directive.ts`): la risposta di una `setLanguage()` ormai superata viene scartata invece di scrivere lo stato.
- **`BlobStore.SaveAsync(Stream, string extension, ...)` (backend Dominio) — guardia path-traversal mancante sulla scrittura.** `TryResolve` (usato da lettura/cancellazione) valida il percorso risolto contro la cartella upload; l'overload di scrittura no — costruiva `filePath` concatenando `extension` nello slug senza mai controllarlo. Con l'unico chiamante HTTP odierno (`SaveAsync(IFormFile)`, che deriva l'estensione con `Path.GetExtension`) non è sfruttabile, ma è un metodo `virtual` esplicitamente pensato per essere esteso dai progetti figli, e il doc comment della classe promette la guardia per l'intero store. Allineata la stessa validazione anche in scrittura.
- **`UploadFormComponent` (frontend Dominio) — filtro `accept` applicato solo al drag-and-drop.** `onDrop` rifiutava le estensioni non ammesse, `onFileSelected` (click) no — l'attributo HTML nativo `accept` è solo un suggerimento per il selettore del sistema operativo ("Tutti i file" lo bypassa), quindi lo stesso file scelto per click passava senza controllo mentre trascinato veniva rifiutato. Estratto un unico metodo condiviso dai due percorsi.
- **`generate-statics.ts` (build) — `SupportedLanguages: []` esplicito produceva un sito senza rotte.** Il fallback `_supportedRaw ?? [DEFAULT_LANG]` copre solo `null`/`undefined`, non un array vuoto (che lo schema JSON vieta solo sulla carta — nessuna validazione lo applica a runtime). Con `[]`, `AVAILABLE_LANGS` diventava `[]`, `routing.ts` e `siteBuilder.ts` costruiscono rotte/sitemap iterando su quell'array: zero pagine sopravvivevano (solo le route d'errore), sitemap/llms.txt restavano vuoti — un'interruzione totale e silenziosa del sito, non intercettata da `scripts/test/i18n-check.sh` perché quello script ha già un fallback equivalente ma scritto in modo indipendente (passa comunque in CI). Allineata la guardia.
- **`scripts/backup.sh` — `RETENTION=0` cancellava il backup appena creato.** `tail -n +$((RETENTION + 1))` con `RETENTION=0` diventa `tail -n +1`, che include anche l'archivio creato in quello stesso run fra i "vecchi da eliminare" — lo script terminava con zero backup su disco stampando comunque "Backup completato". Forzato un minimo di 1 con warning esplicito.
- **`Release di Produzione.yml` — input `tag` interpolato direttamente in uno step shell.** Pattern classico di script-injection nelle GitHub Actions (un'espressione `${{ }}` finisce nel testo dello script prima che bash lo esegua). Non sfruttabile oggi (`workflow_dispatch` richiede già accesso in scrittura al repo), ma passato per `env:` per coerenza con il resto del progetto.

Più due correzioni di doc comment che affermavano un comportamento diverso da quello implementato (in `EngineAuthController`: "generazione e validazione token" quando `AuthService` genera soltanto; in `IconComponent`: default documentato `lift`, default reale `none`).

Segnalato ma non corretto, in attesa di una decisione del maintainer: la pagina `/impostazioni` (autenticata) riusa `SocialComponent` come componente, ma `ContentResolver` non ha un `case` per `PageType.Impostazioni`: la pagina risolve sempre a contenuto vuoto e si renderizza come un'area completamente bianca, senza errori né messaggio. Non rompe nulla, ma non è chiaro se sia una demo minimale intenzionale o uno scaffold dimenticato a metà.

Verificato: build di produzione frontend (`scripts/test/tsc-check.sh`) e `dotnet build` backend dopo ogni batch di fix, entrambi puliti; `generate-statics.ts` rieseguito direttamente (output identico); sintassi bash e YAML validate.

### Ripristinato il fail-closed sulle credenziali demo in Production (regressione di sicurezza)

Revisione di correttezza estesa a tutto il repository (non solo al branch): il commit `587ad21` ("fix (engine) migliorie cookle e bottone", 11 luglio 2026) aveva rimosso da `AccountService.ValidateCredentialsAsync` il controllo che rifiuta le credenziali demo (`admin`/`Password1!`) quando l'ambiente è Production, lasciando però il campo `_env`, il parametro del costruttore e il commento XML ("fail-closed sulle credenziali demo in Production") tutti al loro posto, a dichiarare una protezione che non esisteva più. `_env` era diventato un campo scritto e mai più letto: il segnale che ha fatto emergere la regressione.

Impatto concreto: un progetto figlio che accende il login (valorizza `Security.Token.SecretKey`) ma dimentica di sostituire `AccountService` con la propria verifica reale, distribuito in Production, avrebbe accettato in autenticazione le credenziali demo (pubbliche, perché scritte nel sorgente di un template open-source), ottenendo un JWT valido con ruolo `admin`. Nessun altro controllo a runtime lo impediva.

Fix: ripristinato il blocco `if (_env.IsProduction() && validUsername == "admin" && validPassword == "Password1!") throw new UnauthorizedException();` con log esplicito, esattamente come prima della regressione. La condizione è sulle costanti compile-time, quindi si disattiva da sola non appena un progetto sostituisce le credenziali demo con la propria logica.

Verificato con `dotnet build` (0 warning, 0 errori).

### Revisione sicurezza + qualità del codice di questo giro (nessun fix di sicurezza necessario)

Due controlli dedicati sul diff completo del branch: una security review focalizzata su ciò che è stato introdotto (gestione GPC, rimozione cookie lingua, rimozione alias deprecati), che non ha trovato nessuna vulnerabilità ad alta confidenza, e una revisione di qualità (riuso, semplificazione, efficienza, altitudine) via 4 controlli paralleli.

- Estratto `applyGpcOptOut()` in `CookieConsentService`: la logica di opt-out GPC per Analytics e Profiling era duplicata riga per riga; ora è un metodo unico condiviso, pronto a coprire una terza categoria futura senza ricopiare il pattern.
- Altri finding emersi dai controlli riguardavano codice preesistente su `main`, non introdotto da questo branch (falso positivo da un `origin/main` locale non aggiornato durante l'analisi) — scartati come fuori scope, non applicati.

### Chiarito che Google Consent Mode v2 è obbligatorio, non un extra opzionale

I due titoli di sezione ("predisposizione, non attiva di default" in AGENTS.md, "ricetta pronta, non attiva di default" in frontend/README.md) suonavano come un miglioramento facoltativo. Il corpo del testo era già accurato (cita la scadenza del 28 marzo 2024), ma il titolo, quello che si legge per primo e spesso l'unico se si scorre veloce, no. Verificato: Consent Mode v2 è obbligatorio dal 2024, pieno enforcement nel 2026 (senza, un account perde remarketing/conversion modeling per il traffico UE/UK). Titoli riformulati in entrambi i file per dire questo fin da subito.

### Colmate le lacune emerse da una revisione junior/senior della documentazione

Fatta rileggere tutta la documentazione (root README, frontend/backend README, AGENTS.md, QUICKSTART.md, DOCKER_README.md) con due letture indipendenti (uno sviluppatore junior che deve completare un task, un architetto senior che valuta l'adozione) per trovare cosa manca o è spiegato debolmente. Ogni claim aggiunta è stata verificata contro il codice reale prima di scriverla, non dedotta.

Correzioni di accuratezza (esempi che non avrebbero compilato o punti ancora disallineati dal codice):
- QUICKSTART.md e una seconda occorrenza in `README.md` ripetevano la stessa confusione "pagine dichiarate in `site.ts`" già corretta altrove — sfuggite al giro precedente perché fuori dai file toccati allora.
- Tre snippet copiabili (`frontend/README.md` ×2, `AGENTS.md` ×1) mostravano `component: () => import('./x.component')` **senza** `.then(m => m.XComponent)` — non compila, il tipo dichiarato da `LeafPageInput.component` è `Promise<Type<...>>`, non la promise nuda del modulo.
- La ricetta "Aggiungere una pagina" in AGENTS.md aveva anche `extends PageBaseComponent { }` senza l'argomento di tipo — sempre richiesto, nessun default, ogni pagina reale del template lo valorizza (`<void>`, `<string>`, ecc.).
- `mapping.json` (asset id → file) era descritto come "generato al build": è mantenuto a mano, nessuno script lo scrive.

Lacune reali colmate (verificate leggendo il codice, non inventate):
- Come registrare un nuovo asset (`frontend/README.md`) — mancava del tutto.
- `children` (rotta annidata) vs `addGroup` (voce di menu annidata) — stesso termine "annidamento" per due meccanismi diversi, ora contrastati con un esempio.
- Rate limiter: soglie hardcoded (non configurabili da `global-settings.json`) e per-istanza (nessun backplane condiviso, stesso limite già segnalato per `IContentStore`/`INotificationStream`).
- Nessun refresh token: alla scadenza serve un nuovo login, ora dichiarato esplicitamente invece di lasciarlo dedurre dai meccanismi sparsi.
- Conseguenze concrete della rotazione di `Token.SecretKey` (logout di tutti) e `CryptoSecret` (dati già cifrati diventano illeggibili).
- Firme reali di `AccountService.ValidateCredentialsAsync`/`DeleteAccountAsync` per chi sostituisce il login demo.
- Override del limite di upload di `BlobController` — la versione precedente ipotizzava un pattern a ereditarietà (`override`/`base.Upload`) che non esiste: `Upload` vive per intero nel controller di Dominio, si cambia l'attributo e basta.
- Sintomo silenzioso di `SessionInfo`/`session.dto.ts` disallineati (campo `undefined`, nessun errore).
- PWA (`isWebApp: true`) + token in `sessionStorage`: il rilancio dell'app installata può creare un nuovo contesto di navigazione e sloggare silenziosamente l'utente.
- Osservabilità: `Logger` è `ILogger` standard, nessuna metrica/tracing cablato oltre `/health` — dichiarato invece di lasciarlo silenzioso.
- Asimmetria dei gate CI: sei controlli in CI sono tutti frontend, il backend ha solo lo scan vulnerabilità NuGet, nessun progetto di test nella solution oggi.
- `backup.sh` fa un `tar` a caldo del volume senza stop dei container: innocuo oggi (`uploads-data` ha slug immutabili, `db-data` non è ancora scritto da nessuno) ma da rivalutare se il progetto migra a un DB reale su quel volume.
- Nessuna policy di versioning formale del template (niente semver): documentato che la garanzia reale è l'elenco "Dominio a contratto fisso" + la lettura di `CHANGELOG.md` prima di un merge, non inventata una promessa che non esiste.
- Recipe mancanti in AGENTS.md (Mailer, upload/servire un file) — feature di prim'ordine nei README completi ma invisibili a chi lavora solo dalle ricette rapide.
- Pointer esplicito da AGENTS.md alla tabella "Dominio a contratto fisso" del README principale, per chi risolve un conflitto di merge partendo solo dalle ricette rapide.

### Audit documentazione: tre residui della rimozione del cookie lingua rimasti nel README

Giro di verifica dedicato: la documentazione deve fotografare lo stato attuale del codice, non alludere a comportamenti precedenti. Cercate sistematicamente frasi storiche/narrative ("in precedenza", "storicamente", ecc.) in tutti i `.md` del repo (CHANGELOG.md escluso, che è storico per natura): nessuna trovata, i giri precedenti erano già stati accurati sul registro. Trovati invece tre riferimenti rimasti disallineati dal codice in `frontend/README.md`, sfuggiti alla pulizia del cookie lingua:

- La sezione "Controllo Versione" citava ancora "multilingua"/"sito mono-lingua" come condizioni del gate sul consenso tecnico — `isTechnicalNeeded` non lo considera più da tempo.
- "Pagine legali" citava "cookie (multilingua, PWA...)" come motivo per cui lo slot `cookie` è obbligatorio — stessa condizione già rimossa da `hasCookiesConfigured`.
- "Script di Build" citava "pagina cookie" come consumatore dei codici lingua a build-time — corretto in "routing per-lingua", coerente con la correzione già fatta altrove (`generate-statics.ts`, `global-settings.types.ts`, `global-settings.schema.json`, `app.config.server.ts`).

### Chiarito ulteriormente dove vivono le pagine: `pages/*.pages.ts`, non `site.ts`

Un giro precedente aveva già corretto l'apertura dei README; restava impreciso il dettaglio: la sezione "Pagine & rotte" era ancora intitolata `(site.ts)`, e il passo 4 del Developer Journey diceva di usare `requiresAuth: true` "nella dichiarazione in `site.ts`" quando in realtà è un campo di `LeafPageInput`, dichiarato nel file di area.

- `frontend/README.md`: sezione rinominata `(pages/*.pages.ts + site.ts)`, con una tabella esplicita "cosa va dove" (path/pageType/component/requiresAuth/renderMode/layout/description/otherSEO/children/externalUrl nel file di area; homePage/loginPage/legalPages/shell/isWebApp/onlyPlainImage/headerNav/footerNav in site.ts). Corretto anche il passo 4 del Developer Journey.
- `siteBuilder.ts`: i commenti JSDoc di `BasePageInput`/`ParentPageInput`/`LeafPageInput`/`ExternalPageInput`/`SitePageInput` dicevano ancora "dichiarabile in `site.ts`" — sono il tooltip che l'IDE mostra scrivendo una pagina, quindi la fonte di confusione più autorevole di tutte. Riallineati alla convenzione reale.

### Aggiunto `aria-hidden` alle icone FontAwesome decorative rimaste scoperte

Verificate le ~56 icone FontAwesome del template: 21 erano prive di `aria-hidden="true"` pur essendo puramente decorative (sempre affiancate da testo visibile o dentro un elemento già etichettato). Metà del codice applicava già la convenzione giusta, l'altra metà se l'era persa per strada. Corrette in `upload-form`, `login-form`, `login.component`, `cookie-banner` (pulsante di riapertura) e `policy.component` (icone di categoria, in entrambe le viste). Cinque falsi positivi individuati e lasciati intatti: già coperti da un `aria-hidden` sul contenitore padre (le intestazioni di sezione in `home.component.html`) o sullo stesso tag su una riga successiva.

Nota: non si tratta di un problema del web-font come metodo di delivery (i numeri non giustificano una migrazione a SVG per un template che vuole dare accesso all'intero catalogo icone a ogni figlio: l'intero set FontAwesome pesa 508 KB come font contro 8.3 MB come SVG raw), solo disciplina incoerente nei singoli template.

### Rimossi gli alias deprecati `setCookie`/`getCookie`/`removeCookie` (breaking)

Erano tenuti solo per non rompere call-site esistenti dai tempi in cui l'API era cookie-only; oggi il template è troppo giovane per avere un vincolo di compatibilità reale da onorare, quindi via. Usa `set`/`get`/`remove` (stessa firma, instradano anche sul Web Storage).

- Migrate tutte le chiamate interne di `CookieConsentService` (costruttore, `persistConsent`) ai metodi non-deprecati.
- Ripulite le doc (`README.md`, `AGENTS.md`, commenti in `cookie-type.ts`) dai riferimenti agli alias e da un esempio ormai orfano (la persistenza lingua via SSR, rimossa in un commit precedente).
- **Fix collaterale**: rinominata la sezione `// ── Backward-compat static methods` in `ThemeService` — l'etichetta era sbagliata, quei metodi statici sono l'algoritmo di calcolo palette attivo (usato sia da `computePalette` sia dalla generazione SSR dei tag `<head>`), non compatibilità con niente. Nessuna modifica di comportamento, solo il nome della sezione.
- **Fix collaterale**: rimossi due import morti (`onNavigationEnd`, `Router`) in `cookie-banner.component.ts`, residuo di refactoring precedenti.
- **Se hai un figlio che chiama `setCookie`/`getCookie`/`removeCookie`**: al merge di questo aggiornamento, sostituiscili con `set`/`get`/`remove` — stessa firma, nessun altro cambiamento richiesto.

### Chiarita la relazione `site.ts` ↔ `pages/*.pages.ts` in apertura README

Il paragrafo di apertura ("in `site.ts` dichiari un oggetto JSON") lasciava intendere che le pagine si dichiarassero lì, quando in realtà vivono nei file di area sotto `pages/*.pages.ts` fin dall'inizio. Il corpo della documentazione lo spiegava già bene più avanti, ma la primissima impressione era fuorviante. Aggiornati il paragrafo di apertura di `frontend/README.md`, la tabella comparativa e l'albero directory in `README.md` (principale) per dire la stessa cosa fin da subito.

### Onorato automaticamente il segnale Global Privacy Control (GPC)

`CookieConsentService` legge ora `navigator.globalPrivacyControl` e, se il browser (o un'estensione) lo manda, tratta Analytics e Profiling come già rifiutati (mai i cookie Technical, che GPC non copre). Motivazione: dal 2026 California, Colorado e Connecticut riconoscono GPC come Universal Opt-Out Mechanism e ne richiedono il rispetto per legge (controlli congiunti già avviati tra i tre stati; una prima sanzione da $1.35M già comminata a settembre 2025 per averlo ignorato). Per l'UE non cambia nulla, il banner opt-in resta più severo, ma un template pensato per essere riusato non può ignorare un segnale che il browser manda gratuitamente.

- Nuovo `consent.gpcSignaled: boolean`, valutato una volta all'avvio (browser-only, sempre `false` in SSR — stesso principio di `isNeeded`).
- L'opt-out va **registrato**, non solo applicato in-memory: se l'utente non ha ancora risposto esplicitamente per Analytics/Profiling, viene scritto subito il cookie di rifiuto, altrimenti il banner riproporrebbe la stessa domanda ad ogni visita nonostante il browser stia già rispondendo "no". Una scelta manuale successiva dal banner prevale sempre.
- Il banner mostra una conferma visibile (`gpcRilevatoBannerCookie`) quando il segnale è stato onorato — richiesto dalle normative che lo trattano: non basta rispettarlo, va anche mostrato che lo è stato.
- **Fix collaterale**: `tecniciDescrizioneCategoriaCookie` citava ancora "preferenza lingua" come esempio di cookie tecnico, residuo della rimozione del cookie lingua — sostituito con "funzionalità offline/PWA".

### Rimosso il cookie di preferenza lingua e il redirect automatico su Accept-Language (breaking)

Il cookie `lang` e la guard `langRedirectGuard` (che rediregeva la primissima visita su un URL non prefissato verso la lingua del browser) sono stati rimossi. Motivazione: da tempo l'URL, non più il cookie/Accept-Language, è l'unica fonte di verità sulla lingua di una pagina; il redirect automatico sopravviveva solo per decidere se rifare quella scelta ad ogni visita su `/`. Google ("Managing Multi-Regional and Multilingual Sites") raccomanda esplicitamente di evitare redirect basati sulla lingua percepita, perché rischiano di impedire a Googlebot, che non invia un `Accept-Language` significativo, di scoprire le varianti; il W3C conferma che l'approccio URL-based è preferibile per caching/SEO. Un sito multilingua ora atterra sempre sulla lingua di default su `/`; il cambio lingua resta sempre disponibile ed esplicito dal selettore in navbar.

- `TranslateService`: rimossi `persistLanguage`, l'`effect` che salvava la lingua al consenso tecnico, e ogni dipendenza da `CookieConsentService`.
- `CookieConsentService`: rimossi `getSavedLanguage`/`setSavedLanguage`/`clearSavedLanguage` e la voce `lang` da `ENGINE_COOKIE_MAP`. La sola presenza di più lingue non rende più necessario il consenso tecnico (`isTechnicalNeeded`) né obbliga la pagina Cookie Policy (`hasCookiesConfigured`) — un sito multilingua puro, senza PWA né cookie di progetto, può ora non avere banner cookie affatto.
- `route-guards.ts`/`routing.ts`: rimossi `langRedirectGuard` e il relativo pattern anti-bot, ora inutili.
- **Se hai un figlio con più lingue**: al merge di questo aggiornamento, verifica se `legalPages.cookie` resta necessario (potrebbe non esserlo più) e se la Cookie Policy va rigenerata/aggiornata di data.

### Voci di menu visibili solo da loggato (`authOnly` su `addPage`/`addLink`/`addGroup`)

`requiresAuth: true` su una pagina protegge la rotta (redirect al login/401), ma non nascondeva la voce di menu corrispondente: un link verso un'area riservata restava visibile (e cliccabile) anche da sloggato, rimbalzando poi al login. Le due cose restano deliberatamente disaccoppiate (un link può restare sempre visibile pur protetto, o sparire senza che la pagina richieda login): l'una non implica l'altra.

- `addPage`/`addLink`/`addGroup` accettano ora un terzo parametro opzionale `{ authOnly: true }`: la voce — o, su `addGroup`, l'intero gruppo coi suoi figli — compare in navbar e footer solo per utenti loggati, sparendo del tutto per visitatori e bot. Un gruppo rimasto senza figli visibili dopo il filtro sparisce a sua volta.
- Nuovo `filterNavByAuth` (`siteBuilder.ts`), applicato a runtime in base allo stato di login: `TokenService.isLoggedIn()` nella navbar (Engine), `AuthService` nel footer (Dominio, stesso pattern già usato da `user-nav.component.ts`). In SSR e prima dell'idratazione l'utente risulta sempre sloggato — coerente con `requiresAuth`, che già esclude quelle pagine da sitemap/SSR.
- Volutamente binario (loggato/sloggato), non un sistema di ruoli: la granularità per-ruolo resta complessità di Dominio, non un seam dell'Engine.
- Demo aggiornata: `PageType.Impostazioni` (già `requiresAuth: true`) è ora anche `authOnly: true` in `site.ts`.

### Navbar: le voci di primo livello in eccesso confluiscono in un dropdown "Altro"

Oltre le 6 voci dirette in `headerNav` (soglia già segnalata da un warning in console) la navbar desktop non aveva overflow: `flex-wrap: nowrap` di Bootstrap le spingeva fuori dalla viewport, letteralmente irraggiungibili senza scroll orizzontale. Un tentativo CSS-only (`flex-wrap: wrap`) è stato scartato perché, per come il browser calcola la dimensione minima automatica di un flex-container che va a capo, faceva collassare a una voce per riga anche il caso comune (poche voci, spazio abbondante).

- La navbar misura ora la larghezza reale disponibile (`ResizeObserver` su contenitore e lista) e sposta le voci che non entrano in un dropdown finale **"Altro"** — stesso rendering di un `addGroup` dichiarato, nessuna duplicazione di template. Attivo solo oltre la soglia raccomandata (6): sotto, nessun costo aggiuntivo.
- Ricalcolato anche al cambio lingua (le label possono cambiare larghezza) e, insieme alla funzionalità sopra, al login/logout se il menu contiene voci `authOnly`.
- **Fix collaterale**: `_utilities.scss` applicava `overflow-x: hidden` al `.container-fluid` anche esattamente a 768px (il resto del progetto tratta 768px come desktop), forzando `overflow-y: auto` e tagliando qualunque dropdown che dovesse sforare in verticale a quella larghezza esatta — bug preesistente, colpiva già la voce "Policy", non solo la nuova "Altro". Corretto a `max-width: #{lib.$bp-md - 0.02px}`.

### Breakpoint desktop/mobile: sorgente unica condivisa fra SCSS e TS (`breakpoints.ts`)

Il breakpoint `768px` era hardcoded indipendentemente in due file TS (`navbar.component.ts`, `nav-submenu.component.ts`) oltre che nello SCSS: un cambio del breakpoint richiedeva ricordarsi di tre punti, con rischio di silenziosa divergenza.

- Nuovo `--bp-md` (custom property CSS, iniettata in `_base.scss` da `lib.$bp-md`) e `breakpoints.ts` → `isDesktopViewport()`, che la legge via `getComputedStyle` invece di duplicare il numero. Adottato da entrambi i punti TS che ne avevano bisogno.

### Guardia contro un `environment.ts` non rigenerato (`configFingerprint`)

`ng serve` lanciato direttamente (bypassando i pre-hook `predev`/`prestart`) o un `global-settings.json` modificato senza rilanciare la build lasciavano `environment.ts` disallineato dalla configurazione reale, senza alcun segnale: l'SSR partiva comunque, semplicemente con identità/tema/lingue stantii.

- `generate-statics.ts` scrive ora in `environment.ts` un `configFingerprint`: hash SHA1 (12 caratteri) delle sole sezioni identity-critiche di `global-settings.json` (`project`/`Localization`/`site`, mai `.local.json`). `server.ts` lo ricalcola al boot dal config letto a runtime e confronta i due valori, stampando un warning su mismatch — un segnale di dev, non un gate bloccante.
- **Effetto collaterale corretto**: `generate-statics.ts` ora fonde `global-settings.local.json` sopra il base nello stesso modo di `server-env.ts` (nuovo `settings-merge.ts`, `deepMergeSettings`, condiviso fra i due) — prima leggeva solo il file base in locale, creando un potenziale falso positivo del fingerprint per chi ha segreti che toccano anche `project`/`Localization`/`site` in `.local.json`. Il percorso Docker (`BR1_PROJECT_JSON`) resta volutamente solo-base, senza segreti.

### Dipendenze: risolte 9 vulnerabilità (Angular, sharp, body-parser)

`npm audit` segnalava CVE su 8 pacchetti `@angular/*` (bloccati su `21.2.17` nonostante versioni patchate compatibili nel range dichiarato, dove `npm audit fix` da solo non bastava e serviva `ng update`), su `body-parser` e sulla major `0.34` di `sharp`.

- Bump a `@angular/*` `^21.2.20`/`^21.2.21` (via `ng update @angular/core@21 @angular/cli@21`), `sharp` `^0.34.5` → `^0.35.3`.
- `sharp` 0.35 ha ristrutturato gli export dei tipi da namespace CJS a export ESM nominati: fix del breaking change in `routes/og-preview.ts` (`sharp.OverlayOptions` → `import { type OverlayOptions }`).
- 0 vulnerabilità rimaste in `npm audit --omit=dev` (produzione). Restano note e non applicate 5 vulnerabilità *high* nella sola catena dev `pa11y → puppeteer → extract-zip`: richiederebbero un downgrade di 3 major di `pa11y`, giudicato sproporzionato per una dipendenza di solo test.

### Budget del bundle di produzione: `850kB`/`1MB` → `950kB`/`1.1MB`

Il bundle iniziale del template (prima ancora di una riga di contenuto del progetto figlio) pesa ~860kB raw (Bootstrap + Font Awesome + Angular core + SweetAlert2 CSS, tutti già ottimizzati/lazy dove possibile), sopra il default `850kB` generato da `ng new` per un progetto Angular vuoto. Stripping/subsetting di Bootstrap o Font Awesome è stato scartato: rischioso per un template pensato per usi molto diversi fra loro, senza sapere in anticipo cosa un figlio userà davvero.

- `angular.json`: budget iniziale alzato a `950kB` (warning) / `1.1MB` (errore, l'unico che blocca `ng build`/CI). Ragionamento e scomposizione per libreria in `frontend/README.md` § Bundling.

### Fix: selettore lingua non allineato a destra senza voci di menu

`justify-content: space-between` nel container della navbar richiede esattamente due figli flex diretti; un terzo elemento rompeva l'allineamento quando `headerNav` non dichiarava alcuna voce: il selettore lingua smetteva di restare a destra su desktop. Corretto senza toccare il caso con voci di menu, verificato su 15 scenari reali (0 / 4-5 / molte voci di menu × 5 ampiezze di viewport).

### QUICKSTART: la "nascita" (remote `template` + merge) è ora il primo passo

Il flusso nascita → aggiornamento dell'Engine era descritto solo nel README (sezione Template vivo); il QUICKSTART partiva dritto da `node setup.mjs`, senza mai dire di aggiungere il remote `template`. Un progetto avviato seguendo solo il QUICKSTART nasceva quindi scollegato dal template, e il successivo `git merge template/main` non aveva con chi parlare.

- Nuovo **passo 1 "Nasci dal template"** in `QUICKSTART.md`: il progetto vive in un repo proprio, il template entra come secondo remote e lo si innesta una volta sola con `git merge template/main --allow-unrelated-histories`. Gli aggiornamenti successivi sono `git fetch template && git merge template/main` (senza flag: la storia è ormai collegata), con rimando al README per le regole di conflitto. I passi successivi sono rinumerati (battesimo → 2, file → 3, up → 4).
- **Niente `--squash`, niente clone come punto di partenza.** Lo squash reciderebbe la parentela git col template (ogni aggiornamento tornerebbe a pretendere `--allow-unrelated-histories` e una riconciliazione dell'intero albero); il `merge` normale la conserva, così `git log --first-parent` resta pulito ma gli update restano indolori.
- **README (*Template vivo → Nascita*) e `DOCKER_README.md` allineati** allo stesso modello: la nascita non è più un clone ma un innesto via remote. Aggiunto l'avviso che il bottone GitHub **"Use this template"** non va usato per far nascere un figlio — riparte da un singolo *Initial commit* senza storia e lascia il progetto orfano del template. Solo documentazione: nessun cambiamento all'Engine o allo scaffold.
### Pubblicazione artifact-based: release su GHCR (+ immagini allegate), niente `git pull` in produzione

Finora la pubblicazione era source-based: sulla VPS serviva tutto il sorgente (`git pull`) e `scripts/deploy.sh` compilava le immagini sulla macchina di produzione a ogni deploy. Ora c'è un secondo modello, consigliato per la produzione, in cui la VPS riceve un artefatto già costruito invece del codice.

- Nuovo workflow `.github/workflows/Release di Produzione.yml`: su tag `vX.Y.Z` builda le immagini `frontend`/`backend`, le pubblica su **GHCR** (`ghcr.io/<owner>/<repo>-frontend|-backend`) e crea una **GitHub Release** con allegati un *deploy bundle* (i soli file di orchestrazione) e i `.tar.gz` delle immagini. L'identità/SEO del frontend è congelata come in locale: `BR1_PROJECT_JSON` dal `global-settings.json` committato, `FRONTEND_BASE_URL` dalla repository variable omonima (il dominio, non un segreto).
- Nuovo `scripts/deploy-release.sh` + override `docker-compose.release.yml`: in produzione fa lo swap **senza compilare**. Prende le immagini in **due modi** (sceglie da solo, forzabile con `--from-ghcr`/`--from-files`): **A)** `docker compose pull` da GHCR (deploy incrementali; `docker login ghcr.io` se privato); **B)** `docker load` dei `.tar.gz` scaricati/`scp` accanto allo script (nessun registry né login — comodo per repo/registry privati). Poi lo stesso preflight isolato con healthcheck + swap di `deploy.sh`.
- Guida operativa completa in **`RELEASE.md`** (inclusi repo/registry privati, PAT, fork). `scripts/deploy.sh` (source-based) resta valido e comodo per **test e sviluppo locale**, ma è sconsigliato in produzione.
- Nessuna azione per i figli che non pubblicano via CI: continuano con `scripts/deploy.sh`. Per attivare le release: impostare la repository variable `FRONTEND_BASE_URL` e taggare.

### Script di deploy spostati in `scripts/` e `.local` creato in automatico

Per snellire la root, `deploy.sh`, `deploy-release.sh` e `backup.sh` vivono ora sotto `scripts/` (accanto a `lib/` e `test/`). Gli script risalgono da soli alla root del progetto (cercano `docker-compose.yml`), quindi funzionano sia da `scripts/` nel repo sia dal deploy bundle dove stanno accanto al compose.

- **Breaking per i figli** che invocano gli script per path: `./deploy.sh` → **`./scripts/deploy.sh`**, `./backup.sh` → **`./scripts/backup.sh`** (cron di backup compreso). La UX sulla VPS del modello release è invariata: nel bundle lo script sta alla radice, si lancia `./deploy-release.sh`.
- **Comodità:** se manca `global-settings.local.json`, `scripts/deploy.sh` e `scripts/deploy-release.sh` lo **creano generando i segreti** (`SecretKey`/`ApiKeys`/`CryptoSecret`, come `setup.mjs`) ma con **`frontend.hostname` vuoto di proposito**: le chiavi sono boilerplate, il dominio è una scelta d'ambiente. Il deploy quindi **si ferma sul guard del dominio** finché non lo imposti — così il fail-closed sui valori vuoti (niente hostname ⇒ niente 421 al dominio reale) resta valido. Nessun valore finto dell'example (che aggirerebbe i controlli); niente sezione `Mail` (mailer spento finché non la aggiungi); porta con default `3000` (cambiala per il secondo progetto sulla stessa VPS). I **test**/CI restano invariati: senza `.local`, `scripts/lib/br1-config.sh` usa una API key effimera in memoria, senza scrivere file.

### La pagina di login è `noindex` per default (l'Engine sa qual è)

La pagina puntata dallo slot `loginPage` in `site.ts` non ha motivo di finire nell'indice dei motori né nel `sitemap.xml`: su un sito a pochi account (o a singolo amministratore, il caso d'uso nativo del template) è una porta di servizio, non contenuto da promuovere. Finora però il builder la trattava come una pagina pubblica qualunque e la includeva nel sitemap: il figlio avrebbe dovuto ricordarsi di marcarla `noindex` a mano.

- Il builder ora applica `noindex` **di default** alla pagina che è target dello slot `loginPage`: fuori dal `sitemap.xml` e con `X-Robots-Tag: noindex, nofollow` a runtime (stesso meccanismo delle pagine `requiresAuth`, senza però elencare il path in `robots.txt` — che lo rivelerebbe). Resta pubblica e SSR: il login funziona come prima. Il figlio non implementa nulla.
- È un **default, non un vincolo** (tri-stato): `otherSEO.noindex` non dichiarato ⇒ decide l'Engine in base al ruolo della pagina; dichiarato ⇒ comanda il figlio. Un sito con registrazione aperta che *vuole* il login indicizzabile mette `otherSEO: { noindex: false }` sulla pagina e torna nel sitemap — come per qualunque altra pagina.
- Nessuna azione per i figli: la pagina di login demo (`app.pages.ts`) non è stata toccata — eredita il default dall'Engine perché `loginPage` la referenzia già. Chi avesse già un `noindex` esplicito sul login mantiene la propria scelta.

### Fail-fast: uno slot che punta a una pagina inesistente ora è un errore, non un warning silenzioso

Uno slot di ruolo pagina (`loginPage`, `homePage`, `legalPages.*`) valorizzato ma che punta a un `PageType` non dichiarato in `pages` (o dichiarato ma `enabled: false`) veniva prima azzerato con un `console.warn` emesso solo in dev. In produzione era completamente muto. Per `loginPage` in particolare significava che ogni pagina `requiresAuth` finiva a `/error/401` col login irraggiungibile, senza un rumore. Incoerente col resto del builder, dove `PageType`/path duplicati e cookie policy mancante già lanciano.

- `sanitizePageRefs` → `validatePageRefs`: uno slot valorizzato ma irrisolto ora **lancia** a build/avvio (`assertSlotResolved`), con un messaggio che dice quale slot, quale `PageType` e come rimediare (dichiarare la pagina o rimuovere lo slot). Vale per tutti e tre gli slot, per coerenza.
- Copre anche il caso "pagina dichiarata ma `enabled: false`": un riferimento a una pagina spenta è comunque una configurazione rotta e va segnalata, non degradata.
- Nessun impatto su demo/eject: tutti gli slot risolvono già (le pagine legali sono auto-create dalla sezione policy, quindi registrate). Un figlio che si accorge dell'errore lo risolve una volta sola, a build, invece di scoprire in produzione che il login non redirige.

### DSL: `loginPage` unifica pagina e visibilità in navbar (`showLoginInHeader` esce dallo `shell`)

`showLoginInHeader` viveva nello `shell` insieme ai flag di presentazione (`showNav`, `showBrandIconInHeader`, `showNotifications`), ma non è la stessa cosa: quelli sono grafica pura (accenderli/spegnerli non cambia cosa è la voce), mentre esporre o no il login ne cambia la natura (nascosto è login per addetti che conoscono l'URL, esposto è login per tutti) ed è privo di senso senza una `loginPage`. Raggruppato per scopo invece che per area grafica, sta con la pagina di login, non con la navbar. È l'unico slot dove flag e pagina sono davvero accoppiati (a differenza di `homePage`/`showBrandIconInHeader`, indipendenti), quindi resta l'eccezione, non un pattern da propagare.

- `loginPage` accetta ora due forme: un `PageType` nudo, oppure `{ page: PageType; showInHeader?: boolean }` (vedi `LoginPageConfig`). Il caso semplice resta una riga; chi vuole il link in navbar usa la forma estesa. Il config risolto è invariato (`loginPage: PageType` + `showLoginInHeader: boolean`): navbar e user-nav non cambiano.
- **Default di `showInHeader`: `false`** (prima `showLoginInHeader` era `true`). Configurare `loginPage` serve prima di tutto al redirect delle pagine `requiresAuth` — è routing di autenticazione, non grafica; mostrare il login in navbar è una scelta in più, opt-in. Combinato col `noindex` di default, a zero-config il login è una porta di servizio (fuori dai crawler e fuori dall'header), coerente col caso d'uso primario del template.
- Demo (`site.ts`): `loginPage: { page: PageType.Login, showInHeader: true }` — espone il login per auto-documentarsi. `setup.mjs` (eject) aggiornato di conseguenza.

Per i figli esistenti (`site.ts` è Dominio): `shell.showLoginInHeader` non esiste più (errore di compilazione al merge, voluto). Migrazione: toglilo dallo `shell` e, solo se lo volevi a `true`, passa a `loginPage: { page: PageType.X, showInHeader: true }`; se era `false` (o assente e ti andava bene) basta `loginPage: PageType.X`. Nota: il default è passato da `true` a `false`, quindi un login prima visibile per sola omissione va ora reso esplicito.

### Fix: nascondere il login dalla navbar non nasconde più anche il logout

`showLoginInHeader: false` serve a togliere il link di login dalla navbar (caso tipico: la vetrina di un professionista, dove il login è una porta di servizio per l'admin, non una voce per i visitatori). Ma login e logout erano cablati nello stesso blocco di `user-nav.component`: appena si nascondeva il login spariva anche il logout, e siccome quello è l'unico punto di logout del template (la pagina `Impostazioni` demo è un placeholder), l'admin che si loggava per aggiornare i contenuti restava senza modo di uscire dall'header.

- Login e logout sono ora su assi indipendenti in `user-nav.component`: il **link di login** (stato sloggato) obbedisce a `showLoginInHeader`; il **logout** (stato loggato) compare sempre se esiste una `loginPage`, a prescindere dal flag — chi entra deve poter uscire, e quel bottone lo vede solo l'utente loggato, mai i visitatori.
- `navbar.component.hasAuthPage` ora è `loginPage != null` (non più `&& showLoginInHeader`): il toggler mobile compare anche quando l'unica voce dell'area auth è il logout, così su mobile resta raggiungibile.
- Default demo invariato (`showLoginInHeader: true`): la demo auto-documentante continua a mostrare il link di login. Una vetrina mette `false` e ora ottiene il comportamento coerente (login nascosto ai visitatori, logout disponibile all'admin).

### Nuovo: dati personali (export + diritto all'oblio) e servizio di cifratura generico

L'export e la cancellazione dei dati personali (GDPR artt. 15/17) sono un obbligo trasversale a qualunque progetto figlio raccolga dati personali, indipendente dal dominio: stessa categoria di "sicurezza per costituzione" del cookie consent o degli header di sicurezza, non una feature che ha senso lasciare interamente al figlio come un catalogo o un carrello. Il rischio da evitare era il pattern opposto: un metodo da ripetere in ogni controller di dominio (profilo, acquisti, ...) invece di un unico punto aggregato, come già avviene per l'identità del sito.

- **`IPersonalDataStore`** (`Engine/Privacy/`): contratto con due metodi, `ExportAsync`/`EraseAsync`, entrambi su `ClaimsPrincipal` — non su un subjectId già estratto, perché l'Engine non conosce (e non deve conoscere) la forma di `SessionInfo`, che è Dominio. Default `NullPersonalDataStore` (nessun dato), sostituibile in DI con lo stesso meccanismo di `IIdentityStore` (`TryAddSingleton`, vince l'ultima registrazione).
- **`EngineDataPrivacyController`** (`Engine/Controllers/`): un solo endpoint per l'intero sito, `GET`/`DELETE /me/data`. Eredita `EngineProtectedController`: richiede login e viene escluso dalla discovery quando il login è spento, senza flag dedicato (stesso meccanismo già in campo per `AuthController`/`ProtectedController`).
- **`IEngineCrypto`/`EngineCrypto`** (`Engine/Security/`): servizio "cappello" AES-256-GCM, non specifico dell'export — esposto come property ambient `Crypto` su `EngineApiController` (stesso pattern di `Notifications`/`BackgroundQueue`/`Delivery`), non iniettato nel costruttore: `EngineCrypto` lancia se `Security.CryptoSecret` è vuota, e un'iniezione nel costruttore la costruirebbe — quindi fallirebbe — a ogni richiesta del controller, anche in un'azione che non ha nulla da cifrare. Nonce casuale a ogni chiamata (mai deterministico, a differenza del gemello frontend `PreviewCrypto`, che lo deriva apposta dal payload per URL cacheable — qui il payload è spesso sensibile). Chiave derivata da `Security.CryptoSecret` con etichetta di domain-separation fissa.
- **`Security.CryptoSecret`**: nuovo campo, volutamente separato da `Security.Token.SecretKey` — riusare la stessa chiave per firmare JWT e per cifrare dati sarebbe riuso di materiale crittografico su due scopi diversi. `setup.mjs` lo genera già alla nascita del progetto (`randomBytes(32)`, come `Security.ApiKeys`), indipendentemente dal login; `deploy.sh` lo verifica come le altre chiavi prima di pubblicare.
- **`EngineProtectedController.CurrentSession<T>()`**: comodità per rileggere il payload di sessione senza ricordare la fonte (`User.GetSession<T>()`), stesso spirito di `CurrentLanguage` per la lingua. Resta generico: l'Engine non fissa la forma di `SessionInfo`. `ProtectedController.Ping()` (demo) aggiornato a titolo di esempio.
- **Semantica di `EraseAsync` fissata (solo doc, nessun cambio di codice)**: l'oblio include l'account stesso — credenziali e identificativi sono dati personali, un account superstite identificherebbe ancora la persona — salvo i dati con obbligo legale di conservazione, da scollegare/anonimizzare; il bottone "cancella il mio account" di una pagina profilo è `DELETE /me/data`, non un endpoint a parte, e non esiste (volutamente) un `IAccountService` dell'Engine: l'Engine non conosce la forma degli account, l'aggregazione sta nell'unica `IPersonalDataStore` del figlio. Documentato anche il caveat post-cancellazione: il JWT è stateless e resta valido fino a scadenza dopo il `204` → il frontend scarta il token (logout locale) e gli store trattano un `UserId` orfano come "nessun dato", non come errore; un'eventuale revoca server-side è un futuro seam dell'Engine.
- **`AccountService` + `AppPersonalDataStore` (Dominio, non Engine)**: la ricetta "implementa la tua `IPersonalDataStore`" diventa codice vivo del template. `Services/AccountService.cs` è l'unico posto del progetto che conosce gli account degli utenti: la verifica credenziali demo (hardcoded, fail-closed in Production) si trasferisce lì da `AuthController` — che ora delega e resta il punto HTTP — e la cancellazione account per l'oblio vive nello stesso file. `Store/AppPersonalDataStore.cs` (gemello di `AppIdentityStore`: vince sul default vuoto via DI) risponde dietro `GET`/`DELETE /me/data` e delega la parte account ad `AccountService`; oggi non ha dati propri (export `null`, comportamento invariato), ma il cablaggio privacy→account è già nella direzione giusta. Niente contratto engine-side di proposito: le firme parlano `SessionInfo` (Dominio), i confini contrattuali restano `EngineAuthController` e `IPersonalDataStore`. Entrambi registrati solo con `LoginEnabled`. Per i figli esistenti: `AuthController` e `Program.cs` sono Dominio (vince il figlio al merge) — un login già sostituito non viene toccato; il pattern si adotta per scelta.

Per i figli esistenti: `Security.CryptoSecret` va aggiunta a mano in `global-settings.local.json` (`openssl rand -base64 32`) solo se/quando si implementa davvero `IPersonalDataStore`. Con lo store di default (`NullPersonalDataStore`, nessun dato) `GET /me/data` risponde `{}` (`data` a `null`, omesso dalle opzioni JSON globali) senza mai risolvere `IEngineCrypto`: un figlio con login già attivo che fa il merge di questa versione non vede l'endpoint fallire per una chiave che, finché non implementa l'export, non gli serve.

### `PageType`: da enum unico a oggetto assemblato per aree (scala oltre le poche pagine della demo)

Un enum piatto in `site.ts` regge bene le poche pagine della demo, ma un progetto figlio che arriva a decine o centinaia di pagine si ritrova a scorrere e mantenere in ordine un unico blocco sempre più lungo, segnalato da un caso reale (100+ pagine su domini diversi). Valutate le alternative (namespace/sotto-enum annidati, enum multipli fusi in unione): entrambe rompono il tipo piatto unico che `getPath`/`addPage`/`[appPage]` si aspettano, e i secondi collidono anche silenziosamente, perché gli enum numerici ripartono tutti da 0 e finiscono per condividere la stessa chiave nella `Map` interna del builder.

- `PageType` è ora un oggetto `as const` di ID stringa (es. `'app.home'`), assemblato in `site.ts` per spread da più file — uno per area tematica sotto `pages/*.pages.ts` (la demo: `app.pages.ts`, `legal.pages.ts`). A poche pagine il pattern costa un file in più e nient'altro; a molte, ogni area si apre e si mantiene per conto suo. Stesse garanzie dell'enum (refactor-safe, TypeScript segnala ogni uso di un ID rimosso) — cambia solo il costrutto.
- Contratto fisso invariato: l'Engine importa `PageType` da `site.ts` per path e nome (vedi README § «Dominio a contratto fisso»), non per come è dichiarato — un enum, un oggetto o un re-export sono equivalenti dal suo punto di vista. Nessuna modifica alle firme dell'Engine.
- Il legale (`pages/legal.pages.ts`) ora porta anche `legalUpdated` (le date di "ultimo aggiornamento", prima hardcoded in `policy.component.ts`): tutto ciò che un figlio compila per il legale — ID, slot, date — vive in un solo file.
- `siteBuilder.ts` e la direttiva `[appPage]` avvisano ora in dev-mode quando uno slot (`loginPage`/`homePage`/`legalPages.*`), una voce di navigazione (`addPage`) o un link (`[appPage]`) puntano a un `PageType` non registrato — prima l'esito era silenzioso (slot azzerato, voce di menu scomparsa, link a `/`) e con un ID numerico il messaggio non sarebbe stato comunque leggibile.
- `setup.mjs` (eject) genera lo stesso pattern nel `site.ts` minimale, restando coerente con la demo.

Per i figli esistenti: `site.ts` è Dominio (vince il figlio al merge), quindi un enum numerico già in uso continua a funzionare invariato: la migrazione è per scelta, non forzata dal merge.

### Doc: tre snippet duplicati fra README e AGENTS.md, disallineati per drift

Controllati tutti i punti dove AGENTS.md e i README (frontend/backend) trattano lo stesso argomento, non per titolo di sezione ma per contenuto reale, per capire dove la separazione "README = cosa offre / AGENTS.md = ricetta pronta" (già dichiarata in apertura di AGENTS.md) fosse rispettata e dove no. La maggioranza dei casi era già corretta (es. "Aggiungere una pagina" e "JSON-LD" nel README frontend rimandano già ad AGENTS.md senza ripetere codice) o legittimamente complementare (tutorial esteso in un file, ricetta compatta nell'altro, non lo stesso testo due volte). Tre punti erano invece codice pressoché identico ripetuto in entrambi i file, senza alcun rimando fra loro, a rischio di andare fuori sincrono al primo refactor toccato da un lato solo:

- **`frontend/README.md` §"Aggiungere un Endpoint"** (ApiService): duplicava l'esempio `getArticolo`/`api_get` già in AGENTS.md. Ora rimanda lì, mantenendo i tre passi concettuali e la nota su `FormData` (uniche a questo file).
- **`AGENTS.md` §"Persistere dati lato client"**: la mappa `COOKIE_MAP` completa (con la variante `match: 'prefix'`) è coperta in modo più esteso nel README frontend — condensato a match del pattern già usato dalla ricetta gemella "Google Consent Mode v2" (solo la forma di chiamata `consent.set/get`, rimando al README per la struttura della voce).
- **`backend/README.md` §"Leggere la Sessione"**: aveva lo stesso codice di AGENTS.md ma, a differenza delle sezioni vicine ("Notifiche Realtime", "Task in Background"), mancava il rimando "Ricetta rapida" che quelle già usano — aggiunto per coerenza interna al file.

### `a11y-test.sh`: pagine auditate in parallelo (con un limite), Lighthouse resta seriale apposta

Valutato se applicare la parallelizzazione anche dentro i singoli script, non solo fra loro a livello di job CI. Risposta diversa per i due strumenti, verificata separatamente:

- **pa11y (`a11y-test.sh`): sì.** Misura struttura/DOM (axe-core/HTML_CodeSniffer), non tempi — la contesa di risorse fra pagine concorrenti rallenta ma non falsa l'esito. È anche il pattern che pa11y stesso documenta per il proprio tooling CI. Il browser persistente introdotto in precedenza ora audita le pagine con un **pool a concorrenza limitata** (nuovo `A11Y_CONCURRENCY`, default 3): abbastanza per un guadagno reale senza esaurire la memoria del runner aprendo troppe tab Puppeteer insieme. Ogni pagina bufferizza il proprio output e lo stampa tutto insieme, in ordine originale, a fine corsa — leggibile anche se le pagine finiscono in un ordine diverso da quello di partenza. Verificato in locale (8 pagine, backend/SSR reali): ~17.6s seriale → ~11.7s con concorrenza 3, stesso esito; verificato anche che i conteggi di fallimento restano esatti sotto concorrenza (3 pagine irraggiungibili in parallelo → 3 fallimenti contati, non un numero sballato da una race condition).
- **Lighthouse (`lighthouse-test.sh`): no.** È la guidance ufficiale del team Lighthouse: gli audit di performance misurano condizioni reali (`--throttling-method=provided`, già in uso qui), quindi Chrome in concorrenza sulla stessa macchina si contende CPU/rete e si falsano a vicenda i punteggi — non un rischio teorico, sconsigliato esplicitamente da Google. Parallelizzare lì reintrodurrebbe silenziosamente la flakiness appena eliminata (punteggi sbagliati anziché errori). Resta seriale.

### CI: accessibilità e Lighthouse non si bloccano più a vicenda nel job "Test live"

I due audit erano step sequenziali senza `continue-on-error`: se l'audit di accessibilità falliva, quello Lighthouse non partiva nemmeno: un push con un problema di accessibilità E uno di performance li segnalava uno alla volta, a colpi di push-e-riattendi (~7 minuti a giro) invece che in un solo run.

- Entrambi gli step ora hanno `continue-on-error: true` (girano sempre fino in fondo, indipendenti l'uno dall'altro) e un `id`. Un nuovo step finale "Esito test live" (`if: always()`) rilegge esplicitamente `steps.a11y.outcome` / `steps.lighthouse.outcome` e fa fallire il job se anche uno solo dei due non è `success` — `continue-on-error` a livello di step farebbe risultare lo step (e di riflesso il job, se non controllato) sempre verde anche a script fallito, quindi va riletto a mano, non lasciato al default.
- Notare per il futuro: GitHub ha introdotto step realmente paralleli in-job (`background`/`wait`/`parallel`, changelog 25 giugno 2026) che risparmierebbero anche il tempo — ma a due settimane dal rilascio la semantica di propagazione del fallimento non è ancora documentata nell'annuncio stesso: prematuro adottarla su una CI di template ereditata da ogni progetto figlio. Il pattern `continue-on-error` + `outcome` resta quello stabile, verificato.

### `backup.sh`: immagine Alpine pinnata (non più `:latest` implicito)

Il container effimero usato per comprimere i volumi (`docker run --rm ... alpine tar czf ...`) usava `alpine` senza tag, che Docker risolve in `:latest`. `backup.sh` è pensato per girare da cron ogni notte, senza controllo umano: una breaking change silenziosa nell'immagine `latest` romperebbe i backup senza che nessuno se ne accorga fino al giorno del ripristino, il momento peggiore possibile per scoprirlo. Pinnato a `alpine:3.22` (major.minor, non una patch esatta: riceve comunque gli aggiornamenti di sicurezza sullo stesso tag, verificato attivo su Docker Hub). Allineato anche l'esempio di ripristino nell'header dello script.

### CI: Lighthouse riusa un solo Chrome per tutte le pagine, invece di un avvio a testa

`lighthouse-test.sh` lanciava un Chrome a freddo per ogni pagina scoperta da `/health` (uno per URL, avviato e distrutto ogni volta). Con poche pagine costava solo tempo; ma la pressione su CPU/memoria del runner CI, già condiviso coi container backend/frontend sotto test, sale a ogni riavvio, terreno tipico per `NO_NAVSTART`/`NO_FCP` (la trace di performance viene registrata prima che Chrome sia davvero pronto a navigare): il rischio di flake cresce con ogni pagina aggiunta al sito, non solo con l'ultima.

- **Chrome persistente:** un solo processo headless avviato all'inizio dello script (porta di debug remota su una porta libera, verificata pronta via polling su `/json/version`), riusato per tutte le pagine passando `--port` a Lighthouse invece di `--chrome-flags` — il pattern che Lighthouse stesso raccomanda per audit multi-URL. Se `CHROME_PATH` non è risolto (bundled/npx) si ricade sul comportamento precedente, un avvio per pagina.
- **Retry mirato sui soli errori transitori:** `NO_NAVSTART`, `NO_FCP`, `NO_LCP`, `PAGE_HUNG`, `TARGET_CRASHED`, `PROTOCOL_TIMEOUT` e simili (sintomi di timing/risorse, non di una pagina rotta) vengono ritentati una volta prima di dichiarare fallimento. Errori deterministici (`DNS_FAILURE`, `INVALID_URL`, `ERRORED_DOCUMENT_REQUEST` — una 404 vera) restano fail-fast, senza retry sprecato: verificato che una pagina inesistente fallisce ancora al primo tentativo.
- **Verificato in locale** (server SSR reale + backend .NET reale, tutte le 8 pagine demo): stesso esito del comportamento precedente ma con un solo avvio Chrome invece di 8.

### CI: stesso trattamento per `a11y-test.sh` (pa11y) — un solo browser, non uno a pagina

Stesso pattern del punto sopra, stessa causa: la CLI pa11y invocata una volta a pagina apriva e chiudeva un intero Chromium ad ogni URL. L'API JS di pa11y espone per questo un'opzione `browser`: passandole un'istanza Puppeteer già avviata, pa11y apre solo una nuova tab per pagina invece di un intero processo, il pattern che pa11y stesso documenta per testare più URL in sequenza.

- Lo script ora genera un piccolo runner Node temporaneo (`frontend/.a11y-run-*.cjs`, autopulito a fine corsa) che lancia Puppeteer una volta sola e vi passa ogni pagina; l'output resta identico (stesso reporter `cli` di pa11y, stesso formato "OK/ERR" del resto della suite).
- **Fallback invariato:** se `pa11y` non è un pacchetto locale (npm ci non eseguito, si scarica al volo via `npx`) resta il vecchio comportamento CLI-per-pagina — percorso già degradato, non quello raccomandato.
- **Verificato in locale**, stessi 8 path: nessuna violazione, un solo avvio Chromium invece di 8; verificato anche il percorso di errore (pagina irraggiungibile → fallimento corretto, conteggio esatto) e quello di successo.

### Pulizia `.gitignore`: due pattern morti, mai stati corretti

Trovati controllando dove i due script sopra scrivono davvero i loro file temporanei: `frontend/lh-report.json` non ha mai corrisposto a nulla (il report è sempre stato nominato con PID, `lh-report-$$.json`, e scritto dalla working directory dello script, root del repo in CI, non `frontend/`) e `frontend/ssr-server*.log` non ha zero riferimenti in tutto il repo, nessuno script lo produce. Corretti in `lh-report-*.json` (radice, glob sul PID) e rimossa la voce morta.

### Navigazione SPA: focus e annuncio agli screen reader ad ogni cambio pagina

Un cambio pagina in una SPA non ricarica il documento: il browser non sposta da solo il focus né annuncia nulla, come farebbe con un normale link multi-pagina. Chi naviga da tastiera o screen reader restava "fermo" sul link appena attivato, dentro un contenuto ormai sostituito. Nessuna configurazione: vale su ogni pagina, presente e futura.

- **Approccio duale (best practice 2025/2026):** `AppComponent` ascolta `Router.events` (`NavigationEnd`, saltando il **primo** — il caricamento iniziale, dove il focus va lasciato dov'è il browser lo mette di default) e sposta il focus su `#main-content` (nuovo `tabindex="-1"`, programmaticamente focalizzabile senza entrare nell'ordine di tabulazione a schermo). In parallelo, una regione `role="status" aria-live="polite"` annuncia il nuovo titolo.
- **`PageMetaService.announcedTitle`:** nuovo signal, valorizzato dentro `setPageMeta()` con lo stesso testo già scritto nel `<title>` del browser — nessuna logica duplicata, un solo punto di verità per il titolo di pagina.
- **Perché entrambi:** il solo focus non basta — alcune combinazioni screen reader/browser (NVDA+Firefox, VoiceOver+Safari) non annunciano sempre in modo affidabile l'elemento appena focalizzato; la regione live è il backup.
- **Cambio lingua non innesca il focus:** `setLanguage()` non naviga (nessun `NavigationEnd`), quindi non sposta mai il focus — solo `announcedTitle` si aggiorna (il titolo tradotto viene comunque annunciato, utile di per sé).
- Verificato con Playwright (server SSR reale + backend .NET reale): caricamento iniziale non ruba il focus, navigazioni SPA successive (via `routerLink`, non full-reload) spostano correttamente il focus su `#main-content` e la regione live rispecchia il nuovo `document.title`.

### Quinta pagina legale: Dichiarazione di Accessibilità

`legalPages` supporta ora uno slot `accessibility`, sullo stesso identico meccanismo di `privacy`/`cookie`/`tos`/`legal`: nessuna pagina nuova da costruire a mano, stesso `PolicyComponent`, stessa interpolazione identità.

- **Rilevanza normativa:** dal 28 giugno 2025 l'European Accessibility Act (Direttiva UE 2019/882) riguarda anche i siti privati nello scope (e-commerce, fatturato >2M€ o ≥10 dipendenti; microimprese escluse) — ma con un adempimento diverso da quello della Pubblica Amministrazione. La PA resta sulla Legge 4/2004 (dichiarazione + obiettivi annuali via piattaforma AGID entro il 31 marzo); i privati seguono invece il D.Lgs. 82/2022 ("informazioni sull'accessibilità" ex Allegato IV, senza obiettivi annuali). Il Markdown demo copre il primo modello (più adatto a una pagina pubblica di trasparenza); quale regime si applica esattamente va verificato con un consulente legale.
- **`LegalPagesConfig`/`ResolvedLegalPages`:** nuovo campo opzionale `accessibility?: PageType | null` — slot facoltativo come `privacy`/`tos`/`legal` (nessun errore di build se omesso, a differenza di `cookie`).
- **`legal-pages.ts`:** nuova voce nel registry (`path: 'accessibilita'`, `markdownSlug: 'accessibility'`) — routing, sitemap, SEO e menu si cablano da soli, stesso meccanismo generico delle altre quattro.
- **Markdown demo generico** (`assets/legal/accessibility.{it,en}.md`): stato di conformità (WCAG 2.1 AA, lo standard già verificato in CI da `pa11y`), contenuti non accessibili, come è stata redatta, segnalazioni/procedura di attuazione — un template da compilare, non un modulo ufficiale né un testo legale pronto all'uso.
- **Demo e skeleton "eject" aggiornati in coppia** (`site.ts` e `MINIMAL_SITE_TS` in `setup.mjs`): stesso `PageType.AccessibilityStatement`, stesso posizionamento nel menu (`menuPolicy`, accanto a Privacy/Cookie).

### Ogni pagina sempre stampabile — resa pulita, niente bottone

Ogni pagina, presente e futura (anche una che il progetto figlio scrive da sé domani, es. un articolo, se il figlio è una testata giornalistica), stampa bene senza che nessuno debba configurarlo, e senza un bottone di stampa nel template: i browser espongono già la stampa in modo prominente (Ctrl+P, menu, condivisione), un bottone dedicato la replicherebbe soltanto: pratica ormai considerata superata (i redesign recenti tendono a toglierlo, tenendo solo il CSS di stampa). Un `@media print` condiviso e globale (`styles/engine/base/_print.scss`, non per-pagina, non un flag DSL, nessuna configurazione possibile, quindi nessuna svista possibile) ripulisce automaticamente qualunque pagina:

- **Via del tutto:** navbar, i FAB fissi (`app-back-to-top`, `app-cookie-banner` — pura UI, mai contenuto), lo sfondo smoke.
- **Forzato tema chiaro su `html`/`body`** (nero su bianco, `color-scheme: light`) a prescindere dal tema attivo — non solo su `.content-panel`, così copre anche le pagine senza pannello o full-bleed.
- **Pannello contenuti** spogliato dell'identità "da card" (sfondo/bordo/ombra/raggio/griglia): resta solo il contenuto.
- **Footer semplificato, non nascosto:** la riga di copyright/ragione sociale è informazione legittima su un documento stampato, quindi resta — via solo l'identità estesa (indirizzo/social/orari con l'eventuale accordion) e il menu di navigazione (link non cliccabili su carta).
- **`<details>` chiusi si aprono per la stampa** (i gruppi cookie della Cookie Policy, o qualunque `<details>` in un Markdown di progetto): un `<details>` chiuso non stampa il suo contenuto per comportamento nativo, corretto a schermo ma sbagliato sul "formato alternativo" — chi lo stampa deve vedere l'elenco completo, non intestazioni collassate senza modo di espanderle su carta. `AppComponent` ascolta `matchMedia('print')` (non `beforeprint`/`afterprint`: più affidabile in Safari) e riapre solo i `<details>` che erano chiusi, richiudendo solo quelli appena finita la stampa — uno che l'utente aveva già aperto a mano resta aperto anche dopo.

È anche il "formato alternativo" richiesto dalla Dichiarazione di Accessibilità. `app-print-action` (il componente azione, non montato di default da nessuna parte) resta disponibile per un'affordance di stampa puntuale su una pagina specifica, se un progetto la vuole: si auto-esclude sempre dalla propria stampa (`d-print-none` intrinseco).

- **Specificità CSS, non ovvio:** `app-navbar` applica `d-block` come host class; l'utility Bootstrap `.d-block{display:block!important}` ha specificità di classe (0,1,0), più alta del solo selettore di tag (0,0,1) — a parità di `!important` un semplice `app-navbar{display:none!important}` **perde**. Selettore composito `app-navbar.d-block` per pareggiare e vincere. Verificato con screenshot/PDF Playwright in `media: 'print'`, anche partendo da tema scuro (bug silenzioso: nessun errore, navbar/sfondo scuro restavano visibili in stampa finché non trovato così).
- **Verificato oltre la Cookie Policy** (pagine temporanee di stress-test, non committate): tutte e 5 le pagine legali in tema chiaro/scuro; `fitViewport:true` (niente `.content-panel`, navbar comunque nascosta in stampa); `showPanel:false`; 3 categorie cookie simultanee (tutte si aprono/richiudono correttamente); banner cookie non ancora risposto (resta escluso dalla stampa a prescindere dallo stato del consenso). Nessun bug emerso.

### Validazione: un unico modulo condiviso, e valuta/orari/telefono in fail-fast

- **Modulo `Validation` condiviso (frontend):** le regole prima sparse (validatori inline di `QrCodeService`, strip del telefono in `ContactUrl`) vivono ora in `core/engine/services/validation.ts` — un solo posto per `phone` (charset + numero singolo + forma dialabile `toDial` + `isE164` stretto), `email`, `url`, `iban`. Lo usano i builder di link (`ContactUrl`) e il generatore QR (`QrCodeService`); nessuna regex duplicata resta nel frontend. **Telefono, Opzione A:** la regola base accetta anche i nazionali (`06/1234567`); l'E.164 stretto (`isE164`) è un controllo *in più* solo dove serve un numero internazionale (WhatsApp/`wa.me`).
- **Contratto mirror-ato col backend:** `Validation.phone` rispecchia `ValidPhone`, `email`/`url` rispecchiano `MailAddress`/`Uri` dell'identità. Il backend valida alla fonte (fail-fast), il frontend riusa la stessa forma — due implementazioni di un'unica regola, una per tier (C# non condivide codice con TS).
- **Valuta validata ISO 4217:** `currency` era il gemello non validato di `nazione` — un codice sbagliato (`"Euro"`) veniva reso in EUR **in silenzio** (fallback nel `try/catch` di `formatCurrency`). Ora validata allo store con `RegionInfo.ISOCurrencySymbol` (insieme ISO 4217 dal framework, nessuna lista a mano): assente → EUR di default, presente ma invalida → errore. Il frontend formatta fidandosi (catch solo difensivo).
- **Orari, giorno fuori range:** il `JsonStringEnumConverter` accettava le stringhe numeriche (`"8"`) senza validare il range → `Enum.IsDefined` ora coglie un giorno inesistente.
- **`Intl.DateTimeFormat` dei nomi giorno:** aggiunta la guardia mancante (try/catch con fallback al locale di default) — era l'unica chiamata `Intl` su locale-da-config senza difesa.

### Cookie Policy: elenco a livelli, dichiarazione standard, gestione in-pagina

La pagina Cookie Policy passa da un elenco piatto (una card per voce, ingestibile oltre le ~200 voci) a un riepilogo a livelli allineato agli standard di settore (Cookiebot/OneTrust/CookieYes).

- **Elenco riepilogo-first:** le voci sono raggruppate per categoria in pannelli collassabili (`<details>` nativo, niente JS: come il banner), chiusi di default. L'header del gruppo fonde nome, conteggio e descrizione della categoria — spariscono i "quadrati" `{{cookieCategories}}` dal markdown demo (il token resta supportato). I nomi lunghi vanno a capo (`word-break`); l'elenco regge da 320px in su (stress-test su viewport/zoom/lingua).
- **Dichiarazione standard per voce:** oltre a nome/categoria/mezzo/descrizione, ora **Provider** (omesso = prima parte; valorizzato = terzo, con `providerUrl` opzionale → nome cliccabile alla sua policy) e **Durata** (dal mezzo, o `durationKey`, o default "1 anno" = Max-Age di `set()`). Nuovi campi opzionali `provider`/`providerUrl`/`durationKey` in `CookieConfig`.
- **Gestione consenso in pagina:** nuovo input `panelMode` sul cookie-banner → rende gli stessi controlli (toggle + accetta/rifiuta/salva) come blocco in-flusso, organico, in fondo alla Cookie Policy — per ri-gestire il consenso senza riaprire il banner. Mostrato **solo dopo** aver risposto (pre-consenso ci pensa il banner: niente due UI insieme).
- **"Come controllare i cookie":** sezione con le guide ufficiali dei browser (Edge/Chrome/Safari/Firefox/Opera), localizzate per lingua (Apple pretende il locale pieno, gli altri no — verificato sul campo).
- **"Ultimo aggiornamento":** data per pagina legale (dizionario per `PageType` nella PolicyComponent, hardcoded a mano), resa con `<time>` semantico e formattata per lingua via `Intl`.
- **A11y:** verificato con pa11y (WCAG 2.1 AA) su cookie/privacy/termini, anche coi gruppi espansi: nessuna violazione.

### Cookie banner: barra fissa full-width, pari peso Accetta/Rifiuta, consenso 180gg

Allineamento allo standard di settore 2026 (bottom-bar non modale, tre azioni a pari peso) e alle Linee guida del Garante Privacy.

- **Layout:** da card fluttuante centrata (max-width 1080px, radius 1.5rem) a barra fissa full-width agganciata ai tre bordi, come la maggior parte dei siti — niente più raggio, ombra verso l'alto per il distacco visivo dal contenuto.
- **Pari peso Accetta/Rifiuta:** i due bottoni condividono ora lo stesso stile `outline-secondary` — un "Accetta" pieno/verde contro un "Rifiuta" in outline è il dark pattern esplicitamente vietato dalla guidance EDPB sui banner cookie (pari prominenza visiva, non solo dimensione). "Salva scelte" resta evidenziato: non è un'alternativa accetta/rifiuta, conferma qualunque combinazione di toggle.
- **Memoria del consenso a 180 giorni** (`CookieConsentService.CONSENT_MAX_AGE_SECONDS`), non più 1 anno: oltre questa soglia il Garante richiede di riproporre il banner. `durationKey` dedicato in `CONSENT_COOKIE_MAP` così la Cookie Policy dichiara "6 mesi" invece di ereditare il default "1 anno".
- **ARIA:** `role="alert"` (implicitamente assertive) sostituito da `role="region"` + `aria-label` sul banner principale — non è un'interruzione urgente ma un landmark non modale, coerente con WCAG 2.2/ARIA per i consent banner.
- **Nuovo in `frontend/README.md`:** ricetta pronta (non attiva di default) per Google Consent Mode v2 — obbligatorio da marzo 2024 per chi usa GA4/Google Ads in UE. Quattro punti nel Dominio (stub di default in `index.html`, whitelisting CSP in `security-headers.json`, censimento in `cookie-registry.ts`, `effect()` di aggiornamento reattivo): l'Engine resta provider-agnostico, la ricetta si applica solo il giorno in cui Google viene davvero attivato.

### Consenso: censire una famiglia di chiavi Web Storage (`match: 'prefix'`)

- **Nuovo campo `match` in `CookieConfig`** (`'exact'` default | `'prefix'`): una **singola** voce del `COOKIE_MAP` può rappresentare un'intera **famiglia di chiavi** che condividono un prefisso. Serve per gli SDK di terza parte che scrivono più chiavi con **suffisso dinamico** (tipicamente derivato dal token/sessione, es. `sdk.telemetria:<hash>`, `sdk.telemetria.uuid:<hash>`) e che non si possono censire una a una.
- **Pulizia per prefisso alla revoca:** con `match: 'prefix'` la voce, quando la sua categoria è rifiutata, rimuove **tutte** le chiavi dello Storage che iniziano per la chiave della voce (prima si poteva togliere solo la chiave esatta, che con suffisso dinamico non matchava mai). Vale solo per il Web Storage (`storage: 'local' | 'session'`). Le **chiavi essenziali del motore** (`consent_log`, `bearerToken`) sono sempre saltate dalla scansione — un prefisso troppo largo non può cancellare la prova del consenso o la sessione.
- **Voce di sola-dichiarazione:** su una voce `prefix`, `set()` è un **no-op** (le chiavi reali le scrive l'SDK, non l'app): esiste per **elencare** la famiglia in policy e **pulirla** alla revoca. Il gating a monte resta a carico del progetto (caricare l'SDK solo dopo il consenso della sua categoria).
- **Generico, non legato a un fornitore:** l'Engine non conosce lo specifico SDK; il prefisso, il provider e la categoria li dichiara il figlio nel proprio `COOKIE_MAP`.

### Identità del sito centralizzata nell'Engine

L'identità del sito, dati legali/anagrafici, profili social del brand, natura dell'entità, è ora un sottosistema dell'Engine, sorgente unica per footer, pagine legali e SEO (JSON-LD).

- **Backend:** nuovo `IIdentityStore` (default `FileIdentityStore`, `AddTemplateIdentity`) + endpoint Engine `GET /identity`, che legge `data/identity.json`. Modello `SiteIdentity` (ex `UniversalLegalModel`), con `Social` (profili brand) e `Personal` (tipo entità). File assente → risposta `null`, niente errore.
- **Dato:** `data/irl.json` → **`data/identity.json`** (validato dallo schema engine `Engine/Models/Identity/identity.schema.json` via `$schema`). I social del brand vivono qui, non più in `global-settings.json`.
- **Frontend:** nuovo `IdentityService` (Engine, risorsa condivisa `identity()`, una fetch per lingua). `page-meta.service` deriva `sameAs`/`@type`/`twitter:site` dall'identità (runtime, risolta in SSR). Rimossi `site.social` e `site.personal` da `global-settings.json` / `SiteConfig` / `environment`.
- **Componente:** `app-profile-render` → **`app-identity-render`**, con input `[identity]` e flag `[showSocial]` (footer sì, pagine legali no).
- **Demo separata:** la galleria social (`GET /social`, `social.json`, pagina Social, `IContentStore`/`SiteService`) resta una demo a sé; il `setup.mjs` (eject) la brucia per intero, mentre l'identità sopravvive (il figlio riempie solo `identity.json`).

### Identità: orari strutturati, social URL-driven, JSON-LD compliant

- **Orari come lista di intervalli tipizzati:** `openingHours` in `SiteIdentity` è `List<OpeningHoursInterval>` — ogni voce `{ Day: DayOfWeek, Opens/Closes: TimeOnly }`. Chi sviluppa dichiara **col framework** (`DayOfWeek.Tuesday`, `TimeOnly`), senza stringhe magiche né conoscere schema.org; i cast li fa l'Engine (converter: sul filo è `{ day:"Tuesday", opens:"09:00", closes:"18:00" }`). Più voci sullo stesso giorno = più fasce (pausa pranzo). Il frontend **deriva** sia la resa leggibile (fonde i giorni con orari identici, "lun–ven 09:00–18:00") sia le `OpeningHoursSpecification` (`ContactPoint.hoursAvailable`) — dove `DayOfWeek` è già il nome `schema.org/Tuesday`, via la mappa scritta a mano. Sostituisce il vecchio testo libero `metadatiAggiuntivi.orariContatto`.
- **Social come lista di URL, con nome opzionale per il footer:** `SiteIdentity.Social` è una lista dove ogni voce è un URL (stringa nuda) **oppure** `{ url, name }`. Il `name` (anche localizzato `{it,en}`) è l'etichetta resa **solo nel footer** accanto all'icona — utile per distinguere più profili dello stesso social (es. "Instagram — sede IT" / "— sede EN"); icona (regex sull'URL) e `sameAs` JSON-LD usano solo l'URL. Il nome auto-dedotto usa il casing ufficiale (LinkedIn/WhatsApp/YouTube). Il `type` del componente resta override opzionale.
- **Entità brand JSON-LD più ricca:** aggiunti `address` (`PostalAddress` dalla sede) e `contactPoint` (`ContactPoint` con telefono/email + `hoursAvailable` + `availableLanguage` dalle lingue del sito) all'`Organization`/`Person`. Per l'`Organization` anche `legalName`/`vatID`/`taxID` da ragione sociale/P.IVA/CF (dati già presenti, ora emessi).
- **Valuta dichiarata, non dedotta:** nuovo `currency` (ISO 4217) in `SiteIdentity`; il capitale sociale si formatta con quella valuta nella lingua corrente (via `Intl`), togliendo l'EUR hardcoded. È il pattern "dichiara il fatto, deriva la forma" — l'identità (paese/valuta) è un fatto, il locale del visitatore decide solo il formato.
- **Composizione da più fonti:** `FileIdentityStore` ora ha l'hook `protected virtual ComposeIdentityAsync` (passthrough), e il template registra `Store/AppIdentityStore.cs` (**di proprietà del progetto**) dove il figlio fonde l'identità da fonti diverse dal file (DB/API) senza riscrivere la lettura.
- **Via di fuga JSON-LD (`extra`):** nuovo `Extra` (`Dictionary<string,object>`) in `SiteIdentity`, fuso nel nodo entità brand del JSON-LD. Permette qualsiasi proprietà schema.org non tipizzata (geo, foundingDate, campi di LocalBusiness…) senza toccare modello né adapter. È fuso **per ultimo**, quindi sovrascrive i default dell'Engine — incluso il `@type` (es. → `LocalBusiness`); restano riservati all'Engine solo `@context` e `@id` (perni del grafo). La validità schema.org è a carico del progetto.
- **Attività locale (`businessType` + `sedeOperativa`):** dichiarando `businessType` (sottotipo schema.org, es. `Restaurant`/`Store`/`LocalBusiness`) l'entità brand del JSON-LD diventa quel tipo invece di `Organization`, con `address` (dalla `sedeOperativa`, fallback `sedeLegale`) e `openingHoursSpecification` portati **sul nodo** — i segnali per le attività locali di Google. Gli orari, già tipizzati, restano invariati: per un'attività vanno sul nodo, altrove restano in `contactPoint.hoursAvailable`. La geo (lat/long) è opzionale per Google e si aggiunge via `extra`.
- **Rappresentante legale tipizzato:** `rappresentanteLegale` è un campo noto di `SiteIdentity` (anche localizzato), non più pescato da `metadatiAggiuntivi` per chiave magica (un typo lo faceva sparire). `metadatiAggiuntivi` resta sul modello ma **non è più reso** dall'identità: il render mostra solo dati noti/tipizzati.
- **Fix:** i badge booleani passano a `bg-*-subtle`/`text-*-emphasis` (WCAG-safe sul tema, risolve un contrasto 2.89:1).

### Localizzazione: codici dichiarati, cultura derivata via Intl (tutto front-end)

I codici lingua sono una dichiarazione semplice (2 lettere) in `global-settings.json` → `Localization`: sorgente unica, consumata in modo indipendente dalle due parti. Il backend li arricchisce nelle culture .NET tipizzate per i suoi usi (`UseRequestLocalization`, messaggi d'errore localizzati); il frontend deriva cultura e formattazione via `Intl` (ECMA-402/CLDR), senza chiamare il backend.

- **`LocalizationService` (frontend) è interamente client, via `Intl`.** Dai codici in config (`availableLangs`) deriva: locale corrente, formattazione (`formatter`: date, numeri, valuta, `regionName`), nomi giorno abbreviati (`Intl.DateTimeFormat`) e nomi nativi delle lingue (`Intl.DisplayNames`). Niente round-trip, sempre corretto (offline incluso), disaccoppiato da come il backend gestisce la propria cultura. `EngineCultures` (backend) resta per `UseRequestLocalization`.
- **`formatter` come facciata unica.** La formattazione culture-aware passa da `localization.formatter.*` (date/valuta/numeri/regioni): `Intl` è nascosto dietro, cambiare motore non tocca i chiamanti. `app-identity-render` non duplica più `Intl.NumberFormat`/`DisplayNames` né mappa `it→it-IT` a mano.
- **Selettore lingua:** mostra i **nomi nativi** ("Italiano"/"English") derivati via `Intl.DisplayNames`, non il codice in maiuscolo.
- **`Localization` in `global-settings.json` resta** la sorgente dei codici (letta anche dai consumatori sincroni a module-load: pagina cookie multilingua, fallback `pickLocaleText`, `RequestLocalization` backend).
- **Paese come codice ISO, nome dal framework:** `sedeLegale.nazione` passa da testo libero a **codice ISO 3166-1 alpha-2** (`"IT"`). Il footer ne deriva il nome localizzato con `Intl.DisplayNames` (il gemello JS di `RegionInfo`, come `Intl.NumberFormat` per la valuta); il JSON-LD `addressCountry` usa il codice (forma preferita da schema.org/Google). Il codice è **validato allo store con `RegionInfo`**: assente ⇒ omesso, presente ma non un codice ISO valido ⇒ **errore** (niente più tolleranza sul testo libero: `"Italia"` non è un codice). *Migrazione figlio: `"nazione": "Italia"` → `"nazione": "IT"`.*

### Lettura di global-settings.json tipizzata

- **Tipo `GlobalSettings` generato dallo schema:** la lettura del config nel frontend (`generate-statics`, `server-env`) passa da accesso a chiavi-stringa (`s['Localization']`) al tipo `GlobalSettings` **generato da `global-settings.schema.json`** (`json-schema-to-typescript`, `npm run generate:types`). Lo schema resta la **sorgente unica** (niente interfaccia scritta a mano: via il `Br1Json` partial); un typo di chiave è errore a `tsc`. Il tipo è un seed committato (lo schema non è nel build context Docker del frontend), rigenerato a mano quando cambia lo schema.

### Sicurezza: JSON-LD a prova di breakout, identità tollerante

- **JSON-LD XSS-safe:** gli script `application/ld+json` escapano `<`/`>`/`&` in `\uXXXX`, così nessun valore (identità, structured data di pagina, `extra`, dati da CMS/DB) può chiudere il `<script>` e iniettare markup. Vale per tutti i nodi del grafo; i parser decodificano gli escape, il dato resta valido.
- **Identità validata con le primitive del framework, non con regex a mano — e in fail-fast:** gli URL social via `Uri.TryCreate` (assoluto http/https; fuori `javascript:`/relativi/garbage), le **email/PEC** via `System.Net.Mail.MailAddress`, la **nazione** via `RegionInfo` (ISO 3166-1 alpha-2), gli **orari** tipizzati `TimeOnly` **+ giorno controllato in range** (`Enum.IsDefined`: un `"day":"8"` numerico fuori range, che il `JsonStringEnumConverter` accetterebbe senza validare, ora è errore). Il **telefono** è validato come **numero singolo**, sanificato alla fonte: nel footer diventa un link `tel:` cliccabile (non può puntare a due numeri) **e** un testo visibile. Due controlli: (1) l'intera stringa ammette **solo** cifre e separatori visivi (`^[+\d\s/().-]+$`) — niente lettere/testo/markup, che verrebbero conservati e resi; (2) ridotta a cifre + `+` (la forma con cui `ContactUrl.phone` costruisce l'href) dev'essere un unico numero E.164-plausibile (un solo `+` iniziale, 6–15 cifre). Così **spazi, `/`, trattini e parentesi in un numero solo restano validi** (`06/1234567`, `+39 06 1234 567` — che il vecchio `PhoneAttribute` rifiutava a torto), mentre **due numeri** (`06 111 / 06 222 333`), un secondo `+` o **caratteri estranei** vengono colti. Difesa a più strati: anche il footer sanifica (href ridotto alle sole cifre + sanitizer Angular sul `[href]`, testo escapato in interpolazione — nessun sink `innerHTML`), ma il dato entra già pulito. Principio: **l'identità è tutta opzionale, ma un dato *presente* deve essere valido.** Un campo assente resta assente (footer/JSON-LD omettono quel pezzo); un campo **presente ma malformato non viene più scartato in silenzio: lancia** — `identity.json` è config committata, un valore sbagliato è un errore da correggere, non da inghiottire. L'eccezione risale a `GET /identity` (500 loggato) e il **sito resta su**: il frontend legge l'identità come assente e footer/JSON-LD si nascondono da sé (stesso esito del file mancante, ma l'errore è rumoroso invece che invisibile). File `identity.json` **assente** ⇒ `null`, nessun errore (un sito senza identità è legittimo). Il frontend tiene comunque le sue guardie (`isHm` sugli orari) per il caso degradato. `extra` resta l'unico canale per dati off-schema.
- **`twitter:site` da parsing `URL`, non regex:** l'handle Twitter/X per `twitter:site` si estrae con la primitiva `URL` (host esatto + handle dal path), più robusta della vecchia regex sul testo dell'URL.

Migrazione per un figlio: rinomina `backend/data/irl.json` in `identity.json`, sposta dentro i profili social del brand (`"social": [ … ]`, lista di URL) e l'eventuale `"personal": true`; rimuovi `site.social`/`site.personal` da `global-settings.json`. La sezione `Localization` di `global-settings.json` resta (codici a 2 lettere): il backend la arricchisce nelle culture tipizzate per i suoi usi, il frontend deriva la cultura via `Intl`, niente da migrare lì.
