# Pacchetti Alpine dei font di sistema (SystemFont, font-system.ts) — UNA sola dichiarazione,
# condivisa fra lo stage di build (dove viene anche VERIFICATA, sotto) e lo stage runtime (dove
# viene installata per davvero): aggiungere una voce a SystemFont senza aggiornare questo ARG fa
# fallire il build all'istante invece di scoprirlo a runtime con un font muto in produzione.
ARG FONT_PACKAGES="font-dejavu font-roboto font-noto font-liberation font-opensans font-jetbrains-mono"

# =============================================================================
# Frontend - Angular build + Node SSR runtime
# =============================================================================
FROM node:24-alpine AS build

WORKDIR /app

ARG FRONTEND_BASE_URL
ENV FRONTEND_BASE_URL=${FRONTEND_BASE_URL}

# Identità e config di progetto congelate nel bundle a build-time (nome, versione, lingue,
# descrizione, tema, flag, smoke → <html lang>, manifest, environment.ts). Passate da scripts/deploy.sh
# come JSON minificato (project/Localization/site/Custom, NO segreti): il file non è nel build context.
ARG BR1_PROJECT_JSON
ENV BR1_PROJECT_JSON=${BR1_PROJECT_JSON}

COPY package.json ./
COPY package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --include=dev; else npm install; fi

COPY . .

# Stessi pacchetti font dello stage runtime sotto, installati anche qui SOLO per verificare —
# prima di spendere tempo su lint/build — che coprano per intero SYSTEM_FONTS (font-system.ts):
# l'unico modo genuino di saperlo è controllare che i file esistano DAVVERO su disco dopo un vero
# `apk add`, non fidarsi che l'elenco sia rimasto sincrono con l'enum a mano. Fallisce l'intero
# build (quindi ENTRAMBI i percorsi di pubblicazione, che condividono questo stesso Dockerfile:
# build locale di scripts/deploy.sh e immagine GHCR/tar.gz di deploy-release.sh) se un SystemFont
# viene aggiunto senza aggiornare FONT_PACKAGES sopra, o se un pacchetto Alpine cambia percorso
# interno da una release all'altra. Dettaglio: scripts/checks/system-fonts-installed.ts.
ARG FONT_PACKAGES
RUN apk add --no-cache fontconfig $FONT_PACKAGES && \
    npx tsx src/app/core/engine/scripts/checks/system-fonts-installed.ts

# Esegui il linter prima della build per bloccare deploy con codice errato
RUN npm run lint
RUN npm run build
RUN npm prune --omit=dev

# =============================================================================
# Runtime - Node SSR serves Angular and proxies /api to the backend
# =============================================================================
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DIST_PATH=app

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/app ./dist/app
COPY docker-entrypoint.sh /docker-entrypoint.sh

# /app/fonts è il mount point del volume opzionale del font custom (docker-compose.yml,
# BR1_FONTS_DIR): dichiararlo qui come cartella fontconfig è sicuro anche se al build è ancora
# vuota — fc-match/Sharp lo scoprirà una volta montato il volume a runtime, dopo il refresh
# della cache che fa docker-entrypoint.sh a ogni avvio (il volume non esiste ancora in questa fase).
ARG FONT_PACKAGES
RUN apk add --no-cache fontconfig $FONT_PACKAGES wget && \
    mkdir -p /app/fonts /etc/fonts/conf.d && \
    printf '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <dir>/app/fonts</dir>\n</fontconfig>\n' > /etc/fonts/conf.d/70-custom-fonts-dir.conf && \
    fc-cache -f && \
    chmod +x /docker-entrypoint.sh && \
    addgroup -S app && adduser -S -G app app && chown -R app:app /app
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider "http://localhost:3000/health" || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/app/server/server.mjs"]
