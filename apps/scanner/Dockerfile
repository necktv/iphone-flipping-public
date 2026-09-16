FROM node:20-alpine AS builder

# Playwright richiede chromium e le sue dipendenze
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

# Imposta Playwright per usare il chromium di sistema
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/adapters ./packages/adapters
COPY packages/database ./packages/database
COPY apps/scanner ./apps/scanner

RUN npm install
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=packages/adapters
RUN npm run build --workspace=packages/database
RUN npm run build --workspace=apps/scanner

CMD ["node", "apps/scanner/dist/scanner.js"]
