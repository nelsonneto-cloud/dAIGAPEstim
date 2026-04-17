# Estágio 1: Build da aplicação usando Node.js
FROM node:20-alpine AS builder
WORKDIR /app

# Copia dependências e instala
COPY package*.json ./
RUN npm install

# Copia o resto do código e gera o build estático
COPY . .
RUN npm run build

# Estágio 2: Servir os arquivos estáticos usando Nginx (Leve e rápido)
FROM nginx:alpine

# Redefine a pasta do Nginx com a saída do Vite
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar a configuração do nginx mapeada para a porta do Cloud Run (8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
