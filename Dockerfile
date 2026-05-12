FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY backend/ ./backend/

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "backend/server.js"]
