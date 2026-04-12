FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Instalar pacotes para suporte ao SQLite, se necessário na Alpine
RUN apk add --no-cache sqlite bash

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 3001

# O script de startup pode rodar os migrations e inciar o backend
CMD ["sh", "-c", "npx prisma generate && npx ts-node src/masterDb.ts || true && node dist/index.js"]
