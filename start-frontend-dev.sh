#!/bin/sh

cd "$(dirname "$0")/frontend"

echo "Verifico dipendenze npm..."
npm install

npm run dev
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "--- Uscito con errore (codice $EXIT_CODE) ---"
    echo "Premi Invio per chiudere..."
    read _
fi
