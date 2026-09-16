FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/adapters ./packages/adapters
COPY packages/database ./packages/database
COPY apps/api ./apps/api

RUN npm install
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=packages/adapters
RUN npm run build --workspace=packages/database
RUN npm run build --workspace=apps/api

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
