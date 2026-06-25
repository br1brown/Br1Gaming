# AGENTS.md

Le **regole trasversali** e le **ricette pratiche** del progetto, per chi ci sviluppa — umano o assistente di coding. `AGENTS.md` è una convenzione neutrale (non legata ad alcuno strumento): un umano la legge come guida, un agente la trova da sé. Gli esempi di codice qui sotto servono soprattutto a un **agente** — gli evitano di scandire mezzo repo per ricavare un pattern; a un umano bastano i puntatori, il codice lo legge direttamente. Il *cosa offre / dove vive* per-feature sta nei README ([frontend](frontend/README.md), [backend](backend/README.md)).

## La regola d'oro: Engine vs Dominio

- **Engine = INTOCCABILE**, si aggiorna dal template via merge: `backend/Engine/`, `frontend/src/app/core/engine/`, `frontend/src/styles/engine/`, `frontend/src/assets/i18n/basic.*.json`. Lo **consumi** (token, signal, direttive, classi base), non lo modifichi mai.
- **Dominio = tuo**: tutto il resto. Cambi i comportamenti per **configurazione** (`global-settings(.local).json`, `site.ts`, sezione `Custom`) o per **estensione** (sottoclassi `Engine*`, nuovi servizi), mai editando l'Engine — o il prossimo merge dal template va in conflitto.

## Build, run, test

- **Frontend:** `cd frontend && npm install && npm run start` — **Backend:** `cd backend && dotnet run` (`/health` anonimo; senza `Security.ApiKeys` nel `.local`, ogni richiesta è `401`).
- **Nuovo progetto figlio:** `node setup.mjs "Nome Progetto"`.
- **Qualità (gate = CI, GitHub Actions):** lint, i18n, tsc, dipendenze circolari, a11y, Lighthouse, `npm audit`, vulnerabilità NuGet, gitleaks. In locale on-demand: `./scripts/test/run-all.sh`. Niente hook pre-push: non re-introdurlo. I test unitari sono privati di ogni progetto.

## Commit

Commit narrativi a tema, stile branch + squash: una questione chiusa per commit, non micro-commit.

## Ricette — frontend

**Aggiungere una pagina**
```typescript
// site.ts
export enum PageType { Home, NuovaPagina /* … */ }
pages: (ctx) => [
  { path: 'nuova', pageType: PageType.NuovaPagina, title: 'Nuova',
    requiresAuth: false,                       // true → protetta (guard + redirect), SSR off
    component: () => import('./pages/nuova/nuova.component') },
];
```
```typescript
// pages/nuova/nuova.component.ts — estende la base: this.api / translate / asset / notify già pronti
export default class NuovaComponent extends PageBaseComponent { }
```
```html
<a [appPage]="PageType.NuovaPagina">Vai</a>   <!-- mai URL grezzi -->
```

**Aggiungere un endpoint al client**
```typescript
// core/services/api.service.ts
getArticolo(id: string): Promise<Articolo> {
  return this.api_get<Articolo>(`articolo/${encodeURIComponent(id)}`);   // { silent: true } per UI d'errore tua
}
```

**Persistere dati lato client (cookie o Web Storage)** — UN registro, UN'API, gated dal consenso.
```typescript
// core/services/cookie-registry.ts — registra la voce; storage:'local'|'session' = Web Storage (omesso = cookie)
export const COOKIE_MAP = {
  'mioSalvataggio': { category: ConsentCategory.Technical, storage: 'local', valueType: 'json',
                      descriptionKey: 'mioSalvataggioDescrizioneListaCookie' },
} as const satisfies Readonly<Record<string, CookieConfig>>;
// nel componente/service — instrada sul mezzo, tipizzato su valueType
this.consent.set('mioSalvataggio', { x: 1 });   // gated dal consenso; in SSR è no-op (Web Storage browser-only)
const v = this.consent.get('mioSalvataggio');    // → tipo da valueType | null
```
Registrare la voce basta per: toggle nel banner, riga in policy (col mezzo), pulizia alla revoca. **MAI `localStorage`/`sessionStorage` diretti** (lo vieta una regola ESLint, eccetto il `CookieConsentService` e `TokenService`): tutto passa dal gate, l'inventario in policy resta completo. `setCookie/getCookie/removeCookie` sono alias deprecati di `set/get/remove`.

## Ricette — backend

**Aggiungere un endpoint** (DTO in `Models/`, logica in `Services/`, thin controller)
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

**Errori** (lancia, non `return BadRequest`)
```csharp
if (user is null) throw new NotFoundException("utente");   // → 404 ProblemDetails localizzato
```
Un tipo nuovo = una sottoclasse di `ApiException` (in una classe del tuo dominio) + la chiave nei `Resources/*.resx`:
```csharp
public class PaymentRequiredException : ApiException {
    public PaymentRequiredException() : base("error_payment_required", 402) { }
}
```

**Leggere la sessione**
```csharp
var session = User.GetSession<SessionInfo>();   // null se token assente/malformato
if (session is null) throw new UnauthorizedException();
```

**Pubblicare una notifica realtime** (proprietà ambient, niente inject)
```csharp
Notifications.Publish(NotificationTarget.Connection(ConnectionId!),
    new NotificationMessage { Type = "toast",
        Payload = new { messageKey = "fatto", icon = "success" } });
```

**Lavoro lungo → risposta subito → notifica/email a fine task**
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

**Sostituire un servizio dell'Engine** (vince l'ultima registrazione)
```csharp
// Program.cs, blocco "── SERVIZI APPLICATIVI ──"
builder.Services.AddSingleton<IContentStore, EfContentStore>();
```

## Documentazione

Documenta **cosa garantisce e perché**, non il *come* riga-per-riga — il come vive nei commenti del codice, l'unica fonte che non mente ai refactor. Le ricette qui sopra sono **pattern d'uso** (cosa fare), non spiegazioni del motore.
