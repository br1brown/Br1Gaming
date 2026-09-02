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
RUN apk add --no-cache fontconfig ttf-dejavu font-roboto font-noto font-liberation wget && \
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
