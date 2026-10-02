FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Installation des dépendances (couche mise en cache)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
 && npm cache clean --force

# Code source
COPY . .

USER node

EXPOSE 3000
CMD ["node", "index.js"]
