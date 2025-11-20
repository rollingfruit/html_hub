#!/usr/bin/env bash
set -euo pipefail

SSH_ALIAS="${SSH_ALIAS:-aliyun_new}"
REMOTE_DIR="${REMOTE_DIR:-~/apps/html-hub}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "$SSH_ALIAS" ]]; then
  echo "[deploy] 请先通过 SSH_ALIAS 变量指定可免密访问的 ECS 主机" >&2
  exit 1
fi

echo "[deploy] 1/5 构建前端产物"
pushd "$PROJECT_ROOT/client" >/dev/null
npm install
npm run build
popd >/dev/null

echo "[deploy] 2/5 确保远程目录存在: $REMOTE_DIR"
ssh "$SSH_ALIAS" "mkdir -p $REMOTE_DIR"

echo "[deploy] 3/5 同步项目文件"
RSYNC_EXCLUDES=(
  '--exclude=.git/'
  '--exclude=.idea/'
  '--exclude=.vscode/'
  '--exclude=node_modules/'
  '--exclude=server/node_modules/'
  '--exclude=client/node_modules/'
  '--exclude=server/.env'
  '--exclude=server_data/db/*'
  '--exclude=server_data/uploads/*'
  '--exclude=curl_status'
  '--exclude=server_test.log'
)
rsync -avz --delete "${RSYNC_EXCLUDES[@]}" "$PROJECT_ROOT/" "$SSH_ALIAS:$REMOTE_DIR"

echo "[deploy] 4/5 远程执行 docker compose 部署"
ssh "$SSH_ALIAS" "REMOTE_DIR=$REMOTE_DIR bash -s" <<'EOF_REMOTE'
set -euo pipefail
cd "$REMOTE_DIR"
mkdir -p server_data/uploads server_data/db
if [[ ! -f server/.env ]]; then
  cp server/.env.example server/.env
fi
RUN_COMPOSE() {
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "${@}"
  else
    docker compose "${@}"
  fi
}
RUN_COMPOSE down || true
RUN_COMPOSE up -d --build
EOF_REMOTE

echo "[deploy] 5/5 清理无用镜像并输出访问地址"
ssh "$SSH_ALIAS" "docker system prune -f >/dev/null"
PUBLIC_IP=$(ssh "$SSH_ALIAS" "curl -s ipinfo.io/ip 2>/dev/null || curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'")
echo "[deploy] 部署完成，可访问: http://$PUBLIC_IP"
