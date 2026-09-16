FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json tailwind.config.js postcss.config.js ./
COPY src ./src

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
