FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./server.js
COPY public ./public

RUN mkdir -p /app/data

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
