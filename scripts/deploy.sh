#!/usr/bin/env bash
set -euo pipefail

ECS_USER="root"
ECS_IP="your.ecs.ip"
REMOTE_DIR="/opt/ecs-hosting-platform"

if [[ -z "$ECS_IP" || "$ECS_IP" == "your.ecs.ip" ]]; then
  echo "请先在 scripts/deploy.sh 中配置 ECS_IP" >&2
  exit 1
fi

echo "[1/4] 构建前端"
pushd client >/dev/null
npm install
npm run build
popd >/dev/null

echo "[2/4] 安装后端依赖"
pushd server >/dev/null
npm install
npx prisma generate
popd >/dev/null

echo "[3/4] 同步到 ECS"
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'server_data' \
  --exclude '.env' \
  ./ ${ECS_USER}@${ECS_IP}:${REMOTE_DIR}

echo "[4/4] 远程部署"
ssh ${ECS_USER}@${ECS_IP} <<EOF_REMOTE
set -euo pipefail
cd ${REMOTE_DIR}
mkdir -p server_data/uploads server_data/db
npm --prefix server install --production=false || true
npx --prefix server prisma migrate deploy
npm --prefix client install || true
npm --prefix client run build
if command -v docker-compose >/dev/null 2>&1; then
  docker-compose down || true
  docker-compose up -d --build
else
  docker compose down || true
  docker compose up -d --build
fi
EOF_REMOTE

echo "部署完成"
