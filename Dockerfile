FROM node:18-alpine

WORKDIR /usr/backend/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 9001

CMD ["node", "backend/server.js"]