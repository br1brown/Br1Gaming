# AGENTS.md

Le regole trasversali e le ricette pratiche del progetto, per chi ci sviluppa, umano o assistente di coding. Gli esempi di codice qui sotto servono soprattutto a un agente, per evitargli di scandire mezzo repo per ricavare un pattern; a un umano bastano i puntatori, il codice lo legge direttamente. Il cosa offre e dove vive per-feature sta nei README ([frontend](frontend/README.md), [backend](backend/README.md)); l'implementazione interna dell'Engine non citata per nome in quei README sta in [ENGINE.md](ENGINE.md).

> Il file si chiama proprio `AGENTS.md` e non va rinominato. Non è una scelta di stile: è un nome-convenzione cross-tool, non legato a Br1WebEngine né a un singolo strumento. Diversi coding agent (Claude Code, Codex CLI, Cursor e altri) cercano in automatico, alla radice di un repo, un file con esattamente questo nome per caricare contesto di progetto, nessuna configurazione da parte tua. Un umano lo trova comunque se linkato (come nella mappa di [README.md](README.md)); un agente lo trova da sé solo finché resta `AGENTS.md`. Rinominarlo (es. `DEVGUIDE.md`, `RECIPES.md`) non romperebbe nulla per un lettore umano, ma toglierebbe l'auto-discovery agli agenti, la proprietà per cui questo file è fatto così.

## La regola d'oro: Engine vs Dominio

- **Engine = INTOCCABILE**, si aggiorna dal template via merge: `backend/Engine/`, `frontend/src/app/core/engine/`, `frontend/src/styles/engine/`, `frontend/src/assets/i18n/basic.*.json`. Lo **consumi** (token, signal, direttive, classi base), non lo modifichi mai.
- **Dominio = tuo**: tutto il resto. Cambi i comportamenti per **configurazione** (`global-settings(.local).json`, `site.ts`, sezione `Custom`) o per **estensione** (sottoclassi `Engine*`, nuovi servizi), mai editando l'Engine — o il prossimo merge dal template va in conflitto.
- **Risolvere un conflitto di `git merge template/main`:** sui path Engine e Scaffold vince **sempre** il template (`git checkout template/main -- <path>`); sul Dominio vince **sempre** il tuo progetto. Alcuni file di Dominio sono però **a contratto fisso** con l'Engine (path/nome export/forma non negoziabili, es. `site.ts`, `content.resolver.ts`) — l'elenco completo e il comando esatto sono in [README.md](README.md#-template-vivo-nascita-e-aggiornamento-dei-progetti-figli) § *"Dominio a contratto fisso"*: leggilo prima di risolvere un conflitto su uno di quei file, non a intuito.

## Build, run, test

- **Frontend:** `cd frontend && npm install && npm run start` — **Backend:** `cd backend && dotnet run` (`/health` anonimo; senza `Security.ApiKeys` nel `.local`, ogni richiesta è `401`).
- **Nuovo progetto figlio:** `node setup.mjs "Nome Progetto"`.
- **Qualità (gate = CI, GitHub Actions):** lint, i18n, tsc, dipendenze circolari, a11y, Lighthouse, `npm audit`, vulnerabilità NuGet, gitleaks. In locale on-demand: `./scripts/test/run-all.sh`. Niente hook pre-push: non re-introdurlo. I test unitari sono privati di ogni progetto.

## Commit

Commit narrativi a tema, stile branch + squash: una questione chiusa per commit, non micro-commit.

## Ricette — frontend

#### Aggiungere una pagina
`PageType` è assemblato in `site.ts` da file di area sotto `pages/*.pages.ts` (uno per gruppo tematico, es. `app.pages.ts`). A un'area esistente basta un nuovo ID più una nuova dichiarazione nello stesso file:
```typescript
// pages/app.pages.ts (o il file dell'area giusta)
export const AppPages = { Home: 'app.home', NuovaPagina: 'app.nuovaPagina' /* … */ } as const;
export const appPagesDecl: SitePageInput[] = [
  { path: 'nuova', pageType: AppPages.NuovaPagina, title: 'Nuova',
    requiresAuth: false,                       // true → protetta (guard + redirect), SSR off
    component: () => import('./nuova/nuova.component').then(m => m.NuovaComponent) },
];
```
```typescript
// site.ts — invariato se l'area esiste già; una riga di spread per una nuova area
export const PageType = { ...LegalPages, ...AppPages } as const;
export type PageType = (typeof PageType)[keyof typeof PageType];
pages: (ctx) => [...appPagesDecl],
```
```typescript
// pages/nuova/nuova.component.ts — estende la base: this.api / translate / asset / notify già pronti
// <T> è SEMPRE richiesto (nessun default): <void> se la pagina non ha contenuto risolto dal
// resolver, altrimenti il tipo di quel contenuto (es. <string> per una pagina .md, vedi PolicyComponent).
export class NuovaComponent extends PageBaseComponent<void> { }
```
```html
<a [appPage]="PageType.NuovaPagina">Vai</a>   <!-- mai URL grezzi -->
```

#### Aggiungere una policy legale extra (oltre ai 5 slot fissi)
`legalPages` (`site.ts`) è un array: ogni voce ha lo stesso trattamento (rotta `/policy/*`, `PolicyComponent`, riga nel footer), che sia una delle 5 standard o una policy di progetto (es. diritto di recesso per un e-commerce) — nessuna distinzione, non serve toccare `siteBuilder.ts`/`legal-pages.ts`. Per le 5 standard, `STANDARD_LEGAL_PAGES` (da `siteBuilder.ts`) dà `path`/`titolo`/`descrizione`/`nome file` pronti da spreadare; una voce in più li scrive per esteso. Ricetta completa in [frontend/README.md](frontend/README.md#pagine-legali-legalpages). Voce assente → nessun errore, nessuna pagina in più (stesso pattern silenzioso degli altri campi opzionali).
```typescript
// pages/policy/legal.pages.ts — nuovo PageType (diventa parte di PageType tramite lo spread in site.ts)
export const LegalPages = { /* ... */, WithdrawalPolicy: 'legal.recesso' } as const;
```
```typescript
// site.ts — una voce in più nell'array legalPages, accanto alle 5 standard
legalPages: [
  /* ...le 5 standard via STANDARD_LEGAL_PAGES... */
  { pageType: PageType.WithdrawalPolicy, path: 'recesso', titleKey: 'recessoPolicyMenu',
    descriptionKey: 'recessoPolicyDescrizione', markdownSlug: 'recesso' },
],
```
Poi: chiavi i18n in `addon.<lang>.json` (mai `basic.<lang>.json`, quello è Engine) e `src/assets/legal/recesso.<lang>.md` per ogni lingua configurata.

#### Rimuovere una pagina legale (es. non serve più la Privacy Policy)
Speculare all'aggiunta: togli la voce da `legalPages` (`site.ts`) — pagina, rotta e riga nel footer spariscono da soli, "voce assente" è il pattern normale (vedi sopra), non serve toccare altro in `siteBuilder.ts`. Un riferimento diretto rimasto altrove (es. `g.addPage(PageType.PrivacyPolicy)` in `headerNav`) non rompe il build — `resolveNavigation` scarta in silenzio un `PageType` non più registrato — ma ripulirlo evita una voce di menu morta.
**Eccezione**: se togli la pagina puntata da `cookiePolicy` (stesso file, campo separato dall'array `legalPages` — dettagli in [frontend/README.md](frontend/README.md#pagine-legali-legalpages) §"Rimuovere una pagina"), il build si ferma con un errore esplicito finché non aggiorni anche quel puntatore — a differenza delle altre 4, la Cookie Policy non è mai "silenziosamente assente": o è configurata correttamente, o niente.

#### Aggiungere un endpoint al client
```typescript
// core/services/api.service.ts
getArticolo(id: string): Promise<Articolo> {
  return this.api_get<Articolo>(`articolo/${encodeURIComponent(id)}`);   // { silent: true } per UI d'errore tua
}
```

#### Persistere dati lato client (cookie, Web Storage, consenso)
Un registro (`COOKIE_MAP` in `core/services/cookie-registry.ts`), un'API, gated dal consenso: registrare una voce basta per toggle nel banner, riga in policy (mezzo/provider/durata) e pulizia alla revoca. Ricetta completa (shape della voce, campi opzionali, la variante `match: 'prefix'` per famiglie di chiavi di SDK di terza parte) in [frontend/README.md](frontend/README.md#aggiungere-un-cookie-o-una-voce-di-web-storage). Qui solo la forma di chiamata, che è quella che serve scrivendo codice:
```typescript
// nel componente/service — instrada sul mezzo (cookie o Web Storage) in base a come la voce è
// registrata, tipizzato su valueType
this.consent.set('mioSalvataggio', { x: 1 });   // gated dal consenso; in SSR è no-op (Web Storage browser-only)
const v = this.consent.get('mioSalvataggio');    // → tipo da valueType | null
```
Mai `localStorage`/`sessionStorage` diretti (lo vieta una regola ESLint, eccetto `CookieConsentService`/`TokenService`): tutto passa dal gate, l'inventario in policy resta completo. Su una voce `match: 'prefix'` (famiglia di chiavi di un SDK terzo) il gating sta a te: carica l'SDK solo dopo il consenso della sua categoria, altrimenti scrive le sue chiavi prima che tu possa pulirle.

#### Google Consent Mode v2 (obbligatorio se usi GA4/Google Ads su utenti UE/UK — non un extra opzionale)
Dal 2024 è requisito Google, pieno enforcement nel 2026: senza, un account perde remarketing/conversion modeling per il traffico UE/UK. Ricetta completa (snippet interi) in [frontend/README.md](frontend/README.md) §"Google Consent Mode v2". Qui solo la mappa di proprietà, perché è quella che conta per non romperla al prossimo merge:

1. `src/index.html` (**Dominio**) — stub `gtag('consent','default',{...:'denied'})` PRIMA di qualunque `gtag.js`/GTM.
2. `security-headers.json` (**Scaffold, con eccezione dichiarata** nella `_nota` del file) — whitelist CSP per i domini Google (`script-src`/`connect-src`). **Attenzione:** è Scaffold, quindi un `git merge template/main` lo sovrascrive con la versione del template a ogni merge — l'override CSP **non sopravvive da solo**, va riapplicato a mano dopo ogni merge dal template.
3. `cookie-registry.ts` (**Dominio**) — censisci `_ga`/`_gid` ecc.: categoria `Analytics` (GA4) o `Profiling` (Ads/remarketing) — sono due consensi distinti anche per Google.
4. Un `effect()` di progetto (**Dominio**, es. `core/services/analytics.service.ts`) che chiama `gtag('consent','update', {...})` sui signal `analyticsAccepted()`/`profilingAccepted()` di `CookieConsentService` — stesso pattern di gating della ricetta sopra.

#### AI Act e newsletter — promemoria, non feature dell'Engine
Nessuno dei due esiste nel template oggi (niente chatbot, niente generazione IA, niente newsletter): diventano rilevanti solo se il progetto figlio li aggiunge.
- **Chatbot/contenuti IA** (obbligo dal 2 agosto 2026): avviso esplicito al primo messaggio ("Stai parlando con un sistema di IA"); contenuti generati senza revisione editoriale umana → etichettatura visibile.
- **Newsletter/marketing**: l'iscrizione NON passa da `ConsentCategory`/`CookieConsentService` (quello gestisce storage/tracciamento lato browser) — serve una checkbox propria, non pre-spuntata, separata da un eventuale consenso alla profilazione degli iscritti.

#### Leggere `global-settings.json` tipizzato
Il tipo `GlobalSettings` è generato dallo schema (sorgente unica), non scritto a mano. Dopo aver toccato `global-settings.schema.json`, rigeneralo; un typo di chiave diventa errore a `tsc`.
```bash
npm run generate:types   # → src/app/core/engine/global-settings.types.ts (committato, DO NOT MODIFY)
```
```typescript
import type { GlobalSettings } from '...engine/global-settings.types';
const s = JSON.parse(raw) as GlobalSettings;
s.Localization?.SupportedLanguages   // tipizzato; `s.Localizaton` non compila
```

#### Feature flag / varianti di progetto via `Custom`
La sezione `Custom` di `global-settings.json` (committabile, `additionalProperties: true`, nessuno schema fisso: ci metti quello che vuoi) è il punto giusto per un flag o una variante letta da entrambi i lati senza inventare un meccanismo nuovo — utile per accendere/spegnere una sezione, testare due varianti (CRO/A-B) o passare un ID (analytics, SDK esterno). **Non è remote-config**: cambiare un valore è una modifica al file + un nuovo deploy, non un toggle a runtime.
```json
// global-settings.json — committabile, niente segreti (finisce nel bundle client)
"Custom": { "heroVariant": "B", "showPromoBanner": true, "Analytics": { "TrackingId": "G-XXXXXXX" } }
```
```typescript
// Frontend — inject(APP_CUSTOM) (root README «Configurazione e segreti», frontend/README.md)
readonly custom = inject(APP_CUSTOM);
readonly heroVariant = this.custom['heroVariant'] ?? 'A';
```
> ⚠️ `APP_CUSTOM` si popola solo su una rotta renderizzata dal server (TransferState dall'SSR): su `renderMode: 'client'` (incluse le pagine `requiresAuth`) torna `{}` al caricamento diretto/refresh. Se la pagina che legge il flag deve restare client-side, passa il valore da un endpoint invece che da `APP_CUSTOM` (vedi sotto).
```csharp
// Backend — IConfiguration iniettata nel costruttore (controller/service), mai nell'Engine
public MioService(IConfiguration config) => _config = config;
if (_config.GetValue<bool>("Custom:showPromoBanner")) { /* ... */ }
```
Per un flag/variante che un CRO/SEM specialist deve poter cambiare senza toccare codice TypeScript/C#, il file è comunque lo stesso `global-settings.json`: la ricetta rimane "modifica il JSON, fai il deploy", nessuna dashboard — coerente con l'assenza di un sistema di A/B testing nel template (vedi root README, ruoli CRO/SEM).

#### SEO: escludere una pagina dall'indice
```typescript
// pages/*.pages.ts — pagina pubblica e SSR ma fuori da sitemap e indice (X-Robots-Tag: noindex).
// A differenza di requiresAuth NON forza il client-render. Default: noindex false.
{ path: 'grazie', pageType: PageType.Grazie,
  component: () => import('./grazie/grazie.component').then(m => m.GrazieComponent),
  otherSEO: { noindex: true } }
```

#### Comporre l'identità da una fonte diversa dal file
Il caso base si riempie in `data/identity.json` (campi nello schema engine `Engine/Models/Identity/identity.schema.json`). Per prendere un pezzo da un DB/API si fa l'override del solo metodo dedicato: stesso tipo in ingresso e in uscita, arricchisci e ritorna. Dichiari col framework (`DayOfWeek`, `TimeOnly`, codici ISO), non stringhe magiche né nozioni di schema.org: l'Engine deriva resa e JSON-LD.
```csharp
// backend/Store/AppIdentityStore.cs (di proprietà del progetto)
protected override async Task<SiteIdentity?> ComposeIdentityAsync(
    SiteIdentity? identity, string language, CancellationToken ct)
{
    identity ??= new SiteIdentity();                    // null se non c'è il file
    identity.OpeningHours =                             // lista di intervalli tipizzati
    [
        new() { Day = DayOfWeek.Tuesday,   Opens = new(9, 0), Closes = new(18, 0) },
        new() { Day = DayOfWeek.Wednesday, Opens = new(9, 0), Closes = new(13, 0) },  // pausa pranzo
        new() { Day = DayOfWeek.Wednesday, Opens = new(15, 0), Closes = new(18, 0) },
    ];
    return identity;                                     // stesso oggetto, arricchito
}
```
Stessa filosofia per gli altri "codici": `Currency` ISO 4217, `SedeLegale.Nazione` ISO 3166, lingue in `Localization`. Dichiari il codice, il framework (`CultureInfo`/`Intl`) dà nome e formato. Per una proprietà schema.org che il modello non tipizza, valorizza `identity.Extra`: fuso per ultimo nel nodo entità brand, sovrascrive i default (anche il `@type`, es. → `LocalBusiness` con `geo`/`openingHoursSpecification`); l'Engine si tiene solo `@context` e `@id`.

#### Sito di un'attività fisica (LocalBusiness)
Dichiara `businessType` (sottotipo schema.org) in `data/identity.json`: l'entità brand diventa quel `@type` con indirizzo e `openingHoursSpecification` portati sul nodo. Gli `openingHours` (già tipizzati) non cambiano; l'indirizzo è la `sedeOperativa` (fallback `sedeLegale`); la geo (opzionale per Google, basta l'indirizzo) va in `extra`. `businessType` è una stringa libera (qualsiasi sottotipo `LocalBusiness` valido), non un enum: la metti diretta, non serve `extra`, che resta solo per le proprietà in più (geo, priceRange…). Non è un enum perché i sottotipi sono 150+ ed evolvono, e tanto `extra` può comunque cambiare `@type`: validità schema.org a carico tuo.
```json
{
  "businessType": "Restaurant",
  "sedeOperativa": { "via": "Via Roma", "civico": "1", "cap": "00100", "citta": "Roma", "nazione": "IT" },
  "openingHours": [ { "day": "Monday", "opens": "12:00", "closes": "23:00" } ],
  "extra": { "servesCuisine": "Italian", "priceRange": "€€" }
}
```

#### SEO: dati strutturati (JSON-LD) con campi parlanti
Dichiari `kind` + campi, l'Engine traduce in schema.org (`structured-data.ts`). `kind`: `article` | `faq` | `product` | `event` | `raw`.
```typescript
// site.ts — STATICI (es. FAQ con domande fisse)
otherSEO: { structuredData: { kind: 'faq', questions: [{ question: 'Come?', answer: 'Così.' }] } }
```
```typescript
// content.resolver.ts — DINAMICI dal contenuto (hanno la precedenza sullo statico). Il case va
// nello switch(pageType) dentro loadResolved() (vedi il metodo completo in ContentResolver,
// frontend/src/app/pages/content.resolver.ts) — qui solo il case, non l'intero metodo:
switch (pageType) {
  case PageType.Articolo: {
    const art = await this.apiService.getArticolo(id); content = art;
    structuredData = art && { kind: 'article', headline: art.titolo, author: art.autore, publishedOn: art.data };
    break;
  }
  // casi non coperti: { kind: 'raw', jsonLd: { '@type': 'Recipe', name: '…' } }
}
```

## Ricette — backend

#### Aggiungere un endpoint
DTO in `Models/`, logica in `Services/`, thin controller:
```csharp
[Route("api/v1/orders")]
public class OrdersController : EngineProtectedController   // o EngineApiController (solo API key)
{
    private readonly OrderService _orders;
    public OrdersController(OrderService orders, ILogger<OrdersController> logger)
        : base(logger) => _orders = orders;

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
        => Ok(await _orders.GetAsync(id, ct));
}
```

#### Errori
Lancia, non `return BadRequest`:
```csharp
if (user is null) throw new NotFoundException("utente");   // → 404 ProblemDetails localizzato
```
Un tipo nuovo = una sottoclasse di `ApiException` (in una classe del tuo dominio) + la chiave nei `Resources/*.resx`:
```csharp
public class PaymentRequiredException : ApiException {
    public PaymentRequiredException() : base("error_payment_required", 402) { }
}
```

#### Leggere la sessione
```csharp
var session = CurrentSession<SessionInfo>();   // null se token assente/malformato (in un controller EngineProtectedController)
if (session is null) throw new UnauthorizedException();
```
Fuori da un controller (es. un servizio) resta `user.GetSession<SessionInfo>()` sul `ClaimsPrincipal` ricevuto: `CurrentSession<T>()` è solo lo zucchero sintattico di chi eredita già la base.

#### Ruoli di dominio e `[Authorize]`
`AuthController.Login` emette già un `ClaimTypes.Role` per ogni voce di `session.Roles`, quindi `[Authorize(Roles = "admin")]` funziona nativamente: i ruoli li governi da `SessionInfo.Roles` (in `AccountService`), non toccando il controller. `session.Roles` resta anche leggibile via `User.GetSession<SessionInfo>()` per un enforce puntuale (`session.Roles.Contains("admin")` → `ForbiddenException`). Le due nozioni di "ruolo" sono spiegate in [backend/README.md](backend/README.md) §"Sistema di Login e Sessioni JWT".

#### Pubblicare una notifica realtime
Proprietà ambient, niente inject:
```csharp
Notifications.Publish(NotificationTarget.Connection(ConnectionId!),
    new NotificationMessage { Type = "toast",
        Payload = new { messageKey = "fatto", icon = "success" } });
```

#### Task lungo con notifica a fine lavoro (email o realtime)
```csharp
BackgroundQueue.TryEnqueue(async (services, ct) => {
    var store = services.GetRequiredService<IContentStore>();   // scope DI proprio
    await ImportAsync(store, ct);
    await services.GetRequiredService<IDeliveryService>().DeliverAsync(
        new DeliveryMessage { Target = target, Email = email, Body = "Import completato" },
        DeliveryChannel.Auto, ct);                              // Auto = realtime, fallback email se offline
});
return Accepted();                                             // 202 (503 se la coda è satura)
```

#### Sostituire un servizio dell'Engine
Vince l'ultima registrazione:
```csharp
// Program.cs, blocco "── SERVIZI APPLICATIVI ──" — es. l'identità da un DB invece che da identity.json
builder.Services.AddSingleton<IIdentityStore, DbIdentityStore>();
```

#### Esportare e cancellare i dati personali
`GET`/`DELETE /me/data` esistono già (protetti da login, cifrati in export) e il punto da riempire pure: `Store/AppPersonalDataStore.cs`, l'unica `IPersonalDataStore` del sito (già registrata in `Program.cs`, non un export per controller di dominio). Aggreghi lì i tuoi store:
```csharp
// Store/AppPersonalDataStore.cs — aggiungi i tuoi store di dominio ai due metodi
public async Task<object?> ExportAsync(ClaimsPrincipal user, CancellationToken ct)
{
    var session = user.GetSession<SessionInfo>();   // la forma di SessionInfo è tua, non dell'Engine
    if (session is null) return null;
    return new { profilo = await _profili.GetAsync(session.UserId, ct) /* , acquisti = ... */ };
}
```
`EraseAsync` è il diritto all'oblio completo: cancella anche l'account (credenziali e identificativi sono dati personali), salvo i dati con obbligo legale di conservazione, da anonimizzare. La parte account è già delegata a `Services/AccountService.cs`, l'unico posto che conosce gli account, lo stesso che verifica le credenziali per `AuthController`: con account reali riempi `DeleteAccountAsync` lì. Dopo la `DELETE` il JWT resta valido fino a scadenza: il frontend fa logout locale e gli store tollerano un `UserId` orfano come "nessun dato". Dettagli (semantica, token, cifratura della risposta, `Security.CryptoSecret`) in [backend/README.md](backend/README.md) §9.

#### Chiamare un'API esterna
Outbound: URL/chiave in config, client tipizzato, errori verso l'upstream:
```csharp
// Program.cs, blocco "── SERVIZI APPLICATIVI ──"
builder.Services.Configure<PaymentProviderOptions>(builder.Configuration.GetSection("PaymentProvider"));
builder.Services.AddHttpClient<PaymentProviderService>();   // BaseUrl/ApiKey da IOptions, mai hardcoded
```
```csharp
// Services/PaymentProviderService.cs — errore upstream, non un 500 generico
if (!response.IsSuccessStatusCode) throw new BadGatewayException();   // 502; vedi anche 503/504
```
Dettagli (config `Custom`/sezione dedicata, segreto in `.local.json` o env var, timeout/gate) in [backend/README.md](backend/README.md) §8.

#### Ricevere un webhook
Inbound: firma sul body grezzo, non sul DTO:
```csharp
[HttpPost, AllowAnonymous]   // pubblico per forza: il chiamante è il servizio terzo, non il tuo frontend
public async Task<IActionResult> Receive(CancellationToken ct) {
    var rawBody = await new StreamReader(Request.Body).ReadToEndAsync(ct);
    if (!WebhookSignature.IsValid(rawBody, Request.Headers["X-Signature"]!, _secret))
        throw new UnauthorizedException();                 // valida PRIMA di deserializzare
    BackgroundQueue.TryEnqueue(async (services, ct) => /* elabora fuori dalla richiesta */ );
    return Ok();                                            // 200 rapido: i provider ritentano se non rispondi in fretta
}
```
Dettagli in [backend/README.md](backend/README.md) §8.

#### Mandare un'email
Diretta (blocca finché non è spedita) o accodata (torna subito, retry in background):
```csharp
// diretta — IEngineMailer iniettato nel costruttore (es. _mailer)
await _mailer.SendAsync(to: new[] { "destinatario@dominio.it" }, subject: "Oggetto",
    body: "Corpo del messaggio", isHtml: false, from: null, cc: null, bcc: null,
    attachments: null, replyTo: null);
```
```csharp
// accodata — IEmailQueue iniettato nel costruttore, non blocca la richiesta HTTP
_emailQueue.TryEnqueue(new EmailMessage(to: [...], subject: "...", body: "...", isHtml: false));
```
Senza una sezione `Mail` valida in config (`Host` + `FromAddress`) `IsEnabled` è `false` e l'invio diretto lancia `MailNotConfiguredException` (503): gate prima con `_mailer.IsEnabled`. Dettagli (SMTP, anti-spam, allegati) in [backend/README.md](backend/README.md) §5.

#### Farsi avvisare quando qualcosa si rompe
`ErrorReporting.WebhookUrl` in `global-settings.local.json` (vuoto = spento): valorizzalo e basta, `ApiExceptionHandler` manda già da solo un POST JSON al webhook per ogni bug vero o errore ≥500 — nessuna chiamata da scrivere, nessun pacchetto NuGet. Niente SDK di vendor: se ti serve un vero APM (Sentry e simili, con source map/release tracking), installi il loro SDK nel tuo progetto, questo resta il minimo "avvisami e basta".
```json
// global-settings.local.json
"ErrorReporting": { "WebhookUrl": "https://tuoendpoint.tld/webhook/errori" }
```
Il payload porta anche `project` (da `project.name`): più progetti sulla stessa VPS possono puntare allo **stesso** webhook restando distinguibili. Dettagli (payload completo, perché resta un webhook generico e non un client Sentry nativo) in [backend/README.md](backend/README.md) §10.

#### Caricare/servire un file
`BlobController` (Dominio, `Controllers/BlobController.cs`) è già pronto: `POST /blob/up` (richiede login) restituisce uno slug, `GET /blob/{slug}` lo riserve (con resize on-demand per immagini via `?webopt=true`). Per cambiare solo il limite di dimensione (default 10 MB), tocca l'attributo sulla stessa azione:
```csharp
// Controllers/BlobController.cs — invariato tutto il resto del metodo Upload
[RequestSizeLimit(50 * 1024 * 1024)] // 50 MB
```
Dal codice (non da un endpoint HTTP) usa direttamente `BlobStore.SaveAsync(IFormFile, CancellationToken)`. Dettagli (cache/ETag, difesa XSS sui content-type) in [backend/README.md](backend/README.md) §"BlobController".

## Documentazione

Documenta cosa garantisce e perché, non il come riga-per-riga: il come vive nei commenti del codice, l'unica fonte che non mente ai refactor. Le ricette qui sopra sono pattern d'uso (cosa fare), non spiegazioni del motore.
