# ⚡ Quickstart

Zero teoria: i comandi per avere un progetto in piedi. Per il *perché* delle cose, la mappa completa è in [README.md](README.md).

## 1. Nasci dal template

Il tuo progetto vive in un **repo tuo**: il template entra come secondo remote e resta la sorgente da cui, con un `merge`, tirerai gli aggiornamenti dell'Engine. Non cloni il template come punto di partenza — lo *innesti* nel tuo repo, una volta sola.

```bash
# dentro il tuo repo (anche appena inizializzato)
git remote add template https://github.com/br1brown/Br1WebEngine.git
git fetch template
git merge template/main --allow-unrelated-histories   # solo alla nascita
```

Aggiornare l'Engine in futuro — niente `--allow-unrelated-histories`, ormai la storia è collegata:

```bash
git fetch template
git merge template/main
```

Regole d'oro sui conflitti (dettaglio in [README.md](README.md#-template-vivo-nascita-e-aggiornamento-dei-progetti-figli)): sui path **Engine e scaffold** vince il template, sul **dominio** vince il tuo progetto.

## 2. Battezza il progetto

```bash
node setup.mjs "Nome Progetto"
```

Risponde `[s/N]`: `N` tiene la demo (comoda per esplorare), `s` parte puliti (*eject*). Se non sai cosa scegliere, `N`.

## 3. Modifica questi 4 file

| File | Cosa ci metti |
| :--- | :--- |
| `global-settings.json` | Nome, lingue, colore tema |
| `global-settings.local.json` | Porte e segreti (già generato da `setup.mjs`); valorizza `Security.Token.SecretKey` (≥32 char) solo se vuoi accendere il login |
| `frontend/src/app/site.ts` | Le tue pagine, il menu, le rotte |
| `backend/data/identity.json` | Dati legali e social del sito (servito su `GET /identity`) |

## 4. Su

```bash
./scripts/deploy.sh
```

*(valida la configurazione e fa lui `docker compose up` con gli health check — se preferisci farlo a mano, `docker compose up --build -d` funziona uguale una volta che `global-settings.local.json` esiste.)*

> **In produzione**, invece di buildare sulla VPS, il modello consigliato è la release artifact-based: la CI builda le immagini e la VPS le scarica. Vedi **[RELEASE.md](RELEASE.md)**. `./scripts/deploy.sh` qui sopra resta perfetto per provare in locale.

## Fatto

Frontend su `http://localhost:3000` (o la porta scelta in `global-settings.local.json`).

Da qui in poi, il primo task guidato passo-passo (non il README intero):
- Frontend → [Developer Journey: Aggiungere una Pagina](frontend/README.md#developer-journey-aggiungere-una-pagina)
- Backend → [Developer Journey: Aggiungere un Endpoint](backend/README.md#developer-journey-aggiungere-un-endpoint)

Riferimento completo quando serve: [frontend/README.md](frontend/README.md), [backend/README.md](backend/README.md), [DOCKER_README.md](DOCKER_README.md) per deploy e configurazione approfondita.
