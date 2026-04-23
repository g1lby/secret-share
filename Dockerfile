FROM node:20-alpine

WORKDIR /app

RUN mkdir -p /app/data

COPY package*.json ./
RUN npm ci --only=production

ARG CACHEBUST=1
COPY server.js .
COPY public/ public/

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "server.js"]