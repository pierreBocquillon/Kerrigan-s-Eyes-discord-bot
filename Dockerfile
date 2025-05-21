FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Installation des dépendances (couche mise en cache)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
 && npm cache clean --force

# Code source
COPY . .

# dossier d'état de l'intégration Kerrigan's Eyes (volume)
RUN mkdir -p /app/data && chown node:node /app/data

USER node

EXPOSE 3000
CMD ["node", "index.js"]
