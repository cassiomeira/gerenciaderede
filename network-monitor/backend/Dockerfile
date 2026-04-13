FROM node:20-alpine
WORKDIR /app

# Instalar dependências de sistema
RUN apk add --no-cache sqlite bash chromium nss freetype harfbuzz ca-certificates ttf-freefont

# Configurar Puppeteer para usar Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm install

COPY . .

# Gerar Prisma client
RUN npx prisma generate

# Criar diretório de dados
RUN mkdir -p /app/prisma/data/netcar-telecom

EXPOSE 3001

# Rodar com tsx (sem necessidade de tsc build)
CMD ["npx", "tsx", "src/index.ts"]
