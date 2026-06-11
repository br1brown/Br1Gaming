# Br1WebEngine - Frontend (Angular 21)

> 📚 Parte della documentazione di Br1WebEngine — indice e tabella *"dove metto le mani"* nel [README principale](../README.md). Le sezioni **"Developer Journey"** qui sotto sono il *come* passo-passo del frontend.

Benvenuto nel frontend di Br1WebEngine. Questo non è un semplice progetto Angular, è un ecosistema dichiarativo ottimizzato per Server-Side Rendering (SSR) e Developer Experience (DX).

La complessità tipica (routing frammentato, meta tag SEO sparsi, lazy loading) è stata centralizzata in un singolo **Domain Specific Language (DSL)**.

---

## 🚀 Le "Killer Feature" (cosa fornisce l'Engine)

### 1. `site.ts`: Il Cuore Pulsante (DSL)
**Perché è così?** In Angular "Vanilla" aggiungere una pagina richiede di toccare il file di routing, i componenti menu per i link e logiche SEO ripetitive.
**Cosa fa l'Engine:** In `src/app/site.ts` dichiari un oggetto JSON. L'Engine crea a runtime le rotte, nasconde/mostra la navbar in base a `layout.showNav`, e se la pagina ha `requiresAuth: true`, l'SSR viene spento forzando il client-side rendering.

### 2. Auto-SEO Dinamica
Basta aggiungere `description` o `ogImage` nell'oggetto pagina dentro `site.ts`. Un Resolver intercetta la navigazione e inietta prima del rendering i corretti tag Head, OpenGraph e i dati strutturati.

### 3. Signals Nativo (zoneless)
Gestione stato locale e globale tramite l'API nativa `Signals` di Angular 21. Niente NgRx, niente boilerplate eccessivo.

L'app è **zoneless**: non c'è `zone.js`, la change detection è guidata dai signal e dagli eventi gestiti da Angular (binding di template e `host`). Conseguenze pratiche:
- Aggiorna lo stato con i signal (`signal()`, `computed()`, `set/update`): la UI si rinfresca da sola.
- Non serve `NgZone` (`NgZone.runOutsideAngular` / `ngZone.run`): `setInterval`/`requestAnimationFrame` non innescano cicli di change detection.
- Se integri una callback di una libreria esterna che muta un campo **non**-signal, convertila in signal (o usa un signal di appoggio) affinché la UI reagisca.

### 4. Gestione Trasparente Privacy e Accessibilità
L'Engine si occupa di iniettare meccanismi standard di base per l'Accessibilità (WCAG) e alcuni helper della shell già pronti e auto-iniettati — un banner cookie integrato che si allinea alla navigazione e un pulsante "torna su" (back-to-top) che compare dopo lo scroll. Non vanno istanziati né configurati: ci sono e basta. Meno codice, più compliance.

### 5. Policy Pages Integrate
Le pagine legali (Privacy, Cookie, Termini, Note Legali) le costruisce l'**Engine**: in `site.ts` valorizzi gli slot `legalPages` (`privacy`/`cookie`/`tos`/`legal`) coi tuoi `PageType` e il builder inietta da solo il nodo `/policy/*`. Uno slot omesso = quella pagina non esiste (es. una vetrina con solo i cookie). Se il sito usa cookie, lo slot `cookie` è **obbligatorio**: ometterlo è un errore al build. I testi vivono in `src/assets/legal/` come Markdown localizzati (es. `privacy.it.md`, `TOS.it.md`); il `ContentResolver` li carica da filesystem in SSR e via fetch nel browser, e il `PolicyComponent` interpola i placeholder come `{{ragioneSociale}}` / `{{partitaIva}}` dal profilo aziendale del backend.

---

## 📜 Le Regole del Gioco (cosa impone l'Engine)

### 1. Identità Incorruttibile: L'Enum `PageType`
Non navigherai **mai** usando stringhe dirette (`router.navigate(['/home'])`). Aggiungi un identificatore all'enum `PageType` in `site.ts`. Tutte le voci di menu e i pulsanti punteranno a quell'ID. Se domani rinomini l'URL, nessun link si romperà.
```typescript
export enum PageType { Home, AboutUs }
```

### 2. Componenti Pagina vs Componenti UI
- **`pages/`**: Sono le schermate. Ereditano da `PageBaseComponent` per ottenere l'accesso rapido ad API, logger e traduttore senza iniezioni ridondanti.
- **`components/`**: Pezzetti di UI isolati. Ricevono dati tramite `@Input()`.

### 3. Niente Manipolazioni dirette del DOM (Salva l'Idratazione)
Usa esclusivamente binding dichiarativi (`[class.hidden]="!isVisible()"`) e Template Refs. Usare `document.getElementById` romperà l'SSR lato server.

**Idratazione incrementale per le pagine lunghe.** L'Engine registra già `withIncrementalHydration()` (`app.config.ts`): nelle pagine lunghe basta avvolgere le sezioni sotto la piega in un blocco `@defer (hydrate on viewport)`:

```html
@defer (hydrate on viewport) {
    <section><!-- sezione pesante sotto la piega --></section>
} @placeholder {
    <!-- scheletro Bootstrap: appare solo in navigazione client, mai in SSR -->
    <section class="card placeholder-glow" aria-hidden="true" style="min-height: 320px">
        <div class="card-body"><span class="placeholder col-6"></span></div>
    </section>
}
```

Comportamento:
- **Primo caricamento (SSR):** la sezione è renderizzata normalmente nell'HTML — contenuto e SEO invariati — ma il browser la idrata solo quando entra nel viewport: meno JavaScript eseguito all'avvio.
- **Navigazione client (cambio pagina nella SPA):** il blocco carica `on idle`, mostrando per un attimo il `@placeholder`.
- I click su una sezione non ancora idratata non vanno persi: `withEventReplay()` li riconsegna a idratazione avvenuta.

La home demo lo applica alle sezioni QR, Notifiche e Sistema — esempio vivo, finché un progetto figlio non la riscrive.

### 4. CSS: Bootstrap First, Custom Solo Se Necessario
Il progetto usa **Bootstrap 5** come sistema di design principale. Non scrivere CSS custom per cose che Bootstrap già copre.

**Cosa va nel template HTML (classi Bootstrap):**
- Layout e spacing (`d-flex`, `align-items-center`, `mb-3`, `gap-2`, `p-4`)
- Tipografia (`fw-bold`, `text-muted`, `small`, `h4`, `lead`)
- Form (`form-control`, `form-label`, `is-invalid`, `invalid-feedback`)
- Componenti (`card`, `alert`, `btn`, `spinner-border`, `badge`, `list-group`)
- Responsive (`col-md-6`, `d-none d-lg-block`)

**Cosa va nel file `styles.css` globale:**
- Stili specifici del progetto finale che sovrascrivono il tema o Bootstrap.
- Import di CSS di terze parti non gestiti dal framework.
- Classi di utilità globali non previste da Bootstrap.
*Nota bene: `base.css` è riservato all'engine e alla gestione avanzata del tema OKLCH, non va modificato con stili di progetto.*

**Cosa va nel file `.css` del componente (solo ciò che Bootstrap non può esprimere):**
- Posizionamento fisso con `safe-area-inset` (cookie banner, back-to-top)
- Animazioni CSS (`@keyframes`, transizioni custom)
- Effetti visivi avanzati (glassmorphism con `backdrop-filter`, gradienti complessi)
- Override di tema via `color-mix()` e custom properties (`--color*`)
- Layout a griglia complesso (`grid-template-rows: 0fr → 1fr` per accordion)

**z-index e ombre: solo variabili, mai letterali.** `base.css` definisce la scala z-index del template (`--z-cookie-banner`, `--z-fab`, `--z-skip-link`, `--z-cdk-overlay`), incastrata nei vuoti della scala Bootstrap così i widget persistenti restano **sotto** offcanvas e modali (che devono coprirli). Un nuovo elemento fisso usa una di queste variabili o ne aggiunge una alla scala — mai un numero scritto a mano. Stesso principio per le ombre di elevazione: `--shadowElevated` / `--shadowElevatedHover`.

**Componenti senza CSS:** Se un componente non ha bisogno di nulla di quanto sopra, *non creare il file `.css`*. Il footer, ad esempio, non ne ha uno — è 100% classi Bootstrap nel template.

---

## 🛠️ Developer Journey: Aggiungere una Pagina

Per creare una nuova schermata, segui esattamente questo workflow per non rompere l'integrità del routing.

### Passo 1: Registrare l'identità (PageType)
Apri `src/app/site.ts` e aggiungi il nuovo tipo all'enum centrale. Questo garantisce che la pagina sia referenziabile globalmente.
```typescript
export enum PageType {
    Home = 0,
    Contatti = 1,
    MioNuovoComponente = 2 // <-- Aggiunto
}
```

### Passo 2: Dichiarare la Rotta (`pages`)
Sempre in `site.ts`, aggiungi la pagina nell'array restituito da `pages`. Specifica il path, eventuali guardie di sicurezza e l'Auto-SEO.
```typescript
pages: (ctx) => [
    // ... pagine esistenti ...
    {
        path: 'nuova-pagina',
        pageType: PageType.MioNuovoComponente,
        title: 'Nuova Pagina', // Verrà localizzato automaticamente
        description: 'La mia descrizione SEO',
        requiresAuth: false,
        component: () => import('./pages/nuova-pagina/nuova-pagina.component')
    }
],
```

### Passo 3: Creare il Componente
Nella cartella `pages/nuova-pagina/` crea il componente. Assicurati che estenda `PageBaseComponent<T>` (dove `T` è il tipo del contenuto della pagina) per ereditare i superpoteri dell'Engine.
```typescript
@Component({
  standalone: true,
  templateUrl: './nuova-pagina.component.html'
})
export default class NuovaPaginaComponent extends PageBaseComponent<MioContenuto> {
    // Proprietà ereditate da PageBaseComponent:
    // this.api        → ApiService (chiamate al backend)
    // this.translate  → TranslateService (i18n)
    // this.asset      → AssetService (URL immagini CDN)
    // this.notify     → NotificationService (toast/alert)
    // this.pageContent → Signal<MioContenuto | null> (dati dalla pagina)
    // this.pageType   → input<PageType> (tipo corrente della pagina)
}
```

### (Opzionale) Passo 3b: Pagina Protetta da Login

Se il componente deve essere accessibile solo agli utenti autenticati, aggiungi `requiresAuth: true` nella dichiarazione in `site.ts`. L'Engine fa tutto il resto: disattiva SSR per quella pagina, aggiunge l'auth guard e reindirizza gli utenti non loggati alla `loginPage`.

```typescript
pages: (ctx) => [
    {
        path: 'area-riservata',
        pageType: PageType.AreaRiservata,
        title: 'Area Riservata',
        requiresAuth: true, // <-- sufficiente per proteggere la pagina
        component: () => import('./pages/area-riservata/area-riservata.component')
    }
],
```

Nel componente i dati di sessione si leggono tramite `AuthService`:
```typescript
export default class AreaRiservataComponent extends PageBaseComponent {
    private readonly auth = inject(AuthService);

    readonly nomeUtente = computed(() => this.auth.session()?.displayName ?? '');
}
```

### Passo 4: Navigare in Sicurezza
Per navigare verso la pagina non si usa mai `href="/nuova-pagina"` hardcoded: si lascia che il framework calcoli la rotta esatta (così il link resta valido anche cambiando l'URL in `site.ts`).

**Per link `<a>` (preferito — SPA navigation, SEO, keyboard, right-click):**
```html
<!-- [appPage] traduce il PageType in href e attiva RouterLink -->
<a [appPage]="PageType.MioNuovoComponente" class="btn btn-primary">Vai!</a>
<a [appPage]="PageType.PrivacyPolicy" class="footer-link">Privacy</a>
```

**Per navigazione programmatica (es. redirect dopo submit form):**
```typescript
// Inietta il Router nel componente
private readonly router = inject(Router);

// Nel metodo (es. onFormSubmit)
this.router.navigate([ContestoSito.getPath(PageType.MioNuovoComponente) ?? '/']);
```

### (Opzionale) Passo 5: Caricare dati prima del render (`ContentResolver`)

Se la pagina deve avere già i suoi dati al primo render (utile per SSR e SEO: i crawler vedono il contenuto, non uno scheletro vuoto), il caricamento passa dal `ContentResolver`. È un resolver centralizzato che, in base al `PageType`, recupera il contenuto **prima** che il componente venga mostrato e lo consegna al `PageBaseComponent`, che lo espone tipizzato via `pageContent()`.

Per dare un contenuto a una nuova pagina bastano due passi (`src/app/pages/content.resolver.ts`):

```typescript
// 1. Esponi il dato in ApiService (o usa un caricamento di file statico)
// 2. Aggiungi un case nello switch di loadResolved()
switch (pageType) {
    case PageType.MioNuovoComponente:
        content = await this.apiService.getMioDato();
        break;
    // ... altri case ...
}
```

Nel componente il dato arriva già pronto, senza fetch manuale in `ngOnInit`:
```typescript
export default class NuovaPaginaComponent extends PageBaseComponent<MioContenuto> {
    // this.pageContent() → Signal<MioContenuto | null>, valorizzato dal resolver
}
```

Caratteristiche dell'Engine:
- **Router protetto:** se il caricamento fallisce, `BaseApiService` ha già notificato l'utente e il resolver restituisce `content = null` invece di rigettare — la navigazione si completa sempre, non resta bloccata.
- **SSR senza loopback:** per i contenuti da file (es. pagine legali) in SSR la lettura avviene da disco tramite `LEGAL_FILE_READER`, evitando una chiamata HTTP del server verso se stesso; nel browser è una normale fetch relativa.

Se invece la pagina carica i dati a navigazione avvenuta (contenuto non SEO-critico), si può saltare il resolver e usare i pattern one-shot / reattivo di `ApiService` direttamente nel componente.

---

## 🔐 Sistema di Autenticazione (JWT)

Il sistema di login è **opzionale** e si attiva configurando `Security.Token.SecretKey` (in `global-settings.local.json`). Sul frontend serve:

```typescript
// site.ts → tutto strutturale, sta insieme
shell: { showLoginInHeader: true },     // mostra il link Login/pulsante Logout nella navbar
loginPage: PageType.Login,       // pagina dove redirigere gli utenti non autenticati
```

### Proteggere una Pagina

In `pages`, imposta `requiresAuth: true` sulla pagina da proteggere. L'Engine aggiunge automaticamente `renderMode: 'client'` (disabilita SSR per quella pagina) e attiva l'auth guard.

**Cosa fa il guard quando l'utente non è loggato** (`authGuard` in `app.routes.ts`): se in `site.ts` è dichiarata una `loginPage`, redirige lì con i query param `returnPageType` (la pagina di partenza, per tornarci dopo il login) e `reason=auth` (la pagina di login mostra un avviso inline invece di una modale). Senza `loginPage`, resta sulla pagina corrente e mostra la modale di errore 401.

```typescript
pages: (ctx) => [
    {
        path: 'area-riservata',
        pageType: PageType.AreaRiservata,
        requiresAuth: true,
        component: () => import('./pages/area-riservata/area-riservata.component')
    }
],
```

### Leggere la Sessione in una Pagina

`AuthService` (iniettabile ovunque) espone segnali reattivi:

```typescript
readonly auth = inject(AuthService);

// Reattivo: true/false a login/logout
this.auth.isLoggedIn

// Payload di sessione tipizzato (null se non loggati)
this.auth.session() // → SessionInfo | null
this.auth.session()?.displayName
this.auth.session()?.roles
```

### Componenti Pronti all'Uso

| Componente | Selector | Ruolo |
| :--- | :--- | :--- |
| `LoginFormComponent` | `app-login-form` | Form username/password riusabile; emette `(loggedIn)` al successo. Non naviga da solo. |
| `UserNavComponent` | `user-nav` | Area Login/Logout nella navbar. Appare solo se `showLoginInHeader: true`. Gestisce il logout con modale di conferma. |
| `UploadFormComponent` | `app-upload-form` | Componente "dumb" per drag-and-drop e selezione file. Emette il `File` nativo delegando la chiamata API al componente genitore. |

### Ciclo di Vita del Token

Il token è persistito in `sessionStorage` (sopravvive all'F5, si azzera alla chiusura della scheda). `TokenService` (engine, intoccabile) avvia un timer automatico che esegue il logout allo scadere dell'`exp` del JWT. Il timer gestisce il limite JavaScript di 24 giorni tramite rescheduling ricorsivo.

### Gestione Errori di Login

`AuthService.login()` traduce i codici HTTP in messaggi i18n tramite `mapLoginError()` (in `auth.service.ts`):

| Codice | Chiave i18n usata | Quando accade |
| :--- | :--- | :--- |
| `401` | `loginErroreGenerico` | Credenziali errate |
| `429` | `errore429Descrizione` | Troppi tentativi — il backend limita l'endpoint di autenticazione a 5 req/min |
| `503` / `404` / `0` | `loginServizioNonDisponibile` | Servizio non raggiungibile |
| qualsiasi altro | `erroreImprevisto` | Errore non classificabile |

Il 429 è importante: senza questa mappatura esplicita, un rate-limit sul login mostrerebbe "errore imprevisto" invece di un messaggio informativo per l'utente.

---

## 🚧 Pagine di Errore

Il template include una pagina d'errore generica (`ErrorComponent`) che copre qualsiasi codice HTTP: 404, 403, 500, ecc. Non serve crearne una per ogni codice — il codice viene letto dalla rotta e i testi sono risolti via i18n.

### Come ci si arriva

Le rotte d'errore sono generate automaticamente (`app.routes.ts`):

| Rotta | Comportamento |
| :--- | :--- |
| `**` (qualsiasi URL non riconosciuto) | redirect a `error/404` |
| `error/:errorCode` | mostra `ErrorComponent` con quel codice |
| `error` | redirect a `error/500` |
| `error/401` | redirect alla pagina di login (`loginPage`), se configurata |

Il caso `401` è speciale: un utente non autenticato non finisce su una pagina d'errore cieca ma viene mandato al login. Se nessuna pagina di login è configurata, l'`authGuard` resta sulla pagina corrente e mostra una modale di accesso negato (vedi *Sistema di Autenticazione*).

Per mostrare un errore programmaticamente, naviga verso la rotta:
```typescript
this.router.navigate(['/error/403']);
```

### Personalizzare i messaggi

I testi seguono il pattern di chiavi i18n in `basic.{lang}.json`:
```
errore{codice}Titolo        // es. errore404Titolo → "Pagina non trovata"
errore{codice}Descrizione   // es. errore404Descrizione → testo esteso
```
Per gestire un nuovo codice basta aggiungere le due chiavi (es. `errore402Titolo` / `errore402Descrizione`). Se mancano, la pagina ricade su messaggi generici (`erroreGenerico` + codice, `erroreImprevisto`), quindi non resta mai vuota.

### Errore di pagina vs errore di risorsa

L'Engine tiene separati due tipi di errore, con messaggi diversi di proposito:

| | Errore di **pagina** (routing) | Errore di **risorsa** (API) |
| :--- | :--- | :--- |
| Quando | L'utente naviga verso una rotta inesistente o protetta | Una chiamata API fallisce |
| Chi lo gestisce | `ErrorComponent` | `apiErrorInterceptor` → `NotificationService.handleApiError()` |
| Esempio 404 | "Pagina non trovata" | "Risorsa non trovata" |
| Esempio 403 | "Accesso vietato alla pagina" | "Non hai privilegi su questo elemento" |

Così un 404 di navigazione e un 404 di una `GET` falliscono con parole appropriate al contesto, non con lo stesso testo generico.

> **Lato server:** per le rotte `error/{code}` l'SSR restituisce anche lo status HTTP reale (es. `error/404` → `404`), non un `200`. Vedi *Server SSR → Status Code SEO-Aware*.

---

## 🔒 Consenso Cookie e Privacy (GDPR/ePrivacy)

`CookieConsentService` implementa una strategia "Privacy by Default": nessun cookie viene scritto finché l'utente non esprime consenso esplicito per quella categoria.

### Tre Categorie di Consenso

| Categoria | Cosa include |
| :--- | :--- |
| **Technical** | Preferenza lingua, Service Worker, cookie essenziali di funzionamento |
| **Analytics** | Tracciamento e analytics (Google Analytics, ecc.) |
| **Profiling** | Pubblicità comportamentale e profilazione |

### Aggiungere un Nuovo Cookie

Registra il cookie nel `COOKIE_MAP` (in `src/app/core/services/cookie-registry.ts`), specifica la categoria e il banner mostrerà automaticamente il toggle corrispondente. I tipi (`CookieCategory`, `CookieConfig`) vivono in `src/app/core/engine/services/cookie/cookie-type.ts`:

```typescript
import { CookieCategory, type CookieConfig } from '../engine/services/cookie/cookie-type';

export const COOKIE_MAP = {
    'mioTracker': {
        category: CookieCategory.Analytics,        // categoria di consenso
        descriptionKey: 'mioTrackerDescrizioneListaCookie', // chiave i18n per la Cookie Policy
        valueType: 'boolean',                       // opzionale: 'string' (default) | 'number' | 'boolean' | 'json'
    }
} as const satisfies Readonly<Record<string, CookieConfig>>;
```

`CookieConfig` accetta tre campi: `category`, `descriptionKey?` (chiave i18n per la descrizione mostrata nella Cookie Policy) e `valueType?` (usato per il cast automatico di `getCookie`/`setCookie`). La descrizione è risolta da `descriptionKey` tramite i18n, così resta localizzata in tutte le lingue.

Nel componente:
```typescript
this.consent.setCookie('mioTracker', true, 60 * 60 * 24); // 1 giorno — tipo inferito da valueType
```

Il cookie viene scritto solo se la categoria corrispondente è stata accettata. Il nome fisico del cookie nel browser è prefissato con la categoria (`{category}.{rawKey}`, es. `analytics.mioTracker`); `buildPhysicalCookieKey()` calcola questo nome a partire dalla chiave raw.

### Service Worker e Consenso Tecnico

Il Service Worker è registrato **solo dopo che l'utente accetta il consenso tecnico**. Questo include:
- Registrazione `provideServiceWorker()` all'avvio
- `VersionCheckService` inizia il polling degli aggiornamenti
- La preferenza lingua viene salvata su `localStorage`

### Persistenza Lingua e Consenso

La preferenza lingua è salvata solo con consenso tecnico accettato:
1. Utente rifiuta consenso → cambia lingua a "en" → al reload torna al default
2. Utente accetta consenso tecnico → cambia lingua a "en" → persiste tra i reload

La lettura della preferenza salvata non richiede consenso (operazione di sola lettura, privacy-safe).
**Nota SSR:** In ambiente Server-Side Rendering (SSR), la lettura dei cookie avviene tramite l'header `Cookie` della richiesta HTTP in ingresso (`REQUEST` token in Angular). Questo garantisce che il server sia allineato con le preferenze del client, evitando idratazioni errate o flash di contenuto con lingua sbagliata al primo caricamento. Se il cookie non è presente, l'SSR usa l'header `Accept-Language` del client per dedurre la preferenza.

### Dichiarazione Cookie GDPR nella Cookie Policy

La pagina Cookie Policy deve elencare categorie e cookie usati dal sito (richiesto dal GDPR per ogni cookie non tecnico). L'elenco si inserisce nel Markdown della policy tramite due placeholder, espansi automaticamente dal `PolicyComponent`:

| Placeholder | Cosa rende |
| :--- | :--- |
| `{{cookieCategories}}` | Card delle categorie effettivamente presenti nel sito (Technical / Analytics / Profiling) |
| `{{cookieList}}` | Tabella dei singoli cookie con nome fisico, categoria e descrizione |

I dati provengono direttamente da `CookieConsentService`: il `PolicyComponent` legge i signal reattivi e costruisce le liste localizzate.

```typescript
private readonly cookieConsent = inject(CookieConsentService);

// Categorie attive — solo quelle realmente richieste dal sito
this.cookieConsent.isTechnicalNeeded();  // include lingua (multilingua) e SW (isWebApp)
this.cookieConsent.isAnalyticsNeeded();
this.cookieConsent.isProfilingNeeded();

// Cookie "engine" attivi (lang, ngsw-worker.js, consenso) — già filtrati per configurazione
this.cookieConsent.activeEngineCookies(); // → Record<string, CookieConfig>

// Nome fisico del cookie nel browser (es. 'technical.lang')
buildPhysicalCookieKey(rawKey, config);
```

La lista finale è l'unione di `activeEngineCookies()` (cookie built-in: lingua se multilingua, Service Worker se `isWebApp`, cookie di consenso) e `COOKIE_MAP` (cookie del progetto). Le descrizioni usano le `descriptionKey` di ogni `CookieConfig`; le etichette di categoria usano le chiavi `*CategoriaCookie` / `*DescrizioneCategoriaCookie` in `basic.{lang}.json`.

---

## 🎨 Tema e Sistema di Colori (OKLCH + WCAG)

Il sito ha un sistema di tema che genera 75+ variabili CSS partendo da un **solo colore brand** dichiarato in `site.ts`.

### Un Colore, Palette Completa

```typescript
// site.ts
buildSite({
    config: {
        colorTema: '#1f40ff',  // Un solo colore — l'engine genera tutto il resto
        // ...
    },
    // ...
});
```

Da questo colore vengono generati automaticamente:
- Varianti brand: primario, secondario (muted), testo leggibile
- Surface colors: sfondo pagina, card, hover states (light e dark)
- Semantic brand (primary/secondary): link, borders, emphasis text, subtle backgrounds per `.alert-*` e `.text-*-emphasis`
- Navbar colors: adattiva al brand (full immersive se scuro, pastello se chiaro)

I colori semantici fissi (warning, info, success, danger) non sono derivati dal brand: Bootstrap 5.3 fornisce già varianti WCAG-safe tone-adaptive nei suoi blocchi `[data-bs-theme]`. ThemeService imposta `data-bs-theme` su `<html>` in base a `prefers-color-scheme`, quindi `--bs-warning-text-emphasis` ecc. si risolvono automaticamente.

### Garanzia WCAG 4.5:1

Tutti i colori di testo su sfondo sono calcolati per garantire contrasto WCAG AA:
- `findCompliantColor()` regola la luminanza L in OKLCH finché non raggiunge 4.5:1
- Funziona sia in light che dark mode per i colori brand-derived
- I colori semantici fissi delegano a Bootstrap che li calibra per entrambi i toni

### Cambio Tema a Runtime

`colorTema` è un `WritableSignal` — cambiarlo aggiorna immediatamente palette, CSS vars e tutti i componenti che leggono i signal del tema.

**Pattern 1 — Colore utente al login**

Il caso più comune: l'utente ha un colore brand nel suo profilo. Impostarlo subito dopo l'autenticazione lo fa persistere su tutte le navigazioni successive.

```typescript
// Nel service/componente che gestisce il login
const theme = inject(ThemeService);

async login(credentials: Credentials) {
    const user = await this.auth.login(credentials);
    if (user.brandColor) {
        theme.setColorTema(user.brandColor);  // persiste per tutta la sessione
    }
}
```

**Pattern 2 — Colore per singola pagina**

Se una pagina ha un colore dedicato, il componente lo imposta e lo ripristina quando viene distrutto tramite `DestroyRef`.

```typescript
// Nel componente di pagina
export class CampagnaComponent {
    constructor() {
        const theme = inject(ThemeService);
        const defaultColor = inject(SITE_CONFIG).colorTema; // token del colore default

        theme.setColorTema('#e63946');

        inject(DestroyRef).onDestroy(() => theme.setColorTema(defaultColor));
    }
}
```

**Precedenza e conflitti**

Non esiste un meccanismo di priorità centralizzato — l'ultimo chiamante vince. La convenzione suggerita:

- Il colore utente va impostato al login e non deve essere sovrascritto da logiche di navigazione
- Il colore di pagina va sempre ripristinato in `onDestroy`
- Se un albero di pagine condivide un colore, impostarlo nel componente radice dell'albero

### Dark Mode Automatico

Reattivo a `prefers-color-scheme`: se l'utente cambia tema OS, il sito si adatta in tempo reale senza reload:
```typescript
readonly themeTone: Signal<'light' | 'dark'>; // Reattivo a prefers-color-scheme
readonly prefersReducedMotion: Signal<boolean>; // Per animazioni accessibili
```

### Metodi Statici (SSR-Safe)

`ThemeService` espone metodi statici puri usabili in Node.js/SSR senza Angular:
```typescript
const [L, C, H] = ThemeService.hexToOklch('#1f40ff');
const textColor = ThemeService.findCompliantColor(C, H, bgHex, 4.5, startL, stepDir);
const hex = ThemeService.oklchToHex(L, C, H);
```

---

## 🔔 NotificationService: Feedback all'Utente

`NotificationService` (iniettato come `this.notify` in ogni `PageBaseComponent`) gestisce tutti i popup e toast via SweetAlert2, già stilato con il tema Bootstrap del template.

| Metodo | Quando usarlo |
| :--- | :--- |
| `toast(msg, icon?)` | Notifica rapida in alto a destra (3 s, non bloccante). `icon`: `'success'` \| `'error'` \| `'info'` \| `'warning'` |
| `success(msg, onClose?)` | Popup di conferma operazione riuscita |
| `error(title, msg)` | Popup di errore con titolo esplicito |
| `confirm(title, text, opts?)` | Modale Sì/No → restituisce `Promise<boolean>` |
| `prompt(title, label, ...)` | Modale con input testuale → restituisce `Promise<string \| null>` |
| `interact<T>(config)` | Modale con HTML custom, validazione e mappatura del risultato |
| `openLoading(msg?)` / `closeLoading()` | Spinner bloccante (es. durante upload) |
| `validationErrors(title, errors)` | Popup con lista di errori di validazione |
| `handleApiError(status, problem, ...)` | Legge il `ProblemDetails` del backend e mostra il messaggio corretto; fallback automatico a i18n per i codici HTTP standard tramite le chiavi `errore{status}Titolo` / `errore{status}Descrizione` da `basic.{lang}.json` — copertura completa per: 400, 401, 403, 404, 405, 406, 408, 409, 410, 422, 429, 500, 501, 502, 503, 504 |

```typescript
// Toast di successo
this.notify.toast('Salvato con successo');

// Conferma prima di un'azione distruttiva
const ok = await this.notify.confirm('Eliminare?', 'L\'operazione è irreversibile', { icon: 'warning' });
if (!ok) return;

// Spinner durante operazione asincrona
this.notify.openLoading('Caricamento...');
await this.api.getProfile();
this.notify.closeLoading();

// Gestione errore API (legge ProblemDetails RFC 9457)
try { ... } catch (err) {
    this.notify.handleApiError(err.status, err.problem);
}
```

---

## 🖼️ AssetService: Immagini e File

`AssetService` (iniettato come `this.asset` in ogni `PageBaseComponent`) genera URL sicuri per le risorse multimediali.

```typescript
// URL di un asset gestito dal server (con resize on-the-fly)
// width è un tipo configurabile in app.config (es. 320 | 640 | 1280)
const url = this.asset.getUrl('id-immagine', 640);
// → /cdn-cgi/asset?id=id-immagine&w=640

// URL temporaneo per un Blob (es. file scaricato via api.getBlob())
const blob = await this.api.getBlob('mio-documento');
const { angularUrl } = this.asset.getUrlFromBlob(blob);
// angularUrl è un SafeUrl già sanitizzato per Angular
```

I Blob URL vengono revocati automaticamente a ogni cambio pagina, quindi non perdono memoria.

### Due pipeline immagini: `asset.getUrl(id)` vs `api.getBlobUrl(slug)`

Esistono **due percorsi distinti** per ottenere l'URL di un'immagine ottimizzata. Hanno comportamento simile (entrambi ridimensionano e cachano lato server) ma sorgenti diverse: usare quello sbagliato porta a un `404` apparentemente inspiegabile.

| | `asset.getUrl(id, width)` | `api.getBlobUrl(slug, webopt)` |
| :--- | :--- | :--- |
| Endpoint | `/cdn-cgi/asset?id=…&w=…` | `/api/blob/{slug}` |
| Identificatore | **id** dell'asset gestito | **slug** assegnato all'upload |
| Sorgente | Asset registrati in `mapping.json` (id → percorso fisico), generato al build | File caricati a runtime nel volume `uploads` via `uploadBlob()` |
| Usa quando | Immagini che fanno parte del progetto: hero, loghi, illustrazioni statiche | Contenuti caricati dagli utenti / dall'app dopo il deploy |

In breve: se l'immagine **esiste già nel repo/build** è un asset → `asset.getUrl('hero', 640)`. Se l'immagine **è stata caricata a runtime** ed è identificata da uno slug → `api.getBlobUrl(slug)`. Non sono intercambiabili: uno slug di blob non è in `mapping.json`, e un id di asset non è un file in `uploads`.

### Ottimizzazione Immagini Server-Side

L'endpoint `/cdn-cgi/asset` effettua il resize lato server e cacha il risultato:

```
GET /cdn-cgi/asset?id=hero&w=640
→ Legge mapping.json (asset ID → percorso fisico)
→ Ridimensiona a 640px (se la larghezza è in whitelist)
→ Caches il risultato
→ Restituisce PNG/JPEG ottimizzato
```

Larghezze supportate (whitelist in `app.config.ts`): `125, 320, 480, 512, 640, 768, 1024, 1080, 1366, 1600, 1920`.
Formati non-raster (video, PDF, SVG) sono serviti senza modifica.

### Directive `appAsset` / `appAssetHref`

Invece di costruire gli URL manualmente, usa le directive dichiarative:

```html
<!-- Immagine ottimizzata (src reattivo alla width) -->
<img appAsset="hero" [appAssetWidth]="640" alt="Hero" class="img-fluid">

<!-- Link/download con href ottimizzato -->
<a [appAssetHref]="'manuale'" [appAssetWidth]="1024" download="manuale.pdf">
    Scarica manuale
</a>
```

Le directive sono type-safe: errori di applicazione su elementi sbagliati vengono rilevati a compile-time.

> **Attenzione:** `appAsset` / `appAssetHref` lavorano **solo** con gli asset gestiti da `AssetService` (id in `mapping.json`), **non** con i file caricati a runtime. Per un blob non passare lo slug alla directive: usa il binding diretto `[src]="api.getBlobUrl(slug)"` / `[href]="api.getBlobUrl(slug)"`.

### Directive `appFitViewport`

Per pagine/viste a tutto schermo (mappe, giochi, dashboard) dove lo scroll spezzerebbe l'esperienza: porta l'altezza dell'elemento a riempire lo spazio che resta fino in fondo al viewport, senza creare scroll verticale di pagina.

```html
<section appFitViewport>...</section>
<section appFitViewport [appFitViewportMin]="400">...</section>
```

Calcolo auto-adattivo senza numeri magici: `altezza = innerHeight − (scrollHeight − altezza attuale dell'elemento)`, cioè "questo elemento + tutto il resto della pagina" = esattamente il viewport. Si riadatta da sé a navbar/footer/banner/orientamento; ricalcola su `resize`/`orientationchange` (listener `host`, no SSR). `appFitViewportMin` (default `320`) è l'altezza minima sotto cui non scende (schermi molto bassi).

---

## 🌍 Internazionalizzazione (i18n)

Le traduzioni vivono in `public/assets/i18n/` in due cataloghi per lingua:

| File | Ruolo |
| :--- | :--- |
| `basic.{lang}.json` | Stringhe dell'Engine: traduzioni per le pagine di errore HTTP (`errore400Titolo`/`Descrizione` … fino al 504), azioni comuni (`clipboardCopied`, `clipboardError`, `shareError`, ecc.) e messaggi di login. **Non aggiungere qui chiavi di dominio** — quelle vanno in `addon.{lang}.json`. Aggiungere invece qui quando si modifica l'Engine stesso o si introduce una nuova notifica/comportamento globale; in quel caso la chiave va aggiunta in *tutti* i file `basic.*.json` — `i18n-check.sh` lo verifica in CI. |
| `addon.{lang}.json` | Stringhe del **progetto** — qui vanno le chiavi personalizzate |

**Aggiungere una lingua:**
1. In `global-settings.json`: `"Localization.SupportedLanguages": ["it", "en", "fr"]`
2. Creare `basic.fr.json` e `addon.fr.json` in `public/assets/i18n/`
3. `i18n-check.sh` in CI verifica che nessuna chiave sia mancante

**Usare le traduzioni nel codice:**
```typescript
// Nel componente (this.translate è già iniettato da PageBaseComponent)
const testo = this.translate.translate('miaChiave');

// Con segnaposto posizionali
const msg = this.translate.translate('benvenuto', 'Mario'); // "Ciao {0}" → "Ciao Mario"
```

```html
<!-- Nel template con la pipe -->
{{ 'miaChiave' | translate }}
{{ 'benvenuto' | translate:'Mario' }}
```

**Aggiungere una chiave** (esempio in `addon.it.json`):
```json
{
    "titoloSezioneNotizie": "Le ultime notizie",
    "benvenuto": "Benvenuto, {0}!"
}
```

### Normalizzazione BCP-47

L'engine normalizza internamente i tag lingua per coerenza:
```typescript
// "it-IT" e "it" sono equivalenti — entrambi caricano basic.it.json
TranslateService.normalizeBcp47('it-IT')  // → 'it'
TranslateService.normalizeBcp47('en-US')  // → 'en'
```

### Pipe `translate` — Impura by Design

La `TranslatePipe` è dichiarata `pure: false` perché le traduzioni cambiano al cambio lingua, e una pipe pura non rileva il cambiamento di stato esterno. Angular la ri-esegue ad ogni ciclo di change detection. Se serve ottimizzare per template ad alta frequenza, usa `computed()`:

```typescript
readonly trad = computed(() => this.translate.translate('chiave'));
```

### Pipe `markdown`

Converte Markdown a HTML nel template, con sanitizzazione XSS rigorosa: l'HTML grezzo viene bloccato e gli URL non sicuri (`javascript:`, `data:`, `vbscript:`, o protocol-relative `//`) in link e immagini vengono neutralizzati automaticamente per prevenire esecuzione di payload malevoli.
```html
<div [innerHTML]="testo | markdown"></div>
```

Usata internamente da `PolicyComponent` per le pagine legali. Disponibile in qualsiasi componente per contenuto rich text.

---

## 🌐 ApiService: Chiamare il Backend

`ApiService` (iniettato come `this.api` in ogni `PageBaseComponent`) espone questi metodi:

| Metodo | Tipo di ritorno | Quando usarlo |
| :--- | :--- | :--- |
| `getProfile()` | `Promise<Profile>` | Caricamento una-tantum del profilo aziendale |
| `getProfileResource()` | `httpResource<Profile>` | Profilo reattivo (si aggiorna col Signal) |
| `getBlobUrl(slug, webopt?)` | `string` | URL relativo del file (`/api/blob/{slug}`) per `<img src>` / `<a href>` — senza download in memoria. Anche in GET passa dal proxy `/api` protetto da API key |
| `getBlob(slug)` | `Promise<Blob>` | File scaricato in memoria (anteprima locale, download forzato) |
| `uploadBlob(file)` | `Promise<{ slug }>` | Carica un file nel volume uploads (richiede JWT) |
| `login(req)` | `Promise<LoginResult>` | Autenticazione utente (solo se JWT abilitato) |

### File Uploads (`/api/blob`)

`getBlobUrl` restituisce sempre un path relativo con prefisso `/api` (es. `/api/blob/{slug}`): il browser raggiunge il file attraverso il proxy SSR del frontend, non tramite l'URL interno del backend. Il prefisso è configurabile via `SSR_API_PREFIX` (default `/api`).

#### Quale metodo usare per mostrare un file

Per **visualizzare o linkare un file che vive sul server** (immagine, PDF, allegato) la risposta è una sola: `getBlobUrl(slug)`. Restituisce una stringa da mettere direttamente in `<img [src]>` / `<a [href]>`, senza scaricare nulla in memoria. È il percorso da preferire: il file viaggia come una normale GET HTTP, quindi sfrutta caching del browser e range requests.

```html
<img [src]="api.getBlobUrl(slug)" alt="...">          <!-- webopt=true di default → immagine ottimizzata -->
<a  [href]="api.getBlobUrl(slug, false)" download>Scarica originale</a>
```

`getBlob()` + `AssetService.getUrlFromBlob()` serve **solo se si ha già un `Blob` in memoria** e occorre un object URL temporaneo, cioè quando:
- scarichi il file per elaborarlo lato client invece di limitarti a mostrarlo;
- mostri l'anteprima locale di un file scelto dall'utente *prima* di caricarlo;
- il `Blob` è stato generato localmente (canvas, QR, immagine da testo…).

```typescript
const blob = await this.api.getBlob(slug);
const { angularUrl } = this.asset.getUrlFromBlob(blob); // SafeUrl; revocato in automatico al cambio pagina
// <img [src]="angularUrl">
```

> **Regola pratica:** un file che sta sul server e va solo mostrato/linkato → `getBlobUrl`. Un `Blob` già disponibile in memoria → `getUrlFromBlob`. Per il semplice "mettere il file nella pagina" non si scarica il blob in memoria: è lavoro e RAM sprecati.

> **Default `webopt = true`:** è un flag generico che chiede al backend la versione **ottimizzata per il web** del file, qualunque essa sia — non è legato alle immagini per definizione. Oggi l'unica ottimizzazione implementata è quella per le immagini (lato più lungo max 1920 px, conversione in WebP), quindi i contenuti per cui non esiste ancora una pipeline (PDF, video…) vengono serviti tali e quali; ma il flag è il punto di aggancio previsto per future riduzioni lato API di altri tipi di contenuto. Per ottenere **sempre** il file originale, così com'è stato caricato — es. download a piena risoluzione — passa `getBlobUrl(slug, false)`.

#### Caricare un file (`uploadBlob`)

`uploadBlob(file)` carica il file e restituisce lo `slug` con cui recuperarlo in seguito (via `getBlobUrl` / `getBlob`). Si abbina a `app-upload-form`, il componente drag-and-drop riusabile:

```typescript
// <app-upload-form (fileConfirmed)="onFileConfirmed($event)" [isLoading]="isUploading()" />
async onFileConfirmed(file: File): Promise<void> {
    this.isUploading.set(true);
    try {
        const { slug } = await this.api.uploadBlob(file);
        // `slug` è l'identificativo per recuperare il file in futuro
    } finally {
        this.isUploading.set(false);
    }
}
```

> **Nota:** `uploadBlob` richiede JWT valido (l'utente deve essere loggato). Anche le GET (`getBlobUrl`, `getBlob`) richiedono l'API key: l'endpoint `/blob/{slug}` non è anonimo, quindi i file non sono una risorsa pubblica raggiungibile direttamente dal backend (es. da un crawler) come lo sono gli asset statici. Nel browser la chiave non va gestita: la inietta in modo trasparente il proxy SSR `/api`.

**Pattern one-shot** (dati statici, caricati una volta):
```typescript
ngOnInit() {
    this.api.getProfile().then(p => this.profile.set(p));
}
```

**Pattern reattivo** (dati che si aggiornano con la lingua o lo stato):
```typescript
readonly profileRes = this.api.getProfileResource();
// In template: profileRes.value() | profileRes.isLoading()
```

### Errori Silenziosi per UI Custom

In componenti con UI d'errore propria (es. form di login), passa `{ silent: true }` per impedire la notifica automatica:

```typescript
// LoginFormComponent: gestisce l'errore internamente
await this.api.login(req, { silent: true })
    .catch(err => {
        this.errorMsg.set(err.problem?.detail ?? this.translate.translate('erroreImprevisto'));
    });
```

Senza `silent: true`, l'`apiErrorInterceptor` chiama `NotificationService.handleApiError()` automaticamente. Il client API (`BaseApiService`) resta puro: fa la chiamata e propaga un `ApiError` tipizzato; la notifica è un concern trasversale dell'interceptor.

### `httpResource` per Componenti Sempre-On

Usa `getProfileResource()` nei componenti che restano attivi durante tutta la navigazione (navbar, footer):
```typescript
readonly profile = this.api.getProfileResource();
// profile.value() → Profile | undefined
// profile.isLoading() → boolean
```
Si aggiorna automaticamente al cambio lingua (tramite segnale `Accept-Language`).

> **`getProfile()` vs `getProfileResource()`:** non sono intercambiabili. `getProfile()` è una `Promise` one-shot: la risolvi una volta (es. in `ngOnInit`) e i dati restano fissi finché non richiami il metodo — al cambio lingua **non** si aggiornano. `getProfileResource()` è un `httpResource` reattivo che si ri-fetcha da solo quando cambia la lingua. In componenti sempre-attivi (navbar, footer) usa la resource, altrimenti mostrano dati nella lingua precedente dopo uno switch.

---

## 📤 ShareService: Copia, Condivisione, Download

`ShareService` centralizza tutte le operazioni di condivisione e download. **Responsabilità unica:** esegue l'operazione e ne restituisce l'esito — **non mostra toast**. La notifica è di chi scatena l'azione (il bottone/la pagina), così lo stesso servizio resta usabile anche in contesti silenziosi. I componenti `app-copy-action` / `app-share-action` lo fanno già per te.

```typescript
// Copia negli appunti → ritorna true/false, niente toast: lo mostra il chiamante
const ok = await this.share.copyText('testo');
this.notify.toast(this.translate.translate(ok ? 'clipboardCopied' : 'clipboardError'), ok ? 'success' : 'error');

// Condivisione nativa (Web Share API) con fallback a copy → ritorna un ShareResult
const result = await this.share.shareText('Titolo', 'Testo da condividere');
// shareResultNotice(result) mappa l'esito a un toast (o null se non serve avvisare)
const notice = shareResultNotice(result);
if (notice) this.notify.toast(this.translate.translate(notice.key), notice.type);

// Download canvas come PNG
await this.share.downloadCanvas(myCanvas, 'screenshot.png');

// Download blob generico
this.share.downloadBlob(blob, 'documento.pdf');
```

**Esito (`ShareResult`):** `shared` (foglio nativo) · `copied` (fallback appunti) · `downloaded` (fallback download) · `cancelled` (annullato) · `error`. L'helper puro `shareResultNotice(result)` decide il toast appropriato (o `null`); il componente lo mostra.

**Fallback chain:** Web Share API disponibile → usa native share; non disponibile / errore → fallback a download o copy.

---

## 🔊 Sintesi Vocale (SpeechService)

`SpeechService` fornisce lettura ad alta voce con selezione automatica della voce in base alla lingua corrente.

```typescript
// Nel componente
private speech = inject(SpeechService);

readAloud(text: string) {
    this.speech.speak(text, { rate: 1.0, pitch: 1.0 });
}
```

```html
<button (click)="readAloud(articleText)" [disabled]="speech.isSpeaking()">
    {{ speech.isSpeaking() ? 'Lettura in corso...' : 'Leggi ad alta voce' }}
</button>
```

- Voce auto-selezionata in base alla lingua corrente (si aggiorna reattivamente al cambio lingua)
- `rate`: velocità 0.1–10 (default 1); `pitch`: tono 0–2 (default 1)
- `speech.isSpeaking()`: Signal reattivo
- SSR-safe: non disponibile server-side, degradazione silenziosa

---

## QR: Codici QR Dinamici (QrCodeService)

`QrCodeService` genera codici QR per casi d'uso comuni con colori automaticamente adattati al tema.

```typescript
// WhatsApp: link precompilato con messaggio
await this.qr.create({ type: 'whatsapp', phone: '+393331234567', text: 'Ciao!' });

// Email: mailto con subject e body
await this.qr.create({ type: 'email', to: 'info@example.com', subject: 'Demo', body: '...' });

// WiFi: WIFI auth string
await this.qr.create({ type: 'wifi', ssid: 'MyNetwork', password: 'pwd123', encryption: 'WPA' });

// SEPA: bonifico bancario
await this.qr.create({ type: 'sepa', iban: 'IT60...', name: 'Azienda', amount: 100.50 });

// Testo libero / URL
await this.qr.create({ type: 'text', content: 'https://example.com' });
```

Ritorna `{ success: true, blob: Blob }` oppure `{ success: false, error: QrError, message: string }`.

**Caching:** LRU cache automatica (max 32 QR) — QR identici con stessi colori sono serviti dalla memoria senza ricalcolo.

---

## 🖼️ ImgBuilderService: Generazione Immagini da Testo

`ImgBuilderService` genera PNG da testo usando SVG come formato intermedio. Tre modalità di layout:

```typescript
// exactInLine: nessun wrap, dimensioni guidate dal contenuto
{ renderMode: 'exactInLine' }

// wrap: larghezza fissa, altezza segue il testo
{ renderMode: 'wrap', maxWidth: 1000 }

// fixedRatio: aspetto ratio fisso, dimensioni si adattano
{ renderMode: 'fixedRatio', ratio: '16:9' }
```

```typescript
// Canvas per uso diretto (es. disegno, compositing)
const canvas = await this.img.buildCanvas('Titolo Articolo', {
    bgColor: '#1f40ff',
    textColor: '#ffffff',
    fontSize: 60,
    ratio: '16:9',
    maxWidth: 1920,
});

// Blob PNG per download o condivisione
const blob = await this.img.buildBlob('Titolo', opts);
await this.share.downloadBlob(blob, 'social.png');
```

Se non fornisci `bgColor`/`textColor`, vengono letti dai Signal del tema corrente (colori WCAG-conformi automatici).

**SSR-safe:** il metodo statico `ImgBuilderService.buildSvg()` non tocca DOM né Angular — usabile in Node.js per generare preview server-side.

---

## 🔗 Meta Tag e Anteprima Sociale (PageMetaService)

`PageMetaService` aggiorna meta tag (title, og:, twitter:, canonical, JSON-LD) per ogni pagina. I valori di base vengono impostati automaticamente da `site.ts`; il resolver li affina con i dati della pagina.

### og:image Dinamica

In SSR viene generata automaticamente un'immagine personalizzata per la condivisione sociale:
- Asset di background (se `imgId` fornito)
- Overlay con titolo e sottotitolo
- Badge con favicon del sito

```typescript
// Nel ContentResolver della pagina
this.pageMeta.setPageMeta({
    pageTitle: 'Il Mio Articolo',
    description: 'Descrizione SEO',
    imgId: 'hero-image-123',
    ogType: 'article',
    structuredDataType: 'Article'
});
```

**Importante:** `og:image` si aggiorna solo in SSR. I crawler non eseguono JavaScript — vedono la versione server-rendered. Le modifiche client-side all'og:image non hanno effetto sui preview di Facebook/LinkedIn/WhatsApp.

### JSON-LD Strutturato (grafo Schema.org)

Schema.org viene iniettato automaticamente per ogni pagina. Migliora l'apparenza in Google Search e altri motori. L'Engine emette un **grafo di entità separate**, ognuna nel proprio `<script type="application/ld+json">`: blocchi distinti rendono il grafo più leggibile ai validator e permettono di aggiornare ogni entità senza sovrascrivere le altre.

| Entità | `@id` | Quando |
| :--- | :--- | :--- |
| `Organization` | `{origin}#organization` | Sempre — nome, URL e logo del sito |
| `WebSite` | `{origin}#website` | Sempre — collega le pagine al sito e all'organizzazione |
| `WebPage` (o tipo scelto) | `{canonical}#webpage` | Sempre — la pagina corrente, con `inLanguage`, `isPartOf`, `publisher` |
| `BreadcrumbList` | — | Solo quando il path non è la root (`/`) |

Il tipo della pagina (`Article`, `WebPage`, ecc.) si imposta tramite `structuredDataType` nella config della pagina in `site.ts`. Ogni script è marcato con l'attributo `data-br1-jsonld` (per aggiornarli/rimuoverli in blocco) e riceve il **nonce CSP** della richiesta in SSR, così rispetta la Content-Security-Policy senza `unsafe-inline`.

### URL Canonico e `og:locale`

Il canonical viene costruito in modo **stabile** per evitare contenuti duplicati e canonical divergenti tra HTML iniziale e idratazione:
- query string e hash vengono rimossi;
- in SSR l'origin è forzato a `FRONTEND_BASE_URL`, indipendentemente dagli header del reverse proxy.

Lo stesso canonical alimenta `og:url`, il tag `rel="canonical"` e gli `@id`/`url` del grafo JSON-LD, mantenendoli coerenti.

`og:locale` (e gli `og:locale:alternate` per le altre lingue) usano il formato regionale OpenGraph `lingua_REGIONE` (es. `it_IT`, `en_US`), derivato via `Intl.Locale().maximize()`. Gli alternate vengono rigenerati con remove+add a ogni cambio pagina, così funzionano correttamente anche con più di due lingue (dove `Meta.updateTag` sovrascriverebbe un solo tag).

---

## 🔄 Controllo Versione e Aggiornamenti (VersionCheckService)

L'app controlla automaticamente se è disponibile una nuova versione e notifica l'utente.

### Fonti di Versione

La versione è dichiarata in `global-settings.json` (`project.version`) e distribuita in tre posti tramite `generate-statics.ts` al build:
1. Meta tag `app-version` — baseline in memoria
2. `manifest.webmanifest` — usato dal polling ogni 10 minuti
3. Hash NGSW — usato da SwUpdate nelle PWA installate

### Meccanica

**Browser normale:** polling ogni 10 minuti su `/manifest.webmanifest` → se version cambia → dialog "Nuova versione disponibile" → hard reload attiva la nuova versione.

**PWA installata:** SwUpdate intercetta il manifest (Service Worker) → emette `VERSION_READY` quando la nuova versione è scaricata → l'utente conferma → `activateUpdate()` + reload.

**Prerequisito:** il controllo versione è **disabilitato finché `isTechnicalConsentGiven()` è false**. Una volta accettato il consenso tecnico, il servizio si attiva al reload successivo.

---

## ⚙️ Opzioni Avanzate di `site.ts`

Oltre a `path`, `title` e `description`, ogni pagina in `pages` accetta:

```typescript
{
    // Forza il rendering client-side (es. per pagine protette da login)
    renderMode: 'client',  // default: 'server'

    // Nasconde parti della shell per questa pagina
    layout: {
        showNav: false,     // nasconde la navbar
        showFooter: false,  // nasconde il footer
        showPanel: false,   // nasconde il pannello laterale
    },

    // Meta tag OpenGraph aggiuntivi
    otherSEO: {
        ogImage: '/assets/og-cover.png',
        ogType: 'article',
        structuredDataType: 'WebPage',
    },
}
```

A livello top di `site.ts` (oltre a `pages` / `headerNav` / `footerNav`) dichiari struttura e comportamento del sito. Ogni campo ha un default: dichiari solo quelli che vuoi cambiare.
```typescript
// site.ts
homePage: PageType.Home,           // pagina del brand/logo nel navbar (se omessa, il brand non è un link)
loginPage: PageType.Login,  // dove mandare gli utenti non autenticati (se omessa → /error/401)

shell: {                           // comportamento di navbar / footer / header / pannello contenuti
    showNav: true,                 // mostra la navbar (false nasconde anche il language picker)
    showFooter: true,              // mostra il footer
    fixedTopHeader: false,         // navbar fissa in alto allo scroll
    showBrandIconInHeader: true,   // favicon accanto al nome nel brand
    showLoginInHeader: true,       // link Login / pulsante Logout nella navbar
    forcedLightPanel: true,        // pannello contenuti sempre chiaro, a prescindere dal tema OS
},

isWebApp: true,                    // funzionalità PWA (Service Worker, aggiornamenti, install offline)
onlyPlainImage: false,             // anteprime social con sola immagine, senza scritte/favicon

legalPages: { /* … */ },           // pagine legali → vedi sotto
```

> `description` (mappa per-lingua `{ it, en, … }`), `colorTema` e l'effetto `smoke` non stanno qui: sono identità/estetica e vivono in `global-settings.json → site`.

### Navigazione Multilivello (Navbar e Footer)

I menu in `site.ts` (`headerNav` e `footerNav`) supportano la navigazione annidata (gruppi di link e sottomenu). Invece di un singolo link, puoi inserire un oggetto usando la proprietà `children`:

```typescript
headerNav: [
    { label: 'navChiSiamo', path: PageType.AboutUs },
    {
        label: 'navServizi',
        children: [
            { label: 'navConsulenza', path: PageType.Consulting },
            {
                label: 'navSviluppo',
                children: [
                    { label: 'navWeb', path: PageType.WebDev },
                    { label: 'navApp', path: PageType.AppDev }
                ]
            }
        ]
    }
]
```

L'Engine elabora i gruppi in modo automatico:
- **Navbar (Desktop)**: genera un menu dropdown. Dal secondo livello in giù, genera **flyout laterali** che si espandono verso destra (o si ribaltano a sinistra in automatico se sforano il viewport).
- **Navbar (Mobile)**: converte i gruppi in **accordion indentati** che si espandono al click.
- **Footer**: genera colonne annidate visivamente strutturate per livelli di indentazione.

**Limiti di Profondità**: Se superi i 3 livelli di profondità, in fase di sviluppo riceverai un avviso di usabilità in console (`NAV_DEPTH_WARN`), e un errore bloccante se si superano i 5 livelli (`NAV_DEPTH_MAX`).

### Pagine legali (`legalPages`)

Mappi gli slot legali dell'Engine ai tuoi `PageType`; il builder costruisce da solo il contenitore `/policy/*` con le sole pagine valorizzate:
```typescript
legalPages: {
    privacy: PageType.PrivacyPolicy,
    cookie:  PageType.CookiePolicy,
    tos:     PageType.TermsOfService,
    legal:   PageType.LegalNotice,
},
```
- **Slot omesso** → quella pagina non viene creata (es. una vetrina con i soli cookie).
- **Cookie obbligatoria**: se il sito usa cookie (multilingua, PWA o cookie di progetto) lo slot `cookie` dev'essere valorizzato, altrimenti il build si ferma con un errore esplicito.
- **Contenuto**: Markdown localizzati in `src/assets/legal/` (slug `privacy`, `cookie`, `TOS`, `legal` → `<slug>.<lang>.md`); il `PolicyComponent` interpola i placeholder del profilo aziendale (`{{ragioneSociale}}`, `{{partitaIva}}`, …).

**Override per-pagina.** Per gestire una policy a modo tuo (rotta dedicata, contenuto da API invece che da Markdown) dichiari tu stesso la pagina in `pages` con lo stesso `PageType`: la tua vince, l'Engine non la crea e non ne carica il `.md`. Le altre policy restano automatiche.

### Router: Component Input Binding e Scroll

Il router è configurato con `withComponentInputBinding()`: i parametri di rotta si leggono direttamente come `@Input()` nel componente, senza iniettare `ActivatedRoute`:

```typescript
@Component({ ... })
export class ArticleComponent {
    readonly id = input<string>();       // Letto da route params
    readonly tab = input<string>('info'); // Valore di default
}
```

`withInMemoryScrolling()` gestisce la posizione di scroll: il ritorno alla pagina precedente ripristina la posizione; i link con `#section` scrollano all'ancora.

---

## 🧩 Configurazione di progetto (`Custom`)

`global-settings.json → Custom` è uno spazio libero per la configurazione di progetto (feature flag, ID analytics, soglie): oggetti annidati arbitrari, senza toccare schema o codice infrastrutturale. È leggibile a ogni livello:

- **Backend (ASP.NET Core):** `IConfiguration["Custom:TuaChiave"]`
- **Node SSR:** `getBr1Settings().Custom`
- **Browser Angular:** `inject(APP_CUSTOM)` in qualsiasi componente o servizio — l'SSR serializza `Custom` in `TransferState` e il client la rilegge in idratazione (fallback `{}` senza SSR).

```typescript
import { APP_CUSTOM } from './core/engine/app-custom';

const custom = inject(APP_CUSTOM);
const trackingId = custom['Analytics']?.['TrackingId'] as string | undefined;
```

> `Custom` è committabile ed esposto al client: non metterci segreti — quelli vivono in `global-settings.local.json`.

> ⚠️ **`Custom` lato browser richiede SSR sulla rotta.** `inject(APP_CUSTOM)` si popola dal `TransferState`, che esiste solo se la pagina è renderizzata dal server. Su una rotta `renderMode: 'client'` (incluse le pagine `requiresAuth`, vedi sopra) il `TransferState` non viene emesso → al **caricamento diretto/refresh** di quella rotta `APP_CUSTOM` è `{}`. Se una pagina deve leggere `Custom` lato client (es. un token mappa), tienila `renderMode: 'server'`: l'SSR rende solo la shell e popola il `TransferState`, mentre la logica browser resta in `afterNextRender`. Se il valore deve restare fuori dal repo, mettilo in `Custom` di `global-settings.local.json` (gitignored): il merge in dev e il file effettivo in prod lo fanno comunque arrivare.

---

## 📡 Configurazione SSR e Origine Frontend

### `FRONTEND_BASE_URL` per og:image

L'URL canonico del sito è dichiarato in `FRONTEND_BASE_URL` (env var letta da `deploy.sh` / `global-settings.json`). Viene usato per costruire URL assoluti di `og:image` in SSR — indipendentemente dagli header del reverse proxy (Nginx, Cloudflare):

```bash
FRONTEND_BASE_URL=https://tuodominio.it
```

Nel browser, se il token non è disponibile, si usa `document.location.origin` come fallback. Importante per deployment multi-dominio dove SSR e browser vedono origini diverse.

---

## 🔗 `[appPage]`: Navigazione Dichiarativa

La directive `PageDirective` traduce un `PageType` nel path corrispondente e lo passa a `RouterLink`, eliminando il boilerplate `[routerLink]="ContestoSito.getPath(PageType.X) ?? '/'"`.

```html
<!-- Tutti i link interni al sito usano [appPage] -->
<a [appPage]="PageType.Home"          class="nav-link">Home</a>
<a [appPage]="PageType.PrivacyPolicy" class="footer-link">Privacy</a>
<a [appPage]="PageType.Contatti"      class="btn btn-primary">Contattaci</a>
```

| Caratteristica | Dettaglio |
| :--- | :--- |
| Comportamento | Identico a `[routerLink]` — SPA navigation, keyboard, right-click "Apri in nuova scheda" |
| Fallback | Se il `PageType` non è registrato in `site.ts`, naviga verso `/` **in silenzio**: nessun errore a runtime né a compile-time (il `PageType` esiste come enum, manca solo la rotta). Un link che porta a casa senza motivo apparente di solito è un `PageType` dichiarato nell'enum ma mai aggiunto a `pages`. |
| `href` | Bindato esplicitamente: RouterLink come `hostDirective` non aggiorna il proprio `@HostBinding` via effect → senza questo binding, l'elemento avrebbe `href=null` e cursore testo invece di cursore link |
| Tipo | `input.required<PageType>()` — errore TypeScript a compile-time se mancante |

**Regola pratica:** usa `[appPage]` per tutti i link interni. Per navigazione programmatica dopo operazioni asincrone (es. redirect post-login, post-form) inietta `Router` e chiama `router.navigate([ContestoSito.getPath(PageType.X) ?? '/'])`.

---

## 🖼️ Directive di Rendering Dichiarativo

### `img[imgRender]`: Rendering Immagine Generata

Applica `ImgBuilderService` direttamente su un `<img>`. Il `src` viene aggiornato automaticamente con il data URL PNG ogni volta che la config cambia. Niente wrapper, niente classi proprie — l'elemento accetta tutti gli attributi `<img>` standard.

```html
<img [imgRender]="imgConfig"
     (canvasChange)="canvas.set($event)"
     alt="Anteprima social"
     class="img-fluid rounded">
```

```typescript
readonly imgConfig: ImgRenderConfig = {
    text: 'Il titolo del post',
    renderMode: 'fixedRatio',
    ratio: '16:9',
    maxWidth: 1200,
    bgColor: '#1f40ff',
    textColor: '#ffffff',
    fontSize: 48,
};

// Canvas raw per pilotare download/share dall'esterno della directive
readonly canvas = signal<HTMLCanvasElement | null>(null);
```

- **Output `canvasChange`**: emette il `HTMLCanvasElement` raw per pilotare `share.downloadCanvas()` da altri rami del template
- **SSR-safe**: `src = null` server-side → il browser mostra `alt`
- **Race condition**: token monotono evita che render asincroni sovrapposti mostrino un'immagine obsoleta
- **Selector vincolato**: `img[imgRender]` → errore TypeScript a compile-time su elementi diversi da `<img>`

### `img[qrContent]`: Rendering QR Code

Applica `QrCodeService` direttamente su un `<img>`. Il `src` viene aggiornato automaticamente con il blob URL del QR generato.

```html
<img [qrContent]="qrConfig"
     (blobChange)="qrBlob.set($event)"
     (errorChange)="qrError.set($event)"
     alt="QR Code WhatsApp"
     class="img-fluid">

@if (qrError()) {
    <div class="alert alert-danger">{{ qrError() }}</div>
}
<button [disabled]="!qrBlob()" (click)="downloadQr()">Scarica QR</button>
```

```typescript
readonly qrConfig: QrConfig = { type: 'whatsapp', phone: '+393331234567', text: 'Ciao!' };

readonly qrBlob  = signal<Blob | null>(null);
readonly qrError = signal<string | null>(null);

downloadQr() {
    const b = this.qrBlob();
    if (b) this.share.downloadBlob(b, 'qr-whatsapp.png');
}
```

- **Output `blobChange`**: blob raw per `share.downloadBlob()` / `share.shareText()`
- **Output `errorChange`**: messaggio localizzato (o `null` se generazione ok)
- **SSR-safe**: `src = null` server-side
- **Selector vincolato**: `img[qrContent]` → errore TypeScript a compile-time su elementi diversi da `<img>`

---

## 🖱️ `[appContextMenu]`: Menu Contestuale

La directive `ContextMenuDirective` aggiunge un menu contestuale a qualsiasi elemento. Su desktop apre un **popover** sotto il cursore; su mobile/touch apre un **bottom sheet** a tutta larghezza.

```html
<div [appContextMenu]="menuOptions" class="item-card p-3">
    Contenuto (click destro / tieni premuto su mobile)
</div>
```

```typescript
readonly menuOptions: ContextMenuOption[] = [
    { label: 'Copia link',  icon: 'fa-solid fa-copy',        action: () => this.copyLink() },
    { label: 'Condividi',   icon: 'fa-solid fa-share-nodes',  action: () => this.shareItem() },
    { separator: true },
    { label: 'Elimina',     icon: 'fa-solid fa-trash',        action: () => this.deleteItem() },
];
```

### Interfaccia `ContextMenuOption`

| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `label` | `string` | Testo della voce |
| `action` | `() => void` | Callback al click (opzionale) |
| `icon` | `string` | Classe FontAwesome (es. `'fa-solid fa-copy'`) |
| `disabled` | `boolean` | Voce disabilitata (mostrata ma non cliccabile) |
| `separator` | `boolean` | Inserisce un divisore visivo sopra questa voce |

### Comportamento Adattivo

| Input | Presentazione |
| :--- | :--- |
| Mouse destro (desktop, `pointer: fine`) | Popover contestuale alla posizione del cursore |
| Long-press 450 ms (touch/mobile, `pointer: coarse`) | Bottom sheet a tutta larghezza — ottimizzato per pollice |
| Tasto `Escape` | Chiude il menu |
| Click fuori dal menu | Chiude il menu |
| Focus | Ripristinato sull'elemento trigger alla chiusura |

La directive usa Pointer Events unificati (mouse, touch, penna). Un timer di sicurezza di 600 ms previene che il click sintetico post-long-press chiuda immediatamente il menu appena aperto.

---

## 🃏 Componenti Condivisi

### `app-loading`: Spinner Condizionale

Wrappa un blocco di contenuto e mostra uno spinner finché `loading` è `true`, poi proietta il contenuto. Evita di scrivere a mano la coppia `@if (loading()) { spinner } @else { ... }` in ogni pagina, ed è già accessibile (`role="status"`, `aria-live`, testo i18n per gli screen reader).

```html
<app-loading [loading]="isLoading()">
    <!-- mostrato solo quando isLoading() è false -->
    <app-profile-render [profile]="profile()!" />
</app-loading>
```

| Input | Tipo | Descrizione |
| :--- | :--- | :--- |
| `loading` | `boolean` (required) | `true` → spinner; `false` → contenuto proiettato |

### `app-profile-render`: Dati Aziendali Completi

Visualizza un oggetto `Profile` con tutti i campi legali italiani. I campi `null`/`undefined` vengono omessi automaticamente (skip-empty).

```html
<app-profile-render [profile]="profile" />
```

Rende due sezioni:
- **Contatti**: telefono, PEC, email
- **Dati societari**: P.IVA, Codice Fiscale, sede legale, registro imprese, REA, capitale sociale, versamento integrale, socio unico, stato di liquidazione, codice SDI

Formattazione automatica:
- **Importi**: `Intl.NumberFormat` con locale mapping (`it` → `it-IT`, `en` → `en-GB`)
- **Booleani**: tradotti tramite chiavi i18n (`siAzione` / `noAzione`)
- **Indirizzo**: assembla `via civico` + `CAP città (provincia)` + `nazione`

Le etichette usano le chiavi `*Azienda` in `addon.{lang}.json` — tutte personalizzabili.

### `app-icon`: Badge Icona FontAwesome

Glifo FontAwesome in pastiglia con forma e animazione hover configurabili. Valori non riconosciuti per `shape`/`animation` ricadono silenziosamente sul default (coerce interno).

```html
<!-- Cerchio di default, nessuna animazione -->
<app-icon glyph="fa-brands fa-facebook" [color]="'#1877F2'" />

<!-- Quadrato con animazione lift al hover -->
<app-icon glyph="fa-solid fa-star" shape="square" animation="lift" />
```

| Input | Tipo | Valori | Default |
| :--- | :--- | :--- | :--- |
| `glyph` | `string` (required) | Qualsiasi classe FontAwesome | — |
| `color` | `string \| null` | Hex / CSS color, `null` = tema | `null` |
| `shape` | `string` | `'circle'` \| `'rounded'` \| `'square'` | `'circle'` |
| `animation` | `string` | `'lift'` \| `'shake'` \| `'none'` | `'none'` |

### `app-social-link`: Pulsante Social con Branding

Pulsante social con icona e colore brand corretti. Riconosce automaticamente tutti i network noti; per gli sconosciuti usa `fa-solid fa-link` senza colore brand.

```html
<app-social-link type="facebook"  [value]="fbUrl" />
<app-social-link type="instagram" [value]="igUrl" [showLabel]="true" />
<!-- Network non riconosciuto — usa icona generica -->
<app-social-link type="mio-sito"  [value]="url"   label="Sito web" />
```

| Input | Tipo | Descrizione |
| :--- | :--- | :--- |
| `type` | `string` (required) | Chiave network (case-insensitive) |
| `value` | `string` (required) | URL o handle |
| `label` | `string` | Etichetta custom (default: `capitalize(type)`) |
| `showLabel` | `boolean` | Mostra testo accanto all'icona (default: `false`) |

Network con branding integrato (30+): `facebook`, `instagram`, `twitter`, `linkedin`, `youtube`, `whatsapp`, `telegram`, `tiktok`, `spotify`, `discord`, `github`, `reddit`, `threads`, `google`, `snapchat`, `pinterest`, `tumblr`, `twitch`, `soundcloud`, `deezer`, `vimeo`, `dribbble`, `skype`, `mastodon`, `btc`, `amazon`, `airbnb`, `apple`, `android`, `yahoo`, `audible` e altri.

### Componenti di Azione

Famiglia di bottoni icon-first per operazioni asincrone su contenuto (testo, Blob, PDF). Tutti condividono lo stesso pattern e includono uno spinner automatico durante l'esecuzione:

- `action` (required) — funzione sincrona o asincrona che produce il contenuto
- `label` — chiave i18n per il testo del bottone (default predefinito per ogni componente)
- `showLabel` — `false` per sola icona (default), `true` per icona + testo

```html
<!-- Solo icona (default) -->
<app-copy-action [action]="getMyText" />

<!-- Icona + etichetta -->
<app-copy-action [action]="getMyText" [showLabel]="true" />

<!-- Etichetta personalizzata -->
<app-copy-action [action]="getMyText" label="copiaRisultato" [showLabel]="true" />
```

#### `app-copy-action`
Copia il testo restituito da `action` negli appunti tramite `ShareService`.

#### `app-share-action`
Condivide il testo tramite Web Share API (con fallback automatico a copia su browser non supportati).

#### `app-speech-action`
Legge il testo ad alta voce tramite `SpeechService`. Bottone toggle: in riproduzione mostra lo stato "stop" e si interrompe automaticamente alla distruzione del componente.

#### `app-download-action`
Scarica il `Blob` restituito da `action` con il nome file specificato. 

#### `app-pdf-action`
Apre o scarica un PDF tramite `PdfActionConfig`. `openInTab: true` apre in una nuova scheda, `false` forza il download.

#### `app-print-action`
Stampa il testo, PDF o HTML restituito dall'action. Apre la finestra di stampa nativa del browser.

### Componenti di Contatto

Famiglia di link (`<a>` tag mascherati da bottoni) che permettono di contattare l'utente attraverso canali esterni senza eseguire logiche complesse in Angular, supportando l'apertura in nuove tab e la corretta indicizzazione SEO.

Tutti i componenti condividono le configurazioni standard:
- `config` (required) — oggetto con i parametri specifici del canale
- `label` — chiave i18n
- `showLabel` — `false` per sola icona (default)

```html
<app-mail-contact [config]="{ to: 'info@example.com', subject: 'Richiesta' }" [showLabel]="true" />
<app-whatsapp-contact [config]="{ phone: '+393331234567', text: 'Ciao!' }" />
```

#### `app-mail-contact`
Genera un link `mailto:` precompilato.

#### `app-phone-contact`
Genera un link `tel:` per chiamate dirette dal dialer.

#### `app-whatsapp-contact`
Genera un link `wa.me` per avviare una chat WhatsApp con testo precompilato.

#### `app-telegram-contact`
Genera un link `t.me` per avviare una chat Telegram.

---

## 🏗️ Script di Build: `generate-statics.ts`

Lo script sincronizza i file statici e **inietta nel frontend** (via `src/environments/environment.ts`) identità ed estetica del progetto: `project.name`/`project.version`, `Localization` e la sezione `site` (descrizione, tema, smoke) da `global-settings.json`. La **struttura e il comportamento** (pagine, menu, `shell`, `isWebApp`, `loginPage`, `legalPages`) restano in `site.ts`. **Va eseguito ogni volta che si modifica `global-settings.json` o `site.ts`** (è già nei passi `prebuild`/`prestart`; in Docker la config arriva via l'ARG `BR1_PROJECT_JSON`).

```bash
npm run generate:statics
```

### File Aggiornati

| File | Contenuto sincronizzato |
| :--- | :--- |
| `src/index.html` | `<html lang>`, `<title>`, tutti i meta OpenGraph/Twitter, favicon |
| `public/manifest.webmanifest` | `name`, `description`, `theme_color`, `background_color`, `lang`, `version` |
| `public/sitemap.xml` | URL di tutte le pagine indicizzabili con `priority`, `changefreq` e `lastmod` automatici |
| `public/robots.txt` | `Disallow` per le pagine `requiresAuth: true`, URL sitemap |
| `public/llms.txt` | Indice del sito per i crawler AI (convenzione `llms.txt`): nome, descrizione, elenco pagine |
| `public/security.txt` | Contatto di sicurezza RFC 9116 (`Expires` rigenerato a ogni build); servito sul percorso canonico `/.well-known/security.txt` dal Node SSR |
| `src/environments/environment.ts` | `defaultLang`, `availableLanguages` — **file generato automaticamente, non modificare manualmente** |

### Variabili d'Ambiente

| Variabile | Descrizione | Fallback |
| :--- | :--- | :--- |
| `FRONTEND_BASE_URL` | URL canonico del sito (es. `https://tuodominio.it`) | `https://example.com` con warning |
| `DEFAULT_LANG` | Lingua di default — usata nelle immagini Docker | Da `global-settings.json` |
| `SUPPORTED_LANGS` | Lingue separate da virgola — usata nelle immagini Docker | Da `global-settings.json` |

Su host/CI lo script legge direttamente `global-settings.json`. Nelle immagini Docker (dove il file non è nel build context) `deploy.sh` estrae le variabili dal file e le passa come `--build-arg`.

### Esclusioni Automatiche da Sitemap e robots.txt

| Condizione sulla pagina | Effetto |
| :--- | :--- |
| `enabled: false` | Esclusa dalla sitemap |
| `externalUrl` presente | Esclusa dalla sitemap |
| `requiresAuth: true` | Esclusa dalla sitemap + riga `Disallow` in robots.txt |

### Priority e Changefreq Automatici

| Profondità del path | Esempio | `priority` | `changefreq` |
| :--- | :--- | :--- | :--- |
| 0 (root) | `/` | `1.0` | `weekly` |
| 1 | `/chi-siamo` | `0.8` | `monthly` |
| 2+ | `/blog/articolo` | `0.6` e a scendere (`1.0 − 0.2·profondità`, con minimo `0.3`) | `yearly` |

### `og:updated_time` e `<lastmod>` della sitemap

Entrambi sono impostati a `project.lastModified` in `global-settings.json` (formato italiano `GG/MM/AAAA`, convertito in `YYYY-MM-DD`). La si bumpa **a mano** quando i contenuti cambiano davvero: dà al `<lastmod>` un valore accurato e stabile, come richiesto da Google per considerarlo attendibile. Fallback alla data del build se il campo è assente o non valido.

### `og:locale`

`og:locale` in `index.html` usa il formato regionale OpenGraph `lingua_REGIONE` (es. `it` → `it_IT`), derivato dalla `DEFAULT_LANG` via `Intl.Locale().maximize()` — coerente con il formato emesso a runtime da `PageMetaService`.

---

## ⚙️ Server SSR: Sicurezza e Performance

### Health Check JSON

L'endpoint `/health` restituisce JSON strutturato (non una stringa generica):

```json
{ "status": "ok", "mode": "ssr", "a11yPaths": ["/home", "/chi-siamo", "..."] }
```

`a11yPaths` è la lista di tutte le pagine indicizzabili — usato da sistemi di monitoraggio per verificare la salute dell'SSR e pilotare test automatici di accessibilità (Lighthouse, axe-core) su tutte le pagine del sito.

### Status Code SEO-Aware

Il server imposta lo status code HTTP reale in base al path richiesto, confrontandolo con le pagine note di `site.ts`. Senza questo controllo Angular SSR risponderebbe `200` anche per le rotte che renderizzano la pagina 404 del sito (un **soft 404**: i crawler vedono una pagina di errore servita con esito positivo e continuano a indicizzarla).

| Path richiesto | Status HTTP restituito |
| :--- | :--- |
| Path corrispondente a una pagina dichiarata | Status originale di Angular (di norma `200`) |
| Path non corrispondente a nessuna pagina | `404 Not Found` |
| `/error/{codice}` (es. `/error/403`) | Il codice indicato (`403`) |
| `/error` | `500` |

Il body resta quello renderizzato da Angular (la pagina di errore del sito); cambia solo lo status code della risposta, così i motori di ricerca de-indicizzano correttamente gli URL inesistenti.

### Host Allowlist (HTTP 421)

Le richieste da host non autorizzati vengono rifiutate con `HTTP 421 Misdirected Request` prima di raggiungere il proxy API o l'SSR. Il controllo avviene tramite `request.hostname` dopo `app.set('trust proxy', ...)`.

```bash
ALLOWED_HOSTS=tuodominio.it,www.tuodominio.it
```

**Default (nessuna variabile impostata):** `localhost`, `127.0.0.1`, `[::1]` — permette lo sviluppo locale senza configurazione aggiuntiva.

> **Nota:** `@angular/ssr` non riconosce `*` come wildcard globale (lo tratterebbe come match letterale, causando `400 Bad Request` per qualsiasi host reale). Per accettare host multipli, elencali esplicitamente separati da virgola in `ALLOWED_HOSTS`, oppure valorizza `frontend.hostname` in `global-settings.json`.

### CSP Nonce Per-Request (Solo Produzione)

In produzione (`node server.mjs`), ogni risposta SSR ottiene un nonce casuale a 16 byte (base64url):
- Rimpiazza `{SCRIPT_NONCE_PLACEHOLDER}` nell'header `Content-Security-Policy`
- Angular inietta `nonce="..."` su tutti gli `<script>` inline generati in SSR
- In development (HMR attivo) viene usato `unsafe-inline` (richiesto da webpack HMR)

### Server Fingerprinting Nascosto

`app.disable('x-powered-by')` rimuove l'header `X-Powered-By: Express` dalle risposte per rendere più difficile il fingerprinting del server.

### Trusted Proxy Headers

Il server dichiara una lista esplicita di header proxy fidati, incluso `x-forwarded-scheme` (non-standard, inviato da Nginx Proxy Manager). Senza questa configurazione, Angular SSR — ricevendo qualsiasi `X-Forwarded-*` non dichiarato — degrada silenziosamente a CSR (`index.csr.html`) invece di eseguire il rendering server-side.

### Cache Strategy per Tipo di File Statico

| Tipo di file | `Cache-Control` | Motivo |
| :--- | :--- | :--- |
| Asset con hash nel nome (JS/CSS Angular) | `public, max-age=31536000, immutable` | Il contenuto non cambia mai — l'hash nel nome garantisce unicità |
| `ngsw-worker.js`, `ngsw.json` | `no-store` | Il Service Worker deve scaricare sempre la versione più recente |
| `manifest.webmanifest` | `public, max-age=86400` | Il polling versione avviene ogni 10 min — massimo 1 giorno stale |
| Traduzioni, icone, altri statici | `no-cache` | Rivalidati a ogni richiesta |
| Pagine SSR | `no-cache` | Contenuto dinamico per-request |

### Protezione Path Traversal (`/assets/legal`)

I file Markdown delle policy legali sono serviti con protezione contro path traversal:
```
GET /assets/legal/privacy.md      → OK
GET /assets/legal/../../etc/passwd → 403
GET /assets/legal/%2e%2e/secret   → 403  (anche URL-encoded)
GET /assets/legal/....//secret    → 403  (anche sequenze miste)
```
Usa `path.resolve()` + prefix check con separatore di directory (`path.sep`) — più robusto di un semplice replace di `../`.

### `/assets/files` — Accesso Diretto Bloccato

```
GET /assets/files/qualsiasi-file → 404
```
I file upload devono essere richiesti tramite `/cdn-cgi/asset?id=...` per passare attraverso la pipeline di ottimizzazione, cache e controllo degli accessi.

### Streaming SSR (Zero Buffering RAM)

La risposta HTML viene inoltrata al browser senza bufferizzare in memoria:
```typescript
Readable.fromWeb(renderedResponse.body).pipe(response);
```
Il browser inizia a ricevere e parsare l'HTML prima che Angular abbia completato il rendering completo della pagina.

### Cache Immagini su Disco (`IMAGE_CACHE_DIR`, `IMAGE_CACHE_MAX_MB`)

I thumbnail generati da `/cdn-cgi/asset` e `/cdn-cgi/preview` vengono scritti su disco per evitare di ricalcolarli a ogni richiesta. Sono dato derivato ed effimero: serviti **solo** dagli handler Node (l'accesso diretto a `/assets/files` è 404), mai come file statico, quindi non vivono sotto `src/assets` né nel build output.

```bash
IMAGE_CACHE_DIR=/var/cache/app-images   # default: <temp di sistema>/br1-image-cache-<hash>
IMAGE_CACHE_MAX_MB=500                   # default: 500 MB — oltre questa soglia elimina i file meno usati
```

**Posizione (`IMAGE_CACHE_DIR`).** Senza override la cache vive in una cartella dedicata nella temp di sistema, isolata per progetto tramite un hash del percorso asset (così più siti — questo template e i suoi figli — sullo stesso host non si mischiano le immagini). Tenerla fuori da `src/assets` è ciò che evita che `ng serve` ricarichi la pagina a ogni miniatura generata in sviluppo, e che thumbnail effimeri finiscano copiati in `dist` al build. In produzione la temp è scrivibile anche col container non-root, ma è effimera: dopo un riavvio la cache parte fredda e si rigenera on-demand. **Per una cache calda tra i deploy**, monta un volume persistente e punta `IMAGE_CACHE_DIR` lì.

**Sweep (`IMAGE_CACHE_MAX_MB`).** Lo sweep LRU avviene ogni 6 ore e porta la cache al 90% del cap (non al 100%) per evitare di ri-sweepare a ogni singolo thumbnail aggiunto. L'`mtime` di ogni file viene aggiornato a ogni hit, così i thumbnail realmente richiesti sopravvivono e vengono scartati solo quelli inutilizzati.

---

## Quick Start
```bash
npm install
npm run start
```
Il proxy si collegherà in automatico al backend .NET in esecuzione sulla porta di default.

> Il proxy del dev server è configurato da `proxy.local.conf.cjs` (sviluppo locale, backend su `localhost:5000`) o `proxy.docker.conf.cjs` (dev in Docker, backend sul container). Entrambi leggono la `x-api-key` dalla sorgente unica `global-settings(.local).json` tramite il modulo condiviso `proxy.api-key.cjs`.
