FROM docker.m.daocloud.io/library/node:20-bullseye-slim

# 设置 UTF-8 环境变量，确保支持中文文件名
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

WORKDIR /app

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install

COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY .env.example ./

RUN mkdir -p uploads tmp db

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
