#!/bin/sh
# =============================================================================
# Inizializzazione progetto derivato dal template Br1WebEngine.
#
# Eseguire una sola volta dopo la clonazione:
#   ./init-project.sh mio-progetto
#
# Lo script rinomina tutti i riferimenti interni al template
# (package.json, angular.json, Dockerfile, .csproj, ecc.),
# sostituisce i README con uno scheletro del nuovo progetto
# e prepara il file .env a partire da .env.example.
#
# Al termine lo script si autoelimina — solo se tutti i passi
# sono andati a buon fine. In caso di errori viene conservato
# per permettere ispezione e riesecuzione.
# =============================================================================

# Nota: set -e rimosso intenzionalmente — gli errori vengono
# tracciati manualmente tramite ERRORS per non interrompere
# l'esecuzione al primo problema.

# --- Argomento obbligatorio ---
if [ -z "$1" ]; then
    echo "Uso: ./init-project.sh <nome-progetto>"
    echo ""
    echo "  nome-progetto   Nome in kebab-case (es. mio-sito, portfolio-2026)"
    echo ""
    echo "Lo script rinomina tutti i riferimenti interni al template."
    exit 1
fi

RAW_NAME="$1"

# --- Validazione nome ---
if ! echo "$RAW_NAME" | grep -qE '^[a-z][a-z0-9-]*$'; then
    echo "ERRORE: il nome progetto deve essere in kebab-case (solo lettere minuscole, numeri e trattini)."
    echo "  Esempio: mio-sito, portfolio-2026, app-cliente"
    exit 1
fi

# --- Derive varianti ---
KEBAB="$RAW_NAME"

# PascalCase: mio-sito → MioSito
PASCAL=$(echo "$KEBAB" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1' | sed 's/ //g')

echo ""
echo "=== Inizializzazione progetto ==="
echo "  kebab-case:  $KEBAB"
echo "  PascalCase:  $PASCAL"
echo ""

# --- Tracking errori ---
ERRORS=0

# --- Funzione di sostituzione ---
replace_in_file() {
    local file="$1"
    local old="$2"
    local new="$3"
    if [ ! -f "$file" ]; then
        echo "  ERRORE: file non trovato: $file"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
    if ! sed -i "s|$old|$new|g" "$file"; then
        echo "  ERRORE: sostituzione fallita in $file"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# --- Frontend ---
echo "[1/6] frontend/package.json"
replace_in_file "frontend/package.json" "br1-web-engine" "$KEBAB"

echo "[2/6] frontend/angular.json"
replace_in_file "frontend/angular.json" "br1-web-engine" "$KEBAB"

echo "[3/6] frontend/package-lock.json"
replace_in_file "frontend/package-lock.json" "br1-web-engine" "$KEBAB"

# --- Dockerfile ---
echo "[4/6] frontend/Dockerfile"
replace_in_file "frontend/Dockerfile" "ARG DIST_PATH=br1-web-engine" "ARG DIST_PATH=$KEBAB"

# --- Backend ---
echo "[5/6] backend/backend.csproj"
replace_in_file "backend/backend.csproj" "<RootNamespace>Br1WebEngine</RootNamespace>" "<RootNamespace>$PASCAL</RootNamespace>"

# --- Solution file ---
echo "[6/6] Br1WebEngine.sln → $PASCAL.sln"
if [ ! -f "Br1WebEngine.sln" ]; then
    echo "  ERRORE: Br1WebEngine.sln non trovato"
    ERRORS=$((ERRORS + 1))
elif ! mv "Br1WebEngine.sln" "$PASCAL.sln"; then
    echo "  ERRORE: rename Br1WebEngine.sln → $PASCAL.sln fallito"
    ERRORS=$((ERRORS + 1))
fi

# --- README: sostituisci con scheletro nuovo progetto ---
echo ""
echo "[readme] Creo README.md per $PASCAL"

cat > README.md << EOF
# $PASCAL

> _Aggiungi qui una breve descrizione del progetto._

Progetto basato su [Br1WebEngine](https://github.com/br1brown/Br1WebEngine) — template full-stack **ASP.NET Core 9 + Angular 19**.

---

## Prerequisiti

- [Docker](https://www.docker.com/) e Docker Compose
- [Node.js](https://nodejs.org/) 20+ con npm (sviluppo frontend in locale)
- [.NET SDK 9](https://dotnet.microsoft.com/download) (sviluppo backend in locale)

## Installazione

\`\`\`bash
git clone <url-repo> $KEBAB
cd $KEBAB
cp .env.example .env
# Personalizza .env — vedi DOCKER_README.md per il dettaglio delle variabili
\`\`\`

## Avvio rapido

\`\`\`bash
# Sviluppo (hot-reload abilitato)
docker compose up --build

# Produzione
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Produzione con backend esposto all'esterno
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.backend-exposed.yml up -d --build
\`\`\`

## Stack tecnologico

| Layer | Tecnologia | Versione |
|---|---|---|
| Backend | ASP.NET Core | 9 |
| Frontend | Angular | 19 |
| Runtime frontend | Node.js | 20+ |
| Containerizzazione | Docker + Docker Compose | — |
| Web server / proxy | Nginx | (immagine ufficiale) |
| Solution | Visual Studio / Rider | .sln |

Architettura: frontend e backend sono container separati orchestrati da Docker Compose. In sviluppo il frontend fa il proxy delle chiamate API verso il backend tramite la configurazione Nginx locale. In produzione il proxy è gestito direttamente da Nginx nel container frontend.

## Struttura del progetto

\`\`\`text
$PASCAL/
├── $PASCAL.sln                     # Solution Visual Studio
├── global.json                     # Versione .NET SDK fissata
├── backend/                        # API ASP.NET Core 9
│   ├── Controllers/                # Endpoint HTTP
│   ├── Engine/                     # Logica core del template
│   ├── Models/                     # Modelli di dominio
│   ├── Security/                   # Autenticazione / autorizzazione
│   ├── Services/                   # Servizi applicativi
│   ├── Store/                      # Accesso ai dati
│   ├── Program.cs                  # Entry point e DI container
│   ├── appsettings.json            # Configurazione applicazione
│   ├── backend.csproj              # Progetto .NET (namespace: $PASCAL)
│   └── Dockerfile
├── frontend/                       # SPA Angular 19
│   ├── src/
│   │   ├── app/                    # Componenti e moduli Angular
│   │   ├── assets/                 # Risorse statiche
│   │   ├── environments/           # Config per dev/prod
│   │   └── styles/                 # Stili globali
│   ├── angular.json                # Config Angular CLI (nome: $KEBAB)
│   ├── package.json                # Dipendenze npm (name: $KEBAB)
│   ├── tsconfig.json
│   ├── nginx.conf                  # Config Nginx in produzione
│   ├── docker-entrypoint.sh        # Inietta variabili runtime nel bundle
│   └── Dockerfile
├── docker-compose.yml              # Base: servizi, rete, volumi
├── docker-compose.override.yml     # Sviluppo locale (hot-reload)
├── docker-compose.prod.yml         # Produzione (restart: always)
├── docker-compose.backend-exposed.yml  # Opzionale: espone il backend
├── .env.example                    # Template variabili d'ambiente
├── .env                            # Variabili locali (non committare)
├── .gitignore
├── .nvmrc                          # Versione Node.js fissata
├── LICENSE
├── README.md
└── DOCKER_README.md
\`\`\`

## Comandi utili

| Comando | Descrizione |
|---|---|
| \`docker compose up --build\` | Avvia in modalità sviluppo |
| \`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build\` | Avvia in produzione |
| \`docker compose down\` | Ferma e rimuove i container |
| \`docker compose logs -f\` | Segui i log in tempo reale |
| \`docker compose ps\` | Mostra lo stato dei servizi |

## Configurazione

Copia \`.env.example\` in \`.env\` e imposta almeno \`PROJECT_NAME\` e \`FRONTEND_PORT\`:

\`\`\`bash
cp .env.example .env
\`\`\`

Consulta [DOCKER_README.md](DOCKER_README.md) per il dettaglio di ogni variabile.

## Prossimi passi

- [ ] Imposta \`FRONTEND_PORT\` in \`.env\`
- [ ] Personalizza \`frontend/src/app/site.ts\` con nome e metadati del sito
- [ ] Aggiungi la logica di dominio nel backend (\`Controllers/\`, \`Models/\`, \`Services/\`)
- [ ] Aggiorna la descrizione in cima a questo README

## Contribuire

1. Forka il repository
2. Crea un branch: \`git checkout -b feature/nome-feature\`
3. Committa le modifiche: \`git commit -m 'feat: descrizione breve'\`
4. Pusha il branch: \`git push origin feature/nome-feature\`
5. Apri una Pull Request

## Licenza

Distribuito sotto licenza MIT. Vedi [LICENSE](LICENSE) per i dettagli.
EOF
if [ $? -ne 0 ]; then
    echo "  ERRORE: scrittura README.md fallita"
    ERRORS=$((ERRORS + 1))
fi

echo "[readme] Creo DOCKER_README.md per $PASCAL"

cat > DOCKER_README.md << EOF
# $PASCAL - Docker Setup

Guida operativa per eseguire $PASCAL con Docker.

## File Compose

- **\`docker-compose.yml\`** - base: servizi, build, rete, volumi con nome derivato da \`PROJECT_NAME\`
- **\`docker-compose.override.yml\`** - sviluppo locale (applicato automaticamente)
- **\`docker-compose.prod.yml\`** - produzione: \`restart: always\` e log rotation
- **\`docker-compose.backend-exposed.yml\`** - opzionale: espone il backend su \`BACKEND_PORT\`

## Avvio

\`\`\`bash
# Sviluppo
docker compose up --build

# Produzione
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Produzione con backend esposto
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.backend-exposed.yml up -d --build
\`\`\`

## Variabili \`.env\`

| Variabile | Obbligatoria | Default | Descrizione |
|---|---|---|---|
| \`PROJECT_NAME\` | si | — | Identifica il progetto, usato per i volumi |
| \`FRONTEND_PORT\` | si | — | Porta host del frontend in produzione |
| \`BACKEND_PORT\` | no | vuoto | Porta host del backend (richiede compose backend-exposed) |
| \`API_KEY\` | no | \`frontend\` | API key iniettata nel frontend a runtime |
| \`API_URL\` | no | vuoto | Vuoto = proxy Nginx; valorizzato = backend remoto |
| \`DEV_FRONTEND_PORT\` | no | \`4200\` | Porta frontend in sviluppo |
| \`DEV_BACKEND_PORT\` | no | \`5000\` | Porta backend in sviluppo |

## Note

- Ogni progetto sulla stessa VPS usa una porta diversa (\`FRONTEND_PORT\`)
- Il template non usa sottopath (\`/nome-progetto\`): ogni istanza ha una porta dedicata
- I volumi sono isolati per progetto tramite \`PROJECT_NAME\`
EOF
if [ $? -ne 0 ]; then
    echo "  ERRORE: scrittura DOCKER_README.md fallita"
    ERRORS=$((ERRORS + 1))
fi

# --- .env ---
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo ""
    echo "[env] Creo .env da .env.example con PROJECT_NAME=$KEBAB"
    if ! cp .env.example .env; then
        echo "  ERRORE: copia .env.example → .env fallita"
        ERRORS=$((ERRORS + 1))
    elif ! sed -i "s|PROJECT_NAME=CHANGE_ME|PROJECT_NAME=$KEBAB|g" .env; then
        echo "  ERRORE: sostituzione PROJECT_NAME in .env fallita"
        ERRORS=$((ERRORS + 1))
    fi
fi

# --- Esito ---
echo ""

if [ "$ERRORS" -gt 0 ]; then
    echo "=========================================="
    echo "  ATTENZIONE: $ERRORS errore/i rilevati."
    echo "  Controllare i messaggi ERRORE sopra."
    echo "  Lo script NON è stato eliminato."
    echo "  Correggere il problema e rieseguire."
    echo "=========================================="
    exit 1
fi

echo "Fatto. Riferimenti rinominati:"
echo "  br1-web-engine     →  $KEBAB"
echo "  Br1WebEngine       →  $PASCAL"
echo "  Br1WebEngine.sln   →  $PASCAL.sln"
echo ""
echo "README.md e DOCKER_README.md ricreati per $PASCAL."
echo ""
echo "Prossimi passi:"
echo "  1. Controlla .env e imposta FRONTEND_PORT"
echo "  2. Personalizza frontend/src/app/site.ts"
echo "  3. git add -A && git commit -m 'init: $KEBAB'"
echo ""

# Autoelimina lo script (solo se tutto è andato a buon fine)
rm -- "$0"
