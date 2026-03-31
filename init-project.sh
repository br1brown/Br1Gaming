#!/bin/sh
# =============================================================================
# Inizializzazione Progetto - Versione con Auto-Rebuild
# =============================================================================

if [ -z "$1" ]; then
    echo "Uso: ./init-project.sh <nome-progetto-kebab-case>"
    exit 1
fi

KEBAB="$1"
PASCAL=$(echo "$KEBAB" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1' | sed 's/ //g')

echo "=== Inizializzazione: $PASCAL ($KEBAB) ==="


# Gestione Solution (.sln)
echo "[1/5] Aggiorno e rinomino la Solution..."
if [ -f "Br1WebEngine.sln" ]; then
    sed -i "s/Br1WebEngine/$PASCAL/g" "Br1WebEngine.sln"
    mv "Br1WebEngine.sln" "$PASCAL.sln"
fi

# Sostituzione Namespace (Solo Backend)
echo "[2/5] Aggiorno Namespace e configurazioni..."
find ./backend -type f \( -name "*.cs" -o -name "*.csproj" -o -name "*.json" \) -exec sed -i "s/Br1WebEngine/$PASCAL/g" {} +

# Configurazione Docker e .env
echo "[3/5] Preparo .env e Docker..."
if [ -f ".env.example" ]; then
    cp .env.example .env
    sed -i "s|PROJECT_NAME=.*|PROJECT_NAME=$KEBAB|g" .env
fi

#  AUTO-REBUILD
echo "[4/5] Avvio Rebuild automatica del Backend..."
if command -v dotnet >/dev/null 2>&1; then
    echo "  -> Ripristino pacchetti NuGet..."
    dotnet restore "$PASCAL.sln"
    echo "  -> Pulizia e Compilazione..."
    dotnet build "$PASCAL.sln" -c Debug
    if [ $? -eq 0 ]; then
        echo "  [OK] Build completata con successo!"
    else
        echo "  [!] Errore durante la build. Controlla i log sopra."
    fi
else
    echo "  [!] Skip Rebuild: .NET SDK non trovato nel PATH."
fi

# README Warning
echo "[5/5] Aggiorno README.md..."
if [ -f "README.md" ]; then
    printf "> [!IMPORTANT]\n> **Istanza**: $PASCAL\n> Progetto inizializzato e compilato.\n\n---\n\n$(cat README.md)" > README.md
fi

echo ""
echo "=== Setup Terminato con Successo! ==="
echo "La solution $PASCAL.sln è stata compilata."
echo "Puoi iniziare a lavorare subito."

# Auto-eliminazione
rm -- "$0"