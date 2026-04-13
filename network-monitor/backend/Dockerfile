FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Instalar dependências de sistema
RUN apk add --no-cache sqlite bash chromium nss freetype harfbuzz ca-certificates ttf-freefont

# Configurar Puppeteer para usar Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Copiar CSV de dispositivos
COPY ../dispositivos_monitoramento.csv ./dispositivos_monitoramento.csv 2>/dev/null || true

# Criar diretório de dados
RUN mkdir -p /app/prisma/data/netcar-telecom

EXPOSE 3001

CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate 2>/dev/null || true && node dist/index.js"]
