# ⚡ Quickstart

Zero teoria: i comandi per avere un progetto in piedi. Per il *perché* delle cose, la mappa completa è in [README.md](README.md).

## 1. Nasci dal template

Il tuo progetto vive in un repo tuo: il template entra come secondo remote e resta la sorgente da cui, con un `merge`, tirerai gli aggiornamenti dell'Engine. Non cloni il template come punto di partenza, lo innesti nel tuo repo, una volta per tutte.

```bash
# dentro il tuo repo (anche appena inizializzato)
git remote add template https://github.com/br1brown/Br1WebEngine.git
git fetch template
git merge template/main --allow-unrelated-histories   # alla nascita, mai più dopo
git config merge.ours.driver true   # i file marcati merge=ours in .gitattributes restano tuoi ai merge (lo fa anche setup.mjs; in ogni altro clone va rifatto)
```

Per aggiornare l'Engine in futuro, niente `--allow-unrelated-histories`: dopo l'innesto la storia è collegata.

```bash
git fetch template
git merge template/main
```

Regole d'oro sui conflitti (dettaglio in [AGENTS.md](AGENTS.md#template-vivo-nascita-e-aggiornamento-dei-progetti-figli), che resta anche nel figlio): sui path Engine e scaffold vince il template, sul dominio vince il tuo progetto.

## 2. Battezza il progetto

```bash
node setup.mjs "Nome Progetto"
```

Risponde `[s/N]`: `N` tiene la demo (comoda per esplorare), `s` parte puliti (eject). Se non sai cosa scegliere, `N`.

## 3. Modifica questi 4 file

| File | Cosa ci metti |
| :--- | :--- |
| `global-settings.json` | Nome, lingue, colore del brand, interruttori `Features` (login, mail, segnalazione errori, form) |
| `global-settings.local.json` | Porte e segreti (già generato da `setup.mjs`, `Security.Token.SecretKey` compresa); il login si accende in `Features` di `global-settings.json` (`PublicLogin` o `Login`) |
| `frontend/src/app/pages/*.pages.ts` + `site.ts` | Le tue pagine (path, titolo, componente) nei file di area; slot globali in `site.ts`, menu in `nav.ts` |
| `backend/data/identity.json` | Dati legali e social del sito (servito su `GET /identity`) |

## 4. Su

```bash
./scripts/deploy.sh
```

Valida la configurazione, fonde `global-settings.json` col `.local` in un file effettivo, lo monta nei container e fa `docker compose up` con gli health check. Un `docker compose up` lanciato a mano non passa da quella fusione: i container vedrebbero il solo file base, senza chiavi, e non partirebbero. Il deploy è lo script, non il compose.

> In produzione, invece di buildare sulla VPS, il modello consigliato è la release artifact-based: la CI builda le immagini e la VPS le scarica. Vedi [RELEASE.md](RELEASE.md). `./scripts/deploy.sh` qui sopra resta perfetto per provare in locale.

## Fatto

Frontend su `http://localhost:3000` (o la porta scelta in `global-settings.local.json`).

Da qui in poi, il primo task guidato passo-passo (non il README intero):
- Frontend → [frontend/README.md](frontend/README.md), sezione «Developer Journey: Aggiungere una Pagina»
- Backend → [backend/README.md](backend/README.md), sezione «Developer Journey: Aggiungere un Endpoint»

Riferimento completo quando serve: [frontend/README.md](frontend/README.md), [backend/README.md](backend/README.md), [DOCKER_README.md](DOCKER_README.md) per deploy e configurazione approfondita.
