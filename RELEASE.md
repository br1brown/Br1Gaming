# Release di produzione (artifact-based, senza `git pull` sulla VPS)

Ci sono due modi di pubblicare, e convivono. Riassunto:

| | `./deploy-release.sh` (artifact-based) | `./scripts/deploy.sh` (source-based) |
|---|---|---|
| **Quando usarlo** | **produzione** (consigliato) | **test / sviluppo**, o VPS senza CI |
| Cosa serve sulla VPS | solo il *deploy bundle* + i tuoi segreti | tutto il sorgente (`git pull`) |
| Chi compila | la CI (GitHub Actions), una volta per tag | la VPS, a ogni deploy |
| Unità di deploy | immagini Docker versionate (GHCR **o** file allegati alla Release) | codice sorgente |
| Riproducibilità | l'immagine testata è quella che gira | dipende dalla macchina |

## Quale usare?

In produzione usa `./deploy-release.sh`: la VPS scarica un'immagine già buildata e testata dalla CI, niente sorgente, niente compilazione in loco, e ciò che gira è esattamente ciò che è passato dai controlli. È il modello consigliato. `./scripts/deploy.sh` (il vecchio modo) è sconsigliato in produzione, ma resta valido e comodo quando compili e provi in locale, stai facendo prove veloci, o hai una VPS che builda da sé senza una CI che pubblichi le immagini. Fa tutto sulla macchina dove giri (build + swap), quindi è pratico per i test ma pesante e meno riproducibile per la produzione.

Il resto di questo documento riguarda il primo: fai una release, la produzione la scarica. Niente sorgente sulla VPS, niente compilazione in produzione.

## Come funziona in due frasi

1. Tagghi una versione → GitHub Actions builda le immagini `frontend` e `backend` e le rende
   disponibili in due forme sulla stessa Release: pubblicate su GHCR
   (`ghcr.io/<owner>/<repo>-frontend|-backend`) e allegate come file `.tar.gz`
   (`<svc>-image-<tag>.tar.gz`). Alla Release è allegato anche un piccolo deploy bundle (i file
   di orchestrazione).
2. Sulla VPS lanci `./deploy-release.sh`: prende le immagini (da GHCR con `pull`, oppure dai
   `.tar.gz` con `docker load` se li trova accanto a sé), le prova in isolamento (preflight con
   healthcheck) e, solo se sane, fa lo swap.

## Due modi di far arrivare le immagini

Lo script sceglie da solo, ma puoi forzarlo:

- **A) Da GHCR** (`--from-ghcr`) — `docker compose pull`. Trasferisce solo i **layer cambiati**:
  deploy incrementali e veloci. Se il registry è privato serve `docker login ghcr.io` una volta.
- **B) Da file** (`--from-files`) — `docker load` dei `.tar.gz` che metti accanto allo script (o in
  `--images-dir DIR`). **Nessun registry, nessun `docker login`**: scarichi/scp i file e vai. In
  cambio scarichi l'**immagine intera** a ogni release (niente dedup dei layer).
- **Default automatico:** se i `.tar.gz` delle immagini sono presenti → usa B; altrimenti A.

Regola pratica: deploy frequenti → A (GHCR); massima semplicità / repo privata senza voglia
di gestire il login Docker → B (file).

## Configurazione una tantum (nel repo GitHub)

Repository variable `FRONTEND_BASE_URL`: Settings → Secrets and variables → Actions →
Variables → New repository variable:

- Nome: `FRONTEND_BASE_URL`
- Valore: il dominio pubblico **completo**, es. `https://miodominio.it`

Non è un segreto (è il tuo URL pubblico), ma va nella CI perché il frontend congela nel bundle,
a build-time, gli URL assoluti di default in `index.html` (`og:url`/`og:image`). A runtime lo
stesso valore (`FRONTEND_BASE_URL` nell'ambiente del container) alimenta `canonical` e
`sitemap.xml` (quest'ultima generata a richiesta, non più al build — vedi §"sitemap.xml: endpoint
runtime" in [frontend/README.md](frontend/README.md)). Deve combaciare esattamente con
`frontend.hostname` nel `global-settings.local.json` della VPS in ENTRAMBI i momenti, altrimenti
il sito è raggiungibile ma con URL SEO sbagliati.

Il push su GHCR usa il `GITHUB_TOKEN` automatico: nessun altro segreto da configurare. La prima
release rende il package GHCR privato di default, vedi "Registry privato" più sotto.

## Pubblicare una release

```bash
git tag v1.2.3
git push origin v1.2.3
```

Il workflow Release di Produzione parte da solo, builda, pubblica su GHCR e crea la Release
`v1.2.3` con allegati: `deploy-bundle-1.2.3.tar.gz` (orchestrazione) e
`frontend-image-1.2.3.tar.gz` / `backend-image-1.2.3.tar.gz` (immagini per il Modo B).
(In alternativa: Actions → Release di Produzione → Run workflow, passando un tag già esistente.)

## Pubblicare sulla VPS

**Modo A — da GHCR (repo pubblica):**

```bash
mkdir -p /srv/br1 && cd /srv/br1
# scarica ed estrai il deploy bundle della release
curl -fsSL https://github.com/<owner>/<repo>/releases/download/v1.2.3/deploy-bundle-1.2.3.tar.gz | tar xz
# metti i segreti REALI di produzione (restano solo qui, mai su git)
cp global-settings.local.example.json global-settings.local.json
$EDITOR global-settings.local.json     # frontend.hostname, Security.*, Mail.*, ...
# pubblica: pull da GHCR + preflight + swap
./deploy-release.sh
```

> Il `cp` del `.local` è opzionale: se `global-settings.local.json` non c'è, lo script lo crea
> con segreti generati ma `frontend.hostname` vuoto, e il deploy si ferma finché non metti
> il tuo dominio (deve combaciare con `FRONTEND_BASE_URL` della CI). È voluto: le chiavi te le genera,
> il dominio lo scegli tu. Imposta anche la porta se hai altri progetti sulla stessa VPS.

**Modo B — da file (nessun registry né `docker login`):** scarichi il bundle **e** i due
`.tar.gz` delle immagini nella stessa cartella (con `curl` se la repo è pubblica, con `gh`/token se
privata; oppure li scarichi sul tuo PC e li `scp` sulla VPS). Poi:

```bash
cd /srv/br1
tar xzf deploy-bundle-1.2.3.tar.gz
cp global-settings.local.example.json global-settings.local.json && $EDITOR global-settings.local.json
# i .tar.gz delle immagini sono qui accanto → docker load + preflight + swap (nessun pull)
./deploy-release.sh
```

Repo PRIVATA: vedi la sezione seguente. Col Modo B ti serve solo scaricare i file
autenticato (niente `docker login`); col Modo A serve anche `docker login ghcr.io`.

Aggiornamento a una versione nuova: riscarichi il bundle della nuova release (contiene il
`release.env` con il tag giusto) e rilanci `./deploy-release.sh`. Il tuo `global-settings.local.json`
resta dov'è. Se i file di orchestrazione non sono cambiati puoi anche solo forzare il tag:

```bash
./deploy-release.sh --tag 1.3.0
```

Opzioni utili: `./deploy-release.sh --frontend` / `--backend` (deploy parziale),
`./deploy-release.sh --help`.

## Repo privata

Serve un PAT: token classic (GitHub → Settings → Developer settings → Personal access tokens →
Tokens (classic)). Gli scope dipendono dal modo:

- **Modo B (da file)** — scope **`repo`** basta. Scarichi tutti gli asset (bundle + immagini)
  autenticato, `docker load` locale: **niente `docker login`**. È il modo più semplice su repo privata.
- **Modo A (da GHCR)** — scope **`repo`** (asset Release) + **`read:packages`** (pull da GHCR), e in
  più `docker login ghcr.io`.

**Modo B — scaricare tutto e andare:**

```bash
export GH_PAT=ghp_xxxxxxxx
echo "$GH_PAT" | gh auth login --with-token
# scarica TUTTI gli asset della release (bundle + <svc>-image-*.tar.gz) nella cartella corrente
gh release download v1.2.3 --repo <owner>/<repo>
tar xzf deploy-bundle-1.2.3.tar.gz
cp global-settings.local.example.json global-settings.local.json && $EDITOR global-settings.local.json
./deploy-release.sh            # trova i .tar.gz → docker load, nessun login
```

(In alternativa scarichi gli asset sul tuo PC e li `scp` sulla VPS: sulla VPS non serve neanche `gh`.)

**Modo A — pull da GHCR:** oltre a scaricare il bundle come sopra, fai una tantum il login al
registry privato:

```bash
echo "$GH_PAT" | docker login ghcr.io -u <tuo-utente> --password-stdin
./deploy-release.sh --from-ghcr
```

Alternativa "tutto pubblico": puoi rendere pubblici i due package GHCR (pagina del repo →
Packages → Package settings → Change visibility): il `pull` (Modo A) non richiederà login. Gli asset
della Release restano comunque privati finché la repo è privata, quindi vanno scaricati con
`gh`/token o copiati a mano.

## Fork / progetti figli

Le immagini derivano dal nome del repo (`ghcr.io/<owner>/<repo>-…`), quindi un fork pubblica sotto
il proprio namespace senza toccare nulla. Se sulla VPS vuoi puntare a immagini di un altro
namespace, sovrascrivi in `release.env` (o come variabili d'ambiente) `RELEASE_IMAGE_FRONTEND` e
`RELEASE_IMAGE_BACKEND`.
