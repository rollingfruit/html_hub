#!/usr/bin/env bash
set -euo pipefail

SSH_ALIAS="${SSH_ALIAS:-aliyun_new}"
REMOTE_DIR="${REMOTE_DIR:-~/apps/html-hub}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DATA_DIR="$PROJECT_ROOT/server_data"
DB_STRATEGY="${DB_STRATEGY:-keep}"
CONFIRM_RESET="${CONFIRM_RESET:-}"

usage() {
  cat <<'EOF'
用法: scripts/deploy-ecs.sh [--db-strategy keep|sync|reset]

可用选项:
  --db-strategy   数据库策略 (默认 keep)
                  keep  : 保持远程数据库和上传文件不变
                  sync  : 将本地 server_data/db 与 uploads 增量同步至远端
                  reset : 全量重置远端 server_data，并用本地数据覆盖（高危，需要 CONFIRM_RESET=RESET_DB）
  -h, --help      显示本帮助
用示例：
  1. 仅部署代码（保持线上数据不变）：./scripts/deploy-ecs.sh
  2. 同步本地数据到线上：DB_STRATEGY=sync ./scripts/deploy-ecs.sh
  3. 全量重置：CONFIRM_RESET=RESET_DB ./scripts/deploy-ecs.sh --db-strategy reset

也可通过环境变量 DB_STRATEGY 与 CONFIRM_RESET 控制行为。
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-strategy)
      shift
      DB_STRATEGY="${1:-}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[deploy] 未知参数: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

case "$DB_STRATEGY" in
  keep|sync|reset) ;;
  *)
    echo "[deploy] 非法 DB_STRATEGY: $DB_STRATEGY (可选 keep|sync|reset)" >&2
    exit 1
    ;;
esac

if [[ -z "$SSH_ALIAS" ]]; then
  echo "[deploy] 请先通过 SSH_ALIAS 变量指定可免密访问的 ECS 主机" >&2
  exit 1
fi

echo "[deploy] 1/6 构建前端产物"
pushd "$PROJECT_ROOT/client" >/dev/null
npm install
npm run build
popd >/dev/null

echo "[deploy] 2/6 确保远程目录存在: $REMOTE_DIR"
ssh "$SSH_ALIAS" "mkdir -p $REMOTE_DIR"

echo "[deploy] 3/6 同步项目文件"
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

ensure_remote_data_dirs() {
  ssh "$SSH_ALIAS" "mkdir -p $REMOTE_DIR/server_data/db $REMOTE_DIR/server_data/uploads"
}

sync_local_data_to_remote() {
  if [[ ! -d "$LOCAL_DATA_DIR" ]]; then
    echo "[deploy] 未找到本地 server_data，跳过数据同步"
    return
  fi
  ensure_remote_data_dirs
  if [[ -d "$LOCAL_DATA_DIR/db" ]]; then
    echo "[deploy] 正在同步本地数据库文件 -> 远程"
    rsync -avz "$LOCAL_DATA_DIR/db/" "$SSH_ALIAS:$REMOTE_DIR/server_data/db/"
  fi
  if [[ -d "$LOCAL_DATA_DIR/uploads" ]]; then
    echo "[deploy] 正在同步本地 uploads -> 远程"
    rsync -avz "$LOCAL_DATA_DIR/uploads/" "$SSH_ALIAS:$REMOTE_DIR/server_data/uploads/"
  fi
}

backup_remote_db() {
  local label="$1"
  local timestamp
  timestamp="$(date +%Y%m%d%H%M%S)"
  ssh "$SSH_ALIAS" "cd $REMOTE_DIR && if [[ -f server_data/db/prod.db ]]; then cp server_data/db/prod.db server_data/db/prod.db.${timestamp}.${label}.bak; fi"
}

apply_db_strategy() {
  case "$DB_STRATEGY" in
    keep)
      echo "[deploy] 数据库策略: keep (不触碰远程数据)"
      ;;
    sync)
      echo "[deploy] 数据库策略: sync (增量同步本地 server_data)"
      backup_remote_db "sync"
      sync_local_data_to_remote
      ;;
    reset)
      echo "[deploy] 数据库策略: reset (全量重置，高风险)"
      if [[ "$CONFIRM_RESET" != "RESET_DB" ]]; then
        echo "[deploy] 需显式设置 CONFIRM_RESET=RESET_DB 才能执行全量重置" >&2
        exit 1
      fi
      backup_remote_db "reset"
      ssh "$SSH_ALIAS" "rm -rf $REMOTE_DIR/server_data/db $REMOTE_DIR/server_data/uploads"
      ensure_remote_data_dirs
      sync_local_data_to_remote
      ;;
  esac
}

echo "[deploy] 4/6 处理数据库策略 ($DB_STRATEGY)"
apply_db_strategy

echo "[deploy] 5/6 远程执行 docker compose 部署"
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

echo "[deploy] 6/6 清理无用镜像并输出访问地址"
ssh "$SSH_ALIAS" "docker system prune -f >/dev/null"
PUBLIC_IP=$(ssh "$SSH_ALIAS" "curl -s ipinfo.io/ip 2>/dev/null || curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'")
echo "[deploy] 部署完成，可访问: http://$PUBLIC_IP"
