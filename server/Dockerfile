FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY src ./src
COPY .env.example ./

RUN mkdir -p uploads tmp db

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
