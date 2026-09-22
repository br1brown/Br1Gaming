# AGENTS.md

Le regole trasversali e le ricette pratiche del progetto, per chi ci sviluppa, umano o assistente di coding. Gli esempi di codice qui sotto servono soprattutto a un agente, per evitargli di scandire mezzo repo per ricavare un pattern; a un umano bastano i puntatori, il codice lo legge direttamente. Il cosa offre e dove vive per-feature sta nei README ([frontend](frontend/README.md), [backend](backend/README.md)); l'implementazione interna dell'Engine non citata per nome in quei README sta in [ENGINE.md](ENGINE.md).

> Il file si chiama proprio `AGENTS.md` e non va rinominato. Non è una scelta di stile: è un nome-convenzione cross-tool, non legato a Br1WebEngine né a un singolo strumento. Diversi coding agent (Claude Code, Codex CLI, Cursor e altri) cercano in automatico, alla radice di un repo, un file con esattamente questo nome per caricare contesto di progetto, nessuna configurazione da parte tua. Un umano lo trova comunque se linkato (come nella mappa di [README.md](README.md)); un agente lo trova da sé solo finché resta `AGENTS.md`. Rinominarlo (es. `DEVGUIDE.md`, `RECIPES.md`) non romperebbe nulla per un lettore umano, ma toglierebbe l'auto-discovery agli agenti, la proprietà per cui questo file è fatto così.

## La regola d'oro: Engine vs Dominio

- **Engine = INTOCCABILE**, si aggiorna dal template via merge: `backend/Engine/`, `frontend/src/app/core/engine/`, `frontend/src/styles/engine/`, `frontend/src/assets/i18n/basic.*.json`. Lo **consumi** (token, signal, direttive, classi base), non lo modifichi mai.
- **Dominio = tuo**: tutto il resto. Cambi i comportamenti per **configurazione** (`global-settings(.local).json`, `site.ts`, sezione `Custom`) o per **estensione** (sottoclassi `Engine*`, nuovi servizi), mai editando l'Engine — o il prossimo merge dal template va in conflitto.
- **Risolvere un conflitto di `git merge template/main`:** sui path Engine e Scaffold vince **sempre** il template (`git checkout template/main -- <path>`); sul Dominio vince **sempre** il tuo progetto. Alcuni file di Dominio sono però **a contratto fisso** con l'Engine (path/nome export/forma non negoziabili, es. `site.ts`, `api.service.ts`) — l'elenco completo e il comando esatto sono in [README.md](README.md#-template-vivo-nascita-e-aggiornamento-dei-progetti-figli) § *"Dominio a contratto fisso"*: leggilo prima di risolvere un conflitto su uno di quei file, non a intuito.

## Build, run, test

- **Frontend:** `cd frontend && npm install && npm run start` — **Backend:** `cd backend && dotnet run` (`/health` anonimo; senza `Security.ApiConfig.Keys` nel `.local`, ogni richiesta è `401`).
- **Nuovo progetto figlio:** `node setup.mjs "Nome Progetto"`.
- **Qualità (gate = CI, GitHub Actions):** lint, i18n, tsc, dipendenze circolari, invarianti SiteBuilder, audit live Pa11y+Lighthouse, `npm audit`, vulnerabilità NuGet, gitleaks, CodeQL. In locale on-demand: `./scripts/test/run-all.sh`. Niente hook pre-push: non re-introdurlo. I test unitari sono privati di ogni progetto.

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
`path` accetta anche un segmento diverso per lingua invece della stringa (`path: { it: 'nuova', en: 'new' }`, con più lingue configurate): lo switch lingua e la sitemap/hreflang seguono da soli, nessun altro punto da toccare. Una lingua senza una propria chiave ricade sul segmento della lingua di default.

#### ContentLoader con ApiService (withApi)
`contentLoader` viene eseguito in un Injection Context valido: puoi usare `inject()` al suo interno. Per non ripetere `const api = inject(ApiService);` a ogni rotta, si usa di solito questo helper di dominio (che `setup.mjs` ti inserisce già nel `site.ts` di base):
```typescript
export function withApi(loaderFn: (ctx: ContentLoaderContext, api: ApiService) => Promise<ContentLoaderResult>): ContentLoader {
    return (ctx) => loaderFn(ctx, inject(ApiService));
}
// Da usare così:
contentLoader: withApi(async (ctx, api) => ({ content: await api.getMioDato() })),
```

#### Aggiungere una policy legale extra (oltre alle 5 standard)
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
Speculare all'aggiunta: togli la voce da `legalPages` (`site.ts`) — pagina, rotta e riga nel footer spariscono da soli, "voce assente" è il pattern normale (vedi sopra), non serve toccare altro in `siteBuilder.ts`. Un riferimento diretto rimasto altrove (es. `g.addPage(PageType.PrivacyPolicy)` in `nav.ts`) non rompe il build — `resolveNavItems` scarta in silenzio un `PageType` non più registrato — ma ripulirlo evita una voce di menu morta.
**Eccezione**: se togli la pagina puntata da `cookiePolicy` (stesso file, campo separato dall'array `legalPages` — dettagli in [frontend/README.md](frontend/README.md#pagine-legali-legalpages) §"Rimuovere una pagina"), il build si ferma con un errore esplicito finché non aggiorni anche quel puntatore — a differenza delle altre 4, la Cookie Policy non è mai "silenziosamente assente": o è configurata correttamente, o niente.

#### Aggiungere un endpoint al client
```typescript
// core/services/api.service.ts
getArticolo(id: string): Promise<Articolo> {
  return this.api_get<Articolo>(`articolo/${encodeURIComponent(id)}`);   // { silent: true } per UI d'errore tua
}
```

#### Caricare file da un form (upload)
Due pezzi separati, Engine + Dominio — vedi la regola d'oro in cima al file. `UploadFormComponent` (Engine, `core/engine/components/upload-form/`) è un componente UI puro: gestisce click/drag-and-drop, validazione (`accept`, `maxSize`, `multiple`) ed emette solo `File[]`, mai un upload. L'upload vero — verso `POST /blob/up`, che richiede login — sta al chiamante, tramite `ApiService.uploadBlob`/`.uploadBlobs` (Dominio):
```html
<!-- gate sullo stesso pattern di login già in uso nella pagina (@if (auth.isLoggedIn())), non un avviso custom -->
@if (auth.isLoggedIn()) {
  <app-upload-form
    [multiple]="true"
    [accept]="['image/*']"
    [isLoading]="uploadLoading()"
    [externalError]="uploadError()"
    (filesConfirmed)="onFilesConfirmed($event)" />
}
```
```typescript
protected async onFilesConfirmed(files: File[]): Promise<void> {
  this.uploadLoading.set(true);
  try {
    const slugs = await this.api.uploadBlobs(files);   // sequenziale, stesso ordine di `files`
    // slugs[i] ↔ files[i].name — tieni la corrispondenza esplicita se la mostri, non solo gli slug
  } finally {
    this.uploadLoading.set(false);
  }
}
```
`labels` (input opzionale, `UploadFormLabels`) sovrascrive i testi campo per campo — non passato, ciascuno ricade sulla chiave i18n di default. Per servire/recuperare il file caricato, vedi la ricetta backend "Caricare/servire un file" più sotto (`getBlobUrl(slug)`/`getBlob(slug)` sul client).

#### Persistere dati lato client (cookie, Web Storage, consenso)
Un registro (`COOKIE_MAP` in `core/services/cookie-registry.ts`), un'API, gated dal consenso: registrare una voce basta per toggle nel banner, riga in policy (mezzo/provider/durata) e pulizia alla revoca. Ricetta completa (shape della voce, campi opzionali, la variante `match: 'prefix'` per famiglie di chiavi di SDK di terza parte) in [frontend/README.md](frontend/README.md#aggiungere-voci-in-cookie_map). Qui solo la forma di chiamata, che è quella che serve scrivendo codice:
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
2. `security-headers.override.json` (**Dominio**, radice del progetto) — whitelist CSP per i domini Google (`script-src`/`connect-src`), sotto la chiave `csp`. **Non toccare `security-headers.json`**: è Engine, il Node SSR ne verifica lo sha256 all'avvio e si rifiuta di partire se è stato modificato a mano. `security-headers.override.json` invece è un file di progetto, committabile, che il template non tocca mai: sopravvive a ogni merge senza doverlo riapplicare. Dettaglio in [frontend/README.md](frontend/README.md) §"Estendere la CSP".
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

#### Personalizzare il font
Catalogo/logica in `core/engine/font-system.ts` (Engine, non si tocca), scelta nel design system attivo (Dominio) — è una decisione estetica come colore/pannello, non un file a parte. Un font del catalogo (`SystemFont`, già installato nel container — 11 voci) basta come valore diretto, nessun file da caricare:
```typescript
// components/shared/design-systems/mio-design-system.ts
import { SystemFont } from '../../../core/engine/font-system';
import { muroDesignSystem } from './engine/muro.design-system';

export const mioDesignSystem = extendDesignSystem(muroDesignSystem, {
    defaultFont: SystemFont.Roboto,   // sostituisce web E immagini OG, stesso file per entrambi
});
```
Un font caricato dal progetto è un `CustomFontDef` **pieno**, scritto qui direttamente — mai una `string` che rimanda altrove:
```bash
mkdir -p fonts && cp MioFont.woff2 fonts/   # accanto a global-settings.json
```
```typescript
export const mioDesignSystem = extendDesignSystem(muroDesignSystem, {
    defaultFont: { key: 'brand', family: 'MioFont', faces: [{ file: 'MioFont.woff2', weight: 400, style: 'normal' }] },
});
```
Un secondo font raggiungibile da SCSS ma non attivo (es. per i soli titoli) va in `addonFonts`, mai in un campo a parte — e un design system può anche personalizzare testo/font della sola immagine OG (`ogTextTransform`, es. un font titolazione tutto maiuscolo). Dettagli in [frontend/README.md](frontend/README.md) §"Font: `SystemFont` + `addonFonts`" e §"`ogTextTransform`", e [DOCKER_README.md](DOCKER_README.md) §"Font custom".

#### Creare o personalizzare un design system (tema, colori, chrome)
Non serve capire COME funziona il motore colore (OKLCH, contrasto WCAG, ecc.) per scrivere un design system — solo QUALI valori impostare. `global-settings.json` porta un solo colore di identità, `site.colorTema` (il brand): tutto il resto — tono chiaro/scuro, se le pagine hanno un contenitore visivo distinto dal fondo (oggi implementato come un "pannello" chiaro o scuro — il concetto è "contenuto incorniciato vs a filo sfondo", l'implementazione può cambiare), lo sfondo di navbar/footer, quali pagine mostrano nav/footer/breadcrumb, ed eventuali colori aggiuntivi — è deciso da un **design system**, che scegli o scrivi in codice, mai nel JSON.

**Il modo più rapido**: un preset condiviso della tabella in [frontend/README.md](frontend/README.md) §"Preset di Design System", importato da `components/shared/design-systems/engine/` (es. `muroDesignSystem` per un sito a superficie unica, `cartaDesignSystem` — il default — per un sito con contenuto incorniciato in una card).
```typescript
// site.ts
import { muroDesignSystem } from './components/shared/design-systems/engine/muro.design-system';
buildSite({ shell: { designSystem: muroDesignSystem } });
```

**Per personalizzarne uno** (es. la palette di un cliente specifico): `extendDesignSystem` su un preset condiviso — un oggetto piatto (patch) che tocca solo ciò che ti serve, il resto resta quello del preset scelto. Nessuna classe/`override` da scrivere, nessun registro per nome: stessa forma di ogni altro input del template (`addPage`/`addLink`/`addGroup` in `nav.ts`), e la STESSA con cui è scritto il preset condiviso stesso:
```typescript
// components/shared/design-systems/clienteX.design-system.ts
import { extendDesignSystem, type DesignSystemFactory } from '.../core/engine/design-system-presets';
import { muroDesignSystem } from './engine/muro.design-system';

export const clienteX: DesignSystemFactory = extendDesignSystem(muroDesignSystem, {
    customPalette: { bordeaux: '#5c1a2b' },
});
```
```typescript
// site.ts
import { clienteX } from './components/shared/design-systems/clienteX.design-system';
buildSite({ shell: { designSystem: clienteX } });
```
Esempio reale, stesso pattern: `components/shared/design-systems/example.design-system.ts`. Nessuna gerarchia a classi da conoscere: i preset condivisi dell'Engine sono file in `components/shared/design-systems/engine/` — una sottocartella solo per semantica, scritti con `extendDesignSystem` come qualunque altro (dettaglio in README).

Nessuno spec da scrivere: `validateDesignSystemPreset` (chiamata da `extendDesignSystem` a ogni resolve) garantisce già a runtime che il preset sia strutturalmente valido. Testare il contrasto WCAG di una palette specifica non ha senso qui — è contenuto che cambi a piacere, incluso quello degli 8 preset condivisi.

Dettagli, ogni campo disponibile, e la distinzione fra colori sempre garantiti (`colorBackground`/`colorText`) e colori "duri" che vincono anche sulla garanzia WCAG (`colorSecondary`/`colorInfo`/`customPalette`) in [frontend/README.md](frontend/README.md) §"Tema e Sistema di Colori" e §"Preset di Design System".

#### Aggiungere contenuto al footer oltre i link (P.IVA, sede legale, testo libero, social)
Dentro un `addGroup` del **footer** (`nav.ts`), oltre ad `addPage`/`addLink`/`addGroup` (condivisi con l'header) hai anche `addField`/`addText`/`addSocialLink`/`addCustom` — pensati per contenuto che non è un link a una pagina.
```typescript
// nav.ts
import { FooterField } from './core/engine/footer-content';

footer: (f, ctx) => {
    f.addGroup('footerAzienda', g => {
        g.addField(FooterField.PartitaIva);      // da Identity, auto-nascosto se non valorizzato
        g.addText('footerNote', 'Iscritta al REA di Milano'); // testo libero, mai tradotto
        g.addSocialLink(ctx.identity?.social[0] ?? '', 'LinkedIn'); // esplicito, mai dedotto in blocco
    });
},
```
`f.hideLegalStrip()` (a livello di `footer`, non di gruppo) spegne la fascia automatica delle pagine legali, per chi le inserisce a mano in un gruppo. Ogni voce (header e footer) accetta anche `{ itemClass: 'mia-classe' }` per uno stile puntuale. Dettaglio completo in [frontend/README.md](frontend/README.md) §"Navigazione Multilivello" → "Footer: oltre i link".

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

#### Gestire la UX di aggiornamento versione (PWA / Polling)
Di default, quando il `VersionCheckService` (che unisce SwUpdate e il polling periodico) rileva un aggiornamento, mostra un alert nativo bloccante che forza il ricaricamento.
Se un progetto figlio ha form lunghi o stato che non deve andare perso all'improvviso, puoi intercettare questo evento e mostrare un avviso non invasivo, rinviando l'aggiornamento a un momento più opportuno.
```typescript
// site.ts
export const cfg = buildSite({
    onVersionUpdateAvailable: (apply) => {
        // Salva `apply` in uno store o mostralo in una snackbar non bloccante.
        // Quando l'utente cliccherà "Aggiorna ora", chiama `apply()`.
        // `apply()` si occuperà da solo di attivare il nuovo SW e fare il reload.
        toast.info("Nuova versione disponibile!", { action: () => apply() });
    }
});
```

#### Comporre l'identità da una fonte diversa dal file
Il caso base si riempie in `data/identity.json` (campi nello schema engine `Engine/Models/Identity/identity.schema.json`). Per prendere un pezzo da un DB/API si fa l'override del solo metodo dedicato: stesso tipo in ingresso e in uscita, arricchisci e ritorna. Dichiari col framework (`DayOfWeek`, `TimeOnly`, codici ISO), non stringhe magiche né nozioni di schema.org: l'Engine deriva resa e JSON-LD.

`OpeningHours` (a differenza degli altri campi di `SiteIdentity`) **non è nello schema di `identity.json`**: cambia per motivi operativi (stagione, festività) più spesso di quanto sia ragionevole legarlo a un deploy, quindi va sempre valorizzato qui via codice, mai a mano nel file.
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
// app.pages.ts — DINAMICI dal contenuto (hanno la precedenza sullo statico). Va nel
// `contentLoader` della pagina (stesso posto di `dynamicParams`), non nel resolver generico
// dell'Engine. `info` si fonde sopra il PageInfo statico di site.ts: usalo anche solo per
// titolo/descrizione, senza structuredData, se ti basta quello (es. il titolo nel tab del browser).
{
  pageType: PageType.Articolo,
  contentLoader: async (ctx) => {
    const art = await inject(ApiService).getArticolo(ctx.params['slug']);
    return {
      content: art,
      info: art && { title: art.titolo, description: art.sommario },
      structuredData: art && { kind: 'article', headline: art.titolo, author: art.autore, publishedOn: art.data },
    };
  },
}
// casi non coperti: { kind: 'raw', jsonLd: { '@type': 'Recipe', name: '…' } }
// Query param della richiesta corrente (es. ?g=...): l'hook gira in un injection context valido,
// inject(Router) e leggi router.getCurrentNavigation()?.finalUrl ?? router.parseUrl(router.url).
```

#### Overlay/modali custom (mai `position: fixed` a mano)
Un pannello fixed con z-index alto dentro un componente finisce comunque dentro lo stacking context di `main#main-content` (z-index: 1 apposta per stare sopra sfondo/effetti) e può ritrovarsi sotto la navbar o i suoi dropdown. Passa sempre da CDK Overlay (già importato, monta in `.cdk-overlay-container`, `z-index: var(--z-cdk-overlay)` in `_a11y.scss`) — vedi `ContextMenuDirective`/`ImageLightboxService` come riferimento.

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

#### Personalizzare il rate limiting
Soglie in `Security.ApiConfig.RateLimiting` (`global-settings.json`): `Global.PermitLimit`/`WindowSeconds` per il limite generale per IP, `Login.PermitLimit`/`WindowSeconds` per `POST /auth/login`, `Enabled: false` per disattivarlo del tutto (le policy restano registrate, solo senza effetto — utile dietro un WAF/reverse proxy che applica già le proprie soglie). Per andare oltre i numeri (partizionare per utente invece che per IP, un algoritmo diverso, policy proprie per un endpoint di dominio), `AddTemplateSecurity` accetta un `Action<RateLimiterOptions>` opzionale invocato per ultimo — vince lui:
```csharp
// Program.cs
builder.Services.AddTemplateSecurity(security, options =>
{
    options.AddPolicy("mio-endpoint", ctx => RateLimitPartition.GetSlidingWindowLimiter(
        ctx.User.Identity?.Name ?? "anon", _ => new SlidingWindowRateLimiterOptions { /* ... */ }));
});
```
Dettagli in [backend/README.md](backend/README.md) §1.

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
Il payload porta anche `project` (da `project.name`): più progetti sulla stessa VPS possono puntare allo **stesso** webhook restando distinguibili. Dettagli in [backend/README.md](backend/README.md) §10.

#### Caricare/servire un file
`EngineBlobController` (Engine, `sealed`) è già pronto, nessun controller di progetto da scrivere né da estendere: `POST /blob/up` (richiede login) restituisce uno slug, `GET /blob/{slug}` lo riserve (con resize on-demand per immagini via `?webopt=true`), `PUT /blob/{slug}` (richiede login) ne sostituisce il contenuto e restituisce il NUOVO slug (l'originale resta immutabile), `DELETE /blob/{slug}` lo cancella (richiede login). L'unico punto di contatto col dominio è `FileBlobStore` (classe concreta, non interfaccia — un'interfaccia sarebbe cerimonia senza un secondo storage reale all'orizzonte): la ricetta sotto ("Sostituire un servizio dell'Engine") usa `IIdentityStore` come esempio ma vale identica qui, salvo che si estende/override invece di implementare da zero un'interfaccia.
```csharp
// Store/AppBlobStore.cs — override mirati, il resto resta il default Engine
public override long MaxUploadSizeBytes => 50 * 1024 * 1024; // 50 MB invece del default 10 MB — o calcolalo (ruolo utente, piano...)
public override Task<string> SaveAsync(Stream content, string extension, CancellationToken ct = default)
    => base.SaveAsync(content, extension, ct); // antivirus/quota prima della base
public override Task<bool> DeleteAsync(string slug, CancellationToken ct = default)
    => base.DeleteAsync(slug, ct); // qui c'è già il controllo di proprietà (BlobOwnershipRegistry, EF Core/SQLite): solo chi ha caricato lo slug, o un admin
public override Task<string> ReplaceAsync(string oldSlug, Stream content, string extension, CancellationToken ct = default)
    => base.ReplaceAsync(oldSlug, content, extension, ct); // "modifica" = salva il nuovo poi cancella il vecchio, mai overwrite in-place
```
Dettagli (cache/ETag, difesa XSS sui content-type) in [backend/README.md](backend/README.md) §"EngineBlobController".

## Documentazione

Documenta cosa garantisce e perché, non il come riga-per-riga: il come vive nei commenti del codice, l'unica fonte che non mente ai refactor. Le ricette qui sopra sono pattern d'uso (cosa fare), non spiegazioni del motore.
