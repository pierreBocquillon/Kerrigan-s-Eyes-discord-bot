FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dependencies (cached layer)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
 && npm cache clean --force

# Source code
COPY . .

USER node

EXPOSE 3000
CMD ["node", "index.js"]
